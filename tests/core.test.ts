import { describe, it, expect } from "vitest";
import {
  feet,
  inches,
  parseImperial,
  formatImperial,
  FT,
} from "../src/core/units";
import {
  createProject,
  rectangle,
  wallPoints,
  length,
  resizeWall,
  editNodes,
  addWall,
  deleteWall,
  validateProject,
  clone,
  DEFAULT_WALL,
} from "../src/core/model";
import {
  wallFootprint,
  wallMeshData,
  snapPoint,
  enclosedArea,
} from "../src/core/geometry";
import { emptyHistory, execute, undo, redo } from "../src/core/history";
import { createWallGeometry } from "../src/core/mesh";
import {
  serialize,
  deserialize,
  importProject,
  saveProject,
  loadProject,
  listProjects,
  activeProject,
  type StoragePort,
} from "../src/storage/projects";
describe("imperial precision", () => {
  it.each([
    ["16'", feet(16)],
    ["16' 3 1/2\"", feet(16) + inches(3.5)],
    ["16′ 3½″", null],
    ["6.5", inches(6.5)],
    ['1/64"', 1],
    ["-1' 2 1/4\"", -feet(1) - inches(2.25)],
    ["2ft 6in", inches(30)],
  ])("parses %s", (input, expected) => {
    if (expected === null)
      expect(() => parseImperial(input as string)).toThrow();
    else expect(parseImperial(input as string)).toBe(expected);
  });
  it("round trips every 1/64 inch across signed dimensions", () => {
    for (let t = -20000; t <= 20000; t += 7)
      expect(parseImperial(formatImperial(t))).toBe(t);
  });
  it.each([
    "",
    "abc",
    "1/0",
    "NaN",
    "Infinity",
    "1' garbage",
    "1.2.3",
    "9999999999999999999999",
  ])("rejects invalid input %s", (value) =>
    expect(() => parseImperial(value)).toThrow(),
  );
});
describe("unified room model", () => {
  it("extrudes real triangles with the model height and matching edited bounds", () => {
    const p = rectangle(createProject(), feet(20), feet(16)),
      w = p.floor.walls[0];
    const mesh = createWallGeometry(p, w);
    mesh.computeBoundingBox();
    expect(mesh.boundingBox!.max.z).toBe(9);
    expect(mesh.boundingBox!.min.z).toBe(0);
    expect(mesh.getAttribute("position").count).toBeGreaterThan(24);
    const next = resizeWall(p, w.id, feet(24)),
      edited = createWallGeometry(next, w);
    edited.computeBoundingBox();
    expect(edited.boundingBox!.max.x).toBeGreaterThan(mesh.boundingBox!.max.x);
    mesh.dispose();
    edited.dispose();
  });
  it("draws four joined walls, computes dimensions and produces matching 3D wall data", () => {
    const room = rectangle(createProject(), feet(20), feet(16));
    expect(room.floor.nodes).toHaveLength(4);
    expect(room.floor.walls).toHaveLength(4);
    expect(
      room.floor.walls.map((w) => length(...wallPoints(room, w)) / FT),
    ).toEqual([20, 16, 20, 16]);
    expect(enclosedArea(room)).toBe(320);
    for (const w of room.floor.walls) {
      const mesh = wallMeshData(room, w);
      expect(mesh.footprint).toEqual(
        wallFootprint(room, w).map((pt) => ({ x: pt.x / FT, y: pt.y / FT })),
      );
      expect(mesh.height).toBe(9);
    }
  });
  it("shares exact miter edges at a rectangular corner", () => {
    const p = rectangle(createProject(), feet(20), feet(16));
    const first = wallFootprint(p, p.floor.walls[0]),
      second = wallFootprint(p, p.floor.walls[1]);
    expect(first[1]).toEqual(second[0]);
    expect(first[2]).toEqual(second[3]);
    expect(first[0]).toEqual({ x: inches(3), y: inches(3) });
  });
  it("resizing moves the shared endpoint and changes both dependent 3D meshes", () => {
    const p = rectangle(createProject(), feet(20), feet(16)),
      [w, neighbor] = p.floor.walls;
    const next = resizeWall(p, w.id, feet(24));
    expect(length(...wallPoints(next, w))).toBe(feet(24));
    expect(wallPoints(next, neighbor)[0].x).toBe(feet(24));
    expect(wallMeshData(next, w)).not.toEqual(wallMeshData(p, w));
    expect(wallMeshData(next, neighbor)).not.toEqual(wallMeshData(p, neighbor));
    expect(length(...wallPoints(p, w))).toBe(feet(20));
  });
  it("moves a wall and keeps neighbors attached by identity", () => {
    const p = rectangle(createProject(), feet(20), feet(16)),
      w = p.floor.walls[0],
      [a, b] = wallPoints(p, w);
    const moved = editNodes(p, {
      [a.id]: { ...a, y: -FT },
      [b.id]: { ...b, y: -FT },
    });
    expect(length(...wallPoints(moved, w))).toBe(feet(20));
    expect(length(...wallPoints(moved, p.floor.walls[1]))).toBe(feet(17));
    expect(moved.floor.nodes.map((n) => n.id)).toEqual(
      p.floor.nodes.map((n) => n.id),
    );
  });
  it("gives endpoints priority over grid without accumulating precision drift", () => {
    const p = rectangle(createProject(), feet(20) + 1, feet(16));
    expect(
      snapPoint({ x: feet(20) + 9, y: 5 }, p, inches(6), 30, true).point,
    ).toEqual({ x: feet(20) + 1, y: 0 });
    expect(
      snapPoint({ x: feet(7) + 5, y: feet(3) + 8 }, p, inches(6), 30, true)
        .point,
    ).toEqual({ x: feet(7), y: feet(3) });
    expect(snapPoint({ x: 10.4, y: 9.7 }, p, 64, 20, false).point).toEqual({
      x: 10,
      y: 10,
    });
  });
  it("rejects duplicates, zero-length walls, collapsed neighbors, and malformed files", () => {
    const p = rectangle(createProject(), feet(20), feet(16)),
      [a, b] = wallPoints(p, p.floor.walls[0]);
    expect(() => addWall(p, a, b, DEFAULT_WALL)).toThrow();
    expect(() => addWall(createProject(), a, a, DEFAULT_WALL)).toThrow();
    expect(() => editNodes(p, { [b.id]: a })).toThrow();
    const bad = clone(p);
    bad.floor.walls[0].start = "missing";
    expect(() => validateProject(bad)).toThrow();
    const float = clone(p);
    float.floor.nodes[0].x = 0.2;
    expect(() => validateProject(float)).toThrow();
    expect(() => deserialize('{"schemaVersion":99}')).toThrow();
  });
  it("deletes walls without stale nodes and does not label an open plan as a room", () => {
    const p = rectangle(createProject(), feet(20), feet(16)),
      next = deleteWall(p, p.floor.walls[0].id);
    expect(next.floor.walls).toHaveLength(3);
    expect(enclosedArea(next)).toBeNull();
    const final = next.floor.walls.reduce((p, w) => deleteWall(p, w.id), next);
    expect(final.floor.nodes).toHaveLength(0);
  });
  it("uses finite bounded geometry at acute and collinear junctions", () => {
    let p = addWall(
      createProject(),
      { x: 0, y: 0 },
      { x: feet(20), y: 0 },
      DEFAULT_WALL,
    );
    p = addWall(p, { x: feet(20), y: 0 }, { x: 0, y: 1 }, DEFAULT_WALL);
    expect(
      p.floor.walls
        .flatMap((w) => wallFootprint(p, w))
        .every(
          (pt) =>
            Number.isFinite(pt.x) &&
            Number.isFinite(pt.y) &&
            Math.abs(pt.x) < feet(25),
        ),
    ).toBe(true);
  });
  it("welds a moved endpoint to an existing junction without duplicating it", () => {
    let p = addWall(
      createProject(),
      { x: 0, y: 0 },
      { x: FT, y: 0 },
      DEFAULT_WALL,
    );
    p = addWall(p, { x: 2 * FT, y: 0 }, { x: 2 * FT, y: FT }, DEFAULT_WALL);
    const target = wallPoints(p, p.floor.walls[1])[0],
      moving = wallPoints(p, p.floor.walls[0])[1];
    const joined = editNodes(p, { [moving.id]: target });
    expect(joined.floor.nodes).toHaveLength(3);
    expect(joined.floor.walls[0].end).toBe(target.id);
    expect(wallFootprint(joined, joined.floor.walls[0])[1]).toEqual(
      wallFootprint(joined, joined.floor.walls[1])[0],
    );
  });
});
describe("commands and durable files", () => {
  it("reverses a whole room command, redoes it exactly, and clears redo on a new edit", () => {
    const p = createProject(),
      room = rectangle(p, feet(20), feet(16)),
      result = execute(emptyHistory(), p, room, "Room");
    const reverted = undo(result.history)!;
    expect(reverted.project).toEqual(p);
    expect(redo(reverted.history)!.project).toEqual(result.project);
    expect(
      execute(reverted.history, p, { ...p, name: "New branch" }, "Rename")
        .history.future,
    ).toHaveLength(0);
  });
  it("round trips all geometry and stable IDs through exported JSON", () => {
    const p = rectangle(createProject("Saved home"), feet(20), feet(16));
    expect(deserialize(serialize(p))).toEqual(p);
    const imported = importProject(serialize(p));
    expect(imported.id).not.toBe(p.id);
    expect(imported.floor).toEqual(p.floor);
  });
  function memory(): StoragePort {
    const values = new Map<string, string>();
    return {
      get length() {
        return values.size;
      },
      key: (i) => [...values.keys()][i] || null,
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => {
        values.set(k, v);
      },
    };
  }
  it("preserves multiple projects, reopens the active one and restores a recovery snapshot", () => {
    const storage = memory(),
      p = rectangle(createProject("First"), feet(20), feet(16));
    saveProject(p, storage);
    const renamed = { ...p, name: "Updated" };
    saveProject(renamed, storage);
    expect(activeProject(storage)!.project.name).toBe("Updated");
    const second = createProject("Second");
    saveProject(second, storage);
    expect(listProjects(storage)).toHaveLength(2);
    storage.setItem("studline.project." + p.id, "corrupt");
    const recovered = loadProject(p.id, storage);
    expect(recovered.recovered).toBe(true);
    expect(recovered.project).toEqual(p);
  });
  it("surfaces storage quota failures instead of claiming a save succeeded", () => {
    const storage = memory();
    storage.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
    expect(() => saveProject(createProject(), storage)).toThrow();
  });
});
