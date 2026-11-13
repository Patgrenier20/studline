import {
  clone, length, uid, validateProject, wallPoints,
  type Opening, type Point, type Project, type Wall,
} from "./model";
import { wallFootprint } from "./geometry";
import { inches } from "./units";

export const OPENING_CLEARANCE = inches(1);
export function openingDefaults(kind: Opening["kind"]) {
  return {
    kind, width: inches(36), height: inches(kind === "door" ? 80 : 48),
    sill: inches(kind === "door" ? 0 : 36),
    hinge: "start" as const, swing: 1 as const,
  };
}

/** Signed centerline station; independent of the host's orientation. */
export function wallStation(p: Project, wall: Wall, point: Point): number {
  const [a, b] = wallPoints(p, wall), span = length(a, b);
  return ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / span;
}

/** Keep jambs beyond both miter tips, plus a minimum one-inch wall pier. */
export function openingRange(p: Project, wall: Wall) {
  const footprint = wallFootprint(p, wall);
  return {
    min: Math.ceil(Math.max(0, ...[footprint[0], footprint[3]].map(pt => wallStation(p, wall, pt))) + OPENING_CLEARANCE),
    max: Math.floor(Math.min(length(...wallPoints(p, wall)), ...[footprint[1], footprint[2]].map(pt => wallStation(p, wall, pt))) - OPENING_CLEARANCE),
  };
}

export function validateOpenings(p: Project): void {
  if (p.floor.openings.length > 4000) throw new Error("A project supports up to 4,000 openings.");
  const ids = new Set([...p.floor.nodes, ...p.floor.walls].map(o => o.id));
  for (const o of p.floor.openings) {
    if (!o || typeof o.id !== "string" || !o.id || ids.has(o.id))
      throw new Error("Invalid or duplicate opening ID.");
    ids.add(o.id);
    const host = p.floor.walls.find(w => w.id === o.wallId);
    if (!host) throw new Error("Every opening must reference an existing wall.");
    if (!(["door", "window"] as unknown[]).includes(o.kind) ||
        !(["start", "end"] as unknown[]).includes(o.hinge) ||
        (o.swing !== 1 && o.swing !== -1))
      throw new Error("Invalid opening type or door orientation.");
    if (![o.offset, o.width, o.height, o.sill].every(Number.isSafeInteger) ||
        o.width < inches(1) || o.height < inches(1) || o.sill < 0)
      throw new Error("Opening dimensions must be positive integer ticks; sill cannot be negative.");
    if (o.kind === "door" && o.sill !== 0) throw new Error("Door openings must start at floor level.");
    if (o.sill + o.height > host.height - OPENING_CLEARANCE)
      throw new Error("Leave at least 1 inch of wall above the opening. Adjust opening height or sill first.");
    const range = openingRange(p, host);
    if (o.offset < range.min || o.offset + o.width > range.max)
      throw new Error("Opening must fit between the wall joins with at least 1 inch of wall at each end. Adjust its offset or width first.");
  }
  for (const host of p.floor.walls) {
    const sorted = p.floor.openings.filter(o => o.wallId === host.id).sort((a,b) => a.offset - b.offset);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].offset < sorted[i-1].offset + sorted[i-1].width + OPENING_CLEARANCE)
        throw new Error("Openings must not overlap. Leave at least 1 inch of wall between them.");
    }
  }
}

export function addOpening(p: Project, wallId: string, kind: Opening["kind"], offset: number): Project {
  const next = clone(p);
  next.floor.openings.push({ id: uid(), wallId, offset: Math.round(offset), ...openingDefaults(kind) });
  validateProject(next);
  return next;
}
export function updateOpening(p: Project, id: string, changes: Partial<Pick<Opening, "offset" | "width" | "height" | "sill" | "hinge" | "swing">>): Project {
  const next = clone(p), opening = next.floor.openings.find(o => o.id === id);
  if (!opening) throw new Error("Opening no longer exists.");
  Object.assign(opening, changes);
  validateProject(next);
  return next;
}
export function deleteOpening(p: Project, id: string): Project {
  const next = clone(p);
  next.floor.openings = next.floor.openings.filter(o => o.id !== id);
  return next;
}

/** Clip a convex wall footprint at a station perpendicular to its centerline. */
export function wallSlice(p: Project, wall: Wall, from = -Infinity, to = Infinity): Point[] {
  let poly = wallFootprint(p, wall);
  for (const [limit, direction] of [[from, 1], [to, -1]]) {
    if (!Number.isFinite(limit)) continue;
    const output: Point[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = (wallStation(p, wall, a) - limit) * direction;
      const db = (wallStation(p, wall, b) - limit) * direction;
      if (da >= 0) output.push(a);
      if ((da < 0) !== (db < 0)) {
        const t = da / (da - db);
        output.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    poly = output;
  }
  return poly;
}

export interface WallSolid { footprint: Point[]; bottom: number; top: number }
/** Derived solids only. Apertures remain parametric, never baked into project data. */
export function wallSolids(p: Project, wall: Wall): WallSolid[] {
  const openings = p.floor.openings.filter(o => o.wallId === wall.id).sort((a,b) => a.offset - b.offset);
  const solids: WallSolid[] = [];
  let start = -Infinity;
  for (const o of openings) {
    solids.push({ footprint: wallSlice(p, wall, start, o.offset), bottom: 0, top: wall.height });
    const footprint = wallSlice(p, wall, o.offset, o.offset + o.width);
    if (o.sill > 0) solids.push({ footprint, bottom: 0, top: o.sill });
    solids.push({ footprint, bottom: o.sill + o.height, top: wall.height });
    start = o.offset + o.width;
  }
  solids.push({ footprint: wallSlice(p, wall, start), bottom: 0, top: wall.height });
  return solids;
}

/** Plan conventions show a break for both doors and windows, independent of sill. */
export function wallPlanPolygons(p: Project, wall: Wall): Point[][] {
  const openings = p.floor.openings.filter(o => o.wallId === wall.id).sort((a,b) => a.offset - b.offset);
  let start = -Infinity;
  const polygons: Point[][] = [];
  for (const o of openings) {
    polygons.push(wallSlice(p, wall, start, o.offset));
    start = o.offset + o.width;
  }
  polygons.push(wallSlice(p, wall, start));
  return polygons;
}
