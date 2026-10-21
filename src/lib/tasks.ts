// Recent tasks (« Tâches récentes »): every paid run the studio starts, with its state and, on failure, the reason.
// Kept in localStorage so a reload still shows what ran; nothing here ever re-sends a job by itself:
// « Relancer » only reopens the tool, where the quote and the confirmation are asked again.

export type TaskState = "running" | "done" | "failed" | "interrupted";

export interface Task {
  project?: string;
  id: string;
  /** Hub tool id when the task came from a tool (used by « Relancer »). */
  tool: string | null;
  /** i18n key of the label, or a plain label when `plain` is set. */
  label: string;
  plain?: boolean;
  state: TaskState;
  reason: string;
  at: number;
  ended: number | null;
}

const KEY = "u-ttu-taches";
const MAX = 20;
type Listener = (tasks: Task[]) => void;
const listeners = new Set<Listener>();
let cache: Task[] | null = null;

function read(): Task[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as Task[];
    // A task still « running » after a reload lost its tab; the studio's own recovery may still bring the result back.
    cache = Array.isArray(raw) ? raw.map(task => task.state === "running" ? { ...task, state: "interrupted" as const } : task) : [];
  } catch { cache = []; }
  return cache;
}

function write(next: Task[]) {
  cache = next.slice(0, MAX);
  try { window.localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private mode: memory only */ }
  for (const listener of listeners) listener(cache);
}

export function listTasks(): Task[] { return read(); }

export function startTask(input: { tool: string | null; label: string; plain?: boolean; project?: string }): string {
  const id = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  write([{ id, project: input.project, tool: input.tool, label: input.label, plain: input.plain, state: "running", reason: "", at: Date.now(), ended: null }, ...read()]);
  return id;
}

export function endTask(id: string, ok: boolean, reason = "") {
  write(read().map(task => task.id === id ? { ...task, state: ok ? "done" : "failed", reason: ok ? "" : reason, ended: Date.now() } : task));
}

export function clearTasks() { write(read().filter(task => task.state === "running")); }

export function subscribeTasks(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Wraps one paid call: the task is « running » while it lasts, then « done » or « failed » with the studio's reason. */
export async function tracked<T>(input: { tool: string | null; label: string; plain?: boolean; project?: string }, run: () => Promise<T>, judge: (value: T) => { ok: boolean; reason?: string }): Promise<T> {
  const id = startTask(input);
  try {
    const value = await run();
    const verdict = judge(value);
    endTask(id, verdict.ok, verdict.reason ?? "");
    return value;
  } catch (error) {
    endTask(id, false, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
