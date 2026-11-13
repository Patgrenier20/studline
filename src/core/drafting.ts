import { length, type Point, type Project } from "./model";
import { snapPoint } from "./geometry";
import { inches } from "./units";

export interface DraftSnap {
  point: Point;
  kind: "endpoint" | "alignment" | "grid" | "none";
  guide?: { from: Point; to: Point };
}
/** Resolve constraints before snapping, so endpoint acquisition never silently defeats ortho. */
export function draftPoint(point: Point, project: Project, grid: number, tolerance: number,
  enabled: boolean, base: Point | null, ortho: boolean, exclude: string[] = []): DraftSnap {
  if (!base || !ortho) return snapPoint(point, project, grid, tolerance, enabled, exclude);
  const horizontal = Math.abs(point.x - base.x) >= Math.abs(point.y - base.y);
  const axis = horizontal ? "x" : "y", fixed = horizontal ? "y" : "x";
  const projected = { ...point, [fixed]: base[fixed] };
  const candidates = project.floor.nodes.filter(n => !exclude.includes(n.id));
  if (enabled) {
    const endpoint = candidates.filter(n => n[fixed] === base[fixed] && length(n, base) >= inches(1))
      .map(n => ({ n, distance: Math.abs(n[axis] - projected[axis]) }))
      .filter(n => n.distance <= tolerance).sort((a,b) => a.distance - b.distance || a.n.id.localeCompare(b.n.id))[0];
    if (endpoint) return { point: { x: endpoint.n.x, y: endpoint.n.y }, kind: "endpoint" };
    const alignment = candidates.filter(n => Math.abs(n[axis] - base[axis]) >= inches(1))
      .map(n => ({ n, distance: Math.abs(n[axis] - projected[axis]) }))
      .filter(n => n.distance <= tolerance).sort((a,b) => a.distance - b.distance || a.n.id.localeCompare(b.n.id))[0];
    if (alignment) {
      const result = { ...base, [axis]: alignment.n[axis] };
      return { point: result, kind: "alignment", guide: { from: alignment.n, to: result } };
    }
  }
  return { point: { ...base, [axis]: enabled ? Math.round(projected[axis] / grid) * grid : Math.round(projected[axis]) }, kind: enabled ? "grid" : "none" };
}

/** Explicit heading input permits irregular layouts; one rounding step at the model boundary. */
export function pointAtHeading(start: Point, size: number, angleDegrees: number): Point {
  if (!Number.isSafeInteger(size) || size < inches(1)) throw new Error("Wall length must be at least one inch.");
  if (!Number.isFinite(angleDegrees)) throw new Error("Enter a valid heading in degrees.");
  const a = angleDegrees * Math.PI / 180;
  return { x: start.x + Math.round(Math.cos(a) * size), y: start.y + Math.round(Math.sin(a) * size) };
}

export function openEndpoints(project: Project) {
  const counts = new Map<string, number>();
  for (const w of project.floor.walls) for (const id of [w.start,w.end]) counts.set(id,(counts.get(id) ?? 0) + 1);
  return project.floor.nodes.filter(n => counts.get(n.id) === 1);
}

export interface PlanCamera { x: number; y: number; scale: number }
export function zoomAt(camera: PlanCamera, factor: number, screen: Point): PlanCamera {
  const scale = Math.min(0.5,Math.max(0.003,camera.scale * factor));
  return { scale, x: camera.x + screen.x / camera.scale - screen.x / scale,
    y: camera.y + screen.y / camera.scale - screen.y / scale };
}
export function wheelZoomFactor(deltaY: number, deltaMode: number) {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 800 : 1);
  return Math.exp(-Math.max(-100,Math.min(100,pixels)) * 0.0018);
}
