// CE2: a finished Comfy job settles into the project and the shot it was sent from, even when the
// storyboard page is closed or another project is open.
//
//   durable asset → registre take → projections (cinema sidecar, storyboard link) → settled
//
// Each step is replayable: the asset path and the take id derive from (accountScope, providerJobId,
// outputIndex), the two metadata steps are journaled transactions (journal.ts). Running settle twice,
// from two tabs, after a crash between any two writes, or on a duplicated result gives one take and
// one media per output. Nothing here POSTs, polls or cancels a job.
import type { VaultStore } from "../coffre/store.ts";
import { ajouterPlan, ajouterPrise, lireRegistre, nouveauPlan, registreJson, REGISTRE_FILE } from "../film/registre.ts";
import { RenderError, jobStage, type RenderClient } from "../render/client.ts";
import { PENDING_RENDER_KEY, readPending, type PendingRender } from "../render/recovery.ts";
import { OPEN_WEIGHTS_MODE } from "../open-weights.ts";
import { cheminJson, lireStoryboard, majPlan, storyboardJson, trouverPlan } from "../storyboard/storyboard.ts";
import { assertNoSecretFields, sha256Text } from "./digest.ts";
import { advance } from "./intent-job.ts";
import { markUncertain, readLedger, release, reserve, submissionBusy, writeLedger } from "./spend-ledger.ts";
import { assertSubmittable } from "./workflow-policy.ts";
import { cinemaMetaPath, metaJson, parseMeta, projectFiles, runTransaction, type CinemaMeta, type ProjectLock, type Write } from "./journal.ts";
import { CinemaError, type CinemaDiagnostic, type JobOutputRef, type JobReceipt, type ObservedCost, type Quote, type ShotSnapshot, type SpendApproval, type StorageLike, type TakeProvenance } from "./types.ts";

export interface ShotJobReceipt extends JobReceipt { snapshot: ShotSnapshot }

export function isShotReceipt(receipt: JobReceipt): receipt is ShotJobReceipt {
  const snapshot = receipt.snapshot as Partial<ShotSnapshot> & { kind?: string };
  return snapshot.kind !== "intent" && typeof snapshot.shotId === "string" && typeof snapshot.planFilmId === "string";
}

/**
 * One authority for the paid take: the existing `u-ttu-operation` receipt (PendingRender v1) carries the
 * v2 cinema receipt as an additive field. Older builds read it as before and ignore the field.
 */
export type PendingWithCinema = PendingRender & { cinema?: ShotJobReceipt };

export function withCinemaReceipt(pending: PendingRender, receipt: ShotJobReceipt): PendingWithCinema {
  if (pending.project !== receipt.snapshot.scope.projectId) throw new Error("Le reçu et le plan ne sont pas du même projet.");
  return { ...pending, cinema: receipt };
}

export function cinemaReceiptOf(pending: PendingRender | null): ShotJobReceipt | null {
  const cinema = (pending as PendingWithCinema | null)?.cinema;
  return cinema && cinema.schemaVersion === 2 && isShotReceipt(cinema) && cinema.snapshot.scope.projectId === pending!.project ? cinema : null;
}

/** What the provider returned for one output, before it is saved. */
export interface ProviderOutput { index: number; filename: string; subfolder?: string; type?: string; kind: "video" | "image" }

export interface SettlementPorts {
  /** The whole vault: settlement scopes it to the receipt's project itself. */
  vault: VaultStore;
  /** False when the project folder is gone, unmounted, or permission was withdrawn. */
  projectAvailable(projectId: string): Promise<boolean>;
  /** GET of one output on the receipt's account (client.file). */
  download(output: ProviderOutput): Promise<Blob>;
  lock: ProjectLock;
  now(): string;
}

export interface SettleRequest {
  receipt: ShotJobReceipt;
  outputs: ProviderOutput[];
  cost: ObservedCost;
  /** The account connected now. A receipt from another account is kept pending, never attached elsewhere. */
  currentAccountScope: string | null;
}

export type SettleOutcome = "settled" | "result_pending";

export interface SettleResult {
  outcome: SettleOutcome;
  receipt: ShotJobReceipt;
  takeIds: string[];
  /** The result came back for an older revision of the shot: a variant, shown as « Result from an earlier version ». */
  fromEarlierRevision: boolean;
  diagnostics: CinemaDiagnostic[];
}

export const dedupKey = (accountScope: string, providerJobId: string, outputIndex: number) => `${accountScope}|${providerJobId}|${outputIndex}`;

/** Stable per output: the same job output always maps to the same take id and media path. */
export async function takeIdOf(accountScope: string, providerJobId: string, outputIndex: number): Promise<string> {
  return `c-${(await sha256Text(dedupKey(accountScope, providerJobId, outputIndex))).slice(0, 20)}`;
}

const extOf = (output: ProviderOutput) => {
  const ext = /\.([a-z0-9]{2,5})$/i.exec(output.filename)?.[1]?.toLowerCase();
  return ext ?? (output.kind === "video" ? "mp4" : "png");
};

async function blobSha(blob: Blob): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

const pending = (receipt: ShotJobReceipt, now: string, diagnostics: CinemaDiagnostic[], patch: Partial<ShotJobReceipt> = {}): SettleResult => ({
  outcome: "result_pending",
  receipt: { ...receipt, ...patch, state: patch.state ?? (receipt.state === "settled" ? "settled" : "result_pending"), updatedAt: now },
  takeIds: [], fromEarlierRevision: false, diagnostics,
});

export async function settleShotJob(request: SettleRequest, ports: SettlementPorts): Promise<SettleResult> {
  const { receipt } = request;
  const now = ports.now();
  const { projectId, storyboardId } = receipt.snapshot.scope;
  if (receipt.state === "settled") return { outcome: "settled", receipt, takeIds: [], fromEarlierRevision: false, diagnostics: [] };
  if (!["succeeded", "result_pending"].includes(receipt.state) || !receipt.providerJobId) {
    return pending(receipt, now, [{ code: "OUTPUT_INVALID", detail: `state ${receipt.state}` }], { state: receipt.state });
  }
  if (request.currentAccountScope !== receipt.accountScope) return pending(receipt, now, [{ code: "ACCOUNT_CHANGED", detail: "the result stays on its account" }]);
  if (!(await ports.projectAvailable(projectId).catch(() => false))) return pending(receipt, now, [{ code: "PROJECT_UNAVAILABLE", detail: projectId }]);
  if (!request.outputs.length) return pending(receipt, now, [{ code: "OUTPUT_INVALID", detail: "no output" }]);

  const files = projectFiles(ports.vault, projectId);
  const jobId = receipt.providerJobId;
  const diagnostics: CinemaDiagnostic[] = [];

  // A duplicate result (second tab, replayed poll, receipt lost after settling): nothing is fetched or written again.
  try {
    const known = parseMeta((await files.get(cinemaMetaPath(storyboardId)))?.text ?? null, storyboardId);
    if (request.outputs.every(output => alreadySettled(known, receipt.accountScope, jobId, output.index))) {
      const takeIds = await Promise.all(request.outputs.map(output => takeIdOf(receipt.accountScope, jobId, output.index)));
      return { outcome: "settled", receipt: { ...receipt, state: "settled", settlement: "projections_saved", updatedAt: now }, takeIds, fromEarlierRevision: takeIds.some(id => known.takes[id]?.fromEarlierRevision), diagnostics: [{ code: "ALREADY_SETTLED" }] };
    }
  } catch (error) { return pending(receipt, now, [{ code: "STORAGE_UNAVAILABLE", detail: error instanceof Error ? error.message : "meta" }]); }

  // 1. Durable assets. The media path is deterministic, so a crash after the put is found again.
  const saved: { output: ProviderOutput; takeId: string; path: string; ref: JobOutputRef }[] = [];
  for (const output of [...request.outputs].sort((a, b) => a.index - b.index)) {
    const takeId = await takeIdOf(receipt.accountScope, jobId, output.index);
    const path = `Prises/${takeId}.${extOf(output)}`;
    let blob = (await files.get(path).catch(() => null))?.blob ?? null;
    if (!blob || blob.size === 0) {
      // Absent, or a partial write of our own file: fetch again (GET only) and write the whole file.
      try { blob = await ports.download(output); }
      catch (error) { return pending(receipt, now, [{ code: "OUTPUT_INVALID", detail: `download ${output.index}: ${error instanceof Error ? error.message : "failed"}` }]); }
      if (!blob || blob.size === 0) return pending(receipt, now, [{ code: "OUTPUT_INVALID", detail: `empty output ${output.index}` }]);
      try { await files.put({ path, blob, updatedAt: Date.parse(now) || 0 }); }
      catch (error) { return pending(receipt, now, [{ code: "STORAGE_UNAVAILABLE", detail: error instanceof Error ? error.message : "write failed" }]); }
      const back = (await files.get(path).catch(() => null))?.blob;
      if (!back || back.size !== blob.size) return pending(receipt, now, [{ code: "STORAGE_UNAVAILABLE", detail: `partial ${path}` }]);
    }
    saved.push({ output, takeId, path, ref: { assetId: `Projets/${projectId}/${path}`, kind: output.kind, sha256: await blobSha(blob) } });
  }
  let current: ShotJobReceipt = { ...receipt, state: "result_pending", outputs: saved.map(item => item.ref), settlement: "assets_saved", updatedAt: now };

  let meta: CinemaMeta;
  try { meta = parseMeta((await files.get(cinemaMetaPath(storyboardId)))?.text ?? null, storyboardId); }
  catch (error) { return pending(current, now, [{ code: "STORAGE_UNAVAILABLE", detail: error instanceof Error ? error.message : "meta" }]); }
  const shotId = receipt.snapshot.shotId;
  const fromEarlierRevision = (meta.revisions[shotId] ?? receipt.snapshot.revision) > receipt.snapshot.revision;
  const scope = receipt.snapshot.scope;

  try {
    // 2. Registre takes. A plan missing from the registre is created; an existing kept take is never replaced.
    const registreText = (await files.get(REGISTRE_FILE))?.text ?? null;
    let registre = lireRegistre(registreText);
    const planId = receipt.snapshot.planFilmId;
    if (!registre.plans.some(plan => plan.id === planId)) registre = ajouterPlan(registre, nouveauPlan(registre, planId));
    for (const item of saved) registre = ajouterPrise(registre, planId, { id: item.takeId, fichier: item.ref.assetId });
    await runTransaction(files, ports.lock, { operationId: `${receipt.attemptId}.take`, scope, writes: [{ path: REGISTRE_FILE, text: registreJson(registre) }], now: ports.now })
      .then(entry => { if (entry.state === "conflict") diagnostics.push({ code: "REVISION_CONFLICT", detail: REGISTRE_FILE }); });
    current = { ...current, settlement: "take_saved" };

    // 3. Projections: provenance + dedup keys in the sidecar, the storyboard link if the shot is still there.
    const latestMeta = parseMeta((await files.get(cinemaMetaPath(storyboardId)))?.text ?? null, storyboardId);
    const nextMeta: CinemaMeta = { ...latestMeta, takes: { ...latestMeta.takes }, settled: [...latestMeta.settled] };
    for (const item of saved) {
      const provenance: TakeProvenance = {
        operationId: receipt.operationId, attemptId: receipt.attemptId, shotId, revision: receipt.snapshot.revision,
        workflowDigest: receipt.approval.workflowDigest, assetIds: [item.ref.assetId],
        ...(receipt.snapshot.sourceTakeId ? { sourceTakeId: receipt.snapshot.sourceTakeId } : {}),
        cost: item === saved[0] ? request.cost : { credits: null, provenance: request.cost.provenance, unit: "credits", readAt: request.cost.readAt },
        fromEarlierRevision,
      };
      nextMeta.takes[item.takeId] = provenance;
      const key = dedupKey(receipt.accountScope, jobId, item.output.index);
      if (!nextMeta.settled.includes(key)) nextMeta.settled.push(key);
    }
    const writes: Write[] = [{ path: cinemaMetaPath(storyboardId), text: metaJson(nextMeta) }];
    const boardText = (await files.get(cheminJson(storyboardId)))?.text ?? null;
    const board = lireStoryboard(boardText);
    const archived = !board || board.archive || latestMeta.archived.includes(shotId) || !trouverPlan(board, shotId);
    if (archived) diagnostics.push({ code: "SHOT_ARCHIVED", detail: "kept in history, shot not reactivated" });
    else if (trouverPlan(board!, shotId)!.plan.planFilmId === null) writes.push({ path: cheminJson(storyboardId), text: storyboardJson(majPlan(board!, shotId, { planFilmId: receipt.snapshot.planFilmId }, now)) });
    await runTransaction(files, ports.lock, { operationId: `${receipt.attemptId}.projection`, scope, writes, now: ports.now })
      .then(entry => { if (entry.state === "conflict") diagnostics.push({ code: "REVISION_CONFLICT", detail: (entry as { conflicts?: string[] }).conflicts?.join(", ") }); });
    current = { ...current, settlement: "projections_saved" };
  } catch (error) {
    return pending(current, now, [...diagnostics, { code: "STORAGE_UNAVAILABLE", detail: error instanceof Error ? error.message : "write failed" }]);
  }

  // 4. Settled marker. A conflict is not a failure: both versions are on disk and the visitor chooses.
  return { outcome: "settled", receipt: { ...current, state: "settled", updatedAt: ports.now() }, takeIds: saved.map(item => item.takeId), fromEarlierRevision, diagnostics };
}

/** For CE4: the takes of a shot that came back for an earlier version (« Result from an earlier version »). */
export function earlierVersionTakes(meta: CinemaMeta, shotId: string): { takeId: string; provenance: TakeProvenance }[] {
  return Object.entries(meta.takes)
    .filter(([, provenance]) => provenance.shotId === shotId && provenance.fromEarlierRevision)
    .map(([takeId, provenance]) => ({ takeId, provenance }));
}

/** Already settled on this project? (duplicate result, second tab, replayed poll). */
export function alreadySettled(meta: CinemaMeta, accountScope: string, providerJobId: string, outputIndex: number): boolean {
  return meta.settled.includes(dedupKey(accountScope, providerJobId, outputIndex));
}

// ---------------------------------------------------------------- submit and resume a paid take

export interface ShotJobDeps {
  storage: StorageLike;
  client: Pick<RenderClient, "submit" | "status">;
  now: () => Date;
  uuid: () => string;
  trancheCapCredits: number;
  balanceCredits: number | null;
  openWeightsMode?: boolean;
}

export interface ShotSubmission {
  /** The legacy receipt fields the existing recovery UI reads (kind take, project, account, …), jobId null. */
  base: PendingRender;
  operationId: string;
  accountScope: string;
  snapshot: ShotSnapshot;
  quote: Quote;
  graph: Record<string, unknown>;
}

function writePending(storage: StorageLike, pending: PendingWithCinema): void {
  assertNoSecretFields(pending);
  const text = JSON.stringify(pending);
  storage.setItem(PENDING_RENDER_KEY, text);
  if (storage.getItem(PENDING_RENDER_KEY) !== text) throw new Error("readback");
}

function writePendingQuiet(storage: StorageLike, pending: PendingWithCinema): void {
  try { writePending(storage, pending); } catch { /* reload reads `submitting` as submission_unknown */ }
}

/**
 * Exactly one POST per approval. Reserve, then receipt, then POST: if either write fails nothing is sent.
 * A lost answer is `submission_unknown` and keeps its reserve; it is never retried automatically.
 */
export async function submitShotJob(input: ShotSubmission, approval: SpendApproval, deps: ShotJobDeps): Promise<ShotJobReceipt> {
  const now = deps.now();
  if (input.base.project !== input.snapshot.scope.projectId) throw new CinemaError("PROJECT_UNAVAILABLE", "Le reçu et le plan ne sont pas du même projet.");
  if (approval.operationId !== input.operationId) throw new CinemaError("APPROVAL_REQUIRED", "Autorisation d'une autre opération.");
  assertSubmittable(input.graph as never, { openWeightsMode: deps.openWeightsMode ?? OPEN_WEIGHTS_MODE });
  if (submissionBusy(deps.storage)) throw new CinemaError("BUDGET_RESERVED", "Une autre opération payante est encore ouverte.");
  const attemptId = deps.uuid();
  const reserved = reserve({
    ledger: readLedger(deps.storage), quote: input.quote, approval, attemptId, accountScope: input.accountScope,
    trancheCapCredits: deps.trancheCapCredits, balanceCredits: deps.balanceCredits, now, busy: false,
  });
  writeLedger(deps.storage, reserved.ledger);

  let receipt: ShotJobReceipt = {
    schemaVersion: 2, operationId: input.operationId, attemptId, accountScope: input.accountScope,
    snapshot: input.snapshot, quote: input.quote, approval: { ...approval, consumedByAttemptId: attemptId },
    state: "submitting", providerJobId: null, submittedAt: null, updatedAt: now.toISOString(), outputs: [], settlement: "none",
  };
  try { writePending(deps.storage, withCinemaReceipt({ ...input.base, jobId: null }, receipt)); }
  catch {
    writeLedger(deps.storage, release(reserved.ledger, attemptId, "never_sent", now));
    throw new CinemaError("STORAGE_UNAVAILABLE", "Le reçu n'a pas pu être enregistré : rien n'est envoyé.");
  }

  let jobId: string;
  try { jobId = await deps.client.submit(input.graph as never, attemptId); }
  catch (error) {
    const code = error instanceof RenderError ? error.code : "network";
    const refused = code === "auth" || code === "credits" || code === "subscription" || code === "invalid";
    const at = deps.now();
    receipt = {
      ...receipt, state: refused ? "failed" : "submission_unknown", updatedAt: at.toISOString(),
      error: refused ? { code: "PROVIDER_REFUSED", safeMessage: `Refusé par le fournisseur (${code}).` }
        : { code: "SUBMISSION_UNKNOWN", safeMessage: "La réponse s'est perdue. Vérifie l'historique Comfy avant toute nouvelle tentative." },
    };
    try { writeLedger(deps.storage, refused ? release(readLedger(deps.storage), attemptId, "never_sent", at) : markUncertain(readLedger(deps.storage), attemptId, at)); } catch { /* stays reserved: safe */ }
    writePendingQuiet(deps.storage, withCinemaReceipt({ ...input.base, jobId: null }, receipt));
    return receipt;
  }
  receipt = { ...receipt, state: "queued", providerJobId: jobId, submittedAt: deps.now().toISOString(), updatedAt: deps.now().toISOString() };
  writePendingQuiet(deps.storage, withCinemaReceipt({ ...input.base, jobId }, receipt));
  return receipt;
}

/**
 * On open (no component needed): a receipt left `submitting` is `submission_unknown` with its reserve
 * kept; a reserve without any receipt never reached the POST (the receipt is written first) and is released.
 */
export function resumeShotJobs(storage: StorageLike, now: Date): { receipt: ShotJobReceipt | null; released: string[] } {
  const pendingRender = readPending(storage);
  let receipt = cinemaReceiptOf(pendingRender);
  let ledger = readLedger(storage);
  const released: string[] = [];
  if (receipt && receipt.state === "submitting") {
    receipt = { ...receipt, state: "submission_unknown", updatedAt: now.toISOString(), error: { code: "SUBMISSION_UNKNOWN", safeMessage: "La réponse s'est perdue. Vérifie l'historique Comfy avant toute nouvelle tentative." } };
    ledger = markUncertain(ledger, receipt.attemptId, now);
    writePendingQuiet(storage, withCinemaReceipt(pendingRender!, receipt));
  }
  for (const item of ledger.reservations) {
    if (item.state !== "reserved" || item.attemptId === receipt?.attemptId) continue;
    if (pendingRender && !receipt) continue; // a legacy receipt is open: leave everything held
    ledger = release(ledger, item.attemptId, "never_sent", now);
    released.push(item.attemptId);
  }
  writeLedger(storage, ledger);
  return { receipt, released };
}

/** One status GET. A read failure or a timeout keeps the state; never a cancel, never a resubmit. */
export async function pollShotJob(storage: StorageLike, client: Pick<RenderClient, "status">, now: Date): Promise<ShotJobReceipt | null> {
  const pendingRender = readPending(storage);
  const receipt = cinemaReceiptOf(pendingRender);
  if (!receipt?.providerJobId || !["queued", "running"].includes(receipt.state)) return receipt;
  let state = receipt.state;
  try {
    const stage = jobStage(await client.status(receipt.providerJobId));
    state = advance(state, stage === "queue" ? "queued" : stage === "prepare" || stage === "render" ? "running"
      : stage === "failed" ? "failed" : stage === "cancelled" ? "provider_cancelled" : "succeeded");
  } catch { return receipt; }
  const next: ShotJobReceipt = { ...receipt, state, updatedAt: now.toISOString() };
  writePendingQuiet(storage, withCinemaReceipt(pendingRender!, next));
  return next;
}
