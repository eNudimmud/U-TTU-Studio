// The form of each tool, kept when you leave it and come back (another tool, Back, a reload).
// In memory it keeps everything, picked files included. In sessionStorage (this tab only) it
// keeps what survives a reload: the text, the settings, and pictures that have a lasting address.
// It never starts a render and never keeps the « I have the rights » box ticked.
import type { GenjutsuResolution } from "./genjutsu.ts";

export interface DraftInput { url: string; name: string; file?: File; path?: string; aspect?: "horizontal" | "vertical" }

export interface ToolDraft {
  inputs: Record<string, DraftInput | null>;
  text: string;
  aspect: "horizontal" | "vertical";
  side: string;
  fluide: boolean;
  mesh: "objet" | "perso";
  resolution?: GenjutsuResolution;
  camera?: string;
  piste?: string;
}

const KEY = "u-ttu-brouillons";
const memory = new Map<string, ToolDraft>();

/** Nothing typed, nothing picked: no draft worth keeping. */
export function draftEmpty(draft: ToolDraft): boolean {
  return !draft.text.trim() && !Object.values(draft.inputs).some(Boolean);
}

/** What can go to sessionStorage: a blob: address dies with the page, so only lasting ones, or a studio path to resolve again. */
export function lasting(draft: ToolDraft): ToolDraft {
  const inputs: Record<string, DraftInput | null> = {};
  for (const [slot, value] of Object.entries(draft.inputs)) {
    if (!value) continue;
    if (value.path) inputs[slot] = { url: "", name: value.name, path: value.path, aspect: value.aspect };
    else if (!value.file && !value.url.startsWith("blob:")) inputs[slot] = { url: value.url, name: value.name, aspect: value.aspect };
  }
  return { ...draft, inputs };
}

function readStored(): Record<string, ToolDraft> {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed as Record<string, ToolDraft> : {};
  } catch {
    return {};
  }
}

/** The draft of one tool, or null. `resolve` turns a studio path back into an address after a reload. */
export function loadDraft(tool: string, resolve: (path: string) => string | undefined): ToolDraft | null {
  const held = memory.get(tool);
  if (held) return held;
  if (typeof window === "undefined") return null;
  const stored = readStored()[tool];
  if (!stored || typeof stored.text !== "string" || typeof stored.inputs !== "object") return null;
  const inputs: Record<string, DraftInput | null> = {};
  for (const [slot, value] of Object.entries(stored.inputs ?? {})) {
    if (!value) continue;
    const url = value.path ? resolve(value.path) : value.url;
    if (url) inputs[slot] = { ...value, url };
  }
  return { ...stored, inputs };
}

export function saveDraft(tool: string, draft: ToolDraft): void {
  const empty = draftEmpty(draft);
  if (empty) memory.delete(tool);
  else memory.set(tool, draft);
  if (typeof window === "undefined") return;
  try {
    const all = readStored();
    if (empty) delete all[tool];
    else all[tool] = lasting(draft);
    window.sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* memory only */ }
}

/** Test hook: forget everything held in memory. */
export function forgetDrafts(): void {
  memory.clear();
}
