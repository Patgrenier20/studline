import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  PanelTop,
  Square,
  Grid2X2,
  Magnet,
  Undo2,
  Redo2,
  FolderOpen,
  Save,
  Plus,
  Box,
  Layers,
  Download,
  Settings2,
  Check,
  ArrowUpRight,
  FileJson,
  Building2,
  LayoutTemplate,
  CornerDownRight,
} from "lucide-react";
import { useEditor, type Tool } from "./state/store";
import { PlanCanvas } from "./ui/PlanCanvas";
import { Properties, DimensionField } from "./ui/Properties";
import { Modal } from "./ui/Modal";
import { SpecificationDialogs } from "./ui/SpecificationDialogs";
import { CadMenus } from "./ui/CadMenus";
import { createProject, rectangle, type Project } from "./core/model";
import { useWorkspace } from "./state/workspace";
import {
  ArchitecturalTools,
  ProjectBrowser,
  ContextToolbar,
  LayerPanel,
  ViewTabs,
  ResizeHandle,
} from "./ui/Workspace";
import { bounds } from "./core/geometry";
import { formatImperial, parseImperial, feet, inches } from "./core/units";
import { importProject, listProjects, serialize } from "./storage/projects";
import "./styles.css";
const ModelView = lazy(() => import("./ui/ModelView"));
type Dialog = "new" | "open" | "room" | "settings" | "help" | null;
function IconButton({
  label,
  onClick,
  children,
  disabled = false,
  active = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function ProjectDialog({
  kind,
  close,
}: {
  kind: Exclude<Dialog, null>;
  close: () => void;
}) {
  const s = useEditor(),
    [name, setName] = useState("Untitled residence"),
    [width, setWidth] = useState("20'"),
    [depth, setDepth] = useState("16'"),
    [error, setError] = useState(""),
    [projects, setProjects] = useState<Project[]>([]),
    [newDefaults, setNewDefaults] = useState(s.defaults),
    upload = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (kind === "open") {
      try {
        setProjects(listProjects());
      } catch {
        setError(
          "Browser storage could not be accessed. You can still import a JSON file.",
        );
      }
    }
  }, [kind]);
  const titles = {
    new: "Start a new project",
    open: "Your projects",
    room: "Add a precise room",
    settings: "Drawing preferences",
    help: "A little guidance",
  };
  return (
    <Modal title={titles[kind]} onClose={close}>
      {kind === "new" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (e.currentTarget.querySelector('[aria-invalid="true"]')) {
              setError(
                "Correct the wall dimensions before creating the project.",
              );
              return;
            }
            if (!s.replace(createProject(name))) {
              setError(useEditor.getState().notice);
              return;
            }
            s.set({ defaults: newDefaults });
            close();
          }}
        >
          <p className="modal-intro">
            An empty plan, ready for your next residential project. Your
            existing projects stay saved.
          </p>
          <label className="field">
            <span>Project name</span>
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="new-project-spec">
            <Building2 size={24} />
            <div>
              <strong>Residential · Ground floor</strong>
              <span>Feet & inches · starting wall dimensions</span>
            </div>
          </div>
          <div className="field-row">
            <DimensionField
              label="New wall height"
              value={newDefaults.height}
              onChange={(n) => {
                if (n < feet(1) || n > feet(30))
                  throw new Error("Use 1–30 feet.");
                setNewDefaults({ ...newDefaults, height: n });
              }}
            />
            <DimensionField
              label="New wall thickness"
              value={newDefaults.thickness}
              onChange={(n) => {
                if (n < inches(0.25) || n > inches(48))
                  throw new Error("Use 1/4–48 inches.");
                setNewDefaults({ ...newDefaults, thickness: n });
              }}
            />
          </div>
          <button className="primary full" type="submit">
            Create project <ArrowUpRight size={16} />
          </button>
        </form>
      )}
      {kind === "room" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const w = parseImperial(width),
                d = parseImperial(depth);
              if (w < feet(1) || d < feet(1))
                throw new Error("Use room dimensions of at least one foot.");
              const b = bounds(s.project),
                origin = s.project.floor.walls.length
                  ? { x: b.maxX + feet(4), y: b.minY }
                  : { x: 0, y: 0 };
              const next = rectangle(s.project, w, d, origin, s.defaults);
              if(!s.commit(next, "Create rectangular room")) throw new Error(useEditor.getState().notice);
              s.set({
                fitToken: s.fitToken + 1,
                selected: null,
                tool: "select",
                view: "plan",
              });
              close();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <p className="modal-intro">
            Create four connected walls with exact centerline dimensions. New
            rooms are placed beside existing geometry.
          </p>
          <div className="field-row">
            <label className="field">
              <span>Room width</span>
              <input
                aria-label="Room width"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Room depth</span>
              <input
                aria-label="Room depth"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
              />
            </label>
          </div>
          <p className="field-hint">Try 16′, 192″, or 16′ 3 1/2″.</p>
          <button className="primary full" type="submit">
            Create four walls <Square size={15} />
          </button>
        </form>
      )}
      {kind === "open" && (
        <>
          <p className="modal-intro">
            Projects saved in this browser. Import a Studline JSON file to
            continue work from another device.
          </p>
          <div className="project-list">
            {projects.length ? (
              projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    if (!s.replace(p)) {
                      setError(useEditor.getState().notice);
                      return;
                    }
                    close();
                  }}
                >
                  <div className="project-tile">
                    <LayoutTemplate size={25} />
                  </div>
                  <div>
                    <strong>{p.name}</strong>
                    <span>
                      {p.floor.walls.length} walls ·{" "}
                      {new Date(p.modifiedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
              ))
            ) : (
              <p className="field-hint">No saved projects yet.</p>
            )}
          </div>
          <input
            ref={upload}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 5_000_000)
                  throw new Error("Choose a JSON file smaller than 5 MB.");
                if (!s.replace(importProject(await file.text()))) {
                  setError(useEditor.getState().notice);
                  return;
                }
                close();
              } catch (err) {
                setError((err as Error).message);
                e.target.value = "";
              }
            }}
          />
          <button
            className="secondary full"
            onClick={() => upload.current?.click()}
          >
            <FileJson size={17} /> Import project JSON
          </button>
        </>
      )}
      {kind === "settings" && (
        <>
          <p className="modal-intro">
            Tune your drafting workspace. Model coordinates are stored to 1/64
            inch; these settings control drawing assistance.
          </p>
          <label className="field">
            <span>Snap grid spacing</span>
            <select
              value={s.grid}
              onChange={(e) => s.set({ grid: Number(e.target.value) })}
            >
              {[1, 3, 6, 12, 24].map((n) => (
                <option key={n} value={inches(n)}>
                  {n} inches
                </option>
              ))}
            </select>
          </label>
          {[
            ["showGrid", "Show drawing grid"],
            ["snap", "Snap to grid and endpoints"],
            ["ortho", "Draw orthogonal walls"],
            ["dimensions", "Show wall dimensions"],
          ].map(([key, label]) => (
            <label className="toggle-row" key={key}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={s[key as "showGrid" | "snap" | "ortho" | "dimensions"]}
                onChange={(e) => s.set({ [key]: e.target.checked })}
              />
            </label>
          ))}
          <p className="field-hint">
            The visible grid simplifies as you zoom out; snap spacing stays
            exact.
          </p>
        </>
      )}
      {kind === "help" && (
        <>
          <p className="modal-intro">
            Precision tools for the first lines of a home.
          </p>
          <div className="shortcut-list">
            {[
              ["W", "Draw connected walls"],
              ["D / N", "Place door / window in a wall"],
              ["Type / L", "Enter a draft length immediately"],
              ["Tab", "Move from draft length to angle"],
              ["V", "Select and edit"],
              ["H", "Pan the plan"],
              ["M", "Measure two points"],
              ["Esc", "Finish or cancel drawing"],
              ["Ctrl / ⌘ Z", "Undo"],
              ["Ctrl / ⌘ Shift Z", "Redo"],
              ["Ctrl / ⌘ S", "Save to this browser"],
              ["Delete", "Delete selected wall or opening"],
            ].map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <p className="field-hint">
            Click and drag to draw, or click and type a length. Click a wall
            dimension to edit it. Select a wall, then choose Specifications;
            double-click inside a closed room to name it. Body drags move walls
            parallel by default. Bare numbers mean inches; ft, in, mm, cm and m
            suffixes are accepted.
          </p>
          <div className="help-note">
            <strong>Architectural workspace · 0.5</strong>
            <p>
              One floor, straight walls, two-wall corner joins, and synchronized
              3D with door and window apertures. Click Door or Window, then a
              wall; select the symbol to edit its size, sill and offset. Roofs,
              cloud sync, and AI assistance are future milestones. Drawings are
              preliminary and have no code or structural certification.
            </p>
          </div>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
export default function App() {
  const s = useEditor(),
    [dialog, setDialog] = useState<Dialog>(null),
    ws = useWorkspace(),
    showProperties = ws.showInspector;
  const setShowProperties = (value: boolean) =>
    ws.set({ showInspector: value });
  useEffect(() => {
    useEditor.getState().save();
  }, []);
  useEffect(() => {
    if (!s.saveError) return;
    const preventLoss = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [s.saveError]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const editing = (e.target as HTMLElement).matches(
        "input,textarea,select",
      );
      if (dialog || editing || useEditor.getState().specification) return;
      const st = useEditor.getState(),
        mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        st.save();
        return;
      }
      if (mod) return;
      const tool: Record<string, Tool> = {
        v: "select",
        w: "wall",
        d: "door",
        n: "window",
        h: "pan",
        m: "measure",
      };
      if (tool[e.key.toLowerCase()])
        st.set({ tool: tool[e.key.toLowerCase()], view: "plan" });
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        st.remove();
      }
      if (e.key === "Escape") st.set({ selected: null });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [dialog]);
  function exportJSON() {
    const data = serialize(s.project),
      url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${s.project.name.replace(/[^a-z0-9-]/gi, "-")}.studline.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    s.set({ notice: "Project JSON exported. Keep this file as a backup." });
  }
  return (
    <div className={`app-shell ${showProperties ? "" : "hide-properties"}`}>
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="Studline home"
        >
          <img src="/mark.svg" alt="" />
          <span>
            studline<span className="brand-period">.</span>
          </span>
        </a>
        <div className="project-title">
          <span className="project-label">RESIDENTIAL STUDIO</span>
          <strong>{s.project.name}</strong>
        </div>
        <span className={`save-status ${s.saveError ? "warning" : ""}`}>
          <span className="tiny-dot" />
          {s.saveError ? "Save needs attention" : "Saved in browser"}
        </span>
        <div className="header-actions">
          <button onClick={() => setDialog("new")}>
            <Plus size={15} />
            <span>New</span>
          </button>
          <button onClick={() => setDialog("open")}>
            <FolderOpen size={15} />
            <span>Open</span>
          </button>
          <button className="save-button" onClick={s.save}>
            <Save size={15} />
            <span>Save project</span>
          </button>
          <IconButton label="Export project JSON" onClick={exportJSON}>
            <Download size={16} />
          </IconButton>
        </div>
      </header>
      <CadMenus
        onDialog={setDialog}
        onExport={exportJSON}
        onProperties={() => setShowProperties(!showProperties)}
      />
      <ArchitecturalTools onRoom={() => setDialog("room")} />
      <div className="workspace-toolbar">
        <div className="history-tools">
          <IconButton
            label="Undo"
            onClick={s.undo}
            disabled={!s.history.past.length}
          >
            <Undo2 size={17} />
          </IconButton>
          <IconButton
            label="Redo"
            onClick={s.redo}
            disabled={!s.history.future.length}
          >
            <Redo2 size={17} />
          </IconButton>
        </div>
        <div className="toolbar-separator" />
        <div className="floor-indicator">
          <Layers size={15} />
          <span>Ground floor</span>
          <small>01</small>
        </div>
        <div className="view-switch">
          <button
            className={s.view === "plan" ? "active" : ""}
            onClick={() => s.set({ view: "plan" })}
          >
            <Grid2X2 size={14} /> 2D plan
          </button>
          <button
            className={s.view === "model" ? "active" : ""}
            onClick={() => s.set({ view: "model" })}
          >
            <Box size={15} /> 3D model
          </button>
        </div>
        <div className="drawing-controls">
          <button
            className={s.ortho ? "active" : ""}
            aria-pressed={s.ortho}
            title="Keep drawn walls orthogonal"
            onClick={() => s.set({ ortho: !s.ortho })}
          >
            <CornerDownRight size={15} />
            <span>Ortho</span>
          </button>
          <button
            className={s.showGrid ? "active" : ""}
            title="Show or hide the 2D drawing grid"
            aria-pressed={s.showGrid}
            onClick={() =>
              s.set({
                showGrid: !s.showGrid,
                view: "plan",
                notice: s.showGrid
                  ? "Drawing grid hidden."
                  : "Drawing grid visible.",
              })
            }
          >
            <Grid2X2 size={15} />
            <span>Grid</span>
          </button>
          <button
            className={s.snap ? "active" : ""}
            title="Toggle snapping"
            aria-pressed={s.snap}
            onClick={() => s.set({ snap: !s.snap })}
          >
            <Magnet size={15} />
            <span>Snap</span>
          </button>
          <select
            aria-label="Grid spacing"
            value={s.grid}
            onChange={(e) => s.set({ grid: Number(e.target.value) })}
          >
            {[1, 3, 6, 12, 24].map((n) => (
              <option key={n} value={inches(n)}>
                {n}″
              </option>
            ))}
          </select>
          <IconButton
            label="Drawing preferences"
            onClick={() => setDialog("settings")}
          >
            <Settings2 size={16} />
          </IconButton>
          <IconButton
            label="Toggle properties panel"
            active={showProperties}
            onClick={() => setShowProperties(!showProperties)}
          >
            <PanelTop size={16} />
          </IconButton>
        </div>
      </div>
      <div className="work-area">
        {ws.showBrowser && (
          <>
            <ProjectBrowser onOpen={() => setDialog("open")} />
            <ResizeHandle side="left" />
          </>
        )}
        <main className="drawing-area cad-drawing-area">
          <ViewTabs />
          <ContextToolbar />
          <div className={`view-panes ${ws.split ? "split" : ""}`}>
            {(s.view === "plan" || ws.split) && (
              <div className="view-pane">
                <PlanCanvas />
              </div>
            )}
            {(s.view !== "plan" || ws.split) && (
              <div className="view-pane">
                <Suspense
                  fallback={
                    <div className="scene-error">Preparing 3D model…</div>
                  }
                >
                  <ModelView orthographic={s.view === "overview"} />
                </Suspense>
              </div>
            )}
          </div>
        </main>
        {showProperties && (
          <>
            <ResizeHandle side="right" />
            <div className="inspector-dock" style={{ width: ws.rightWidth }}>
              <Properties />
              <LayerPanel />
            </div>
          </>
        )}
      </div>
      {s.saveError && (
        <div className="storage-warning" role="alert">
          {s.saveError}
          <button onClick={exportJSON}>Export JSON now</button>
        </div>
      )}
      <footer className="status-bar">
        <div>
          <span className="status-indicator" />
          {s.view !== "plan"
            ? "3D orbit"
            : s.tool === "select"
              ? "Select tool"
              : s.tool === "wall"
                ? "Wall tool"
                : s.tool === "door" || s.tool === "window"
                  ? `${s.tool === "door" ? "Door" : "Window"} tool`
                  : s.tool === "pan"
                    ? "Pan tool"
                    : "Measure tool"}
          <span className="status-notice" role="status">
            {s.notice}
          </span>
        </div>
        <div>
          <span className="coordinates">
            X {formatImperial(s.cursor.x)}
            <i />Y {formatImperial(s.cursor.y)}
          </span>
          <span className="status-divider" />
          <span>Feet & inches</span>
          <span className={`snap-status ${s.snap ? "on" : ""}`}>
            {s.snap ? <Check size={12} /> : null}{" "}
            {s.snap ? "Snap on" : "Snap off"}
          </span>
        </div>
      </footer>
      <SpecificationDialogs />
      {dialog && (
        <ProjectDialog
          key={dialog}
          kind={dialog}
          close={() => setDialog(null)}
        />
      )}
    </div>
  );
}
