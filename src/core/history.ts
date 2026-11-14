import { normalizeTopology } from "./topology";
import { reconcileRoomSettings } from "./rooms";
import { type Project, validateProject } from "./model";
export interface Command {
  label: string;
  before: Project;
  after: Project;
}
export interface History {
  past: Command[];
  future: Command[];
}
export const emptyHistory = (): History => ({ past: [], future: [] });
export function execute(
  history: History,
  before: Project,
  after: Project,
  label: string,
  checkEdit?: (before: Project, after: Project) => void,
): { history: History; project: Project } {
  validateProject(after);
  if (JSON.stringify(before.floor.nodes) !== JSON.stringify(after.floor.nodes) ||
      JSON.stringify(before.floor.walls) !== JSON.stringify(after.floor.walls)) {
    const normalized = normalizeTopology(after);
    after = reconcileRoomSettings(before, normalized.project, normalized.sourceWall);
  }
  checkEdit?.(before, after);
  validateProject(after);
  const project = { ...after, modifiedAt: new Date().toISOString() };
  return {
    project,
    history: {
      past: [...history.past, { label, before, after: project }].slice(-100),
      future: [],
    },
  };
}
export function undo(
  history: History,
): { history: History; project: Project } | null {
  const command = history.past.at(-1);
  if (!command) return null;
  return {
    project: command.before,
    history: {
      past: history.past.slice(0, -1),
      future: [command, ...history.future],
    },
  };
}
export function redo(
  history: History,
): { history: History; project: Project } | null {
  const command = history.future[0];
  if (!command) return null;
  return {
    project: command.after,
    history: {
      past: [...history.past, command],
      future: history.future.slice(1),
    },
  };
}
