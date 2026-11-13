import { Shape, ExtrudeGeometry, Color, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { wallSolids } from "./openings";
import { exteriorSide } from "./wallEditing";
import { FT } from "./units";
import { wallPoints, length, type Project, type Wall } from "./model";
/** Local mesh: X is plan X, Y is negative plan Y, Z is wall height. */
export function createWallGeometry(project: Project, wall: Wall) {
  const parts = wallSolids(project, wall).map(solid => {
    const shape = new Shape();
    solid.footprint.forEach((p, i) => {
      if (i === 0) shape.moveTo(p.x / FT, -p.y / FT);
      else shape.lineTo(p.x / FT, -p.y / FT);
    });
    shape.closePath();
    const geometry = new ExtrudeGeometry(shape, {
      depth: (solid.top - solid.bottom) / FT, bevelEnabled: false,
    });
    geometry.translate(0, 0, solid.bottom / FT);
    return geometry;
  });
  const merged = mergeGeometries(parts)!;
  parts.forEach(part => part.dispose());
  const [a,b]=wallPoints(project,wall), span=length(a,b), side=exteriorSide(project,wall);
  const nx=-(b.y-a.y)/span*side, ny=-(b.x-a.x)/span*side;
  const normal=merged.getAttribute("normal"), colors:number[]=[];
  const exterior=new Color(wall.finishes?.exterior.color||wall.material), interior=new Color(wall.finishes?.interior.color||wall.material), edge=new Color(wall.material);
  for(let i=0;i<normal.count;i++) {
    const dot=normal.getX(i)*nx+normal.getY(i)*ny;
    const color=dot>0.9?exterior:dot< -0.9?interior:edge;
    colors.push(color.r,color.g,color.b);
  }
  merged.setAttribute("color",new Float32BufferAttribute(colors,3));
  return merged;
}
