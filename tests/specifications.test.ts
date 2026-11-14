import browserFixture from "../examples/wall-room-specifications.studline.json";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Color } from "three";
import { addWall, clone, createProject, DEFAULT_WALL, deleteWall, length, rectangle, updateWall, validateProject, wallPoints, type Project } from "../src/core/model";
import { detectRooms, pointInRoom, updateRoom } from "../src/core/rooms";
import { applyWallSpecification, type WallSpecification } from "../src/core/specifications";
import { feet, inches } from "../src/core/units";
import { createWallGeometry } from "../src/core/mesh";
import { addReferencedWall, moveWall, reverseWall } from "../src/core/wallEditing";
import { addOpening } from "../src/core/openings";
import { deserialize, serialize, loadProject } from "../src/storage/projects";
import { useEditor } from "../src/state/store";
const rectangleRoom=()=>rectangle(createProject(),feet(20),feet(16));
const settings={name:"Kitchen",roomType:"Kitchen",showLabel:true,notes:"Island layout"};
function specification(p:Project):WallSpecification {
  const w=p.floor.walls[0];
  return {length:Math.round(length(...wallPoints(p,w))),height:w.height,thickness:w.thickness,wallType:"exterior",locked:false,anchor:"start",constrain:true,
    finishes:{interior:{kind:"paint",color:"#e8e1d3"},exterior:{kind:"siding",color:"#668394"}}};
}
function polygon(points:number[][]) {
  return points.reduce((p,a,i)=>addWall(p,{x:feet(a[0]),y:feet(a[1])},{x:feet(points[(i+1)%points.length][0]),y:feet(points[(i+1)%points.length][1])},DEFAULT_WALL),createProject());
}
describe("room specification and polygon selection",()=>{
  it("detects the interior rectangle and excludes wall thickness and exterior clicks",()=>{
    const [r]=detectRooms(rectangleRoom());
    expect(r.area).toBe(19.5*15.5);expect(r.perimeter).toBe(70);
    expect(pointInRoom({x:feet(10),y:feet(8)},r.boundary)).toBe(true);
    expect(pointInRoom({x:feet(10),y:0},r.boundary)).toBe(false);
    expect(pointInRoom({x:feet(21),y:feet(8)},r.boundary)).toBe(false);
  });
  it("selects a recessed polygon and places its label inside, not in its bounding-box recess",()=>{
    const p=polygon([[0,0],[20,0],[20,20],[14,20],[14,6],[6,6],[6,20],[0,20]]),[r]=detectRooms(p);
    expect(r.area).toBe(261.25);
    expect(pointInRoom({x:feet(10),y:feet(10)},r.boundary)).toBe(false);
    expect(pointInRoom(r.labelPoint,r.boundary)).toBe(true);
    expect(pointInRoom({x:feet(3),y:feet(10)},r.boundary)).toBe(true);
  });
  it("retains room identity, name, type and notes through connected wall resizing",()=>{
    const p=rectangleRoom(),[r]=detectRooms(p),named=updateRoom(p,r.key,settings);
    const resized=applyWallSpecification(named,p.floor.walls[0].id,{...specification(p),length:feet(24)}),[after]=detectRooms(resized);
    expect(after.key).toBe(r.key);expect(after.settings).toMatchObject(settings);
    expect(after.area).toBe(23.5*15.5);expect(p.floor.rooms).toBeUndefined();
  });
  it("keeps separate enclosure settings independent and ignores an unrelated open wall",()=>{
    let p=rectangle(rectangleRoom(),feet(10),feet(8),{x:feet(30),y:0});
    p=addWall(p,{x:feet(50),y:0},{x:feet(52),y:0},DEFAULT_WALL);
    const rooms=detectRooms(p);expect(rooms).toHaveLength(2);
    p=updateRoom(p,rooms[0].key,settings);p=updateRoom(p,rooms[1].key,{...settings,name:"Office",roomType:"Office"});
    expect(detectRooms(p).map(r=>r.settings?.name)).toEqual(["Kitchen","Office"]);
  });
  it("keeps settings dormant after a broken enclosure instead of relabeling another room",()=>{
    const p=rectangleRoom(),[r]=detectRooms(p),named=updateRoom(p,r.key,settings),broken=deleteWall(named,p.floor.walls[0].id);
    expect(detectRooms(broken)).toEqual([]);expect(broken.floor.rooms).toEqual(named.floor.rooms);
    expect(()=>validateProject(broken)).not.toThrow();expect(()=>updateRoom(broken,r.key,settings)).toThrow(/no longer enclosed/);
  });
  it("extracts two faces from a diagonal partition and rejects a self-crossing outline",()=>{
    const p=rectangleRoom(),[a]=wallPoints(p,p.floor.walls[0]),[,b]=wallPoints(p,p.floor.walls[1]);
    expect(detectRooms(addWall(p,a,b,DEFAULT_WALL))).toHaveLength(2);
    expect(detectRooms(polygon([[0,0],[10,10],[10,0],[0,10]]))).toEqual([]);
  });
  it("round trips metadata and old schema-2 geometry without a destructive migration",()=>{
    const old=rectangleRoom();expect(deserialize(serialize(old))).toEqual(old);
    let p=updateRoom(old,detectRooms(old)[0].key,{...settings,showLabel:false});
    p=applyWallSpecification(p,p.floor.walls[0].id,specification(p));
    expect(deserialize(serialize(p))).toEqual(p);
  });
  it.each(["", " ", "x".repeat(81)])("rejects invalid names without mutating the original (%s)",name=>{
    const p=rectangleRoom();expect(()=>updateRoom(p,detectRooms(p)[0].key,{...settings,name})).toThrow(/room settings/);expect(p.floor.rooms).toBeUndefined();
  });
  it("rejects duplicate metadata and invalid finish values in imported files",()=>{
    const p=rectangleRoom(),named=updateRoom(p,detectRooms(p)[0].key,settings),bad=clone(named);
    bad.floor.rooms!.push({...bad.floor.rooms![0],id:"other"});expect(()=>validateProject(bad)).toThrow(/Duplicate room/);
    const damaged=JSON.parse(serialize(p));damaged.floor.walls[0].finishes={interior:{kind:"paint",color:"red"},exterior:{kind:"siding",color:"#abcdef"}};
    expect(()=>deserialize(JSON.stringify(damaged))).toThrow(/surface finishes/);
  });
});
describe("wall specification transaction and render surfaces",()=>{
  it.each(["start","end","both"] as const)("anchors length at %s and keeps connected orthogonal walls",anchor=>{
    const p=rectangleRoom(),id=p.floor.walls[0].id,next=applyWallSpecification(p,id,{...specification(p),length:feet(24),anchor,thickness:inches(8)});
    const [a,b]=wallPoints(next,next.floor.walls[0]);
    expect(a.x).toBe(feet(anchor==="start"?0:anchor==="end"?-4:-2));expect(b.x-a.x).toBe(feet(24));
    expect(a.y).toBe(0);expect(b.y).toBe(0);expect(detectRooms(next)).toHaveLength(1);
    expect(next.floor.walls.every(w=>{const [a,b]=wallPoints(next,w);return a.x===b.x||a.y===b.y;})).toBe(true);
  });
  it("rejects a multi-field change atomically if it conflicts with a hosted opening",()=>{
    let p=rectangleRoom();p=addOpening(p,p.floor.walls[0].id,"door",feet(2));const before=clone(p);
    expect(()=>applyWallSpecification(p,p.floor.walls[0].id,{...specification(p),length:feet(24),height:feet(2)})).toThrow();expect(p).toEqual(before);
  });
  it("allows material changes on fixed walls but requires explicit unlocking for geometry",()=>{
    const initial=rectangleRoom(),p=updateWall(initial,initial.floor.walls[0].id,{locked:true});
    expect(applyWallSpecification(p,p.floor.walls[0].id,{...specification(p),locked:true}).floor.walls[0].finishes?.exterior.kind).toBe("siding");
    expect(()=>applyWallSpecification(p,p.floor.walls[0].id,{...specification(p),locked:true,length:feet(24)})).toThrow(/Fixed wall/);
    expect(detectRooms(applyWallSpecification(p,p.floor.walls[0].id,{...specification(p),locked:false,length:feet(24)}))).toHaveLength(1);
  });
  it("still respects a fixed adjacent wall",()=>{
    const initial=rectangleRoom(),p=updateWall(initial,initial.floor.walls[1].id,{locked:true});
    expect(()=>applyWallSpecification(p,p.floor.walls[0].id,{...specification(p),length:feet(24)})).toThrow(/Unlock/);
  });
  it("assigns different colors to the actual inner and outer mesh surfaces, including after direction reversal",()=>{
    let p=rectangleRoom();p=applyWallSpecification(p,p.floor.walls[0].id,specification(p));
    for(const project of [p,reverseWall(p,p.floor.walls[0].id)]) {
      const mesh=createWallGeometry(project,project.floor.walls[0]),normals=mesh.getAttribute("normal"),colors=mesh.getAttribute("color");
      let inner=0,outer=0;
      for(let i=0;i<normals.count;i++) {
        if(Math.abs(normals.getY(i))<.99) continue;
        const expected=new Color(normals.getY(i)>0?"#668394":"#e8e1d3");
        expect(colors.getX(i)).toBeCloseTo(expected.r,6);expect(colors.getY(i)).toBeCloseTo(expected.g,6);expect(colors.getZ(i)).toBeCloseTo(expected.b,6);
        if(normals.getY(i)>0)outer++;else inner++;
      }
      expect(inner).toBeGreaterThan(0);expect(outer).toBeGreaterThan(0);mesh.dispose();
    }
  });
  it("pins the physical exterior side when assigning finishes so opening a loop cannot flip it",()=>{
    let p=polygon([[0,0],[0,10],[10,10],[10,0]]);p=applyWallSpecification(p,p.floor.walls[0].id,specification(p));
    const side=p.floor.walls[0].exteriorSide;expect(side).toBe(1);
    const broken=deleteWall(p,p.floor.walls[2].id);expect(broken.floor.walls[0].exteriorSide).toBe(side);
  });
});
describe("editor persistence and undo for specifications",()=>{
  beforeEach(()=>{const data=new Map<string,string>();vi.stubGlobal("localStorage",{get length(){return data.size;},key:(i:number)=>[...data.keys()][i],getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)});useEditor.getState().replace(rectangleRoom());});
  afterEach(()=>vi.unstubAllGlobals());
  it("draws adjoining rooms, retains a hosted door, and undoes and reopens the edit", () => {
    const editor = useEditor.getState;
    let p = editor().project;
    const host = p.floor.walls[0];
    p = addOpening(p, host.id, "door", feet(13));
    const original = detectRooms(p)[0];
    p = updateRoom(p, original.key, settings);
    const roomId = p.floor.rooms![0].id;
    editor().replace(p);

    const addPartition = (x: number) => addReferencedWall(p, { x: feet(x), y: 0 },
      { x: feet(x), y: feet(16) }, "centerline", DEFAULT_WALL);
    expect(editor().commit(addPartition(14), "Draw wall")).toBe(false);
    expect(editor().notice).toMatch(/cut through a door/);
    expect(editor().project).toEqual(p);
    expect(editor().commit(addPartition(10), "Draw wall")).toBe(true);
    const divided = editor().project;
    expect(divided.floor.walls).toHaveLength(7);
    const rooms = detectRooms(divided);
    expect(rooms).toHaveLength(2);
    expect(rooms.map(r => r.area)).toEqual([9.5 * 15.5, 9.5 * 15.5]);
    expect(rooms.filter(r => r.settings?.id === roomId)).toHaveLength(1);
    const [door] = divided.floor.openings;
    expect(door.id).toBe(p.floor.openings[0].id);
    expect(door.wallId).not.toBe(host.id);
    expect(door.offset + divided.floor.nodes.find(n =>
      n.id === divided.floor.walls.find(w => w.id === door.wallId)!.start)!.x).toBe(feet(13));

    const partitionId = divided.floor.walls.at(-1)!.id;
    const other = rooms.find(room => !room.settings)!;
    expect(editor().commit(updateRoom(divided, other.key, { ...settings, name: "Office" }), "Name room")).toBe(true);
    const named = editor().project;
    expect(editor().commit(moveWall(named, partitionId, { x: feet(2), y: 0 }, true, true), "Move wall")).toBe(true);
    const moved = editor().project;
    const movedRooms = detectRooms(moved);
    expect(movedRooms.map(r => r.settings?.id)).toEqual(detectRooms(named).map(r => r.settings?.id));
    const movedDoor = moved.floor.openings[0];
    expect(movedDoor.offset + wallPoints(moved, moved.floor.walls.find(w => w.id === movedDoor.wallId)!)[0].x).toBe(feet(13));
    expect(editor().commit(deleteWall(moved, partitionId), "Delete wall")).toBe(true);
    expect(detectRooms(editor().project).filter(r => r.settings)).toHaveLength(1);
    editor().undo();
    expect(editor().project).toEqual(moved);
    editor().undo();
    expect(editor().project).toEqual(named);
    editor().redo();
    expect(detectRooms(deserialize(serialize(loadProject(p.id).project))).map(r => r.settings?.name).sort())
      .toEqual(["Kitchen", "Office"]);
  });
  it("autosaves, undoes, redoes and reopens room settings and wall finishes together",()=>{
    const p=useEditor.getState().project;
    useEditor.getState().commit(updateRoom(p,detectRooms(p)[0].key,settings),"Name room");
    useEditor.getState().commit(applyWallSpecification(useEditor.getState().project,p.floor.walls[0].id,specification(p)),"Wall materials");
    const saved=useEditor.getState().project;expect(loadProject(p.id).project).toEqual(saved);
    useEditor.getState().undo();expect(useEditor.getState().project.floor.walls[0].finishes).toBeUndefined();expect(detectRooms(useEditor.getState().project)[0].settings?.name).toBe("Kitchen");
    useEditor.getState().redo();expect(useEditor.getState().project).toEqual(saved);
    useEditor.getState().set({specification:{kind:"wall",id:p.floor.walls[0].id}});
    useEditor.getState().replace(createProject());expect(useEditor.getState().specification).toBeNull();
    useEditor.getState().replace(loadProject(p.id).project);expect(useEditor.getState().project).toEqual(saved);
  });
});

it("reopens the actual v0.4 browser-exported irregular plan with room and surface metadata intact",()=>{
  const p=deserialize(JSON.stringify(browserFixture));
  expect(p.floor.walls).toHaveLength(6);expect(p.floor.openings).toHaveLength(1);
  expect(length(...wallPoints(p,p.floor.walls[0]))).toBe(feet(24));expect(p.floor.walls[0].thickness).toBe(inches(8));
  expect(p.floor.walls[0].finishes).toEqual(specification(p).finishes);
  const [r]=detectRooms(p);expect(r.settings?.name).toBe("Living / dining");expect(r.settings?.notes).toBe("L-shaped family space.");
  expect(r.area).toBeCloseTo(232.0416667,5);
});

it("infers finish sides per enclosure even with opposite winding and unrelated walls",()=>{
  const first=polygon([[0,0],[0,10],[10,10],[10,0]]);
  let p=rectangle(first,feet(10),feet(8),{x:feet(30),y:0});
  p=addWall(p,{x:feet(60),y:0},{x:feet(65),y:0},DEFAULT_WALL);
  const next=applyWallSpecification(p,p.floor.walls[0].id,specification(p));
  expect(next.floor.walls[0].exteriorSide).toBe(1);
  expect(detectRooms(next)).toHaveLength(2);
});

it("normalizes compatible overlaps on an L-shaped shell and X-crossing partitions", () => {
  const first = polygon([[0,0],[20,0],[20,10],[10,10],[10,20],[0,20]]);
  useEditor.getState().replace(first, false);
  const overlap = addWall(first, {x:0,y:0}, {x:feet(15),y:0}, DEFAULT_WALL);
  expect(useEditor.getState().commit(overlap, "Overlap")).toBe(true);
  const normalized = useEditor.getState().project;
  expect(normalized.floor.walls).toHaveLength(7);
  const addPartition = (p: Project, a: [number, number], b: [number, number]) =>
    addWall(p, {x:feet(a[0]),y:feet(a[1])}, {x:feet(b[0]),y:feet(b[1])}, DEFAULT_WALL);
  const divided = addPartition(normalized, [0,5], [20,5]);
  expect(detectRooms(divided)).toHaveLength(2);
  expect(detectRooms(addPartition(divided, [5,0], [5,20]))).toHaveLength(4);
});
