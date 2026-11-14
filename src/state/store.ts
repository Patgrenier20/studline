import { cloudEnabled, saveCloud } from "../storage/cloud";
import { useWorkspace } from "./workspace";
import { checkLayerEdits } from "../core/layers";
import { create } from "zustand";
import {
  type Project,
  type Point,
  type Wall,
  DEFAULT_WALL,
  demoProject,
  deleteWall,
  validateProject,
} from "../core/model";
import {
  type History,
  emptyHistory,
  execute,
  undo,
  redo,
} from "../core/history";
import { activeProject, saveProject } from "../storage/projects";
import { inches } from "../core/units";
import { deleteOpening } from "../core/openings";
import type { EditAnchor } from "../core/wallEditing";
export type Tool = "select" | "wall" | "door" | "window" | "pan" | "measure";
export type View = "plan" | "model" | "overview";
let initial = demoProject(),
  initialNotice = "Example project · start a new project or edit this study.";
try {
  const active = activeProject();
  if (active) {
    initial = active.project;
    initialNotice = active.recovered
      ? "Recovered your last valid save."
      : "Project restored from this browser.";
  }
} catch {
  initialNotice =
    "Could not restore the last project. Existing saves have been preserved.";
}
interface EditorState {
  project: Project;
  history: History;
  selected: string | null;
  specification:
    { kind: "wall"; id: string } | { kind: "room"; key: string } | null;
  tool: Tool;
  view: View;
  grid: number;
  showGrid: boolean;
  snap: boolean;
  ortho: boolean;
  dimensions: boolean;
  constrainEdits: boolean;
  moveMode: "parallel" | "free";
  editAnchor: EditAnchor;
  defaults: Pick<Wall, "height" | "thickness" | "material">;
  cursor: Point;
  snapKind: string;
  notice: string;
  saveError: string | null;
  fitToken: number;
  revision: number;
  set: (patch: Partial<EditorState>) => void;
  commit: (project: Project, label: string) => boolean;
  replace: (project: Project, persistOnOpen?: boolean) => boolean;
  undo: () => void;
  redo: () => void;
  remove: () => void;
  save: () => void;
}
function persist(project: Project): string | null {
  try {
    if (cloudEnabled()) void saveCloud(project).catch(() => {});
    else saveProject(project);
    return null;
  } catch {
    return "Browser storage is unavailable or full. Export JSON to keep your work.";
  }
}
export const useEditor = create<EditorState>((set, get) => ({
  project: initial,
  history: emptyHistory(),
  selected: null,
  specification: null,
  tool: "select",
  view: "plan",
  grid: inches(6),
  showGrid: true,
  snap: true,
  ortho: true,
  dimensions: true,
  constrainEdits: true,
  moveMode: "parallel",
  editAnchor: "start",
  defaults: DEFAULT_WALL,
  cursor: { x: 0, y: 0 },
  snapKind: "",
  notice: initialNotice,
  saveError: null,
  fitToken: 0,
  revision: 0,
  set,
  commit: (next, label) => {
    try {
      const s = get();
      const result = execute(s.history, s.project, next, label,
        (before, after) => checkLayerEdits(before, after, useWorkspace.getState().layers));
      set({
        ...result,
        saveError: persist(result.project),
        notice: label,
        revision: s.revision + 1,
      });
      return true;
    } catch (e) {
      set({ notice: (e as Error).message });
      return false;
    }
  },
  replace: (project, persistOnOpen = true) => {
    const s = get();
    try {
      validateProject(project);
    } catch (e) {
      set({ notice: (e as Error).message });
      return false;
    }
    if (s.saveError && persist(s.project)) {
      set({
        notice:
          "Current changes are not saved. Export JSON to keep a backup. Restore browser storage before switching projects.",
      });
      return false;
    }
    set({
      project,
      history: emptyHistory(),
      selected: null,
      specification: null,
      tool: "select",
      view: "plan",
      saveError: persistOnOpen ? persist(project) : null,
      defaults: project.setup ? {...DEFAULT_WALL, height:project.setup.wallHeight,thickness:project.setup.wallThickness} : DEFAULT_WALL,
      fitToken: s.fitToken + 1,
      revision: s.revision + 1,
      notice: `Opened ${project.name}`,
    });
    return true;
  },
  undo: () => {
    const s = get(),
      result = undo(s.history);
    if (result)
      set({
        ...result,
        selected: null,
        specification: null,
        tool: "select",
        saveError: persist(result.project),
        notice: "Undo",
        revision: s.revision + 1,
      });
  },
  redo: () => {
    const s = get(),
      result = redo(s.history);
    if (result)
      set({
        ...result,
        selected: null,
        specification: null,
        tool: "select",
        saveError: persist(result.project),
        notice: "Redo",
        revision: s.revision + 1,
      });
  },
  remove: () => {
    const s = get();
    if (s.selected) {
      const opening = s.project.floor.openings.find((o) => o.id === s.selected);
      try {
        const applied = s.commit(
          opening
            ? deleteOpening(s.project, s.selected)
            : deleteWall(s.project, s.selected),
          opening ? `Delete ${opening.kind}` : "Delete wall and its openings",
        );
        if (applied) set({ selected: null });
      } catch (e) {
        set({ notice: (e as Error).message });
      }
    }
  },
  save: () => {
    const s = get();
    const error = persist(s.project);
    set({
      saveError: error,
      notice: error || (cloudEnabled() ? "Saving to account…" : "Project saved in this browser."),
    });
  },
}));
