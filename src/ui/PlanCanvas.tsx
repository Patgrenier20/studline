import { useWorkspace } from "../state/workspace";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useEditor } from "../state/store";
import {
  type Point,
  type Project,
  type Opening,
  length,
  wallPoints,
} from "../core/model";
import { bounds } from "../core/geometry";
import {
  addOpening,
  openingDefaults,
  wallPlanPolygons,
  wallStation,
  updateOpening,
} from "../core/openings";
import { detectRooms, pointInRoom } from "../core/rooms";
import {
  addReferencedWall,
  constrainedNodes,
  hitWallReference,
  moveWall,
  referenceSegment,
  resizeReference,
  rotateWall,
  wallDirection,
} from "../core/wallEditing";
import { OpeningSymbol } from "./OpeningSymbol";
import { FT, formatImperial, parseImperial } from "../core/units";
import {
  draftPoint,
  openEndpoints,
  snapWallJoin,
  pointAtHeading,
  wheelZoomFactor,
  zoomAt,
  type DraftSnap,
} from "../core/drafting";
import { Crosshair, Minus, Plus, Maximize, Compass } from "lucide-react";

interface Camera {
  x: number;
  y: number;
  scale: number;
}
type Drag =
  | { kind: "pan"; client: Point; camera: Camera }
  | {
      kind: "opening";
      client: Point;
      world: Point;
      project: Project;
      opening: Opening;
    }
  | {
      kind: "node" | "wall" | "length" | "rotate";
      wallId?: string;
      client: Point;
      world: Point;
      project: Project;
      ids: string[];
      anchor: Point;
    };
export function PlanCanvas() {
  const ws = useWorkspace();
  const s = useEditor(),
    host = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 900, h: 600 }),
    [cam, setCam] = useState<Camera>({ x: -4000, y: -4000, scale: 0.04 });
  const [start, setStart] = useState<Point | null>(null),
    [hover, setHover] = useState<Point | null>(null),
    [preview, setPreview] = useState<Project | null>(null),
    [measure, setMeasure] = useState<[Point, Point] | null>(null);
  const [candidate, setCandidate] = useState<{
    opening: Opening;
    error: string;
  } | null>(null);
  const [draftLength, setDraftLength] = useState(""),
    [draftAngle, setDraftAngle] = useState("0"),
    [draftError, setDraftError] = useState(""),
    [hoverSnap, setHoverSnap] = useState<DraftSnap | null>(null);
  const drawDown = useRef<Point | null>(null),
    angleLocked = useRef(false);
  const lengthInput = useRef<HTMLInputElement>(null);
  const drag = useRef<Drag | null>(null),
    previewRef = useRef<Project | null>(null),
    moving = useRef(false),
    space = useRef(false);
  const project = preview || s.project;
  const draftReference = "centerline";
  const rooms = useMemo(() => detectRooms(project), [project]);
  useEffect(() => {
    setDraftLength("");
    setDraftError("");
    angleLocked.current = false;
  }, [start]);
  useEffect(() => {
    const el = svg.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      setCam((c) =>
        zoomAt(c, wheelZoomFactor(e.deltaY, e.deltaMode), {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        }),
      );
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const o = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    const b = bounds(useEditor.getState().project),
      padding = Math.min(110, size.w * 0.16, size.h * 0.18);
    const scale = Math.min(
      (size.w - padding * 2) / Math.max(b.maxX - b.minX, 8 * FT),
      (size.h - padding * 2) / Math.max(b.maxY - b.minY, 8 * FT),
      0.12,
    );
    const safe = Math.max(0.004, scale);
    setCam({
      x: (b.maxX + b.minX) / 2 - size.w / safe / 2,
      y: (b.maxY + b.minY) / 2 - size.h / safe / 2,
      scale: safe,
    });
  }, [size, s.fitToken]);
  useEffect(() => {
    setStart(null);
    setHover(null);
    setHoverSnap(null);
    setMeasure(null);
    setCandidate(null);
    setPreview(null);
    previewRef.current = null;
    drag.current = null;
    drawDown.current = null;
  }, [s.tool, s.view, s.project.id]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (useEditor.getState().specification) return;
      if (e.key === "Escape" && (start || drag.current)) {
        setStart(null);
        setMeasure(null);
        setPreview(null);
        previewRef.current = null;
        drag.current = null;
        drawDown.current = null;
        if ((e.target as HTMLElement).matches("input"))
          (e.target as HTMLElement).blur();
        return;
      }
      if ((e.target as HTMLElement).matches("input,select,textarea")) return;
      if (
        e.type === "keydown" &&
        start &&
        s.tool === "wall" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        /^[0-9.]$/.test(e.key)
      ) {
        e.preventDefault();
        setDraftLength(e.key);
        lengthInput.current?.focus();
        return;
      }
      if (
        e.type === "keydown" &&
        e.key === "Tab" &&
        start &&
        s.tool === "wall"
      ) {
        e.preventDefault();
        lengthInput.current?.focus();
        lengthInput.current?.select();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        space.current = e.type === "keydown";
      }
      if (
        e.type === "keydown" &&
        e.key.toLowerCase() === "l" &&
        start &&
        s.tool === "wall"
      ) {
        e.preventDefault();
        lengthInput.current?.focus();
        lengthInput.current?.select();
      }
      if (e.key === "Escape") {
        setStart(null);
        setMeasure(null);
        setPreview(null);
        previewRef.current = null;
        drag.current = null;
      }
    };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    const blur = () => {
      space.current = false;
    };
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("blur", blur);
    };
  }, [start, s.tool]);
  function raw(e: { clientX: number; clientY: number }): Point {
    const rect = svg.current!.getBoundingClientRect();
    return {
      x: cam.x + (e.clientX - rect.left) / cam.scale,
      y: cam.y + (e.clientY - rect.top) / cam.scale,
    };
  }
  function snapped(
    pt: Point,
    exclude: string[] = [],
    base: Point | null = start,
    shift = false,
  ) {
    const guideProject = s.project;
    if (s.tool === "measure" && s.snap) {
      const hit = hitWallReference(
        s.project,
        pt,
        12 / cam.scale,
        "centerline",
        false,
      );
      if (hit)
        return {
          point: hit.point,
          kind:
            hit.kind === "endpoint"
              ? ("endpoint" as const)
              : ("alignment" as const),
        };
    }
    const draft = draftPoint(
      pt,
      guideProject,
      s.grid,
      18 / cam.scale,
      s.snap,
      base,
      s.ortho || shift,
      exclude,
    );
    if (s.tool === "wall" && s.snap && draft.kind !== "endpoint") {
      const join = snapWallJoin(pt, guideProject, 12 / cam.scale, base, s.ortho || shift);
      if (join) return { point: join, kind: "endpoint" as const };
    }
    return draft;
  }
  function placeWall(end: Point) {
    if (!start) return;
    const next = addReferencedWall(
      s.project,
      start,
      end,
      draftReference,
      s.defaults,
    );
    if(!s.commit(next, "Draw wall")) throw new Error(useEditor.getState().notice);
    const committed = useEditor.getState().project;
    const drawn = next.floor.walls.at(-1)!;
    const endpoint = committed.floor.nodes.find(n => length(n, end) <= 1);
    const connects = endpoint !== undefined &&
      committed.floor.walls.filter(w => w.start === endpoint.id || w.end === endpoint.id).length > 1;
    s.set({
      selected: committed.floor.walls.some(w => w.id === drawn.id) ? drawn.id : null,
      notice: connects ? "Connected to existing wall." : "Draw wall",
    });
    setStart(connects ? null : end);
    setHover(end);
  }
  let draftEnd = hover;
  if (start && draftLength.trim()) {
    try {
      draftEnd = pointAtHeading(
        start,
        parseImperial(draftLength),
        Number(draftAngle),
      );
    } catch {
      /* Keep the last cursor preview while input is incomplete. */
    }
  }
  const draftOffset = { x: 0, y: 0 };
  function down(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.button !== 1) return;
    if (
      (s.tool === "wall" && ws.layers.walls.locked) ||
      (s.tool === "door" &&
        (ws.layers.walls.locked || ws.layers.doors.locked)) ||
      (s.tool === "window" &&
        (ws.layers.walls.locked || ws.layers.windows.locked))
    ) {
      s.set({ notice: "This drawing layer is locked. Unlock it in Layers." });
      return;
    }
    if (e.button === 1 || space.current || s.tool === "pan") {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = {
        kind: "pan",
        client: { x: e.clientX, y: e.clientY },
        camera: cam,
      };
      return;
    }
    const pt = raw(e),
      snap = snapped(pt, [], start, e.shiftKey);
    if (s.tool === "door" || s.tool === "window") {
      const placement = openingAt(e);
      if (!placement) {
        s.set({ notice: "Click an existing wall to place an opening." });
        return;
      }
      if (placement.error) {
        s.set({ notice: placement.error });
        return;
      }
      const next = addOpening(
        s.project,
        placement.opening.wallId,
        s.tool,
        placement.opening.offset,
      );
      if(!s.commit(next, `Add ${s.tool} opening`)) return;
      s.set({ selected: next.floor.openings.at(-1)!.id, tool: "select" });
      return;
    }
    if (s.tool === "wall" || s.tool === "measure") {
      if (!start) {
        setStart(snap.point);
        setMeasure(null);
        setHover(snap.point);
        if (s.tool === "wall") {
          drawDown.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        return;
      }
      if (s.tool === "wall" && length(start, pt) * cam.scale < 12) {
        drawDown.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      if (length(start, snap.point) < 64) {
        s.set({ notice: "Choose an endpoint at least one inch away." });
        return;
      }
      if (s.tool === "measure") {
        setMeasure([start, snap.point]);
        setStart(null);
        return;
      }
      try {
        placeWall(
          draftLength.trim()
            ? pointAtHeading(
                start,
                parseImperial(draftLength),
                Number(draftAngle),
              )
            : snap.point,
        );
      } catch (error) {
        s.set({ notice: (error as Error).message });
      }
      return;
    }
    const target = e.target as Element,
      nodeId = target.closest("[data-node]")?.getAttribute("data-node"),
      handle = target.closest("[data-handle]")?.getAttribute("data-handle"),
      hit = ws.layers.walls.visible
        ? hitWallReference(s.project, pt, 12 / cam.scale, "centerline", false)
        : null,
      wallId =
        target.closest("[data-wall]")?.getAttribute("data-wall") || hit?.wallId,
      openingId = target
        .closest("[data-opening]")
        ?.getAttribute("data-opening");
    if (
      openingId &&
      ws.layers[
        s.project.floor.openings.find((o) => o.id === openingId)?.kind ===
        "door"
          ? "doors"
          : "windows"
      ].locked
    ) {
      s.set({ selected: openingId, notice: "Opening layer is locked." });
      return;
    }
    if ((wallId || nodeId || handle) && ws.layers.walls.locked) {
      s.set({
        selected: wallId || s.selected,
        notice: "Walls layer is locked.",
      });
      return;
    }
    if (openingId) {
      s.set({ selected: openingId });
      drag.current = {
        kind: "opening",
        client: { x: e.clientX, y: e.clientY },
        world: pt,
        project: s.project,
        opening: s.project.floor.openings.find((o) => o.id === openingId)!,
      };
    } else if (handle && s.selected) {
      const w = s.project.floor.walls.find((w) => w.id === s.selected)!;
      drag.current = {
        kind: handle as "length" | "rotate",
        wallId: w.id,
        client: { x: e.clientX, y: e.clientY },
        world: pt,
        project: s.project,
        ids: [w.start, w.end],
        anchor: wallPoints(s.project, w)[0],
      };
    } else if (nodeId) {
      const n = s.project.floor.nodes.find((n) => n.id === nodeId)!;
      drag.current = {
        kind: "node",
        client: { x: e.clientX, y: e.clientY },
        world: pt,
        project: s.project,
        ids: [nodeId],
        anchor: n,
      };
    } else if (wallId) {
      s.set({ selected: wallId });
      const w = s.project.floor.walls.find((w) => w.id === wallId)!;
      drag.current = {
        kind: "wall",
        wallId,
        client: { x: e.clientX, y: e.clientY },
        world: pt,
        project: s.project,
        ids: [w.start, w.end],
        anchor: wallPoints(s.project, w)[0],
      };
    } else {
      s.set({ selected: null });
      drag.current = null;
    }
    moving.current = false;
    if (drag.current) e.currentTarget.setPointerCapture(e.pointerId);
  }
  function openingAt(e: ReactPointerEvent<SVGSVGElement>) {
    if (s.tool !== "door" && s.tool !== "window") return null;
    const target = e.target as Element;
    const openingId = target
      .closest("[data-opening]")
      ?.getAttribute("data-opening");
    const wallId =
      target.closest("[data-wall]")?.getAttribute("data-wall") ||
      s.project.floor.openings.find((o) => o.id === openingId)?.wallId;
    const wall = s.project.floor.walls.find((w) => w.id === wallId);
    if (!wall) return null;
    const defaults = openingDefaults(s.tool),
      center = wallStation(s.project, wall, raw(e));
    const offset = Math.round(
      s.snap
        ? Math.round((center - defaults.width / 2) / s.grid) * s.grid
        : center - defaults.width / 2,
    );
    const opening: Opening = {
      id: "preview",
      wallId: wall.id,
      offset,
      ...defaults,
    };
    let error = "";
    try {
      addOpening(s.project, wall.id, s.tool, offset);
    } catch (e) {
      error = (e as Error).message;
    }
    return { opening, error };
  }
  function move(e: ReactPointerEvent<SVGSVGElement>) {
    const pt = raw(e),
      d = drag.current;
    if (d?.kind === "pan") {
      setCam({
        ...d.camera,
        x: d.camera.x - (e.clientX - d.client.x) / d.camera.scale,
        y: d.camera.y - (e.clientY - d.client.y) / d.camera.scale,
      });
      return;
    }
    if (d) {
      if (
        Math.hypot(e.clientX - d.client.x, e.clientY - d.client.y) < 3 &&
        !moving.current
      )
        return;
      moving.current = true;
      if (d.kind === "opening") {
        const wall = d.project.floor.walls.find(
          (w) => w.id === d.opening.wallId,
        )!;
        const station =
          d.opening.offset +
          wallStation(d.project, wall, pt) -
          wallStation(d.project, wall, d.world);
        const offset = Math.round(
          s.snap ? Math.round(station / s.grid) * s.grid : station,
        );
        try {
          const next = updateOpening(d.project, d.opening.id, { offset });
          previewRef.current = next;
          setPreview(next);
        } catch {
          previewRef.current = null;
          setPreview(null);
        }
        return;
      }
      const anchor = snapped(
        { x: d.anchor.x + pt.x - d.world.x, y: d.anchor.y + pt.y - d.world.y },
        d.ids,
        null,
      ).point;
      const dx = anchor.x - d.anchor.x,
        dy = anchor.y - d.anchor.y;
      const changes = Object.fromEntries(
        d.ids.map((id) => {
          const n = d.project.floor.nodes.find((n) => n.id === id)!;
          return [id, { x: n.x + dx, y: n.y + dy }];
        }),
      );
      try {
        let p: Project;
        if (d.kind === "wall")
          p = moveWall(
            d.project,
            d.wallId!,
            { x: dx, y: dy },
            s.moveMode === "parallel",
            s.constrainEdits,
          );
        else if (d.kind === "length") {
          const w = d.project.floor.walls.find((w) => w.id === d.wallId)!,
            dir = wallDirection(d.project, w);
          const amount =
            (pt.x - d.world.x) * dir.d.x + (pt.y - d.world.y) * dir.d.y;
          const current = length(
            ...referenceSegment(d.project, w, "centerline"),
          );
          const requested = current + amount;
          const size = Math.round(
            s.snap ? Math.round(requested / s.grid) * s.grid : requested,
          );
          p = resizeReference(
            d.project,
            w.id,
            size,
            "centerline",
            s.editAnchor,
            s.constrainEdits,
          );
        } else if (d.kind === "rotate") {
          let angle =
            (Math.atan2(pt.y - d.anchor.y, pt.x - d.anchor.x) * 180) / Math.PI;
          if (s.ortho || e.shiftKey) angle = Math.round(angle / 15) * 15;
          p = rotateWall(d.project, d.wallId!, angle);
        } else p = constrainedNodes(d.project, changes, s.constrainEdits);
        previewRef.current = p;
        setPreview(p);
      } catch {
        previewRef.current = null;
        setPreview(null);
      }
    }
    const snap = snapped(pt, [], start, e.shiftKey);
    setHoverSnap(snap);
    if (
      start &&
      s.tool === "wall" &&
      !angleLocked.current &&
      !draftLength &&
      length(start, snap.point) >= 64
    )
      setDraftAngle(
        String(
          Math.round(
            (((Math.atan2(snap.point.y - start.y, snap.point.x - start.x) *
              180) /
              Math.PI +
              360) %
              360) *
              100,
          ) / 100,
        ),
      );
    if (s.tool === "door" || s.tool === "window") setCandidate(openingAt(e));
    setHover(snap.point);
    s.set({ cursor: snap.point, snapKind: snap.kind });
  }
  function up(e: ReactPointerEvent<SVGSVGElement>) {
    if (
      drawDown.current &&
      start &&
      s.tool === "wall" &&
      Math.hypot(
        e.clientX - drawDown.current.x,
        e.clientY - drawDown.current.y,
      ) > 4
    ) {
      try {
        placeWall(snapped(raw(e), [], start, e.shiftKey).point);
      } catch (error) {
        s.set({ notice: (error as Error).message });
      }
    }
    drawDown.current = null;
    if (drag.current && drag.current.kind !== "pan" && moving.current) {
      if (previewRef.current)
        s.commit(
          previewRef.current,
          drag.current.kind === "length"
            ? "Resize wall"
            : drag.current.kind === "rotate"
              ? "Rotate wall"
              : drag.current.kind === "wall"
                ? "Move wall"
                : drag.current.kind === "opening"
                  ? "Move opening"
                  : "Move junction",
        );
      else
        s.set({
          notice:
            "That edit would create invalid geometry. No changes applied.",
        });
    }
    // Single click selects; explicit Specifications command opens the dialog.
    drag.current = null;
    previewRef.current = null;
    setPreview(null);
    moving.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function zoom(factor: number, screen = { x: size.w / 2, y: size.h / 2 }) {
    setCam((c) => zoomAt(c, factor, screen));
  }
  const selected = project.floor.walls.find((w) => w.id === s.selected),
    selectedNodes = selected ? wallPoints(project, selected) : [];
  const selectedDir = selected ? wallDirection(project, selected) : null;
  const gridStep = Math.max(
      s.grid,
      s.grid * Math.ceil(12 / (s.grid * cam.scale)),
    ),
    stroke = 1 / cam.scale;
  function dimension(a: Point, b: Point, key: string, accent = false) {
    const l = length(a, b);
    if (l < 1) return null;
    const dx = (b.x - a.x) / l,
      dy = (b.y - a.y) / l,
      offset = (accent ? -16 : -31) / cam.scale;
    const q = { x: a.x - dy * offset, y: a.y + dx * offset },
      r = { x: b.x - dy * offset, y: b.y + dx * offset },
      angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const rotation = angle > 90 || angle < -90 ? angle + 180 : angle;
    return (
      <g
        key={key}
        className={accent ? "dimension accent" : "dimension"}
        pointerEvents="none"
      >
        <path d={`M${q.x},${q.y} L${r.x},${r.y}`} strokeWidth={stroke} />
        {[q, r].map((t, i) => (
          <path
            key={i}
            d={`M${t.x - ((dx + dy) * 4) / cam.scale},${t.y + ((dx - dy) * 4) / cam.scale} l${((dx + dy) * 8) / cam.scale},${((dy - dx) * 8) / cam.scale}`}
            strokeWidth={stroke}
          />
        ))}
        <text
          x={(q.x + r.x) / 2}
          y={(q.y + r.y) / 2 - 5 / cam.scale}
          fontSize={13 / cam.scale}
          textAnchor="middle"
          role={accent ? undefined : "button"}
          aria-label={
            accent
              ? undefined
              : `Edit wall ${project.floor.walls.findIndex((w) => w.id === key) + 1} dimension`
          }
          style={accent ? undefined : { pointerEvents: "all", cursor: "text" }}
          onPointerDown={
            accent
              ? undefined
              : (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  s.set({
                    selected: key,
                    tool: "select",
                    specification: { kind: "wall", id: key },
                  });
                }
          }
          transform={`rotate(${rotation} ${(q.x + r.x) / 2} ${(q.y + r.y) / 2})`}
        >
          {formatImperial(l)}
        </text>
      </g>
    );
  }
  return (
    <div ref={host} className={`plan-canvas tool-${s.tool}`}>
      <div className="canvas-heading">
        <span className="eyebrow">PLAN WORKSPACE</span>
        <h2>
          {s.project.floor.name}
          <span>01</span>
        </h2>
      </div>
      <div className="north">
        <Compass size={21} />
        <span>N</span>
      </div>
      <svg
        ref={svg}
        role="application"
        aria-label="Floor plan drawing canvas"
        data-testid="plan-canvas"
        viewBox={`${cam.x} ${cam.y} ${size.w / cam.scale} ${size.h / cam.scale}`}
        onDoubleClick={(e) => {
          if (s.tool !== "select" || s.specification) return;
          const room =
            ws.layers.rooms.visible && !ws.layers.rooms.locked
              ? rooms.find((r) => pointInRoom(raw(e), r.boundary))
              : undefined;
          if (room) {
            e.preventDefault();
            s.set({
              selected: null,
              specification: { kind: "room", key: room.key },
            });
          }
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          drag.current = null;
          drawDown.current = null;
          previewRef.current = null;
          setPreview(null);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern
            id="grid"
            width={gridStep}
            height={gridStep}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M${gridStep},0 H0 V${gridStep}`}
              fill="none"
              stroke="#a8b2bd"
              strokeWidth={1 / cam.scale}
            />
          </pattern>
          <pattern
            id="hatch"
            width={8 / cam.scale}
            height={8 / cam.scale}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2={8 / cam.scale}
              stroke="#b9bdb5"
              strokeWidth={0.6 / cam.scale}
            />
          </pattern>
        </defs>
        {s.showGrid && (
          <rect
            data-testid="drawing-grid"
            x={cam.x}
            y={cam.y}
            width={size.w / cam.scale}
            height={size.h / cam.scale}
            fill="url(#grid)"
          />
        )}
        <path
          d={`M${-4 / cam.scale},0 H${4 / cam.scale} M0,${-4 / cam.scale} V${4 / cam.scale}`}
          stroke="#a6b1aa"
          strokeWidth={stroke}
        />
        {project.floor.walls
          .filter(() => ws.layers.walls.visible)
          .map((w, i) => {
            const [a, c] = wallPoints(project, w),
              polygons = wallPlanPolygons(project, w).map((poly) =>
                poly.map((pt) => `${pt.x},${pt.y}`).join(" "),
              ),
              active = w.id === s.selected;
            return (
              <g
                key={w.id}
                data-wall={w.id}
                aria-label={`Wall ${i + 1}, ${formatImperial(length(a, c))}`}
                className={`wall ${active ? "selected" : ""}`}
              >
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={c.x}
                  y2={c.y}
                  stroke="transparent"
                  strokeWidth={Math.max(w.thickness, 18 / cam.scale)}
                />
                {polygons.map((polygon, index) => (
                  <g key={index}>
                    <polygon
                      points={polygon}
                      fill={active ? "#a9cce9" : "#b9bec4"}
                      stroke={active ? "#174f7c" : "#343e48"}
                      strokeWidth={1.5 / cam.scale}
                    />
                    <polygon
                      points={polygon}
                      fill="url(#hatch)"
                      pointerEvents="none"
                    />
                  </g>
                ))}
                {s.dimensions &&
                  ws.layers.dimensions.visible &&
                  dimension(
                    ...referenceSegment(project, w, "centerline"),
                    w.id,
                  )}
              </g>
            );
          })}
        {project.floor.openings
          .filter(
            (o) => ws.layers[o.kind === "door" ? "doors" : "windows"].visible,
          )
          .map((o) => (
            <OpeningSymbol
              key={o.id}
              project={project}
              opening={o}
              scale={cam.scale}
              selected={o.id === s.selected}
            />
          ))}
        {candidate && (s.tool === "door" || s.tool === "window") && (
          <OpeningSymbol
            project={project}
            opening={candidate.opening}
            scale={cam.scale}
            preview
            invalid={!!candidate.error}
          />
        )}
        {(ws.layers.walls.visible ? openEndpoints(project) : []).map((n) => (
          <circle
            key={`open-${n.id}`}
            cx={n.x}
            cy={n.y}
            r={4 / cam.scale}
            fill="#fff8ed"
            stroke="#b87529"
            strokeWidth={1.5 / cam.scale}
            pointerEvents="none"
          >
            <title>Unconnected wall endpoint</title>
          </circle>
        ))}
        {hoverSnap?.guide && s.tool === "wall" && (
          <line
            x1={hoverSnap.guide.from.x}
            y1={hoverSnap.guide.from.y}
            x2={hoverSnap.guide.to.x}
            y2={hoverSnap.guide.to.y}
            stroke="#26816b"
            strokeWidth={stroke}
            strokeDasharray={`${6 / cam.scale} ${4 / cam.scale}`}
            pointerEvents="none"
          />
        )}
        {rooms
          .filter(
            (room) =>
              ws.layers.rooms.visible && room.settings?.showLabel !== false,
          )
          .map((room) => (
            <g className="room-label" key={room.id} pointerEvents="none">
              <text
                x={room.labelPoint.x}
                y={room.labelPoint.y - 8 / cam.scale}
                textAnchor="middle"
                fontSize={16 / cam.scale}
              >
                {room.settings?.name || "Room"}
              </text>
              <text
                className="area"
                x={room.labelPoint.x}
                y={room.labelPoint.y + 16 / cam.scale}
                textAnchor="middle"
                fontSize={18 / cam.scale}
              >
                {room.area.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                sq ft
              </text>
              <text
                className="room-label-hint"
                x={room.labelPoint.x}
                y={room.labelPoint.y + 36 / cam.scale}
                textAnchor="middle"
                fontSize={12 / cam.scale}
              >
                Double-click for room settings
              </text>
            </g>
          ))}
        {s.tool === "select" &&
          ws.layers.walls.visible &&
          !ws.layers.walls.locked &&
          selectedDir && (
            <g>
              <rect
                data-handle="length"
                aria-label="Wall length handle"
                x={
                  selectedDir.b.x +
                  (selectedDir.d.x * 22) / cam.scale -
                  5 / cam.scale
                }
                y={
                  selectedDir.b.y +
                  (selectedDir.d.y * 22) / cam.scale -
                  5 / cam.scale
                }
                width={10 / cam.scale}
                height={10 / cam.scale}
                fill="#fff"
                stroke="#146c55"
                strokeWidth={2 / cam.scale}
              >
                <title>Length · follows selected anchor</title>
              </rect>
              <circle
                data-handle="rotate"
                aria-label="Wall rotation handle"
                cx={selectedDir.b.x + (selectedDir.n.x * 34) / cam.scale}
                cy={selectedDir.b.y + (selectedDir.n.y * 34) / cam.scale}
                r={6 / cam.scale}
                fill="#f5e5c8"
                stroke="#9b7126"
                strokeWidth={2 / cam.scale}
              >
                <title>Rotate about A · 15° steps with Ortho</title>
              </circle>
            </g>
          )}
        {s.tool === "select" &&
          (ws.layers.walls.visible && !ws.layers.walls.locked
            ? selectedNodes
            : []
          ).map((n, i) => (
            <g key={n.id}>
              <circle
                data-node={n.id}
                cx={n.x}
                cy={n.y}
                r={8 / cam.scale}
                fill="#fff"
                stroke="#1f7463"
                strokeWidth={2 / cam.scale}
              />
              <text
                x={n.x + 13 / cam.scale}
                y={n.y + 4 / cam.scale}
                fill="#28715f"
                fontSize={10 / cam.scale}
                pointerEvents="none"
              >
                {i === 0 ? "A" : "B"}
              </text>
            </g>
          ))}
        {start && draftEnd && (
          <g pointerEvents="none">
            <line
              x1={start.x + draftOffset.x}
              y1={start.y + draftOffset.y}
              x2={draftEnd.x + draftOffset.x}
              y2={draftEnd.y + draftOffset.y}
              stroke="#23836b"
              strokeOpacity=".5"
              strokeWidth={
                s.tool === "wall" ? s.defaults.thickness : stroke * 2
              }
              strokeDasharray={
                s.tool === "measure"
                  ? `${5 / cam.scale} ${5 / cam.scale}`
                  : undefined
              }
            />
            <line
              x1={start.x}
              y1={start.y}
              x2={draftEnd.x}
              y2={draftEnd.y}
              stroke="#146c55"
              strokeWidth={stroke}
            />
            {dimension(start, draftEnd, "draft", true)}
            <circle
              cx={start.x}
              cy={start.y}
              r={4 / cam.scale}
              fill="#217366"
            />
          </g>
        )}
        {measure && dimension(measure[0], measure[1], "measure", true)}
        {hover && (s.tool === "wall" || s.tool === "measure") && (
          <g pointerEvents="none">
            <rect
              x={hover.x - 4 / cam.scale}
              y={hover.y - 4 / cam.scale}
              width={8 / cam.scale}
              height={8 / cam.scale}
              fill={hoverSnap?.kind === "endpoint" ? "#23836b" : "#fff"}
              stroke="#217366"
              strokeWidth={1.5 / cam.scale}
              pointerEvents="none"
            />
            {(hoverSnap?.kind === "endpoint" ||
              hoverSnap?.kind === "alignment") && (
              <text
                x={hover.x + 12 / cam.scale}
                y={hover.y - 12 / cam.scale}
                fill="#175e4b"
                fontSize={13 / cam.scale}
              >
                {hoverSnap.kind === "endpoint"
                  ? "Endpoint · connected"
                  : "Aligned"}
              </text>
            )}
          </g>
        )}
      </svg>
      {!project.floor.walls.length && s.tool !== "wall" && (
        <div className="empty-canvas">
          <Crosshair size={30} />
          <h3>A new space starts here.</h3>
          <p>
            Choose Wall, then click and drag or click two points.
            <br />
            Keep clicking to connect your walls.
          </p>
          <button className="primary" onClick={() => s.set({ tool: "wall" })}>
            Draw your first wall <span>W</span>
          </button>
        </div>
      )}
      {s.tool === "wall" && start && (
        <form
          className="draft-input"
          style={{
            left: Math.max(
              16,
              Math.min(
                size.w - 340,
                ((draftEnd || start).x - cam.x) * cam.scale + 24,
              ),
            ),
            top: Math.max(
              80,
              Math.min(
                size.h - 230,
                ((draftEnd || start).y - cam.y) * cam.scale + 35,
              ),
            ),
          }}
          onSubmit={(e) => {
            e.preventDefault();
            try {
              if (!draftAngle.trim())
                throw new Error("Enter a heading in degrees.");
              placeWall(
                pointAtHeading(
                  start,
                  parseImperial(draftLength),
                  Number(draftAngle),
                ),
              );
              setDraftError("");
              (document.activeElement as HTMLElement)?.blur();
            } catch (error) {
              setDraftError((error as Error).message);
            }
          }}
        >
          <div className="draft-heading">
            DRAW WALL{" "}
            <span>
              {draftEnd
                ? formatImperial(length(start, draftEnd))
                : "Choose direction"}{" "}
              preview
            </span>
          </div>
          <div className="draft-fields">
            <label>
              Exact length <kbd>Type</kbd>
              <input
                ref={lengthInput}
                aria-label="Draft wall length"
                placeholder="e.g. 16 ft 3 1/2 in"
                value={draftLength}
                onChange={(e) => setDraftLength(e.target.value)}
              />
            </label>
            <label>
              Heading °
              <input
                aria-label="Draft wall heading"
                value={draftAngle}
                onChange={(e) => {
                  angleLocked.current = true;
                  setDraftAngle(e.target.value);
                }}
              />
            </label>
            <button className="primary" type="submit">
              Place wall
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setStart(null)}
            >
              Finish
            </button>
          </div>
          <small>
            Type a length · Tab for angle · Enter to place · Esc to finish. 0°
            right, 90° down. Explicit angles override Ortho.
          </small>
          {draftError && (
            <small className="form-error" role="alert">
              {draftError}
            </small>
          )}
        </form>
      )}
      <div className="canvas-bottom">
        <span className="canvas-tip">
          {s.tool === "door" || s.tool === "window"
            ? candidate?.error ||
              `Click a wall to place a ${s.tool} · green preview fits · red preview cannot fit`
            : s.tool === "wall"
              ? start
                ? "Click next endpoint or type a length · Tab for angle · Esc to finish"
                : "Click and drag, or click to start a chain · Ortho " +
                  (s.ortho ? "on" : "off")
              : s.tool === "measure"
                ? "Click two points to measure · Esc to clear"
                : s.tool === "pan"
                  ? "Drag to pan · scroll to zoom"
                  : "Click to select · drag to move · Specifications to edit"}
        </span>
        <div className="zoom-controls">
          <button aria-label="Zoom out" onClick={() => zoom(0.8)}>
            <Minus size={15} />
          </button>
          <span>{Math.round(cam.scale * FT)} px/ft</span>
          <button aria-label="Zoom in" onClick={() => zoom(1.25)}>
            <Plus size={15} />
          </button>
          <i />
          {selected && (
            <button
              aria-label="Zoom to selection"
              onClick={() => {
                const [a, b] = referenceSegment(
                    project,
                    selected,
                    "centerline",
                  ),
                  span = Math.max(
                    Math.abs(b.x - a.x),
                    Math.abs(b.y - a.y),
                    4 * FT,
                  ),
                  scale = Math.min(
                    0.5,
                    Math.min(size.w - 160, size.h - 160) / span,
                  );
                setCam({
                  scale,
                  x: (a.x + b.x) / 2 - size.w / scale / 2,
                  y: (a.y + b.y) / 2 - size.h / scale / 2,
                });
              }}
            >
              <Crosshair size={15} />
            </button>
          )}
          <button
            aria-label="Fit drawing"
            onClick={() => s.set({ fitToken: s.fitToken + 1 })}
          >
            <Maximize size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
