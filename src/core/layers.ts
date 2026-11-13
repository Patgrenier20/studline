import type { Project } from "./model";
import type { Layers } from "../state/workspace";
/** Workspace locks gate every model commit, including shared junction changes. */
export function checkLayerEdits(
  before: Project,
  after: Project,
  layers: Layers,
) {
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  if (
    layers.walls.locked &&
    (!same(before.floor.walls, after.floor.walls) ||
      !same(before.floor.nodes, after.floor.nodes))
  )
    throw new Error(
      "Walls layer is locked. Unlock it in Layers before editing.",
    );
  for (const kind of ["door", "window"] as const) {
    const key = kind === "door" ? "doors" : "windows";
    if (
      layers[key].locked &&
      !same(
        before.floor.openings.filter((o) => o.kind === kind),
        after.floor.openings.filter((o) => o.kind === kind),
      )
    )
      throw new Error(
        `${key} layer is locked. Unlock it in Layers before editing.`,
      );
  }
  if (layers.rooms.locked && !same(before.floor.rooms, after.floor.rooms))
    throw new Error("Rooms layer is locked.");
}
