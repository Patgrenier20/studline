import { create } from "zustand";
import type { WallReference } from "../core/wallEditing";
export type LayerKey = "walls" | "doors" | "windows" | "rooms" | "dimensions";
export type Layers = Record<LayerKey, { visible: boolean; locked: boolean }>;
export type WorkspaceView = "plan" | "model" | "overview";
export interface WorkspacePreferences {
  leftWidth: number;
  rightWidth: number;
  showBrowser: boolean;
  showInspector: boolean;
  split: boolean;
  reference: WallReference;
  layers: Layers;
  savedViews: {
    name: string;
    projectId: string;
    view: WorkspaceView;
    layers: Layers;
  }[];
}
const defaultLayers = (): Layers =>
  Object.fromEntries(
    ["walls", "doors", "windows", "rooms", "dimensions"].map((k) => [
      k,
      { visible: true, locked: false },
    ]),
  ) as Layers;
const defaults: WorkspacePreferences = {
  leftWidth: 230,
  rightWidth: 280,
  showBrowser: true,
  showInspector: true,
  split: false,
  reference: "centerline",
  layers: defaultLayers(),
  savedViews: [],
};
function restore(): WorkspacePreferences {
  try {
    const p = JSON.parse(localStorage.getItem("studline.workspace.v1") || "{}");
    const layers = defaultLayers();
    for (const k of Object.keys(layers) as LayerKey[]) {
      if (typeof p.layers?.[k]?.visible === "boolean")
        layers[k].visible = p.layers[k].visible;
      if (typeof p.layers?.[k]?.locked === "boolean")
        layers[k].locked = p.layers[k].locked;
    }
    return {
      ...defaults,
      leftWidth: Math.max(190, Math.min(340, Number(p.leftWidth) || 230)),
      rightWidth: Math.max(230, Math.min(400, Number(p.rightWidth) || 280)),
      showBrowser: typeof p.showBrowser === "boolean" ? p.showBrowser : true,
      showInspector:
        typeof p.showInspector === "boolean" ? p.showInspector : true,
      split: p.split === true,
      reference: ["centerline", "exterior", "interior"].includes(p.reference)
        ? p.reference
        : "centerline",
      layers,
      savedViews: Array.isArray(p.savedViews)
        ? p.savedViews.filter(
            (v: WorkspacePreferences["savedViews"][number]) =>
              typeof v.name === "string" &&
              typeof v.projectId === "string" &&
              v.view === "plan" &&
              Object.keys(layers).every(
                (k) =>
                  typeof v.layers?.[k as LayerKey]?.visible === "boolean" &&
                  typeof v.layers?.[k as LayerKey]?.locked === "boolean",
              ),
          )
        : [],
    };
  } catch {
    return structuredClone(defaults);
  }
}
interface Workspace extends WorkspacePreferences {
  set: (patch: Partial<WorkspacePreferences>) => void;
  reset: () => void;
}
export const useWorkspace = create<Workspace>((set, get) => ({
  ...restore(),
  set: (patch) => {
    set(patch);
    try {
      const { set: _set, reset: _reset, ...data } = get();
      void _set;
      void _reset;
      localStorage.setItem("studline.workspace.v1", JSON.stringify(data));
    } catch {
      /* preferences are optional */
    }
  },
  reset: () => {
    set(structuredClone(defaults));
    try {
      localStorage.removeItem("studline.workspace.v1");
    } catch {
      /* optional */
    }
  },
}));
export function layerFor(kind: string): LayerKey {
  return kind === "door" ? "doors" : kind === "window" ? "windows" : "walls";
}
