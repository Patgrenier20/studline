import { useState, type PointerEvent } from "react";
import {
  MousePointer2,
  PanelTop,
  DoorOpen,
  LayoutTemplate,
  Square,
  Ruler,
  Pencil,
  Footprints,
  Building2,
  Home,
  Archive,
  Camera,
  ChevronDown,
  Move,
  RotateCw,
  ArrowLeftRight,
  Settings2,
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Layers,
  Plus,
  Columns2,
  Maximize2,
} from "lucide-react";
import { useEditor, type Tool } from "../state/store";
import {
  useWorkspace,
  layerFor,
  type LayerKey,
  type WorkspaceView,
} from "../state/workspace";
import { detectRooms } from "../core/rooms";
import { length, wallPoints } from "../core/model";
import {
  referenceSegment,
  resizeReference,
  rotateWall,
  reverseWall,
  moveWall,
} from "../core/wallEditing";
import { formatImperial, parseImperial } from "../core/units";
import { DimensionField } from "./Properties";
import { updateOpening } from "../core/openings";
import { Modal } from "./Modal";
export function ResizeHandle({ side }: { side: "left" | "right" }) {
  const w = useWorkspace();
  function down(e: PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  return (
    <div
      className="panel-resizer"
      role="separator"
      aria-label={`Resize ${side} panel`}
      aria-orientation="vertical"
      tabIndex={0}
      onPointerDown={down}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          w.set(
            side === "left"
              ? { leftWidth: Math.max(190, Math.min(340, e.clientX)) }
              : {
                  rightWidth: Math.max(
                    230,
                    Math.min(400, window.innerWidth - e.clientX),
                  ),
                },
          );
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          const d = e.key === "ArrowRight" ? 10 : -10;
          w.set(
            side === "left"
              ? { leftWidth: Math.max(190, Math.min(340, w.leftWidth + d)) }
              : { rightWidth: Math.max(230, Math.min(400, w.rightWidth - d)) },
          );
        }
      }}
    />
  );
}
export function ArchitecturalTools({ onRoom }: { onRoom: () => void }) {
  const s = useEditor();
  const [open, setOpen] = useState<string | null>(null);
  const tool = (t: Tool) => {
    s.set({ tool: t, view: "plan" });
    setOpen(null);
  };
  const groups = [
    {
      name: "Walls",
      icon: PanelTop,
      items: [
        ["Straight wall", () => tool("wall")],
        ["Curved wall · planned", null],
        ["Railing · planned", null],
      ],
    },
    {
      name: "Doors",
      icon: DoorOpen,
      items: [
        ["Hinged door", () => tool("door")],
        ["Sliding door · planned", null],
      ],
    },
    {
      name: "Windows",
      icon: LayoutTemplate,
      items: [
        ["Window opening", () => tool("window")],
        ["Bay window · planned", null],
      ],
    },
    {
      name: "Rooms",
      icon: Square,
      items: [
        ["Rectangular room…", onRoom],
        [
          "Room specifications",
          () =>
            s.set({
              notice:
                "Double-click inside an enclosed room to edit its specifications.",
              view: "plan",
              tool: "select",
            }),
        ],
      ],
    },
    {
      name: "Dimensions",
      icon: Ruler,
      items: [
        ["Point-to-point measure", () => tool("measure")],
        ["Toggle wall dimensions", () => s.set({ dimensions: !s.dimensions })],
        ["Dimension chains · planned", null],
      ],
    },
    {
      name: "CAD drawing",
      icon: Pencil,
      items: [
        ["Measure distance", () => tool("measure")],
        ["CAD lines / polylines · planned", null],
      ],
    },
    ...[
      { name: "Stairs", icon: Footprints },
      { name: "Foundations", icon: Building2 },
      { name: "Roofs", icon: Home },
      { name: "Cabinets", icon: Archive },
    ].map((g) => ({ ...g, items: [["Not implemented yet", null]] })),
    {
      name: "Cameras & 3D",
      icon: Camera,
      items: [
        ["Perspective", () => s.set({ view: "model" })],
        ["Orthographic overview", () => s.set({ view: "overview" })],
        ["Elevations / sections · planned", null],
      ],
    },
  ];
  return (
    <div className="architecture-ribbon" aria-label="Architectural tool groups">
      <button
        className={`ribbon-select ${s.tool === "select" ? "active" : ""}`}
        onClick={() => tool("select")}
      >
        <MousePointer2 size={21} />
        <span>Select</span>
        <kbd>V</kbd>
      </button>
      {groups.map((g) => (
        <div className="ribbon-group" key={g.name}>
          <button
            className={
              (
                {
                  wall: "Walls",
                  door: "Doors",
                  window: "Windows",
                  measure: "Dimensions",
                } as Record<string, string>
              )[s.tool] === g.name
                ? "active"
                : ""
            }
            aria-expanded={open === g.name}
            onClick={() => setOpen(open === g.name ? null : g.name)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(null);
            }}
          >
            <g.icon size={21} />
            <span>{g.name}</span>
            <ChevronDown size={11} />
          </button>
          {open === g.name && (
            <>
              <button
                className="ribbon-dismiss"
                aria-label="Close tool group"
                onClick={() => setOpen(null)}
              />
              <div className="ribbon-popup">
                {g.items.map(([label, action]) => (
                  <button
                    key={String(label)}
                    disabled={!action}
                    onClick={() => {
                      (action as () => void)();
                      setOpen(null);
                    }}
                  >
                    {String(label)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
export function ProjectBrowser({ onOpen }: { onOpen: () => void }) {
  const s = useEditor(),
    w = useWorkspace();
  const [filter, setFilter] = useState("");
  const rooms = detectRooms(s.project);
  const select = (id: string, kind: string) => {
    const k = layerFor(kind);
    w.set({ layers: { ...w.layers, [k]: { ...w.layers[k], visible: true } } });
    s.set({
      selected: id,
      tool: "select",
      view: "plan",
      notice: "Selected in Project Browser. Use Zoom to selection to locate.",
    });
  };
  return (
    <aside className="project-browser" style={{ width: w.leftWidth }}>
      <div className="dock-heading">
        <span>Project Browser</span>
        <button aria-label="Open projects" onClick={onOpen}>
          <Archive size={14} />
        </button>
      </div>
      <input
        className="browser-search"
        placeholder="Find an object…"
        aria-label="Find project object"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="browser-tree">
        <div className="project-root">
          <Building2 size={15} />
          <strong>{s.project.name}</strong>
        </div>
        <details open>
          <summary>
            <Layers size={14} /> Floor levels
          </summary>
          <div className="floor-row">
            01 <strong>{s.project.floor.name}</strong>
          </div>
          <details open>
            <summary>
              Walls <small>{s.project.floor.walls.length}</small>
            </summary>
            {s.project.floor.walls
              .map((wall, i) => ({
                wall,
                label: `Wall ${String(i + 1).padStart(2, "0")}`,
              }))
              .filter((x) =>
                x.label.toLowerCase().includes(filter.toLowerCase()),
              )
              .map(({ wall, label }) => (
                <button
                  className={s.selected === wall.id ? "selected" : ""}
                  key={wall.id}
                  onClick={() => select(wall.id, "wall")}
                >
                  <PanelTop size={13} />
                  {label}
                  <small>
                    {formatImperial(length(...wallPoints(s.project, wall)))}
                  </small>
                </button>
              ))}
          </details>
          <details open>
            <summary>
              Doors & windows <small>{s.project.floor.openings.length}</small>
            </summary>
            {s.project.floor.openings
              .map((o, i) => ({
                o,
                label: `${o.kind === "door" ? "Door" : "Window"} ${i + 1}`,
              }))
              .filter((x) =>
                x.label.toLowerCase().includes(filter.toLowerCase()),
              )
              .map(({ o, label }) => (
                <button
                  key={o.id}
                  className={s.selected === o.id ? "selected" : ""}
                  onClick={() => select(o.id, o.kind)}
                >
                  <DoorOpen size={13} />
                  {label}
                </button>
              ))}
            {!s.project.floor.openings.length && <p>No openings placed</p>}
          </details>
          <details open>
            <summary>
              Rooms <small>{rooms.length}</small>
            </summary>
            {rooms.map((r, i) => (
              <button
                key={r.key}
                onClick={() =>
                  s.set({
                    specification: { kind: "room", key: r.key },
                    selected: null,
                    view: "plan",
                  })
                }
              >
                <Square size={13} />
                {r.settings?.name || `Room ${i + 1}`}
              </button>
            ))}
          </details>
        </details>
        <details open>
          <summary>Saved plan views</summary>
          <button onClick={() => s.set({ view: "plan" })}>
            <LayoutTemplate size={13} />
            Ground floor plan
          </button>
          {w.savedViews
            .filter(
              (v: { projectId: string; view: string }) =>
                v.projectId === s.project.id && v.view === "plan",
            )
            .map(
              (
                v: {
                  name: string;
                  view: WorkspaceView;
                  layers: typeof w.layers;
                },
                i: number,
              ) => (
                <button
                  key={i}
                  onClick={() => {
                    s.set({ view: v.view });
                    w.set({ layers: v.layers });
                  }}
                >
                  {v.name}
                </button>
              ),
            )}
        </details>
        <details open>
          <summary>Camera views</summary>
          <button onClick={() => s.set({ view: "model" })}>
            <Camera size={13} />
            Perspective
          </button>
          <button onClick={() => s.set({ view: "overview" })}>
            <Building2 size={13} />
            Orthographic overview
          </button>
        </details>
        <details>
          <summary>Elevations & sections</summary>
          <p>Planned · not implemented</p>
        </details>
      </div>
      <div className="browser-footer">
        STUDLINE STUDIO <span>0.5</span>
      </div>
    </aside>
  );
}
export function LayerPanel() {
  const w = useWorkspace();
  return (
    <section className="layer-panel">
      <div className="dock-heading">
        Layers <span>Visible / Lock</span>
      </div>
      {(["walls", "doors", "windows", "rooms", "dimensions"] as LayerKey[]).map(
        (k) => (
          <div className="layer-row" key={k}>
            <span className={`layer-swatch ${k}`} />
            <span>{k[0].toUpperCase() + k.slice(1)}</span>
            <button
              aria-label={`${w.layers[k].visible ? "Hide" : "Show"} ${k} layer`}
              aria-pressed={w.layers[k].visible}
              onClick={() =>
                w.set({
                  layers: {
                    ...w.layers,
                    [k]: { ...w.layers[k], visible: !w.layers[k].visible },
                  },
                })
              }
            >
              {w.layers[k].visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button
              disabled={k === "dimensions"}
              aria-label={`${w.layers[k].locked ? "Unlock" : "Lock"} ${k} layer`}
              aria-pressed={w.layers[k].locked}
              onClick={() =>
                w.set({
                  layers: {
                    ...w.layers,
                    [k]: { ...w.layers[k], locked: !w.layers[k].locked },
                  },
                })
              }
            >
              {w.layers[k].locked ? <Lock size={13} /> : <Unlock size={13} />}
            </button>
          </div>
        ),
      )}
      <p>Locks protect edits. Doors/windows visibility affects plan symbols; 3D apertures remain.</p>
    </section>
  );
}
export function ViewTabs() {
  const s = useEditor(),
    w = useWorkspace();
  return (
    <div className="view-tabs" role="tablist" aria-label="Drawing views">
      {(
        [
          ["plan", "Floor plan"],
          ["model", "3D perspective"],
          ["overview", "Orthographic"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          role="tab"
          aria-selected={s.view === id}
          className={s.view === id ? "active" : ""}
          onClick={() => s.set({ view: id })}
        >
          {id === "plan" ? <LayoutTemplate size={14} /> : <Camera size={14} />}{" "}
          {label}
        </button>
      ))}
      <button disabled title="Elevations and sections are not implemented">
        Elevation · planned
      </button>
      <div className="view-tab-actions">
        <button
          title="Save plan layer preset"
          aria-label="Save plan view"
          disabled={s.view !== "plan"}
          onClick={() => {
            w.set({
              savedViews: [
                ...w.savedViews,
                {
                  name: `Plan preset ${w.savedViews.length + 1}`,
                  projectId: s.project.id,
                  view: s.view,
                  layers: structuredClone(w.layers),
                },
              ],
            });
            s.set({ notice: "Plan layer preset saved in this browser." });
          }}
        >
          <Plus size={15} />
        </button>
        <button
          aria-label="Toggle split views"
          aria-pressed={w.split}
          className={w.split ? "active" : ""}
          onClick={() => w.set({ split: !w.split })}
        >
          <Columns2 size={16} />
        </button>
        <button
          aria-label="Fit all views"
          onClick={() => s.set({ fitToken: s.fitToken + 1 })}
        >
          <Maximize2 size={15} />
        </button>
      </div>
    </div>
  );
}
export function ContextToolbar() {
  const s = useEditor(),
    ws = useWorkspace();
  const wall = s.project.floor.walls.find((w) => w.id === s.selected),
    opening = s.project.floor.openings.find((o) => o.id === s.selected);
  const [mode, setMode] = useState<"move" | "rotate" | null>(null),
    [x, setX] = useState("0"),
    [y, setY] = useState("0"),
    [error, setError] = useState("");
  const apply = (fn: () => typeof s.project, label: string) => {
    try {
      if (!s.commit(fn(), label)) throw new Error(useEditor.getState().notice);
    } catch (e) {
      s.set({ notice: (e as Error).message });
    }
  };
  return (
    <div className="context-toolbar">
      <span className="context-tag">
        {wall ? "WALL" : opening ? opening.kind.toUpperCase() : "SELECT"}
      </span>
      {wall ? (
        <>
          <button
            onClick={() => {
              setMode("move");
              setError("");
            }}
          >
            <Move size={14} />
            Move
          </button>
          <DimensionField
            label="Length"
            value={length(...referenceSegment(s.project, wall, ws.reference))}
            onChange={(n) => {
              if (
                !s.commit(
                  resizeReference(
                    s.project,
                    wall.id,
                    n,
                    ws.reference,
                    s.editAnchor,
                    s.constrainEdits,
                  ),
                  "Resize wall",
                )
              )
                throw new Error(useEditor.getState().notice);
            }}
          />
          <button
            onClick={() => {
              setMode("rotate");
              setError("");
            }}
          >
            <RotateCw size={14} />
            Rotate
          </button>
          <button
            onClick={() =>
              apply(
                () => reverseWall(s.project, wall.id),
                "Reverse wall orientation",
              )
            }
          >
            <ArrowLeftRight size={14} />
            Reverse
          </button>
          <select
            aria-label="Dimension reference"
            value={ws.reference}
            onChange={(e) =>
              ws.set({ reference: e.target.value as typeof ws.reference })
            }
          >
            <option value="centerline">Centerline</option>
            <option value="exterior">Exterior face</option>
            <option value="interior">Interior face</option>
          </select>
          <button
            onClick={() =>
              s.set({ specification: { kind: "wall", id: wall.id } })
            }
          >
            <Settings2 size={14} />
            Specifications
          </button>
        </>
      ) : opening ? (
        <>
          <DimensionField
            label="Width"
            value={opening.width}
            onChange={(n) =>
              apply(
                () => updateOpening(s.project, opening.id, { width: n }),
                "Resize opening",
              )
            }
          />
          <DimensionField
            label="Offset"
            value={opening.offset}
            onChange={(n) =>
              apply(
                () => updateOpening(s.project, opening.id, { offset: n }),
                "Move opening",
              )
            }
          />
          {opening.kind === "door" && (
            <button
              onClick={() =>
                apply(
                  () =>
                    updateOpening(s.project, opening.id, {
                      swing: opening.swing === 1 ? -1 : 1,
                    }),
                  "Flip door swing",
                )
              }
            >
              <ArrowLeftRight size={14} />
              Flip swing
            </button>
          )}
        </>
      ) : (
        <span className="context-hint">
          Select an object in the plan or Project Browser to edit it.{" "}
          <kbd>V</kbd> Select · <kbd>W</kbd> Wall · <kbd>M</kbd> Measure
        </span>
      )}
      {(wall || opening) && (
        <button className="context-delete" onClick={s.remove}>
          <Trash2 size={14} />
          Delete
        </button>
      )}
      {mode && wall && (
        <Modal
          title={
            mode === "move" ? "Move selected wall" : "Rotate selected wall"
          }
          onClose={() => setMode(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const p =
                  mode === "move"
                    ? moveWall(
                        s.project,
                        wall.id,
                        { x: parseImperial(x), y: parseImperial(y) },
                        false,
                        s.constrainEdits,
                      )
                    : rotateWall(s.project, wall.id, Number(x));
                if (!s.commit(p, mode === "move" ? "Move wall" : "Rotate wall"))
                  throw new Error(useEditor.getState().notice);
                setMode(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <p className="modal-intro">
              {mode === "move"
                ? "Translate by exact X and Y offsets. Connected junctions follow the wall."
                : "Absolute heading in degrees, rotating about endpoint A. Connected walls reshape."}
            </p>
            <label className="field">
              {mode === "move" ? "X offset" : "Heading °"}
              <input
                aria-label={mode === "move" ? "X offset" : "Rotation heading"}
                value={x}
                onChange={(e) => setX(e.target.value)}
              />
            </label>
            {mode === "move" && (
              <label className="field">
                Y offset
                <input
                  aria-label="Y offset"
                  value={y}
                  onChange={(e) => setY(e.target.value)}
                />
              </label>
            )}
            {error && <p role="alert">{error}</p>}
            <button className="primary" type="submit">
              Apply {mode}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
