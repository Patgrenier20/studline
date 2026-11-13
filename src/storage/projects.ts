import { type Project, validateProject, uid } from "../core/model";
const PREFIX = "studline.project.",
  ACTIVE = "studline.active",
  RECOVERY = "studline.recovery.";
export interface StoragePort {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function serialize(p: Project): string {
  validateProject(p);
  return JSON.stringify(p, null, 2);
}
export function deserialize(raw: string): Project {
  if (raw.length > 5_000_000)
    throw new Error("Project files must be smaller than 5 MB.");
  let value: unknown = JSON.parse(raw);
  // Migration is in memory only; never mutate or discard the original save.
  if (value && typeof value === "object" && "schemaVersion" in value && value.schemaVersion === 1) {
    const old = value as Record<string, unknown>;
    if (old.floor && typeof old.floor === "object" && !Array.isArray(old.floor)) {
      const floor = old.floor as Record<string, unknown>;
      if ("openings" in floor) throw new Error("Schema 1 cannot contain openings. File is inconsistent.");
      value = { ...old, schemaVersion: 2, floor: { ...floor, openings: [] } };
    }
  }
  validateProject(value);
  return value;
}
export function importProject(raw: string): Project {
  return {
    ...deserialize(raw),
    id: uid(),
    modifiedAt: new Date().toISOString(),
  };
}
export function saveProject(
  p: Project,
  storage: StoragePort = localStorage,
): void {
  const raw = serialize(p),
    key = PREFIX + p.id,
    previous = storage.getItem(key);
  if (previous) {
    try {
      deserialize(previous);
      storage.setItem(RECOVERY + p.id, previous);
    } catch (e) {
      if (e instanceof DOMException) throw e;
    }
  }
  storage.setItem(key, raw);
  storage.setItem(ACTIVE, p.id);
}
export function loadProject(
  id: string,
  storage: StoragePort = localStorage,
): { project: Project; recovered: boolean } {
  try {
    return {
      project: deserialize(storage.getItem(PREFIX + id) || ""),
      recovered: false,
    };
  } catch {
    const raw = storage.getItem(RECOVERY + id);
    if (raw) return { project: deserialize(raw), recovered: true };
    throw new Error(
      "Project could not be read and no valid recovery copy is available.",
    );
  }
}
export function listProjects(storage: StoragePort = localStorage): Project[] {
  const projects: Project[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(PREFIX)) {
      try {
        projects.push(loadProject(key.slice(PREFIX.length), storage).project);
      } catch {
        /* Corrupt files remain untouched. */
      }
    }
  }
  return projects.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}
export function activeProject(storage: StoragePort = localStorage) {
  const id = storage.getItem(ACTIVE);
  return id ? loadProject(id, storage) : null;
}
