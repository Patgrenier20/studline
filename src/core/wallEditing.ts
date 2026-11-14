import { addWall, clone, editNodes, length, validateProject, wallPoints, type Point, type Project, type Wall } from "./model";
import { closedLoop, signedArea, wallFootprint } from "./geometry";
import { wallStation } from "./openings";
import { inches } from "./units";

export type WallReference = "exterior" | "centerline" | "interior";
export type EditAnchor = "start" | "end" | "both";
export const REFERENCES: WallReference[] = ["exterior", "centerline", "interior"];
export const referenceLabel = (r: WallReference) => r === "centerline" ? "Centerline" : r === "exterior" ? "Exterior face" : "Interior face";
export function wallDirection(p: Project, w: Wall) {
  const [a,b]=wallPoints(p,w), span=length(a,b);
  const d={x:(b.x-a.x)/span,y:(b.y-a.y)/span};
  return {a,b,d,n:{x:-d.y,y:d.x},span};
}
export function exteriorSide(p: Project, w: Wall): 1 | -1 {
  if(w.exteriorSide) return w.exteriorSide;
  let loop=closedLoop(p);
  // A separate enclosure or unrelated open wall must not change this wall's physical side.
  if(!loop) {
    const nodes=new Set([w.start,w.end]), walls=new Set<string>(), queue=[w];
    while(queue.length) {
      const current=queue.pop()!;
      if(walls.has(current.id)) continue;
      walls.add(current.id);
      for(const nodeId of [current.start,current.end]) {
        nodes.add(nodeId);
        queue.push(...p.floor.walls.filter(other=>!walls.has(other.id)&&(other.start===nodeId||other.end===nodeId)));
      }
    }
    loop=closedLoop({...p,floor:{...p.floor,nodes:p.floor.nodes.filter(n=>nodes.has(n.id)),walls:p.floor.walls.filter(wall=>walls.has(wall.id))}});
  }
  const i=loop?.walls.findIndex(other=>other.id===w.id) ?? -1;
  if(loop&&i>=0) {
    const forward=length(wallPoints(p,w)[0],loop.points[i])<0.01;
    return (-Math.sign(signedArea(loop.points))*(forward?1:-1)) as 1|-1;
  }
  return -1;
}
export function referenceSide(p: Project,w: Wall,ref: WallReference) {
  return ref==="centerline"?0:exteriorSide(p,w)*(ref==="exterior"?1:-1);
}
export function referenceSegment(p: Project,w: Wall,ref: WallReference): [Point,Point] {
  if(ref==="centerline") return wallPoints(p,w);
  const poly=wallFootprint(p,w);
  return referenceSide(p,w,ref)===1 ? [poly[0],poly[1]] : [poly[3],poly[2]];
}
export function projectToSegment(point: Point,a: Point,b: Point) {
  const t=Math.max(0,Math.min(1,((point.x-a.x)*(b.x-a.x)+(point.y-a.y)*(b.y-a.y))/length(a,b)**2));
  return {point:{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)},t};
}
export interface ReferenceHit { wallId: string; reference: WallReference; point: Point; distance: number; kind: "endpoint" | "midpoint" | "face" }
/** Tolerance changes acquisition only: returned points remain on exact model references. */
export function hitWallReference(p: Project,point: Point,tolerance: number,preferred: WallReference,auto=true,exclude:string[]=[]): ReferenceHit | null {
  const hits:ReferenceHit[]=[];
  for(const w of p.floor.walls) {
    if(exclude.includes(w.id)) continue;
    for(const ref of auto?REFERENCES:[preferred]) {
      const [a,b]=referenceSegment(p,w,ref), projection=projectToSegment(point,a,b);
      let target=projection.point, kind:ReferenceHit["kind"]="face";
      const midpoint={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      if(length(point,a)<=tolerance/2) {target=a;kind="endpoint";}
      else if(length(point,b)<=tolerance/2) {target=b;kind="endpoint";}
      else if(length(point,midpoint)<=tolerance/2) {target=midpoint;kind="midpoint";}
      const distance=length(point,target);
      if(distance<=tolerance) hits.push({wallId:w.id,reference:ref,point:target,distance,kind});
    }
  }
  // When faces are less than ~2 screen pixels apart, use the explicit preference.
  const nearest=hits.sort((a,b)=>a.distance-b.distance||a.wallId.localeCompare(b.wallId))[0];
  if(!nearest) return null;
  return hits.find(h=>h.wallId===nearest.wallId&&h.reference===preferred&&h.distance<=nearest.distance+tolerance/6) ?? nearest;
}

/** Propagate axis equality only along existing orthogonal connections. */
export function constrainedNodes(p: Project,changes: Record<string,Point>,enabled: boolean,adjustOpenings?: (next: Project) => void) {
  if(!enabled) return editNodes(p,changes,adjustOpenings);
  const output:Record<string,Point>={};
  for(const axis of ["x","y"] as const) {
    const remaining=new Set(p.floor.nodes.map(n=>n.id));
    while(remaining.size) {
      const queue=[remaining.values().next().value!], group:string[]=[];
      remaining.delete(queue[0]);
      while(queue.length) {
        const id=queue.pop()!; group.push(id);
        for(const w of p.floor.walls) {
          const [a,b]=wallPoints(p,w);
          if(a[axis]!==b[axis] || (w.start!==id&&w.end!==id)) continue;
          const other=w.start===id?w.end:w.start;
          if(remaining.delete(other)) queue.push(other);
        }
      }
      const deltas=group.filter(id=>changes[id]).map(id=>Math.round(changes[id][axis])-p.floor.nodes.find(n=>n.id===id)![axis]);
      if(!deltas.length) continue;
      if(deltas.some(d=>d!==deltas[0])) throw new Error("This edit conflicts with orthogonal corners. Choose Free editing to reshape them.");
      for(const id of group) {
        const n=p.floor.nodes.find(n=>n.id===id)!;
        output[id]={...(output[id]??n),[axis]:n[axis]+deltas[0]};
      }
    }
  }
  return editNodes(p,output,adjustOpenings);
}
export function moveWall(p: Project,id:string,delta:Point,parallel:boolean,constrained:boolean) {
  const w=p.floor.walls.find(w=>w.id===id)!, {a,b,n}=wallDirection(p,w);
  if(parallel) {const amount=delta.x*n.x+delta.y*n.y;delta={x:n.x*amount,y:n.y*amount};}
  const junctions = new Set([w.start, w.end].filter(node =>
    p.floor.walls.filter(other => other.start === node || other.end === node).length >= 3));
  return constrainedNodes(p,{[a.id]:{x:a.x+delta.x,y:a.y+delta.y},[b.id]:{x:b.x+delta.x,y:b.y+delta.y}},constrained, next => {
    for (const opening of next.floor.openings) {
      const oldHost = p.floor.walls.find(host => host.id === opening.wallId)!;
      if (oldHost.id === id || (!junctions.has(oldHost.start) && !junctions.has(oldHost.end))) continue;
      const host = next.floor.walls.find(host => host.id === opening.wallId)!;
      const previous = wallDirection(p, oldHost), current = wallDirection(next, host);
      const onHostLine = (point: Point) => Math.abs((point.x - previous.a.x) * previous.n.x +
        (point.y - previous.a.y) * previous.n.y) <= 1;
      if (!onHostLine(current.a) || !onHostLine(current.b)) continue;
      const jamb = { x: previous.a.x + opening.offset * previous.d.x, y: previous.a.y + opening.offset * previous.d.y };
      opening.offset = Math.round(wallStation(next, host, jamb));
    }
  });
}
export function resizeReference(p: Project,id:string,size:number,ref:WallReference,anchor:EditAnchor,constrained:boolean) {
  if(!Number.isSafeInteger(size)||size<inches(1)) throw new Error("Wall length must be at least one inch.");
  const w=p.floor.walls.find(w=>w.id===id)!,{a,b,d}=wallDirection(p,w);
  const original=length(...referenceSegment(p,w,ref));
  let delta=size-original;
  for(let attempt=0;attempt<12;attempt++) {
    const left=anchor==="end"?-delta:anchor==="both"?-delta/2:0;
    const right=anchor==="start"?delta:anchor==="both"?delta/2:0;
    const next=constrainedNodes(p,{[a.id]:{x:a.x+d.x*left,y:a.y+d.y*left},[b.id]:{x:b.x+d.x*right,y:b.y+d.y*right}},constrained);
    const error=size-length(...referenceSegment(next,next.floor.walls.find(x=>x.id===id)!,ref));
    if(Math.abs(error)<=1) return next;
    delta+=error;
  }
  throw new Error("The requested face length cannot be resolved with these corners. Use centerline or Free editing.");
}
export function changeThickness(p:Project,id:string,thickness:number,ref:WallReference,constrained:boolean) {
  const w=p.floor.walls.find(w=>w.id===id)!;
  if(w.locked) throw new Error("Unlock the wall before editing it.");
  const {a,b,n}=wallDirection(p,w), shift=referenceSide(p,w,ref)*(w.thickness-thickness)/2;
  const next=clone(p); next.floor.walls.find(x=>x.id===id)!.thickness=thickness;
  return constrainedNodes(next,{[a.id]:{x:a.x+n.x*shift,y:a.y+n.y*shift},[b.id]:{x:b.x+n.x*shift,y:b.y+n.y*shift}},constrained);
}
export function rotateWall(p:Project,id:string,angle:number) {
  if(!Number.isFinite(angle)) throw new Error("Enter a finite angle.");
  const w=p.floor.walls.find(w=>w.id===id)!,{a,b,span}=wallDirection(p,w), radians=angle*Math.PI/180;
  return editNodes(p,{[b.id]:{x:a.x+Math.cos(radians)*span,y:a.y+Math.sin(radians)*span}});
}
export function reverseWall(p:Project,id:string) {
  const w=p.floor.walls.find(w=>w.id===id)!;
  if(w.locked) throw new Error("Unlock the wall before reversing it.");
  const next=clone(p), target=next.floor.walls.find(x=>x.id===id)!;
  [target.start,target.end]=[target.end,target.start]; target.exteriorSide=-exteriorSide(p,w) as 1|-1;
  const span=length(...wallPoints(p,w));
  for(const o of next.floor.openings.filter(o=>o.wallId===id)) {
    o.offset=Math.round(span-o.offset-o.width); o.hinge=o.hinge==="start"?"end":"start"; o.swing=-o.swing as 1|-1;
  }
  validateProject(next); return next;
}
function intersectLines(a:Point,b:Point,c:Point,d:Point):Point|null {
  const dx=b.x-a.x,dy=b.y-a.y,ex=d.x-c.x,ey=d.y-c.y,cross=dx*ey-dy*ex;
  if(Math.abs(cross)<1e-8) return null;
  const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/cross;
  return {x:a.x+t*dx,y:a.y+t*dy};
}
/** Offset a drawn reference chain; adjust shared corners in the same atomic command. */
export function addReferencedWall(p:Project,a:Point,b:Point,ref:WallReference,defaults:Pick<Wall,"height"|"thickness"|"material">,exterior:1|-1=-1) {
  if(ref==="centerline") return addWall(p,a,b,defaults);
  const span=length(a,b); if(span<inches(1)) throw new Error("Wall length must be at least one inch.");
  const d={x:(b.x-a.x)/span,y:(b.y-a.y)/span}, n={x:-d.y,y:d.x};
  const side=exterior*(ref==="exterior"?1:-1), offset=side*defaults.thickness/2;
  let ca={x:a.x-n.x*offset,y:a.y-n.y*offset}, cb={x:b.x-n.x*offset,y:b.y-n.y*offset};
  const changes:Record<string,Point>={};
  for(const [point,which] of [[a,"a"],[b,"b"]] as const) {
    for(const wall of p.floor.walls) {
      const segment=referenceSegment(p,wall,ref), index=segment.findIndex(pt=>length(pt,point)<=1);
      if(index<0) continue;
      const [wa,wb]=wallPoints(p,wall), intersection=intersectLines(ca,cb,wa,wb);
      const joint=intersection ?? {x:wallPoints(p,wall)[index].x,y:wallPoints(p,wall)[index].y};
      if(length(joint,point)>Math.max(defaults.thickness,wall.thickness)*8) throw new Error("Reference corner is too acute; use a centerline connection.");
      changes[wallPoints(p,wall)[index].id]=joint;
      if(which==="a") ca=joint; else cb=joint;
      break;
    }
  }
  const next=addWall(Object.keys(changes).length?editNodes(p,changes):p,ca,cb,defaults);
  next.floor.walls.at(-1)!.exteriorSide=exterior;
  return next;
}
