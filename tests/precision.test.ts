import { describe, expect, it } from "vitest";
import { addWall, createProject, DEFAULT_WALL, editNodes, length, rectangle, updateWall, wallPoints } from "../src/core/model";
import { enclosedArea, interiorArea, segmentsIntersect } from "../src/core/geometry";
import { feet, inches, parseImperial } from "../src/core/units";
import { addReferencedWall, changeThickness, constrainedNodes, hitWallReference, moveWall, referenceSegment, resizeReference, reverseWall, rotateWall } from "../src/core/wallEditing";
import { createWallGeometry } from "../src/core/mesh";
import { addOpening } from "../src/core/openings";
import { deserialize, serialize } from "../src/storage/projects";
import { execute, emptyHistory, undo, redo } from "../src/core/history";

const room=()=>rectangle(createProject(),feet(24),feet(18));
function recessed() {
  const points=[[0,0],[29.5,0],[29.5,15],[20,15],[20,7.5],[12.5,7.5],[12.5,15],[0,15]];
  return points.reduce((p,pt,i)=>addWall(p,{x:feet(pt[0]),y:feet(pt[1])},{x:feet(points[(i+1)%points.length][0]),y:feet(points[(i+1)%points.length][1])},DEFAULT_WALL),createProject());
}
describe("recording geometry regression",()=>{
  it("recognizes the exact eight-wall recessed recording outline, including separated collinear runs",()=>{
    expect(segmentsIntersect({x:0,y:0},{x:5,y:0},{x:8,y:0},{x:10,y:0})).toBe(false);
    expect(enclosedArea(recessed())).toBe(386.25);
    expect(interiorArea(recessed())).toBe(360.5);
  });
  it("continues to reject crossing and overlapping boundaries",()=>{
    expect(segmentsIntersect({x:0,y:0},{x:5,y:0},{x:3,y:0},{x:10,y:0})).toBe(true);
    const p=room(), n=p.floor.nodes;
    const crossed=editNodes(p,{[n[1].id]:{x:feet(24),y:feet(18)},[n[2].id]:{x:feet(24),y:0}});
    expect(enclosedArea(crossed)).toBeNull(); expect(interiorArea(crossed)).toBeNull();
  });
  it("reports actual interior face area and keeps centerline area separately",()=>{
    expect(enclosedArea(room())).toBe(432); expect(interiorArea(room())).toBe(411.25);
  });
});
describe("wall reference geometry",()=>{
  it("measures exterior, center and interior faces at actual miter endpoints",()=>{
    const p=room(), w=p.floor.walls[0];
    expect(length(...referenceSegment(p,w,"exterior"))).toBe(feet(24.5));
    expect(length(...referenceSegment(p,w,"centerline"))).toBe(feet(24));
    expect(length(...referenceSegment(p,w,"interior"))).toBe(feet(23.5));
  });
  it.each([0.01,0.04,0.3])("uses screen tolerance for acquisition, exact face coordinates at scale %s",scale=>{
    const p=room(), w=p.floor.walls[0];
    for(const ref of ["exterior","centerline","interior"] as const) {
      const [a,b]=referenceSegment(p,w,ref), point={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      const hit=hitWallReference(p,{x:point.x,y:point.y+1/scale},12/scale,ref,false)!;
      expect(hit.reference).toBe(ref); expect(hit.point).toEqual(point);
    }
  });
  it.each(["exterior","centerline","interior"] as const)("preserves selected %s supporting plane on thickness edits",ref=>{
    const p=room(), w=p.floor.walls[0], before=referenceSegment(p,w,ref);
    const next=changeThickness(p,w.id,inches(10),ref,true);
    expect(referenceSegment(next,next.floor.walls[0],ref)[0].y).toBe(before[0].y);
    expect(next.floor.walls[0].thickness).toBe(inches(10));
  });
  it("preserves physical faces, apertures and door swing when reversing wall direction",()=>{
    let p=room(); p=addOpening(p,p.floor.walls[0].id,"door",feet(2));
    const w=p.floor.walls[0], before=referenceSegment(p,w,"exterior"), next=reverseWall(p,w.id);
    expect(referenceSegment(next,next.floor.walls[0],"exterior")).toEqual([...before].reverse());
    expect(next.floor.openings[0]).toMatchObject({offset:feet(19),hinge:"end",swing:-1});
    expect(reverseWall(next,w.id).floor.openings).toEqual(p.floor.openings);
    expect(deserialize(serialize(next))).toEqual(next);
  });
  it.each(["exterior","interior"] as const)("draws an exact connected rectangle along its %s reference",ref=>{
    const pts=[[0,0],[12.5,0],[12.5,10],[0,10]];
    const p=pts.reduce((p,a,i)=>addReferencedWall(p,{x:feet(a[0]),y:feet(a[1])},{x:feet(pts[(i+1)%4][0]),y:feet(pts[(i+1)%4][1])},ref,DEFAULT_WALL),createProject());
    expect(p.floor.nodes).toHaveLength(4);
    expect(length(...referenceSegment(p,p.floor.walls[0],ref))).toBe(feet(12.5));
    expect(enclosedArea(p)).not.toBeNull();
  });
});
describe("explicit editing constraints",()=>{
  it("moves a body normally without the recorded sideways skew",()=>{
    const p=room(), w=p.floor.walls[0];
    const next=moveWall(p,w.id,{x:feet(10),y:feet(1)},true,true);
    const [a,b]=wallPoints(next,w);
    expect(a).toMatchObject({x:0,y:feet(1)}); expect(b).toMatchObject({x:feet(24),y:feet(1)});
    expect(enclosedArea(next)).toBe(408);
  });
  it("allows intentional free translation and independent endpoint changes",()=>{
    const p=room(), w=p.floor.walls[0], [a,b]=wallPoints(p,w);
    const moved=moveWall(p,w.id,{x:feet(5),y:0},false,false);
    expect(wallPoints(moved,w)[0].x).toBe(feet(5)); expect(enclosedArea(moved)).toBe(432);
    const free=constrainedNodes(p,{[b.id]:{x:feet(26),y:feet(1)}},false);
    expect(wallPoints(free,w)[0]).toEqual(a); expect(wallPoints(free,w)[1].y).toBe(feet(1));
  });
  it.each(["start","end","both"] as const)("resizes a face dimension with %s fixed/distributed and preserves rectangle corners",anchor=>{
    const p=room(), w=p.floor.walls[0];
    const next=resizeReference(p,w.id,feet(26.5),"exterior",anchor,true);
    expect(length(...referenceSegment(next,w,"exterior"))).toBe(feet(26.5));
    const [a,b]=wallPoints(next,w);
    expect(a.x).toBe(feet(anchor==="start"?0:anchor==="end"?-2:-1));
    expect(b.x).toBe(feet(anchor==="end"?24:anchor==="start"?26:25));
    expect(next.floor.walls.every(w=>{const [c,d]=wallPoints(next,w);return c.x===d.x||c.y===d.y;})).toBe(true);
  });
  it("rotates intentionally, retains length, and restores edits through undo/redo",()=>{
    const p=room(), w=p.floor.walls[0], next=rotateWall(p,w.id,30);
    expect(length(...wallPoints(next,w))).toBeCloseTo(feet(24),0);
    const command=execute(emptyHistory(),p,next,"Rotate");
    expect(undo(command.history)!.project).toEqual(p);
    expect(redo(undo(command.history)!.history)!.project).toEqual(command.project);
  });
  it("rejects movement of a locked wall through its shared neighbor",()=>{
    const p=room(), locked=updateWall(p,p.floor.walls[1].id,{locked:true});
    expect(()=>moveWall(locked,p.floor.walls[0].id,{x:0,y:feet(1)},true,true)).toThrow(/Unlock/);
    expect(()=>changeThickness(locked,p.floor.walls[1].id,inches(8),"centerline",true)).toThrow(/Unlock/);
    expect(updateWall(locked,p.floor.walls[1].id,{material:"#abcdef"}).floor.walls[1].material).toBe("#abcdef");
  });
});
describe("direct measurement input",()=>{
  it.each([["12' 6\"",feet(12.5)],["12.5 ft",feet(12.5)],["150in",feet(12.5)],["3.81m",feet(12.5)],["381cm",feet(12.5)],["3810 mm",feet(12.5)],["6 1/16 in",inches(6.0625)]])("parses %s into exact model ticks",(input,ticks)=>expect(parseImperial(String(input))).toBe(ticks));
  it.each(["NaN m","1/0 in","3m nonsense","Infinity","999999999m"])("rejects invalid dimension %s",input=>expect(()=>parseImperial(input)).toThrow());
});


describe("canonical model compatibility",()=>{
  it("regenerates actual mesh bounds after anchored face, thickness and height edits",()=>{
    let p=room(); const id=p.floor.walls[0].id;
    p=changeThickness(p,id,inches(10),"exterior",true);
    p=resizeReference(p,id,feet(28.5),"exterior","start",true);
    p=updateWall(p,id,{height:feet(10),wallType:"exterior",locked:true});
    const loaded=deserialize(serialize(p)), wall=loaded.floor.walls[0];
    expect(loaded).toEqual(p);
    const mesh=createWallGeometry(loaded,wall);mesh.computeBoundingBox();
    const box=mesh.boundingBox!;
    expect(box.max.x-box.min.x).toBeCloseTo(28.5,5);
    expect(box.max.y-box.min.y).toBeCloseTo(10/12,5);
    expect(box.max.z).toBe(10);mesh.dispose();
  });
  it("keeps existing schema-2 files valid without new optional wall metadata",()=>{
    const p=room(); expect(p.floor.walls[0].locked).toBeUndefined();
    expect(deserialize(serialize(p))).toEqual(p);
  });
  it("keeps an angled simple enclosure polygonal, rather than using its bounding box",()=>{
    const pts=[[0,0],[20,0],[16,12],[0,12]];
    const p=pts.reduce((p,a,i)=>addWall(p,{x:feet(a[0]),y:feet(a[1])},{x:feet(pts[(i+1)%4][0]),y:feet(pts[(i+1)%4][1])},DEFAULT_WALL),createProject());
    expect(enclosedArea(p)).toBe(216);
    expect(interiorArea(p)).toBeGreaterThan(195);expect(interiorArea(p)).toBeLessThan(216);
  });
});
