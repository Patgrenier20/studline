export const FINISH_KINDS = ["paint", "siding", "brick", "stone", "wood", "plaster"] as const;
export type FinishKind = typeof FINISH_KINDS[number];
export interface SurfaceFinish { kind: FinishKind; color: string }
export interface WallFinishes { interior: SurfaceFinish; exterior: SurfaceFinish }
export const FINISH_COLORS: Record<FinishKind,string> = {
  paint: "#e8e1d3", siding: "#668394", brick: "#a86550", stone: "#918b7e", wood: "#a8784c", plaster: "#d3c8b3",
};
export function validFinishes(value: unknown): value is WallFinishes {
  if (!value || typeof value !== "object") return false;
  return ["interior", "exterior"].every(side => {
    const finish = (value as Record<string,SurfaceFinish>)[side];
    return finish && FINISH_KINDS.includes(finish.kind) && typeof finish.color === "string" && /^#[a-fA-F0-9]{6}$/.test(finish.color);
  });
}
