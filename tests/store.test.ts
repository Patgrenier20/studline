import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditor } from "../src/state/store";
import { createProject, rectangle, clone } from "../src/core/model";
import { addOpening, updateOpening } from "../src/core/openings";
import { feet } from "../src/core/units";
import { loadProject } from "../src/storage/projects";

beforeEach(() => {
  const data = new Map<string,string>();
  vi.stubGlobal("localStorage", { get length() { return data.size; }, key: (i: number) => [...data.keys()][i],
    getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key,value) });
  useEditor.getState().replace(rectangle(createProject(), feet(20), feet(16)));
});
afterEach(() => vi.unstubAllGlobals());

describe("editor command and persistence integration", () => {
  it("autosaves add/edit/delete and reverses an opening deletion without affecting walls", () => {
    const initial = useEditor.getState().project;
    let next = addOpening(initial, initial.floor.walls[0].id, "door", feet(2));
    useEditor.getState().commit(next, "Add door");
    const id = next.floor.openings[0].id;
    next = updateOpening(next, id, { width: feet(4) });
    useEditor.getState().commit(next, "Resize door");
    useEditor.getState().set({ selected: id }); useEditor.getState().remove();
    expect(useEditor.getState().project.floor.openings).toHaveLength(0);
    expect(useEditor.getState().project.floor.walls).toEqual(initial.floor.walls);
    useEditor.getState().undo();
    const restored = useEditor.getState().project;
    expect(restored.floor.openings[0].width).toBe(feet(4));
    expect(loadProject(restored.id).project).toEqual(restored);
    useEditor.getState().redo();
    expect(useEditor.getState().project.floor.openings).toHaveLength(0);
  });
  it("rejects invalid commands atomically without changing history, model or saved data", () => {
    const p = useEditor.getState().project;
    const next = addOpening(p,p.floor.walls[0].id,"window",feet(2));
    useEditor.getState().commit(next,"Add window");
    const before = useEditor.getState(), invalid = clone(before.project);
    invalid.floor.walls[0].height = feet(2);
    useEditor.getState().commit(invalid,"Invalid host edit");
    expect(useEditor.getState().project).toBe(before.project);
    expect(useEditor.getState().history).toBe(before.history);
    expect(loadProject(p.id).project).toEqual(before.project);
    expect(useEditor.getState().notice).toMatch(/above the opening/);
  });
  it("cascades host deletion and restores its openings through the actual editor actions", () => {
    const p = useEditor.getState().project, wallId = p.floor.walls[0].id;
    useEditor.getState().commit(addOpening(p,wallId,"door",feet(2)),"Add door");
    useEditor.getState().set({ selected: wallId }); useEditor.getState().remove();
    expect(useEditor.getState().project.floor.walls).toHaveLength(3);
    expect(useEditor.getState().project.floor.openings).toHaveLength(0);
    useEditor.getState().undo();
    expect(useEditor.getState().project.floor.openings).toHaveLength(1);
    expect(useEditor.getState().project.floor.walls).toHaveLength(4);
  });
});


describe("failed-save protection", () => {
  it("keeps the current model and history when storage fails during a project switch", () => {
    const p = useEditor.getState().project;
    vi.spyOn(localStorage,"setItem").mockImplementation(()=>{throw new Error("quota");});
    const changed=clone(p); changed.name="Unsaved precision edit";
    useEditor.getState().commit(changed,"Rename");
    const before=useEditor.getState();
    expect(before.saveError).not.toBeNull();
    expect(useEditor.getState().replace(createProject())).toBe(false);
    expect(useEditor.getState().project).toBe(before.project);
    expect(useEditor.getState().history).toBe(before.history);
    expect(useEditor.getState().notice).toMatch(/not saved/);
  });
  it("allows switching after storage becomes writable and preserves the previous project", () => {
    const p=useEditor.getState().project;
    const spy=vi.spyOn(localStorage,"setItem").mockImplementation(()=>{throw new Error("quota");});
    const changed=clone(p); changed.name="Recovered precision edit";
    useEditor.getState().commit(changed,"Rename");
    spy.mockRestore();
    const current=useEditor.getState().project;
    expect(useEditor.getState().replace(createProject())).toBe(true);
    expect(loadProject(p.id).project).toEqual(current);
  });
});
