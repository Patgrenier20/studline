import { type Opening, type Project, wallPoints, length } from "../core/model";

export function OpeningSymbol({ project, opening, scale, selected = false, preview = false, invalid = false }: {
  project: Project; opening: Opening; scale: number; selected?: boolean; preview?: boolean; invalid?: boolean;
}) {
  const wall = project.floor.walls.find(w => w.id === opening.wallId)!;
  const [a, b] = wallPoints(project, wall), span = length(a, b);
  const dx = (b.x - a.x) / span, dy = (b.y - a.y) / span;
  const x = a.x + dx * opening.offset, y = a.y + dy * opening.offset;
  const w = opening.width, t = wall.thickness;
  const color = invalid ? "#b34338" : selected || preview ? "#167765" : "#425e56";
  return <g data-opening={preview ? undefined : opening.id}
    aria-label={preview ? undefined : `${opening.kind === "door" ? "Door" : "Window"} opening`}
    transform={`translate(${x} ${y}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`}
    pointerEvents={preview ? "none" : undefined} opacity={preview ? 0.7 : 1}>
    <rect x={0} y={-Math.max(t / 2, 10 / scale)} width={w} height={Math.max(t, 20 / scale)} fill="transparent" />
    <rect x={0} y={-t/2} width={w} height={t} fill={selected ? "#d3e9e0" : "#f3f5f0"} />
    <path d={`M0,${-t/2} V${t/2} M${w},${-t/2} V${t/2}`} stroke={color} strokeWidth={2 / scale} fill="none" />
    {opening.kind === "window" ? <>
      <rect x={0} y={-t/2} width={w} height={t} fill="#dbeaf0" fillOpacity={0.6} stroke={color} strokeWidth={1.5 / scale} />
      <path d={`M0,0 H${w} M0,${-t/4} H${w} M0,${t/4} H${w}`} stroke={color} strokeWidth={1 / scale} />
    </> : <g transform={`translate(${opening.hinge === "end" ? w : 0} 0) scale(${opening.hinge === "end" ? -1 : 1} ${opening.swing})`}>
      <path d={`M0,0 V${w}`} stroke={color} strokeWidth={2 / scale} />
      <path d={`M0,${w} A${w},${w} 0 0 0 ${w},0`} stroke={color} strokeWidth={1 / scale} fill="none" />
    </g>}
  </g>;
}
