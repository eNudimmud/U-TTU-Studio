// CE5 · the storyboard page's writer, through the common revision path (CE5 §4 « Persistance »).
//
// The page keeps the board in memory and saves it a moment later. Between its last read and that save,
// another writer may have changed the file: a settlement linking a take (`planFilmId`), the native agent,
// another tab. Rewriting the whole board from memory would erase them. So a save is a three-way merge:
//   base = the file as the page last read or wrote it, mine = the page's board, disk = the file now.
// Per field: what the page changed wins, what it left alone follows the disk; both changed it differently =
// the disk is kept and the page's version is written beside it (`conflicts`), never lost.
// A removed shot is archived whole in the sidecar; a shot the page restores becomes active again with a new revision.
// Structure (order, sequences, parent) is merged three ways as well: a structure the page left alone follows the disk. Every shot whose editable fields move gets a new
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

  // Structure (sequence order, shot order, parent sequence) is merged three ways too (CE5-W, R8):
  // the page's structure wins only where the page moved something; a structure the page left alone
  // follows the disk; both moved differently = conflict, the disk's structure is kept (page copy beside).
  const removedElsewhere = (id: string) => !diskShots.has(id) && baseShots.has(id);
  const removedByPage = (id: string) => baseShots.has(id) && !mineShots.has(id);
  const common = new Set([...baseShots.keys()].filter(id => mineShots.has(id) && diskShots.has(id)));
  const baseSeqIds = new Set((base ?? disk).sequences.map(seq => seq.id));
  const skeleton = (sb: Storyboard) => sb.sequences.filter(seq => baseSeqIds.has(seq.id)).map(seq => [seq.id, seq.plans.map(plan => plan.id).filter(id => common.has(id))]);
  const pageMoved = !same(skeleton(mine), skeleton(base ?? disk));
  const diskMoved = !same(skeleton(disk), skeleton(base ?? disk));
  const structureClash = pageMoved && diskMoved && !same(skeleton(mine), skeleton(disk));
  if (structureClash) conflicts.push("board.structure");
  const followDisk = structureClash || (!pageMoved && diskMoved);

  const mergeSeq = (seq: Sequence, from: "mine" | "disk"): Sequence => {
    const baseSeq = (base ?? disk).sequences.find(item => item.id === seq.id);
    const mineSeq = mine.sequences.find(item => item.id === seq.id);
    const diskSeq = disk.sequences.find(item => item.id === seq.id);
    const fields = Object.fromEntries(SEQUENCE_FIELDS.map(key => [key, mineSeq && diskSeq ? merge3(baseSeq?.[key], mineSeq[key], diskSeq[key], `${seq.id}.${key}`, conflicts) : seq[key]]));
    const plans = seq.plans.filter(plan => from === "mine" ? !removedElsewhere(plan.id) || !baseShots.has(plan.id) : !removedByPage(plan.id) || structureClash).map(plan => {
      const now = diskShots.get(plan.id);
      const page = mineShots.get(plan.id);
      return now && page ? mergeShot(baseShots.get(plan.id), page, now, conflicts) : plan;
    });
    return { ...seq, ...fields, plans } as Sequence;
  };
  // The side whose structure stands; the other side's new shots and sequences are inserted after what precedes them there.
  const [lead, other] = followDisk ? [disk, mine] : [mine, disk];
  const sequences: Sequence[] = lead.sequences
    .filter(seq => followDisk ? !(baseSeqIds.has(seq.id) && !mine.sequences.some(item => item.id === seq.id) && !structureClash) : true)
    .map(seq => mergeSeq(seq, followDisk ? "disk" : "mine"));
  for (const [index, seq] of other.sequences.entries()) {
    if (sequences.some(item => item.id === seq.id) || baseSeqIds.has(seq.id)) continue;
    const before = other.sequences.slice(0, index).reverse().find(item => sequences.some(s => s.id === item.id));
    sequences.splice(before ? sequences.findIndex(s => s.id === before.id) + 1 : 0, 0, { ...seq, plans: [] });
  }
  // A shot the page edited but another writer removed: the removal stands, the page's version is kept beside.
  for (const [id] of mineShots) if (baseShots.has(id) && !diskShots.has(id) && !same(baseShots.get(id), mineShots.get(id))) conflicts.push(`${id}.removed`);
  const placed = new Set(sequences.flatMap(seq => seq.plans.map(plan => plan.id)));
  for (const seq of other.sequences) {
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
  // R9 · a shot the page brought back (absent from its base, present on its board, archived in the
  // sidecar) is restored explicitly: active again, a new revision (a keyframe or a quote from before
  // the archive never becomes valid again), its takes and archived copy kept as history. A shot
  // removed by another writer is never resurrected here (it is in the page's base, so it stays gone).
  const restored = [...placed].filter(id => archived.has(id) && !baseShots.has(id) && mineShots.has(id));
  for (const id of restored) archived.delete(id);

  const boardFields = Object.fromEntries(BOARD_FIELDS.map(key => [key, merge3(base?.[key], mine[key], disk[key], `board.${key}`, conflicts)]));
  const board: Storyboard = { ...mine, ...boardFields, sequences, majLe: mine.majLe > disk.majLe ? mine.majLe : disk.majLe } as Storyboard;

  const finalShots = shotsOf(board);
  const invalidated = [...finalShots].filter(([id, plan]) => {
    const was = diskShots.get(id);
    return was && EDITABLE_SHOT_FIELDS.some(key => !same(plan[key], was[key]));
  }).map(([id]) => id);
  const structural = orderOf(board) !== orderOf(disk) || BOARD_FIELDS.some(key => !same(board[key], disk[key]));
  const revisions = { ...meta.revisions };
  for (const id of new Set([...invalidated, ...restored])) revisions[id] = shotRevisionOf(meta, id) + 1;
  const changed = invalidated.length > 0 || restored.length > 0 || structural || archived.size !== meta.archived.length;
  const nextMeta: CinemaMeta = changed ? {
    ...meta, revisions, archived: [...archived],
    ...(Object.keys(archivedShots).length ? { archivedShots } : {}),
    ...(restored.length ? { restoredShots: { ...((meta as { restoredShots?: Record<string, string> }).restoredShots ?? {}), ...Object.fromEntries(restored.map(id => [id, nowOf(board)])) } } : {}),
    ...(structural ? { storyboardRevision: storyboardRevisionOf(meta) + 1 } : {}),
  } : meta;
  return { board, meta: nextMeta, invalidated: [...new Set([...invalidated, ...restored])], conflicts };
}

const nowOf = (sb: Storyboard) => sb.majLe;

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
 * CE5-W · the applied journal of every save is kept (idempotence of a replay, traceability, inverse):
 * never removed right after a « clean » save.
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
  }
  const board = lireStoryboard((await files.get(boardPath))?.text ?? null) ?? done?.board ?? input.mine;
  return { board, invalidated: done?.invalidated ?? [], conflicts: done?.conflicts ?? [], keptBeside };
}
