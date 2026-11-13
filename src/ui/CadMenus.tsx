import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "../state/workspace";
import { useEditor, type Tool } from "../state/store";
type Item = { label: string; action: () => void; disabled?: boolean };
const shortcuts:Record<string,string>={"Save project":"Ctrl S",Undo:"Ctrl Z",Redo:"Ctrl Shift Z",Wall:"W",Door:"D",Window:"N","Select objects":"V","Measure distance":"M",Pan:"H","Delete selection":"Del"};
export function CadMenus({
  onDialog,
  onExport,
  onProperties,
}: {
  onDialog: (kind: "new" | "open" | "room" | "settings" | "help") => void;
  onExport: () => void;
  onProperties: () => void;
}) {
  const s = useEditor(),
    ws = useWorkspace(),
    [open, setOpen] = useState<string | null>(null),
    host = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!host.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);
  const tool = (tool: Tool) => () => s.set({ tool, view: "plan" });
  const menus: Record<string, Item[]> = {
    File: [
      { label: "New project…", action: () => onDialog("new") },
      { label: "Open project…", action: () => onDialog("open") },
      { label: "Save project", action: s.save },
      { label: "Export project JSON…", action: onExport },
    ],
    Edit: [
      { label: "Undo", action: s.undo, disabled: !s.history.past.length },
      { label: "Redo", action: s.redo, disabled: !s.history.future.length },
      {
        label: "Open wall specification…",
        disabled: !s.project.floor.walls.some((w) => w.id === s.selected),
        action: () =>
          s.set({ specification: { kind: "wall", id: s.selected! } }),
      },
      { label: "Delete selection", action: s.remove, disabled: !s.selected },
    ],
    Build: [
      { label: "Wall", action: tool("wall") },
      { label: "Door", action: tool("door") },
      { label: "Window", action: tool("window") },
      { label: "Rectangular room…", action: () => onDialog("room") },
    ],
    CAD: [
      { label: "Measure distance", action: tool("measure") },
      { label: "CAD lines / arcs · planned", action: () => {}, disabled: true },
    ],
    Tools: [
      { label: "Select objects", action: tool("select") },
      { label: "Measure distance", action: tool("measure") },
      { label: "Pan", action: tool("pan") },
      { label: "Drawing preferences…", action: () => onDialog("settings") },
    ],
    "3D": [
      { label: "Open 3D model", action: () => s.set({ view: "model" }) },
      {
        label: "Orthographic overview",
        action: () => s.set({ view: "overview" }),
      },
      {
        label: "Reset camera",
        action: () => s.set({ fitToken: s.fitToken + 1 }),
      },
    ],
    Window: [
      {
        label: ws.split ? "Single view" : "Split plan + 3D",
        action: () => ws.set({ split: !ws.split }),
      },
      {
        label: "Toggle Project Browser",
        action: () => ws.set({ showBrowser: !ws.showBrowser }),
      },
      { label: "Reset workspace layout", action: ws.reset },
      { label: "Floor plan", action: () => s.set({ view: "plan" }) },
      {
        label: s.showGrid ? "Hide grid" : "Show grid",
        action: () => s.set({ showGrid: !s.showGrid, view: "plan" }),
      },
      {
        label: s.dimensions ? "Hide dimensions" : "Show dimensions",
        action: () => s.set({ dimensions: !s.dimensions }),
      },
      {
        label: "Fit drawing",
        action: () => s.set({ fitToken: s.fitToken + 1 }),
      },
      { label: "Toggle properties", action: onProperties },
    ],
    Help: [{ label: "Quick guide…", action: () => onDialog("help") }],
  };
  return (
    <nav
      ref={host}
      className="cad-menu-bar"
      aria-label="Application menus"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setOpen(null);
        }
      }}
    >
      {Object.entries(menus).map(([name, items]) => (
        <div className="cad-menu" key={name}>
          <button
            aria-expanded={open === name}
            onClick={() => setOpen(open === name ? null : name)}
          >
            {name}
          </button>
          {open === name && (
            <div className="cad-menu-popup">
              {items.map((item) => (
                <button
                  key={item.label}
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(null);
                    item.action();
                  }}
                >
                  {item.label}<kbd>{shortcuts[item.label]||""}</kbd>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <span className="menu-document">
        {s.project.floor.name} ·{" "}
        {s.view === "plan"
          ? "Floor Plan"
          : s.view === "overview"
            ? "Orthographic"
            : "Perspective"}
      </span>
    </nav>
  );
}
