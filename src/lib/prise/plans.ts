// Shot list edits for PRISE: pure, so the strip, the undo and the tests share one truth.
// A plan id is « plan-NN »; ids are never reused while the plan is still listed.

export function nextPlanId(ids: readonly string[]): string {
  let n = ids.length + 1;
  while (ids.includes(`plan-${String(n).padStart(2, "0")}`)) n += 1;
  return `plan-${String(n).padStart(2, "0")}`;
}

/** Moves one item a step up (-1) or down (+1); touch-friendly twin of drag and drop. */
export function stepMove<T extends { id: string }>(list: readonly T[], id: string, dir: -1 | 1): T[] {
  const at = list.findIndex(item => item.id === id);
  const to = at + dir;
  if (at < 0 || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

export interface Removed<T> { item: T; at: number }

/** Removes a plan and keeps what « Annuler » needs to put it back where it was. */
export function removePlan<T extends { id: string }>(list: readonly T[], id: string): { next: T[]; removed: Removed<T> | null } {
  const at = list.findIndex(item => item.id === id);
  if (at < 0) return { next: [...list], removed: null };
  return { next: list.filter(item => item.id !== id), removed: { item: list[at], at } };
}

export function restorePlan<T extends { id: string }>(list: readonly T[], removed: Removed<T>): T[] {
  if (list.some(item => item.id === removed.item.id)) return [...list];
  const next = [...list];
  next.splice(Math.min(removed.at, next.length), 0, removed.item);
  return next;
}

/** Inserts a copy right after its source: same cast, décor, action, camera; no take, nothing kept. */
export function duplicatePlan<T extends { id: string; name: string }>(list: readonly T[], id: string, fresh: (source: T, id: string) => T, reservedIds: readonly string[] = list.map(item => item.id)): { next: T[]; id: string | null } {
  const at = list.findIndex(item => item.id === id);
  if (at < 0) return { next: [...list], id: null };
  const copyId = nextPlanId([...new Set([...reservedIds, ...list.map(item => item.id)])]);
  const next = [...list];
  next.splice(at + 1, 0, fresh(list[at], copyId));
  return { next, id: copyId };
}
