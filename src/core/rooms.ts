import { clone, length, uid, validateProject, type Junction, type Point, type Project, type RoomSettings, type Wall } from "./model";
import { interiorBoundary, signedArea } from "./geometry";
import { normalizeTopology } from "./topology";
import { FT } from "./units";
export interface RoomRegion {
  key: string;
  id: string;
  wallIds: string[];
  boundary: Point[];
  labelPoint: Point;
  area: number;
  perimeter: number;
  settings?: RoomSettings;
}
export const roomKey = (wallIds: string[]) => JSON.stringify([...wallIds].sort());
export function pointInRoom(point: Point, boundary: Point[]): boolean {
  let inside = false;
  for (let i=0,j=boundary.length-1;i<boundary.length;j=i++) {
    const a=boundary[i], b=boundary[j];
    if ((a.y>point.y)!==(b.y>point.y) && point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}
/** A scanline point inside the polygon, even when a concave room's bounds center is outside. */
export function roomLabelPoint(boundary: Point[]): Point {
  const ys=[...new Set(boundary.map(p=>p.y))].sort((a,b)=>a-b);
  let best=boundary[0], score=-1;
  for (let k=0;k<ys.length-1;k++) {
    const y=(ys[k]+ys[k+1])/2, xs:number[]=[];
    boundary.forEach((a,i)=>{
      const b=boundary[(i+1)%boundary.length];
      if((a.y>y)!==(b.y>y)) xs.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y));
    });
    xs.sort((a,b)=>a-b);
    for(let i=0;i+1<xs.length;i+=2) {
      const roomScore=Math.min(xs[i+1]-xs[i],ys[k+1]-ys[k]);
      if(roomScore>score) { score=roomScore; best={x:(xs[i]+xs[i+1])/2,y}; }
    }
  }
  return best;
}
interface HalfEdge {
  from: Junction;
  to: Junction;
  wall: Wall;
  angle: number;
  twin?: HalfEdge;
  next?: HalfEdge;
}

/** Follow each directed wall with the room on its left, discarding exterior walks. */
function traceRooms(project: Project): RoomRegion[] {
  const nodes = new Map(project.floor.nodes.map(n => [n.id, n]));
  const outgoing = new Map<string, HalfEdge[]>();
  const edges: HalfEdge[] = [];
  function edge(from: Junction, to: Junction, wall: Wall): HalfEdge {
    const result = { from, to, wall, angle: Math.atan2(to.y - from.y, to.x - from.x) };
    const exits = outgoing.get(from.id) ?? [];
    exits.push(result);
    outgoing.set(from.id, exits);
    edges.push(result);
    return result;
  }
  for (const wall of project.floor.walls) {
    const a = nodes.get(wall.start)!, b = nodes.get(wall.end)!;
    const forward = edge(a, b, wall), reverse = edge(b, a, wall);
    forward.twin = reverse;
    reverse.twin = forward;
  }
  for (const exits of outgoing.values()) {
    exits.sort((a, b) => a.angle - b.angle);
    exits.forEach((exit, i) => { exit.twin!.next = exits[(i + exits.length - 1) % exits.length]; });
  }

  const visited = new Set<HalfEdge>(), rooms: RoomRegion[] = [];
  const outlines: Point[][] = [];
  for (const start of edges) {
    if (visited.has(start)) continue;
    const walk: HalfEdge[] = [];
    let current = start;
    do {
      visited.add(current);
      walk.push(current);
      current = current.next!;
    } while (current !== start);
    // A bridge is walked in both directions by the same face and encloses no area.
    const inWalk = new Set(walk);
    const boundaryEdges = walk.filter(e => !inWalk.has(e.twin!));
    const points = boundaryEdges.map(e => e.from);
    if (points.length < 3 || signedArea(points) <= 0) continue;
    if (new Set(points).size !== points.length ||
        boundaryEdges.some((e, i) => e.to !== points[(i + 1) % points.length])) continue;
    const walls = boundaryEdges.map(e => e.wall), wallIds = walls.map(w => w.id);
    const boundary = interiorBoundary({
      ...project, floor: { ...project.floor, nodes: points, walls },
    });
    if (!boundary) continue;
    const key = roomKey(wallIds);
    outlines.push(points);
    const settings = project.floor.rooms?.find(r => roomKey(r.boundaryWallIds) === key);
    rooms.push({
      key, id: settings?.id ?? key, wallIds, boundary, labelPoint: roomLabelPoint(boundary),
      area: Math.abs(signedArea(boundary)) / FT ** 2,
      perimeter: boundary.reduce((sum, a, i) => sum + length(a, boundary[(i + 1) % boundary.length]), 0) / FT,
      settings,
    });
  }
  // The room model has a single boundary. Avoid overlapping room polygons for nested loops.
  return rooms.filter((room, i) => !rooms.some((other, j) =>
    other.area < room.area && i !== j && outlines[j].every(pt => pointInRoom(pt, room.boundary))));
}

export function detectRooms(project: Project): RoomRegion[] {
  try {
    const normalized = normalizeTopology(project);
    return traceRooms(normalized.project === project ? project :
      reconcileRoomSettings(project, normalized.project, normalized.sourceWall, true));
  } catch {
    // Older files can contain wall layouts that the editor now rejects.
    return [];
  }
}

/** Keep exact matches first. A split follows the old label point, with boundary
 * overlap, area and wall order as fallbacks. A merge keeps one existing identity. */
export function reconcileRoomSettings(
  before: Project,
  after: Project,
  sourceWall: Map<string, string>,
  legacy = false,
): Project {
  if (!after.floor.rooms?.length) return after;
  const rooms = traceRooms(after);
  const claimed = new Set(rooms.filter(r => r.settings).map(r => r.key));
  const previous = traceRooms(before);
  const priorById = new Map(previous.flatMap(r => r.settings ? [[r.settings.id, r] as const] : []));
  const settings = [...after.floor.rooms].sort((a, b) =>
    (priorById.get(b.id)?.area ?? 0) - (priorById.get(a.id)?.area ?? 0) || a.id.localeCompare(b.id));
  const assignments = new Map<string, RoomSettings>();
  for (const entry of settings) {
    const key = roomKey(entry.boundaryWallIds);
    if (rooms.some(r => r.key === key)) continue;
    const prior = priorById.get(entry.id);
    if (!prior && !legacy && !sourceWall.size) continue;
    const ids = new Set(entry.boundaryWallIds);
    const candidates = rooms.filter(r => !claimed.has(r.key)).map(room => {
      const shared = new Set(room.wallIds.map(id => sourceWall.get(id) ?? id).filter(id => ids.has(id))).size;
      const inside = prior !== undefined && pointInRoom(prior.labelPoint, room.boundary);
      return { room, shared, inside };
    }).filter(({ shared, inside }) => shared >= (inside ? 1 : 2))
      .sort((a, b) => Number(b.inside) - Number(a.inside) || b.shared - a.shared || b.room.area - a.room.area);
    const match = candidates[0]?.room;
    if (!match) continue;
    claimed.add(match.key);
    assignments.set(entry.id, { ...entry, boundaryWallIds: match.wallIds });
  }
  if (!assignments.size) return after;
  return {
    ...after,
    floor: { ...after.floor, rooms: after.floor.rooms.map(r => assignments.get(r.id) ?? r) },
  };
}
export function updateRoom(project: Project,key:string,values:Pick<RoomSettings,"name"|"roomType"|"showLabel"|"notes">): Project {
  const room=detectRooms(project).find(r=>r.key===key);
  if(!room) throw new Error("This room is no longer enclosed. Reconnect its walls before editing room settings.");
  const next=clone(project), settings:RoomSettings={id:room.settings?.id||uid(),boundaryWallIds:room.wallIds,...values,name:values.name.trim(),roomType:values.roomType.trim()};
  next.floor.rooms=[...(next.floor.rooms||[]).filter(r=>r.id!==settings.id && roomKey(r.boundaryWallIds)!==key),settings];
  validateProject(next);
  return next;
}
