import { describe, it, expect } from "vitest";
import { demoProject, clone, wallPoints } from "../src/core/model";
import {
  moveWall,
  resizeReference,
  reverseWall,
} from "../src/core/wallEditing";
import { checkLayerEdits } from "../src/core/layers";
import type { Layers } from "../src/state/workspace";
const layers = (): Layers => ({
  walls: { visible: true, locked: false },
  doors: { visible: true, locked: false },
  windows: { visible: true, locked: false },
  rooms: { visible: true, locked: false },
  dimensions: { visible: true, locked: false },
});
describe("workspace layer locks", () => {
  it("rejects connected wall movement and resizing when walls are locked", () => {
    const p = demoProject(),
      l = layers();
    l.walls.locked = true;
    const id = p.floor.walls[0].id;
    expect(() =>
      checkLayerEdits(p, moveWall(p, id, { x: 0, y: 768 }, false, true), l),
    ).toThrow(/locked/);
    expect(() =>
      checkLayerEdits(
        p,
        resizeReference(p, id, 30 * 768, "centerline", "start", true),
        l,
      ),
    ).toThrow(/locked/);
  });
  it("permits viewing and project metadata changes without unlocking geometry", () => {
    const p = demoProject(),
      next = clone(p),
      l = layers();
    l.walls.locked = true;
    next.name = "Renamed";
    expect(() => checkLayerEdits(p, next, l)).not.toThrow();
  });
  it("visibility does not delete or prevent edits to model data", () => {
    const p = demoProject(),
      l = layers();
    l.walls.visible = false;
    expect(() =>
      checkLayerEdits(p, reverseWall(p, p.floor.walls[0].id), l),
    ).not.toThrow();
    expect(wallPoints(p, p.floor.walls[0])).toHaveLength(2);
  });
  it("protects room metadata independently", () => {
    const p = demoProject(),
      next = clone(p),
      l = layers();
    l.rooms.locked = true;
    next.floor.rooms = [];
    expect(() => checkLayerEdits(p, next, l)).toThrow(/locked/);
  });
});
