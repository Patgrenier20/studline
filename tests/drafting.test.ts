import { describe, expect, it } from "vitest";
import { addWall, createProject, DEFAULT_WALL, editNodes, length, wallPoints } from "../src/core/model";
import { enclosedArea } from "../src/core/geometry";
import { draftPoint, openEndpoints, snapWallJoin, pointAtHeading, wheelZoomFactor, zoomAt } from "../src/core/drafting";
import { feet, inches, FT } from "../src/core/units";

describe("recording regression: precise L-shaped drafting", () => {
  it("aligns the return leg to the original X coordinate, then closes orthogonally", () => {
    // Recording: missed closure by 6 in at 27 px/ft. Inference must prevent that return-leg error.
    let p = createProject();
    const points = [{x:0,y:0},{x:feet(30),y:0},{x:feet(30),y:feet(18)},
      {x:feet(13),y:feet(18)},{x:feet(13),y:feet(12)}];
    for(let i=1;i<points.length;i++) p=addWall(p,points[i-1],points[i],DEFAULT_WALL);
    const tolerance = 18 / (27 / FT);
    const returned = draftPoint({x:-inches(6),y:feet(12)},p,inches(6),tolerance,true,points[4],true);
    expect(returned.kind).toBe("alignment");
    expect(returned.point).toEqual({x:0,y:feet(12)});
    expect(returned.guide).toEqual({from:expect.objectContaining({x:0,y:0}),to:returned.point});
    p=addWall(p,points[4],returned.point,DEFAULT_WALL);
    const close = draftPoint({x:inches(4),y:inches(3)},p,inches(6),tolerance,true,returned.point,true);
    expect(close.kind).toBe("endpoint"); expect(close.point).toEqual({x:0,y:0});
    p=addWall(p,returned.point,close.point,DEFAULT_WALL);
    expect(p.floor.nodes).toHaveLength(6); expect(openEndpoints(p)).toHaveLength(0);
    expect(enclosedArea(p)).toBe(30*18-13*6);
    for(const w of p.floor.walls) { const [a,b]=wallPoints(p,w); expect(a.x===b.x||a.y===b.y).toBe(true); }
  });
  it("never turns an orthogonal wall diagonal merely to acquire a nearby endpoint", () => {
    const p=addWall(createProject(),{x:0,y:0},{x:feet(10),y:0},DEFAULT_WALL);
    const base={x:-inches(6),y:feet(12)}, cursor={x:0,y:0};
    const ortho=draftPoint(cursor,p,inches(6),inches(10),true,base,true);
    expect(ortho.point.x).toBe(base.x); expect(ortho.kind).not.toBe("endpoint");
    const free=draftPoint(cursor,p,inches(6),inches(10),true,base,false);
    expect(free.point).toEqual(cursor); expect(free.kind).toBe("endpoint");
  });
  it("snaps an off-grid shared endpoint before grid rounding", () => {
    const p=addWall(createProject(),{x:0,y:1},{x:feet(10)+1,y:1},DEFAULT_WALL);
    const snap=draftPoint({x:feet(10)+10,y:feet(5)},p,inches(6),30,true,{x:0,y:1},true);
    expect(snap.point).toEqual({x:feet(10)+1,y:1}); expect(snap.kind).toBe("endpoint");
  });
  it("respects snap-off, excluded moving nodes and distant geometry", () => {
    const p=addWall(createProject(),{x:0,y:0},{x:feet(10),y:0},DEFAULT_WALL);
    const raw={x:feet(10)+7.2,y:feet(3)},base={x:0,y:0};
    const free=draftPoint(raw,p,inches(6),20,false,base,true);
    expect(free).toEqual({point:{x:feet(10)+7,y:0},kind:"none"});
    const excluded=draftPoint(raw,p,inches(6),20,true,base,true,p.floor.nodes.map(n=>n.id));
    expect(excluded.kind).toBe("grid");
    const distant=draftPoint({x:feet(8),y:1},p,inches(6),20,true,base,true);
    expect(distant.kind).toBe("grid"); expect(distant.point.x).toBe(feet(8));
  });
  it("marks a visually near-closed outline as open until its junctions are welded", () => {
    let p=createProject(); const pts=[{x:0,y:0},{x:feet(20),y:0},{x:feet(20),y:feet(16)},{x:0,y:feet(16)},{x:0,y:inches(6)}];
    for(let i=1;i<pts.length;i++) p=addWall(p,pts[i-1],pts[i],DEFAULT_WALL);
    expect(openEndpoints(p)).toHaveLength(2); expect(enclosedArea(p)).toBeNull();
    const end=p.floor.nodes.at(-1)!;
    const welded=editNodes(p,{[end.id]:{x:0,y:0}});
    expect(openEndpoints(welded)).toHaveLength(0); expect(enclosedArea(welded)).toBe(320);
  });
  it("creates an exact rectangle using typed fractional lengths and cardinal headings", () => {
    let p=createProject(),start={x:0,y:0};
    const width=feet(20)+inches(3.0625),depth=feet(16)+inches(0.5);
    for(const [size,heading] of [[width,0],[depth,90],[width,180],[depth,270]]) {
      const end=pointAtHeading(start,size,heading);p=addWall(p,start,end,DEFAULT_WALL);start=end;
    }
    expect(start).toEqual({x:0,y:0}); expect(p.floor.nodes).toHaveLength(4);
    expect(p.floor.walls.map(w=>length(...wallPoints(p,w)))).toEqual([width,depth,width,depth]);
  });
  it("supports deliberate non-orthogonal headings with at most half-tick axis quantization", () => {
    const point=pointAtHeading({x:1,y:-1},feet(12),37);
    expect(Math.abs(point.x-(1+feet(12)*Math.cos(37*Math.PI/180)))).toBeLessThanOrEqual(.5);
    expect(Math.abs(point.y-(-1+feet(12)*Math.sin(37*Math.PI/180)))).toBeLessThanOrEqual(.5);
    expect(()=>pointAtHeading({x:0,y:0},0,0)).toThrow();
    expect(()=>pointAtHeading({x:0,y:0},FT,NaN)).toThrow();
  });
});

describe("cursor-centered navigation", () => {
  it.each([0,1,2])("bounds even large wheel deltas in mode %i", mode => {
    const out=wheelZoomFactor(10000,mode), inside=wheelZoomFactor(-10000,mode);
    expect(out).toBeGreaterThan(.8); expect(inside).toBeLessThan(1.2);
    expect(out*inside).toBeCloseTo(1,12);
  });
  it("normalizes line deltas and preserves small trackpad motion", () => {
    expect(wheelZoomFactor(2,1)).toBe(wheelZoomFactor(32,0));
    expect(wheelZoomFactor(1,0)).toBeGreaterThan(wheelZoomFactor(20,0));
    expect(wheelZoomFactor(0,0)).toBe(1);
  });
  it("keeps the world point beneath the cursor stable, including zoom limits", () => {
    const cam={x:-400,y:230,scale:.04},screen={x:450,y:200};
    for(const factor of [1.2,.8,1e10,1e-10]) {
      const next=zoomAt(cam,factor,screen);
      expect(next.x+screen.x/next.scale).toBeCloseTo(cam.x+screen.x/cam.scale,8);
      expect(next.y+screen.y/next.scale).toBeCloseTo(cam.y+screen.y/cam.scale,8);
      expect(next.scale).toBeGreaterThanOrEqual(.003);expect(next.scale).toBeLessThanOrEqual(.5);
    }
  });
});

it("snaps a partition to wall centerlines without breaking orthogonal drawing", () => {
  const p = addWall(createProject(), { x: 0, y: 0 }, { x: feet(20), y: 0 }, DEFAULT_WALL);
  const base = { x: feet(9.25), y: feet(12) };
  const cursor = { x: feet(9.4), y: inches(2) };
  expect(snapWallJoin(cursor, p, inches(4), null, true)).toEqual({ x: cursor.x, y: 0 });
  expect(snapWallJoin(cursor, p, inches(4), base, true)).toEqual({ x: base.x, y: 0 });
});
