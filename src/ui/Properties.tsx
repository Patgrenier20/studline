import { useEffect, useState } from "react";
import {
  Ruler,
  Move,
  Layers,
  Trash2,
  SlidersHorizontal,
  ArrowUpRight,
} from "lucide-react";
import { useEditor } from "../state/store";
import {
  length,
  resizeWall,
  updateWall,
  wallPoints,
} from "../core/model";
import { formatImperial, parseImperial, FT } from "../core/units";
import { enclosedArea, interiorArea } from "../core/geometry";
import { changeThickness, constrainedNodes, referenceSegment, resizeReference } from "../core/wallEditing";
import { openingRange, updateOpening } from "../core/openings";
import { openEndpoints } from "../core/drafting";
export function DimensionField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(formatImperial(value)),
    [error, setError] = useState("");
  useEffect(() => {
    setText(formatImperial(value));
    setError("");
  }, [value]);
  function submit() {
    try {
      const n = parseImperial(text);
      if (n !== Math.round(value)) onChange(n);
      setText(formatImperial(n));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <label className={`field ${error ? "invalid" : ""}`}>
      <span>{label}</span>
      <input
        aria-label={label}
        aria-invalid={!!error}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === "Escape") {
            setText(formatImperial(value));
            setError("");
          }
        }}
      />
      {error && <small role="alert">{error}</small>}
    </label>
  );
}
export function Properties() {
  const s = useEditor(),
    wall = s.project.floor.walls.find((w) => w.id === s.selected),
    opening = s.project.floor.openings.find((o) => o.id === s.selected),
    area = enclosedArea(s.project),
    perimeter =
      s.project.floor.walls.reduce(
        (sum, w) => sum + length(...wallPoints(s.project, w)),
        0,
      ) / FT;
  const [rename, setRename] = useState(s.project.name);
  useEffect(() => setRename(s.project.name), [s.project.name]);
  const [a, b] = wall ? wallPoints(s.project, wall) : [null, null];
  const host = opening ? s.project.floor.walls.find(w => w.id === opening.wallId)! : null;
  const range = host ? openingRange(s.project, host) : null;
  const edit = (label: string, fn: () => ReturnType<typeof resizeWall>) => {
    const p = fn();
    if(!s.commit(p, label)) throw new Error(useEditor.getState().notice);
  };
  return (
    <aside className="properties">
      <div className="panel-heading">
        <span>Properties</span>
        <SlidersHorizontal size={15} />
      </div>
      <div className="selection-heading">
        <div className="selection-icon">
          {wall ? <Layers size={21} /> : <Ruler size={21} />}
        </div>
        <div>
          <h3>
            {opening ? `${opening.kind === "door" ? "Door" : "Window"} opening` : wall
              ? `Wall ${String(s.project.floor.walls.indexOf(wall) + 1).padStart(2, "0")}`
              : "Project overview"}
          </h3>
          <p>{opening ? "WALL-HOSTED OPENING" : wall ? "PARAMETRIC WALL" : "RESIDENTIAL DESIGN"}</p>
        </div>
        {wall && <span className="selected-dot" />}
      </div>
      {opening && host && range ? <>
        <section>
          <h4><Ruler size={14} /> Opening dimensions</h4>
          <DimensionField label="Opening width" value={opening.width} onChange={n => edit("Resize opening width", () => updateOpening(s.project, opening.id, { width: n }))} />
          <DimensionField label="Opening height" value={opening.height} onChange={n => edit("Resize opening height", () => updateOpening(s.project, opening.id, { height: n }))} />
          {opening.kind === "window" && <DimensionField label="Sill above floor" value={opening.sill} onChange={n => edit("Change window sill", () => updateOpening(s.project, opening.id, { sill: n }))} />}
          <div className="property-line"><span>Opening top</span><strong>{formatImperial(opening.sill + opening.height)}</strong></div>
          <p className="field-hint">Dimensions describe the wall aperture. Frames, glazing, casing and structural headers are not modeled.</p>
        </section>
        <section>
          <h4><Move size={14} /> Placement</h4>
          <DimensionField label="Offset from wall A" value={opening.offset} onChange={n => edit("Move opening", () => updateOpening(s.project, opening.id, { offset: n }))} />
          <p className="field-hint">Measured along the wall from endpoint A to the near jamb. Drag the symbol along its wall to reposition. Valid jamb range: {formatImperial(range.min)}–{formatImperial(range.max)}.</p>
          <button className="secondary full" onClick={() => s.set({ selected: host.id })}>Select host wall {s.project.floor.walls.indexOf(host) + 1}</button>
        </section>
        {opening.kind === "door" && <section>
          <h4>Door swing in plan</h4>
          <label className="field"><span>Hinge jamb</span><select aria-label="Door hinge" value={opening.hinge} onChange={e => s.commit(updateOpening(s.project, opening.id, { hinge: e.target.value as "start" | "end" }), "Change door hinge")}>
            <option value="start">Near wall A</option><option value="end">Far from wall A</option>
          </select></label>
          <button className="secondary full" onClick={() => s.commit(updateOpening(s.project, opening.id, { swing: opening.swing === 1 ? -1 : 1 }), "Flip door swing")}>Flip swing side</button>
          <p className="field-hint">Swing is a plan symbol; the 3D model shows the open aperture.</p>
        </section>}
        <button className="delete-button" onClick={s.remove}><Trash2 size={15} /> Delete {opening.kind} <kbd>Del</kbd></button>
      </> : wall && a && b ? (
        <>
          <section>
            <h4>
              <Ruler size={14} /> Dimensions
            </h4>
            <DimensionField
              label="Length · A → B"
              value={length(...referenceSegment(s.project,wall,"centerline"))}
              onChange={(n) =>
                edit("Resize wall", () => resizeReference(s.project, wall.id, n, "centerline", s.editAnchor, s.constrainEdits))
              }
            />
            <div className="field-row">
              <DimensionField
                label="Height"
                value={wall.height}
                onChange={(n) =>
                  edit("Change wall height", () =>
                    updateWall(s.project, wall.id, { height: n }),
                  )
                }
              />
              <DimensionField
                label="Thickness"
                value={wall.thickness}
                onChange={(n) =>
                  edit("Change wall thickness", () =>
                    changeThickness(s.project, wall.id, n, "centerline", s.constrainEdits),
                  )
                }
              />
            </div>
            <p className="field-hint">
              Use Wall Specification to choose the fixed endpoint and edit surface materials.
            </p>
          </section>
          <section>
            <h4>
              <Move size={14} /> Position
            </h4>
            <div className="field-row">
              <DimensionField
                label="Start A · X"
                value={a.x}
                onChange={(n) =>
                  edit("Move start junction", () =>
                    constrainedNodes(s.project, { [a.id]: { ...a, x: n } }, s.constrainEdits),
                  )
                }
              />
              <DimensionField
                label="Start A · Y"
                value={a.y}
                onChange={(n) =>
                  edit("Move start junction", () =>
                    constrainedNodes(s.project, { [a.id]: { ...a, y: n } }, s.constrainEdits),
                  )
                }
              />
            </div>
            <div className="field-row">
              <DimensionField
                label="End B · X"
                value={b.x}
                onChange={(n) =>
                  edit("Move end junction", () =>
                    constrainedNodes(s.project, { [b.id]: { ...b, x: n } }, s.constrainEdits),
                  )
                }
              />
              <DimensionField
                label="End B · Y"
                value={b.y}
                onChange={(n) =>
                  edit("Move end junction", () =>
                    constrainedNodes(s.project, { [b.id]: { ...b, y: n } }, s.constrainEdits),
                  )
                }
              />
            </div>
            <div className="property-line">
              <span>Angle in plan</span>
              <strong>
                {(
                  ((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 360) %
                  360
                ).toFixed(1)}
                °
              </strong>
            </div>
          </section>
          <section>
            <h4>
              <Layers size={14} /> Appearance
            </h4>
            <button className="secondary full" onClick={()=>s.set({specification:{kind:"wall",id:wall.id}})}>Wall Specification…</button>
            <p className="field-hint">General settings, dimensions, interior and exterior surface materials.</p>
          </section>
          <button className="delete-button" onClick={s.remove}>
            <Trash2 size={15} /> Delete wall <kbd>Del</kbd>
          </button>
        </>
      ) : (
        <>
          <section>
            <h4>Project information</h4>
            <label className="field">
              <span>Project name</span>
              <input
                aria-label="Project name"
                value={rename}
                maxLength={120}
                onChange={(e) => setRename(e.target.value)}
                onBlur={() => {
                  if (rename.trim() && rename !== s.project.name)
                    s.commit(
                      { ...s.project, name: rename.trim() },
                      "Rename project",
                    );
                  else setRename(s.project.name);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </label>
            <div className="overview-stats">
              <div>
                <strong>{s.project.floor.walls.length}</strong>
                <span>Walls</span>
              </div>
              <div>
                <strong>
                  {Math.round(perimeter)}
                  <small> ft</small>
                </strong>
                <span>Total length</span>
              </div>
            </div>
            <div className="property-line"><span>Doors / windows</span><strong>{s.project.floor.openings.filter(o => o.kind === "door").length} / {s.project.floor.openings.filter(o => o.kind === "window").length}</strong></div>
            {area !== null && (
              <div className="area-card">
                <span>ENCLOSED AREA</span>
                <strong>
                  {area.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  <small> sq ft</small>
                </strong>
                <p>Measured to wall centerlines</p>
                {interiorArea(s.project)!==null&&<p>Interior faces: {interiorArea(s.project)!.toLocaleString(undefined,{maximumFractionDigits:2})} sq ft</p>}
              </div>
            )}
            {openEndpoints(s.project).length > 0 && <p className="outline-notice" role="status">Open outline · {openEndpoints(s.project).length} unconnected endpoints are marked amber. Connect matching endpoints to close a room.</p>}
          </section>
          <section>
            <h4>
              <Layers size={14} /> New wall defaults
            </h4>
            <div className="field-row">
              <DimensionField
                label="Default height"
                value={s.defaults.height}
                onChange={(n) => {
                  if (n < FT || n > 30 * FT) throw new Error("Use 1–30 feet.");
                  s.set({ defaults: { ...s.defaults, height: n } });
                }}
              />
              <DimensionField
                label="Default thickness"
                value={s.defaults.thickness}
                onChange={(n) => {
                  if (n < 16 || n > 3072) throw new Error("Use 1/4–48 inches.");
                  s.set({ defaults: { ...s.defaults, thickness: n } });
                }}
              />
            </div>
            <p className="field-hint">Applies to walls you draw next.</p>
          </section>
          <section className="how-to">
            <h4>
              Your first room <ArrowUpRight size={15} />
            </h4>
            <ol>
              <li>
                Press <kbd>W</kbd> and click four corners.
              </li>
              <li>Close the room at the first endpoint.</li>
              <li>Select a wall to enter exact dimensions.</li>
              <li>
                Switch to <strong>3D model</strong> to explore.
              </li>
            </ol>
          </section>
        </>
      )}
      <div className="panel-footer">
        <span className="tiny-dot" /> One model. Every view.
      </div>
    </aside>
  );
}
