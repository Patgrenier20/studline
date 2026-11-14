import { clone, length, validateProject, type Junction, type Point, type Project, type Wall } from "./model";
import { closedLoop, segmentsIntersect, signedArea } from "./geometry";
import { OPENING_CLEARANCE } from "./openings";

const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const delta = (a: Point, b: Point): Point => ({ x: b.x - a.x, y: b.y - a.y });
const pointKey = ({x, y}: Point) => `${x},${y}`;
const edgeKey = (a: string, b: string) => JSON.stringify([a, b].sort());

interface Run {
  wall: Wall;
  a: Junction;
  b: Junction;
  vector: Point;
  marks: Map<number, Junction>;
}

function station(run: Run, p: Point) {
  const d = delta(run.a, p), v = run.vector;
  return (d.x * v.x + d.y * v.y) / (v.x ** 2 + v.y ** 2);
}

/** Split a snapshot transactionally. Earlier runs retain ownership of compatible overlaps. */
export function normalizeTopology(project: Project) {
  const { floor } = project;
  const maxWalls = 2000;
  const occupied = new Set([...floor.nodes, ...floor.walls, ...floor.openings].map(o => o.id));
  function allocate(base: string) {
    let id = base, suffix = 0;
    while (occupied.has(id)) id = `${base}:${++suffix}`;
    occupied.add(id);
    return id;
  }
  const byId = new Map(floor.nodes.map(n => [n.id, n]));
  const canonical = new Map<string, Junction>();
  for (const n of floor.nodes) if (!canonical.has(pointKey(n))) canonical.set(pointKey(n), n);
  const runs: Run[] = floor.walls.map(wall => {
    const a = canonical.get(pointKey(byId.get(wall.start)!))!;
    const b = canonical.get(pointKey(byId.get(wall.end)!))!;
    return { wall, a, b, vector: delta(a, b), marks: new Map([[0, a], [1, b]]) };
  });

  // A self-crossing outline is ambiguous; a crossing of independently drawn partitions is valid.
  const originalNeighbors = new Map<string, Run[]>();
  for (const run of runs) for (const node of [run.a, run.b]) {
    const neighbors = originalNeighbors.get(node.id) ?? [];
    neighbors.push(run);
    originalNeighbors.set(node.id, neighbors);
  }
  const simpleCycles = new Map<Run, Run>();
  const visited = new Set<Run>();
  for (const run of runs) {
    if (visited.has(run)) continue;
    const pending = [run], component: Run[] = [];
    while (pending.length) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      for (const node of [current.a, current.b]) pending.push(...originalNeighbors.get(node.id)!.filter(neighbor => !visited.has(neighbor)));
    }
    if (component.every(r => originalNeighbors.get(r.a.id)!.length === 2 && originalNeighbors.get(r.b.id)!.length === 2)) {
      for (const member of component) simpleCycles.set(member, run);
    }
  }

  for (let i = 0; i < runs.length; i++) {
    const a = runs[i];
    for (let j = i + 1; j < runs.length; j++) {
      const b = runs[j];
      // A drafted point on a diagonal is rounded to the integer model grid.
      // Recognize that endpoint within the maximum half-tick rounding distance.
      for (const [run, other] of [[a, b], [b, a]]) {
        for (const node of [other.a, other.b]) {
          if (node === run.a || node === run.b ||
              node.x < Math.min(run.a.x, run.b.x) - 1 || node.x > Math.max(run.a.x, run.b.x) + 1 ||
              node.y < Math.min(run.a.y, run.b.y) - 1 || node.y > Math.max(run.a.y, run.b.y) + 1) continue;
          const t = station(run, node);
          if (t > 0 && t < 1 && Math.abs(cross(run.vector, delta(run.a, node))) <= Math.SQRT1_2 * length(run.a, run.b))
            run.marks.set(t, node);
        }
      }
      if (!segmentsIntersect(a.a, a.b, b.a, b.b)) continue;
      const between = delta(a.a, b.a), determinant = cross(a.vector, b.vector);
      if (!determinant) continue;
      const t = cross(between, b.vector) / determinant;
      const u = cross(between, a.vector) / determinant;
      if (t > 0 && t < 1 && u > 0 && u < 1 && simpleCycles.has(a) && simpleCycles.get(a) === simpleCycles.get(b))
        throw new Error("A closed outline crosses itself. Reconnect the outline before creating rooms.");
      const point = { x: Math.round(a.a.x + t * a.vector.x), y: Math.round(a.a.y + t * a.vector.y) };
      const near = [a.a, a.b, b.a, b.b].find(n => length(n, point) <= 1 &&
        (a.marks.has(station(a, n)) || b.marks.has(station(b, n))));
      const key = pointKey(near ?? point);
      let node = canonical.get(key);
      if (!node) {
        node = { ...point, id: allocate(`junction:${key}`) };
        canonical.set(key, node);
      }
      a.marks.set(t, node);
      b.marks.set(u, node);
    }
  }

  if (new Set(runs.map(r => edgeKey(r.a.id, r.b.id))).size === runs.length &&
      runs.every(r => r.marks.size === 2 && r.wall.start === r.a.id && r.wall.end === r.b.id))
    return { project, sourceWall: new Map<string, string>() };

  const next = clone(project), walls = new Map<string, Wall>(), sourceWall = new Map<string, string>();
  const pinnedExteriors = new Map<Run, Map<string, 1 | -1>>();
  const openingsByWall = new Map<string, typeof floor.openings>();
  for (const opening of next.floor.openings) {
    const hosted = openingsByWall.get(opening.wallId) ?? [];
    hosted.push(opening);
    openingsByWall.set(opening.wallId, hosted);
  }
  for (const run of runs) {
    const marks = [...run.marks.values()].filter((n, i, all) => all.indexOf(n) === i)
      .sort((a, b) => station(run, a) - station(run, b));
    const split = marks.length > 2;
    if ((split || run.a.id !== run.wall.start || run.b.id !== run.wall.end) && run.wall.locked)
      throw new Error("Unlock the affected wall before joining it.");
    const cycle = simpleCycles.get(run);
    if (cycle && !pinnedExteriors.has(cycle)) {
      const members = runs.filter(r => simpleCycles.get(r) === cycle);
      const cycleWalls = members.map(r => r.wall);
      const nodes = [...new Set(members.flatMap(r => [r.a, r.b]))];
      const loop = closedLoop({ ...project, floor: { ...floor, nodes, walls: cycleWalls } });
      pinnedExteriors.set(cycle, new Map(loop?.walls.map((w, i) => {
        const forward = pointKey(byId.get(w.start)!) === pointKey(loop.points[i]);
        return [w.id, (-Math.sign(signedArea(loop.points)) * (forward ? 1 : -1)) as 1 | -1];
      })));
    }
    const span = length(run.a, run.b);
    let keptId = false;
    const hosted = openingsByWall.get(run.wall.id) ?? [];
    for (let i = 1; i < marks.length; i++) {
      const a = marks[i - 1], b = marks[i], key = edgeKey(a.id, b.id);
      const from = station(run, a) * span, to = station(run, b) * span;
      const inheritedSide = cycle ? pinnedExteriors.get(cycle)?.get(run.wall.id) : undefined;
      const existing = walls.get(key);
      const reversed = existing?.end === a.id;
      const side = run.wall.exteriorSide ?? inheritedSide;
      if (existing && (run.wall.locked || existing.thickness !== run.wall.thickness ||
        existing.height !== run.wall.height || existing.material !== run.wall.material ||
        (existing.wallType ?? "generic") !== (run.wall.wallType ?? "generic") ||
        JSON.stringify(existing.finishes) !== JSON.stringify(run.wall.finishes) ||
        (run.wall.exteriorSide !== undefined && existing.exteriorSide !== undefined &&
          existing.exteriorSide !== (reversed ? -run.wall.exteriorSide : run.wall.exteriorSide))))
        throw new Error("Overlapping walls have incompatible specifications. Adjust the overlap before joining them.");
      const wall = existing ?? {
        ...run.wall,
        id: keptId ? allocate(`segment:${run.wall.id}:${i}`) : run.wall.id,
        start: a.id, end: b.id,
        ...(side === undefined ? {} : { exteriorSide: side }),
      };
      if (!existing) {
        walls.set(key, wall);
        if (walls.size > maxWalls) throw new Error("Joining these walls would exceed the 2,000-wall project limit.");
        sourceWall.set(wall.id, run.wall.id);
        keptId = true;
      }
      for (const opening of hosted) {
        const offset = opening.offset;
        if (offset < from || offset >= to) continue;
        if ((i > 1 && offset - from < OPENING_CLEARANCE) ||
          (i < marks.length - 1 && offset + opening.width + OPENING_CLEARANCE > to))
          throw new Error("A wall junction would cut through a door or window or leave less than one inch at its jamb.");
        if (existing || split) {
          opening.wallId = wall.id;
          opening.offset = Math.round(reversed ? to - offset - opening.width : offset - from);
          if (reversed) {
            opening.hinge = opening.hinge === "start" ? "end" : "start";
            opening.swing = opening.swing === 1 ? -1 : 1;
          }
        }
      }
    }
  }
  next.floor.walls = [...walls.values()];
  const used = new Set(next.floor.walls.flatMap(w => [w.start, w.end]));
  next.floor.nodes = [...canonical.values()].filter(n => used.has(n.id));
  validateProject(next);
  return { project: next, sourceWall };
}
