import { clone, length, validateProject, wallPoints, type Project, type Wall } from "./model";
import type { WallFinishes } from "./materials";
import { changeThickness, exteriorSide, resizeReference, type EditAnchor } from "./wallEditing";
export interface WallSpecification {
  length: number; height: number; thickness: number;
  wallType: NonNullable<Wall["wallType"]>; locked: boolean;
  anchor: EditAnchor; constrain: boolean; finishes: WallFinishes;
}
/** One validated transaction: Cancel leaves the model untouched; failed Apply cannot partially resize a room. */
export function applyWallSpecification(project: Project,id:string,values:WallSpecification): Project {
  const wall=project.floor.walls.find(w=>w.id===id);
  if(!wall) throw new Error("The selected wall no longer exists.");
  const geometryChanges=values.length!==Math.round(length(...wallPoints(project,wall))) || values.height!==wall.height || values.thickness!==wall.thickness;
  if(wall.locked && values.locked && geometryChanges) throw new Error("Clear Fixed wall before changing its dimensions.");
  let next=clone(project);
  next.floor.walls.find(w=>w.id===id)!.locked=false;
  if(values.length!==Math.round(length(...wallPoints(project,wall)))) next=resizeReference(next,id,values.length,"centerline",values.anchor,values.constrain);
  if(values.thickness!==wall.thickness) next=changeThickness(next,id,values.thickness,"centerline",values.constrain);
  Object.assign(next.floor.walls.find(w=>w.id===id)!,{height:values.height,exteriorSide:exteriorSide(project,wall),wallType:values.wallType,locked:values.locked,finishes:clone(values.finishes)});
  validateProject(next);
  return next;
}
