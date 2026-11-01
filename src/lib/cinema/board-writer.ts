// CE5 · the storyboard page's writer, through the common revision path (CE5 §4 « Persistance »).
//
// The page keeps the board in memory and saves it a moment later. Between its last read and that save,
// another writer may have changed the file: a settlement linking a take (`planFilmId`), the native agent,
// another tab. Rewriting the whole board from memory would erase them. So a save is a three-way merge:
//   base = the file as the page last read or wrote it, mine = the page's board, disk = the file now.
// Per field: what the page changed wins, what it left alone follows the disk; both changed it differently =
// the disk is kept and the page's version is written beside it (`conflicts`), never lost.
// A removed shot is archived whole in the sidecar. Every shot whose editable fields move gets a new
// revision (its quotes and approvals are void), the board revision moves with its structure.
// Pure: the caller reads and writes under the project lock, inside one journaled transaction.
import type { VaultStore } from "../coffre/store.ts";
import { cheminJson, lireStoryboard, storyboardJson, type PlanSB, type Sequence, type Storyboard } from "../storyboard/storyboard.ts";
import { shotRevisionOf, storyboardRevisionOf } from "./context.ts";
import { cinemaMetaPath, journalPath, metaJson, parseMeta, runComputedTransaction, type CinemaMeta, type ProjectLock } from "./journal.ts";
import { CinemaError, EDITABLE_SHOT_FIELDS } from "./types.ts";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const BOARD_FIELDS = ["titre", "idee", "logline", "scenario", "format", "dureeCible", "musique", "archive"] as const;
const SEQUENCE_FIELDS = ["titre", "resume"] as const;

export interface Rebased {
  board: Storyboard;
  meta: CinemaMeta;
  /** Shots whose editable fields moved against the disk: their revision was bumped. */
  invalidated: string[];
  /** `shotId.field` or `board.field` where the page and the disk disagree; the disk was kept. */
  conflicts: string[];
}

function merge3<T>(base: T | undefined, mine: T, disk: T, label: string, conflicts: string[]): T {
  if (same(mine, disk)) return disk;
  if (base !== undefined && same(mine, base)) return disk;
  if (base !== undefined && same(disk, base)) return mine;
  if (base === undefined) return mine;
  conflicts.push(label);
  return disk;
}

function mergeShot(base: PlanSB | undefined, mine: PlanSB, disk: PlanSB, conflicts: string[]): PlanSB {
  const out = { ...disk } as Record<string, unknown>;
  for (const key of Object.keys({ ...disk, ...mine }) as (keyof PlanSB)[]) {
    if (key === "id") continue;
    out[key] = merge3(base?.[key], mine[key], disk[key], `${mine.id}.${key}`, conflicts);
  }
  return out as unknown as PlanSB;
}

const shotsOf = (sb: Storyboard | null) => new Map((sb?.sequences ?? []).flatMap(seq => seq.plans.map(plan => [plan.id, plan] as const)));
const orderOf = (sb: Storyboard) => sb.sequences.map(seq => `${seq.id}:${seq.plans.map(plan => plan.id).join(",")}`).join("|");

/** The board to write and its sidecar. `base` null = the page never read this file (a new board). */
export function rebaseBoard(base: Storyboard | null, mine: Storyboard, disk: Storyboard | null, meta: CinemaMeta): Rebased {
  const conflicts: string[] = [];
  if (!disk) return { board: mine, meta, invalidated: [], conflicts };
  const baseShots = shotsOf(base ?? disk);
  const mineShots = shotsOf(mine);
  const diskShots = shotsOf(disk);
  const archivedShots: Record<string, unknown> = { ...(meta.archivedShots ?? {}) };
  const archived = new Set(meta.archived);

  // The page's structure (order, sequences) wins; shots it removed go, shots it never saw stay where they were.
  const kept = (id: string) => {
    if (!diskShots.has(id)) return !baseShots.has(id); // removed elsewhere: gone, unless the page created it
    return true;
  };
  const sequences: Sequence[] = mine.sequences.map(seq => {
    const baseSeq = (base ?? disk).sequences.find(item => item.id === seq.id);
    const diskSeq = disk.sequences.find(item => item.id === seq.id);
    const fields = Object.fromEntries(SEQUENCE_FIELDS.map(key => [key, diskSeq ? merge3(baseSeq?.[key], seq[key], diskSeq[key], `${seq.id}.${key}`, conflicts) : seq[key]]));
    const plans = seq.plans.filter(plan => kept(plan.id)).map(plan => {
      const now = diskShots.get(plan.id);
      return now ? mergeShot(baseShots.get(plan.id), plan, now, conflicts) : plan;
    });
    return { ...seq, ...fields, plans } as Sequence;
  });
  // A shot the page edited but another writer removed: the removal stands, the page's version is kept beside.
  for (const [id] of mineShots) if (baseShots.has(id) && !diskShots.has(id) && !same(baseShots.get(id), mineShots.get(id))) conflicts.push(`${id}.removed`);
  // Shots added on the disk since the page read it: inserted after the shot that precedes them there.
  const placed = new Set(sequences.flatMap(seq => seq.plans.map(plan => plan.id)));
  for (const seq of disk.sequences) {
    seq.plans.forEach((plan, index) => {
      if (placed.has(plan.id) || baseShots.has(plan.id)) return;
      const target = sequences.find(item => item.id === seq.id) ?? sequences[sequences.length - 1];
      if (!target) return;
      const before = seq.plans.slice(0, index).reverse().find(item => target.plans.some(p => p.id === item.id));
      const at = before ? target.plans.findIndex(p => p.id === before.id) + 1 : 0;
      target.plans.splice(at, 0, plan);
      placed.add(plan.id);
    });
  }
  // Removed by the page: archived whole in the sidecar, with its take history untouched.
  for (const [id, plan] of diskShots) {
    if (placed.has(id)) continue;
    archivedShots[id] = plan;
    archived.add(id);
  }

  const boardFields = Object.fromEntries(BOARD_FIELDS.map(key => [key, merge3(base?.[key], mine[key], disk[key], `board.${key}`, conflicts)]));
  const board: Storyboard = { ...mine, ...boardFields, sequences, majLe: mine.majLe > disk.majLe ? mine.majLe : disk.majLe } as Storyboard;

  const finalShots = shotsOf(board);
  const invalidated = [...finalShots].filter(([id, plan]) => {
    const was = diskShots.get(id);
    return was && EDITABLE_SHOT_FIELDS.some(key => !same(plan[key], was[key]));
  }).map(([id]) => id);
  const structural = orderOf(board) !== orderOf(disk) || BOARD_FIELDS.some(key => !same(board[key], disk[key]));
  const revisions = { ...meta.revisions };
  for (const id of invalidated) revisions[id] = shotRevisionOf(meta, id) + 1;
  const changed = invalidated.length > 0 || structural || archived.size !== meta.archived.length;
  const nextMeta: CinemaMeta = changed ? {
    ...meta, revisions, archived: [...archived],
    ...(Object.keys(archivedShots).length ? { archivedShots } : {}),
    ...(structural ? { storyboardRevision: storyboardRevisionOf(meta) + 1 } : {}),
  } : meta;
  return { board, meta: nextMeta, invalidated, conflicts };
}

// ---------------------------------------------------------------- journaled save


export interface SavedBoard {
  /** The board as it is now in the file (what the page must hold next as its base). */
  board: Storyboard;
  invalidated: string[];
  conflicts: string[];
  /** Where the page's own version was kept when it clashed with the file. */
  keptBeside: string | null;
}

/** `.uttu/sb-<id>.page-<op>.json`: the page's version, kept beside the file when they clash. */
export const pageCopyPath = (boardId: string, operationId: string) => cheminJson(boardId).replace(/\.json$/, `.page-${operationId.replace(/[^\w-]/g, "").slice(0, 40)}.json`);

/**
 * One save of the page = one journaled transaction (board + sidecar), computed under the project lock from
 * the files as they are now. A replay of the same id finishes the stored journal and computes nothing again.
 * The journal of a clean save is removed once applied (it only served atomicity; undo is a new save).
 */
export async function saveBoard(files: VaultStore, lock: ProjectLock, input: { projectId: string; operationId: string; base: Storyboard | null; mine: Storyboard; now: () => string }): Promise<SavedBoard> {
  const boardPath = cheminJson(input.mine.id);
  const metaPath = cinemaMetaPath(input.mine.id);
  let result: Rebased | null = null;
  const journal = await runComputedTransaction(files, lock, {
    operationId: input.operationId, scope: { projectId: input.projectId, storyboardId: input.mine.id }, now: input.now,
    compute: async () => {
      const raw = (await files.get(boardPath))?.text ?? null;
      const disk = lireStoryboard(raw);
      if (raw !== null && !disk) throw new CinemaError("STORAGE_UNAVAILABLE", "Storyboard illisible : rien n'est réécrit.", [boardPath]);
      const metaRaw = (await files.get(metaPath))?.text ?? null;
      const meta = parseMeta(metaRaw, input.mine.id);
      result = rebaseBoard(input.base, input.mine, disk, meta);
      const writes = [{ path: boardPath, text: storyboardJson(result.board) }];
      if (result.meta !== meta || metaRaw === null) writes.push({ path: metaPath, text: metaJson(result.meta) });
      return writes;
    },
  });
  const done = result as Rebased | null;
  if (journal.state === "conflict") throw new CinemaError("REVISION_CONFLICT", "Écriture inconnue pendant la sauvegarde : les deux versions sont conservées.", journal.conflicts ?? []);
  let keptBeside: string | null = null;
  if (done && done.conflicts.length) {
    keptBeside = pageCopyPath(input.mine.id, input.operationId);
    await files.put({ path: keptBeside, text: storyboardJson(input.mine), updatedAt: Date.parse(input.now()) || 0 });
  } else if (journal.state === "applied") {
    await files.remove(journalPath(input.operationId)).catch(() => undefined);
  }
  const board = lireStoryboard((await files.get(boardPath))?.text ?? null) ?? done?.board ?? input.mine;
  return { board, invalidated: done?.invalidated ?? [], conflicts: done?.conflicts ?? [], keptBeside };
}
