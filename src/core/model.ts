import { feet, inches } from "./units";
import { validateOpenings } from "./openings";
import { validFinishes, type WallFinishes } from "./materials";
export interface Point {
  x: number;
  y: number;
}
export interface Junction extends Point {
  id: string;
}
export interface Wall {
  id: string;
  start: string;
  end: string;
  height: number;
  thickness: number;
  material: string;
  finishes?: WallFinishes;
  /** Physical exterior side relative to normal (-dy, dx). Omitted legacy values are inferred. */
  exteriorSide?: 1 | -1;
  wallType?: "generic" | "exterior" | "interior";
  locked?: boolean;
}
export interface RoomSettings {
  id: string;
  boundaryWallIds: string[];
  name: string;
  roomType: string;
  showLabel: boolean;
  notes: string;
}
export interface Floor {
  id: string;
  name: string;
  elevation: number;
  nodes: Junction[];
  walls: Wall[];
  openings: Opening[];
  rooms?: RoomSettings[];
}
export interface Opening {
  id: string;
  wallId: string;
  kind: "door" | "window";
  /** Distance from host start junction to near jamb, along centerline. */
  offset: number;
  width: number;
  height: number;
  sill: number;
  hinge: "start" | "end";
  swing: 1 | -1;
}
export interface Project {
  schemaVersion: 2;
  id: string;
  name: string;
  units: "imperial";
  modifiedAt: string;
  floor: Floor;
  setup?: {
    projectType: string;
    location: string;
    notes: string;
    wallHeight: number;
    wallThickness: number;
  };
}
export const uid = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Local HTTP previews lack randomUUID; getRandomValues remains available.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
export const clone = <T>(x: T): T => structuredClone(x);
export function createProject(name = "Untitled residence"): Project {
  return {
    schemaVersion: 2,
    id: uid(),
    name: name.trim() || "Untitled residence",
    units: "imperial",
    modifiedAt: new Date().toISOString(),
    floor: {
      id: uid(),
      name: "Ground floor",
      elevation: 0,
      nodes: [],
      walls: [],
      openings: [],
    },
  };
}
export function wallPoints(p: Project, wall: Wall): [Junction, Junction] {
  return [
    p.floor.nodes.find((n) => n.id === wall.start)!,
    p.floor.nodes.find((n) => n.id === wall.end)!,
  ];
}
export function length(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
export function validateProject(value: unknown): asserts value is Project {
  if (!value || typeof value !== "object")
    throw new Error("This is not a Studline project.");
  const p = value as Project;
  if (p.schemaVersion !== 2)
    throw new Error(
      "Unsupported project version. This editor uses schema 2.",
    );
  if (
    typeof p.id !== "string" ||
    !p.id ||
    typeof p.name !== "string" ||
    !p.name.trim() ||
    p.name.length > 120 ||
    p.units !== "imperial" ||
    typeof p.modifiedAt !== "string" ||
    !Number.isFinite(Date.parse(p.modifiedAt))
  )
    throw new Error("Invalid project metadata.");
  if (p.setup !== undefined) {
    const setup = p.setup;
    if (!setup || typeof setup.projectType !== "string" || setup.projectType.length > 60 ||
      typeof setup.location !== "string" || setup.location.length > 160 ||
      typeof setup.notes !== "string" || setup.notes.length > 2000 ||
      !Number.isSafeInteger(setup.wallHeight) || setup.wallHeight < feet(1) || setup.wallHeight > feet(30) ||
      !Number.isSafeInteger(setup.wallThickness) || setup.wallThickness < inches(0.25) || setup.wallThickness > inches(48)) {
      throw new Error("Invalid project setup.");
    }
  }
  const f = p.floor;
  if (
    !f ||
    typeof f.id !== "string" ||
    !f.id ||
    typeof f.name !== "string" ||
    !f.name ||
    f.name.length > 120 ||
    !Number.isSafeInteger(f.elevation) ||
    Math.abs(f.elevation) > feet(1000) ||
    !Array.isArray(f.nodes) ||
    !Array.isArray(f.walls) ||
    !Array.isArray(f.openings)
  )
    throw new Error("Invalid floor data.");
  if (f.nodes.length > 5000 || f.walls.length > 2000)
    throw new Error("This milestone supports up to 2,000 walls per project.");
  const ids = new Set<string>();
  for (const n of f.nodes) {
    if (
      !n ||
      typeof n.id !== "string" ||
      !n.id ||
      ids.has(n.id) ||
      !Number.isSafeInteger(n.x) ||
      !Number.isSafeInteger(n.y) ||
      Math.max(Math.abs(n.x), Math.abs(n.y)) > feet(10000)
    )
      throw new Error("Invalid or duplicate junction.");
    ids.add(n.id);
  }
  const walls = new Set<string>(),
    edges = new Set<string>();
  for (const w of f.walls) {
    if (
      !w ||
      typeof w.id !== "string" ||
      !w.id ||
      walls.has(w.id) ||
      !ids.has(w.start) ||
      !ids.has(w.end) ||
      w.start === w.end
    )
      throw new Error("A wall has an invalid junction or duplicate ID.");
    if (w.finishes !== undefined && !validFinishes(w.finishes)) throw new Error("Invalid wall surface finishes.");
    const key = [w.start, w.end].sort().join("|");
    if ((w.exteriorSide !== undefined && w.exteriorSide !== 1 && w.exteriorSide !== -1) ||
        (w.wallType !== undefined && !["generic","exterior","interior"].includes(w.wallType)) ||
        (w.locked !== undefined && typeof w.locked !== "boolean")) throw new Error("Invalid wall reference, type or lock.");
    if (edges.has(key))
      throw new Error("A wall already connects these endpoints.");
    edges.add(key);
    walls.add(w.id);
    if (
      !Number.isSafeInteger(w.height) ||
      w.height < feet(1) ||
      w.height > feet(30) ||
      !Number.isSafeInteger(w.thickness) ||
      w.thickness < inches(0.25) ||
      w.thickness > inches(48) ||
      typeof w.material !== "string" ||
      !/^#[a-fA-F0-9]{6}$/.test(w.material)
    )
      throw new Error(
        "Wall height must be 1–30 feet; thickness must be 1/4–48 inches.",
      );
    const [a, b] = wallPoints(p, w);
    if (length(a, b) < inches(1))
      throw new Error("Walls must be at least one inch long.");
  }
  if (f.rooms !== undefined) {
    if (!Array.isArray(f.rooms) || f.rooms.length > 2000) throw new Error("Invalid room settings.");
    const roomIds = new Set<string>(), boundaries = new Set<string>();
    for (const r of f.rooms) {
      if (!r || typeof r.id !== "string" || !r.id || roomIds.has(r.id) ||
        !Array.isArray(r.boundaryWallIds) || r.boundaryWallIds.length < 3 || r.boundaryWallIds.length > 2000 ||
        r.boundaryWallIds.some(id => typeof id !== "string" || !id) || new Set(r.boundaryWallIds).size !== r.boundaryWallIds.length ||
        typeof r.name !== "string" || !r.name.trim() || r.name.length > 80 ||
        typeof r.roomType !== "string" || !r.roomType.trim() || r.roomType.length > 80 ||
        typeof r.showLabel !== "boolean" || typeof r.notes !== "string" || r.notes.length > 2000)
        throw new Error("Invalid room settings.");
      const key = JSON.stringify([...r.boundaryWallIds].sort());
      if (boundaries.has(key)) throw new Error("Duplicate room boundary settings.");
      roomIds.add(r.id); boundaries.add(key);
    }
  }
  validateOpenings(p);
}
export function addWall(
  p: Project,
  a: Point,
  b: Point,
  defaults: Pick<Wall, "height" | "thickness" | "material">,
): Project {
  const next = clone(p);
  const node = (pt: Point) => {
    const point = { x: Math.round(pt.x), y: Math.round(pt.y) };
    let n = next.floor.nodes.find((n) => n.x === point.x && n.y === point.y);
    if (!n) {
      n = { id: uid(), ...point };
      next.floor.nodes.push(n);
    }
    return n.id;
  };
  next.floor.walls.push({
    id: uid(),
    start: node(a),
    end: node(b),
    ...defaults,
  });
  validateProject(next);
  return next;
}
export function editNodes(p: Project, changes: Record<string, Point>): Project {
  for(const w of p.floor.walls.filter(w=>w.locked)) for(const n of wallPoints(p,w)) {
    const pt=changes[n.id];
    if(pt&&(Math.round(pt.x)!==n.x||Math.round(pt.y)!==n.y)) throw new Error("Unlock the affected wall before moving its junctions.");
  }
  const next = clone(p);
  next.floor.nodes = next.floor.nodes.map((n) =>
    changes[n.id]
      ? { ...n, x: Math.round(changes[n.id].x), y: Math.round(changes[n.id].y) }
      : n,
  );
  // Welding a moved endpoint retains the stationary junction's stable identity.
  const canonical = new Map<string, Junction>(),
    remap = new Map<string, string>();
  const ordered = [...next.floor.nodes].sort(
    (a, b) => Number(a.id in changes) - Number(b.id in changes),
  );
  for (const n of ordered) {
    const key = `${n.x},${n.y}`,
      existing = canonical.get(key);
    if (existing && (n.id in changes || existing.id in changes))
      remap.set(n.id, existing.id);
    else canonical.set(key, n);
  }
  next.floor.nodes = next.floor.nodes.filter((n) => !remap.has(n.id));
  next.floor.walls = next.floor.walls.map((w) => ({
    ...w,
    start: remap.get(w.start) || w.start,
    end: remap.get(w.end) || w.end,
  }));
  validateProject(next);
  return next;
}
export function resizeWall(p: Project, id: string, size: number): Project {
  if (size < inches(1))
    throw new Error("Wall length must be at least one inch.");
  const w = p.floor.walls.find((w) => w.id === id)!;
  const [a, b] = wallPoints(p, w),
    l = length(a, b);
  return editNodes(p, {
    [b.id]: {
      x: a.x + ((b.x - a.x) * size) / l,
      y: a.y + ((b.y - a.y) * size) / l,
    },
  });
}
export function updateWall(
  p: Project,
  id: string,
  props: Partial<Pick<Wall, "height" | "thickness" | "material" | "exteriorSide" | "wallType" | "locked" | "finishes">>,
): Project {
  if(p.floor.walls.find(w=>w.id===id)?.locked && Object.keys(props).some(k=>k!=="locked"&&k!=="material"&&k!=="finishes")) throw new Error("Unlock the wall before editing it.");
  const next = clone(p);
  next.floor.walls = next.floor.walls.map((w) =>
    w.id === id ? { ...w, ...props } : w,
  );
  validateProject(next);
  return next;
}
export function deleteWall(p: Project, id: string): Project {
  if(p.floor.walls.find(w=>w.id===id)?.locked) throw new Error("Unlock the wall before deleting it.");
  const next = clone(p);
  next.floor.walls = next.floor.walls.filter((w) => w.id !== id);
  next.floor.openings = next.floor.openings.filter((o) => o.wallId !== id);
  const used = new Set(next.floor.walls.flatMap((w) => [w.start, w.end]));
  next.floor.nodes = next.floor.nodes.filter((n) => used.has(n.id));
  return next;
}
export const DEFAULT_WALL = {
  height: feet(9),
  thickness: inches(6),
  material: "#ddd9cc",
};
export function rectangle(
  p: Project,
  width: number,
  depth: number,
  origin: Point = { x: 0, y: 0 },
  defaults = DEFAULT_WALL,
): Project {
  const { x, y } = origin,
    pts = [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + depth },
      { x, y: y + depth },
    ];
  return pts.reduce(
    (next, a, i) => addWall(next, a, pts[(i + 1) % 4], defaults),
    p,
  );
}
export function demoProject() {
  return rectangle(createProject("The courtyard study"), feet(24), feet(18));
}
