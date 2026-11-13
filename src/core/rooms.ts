import { clone, length, uid, validateProject, type Point, type Project, type RoomSettings } from "./model";
import { closedLoop, interiorBoundary, signedArea } from "./geometry";
import { FT } from "./units";
export interface RoomRegion {
  key: string;
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
/** Independent simple enclosures. Shared-wall/subdivided networks require the future face-topology engine. */
export function detectRooms(project: Project): RoomRegion[] {
  const pending=new Set(project.floor.walls.map(w=>w.id)), rooms:RoomRegion[]=[];
  const byNode=new Map<string, typeof project.floor.walls>();
  for(const wall of project.floor.walls) for(const id of [wall.start,wall.end]) byNode.set(id,[...(byNode.get(id)||[]),wall]);
  while(pending.size) {
    const wallIds:string[]=[], nodes=new Set<string>();
    const queue=[project.floor.walls.find(w=>w.id===pending.values().next().value)!];
    while(queue.length) {
      const wall=queue.pop()!;
      if(!pending.delete(wall.id)) continue;
      wallIds.push(wall.id);
      for(const id of [wall.start,wall.end]) { nodes.add(id); queue.push(...(byNode.get(id)||[]).filter(w=>pending.has(w.id))); }
    }
    const idSet=new Set(wallIds);
    const component={...project,floor:{...project.floor,walls:project.floor.walls.filter(w=>idSet.has(w.id)),nodes:project.floor.nodes.filter(n=>nodes.has(n.id))}};
    if(!closedLoop(component)) continue;
    const boundary=interiorBoundary(component);
    if(!boundary) continue;
    const key=roomKey(wallIds);
    rooms.push({key,wallIds,boundary,labelPoint:roomLabelPoint(boundary),area:Math.abs(signedArea(boundary))/FT**2,
      perimeter:boundary.reduce((sum,a,i)=>sum+length(a,boundary[(i+1)%boundary.length]),0)/FT,
      settings:project.floor.rooms?.find(r=>roomKey(r.boundaryWallIds)===key)});
  }
  return rooms;
}
export function updateRoom(project: Project,key:string,values:Pick<RoomSettings,"name"|"roomType"|"showLabel"|"notes">): Project {
  const room=detectRooms(project).find(r=>r.key===key);
  if(!room) throw new Error("This room is no longer enclosed. Reconnect its walls before editing room settings.");
  const next=clone(project), settings:RoomSettings={id:room.settings?.id||uid(),boundaryWallIds:room.wallIds,...values,name:values.name.trim(),roomType:values.roomType.trim()};
  next.floor.rooms=[...(next.floor.rooms||[]).filter(r=>roomKey(r.boundaryWallIds)!==key),settings];
  validateProject(next);
  return next;
}
