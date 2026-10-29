// One history for the plan list and its editor. Runtime jobs are never replayed by undo.
export const PLAN_HISTORY_LIMIT = 30;
export const PLAN_HISTORY_FILE = ".uttu/prise-history.json";

export interface Snapshot<T> { plans: T[]; currentId: string }
export interface PlanHistory<T> extends Snapshot<T> {
  past: Snapshot<T>[];
  revision: number;
  group?: string;
  at?: number;
}
export type PlanEdit<T> =
  | { type: "replace"; plans: T[]; currentId?: string; record?: boolean; group?: string; at?: number }
  | { type: "select"; id: string }
  | { type: "undo" };

export function planHistory<T extends { id: string }>(plans: T[], currentId = plans[0]?.id ?? ""): PlanHistory<T> {
  return { plans, currentId, past: [], revision: 0 };
}

export function planReducer<T extends { id: string }>(state: PlanHistory<T>, edit: PlanEdit<T>): PlanHistory<T> {
  if (edit.type === "select") return state.plans.some(plan => plan.id === edit.id) ? { ...state, currentId: edit.id, group: undefined } : state;
  if (edit.type === "undo") {
    const last = state.past.at(-1);
    return last ? { ...last, past: state.past.slice(0, -1), revision: state.revision + 1 } : state;
  }
  if (!edit.plans.length) return state;
  const currentId = edit.currentId ?? state.currentId;
  const selected = edit.plans.some(plan => plan.id === currentId) ? currentId : edit.plans[0].id;
  if (JSON.stringify(edit.plans) === JSON.stringify(state.plans)) return selected === state.currentId ? state : { ...state, currentId: selected };
  const recorded = edit.record !== false;
  // A word typed in one field is one undo step, rather than one step per letter.
  const grouped = edit.group && edit.group === state.group && (edit.at ?? 0) - (state.at ?? 0) < 1000;
  return {
    plans: edit.plans, currentId: selected,
    past: recorded && !grouped ? [...state.past, { plans: state.plans, currentId: state.currentId }].slice(-PLAN_HISTORY_LIMIT) : state.past,
    revision: recorded ? state.revision + 1 : state.revision,
    group: recorded ? edit.group : state.group, at: recorded ? edit.at : state.at,
  };
}

export function historyJson<T>(state: PlanHistory<T>): string {
  return JSON.stringify({ version: 1, plans: state.plans, currentId: state.currentId, past: state.past });
}

/** Reject an incomplete snapshot as a whole; never silently discard a plan. */
export function readPlanHistory<T extends { id: string }>(raw: string | undefined, decode: (data: unknown) => T | null): PlanHistory<T> | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.past)) return null;
    const snapshot = (value: { plans?: unknown; currentId?: unknown }): Snapshot<T> | null => {
      if (!Array.isArray(value?.plans) || value.plans.length < 1 || value.plans.length > 100) return null;
      const plans = value.plans.map(decode);
      if (plans.some(plan => !plan) || new Set(plans.map(plan => plan!.id)).size !== plans.length) return null;
      const found = plans as T[];
      return { plans: found, currentId: found.some(plan => plan.id === value.currentId) ? String(value.currentId) : found[0].id };
    };
    const current = snapshot(data);
    const past = data.past.slice(-PLAN_HISTORY_LIMIT).map(snapshot);
    if (!current || past.some((item: Snapshot<T> | null) => !item)) return null;
    return { ...current, past: past as Snapshot<T>[], revision: 0 };
  } catch { return null; }
}
