// Takes of a plan are versions. A new or failed render never replaces a kept take:
// every take stays in Prises/, and « Garder » only marks which one goes to the cut.

export interface TakeLike {
  id: string;
  at: string;
}

/** Takes linked to a plan, oldest first. Unknown ids are skipped. */
export function planVersions<T extends TakeLike>(takeIds: readonly string[], takes: readonly T[]): T[] {
  const found = takeIds.flatMap(id => {
    const take = takes.find(item => item.id === id);
    return take ? [take] : [];
  });
  return found.slice().sort((a, b) => a.at.localeCompare(b.at) || takeIds.indexOf(a.id) - takeIds.indexOf(b.id));
}

/** The kept take when it still exists, otherwise the newest one. */
export function chosenTake<T extends TakeLike>(versions: readonly T[], garde: string): T | null {
  if (versions.length === 0) return null;
  return versions.find(take => take.id === garde) ?? versions[versions.length - 1];
}

/** The take shown: the one the user opened, else the newest (the result they are waiting for). */
export function shownTake<T extends TakeLike>(versions: readonly T[], viewed: string | null): T | null {
  if (versions.length === 0) return null;
  return versions.find(take => take.id === viewed) ?? versions[versions.length - 1];
}

/** Merges take ids so a late save never drops a take that already landed. */
export function mergeTakeIds(...lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) for (const id of list) if (id && !seen.has(id)) { seen.add(id); out.push(id); }
  return out;
}

/** Reads the `prises:` list from a Shots/*.md front matter, as written by the vault. */
export function takeIdsFromShotNote(text: string | null | undefined): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(line => /^prises:\s*$/.test(line));
  if (start < 0) return [];
  const ids: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = /^\s+-\s+"?([A-Za-z0-9-]{1,80})"?\s*$/.exec(line);
    if (!match) break;
    ids.push(match[1]);
  }
  return ids;
}

export interface SequenceEntry<T> {
  planId: string;
  take: T | null;
}

/** The cut, in plan order: each plan brings its kept take, else its newest take. */
export function sequenceTakes<T extends TakeLike>(
  plans: readonly { id: string; garde: string }[],
  shots: readonly { id: string; takeIds: readonly string[] }[],
  takes: readonly T[],
): SequenceEntry<T>[] {
  return plans.map(plan => {
    const ids = shots.find(shot => shot.id === plan.id)?.takeIds ?? [];
    return { planId: plan.id, take: chosenTake(planVersions(ids, takes), plan.garde) };
  });
}
