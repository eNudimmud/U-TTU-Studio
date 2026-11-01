// CE3: pure storyboard transactions from a validated proposal, and their journaled persistence.
//
// - `storyboard.create` of N shots is one indivisible transaction; new shot ids come from the app.
// - `shot.patch` touches only the allowlisted fields of the one targeted shot.
// - `storyboard.reorder` is an exact permutation of the active shots (nothing lost or duplicated).
// - `shot.duplicate` creates a new shot identity (no take, no film link).
// - `shot.archive` removes the shot from the board and keeps it whole in the sidecar.
// - `*.prepare` change nothing and generate nothing: they return what CE5 may quote. There is no
//   `generate_shot`: generating always waits for the visitor's approval.
// Any failure = zero mutation. Undo = the journal's inverse transaction (CE2).
import type { VaultStore } from "../coffre/store.ts";
import {
  cheminJson, dialogueVide, lireStoryboard, majPlan, planVide, retirerPlan, storyboardJson, tousLesPlans, trouverPlan,
  type PlanSB, type Storyboard,
} from "../storyboard/storyboard.ts";
import { storyboardRevisionOf, shotRevisionOf } from "./context.ts";
import { sha256Text } from "./digest.ts";
import { cinemaMetaPath, markRolledBack, metaJson, noLock, parseMeta, readJournal, runTransaction, undoTransaction, type CinemaMeta, type ProjectLock, type StoredJournal } from "./journal.ts";
import {
  CinemaError, EDITABLE_SHOT_FIELDS, type EditableShotField, type EditableShotPatch, type IntentEnvelope, type Operation, type ShotDraft, type ShotDraftRef,
} from "./types.ts";

export interface BoardState { storyboard: Storyboard; meta: CinemaMeta }

export interface ApplyEnv {
  /** New shot ids, allocated by the application. */
  newShotId: () => string;
  now: string;
  /** Locks as they are now (re-checked at apply time, not only at parse time). */
  locks: Record<string, EditableShotField[]>;
  /** Takes that exist now, by shot (finish/export re-checked). */
  takeIds?: Record<string, string[]>;
}

export type Prepared =
  | { kind: "shot.prepare"; shotId: string; revision: number; output: "keyframe" | "video" }
  | { kind: "take.finish.prepare"; shotId: string; revision: number; sourceTakeId: string; recipeId: string }
  | { kind: "sequence.export.prepare"; takeIds: string[] };

export interface Applied {
  state: BoardState;
  /** Shots whose revision moved: their quotes and approvals are void (the snapshot digest changes). */
  invalidated: string[];
  created: string[];
  prepared: Prepared[];
}

const refPlanOf = (ref: ShotDraftRef) => ({ role: ref.role, nom: ref.name, id: ref.referenceId });

function planFields(draft: Partial<ShotDraft>, base: PlanSB): PlanSB {
  const next: PlanSB = { ...base };
  for (const key of EDITABLE_SHOT_FIELDS) {
    if (!(key in draft)) continue;
    const value = draft[key];
    if (key === "refs") next.refs = (value as ShotDraftRef[]).map(refPlanOf);
    else if (key === "dialogue") {
      const d = value as ShotDraft["dialogue"];
      next.dialogue = { ...base.dialogue, type: d.type, qui: d.qui, texte: d.texte, source: "uttu" };
    } else (next as unknown as Record<string, unknown>)[key] = value;
  }
  return next;
}

function bump(meta: CinemaMeta, shots: string[], board: boolean): CinemaMeta {
  const revisions = { ...meta.revisions };
  for (const id of shots) revisions[id] = shotRevisionOf(meta, id) + 1;
  return { ...meta, revisions, ...(board ? { storyboardRevision: storyboardRevisionOf(meta) + 1 } : {}) };
}

function activeShot(state: BoardState, shotId: string, expectedRevision: number): PlanSB {
  const found = trouverPlan(state.storyboard, shotId);
  if (!found || state.meta.archived.includes(shotId)) throw new CinemaError("REVISION_CONFLICT", "Ce plan n'existe plus.", [shotId]);
  if (shotRevisionOf(state.meta, shotId) !== expectedRevision) throw new CinemaError("REVISION_CONFLICT", "Le plan a changé depuis la proposition.", [shotId]);
  return found.plan;
}

function checkScope(state: BoardState, scope: { storyboardId: string }): void {
  if (scope.storyboardId !== state.storyboard.id) throw new CinemaError("REVISION_CONFLICT", "Autre storyboard.", [scope.storyboardId]);
}

/** Applies one operation in memory. Throws (CinemaError) on any conflict; the caller keeps the old state. */
export function applyOperation(state: BoardState, op: Operation, env: ApplyEnv): Applied {
  const sb = state.storyboard;
  switch (op.kind) {
    case "storyboard.create": {
      checkScope(state, op.scope);
      const ids = op.shots.map(() => env.newShotId());
      if (new Set(ids).size !== ids.length || ids.some(id => trouverPlan(sb, id))) throw new CinemaError("REVISION_CONFLICT", "Identifiant de plan déjà pris.");
      // Appended to the last scene (a first scene is made if none): no ref is inherited implicitly.
      const plans = op.shots.map((draft, i) => planFields(draft, { ...planVide(ids[i], draft.format ?? sb.format), dialogue: dialogueVide() }));
      const sequences = sb.sequences.length ? sb.sequences.map((seq, i) => i === sb.sequences.length - 1 ? { ...seq, plans: [...seq.plans, ...plans] } : seq)
        : [{ id: `${sb.id}-s1`.slice(0, 60), titre: "", resume: "", plans }];
      const storyboard = { ...sb, sequences, majLe: env.now };
      return { state: { storyboard, meta: bump(state.meta, ids, true) }, invalidated: [], created: ids, prepared: [] };
    }
    case "shot.patch": {
      checkScope(state, op.target);
      const plan = activeShot(state, op.target.shotId, op.target.expectedRevision);
      const keys = Object.keys(op.patch) as EditableShotField[];
      if (!keys.length || keys.some(key => !EDITABLE_SHOT_FIELDS.includes(key))) throw new CinemaError("REVISION_CONFLICT", "Champ non modifiable.");
      const locked = keys.filter(key => (env.locks[plan.id] ?? []).includes(key));
      if (locked.length) throw new CinemaError("LOCK_CONFLICT", "Champ verrouillé.", locked);
      const next = planFields(op.patch as Partial<ShotDraft>, plan);
      const { id: _id, ...patch } = next;
      const storyboard = majPlan(sb, plan.id, patch, env.now);
      return { state: { storyboard, meta: bump(state.meta, [plan.id], false) }, invalidated: [plan.id], created: [], prepared: [] };
    }
    case "shot.duplicate": {
      checkScope(state, op.target);
      const plan = activeShot(state, op.target.shotId, op.target.expectedRevision);
      const id = env.newShotId();
      if (trouverPlan(sb, id)) throw new CinemaError("REVISION_CONFLICT", "Identifiant de plan déjà pris.");
      const copy: PlanSB = { ...structuredClone(plan), id, planFilmId: null, etat: "a-tourner" };
      const sequences = sb.sequences.map(seq => {
        const at = seq.plans.findIndex(item => item.id === plan.id);
        if (at < 0) return seq;
        const plans = [...seq.plans];
        plans.splice(at + 1, 0, copy);
        return { ...seq, plans };
      });
      return { state: { storyboard: { ...sb, sequences, majLe: env.now }, meta: bump(state.meta, [id], true) }, invalidated: [], created: [id], prepared: [] };
    }
    case "shot.archive": {
      checkScope(state, op.target);
      const plan = activeShot(state, op.target.shotId, op.target.expectedRevision);
      const meta = bump({ ...state.meta, archived: [...state.meta.archived, plan.id], archivedShots: { ...(state.meta.archivedShots ?? {}), [plan.id]: structuredClone(plan) } }, [plan.id], true);
      return { state: { storyboard: retirerPlan(sb, plan.id, env.now), meta }, invalidated: [plan.id], created: [], prepared: [] };
    }
    case "storyboard.reorder": {
      checkScope(state, op.scope);
      if (storyboardRevisionOf(state.meta) !== op.expectedRevision) throw new CinemaError("REVISION_CONFLICT", "Le storyboard a changé depuis la proposition.");
      const current = tousLesPlans(sb);
      const byId = new Map(current.map(plan => [plan.id, plan]));
      const exact = op.shotIds.length === current.length && new Set(op.shotIds).size === op.shotIds.length && op.shotIds.every(id => byId.has(id));
      if (!exact) throw new CinemaError("REVISION_CONFLICT", "L'ordre proposé n'est pas une permutation exacte des plans.");
      // Global order, each scene keeps its number of shots (as the board reads shots in one line).
      let cursor = 0;
      const sequences = sb.sequences.map(seq => ({ ...seq, plans: seq.plans.map(() => byId.get(op.shotIds[cursor++])!) }));
      return { state: { storyboard: { ...sb, sequences, majLe: env.now }, meta: bump(state.meta, [], true) }, invalidated: [], created: [], prepared: [] };
    }
    case "shot.prepare": {
      activeShot(state, op.target.shotId, op.target.expectedRevision);
      return { state, invalidated: [], created: [], prepared: [{ kind: "shot.prepare", shotId: op.target.shotId, revision: op.target.expectedRevision, output: op.output }] };
    }
    case "take.finish.prepare": {
      activeShot(state, op.target.shotId, op.target.expectedRevision);
      if (!(env.takeIds?.[op.target.shotId] ?? []).includes(op.sourceTakeId)) throw new CinemaError("REVISION_CONFLICT", "La prise source n'existe pas pour ce plan.", [op.sourceTakeId]);
      return { state, invalidated: [], created: [], prepared: [{ kind: "take.finish.prepare", shotId: op.target.shotId, revision: op.target.expectedRevision, sourceTakeId: op.sourceTakeId, recipeId: op.recipeId }] };
    }
    case "sequence.export.prepare": {
      checkScope(state, op.scope);
      const known = Object.values(env.takeIds ?? {}).flat();
      if (!op.takeIds.every(id => known.includes(id))) throw new CinemaError("REVISION_CONFLICT", "Prise inconnue.");
      return { state, invalidated: [], created: [], prepared: [{ kind: "sequence.export.prepare", takeIds: [...op.takeIds] }] };
    }
  }
}

/** All operations of a proposal, or none. */
export function applyEnvelope(state: BoardState, envelope: IntentEnvelope, env: ApplyEnv): Applied {
  let current: Applied = { state, invalidated: [], created: [], prepared: [] };
  for (const op of envelope.operations) {
    const step = applyOperation(current.state, op, env);
    current = {
      state: step.state,
      invalidated: [...new Set([...current.invalidated, ...step.invalidated])],
      created: [...current.created, ...step.created],
      prepared: [...current.prepared, ...step.prepared],
    };
  }
  return current;
}

// ---------------------------------------------------------------- persistence (CE2 journal)

export interface CommitResult extends Applied { journal: StoredJournal | null }

/**
 * Reads the board and its sidecar, applies the whole proposal in memory, then writes both in one
 * journaled transaction (`operationId` from the envelope). Stale revision, lock or unknown write =
 * nothing written. A proposal with only `prepare` writes nothing.
 */
export async function commitIntent(files: VaultStore, lock: ProjectLock, envelope: IntentEnvelope, env: ApplyEnv & { now: string }): Promise<CommitResult> {
  const scope = envelope.operations.map(op => ("scope" in op ? op.scope : op.target)).find(Boolean);
  if (!scope) throw new CinemaError("REVISION_CONFLICT", "Aucune opération.");
  const boardPath = cheminJson(scope.storyboardId);
  const metaPath = cinemaMetaPath(scope.storyboardId);
  // Read, apply and write under one hold of the project lock, so nothing slips in between.
  return lock(scope.projectId, async () => {
    const storyboard = lireStoryboard((await files.get(boardPath))?.text ?? null);
    if (!storyboard) throw new CinemaError("PROJECT_UNAVAILABLE", "Storyboard illisible.", [boardPath]);
    const meta = parseMeta((await files.get(metaPath))?.text ?? null, storyboard.id);
    const applied = applyEnvelope({ storyboard, meta }, envelope, env);
    if (applied.state.storyboard === storyboard && applied.state.meta === meta) return { ...applied, journal: null };
    const journal = await runTransaction(files, noLock, {
      operationId: envelope.operationId, scope: { projectId: scope.projectId, storyboardId: scope.storyboardId },
      writes: [{ path: boardPath, text: storyboardJson(applied.state.storyboard) }, { path: metaPath, text: metaJson(applied.state.meta) }],
      now: () => env.now,
    });
    if (journal.state === "conflict") throw new CinemaError("REVISION_CONFLICT", "Écriture inconnue pendant l'opération : les deux versions sont conservées.", journal.conflicts ?? []);
    return { ...applied, journal };
  });
}

/**
 * Undo after save: an inverse transaction that brings the board back, refused when it changed since.
 * Revisions never go back: every shot touched gets a new revision, so a quote or approval made
 * before or after the undone operation can never authorise a new spend.
 */
export async function undoIntent(files: VaultStore, lock: ProjectLock, operationId: string, undoId: string, now: string): Promise<StoredJournal> {
  const projectId = (await readJournal(files, operationId))?.scope.projectId;
  if (!projectId) throw new CinemaError("REVISION_CONFLICT", "Rien d'appliqué à annuler.", [operationId]);
  return lock(projectId, async () => {
    const entry = await readJournal(files, operationId);
    if (!entry || entry.state !== "applied") throw new CinemaError("REVISION_CONFLICT", "Rien d'appliqué à annuler.", [operationId]);
    const boardIndex = entry.targets.findIndex(t => /\.uttu\/sb-/.test(t.path));
    const metaIndex = entry.targets.findIndex(t => /\.uttu\/cinema-/.test(t.path));
    if (boardIndex < 0 || metaIndex < 0) return undoTransaction(files, noLock, operationId, undoId, () => now);
    for (const target of entry.targets) {
      const text = (await files.get(target.path))?.text;
      if (typeof text !== "string" || (await sha256Text(text)) !== target.after) throw new CinemaError("REVISION_CONFLICT", "Le storyboard a changé depuis : l'annulation ne l'écrase pas.", [target.path]);
    }
    const beforeBoard = entry.payload.before[boardIndex];
    if (beforeBoard === null) throw new CinemaError("REVISION_CONFLICT", "Rien à restaurer.", [entry.targets[boardIndex].path]);
    const after = parseMeta(entry.payload.after[metaIndex], entry.scope.storyboardId);
    const before = parseMeta(entry.payload.before[metaIndex], entry.scope.storyboardId);
    const touched = new Set([...Object.keys(after.revisions), ...Object.keys(before.revisions)].filter(id => after.revisions[id] !== before.revisions[id]));
    const revisions = { ...before.revisions };
    for (const id of touched) revisions[id] = (after.revisions[id] ?? 0) + 1;
    const meta: CinemaMeta = { ...before, revisions, storyboardRevision: storyboardRevisionOf(after) + 1, takes: after.takes, settled: after.settled };
    const undo = await runTransaction(files, noLock, {
      operationId: undoId, scope: entry.scope, inverseOf: operationId, now: () => now,
      writes: [{ path: entry.targets[boardIndex].path, text: beforeBoard }, { path: entry.targets[metaIndex].path, text: metaJson(meta) }],
    });
    if (undo.state === "applied") await markRolledBack(files, operationId, () => now);
    return undo;
  });
}
