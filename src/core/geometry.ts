import {
  type Point,
  type Project,
  type Wall,
  wallPoints,
  length,
} from "./model";
import { FT } from "./units";
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export function bounds(p: Project): Bounds {
  if (!p.floor.nodes.length)
    return { minX: 0, minY: 0, maxX: 24 * FT, maxY: 18 * FT };
  return {
    minX: Math.min(...p.floor.nodes.map((n) => n.x)),
    minY: Math.min(...p.floor.nodes.map((n) => n.y)),
    maxX: Math.max(...p.floor.nodes.map((n) => n.x)),
    maxY: Math.max(...p.floor.nodes.map((n) => n.y)),
  };
}
function corner(p: Project, w: Wall, nodeId: string, side: number): Point {
  const [a, b] = wallPoints(p, w),
    origin = a.id === nodeId ? a : b,
    target = a.id === nodeId ? b : a;
  const l = length(origin, target),
    d = { x: (target.x - origin.x) / l, y: (target.y - origin.y) / l },
    n = { x: -d.y, y: d.x };
  const base = {
    x: origin.x + ((n.x * w.thickness) / 2) * side,
    y: origin.y + ((n.y * w.thickness) / 2) * side,
  };
  const attached = p.floor.walls.filter(
    (other) =>
      other.id !== w.id && (other.start === nodeId || other.end === nodeId),
  );
  if (attached.length !== 1) return base;
  const other = attached[0],
    [c, e] = wallPoints(p, other),
    end = c.id === nodeId ? e : c;
  const ol = length(origin, end),
    od = { x: (end.x - origin.x) / ol, y: (end.y - origin.y) / ol };
  const cross = d.x * od.y - d.y * od.x;
  if (Math.abs(cross) < 1e-8) return base;
  const otherBase = {
    x: origin.x + ((od.y * other.thickness) / 2) * side,
    y: origin.y - ((od.x * other.thickness) / 2) * side,
  };
  const t =
    ((otherBase.x - base.x) * od.y - (otherBase.y - base.y) * od.x) / cross;
  if (
    Math.abs(t) >
    Math.min(l / 2, ol / 2, Math.max(w.thickness, other.thickness) * 4)
  )
    return base;
  return { x: base.x + t * d.x, y: base.y + t * d.y };
}
/** Shared by both renderers; bounded two-wall miter with butt fallback. */
export function wallFootprint(p: Project, w: Wall): Point[] {
  return [
    corner(p, w, w.start, 1),
    corner(p, w, w.end, -1),
    corner(p, w, w.end, 1),
    corner(p, w, w.start, -1),
  ];
}
export function snapPoint(
  point: Point,
  p: Project,
  grid: number,
  tolerance: number,
  enabled: boolean,
  exclude: string[] = [],
): { point: Point; kind: "endpoint" | "grid" | "none" } {
  if (!enabled)
    return {
      point: { x: Math.round(point.x), y: Math.round(point.y) },
      kind: "none",
    };
  const closest = p.floor.nodes
    .filter((n) => !exclude.includes(n.id))
    .map((n) => ({ n, d: length(n, point) }))
    .sort((a, b) => a.d - b.d)[0];
  if (closest && closest.d <= tolerance)
    return { point: { x: closest.n.x, y: closest.n.y }, kind: "endpoint" };
  return {
    point: {
      x: Math.round(point.x / grid) * grid,
      y: Math.round(point.y / grid) * grid,
    },
    kind: "grid",
  };
}
export function wallMeshData(p: Project, w: Wall) {
  return {
    id: w.id,
    footprint: wallFootprint(p, w).map((pt) => ({
      x: pt.x / FT,
      y: pt.y / FT,
    })),
    height: w.height / FT,
    elevation: p.floor.elevation / FT,
  };
}
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  // Orientation alone incorrectly reports disjoint collinear runs as crossing.
  if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x) ||
      Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) return false;
  const orient = (u: Point, v: Point, w: Point) => (v.x-u.x)*(w.y-u.y)-(v.y-u.y)*(w.x-u.x);
  return orient(a,b,c)*orient(a,b,d) <= 0 && orient(c,d,a)*orient(c,d,b) <= 0;
}
export function signedArea(path: Point[]) {
  return path.reduce((sum,a,i) => { const b=path[(i+1)%path.length]; return sum+a.x*b.y-b.x*a.y; },0)/2;
}
/** One simple cycle only. Multi-room face extraction is a separate topology milestone. */
export function closedLoop(p: Project): { points: Point[]; walls: Wall[] } | null {
  const { nodes, walls } = p.floor;
  if (
    walls.length < 3 ||
    nodes.length !== walls.length ||
    nodes.some(
      (n) =>
        walls.filter((w) => w.start === n.id || w.end === n.id).length !== 2,
    )
  )
    return null;
  const seen = new Set<string>(),
    path: Point[] = [], ordered: Wall[] = [];
  let id = nodes[0].id,
    previous = "";
  while (!seen.has(id)) {
    seen.add(id);
    path.push(nodes.find((n) => n.id === id)!);
    const w = walls.find(
      (w) => w.id !== previous && (w.start === id || w.end === id),
    )!;
    previous = w.id;
    ordered.push(w);
    id = w.start === id ? w.end : w.start;
  }
  if (seen.size !== nodes.length) return null;
  // Reject self-intersecting cycles instead of displaying a misleading area.
  for (let i = 0; i < path.length; i++)
    for (let j = i + 2; j < path.length; j++) {
      if (i === 0 && j === path.length - 1) continue;
      const a = path[i],
        b = path[(i + 1) % path.length],
        c = path[j],
        d = path[(j + 1) % path.length];
      if (segmentsIntersect(a,b,c,d))
        return null;
    }
  return Math.abs(signedArea(path)) > 0 ? { points: path, walls: ordered } : null;
}
export function enclosedArea(p: Project): number | null {
  const loop=closedLoop(p);
  return loop ? Math.abs(signedArea(loop.points))/FT**2 : null;
}
/** Actual inside faces of the supported simple, mitered enclosure. */
export function interiorBoundary(p: Project): Point[] | null {
  const loop=closedLoop(p);
  if (!loop) return null;
  const winding=Math.sign(signedArea(loop.points));
  const edges=loop.walls.map((w,i) => {
    const [a]=wallPoints(p,w), forward=length(a,loop.points[i])<0.01;
    const poly=wallFootprint(p,w), side=winding*(forward?1:-1);
    const edge=side===1 ? [poly[0],poly[1]] : [poly[3],poly[2]];
    return forward ? edge : edge.reverse();
  });
  if (edges.some((e,i) => length(e[1],edges[(i+1)%edges.length][0])>0.01)) return null;
  const path=edges.map(e=>e[0]);
  for(let i=0;i<path.length;i++) for(let j=i+2;j<path.length;j++) {
    if(i===0&&j===path.length-1) continue;
    if(segmentsIntersect(path[i],path[(i+1)%path.length],path[j],path[(j+1)%path.length])) return null;
  }
  if (signedArea(path)*winding<=0 || Math.abs(signedArea(path))>=Math.abs(signedArea(loop.points))) return null;
  return path;
}
export function interiorArea(p: Project): number | null {
  const path=interiorBoundary(p); return path ? Math.abs(signedArea(path))/FT**2 : null;
}
