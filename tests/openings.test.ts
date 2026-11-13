import { describe, expect, it } from "vitest";
import { BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { addWall, clone, createProject, DEFAULT_WALL, deleteWall, editNodes, length, rectangle, resizeWall, updateWall, validateProject, wallPoints, type Opening, type Project } from "../src/core/model";
import { addOpening, deleteOpening, openingRange, updateOpening, wallPlanPolygons, wallSolids, wallStation } from "../src/core/openings";
import { createWallGeometry } from "../src/core/mesh";
import { wallFootprint } from "../src/core/geometry";
import { feet, FT, inches } from "../src/core/units";
import { deserialize, importProject, loadProject, saveProject, serialize, type StoragePort } from "../src/storage/projects";
import { emptyHistory, execute, redo, undo } from "../src/core/history";

function room() { return rectangle(createProject("Opening regression"), feet(20), feet(16)); }
function doorProject() { const p = room(); return addOpening(p, p.floor.walls[0].id, "door", feet(2)); }
function both() { const p = doorProject(); return addOpening(p, p.floor.walls[0].id, "window", feet(10)); }
function volume(geometry: BufferGeometry) {
  const position = geometry.getAttribute("position");
  let result = 0;
  for (let i = 0; i < position.count; i += 3) {
    const a = new Vector3().fromBufferAttribute(position, i);
    const b = new Vector3().fromBufferAttribute(position, i + 1);
    const c = new Vector3().fromBufferAttribute(position, i + 2);
    result += a.dot(b.cross(c)) / 6;
  }
  return Math.abs(result);
}
function hits(p: Project, stationFeet: number, heightFeet: number) {
  const wall = p.floor.walls[0], [a, b] = wallPoints(p, wall), size = length(a,b);
  const dx = (b.x - a.x) / size, dy = (b.y - a.y) / size;
  const x = a.x / FT + dx * stationFeet, y = a.y / FT + dy * stationFeet;
  const geometry = createWallGeometry(p, wall), material = new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new Mesh(geometry, material);
  const ray = new Raycaster(new Vector3(x + dy * 5, -y + dx * 5, heightFeet), new Vector3(-dy, -dx, 0));
  const result = ray.intersectObject(mesh).length > 0;
  geometry.dispose(); material.dispose();
  return result;
}
function memory(): StoragePort {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, key: i => [...data.keys()][i] || null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
}

describe("hosted component model", () => {
  it("creates validated doors/windows without mutating the source or replacing host identities", () => {
    const p = room(), next = addOpening(p, p.floor.walls[0].id, "door", feet(2));
    expect(p.floor.openings).toEqual([]);
    expect(next.floor.walls).toEqual(p.floor.walls);
    expect(next.floor.nodes).toEqual(p.floor.nodes);
    expect(next.floor.openings[0]).toMatchObject({ wallId: p.floor.walls[0].id, width: inches(36), height: inches(80), sill: 0 });
    expect(() => validateProject(both())).not.toThrow();
  });
  it("edits fractional dimensions, sill, offset, and both door orientation controls exactly", () => {
    const p = both(), [d,w] = p.floor.openings;
    let next = updateOpening(p, w.id, { width: inches(32.0625), height: inches(44.5), sill: inches(30.25), offset: feet(11) + 1 });
    next = updateOpening(next, d.id, { hinge: "end", swing: -1 });
    expect(next.floor.openings[1]).toMatchObject({ width: 2052, height: 2848, sill: 1936, offset: 8449 });
    expect(next.floor.openings[0]).toMatchObject({ id: d.id, hinge: "end", swing: -1 });
  });
  it.each([
    { width: 0 }, { width: -1 }, { width: 5.5 }, { offset: NaN }, { offset: Infinity },
    { offset: -10 }, { offset: feet(19) }, { height: 0 }, { height: feet(10) }, { sill: -1 },
  ])("rejects invalid opening dimensions %j", changes => {
    const p = both(), before = serialize(p);
    expect(() => updateOpening(p, p.floor.openings[1].id, changes)).toThrow();
    expect(serialize(p)).toBe(before);
  });
  it("rejects floor-offset doors, absent hosts, duplicate IDs and malformed variants", () => {
    const p = doorProject(), id = p.floor.openings[0].id;
    expect(() => updateOpening(p, id, { sill: inches(1) })).toThrow(/floor level/);
    expect(() => addOpening(p, "absent", "door", feet(2))).toThrow(/existing wall/);
    expect(() => updateOpening(p, "absent", { width: feet(2) })).toThrow(/no longer/);
    for (const changes of [{ id: p.floor.walls[0].id }, { kind: "arch" }, { hinge: "bad" }, { swing: 0 }, { width: "36" }]) {
      const bad = clone(p); Object.assign(bad.floor.openings[0], changes);
      expect(() => validateProject(bad)).toThrow();
    }
    const duplicate = clone(p); duplicate.floor.openings.push(clone(duplicate.floor.openings[0]));
    expect(() => validateProject(duplicate)).toThrow(/duplicate/);
  });
  it("enforces one-inch separation and header material without claiming structural design", () => {
    const p = doorProject(), id = p.floor.walls[0].id;
    expect(() => addOpening(p, id, "window", feet(5))).toThrow(/overlap/);
    expect(() => addOpening(p, id, "window", feet(5) + inches(1) - 1)).toThrow(/overlap/);
    expect(() => addOpening(p, id, "window", feet(5) + inches(1))).not.toThrow();
    expect(() => updateOpening(p, p.floor.openings[0].id, { height: feet(9) - inches(1) })).not.toThrow();
    expect(() => updateOpening(p, p.floor.openings[0].id, { height: feet(9) })).toThrow(/above/);
  });
  it("reserves miter corners for unequal thicknesses and rejects one-tick encroachments", () => {
    let p = room(); p = updateWall(p, p.floor.walls[1].id, { thickness: inches(12) });
    const wall = p.floor.walls[0], range = openingRange(p, wall);
    expect(range.min).toBe(inches(4)); expect(range.max).toBe(feet(20) - inches(7));
    expect(() => addOpening(p, wall.id, "door", range.min - 1)).toThrow(/joins/);
    expect(() => addOpening(p, wall.id, "door", range.min)).not.toThrow();
    expect(() => addOpening(p, wall.id, "door", range.max - inches(36))).not.toThrow();
    expect(() => addOpening(p, wall.id, "door", range.max - inches(36) + 1)).toThrow(/joins/);
  });
  it("keeps openings attached through wall translations, rotations and non-destructive resizing", () => {
    const p = doorProject(), wall = p.floor.walls[0], [a,b] = wallPoints(p, wall);
    const moved = editNodes(p, { [a.id]: { x: feet(1), y: feet(2) }, [b.id]: { x: feet(13), y: feet(18) } });
    expect(moved.floor.openings).toEqual(p.floor.openings);
    expect(length(...wallPoints(moved, wall))).toBe(feet(20));
    expect(hits(moved, 3, 4)).toBe(false);
    expect(hits(moved, 7, 4)).toBe(true);
    const extended = resizeWall(p, wall.id, feet(22));
    expect(extended.floor.openings).toEqual(p.floor.openings);
  });
  it("blocks host edits that would truncate openings and leaves the original project intact", () => {
    const p = both(), before = serialize(p), wall = p.floor.walls[0];
    expect(() => resizeWall(p, wall.id, feet(11))).toThrow(/fit/);
    expect(() => updateWall(p, wall.id, { height: feet(6) })).toThrow(/above/);
    expect(serialize(p)).toBe(before);
  });
  it("deletes hosted objects with their wall and restores the complete model through undo/redo", () => {
    const p = both(), command = execute(emptyHistory(), p, deleteWall(p, p.floor.walls[0].id), "Delete host");
    expect(command.project.floor.openings).toHaveLength(0);
    const restored = undo(command.history)!;
    expect(restored.project).toEqual(p);
    expect(redo(restored.history)!.project).toEqual(command.project);
    expect(deleteOpening(p, p.floor.openings[0].id).floor.openings).toHaveLength(1);
    expect(deleteOpening(p, p.floor.openings[0].id).floor.walls).toEqual(p.floor.walls);
  });
});

describe("shared plan and 3D aperture geometry", () => {
  it("removes actual wall volume for door and window apertures", () => {
    const p = both(), mesh = createWallGeometry(p, p.floor.walls[0]);
    expect(volume(mesh)).toBeCloseTo(20 * 0.5 * 9 - 3 * 0.5 * (80/12) - 3 * 0.5 * 4, 4);
    mesh.computeBoundingBox();
    expect(mesh.boundingBox!.max.z).toBe(9);
    expect(mesh.boundingBox!.min.z).toBe(0);
    expect(Array.from(mesh.getAttribute("position").array).every(Number.isFinite)).toBe(true);
    mesh.dispose();
  });
  it("passes rays through apertures while retaining jambs, sills and headers", () => {
    const p = both();
    expect(hits(p, 3, 4)).toBe(false);
    expect(hits(p, 3, 0.1)).toBe(false);
    expect(hits(p, 11, 4)).toBe(false);
    expect(hits(p, 11, 2)).toBe(true);
    expect(hits(p, 11, 8)).toBe(true);
    expect(hits(p, 3, 8)).toBe(true);
    expect(hits(p, 1, 4)).toBe(true);
    expect(hits(p, 7, 4)).toBe(true);
  });
  it("uses the same host-relative stations for angled and reversed walls", () => {
    for (const [a,b] of [[{x: 0,y: 0}, {x: feet(12),y: feet(16)}], [{x: feet(20),y: feet(2)}, {x: 0,y: feet(2)}]]) {
      let p = addWall(createProject(), a,b, DEFAULT_WALL);
      p = addOpening(p, p.floor.walls[0].id, "window", feet(4));
      expect(hits(p, 5, 4)).toBe(false);
      expect(hits(p, 5, 2)).toBe(true);
      expect(hits(p, 10, 4)).toBe(true);
    }
  });
  it("updates both plan gaps and mesh apertures when an opening moves or is deleted", () => {
    const p = doorProject(), w = p.floor.walls[0], o = p.floor.openings[0];
    const moved = updateOpening(p, o.id, { offset: feet(7), width: feet(4) });
    expect(hits(moved, 3, 4)).toBe(true); expect(hits(moved, 8, 4)).toBe(false);
    const polygons = wallPlanPolygons(moved, w);
    expect(polygons).toHaveLength(2);
    expect(Math.max(...polygons[0].map(pt => wallStation(moved, w, pt)))).toBe(feet(7));
    expect(Math.min(...polygons[1].map(pt => wallStation(moved, w, pt)))).toBe(feet(11));
    const removed = deleteOpening(moved, o.id);
    expect(wallPlanPolygons(removed, w)).toEqual([wallFootprint(removed,w)]);
    expect(hits(removed,8,4)).toBe(true);
  });
  it("retains outer miter geometry while only subdividing the opening's host", () => {
    const p = room(), next = addOpening(p,p.floor.walls[0].id,"door",feet(2)), w = p.floor.walls[0];
    const solids = wallSolids(next,w), footprint = wallFootprint(p,w);
    expect(solids[0].footprint).toContainEqual(footprint[0]);
    expect(solids[0].footprint).toContainEqual(footprint[3]);
    expect(solids.at(-1)!.footprint).toContainEqual(footprint[1]);
    expect(solids.at(-1)!.footprint).toContainEqual(footprint[2]);
    for (const neighbor of p.floor.walls.slice(1)) expect(wallSolids(next, neighbor)).toEqual(wallSolids(p, neighbor));
  });
});

describe("compatible project persistence", () => {
  it("migrates schema 1 without changing original IDs, dimensions, timestamps or source JSON", () => {
    const old = room(), { openings: omitted, ...floor } = old.floor;
    expect(omitted).toEqual([]);
    const raw = JSON.stringify({ ...old, schemaVersion: 1, floor });
    const result = deserialize(raw);
    expect(result).toEqual(old);
    expect(JSON.parse(raw).schemaVersion).toBe(1);
    expect(JSON.parse(raw).floor.openings).toBeUndefined();
    expect(importProject(raw).floor).toEqual(old.floor);
  });
  it("preserves all opening data, IDs and orientation across export/import/save/recovery", () => {
    const p = both(), next = updateOpening(p, p.floor.openings[0].id, { hinge: "end", swing: -1 }), storage = memory();
    expect(deserialize(serialize(next))).toEqual(next);
    const imported = importProject(serialize(next));
    expect(imported.id).not.toBe(next.id); expect(imported.floor).toEqual(next.floor);
    saveProject(next, storage);
    saveProject({ ...next, name: "Later revision" }, storage);
    expect(loadProject(next.id, storage).project.floor.openings).toEqual(next.floor.openings);
    storage.setItem("studline.project." + next.id, "corrupt");
    expect(loadProject(next.id, storage)).toEqual({ project: next, recovered: true });
  });
  it("rejects unsupported schemas, malformed migrated walls and invalid imported openings", () => {
    const p = both();
    expect(() => deserialize(JSON.stringify({ ...p, schemaVersion: 99 }))).toThrow(/Unsupported/);
    expect(() => deserialize(JSON.stringify({ ...p, schemaVersion: 1 }))).toThrow(/inconsistent/);
    const bad = clone(p); bad.floor.openings[0].wallId = "absent";
    expect(() => deserialize(JSON.stringify(bad))).toThrow(/existing wall/);
    const missing = { ...p, floor: { ...p.floor, openings: undefined } };
    expect(() => deserialize(JSON.stringify(missing))).toThrow(/floor data/);
    const legacy = { ...p, schemaVersion: 1, floor: { ...p.floor, openings: undefined, walls: [{ id: "bad" }] } };
    expect(() => deserialize(JSON.stringify(legacy))).toThrow(/junction/);
  });
  it("rejects malformed opening arrays rather than throwing uncontrolled geometry errors", () => {
    const p = room();
    p.floor.openings = [null as unknown as Opening];
    expect(() => deserialize(JSON.stringify(p))).toThrow(/opening ID/);
  });
});
