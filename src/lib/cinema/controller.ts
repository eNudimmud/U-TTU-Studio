// CE5 · the cinema controller: the one service the studio session calls for the native agent, the
// storyboard commands and the paid shots. No React, no JSX cost logic, no second orchestrator: it only
// composes CE0 (intent job), CE1 (references, snapshot), CE2 (journal, spend ledger, settlement) and
// CE3 (context, parser, commands) through ports.
//
// Every answer carries a stable `code` and an explicit `target` (project, storyboard, shot). Client
// handles and credentials stay in memory (ports.client()); they never enter a context, snapshot,
// journal, prompt or receipt. Reads and resumes never POST. A paid POST needs: a person's approval for
// that exact payload, a reliable cross-tab exclusion, the tranche and the 300-credit campaign limit.
import type { VaultStore } from "../coffre/store.ts";
import type { RenderClient } from "../render/client.ts";
import { PENDING_RENDER_KEY, clearPending, readPending, type PendingRender } from "../render/recovery.ts";
import { cheminJson, lireStoryboard, trouverPlan, type PlanSB, type Storyboard } from "../storyboard/storyboard.ts";
import { cinemaAccountScope } from "./account.ts";
import { commitIntent, undoIntent, type Applied, type ApplyEnv } from "./commands.ts";
import { buildIntentContext, shotRevisionOf, type CatalogueReference } from "./context.ts";
import { digestOf, sha256Text } from "./digest.ts";
import {
  INTENT_RECEIPT_KEY, bindUnknownIntent, declareUnknownAbsent, pollIntent, prepareIntent as prepareIntentJob, readIntentReceipt, settleIntent,
  submitApprovedIntent, type IntentBudget, type IntentClient, type IntentPreparation,
} from "./intent-job.ts";
import { parseIntent, type ParseOptions } from "./intent.ts";
import { INTENT_MANIFEST, assertRunnable, contextText } from "./intent-workflow.ts";
import { cinemaMetaPath, parseMeta, projectFiles, readJournal, recoverJournals, runComputedTransaction, metaJson, type CinemaMeta, type ProjectLock } from "./journal.ts";
import { prepareReferences, withPreparedHashes, type PreparationPorts } from "./reference-preparation.ts";
import { compileReferences, fromRefPlan, isBlocked, resolveReferences, slotPrompt, type CatalogueEntry, type ReferenceCapacity, type SlotLabel } from "./references.ts";
import {
  cinemaReceiptOf, pollShotJob, resumeShotJobs, settleShotJob, shotPayloadDigest, submitShotJob, withCinemaReceipt,
  type ProviderOutput, type ShotJobReceipt, type ShotSubmission,
} from "./settlement.ts";
import { shotSnapshot, type GenerationSettings } from "./snapshot.ts";
import {
  assertCampaign, closeWithUnknownCost, markUncertain, readLedger, recordCost, release, reserve, writeLedger, withPaidSession,
  type CampaignLimit, type PaidSessionLocks,
} from "./spend-ledger.ts";
import {
  CinemaError, type CinemaDiagnostic, type EditableShotField, type IntentContext, type IntentEnvelope, type ObservedCost, type Operation, type Quote,
  type ReferenceBinding, type Scope, type ShotSnapshot, type SpendApproval, type StorageLike, type WorkflowManifest,
} from "./types.ts";

// ---------------------------------------------------------------- answers

export type ControllerCode =
  | "INTENT_PREPARED" | "INTENT_SUBMITTED" | "INTENT_WAITING" | "INTENT_APPLIED" | "INTENT_NEEDS_CLARIFICATION" | "INTENT_INVALID"
  | "INTENT_FAILED" | "INTENT_UNKNOWN" | "NOTHING_TO_RESUME" | "CONTEXT_TOO_LONG"
  | "LOCAL_APPLIED" | "LOCAL_NOTHING" | "UNDONE" | "UNDO_REFUSED"
  | "SHOT_PREPARED" | "SHOT_SUBMITTED" | "KEYFRAME_REQUIRED" | "KEYFRAME_APPROVED"
  | "JOB_RUNNING" | "JOB_FAILED" | "RESULT_SETTLED" | "RESULT_PENDING"
  | "PAID_EXCLUSION_UNAVAILABLE"
  | CinemaError["code"];

export interface ControllerTarget { projectId: string; storyboardId: string | null; shotId: string | null }

export interface ControllerAnswer<T = unknown> {
  ok: boolean;
  code: ControllerCode;
  target: ControllerTarget;
  diagnostics: CinemaDiagnostic[];
  data?: T;
}

const target = (projectId: string, storyboardId: string | null = null, shotId: string | null = null): ControllerTarget => ({ projectId, storyboardId, shotId });
const answer = <T = never>(ok: boolean, code: ControllerCode, where: ControllerTarget, data?: NoInfer<T>, diagnostics: CinemaDiagnostic[] = []): ControllerAnswer<T> =>
  ({ ok, code, target: where, diagnostics, ...(data === undefined ? {} : { data }) });

/** A CinemaError (or anything thrown) becomes a stable code; the message never carries a secret. */
function failure<T>(error: unknown, where: ControllerTarget): ControllerAnswer<T> {
  if (error instanceof CinemaError) return answer<T>(false, error.code, where, undefined, error.detail.map(detail => ({ code: error.code, detail })));
  return answer<T>(false, "STORAGE_UNAVAILABLE", where, undefined, [{ code: "STORAGE_UNAVAILABLE", detail: error instanceof Error ? error.name : "error" }]);
}

// ---------------------------------------------------------------- ports

export type CinemaClient = IntentClient & Pick<RenderClient, "user"> & Partial<Pick<RenderClient, "file">>;

export interface ControllerPorts {
  storage: StorageLike;
  /** The whole vault; every write goes through `projectFiles(vault, projectId)` of the operation's project. */
  vault: VaultStore;
  lock: ProjectLock;
  /** Web Locks for the paid session. Null = no reliable exclusion between tabs: no paid POST at all. */
  paidLocks: PaidSessionLocks | null;
  sessionId: string;
  /** The connected client, in memory only. Null = not connected. */
  client(): CinemaClient | null;
  now(): Date;
  uuid(): string;
  seed(): number;
  trancheCapCredits: number;
  campaign: CampaignLimit;
  balance(): Promise<number | null>;
  projectAvailable(projectId: string): Promise<boolean>;
  openWeightsMode?: boolean;
  /** `qualification` lets a candidate manifest run: only on the preview JD prepared for his own test. */
  purpose: "demo" | "qualification";
  intentManifest?: WorkflowManifest;
}

const files = (ports: ControllerPorts, projectId: string) => projectFiles(ports.vault, projectId);

async function readBoard(store: VaultStore, scope: Scope): Promise<{ storyboard: Storyboard; meta: CinemaMeta }> {
  const storyboard = lireStoryboard((await store.get(cheminJson(scope.storyboardId)))?.text ?? null);
  if (!storyboard) throw new CinemaError("PROJECT_UNAVAILABLE", "Storyboard illisible.", [cheminJson(scope.storyboardId)]);
  const meta = parseMeta((await store.get(cinemaMetaPath(scope.storyboardId)))?.text ?? null, storyboard.id);
  return { storyboard, meta };
}

async function accountOf(ports: ControllerPorts): Promise<{ client: CinemaClient; scope: string }> {
  const client = ports.client();
  if (!client) throw new CinemaError("ACCOUNT_UNAVAILABLE", "Compte de rendu non connecté.");
  return { client, scope: await cinemaAccountScope(await client.user()) };
}

/** The amount a reserve will hold: the estimate (+ uncertainty) when known, else the whole approved ceiling. */
function reserveAmount(quote: Quote, approval: SpendApproval): number {
  return quote.estimatedCredits !== null && quote.basis !== "unavailable" ? Math.ceil(quote.estimatedCredits + (quote.uncertaintyCredits ?? 0)) : approval.authorizedCeilingCredits;
}

async function paid<T>(ports: ControllerPorts, fn: () => Promise<T>): Promise<T> {
  // A TTL marker is best effort, never a guarantee: without Web Locks the paid path stays closed.
  if (!ports.paidLocks) throw new CinemaError("BUDGET_RESERVED", "Pas d'exclusion fiable entre onglets : aucun envoi payant.", ["paid-exclusion"]);
  return withPaidSession({ locks: ports.paidLocks, storage: ports.storage, sessionId: ports.sessionId, now: () => ports.now().getTime() }, fn);
}

// ---------------------------------------------------------------- intent

/** The context saved next to the journal before the POST: CE3 reads the answer against this very context. */
export const intentContextPath = (operationId: string) => `.uttu/intent-${operationId.replace(/[^\w.-]/g, "_")}.json`;

interface SavedIntentContext { schemaVersion: 1; operationId: string; context: IntentContext; contextText: string; userText: string; options: ParseOptions }

export interface PrepareIntentRequest {
  scope: Scope;
  locale: IntentContext["locale"];
  selectedShotId: string | null;
  userText: string;
  locks: Record<string, EditableShotField[]>;
  references: CatalogueReference[];
  capabilities: IntentContext["capabilities"];
  parseOptions?: ParseOptions;
  estimate?: { credits: number; uncertainty: number; basis: "provider" | "measured_similar_job" } | null;
}

export interface PreparedIntent { preparation: IntentPreparation; context: IntentContext; contextText: string; parseOptions: ParseOptions }

export function createCinemaController(ports: ControllerPorts) {
  const intentDeps = (client: IntentClient) => ({ storage: ports.storage, client, now: ports.now, uuid: ports.uuid, openWeightsMode: ports.openWeightsMode, manifest: ports.intentManifest });

  /** Context → snapshot, graph and quote. No POST, no storage. */
  async function prepareIntent(request: PrepareIntentRequest): Promise<ControllerAnswer<PreparedIntent>> {
    const where = target(request.scope.projectId, request.scope.storyboardId, request.selectedShotId);
    try {
      assertRunnable(ports.intentManifest ?? INTENT_MANIFEST, ports.purpose);
      const { scope: accountScope } = await accountOf(ports);
      const { storyboard, meta } = await readBoard(files(ports, request.scope.projectId), request.scope);
      const built = buildIntentContext({
        scope: request.scope, locale: request.locale, storyboard, meta, selectedShotId: request.selectedShotId,
        locks: request.locks, references: request.references, capabilities: request.capabilities,
      });
      if (!built.ok) return answer(false, "CONTEXT_TOO_LONG", where, undefined, built.diagnostics);
      const text = contextText(built.context);
      const preparation = await prepareIntentJob({ context: built.context, contextText: text, userText: request.userText, accountScope, seed: ports.seed(), estimate: request.estimate ?? null }, ports);
      return answer(true, "INTENT_PREPARED", where, { preparation, context: built.context, contextText: text, parseOptions: request.parseOptions ?? {} }, built.diagnostics);
    } catch (error) { return failure(error, where); }
  }

  /** One POST for one approval, through the common budget and the paid-session exclusion. */
  async function submitIntent(prepared: PreparedIntent, approval: SpendApproval): Promise<ControllerAnswer<{ state: string }>> {
    const scope = prepared.context.scope;
    const where = target(scope.projectId, scope.storyboardId, prepared.context.selectedShotId);
    try {
      return await paid(ports, async () => {
        const { client, scope: accountScope } = await accountOf(ports);
        if (accountScope !== prepared.preparation.accountScope) throw new CinemaError("APPROVAL_REQUIRED", "Autre compte que celui du devis.", ["account"]);
        const store = files(ports, scope.projectId);
        const saved: SavedIntentContext = { schemaVersion: 1, operationId: prepared.preparation.operationId, context: prepared.context, contextText: prepared.contextText, userText: prepared.preparation.snapshot.userText, options: prepared.parseOptions };
        await store.put({ path: intentContextPath(saved.operationId), text: JSON.stringify(saved), updatedAt: ports.now().getTime() });
        const balance = await ports.balance().catch(() => null);
        const budget: IntentBudget = {
          check: (a, quote) => {
            const ledger = readLedger(ports.storage);
            assertCampaign(ledger, ports.campaign, reserveAmount(quote, a));
            // Dry run of the tranche rules on the current ledger (nothing written).
            reserve({ ledger, quote, approval: a, attemptId: "check", accountScope, trancheCapCredits: ports.trancheCapCredits, balanceCredits: balance, now: ports.now(), busy: false });
          },
          hold: (a, quote, attemptId) => {
            const ledger = readLedger(ports.storage);
            assertCampaign(ledger, ports.campaign, reserveAmount(quote, a));
            const held = reserve({ ledger, quote, approval: a, attemptId, accountScope, trancheCapCredits: ports.trancheCapCredits, balanceCredits: balance, now: ports.now(), busy: false, consumedByCaller: true });
            writeLedger(ports.storage, held.ledger);
          },
          refused: attemptId => writeLedger(ports.storage, release(readLedger(ports.storage), attemptId, "never_sent", ports.now())),
          uncertain: attemptId => writeLedger(ports.storage, markUncertain(readLedger(ports.storage), attemptId, ports.now())),
        };
        const receipt = await submitApprovedIntent(prepared.preparation, approval, { ...intentDeps(client), budget }, { purpose: ports.purpose });
        const code: ControllerCode = receipt.state === "queued" ? "INTENT_SUBMITTED" : receipt.state === "submission_unknown" ? "SUBMISSION_UNKNOWN" : "PROVIDER_REFUSED";
        return answer(receipt.state === "queued", code, where, { state: receipt.state });
      });
    } catch (error) { return failure(error, where); }
  }

  /** Closes the intent's reserve once the job is over: known cost settles it, unknown keeps it counted. */
  function closeIntentReserve(attemptId: string, cost: ObservedCost | null): void {
    try {
      let ledger = readLedger(ports.storage);
      if (!ledger.reservations.some(item => item.attemptId === attemptId)) return;
      ledger = cost ? recordCost(ledger, attemptId, cost, ports.now()) : ledger;
      writeLedger(ports.storage, closeWithUnknownCost(ledger, attemptId, ports.now()));
    } catch { /* stays reserved: safe */ }
  }

  /**
   * GET only. A finished answer is parsed by CE3 against the context saved before the POST, then
   * committed once (the journal of the same operation id is resumed, never applied twice).
   */
  async function resumeIntent(env: { locks: Record<string, EditableShotField[]> }): Promise<ControllerAnswer<{ applied?: Applied | null; retryAfterMs?: number | null; unresolved?: IntentEnvelope["unresolved"] }>> {
    let receipt = (() => { try { return readIntentReceipt(ports.storage); } catch { return null; } })();
    if (!receipt) return answer(true, "NOTHING_TO_RESUME", target(""));
    const scope = receipt.snapshot.scope;
    const where = target(scope.projectId, scope.storyboardId, receipt.snapshot.selectedShotId);
    try {
      if (receipt.state === "submission_unknown") return answer(false, "INTENT_UNKNOWN", where);
      if (receipt.state === "settled") return answer(true, "NOTHING_TO_RESUME", where);
      if (receipt.state === "failed" || receipt.state === "provider_cancelled") { closeIntentReserve(receipt.attemptId, null); return answer(false, "INTENT_FAILED", where); }
      if (receipt.state !== "succeeded") {
        const client = ports.client();
        if (!client) return answer(false, "ACCOUNT_UNAVAILABLE", where);
        const polled = await pollIntent(intentDeps(client));
        receipt = polled?.receipt ?? receipt;
        if (receipt.state === "failed" || receipt.state === "provider_cancelled") { closeIntentReserve(receipt.attemptId, null); return answer(false, "INTENT_FAILED", where); }
        if (receipt.state !== "succeeded") return answer(true, "INTENT_WAITING", where, { retryAfterMs: polled?.retryAfterMs ?? null });
      }
      if (!(await ports.projectAvailable(scope.projectId).catch(() => false))) return answer(false, "PROJECT_UNAVAILABLE", where);
      const store = files(ports, scope.projectId);
      const saved = JSON.parse((await store.get(intentContextPath(receipt.operationId)))?.text ?? "null") as SavedIntentContext | null;
      if (!saved || saved.operationId !== receipt.operationId || (await sha256Text(saved.contextText)) !== receipt.snapshot.contextDigest) {
        return answer(false, "OUTPUT_INVALID", where, undefined, [{ code: "OUTPUT_INVALID", detail: "context of the request not found" }]);
      }
      // Idempotent per command: an operation already journaled is finished, never recomputed.
      const existing = await readJournal(store, receipt.operationId);
      if (existing) {
        if (existing.state === "prepared") await recoverJournals(store, ports.lock, scope.projectId, () => ports.now().toISOString());
        settleIntent(ports);
        closeIntentReserve(receipt.attemptId, null);
        return answer(true, "INTENT_APPLIED", where, { applied: null });
      }
      const parsed = parseIntent(receipt.text!.text, saved.context, { operationId: receipt.operationId, source: "conversation", userText: saved.userText }, saved.options);
      if (parsed.status === "invalid") { settleIntent(ports); closeIntentReserve(receipt.attemptId, null); return answer(false, "INTENT_INVALID", where, undefined, parsed.diagnostics); }
      if (parsed.status === "needs_clarification") { settleIntent(ports); closeIntentReserve(receipt.attemptId, null); return answer(true, "INTENT_NEEDS_CLARIFICATION", where, { unresolved: parsed.unresolved }); }
      const applied = await commitIntent(store, ports.lock, parsed.envelope, applyEnv(env.locks));
      settleIntent(ports);
      closeIntentReserve(receipt.attemptId, null);
      return answer(true, "INTENT_APPLIED", where, { applied });
    } catch (error) { return failure(error, where); }
  }

  const applyEnv = (locks: Record<string, EditableShotField[]>, takeIds?: Record<string, string[]>): ApplyEnv & { now: string } => ({
    newShotId: () => `p-${ports.uuid().replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase()}`,
    now: ports.now().toISOString(), locks, ...(takeIds ? { takeIds } : {}),
  });

  /** `submission_unknown`: the visitor pastes the job id from their Comfy history (GET only), or says it is absent. */
  async function bindIntent(jobId: string): Promise<ControllerAnswer> {
    const client = ports.client();
    if (!client) return answer(false, "ACCOUNT_UNAVAILABLE", target(""));
    try { const r = await bindUnknownIntent(jobId, intentDeps(client)); return answer(true, "INTENT_WAITING", target(r.snapshot.scope.projectId, r.snapshot.scope.storyboardId)); }
    catch (error) { return failure(error, target("")); }
  }
  function declareIntentAbsent(confirmedByUser: boolean): ControllerAnswer {
    try {
      const r = declareUnknownAbsent(ports, confirmedByUser);
      try { writeLedger(ports.storage, release(readLedger(ports.storage), r.attemptId, "confirmed_absent", ports.now())); } catch { /* no reserve */ }
      return answer(true, "INTENT_FAILED", target(r.snapshot.scope.projectId, r.snapshot.scope.storyboardId));
    } catch (error) { return failure(error, target("")); }
  }

  // ---------------------------------------------------------------- local commands (buttons, sheets, undo)

  /** The same CE3 path as the conversation: revisions and locks are checked again at commit. */
  async function applyLocal(scope: Scope, operations: Operation[], env: { locks: Record<string, EditableShotField[]>; takeIds?: Record<string, string[]>; userText?: string }): Promise<ControllerAnswer<Applied & { operationId: string }>> {
    const where = target(scope.projectId, scope.storyboardId, operations.map(op => ("target" in op ? op.target.shotId : null)).find(Boolean) ?? null);
    try {
      const operationId = ports.uuid();
      const envelope: IntentEnvelope = { schemaVersion: 1, operationId, source: "direct", userText: env.userText ?? "", creativeGoal: "", expectedResult: "", operations, rationale: "", unresolved: [] };
      const applied = await commitIntent(files(ports, scope.projectId), ports.lock, envelope, applyEnv(env.locks, env.takeIds));
      return answer(true, applied.journal ? "LOCAL_APPLIED" : "LOCAL_NOTHING", where, { ...applied, operationId });
    } catch (error) { return failure(error, where); }
  }

  /** Conservative undo (Astra decision 7): refused with a diagnostic when anything changed since, both versions kept. */
  async function undo(scope: Scope, operationId: string): Promise<ControllerAnswer> {
    const where = target(scope.projectId, scope.storyboardId);
    try {
      const journal = await undoIntent(files(ports, scope.projectId), ports.lock, operationId, ports.uuid(), ports.now().toISOString());
      return journal.state === "applied" ? answer(true, "UNDONE", where) : answer(false, "UNDO_REFUSED", where, undefined, [{ code: "REVISION_CONFLICT", detail: (journal.conflicts ?? []).join(", ") }]);
    } catch (error) {
      if (error instanceof CinemaError && error.code === "REVISION_CONFLICT") return answer(false, "UNDO_REFUSED", where, undefined, error.detail.map(detail => ({ code: "REVISION_CONFLICT", detail })));
      return failure(error, where);
    }
  }

  // ---------------------------------------------------------------- keyframe approval

  /** Bound to the shot, its revision and its bindings (with picture hashes), not to a global asset id. */
  async function approveKeyframe(scope: Scope, shotId: string, assetId: string, bindings: readonly ReferenceBinding[]): Promise<ControllerAnswer> {
    const where = target(scope.projectId, scope.storyboardId, shotId);
    try {
      const store = files(ports, scope.projectId);
      const bindingsDigest = await digestOf(bindings);
      const journal = await runComputedTransaction(store, ports.lock, {
        operationId: ports.uuid(), scope, now: () => ports.now().toISOString(),
        compute: async () => {
          const { meta } = await readBoard(store, scope);
          if (bindings.some(binding => binding.images.some(image => image.assetId === assetId))) throw new CinemaError("REFERENCE_MISSING", "A reference picture is not a keyframe.");
          const keyframes = { ...(meta.keyframes as Record<string, KeyframeApproval> | undefined) };
          keyframes[shotId] = { assetId, revision: shotRevisionOf(meta, shotId), bindingsDigest, approvedAt: ports.now().toISOString() };
          return [{ path: cinemaMetaPath(scope.storyboardId), text: metaJson({ ...meta, keyframes }) }];
        },
      });
      return journal.state === "applied" ? answer(true, "KEYFRAME_APPROVED", where) : answer(false, "REVISION_CONFLICT", where);
    } catch (error) { return failure(error, where); }
  }

  // ---------------------------------------------------------------- shots

  async function prepareShot(request: PrepareShotRequest): Promise<ControllerAnswer<PreparedShot>> {
    const { scope, shotId } = request;
    const where = target(scope.projectId, scope.storyboardId, shotId);
    try {
      const purpose = request.output === "keyframe" ? "keyframe" : "animation";
      if (request.manifest.purpose !== purpose) throw new CinemaError("WORKFLOW_UNQUALIFIED", "Manifeste d'une autre action.", [request.manifest.id]);
      assertRunnable(request.manifest, ports.purpose);
      const { scope: accountScope } = await accountOf(ports);
      const store = files(ports, scope.projectId);
      const { storyboard, meta } = await readBoard(store, scope);
      const found = trouverPlan(storyboard, shotId);
      if (!found || meta.archived.includes(shotId)) throw new CinemaError("REVISION_CONFLICT", "Ce plan n'existe plus.", [shotId]);
      const plan = found.plan;
      const revision = shotRevisionOf(meta, shotId);
      const chain = await referenceChain(scope.projectId, plan, request);
      if (chain.blocked) return answer(false, (chain.diagnostics.find(item => isBlocked([item]))?.code ?? "REFERENCE_MISSING") as ControllerCode, where, undefined, chain.diagnostics);
      let pictures = chain.orderedAssetIds;
      let approvedKeyframeAssetId: string | undefined;
      if (request.output === "video") {
        // P0 animation: the approved keyframe alone (LTX one image), approved for this revision and these bindings.
        const keyframe = (meta.keyframes as Record<string, KeyframeApproval> | undefined)?.[shotId];
        if (!keyframe || keyframe.revision !== revision || keyframe.bindingsDigest !== await digestOf(chain.bindings)) return answer(false, "KEYFRAME_REQUIRED", where, undefined, chain.diagnostics);
        approvedKeyframeAssetId = keyframe.assetId;
        pictures = [keyframe.assetId];
      }
      const prompt = [plan.promptManuel?.trim() || plan.action.trim() || plan.titre.trim(), request.output === "keyframe" ? chain.slotLines : ""].filter(Boolean).join("\n");
      const seed = ports.seed();
      const graph = request.graphFor({ prompt, pictures, seed, plan });
      const workflowDigest = request.manifest.graphSha256;
      const generation: GenerationSettings = {
        workflowId: request.manifest.id, workflowDigest, seed, seconds: plan.duree, aspect: plan.format, resolution: request.resolution,
        prompt, orderedAssetIds: pictures, slots: request.output === "keyframe" ? chain.slots : [],
      };
      const snapshot = await shotSnapshot({ scope, plan, revision, planFilmId: request.planFilmId, bindings: chain.bindings, generation, ...(approvedKeyframeAssetId ? { approvedKeyframeAssetId } : {}) });
      const now = ports.now();
      const payloadDigest = await shotPayloadDigest({ snapshot, graph, generation, accountScope });
      const estimate = request.estimate ?? null;
      const quote: Quote = {
        id: ports.uuid(), snapshotDigest: snapshot.digest, workflowDigest,
        estimatedCredits: estimate ? estimate.credits : null, uncertaintyCredits: estimate ? estimate.uncertainty : null,
        basis: estimate ? estimate.basis : "unavailable", createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 15 * 60_000).toISOString(), payloadDigest,
      };
      return answer(true, "SHOT_PREPARED", where, { submission: { operationId: ports.uuid(), accountScope, snapshot, quote, graph, generation }, request }, chain.diagnostics);
    } catch (error) { return failure(error, where); }
  }

  /** catalogue → resolve → prepare pixels → prepared hashes → compile → slot prompt: one list for cost, prompt and graph. */
  async function referenceChain(projectId: string, plan: PlanSB, request: Pick<PrepareShotRequest, "catalogue" | "pixels" | "capacity" | "labels" | "tag" | "lockedReferenceIds">) {
    const resolved = resolveReferences({ projectId, refs: plan.refs.map(fromRefPlan), catalogue: request.catalogue, lockedReferenceIds: request.lockedReferenceIds });
    if (resolved.blocked) return { blocked: true as const, bindings: resolved.bindings, diagnostics: resolved.diagnostics, orderedAssetIds: [], slots: [], slotLines: "" };
    const preparation = await prepareReferences(resolved.bindings, request.pixels);
    const bindings = withPreparedHashes(resolved.bindings, preparation);
    const compiled = compileReferences(bindings, request.capacity, { usable: preparation.usable });
    const diagnostics = [...resolved.diagnostics, ...preparation.diagnostics, ...compiled.diagnostics];
    if (isBlocked(diagnostics)) return { blocked: true as const, bindings, diagnostics, orderedAssetIds: [], slots: [], slotLines: "" };
    return { blocked: false as const, bindings, diagnostics, orderedAssetIds: compiled.orderedAssetIds, slots: compiled.slots, slotLines: slotPrompt(compiled, bindings, request.labels, request.tag) };
  }

  /** Final validation (revision, locks, references re-read) then the CE2 path. One approval = this shot only. */
  async function submitShot(prepared: PreparedShot, approval: SpendApproval, base: PendingRender): Promise<ControllerAnswer<{ state: string }>> {
    const { snapshot } = prepared.submission;
    const where = target(snapshot.scope.projectId, snapshot.scope.storyboardId, snapshot.shotId);
    try {
      return await paid(ports, async () => {
        const { client, scope: accountScope } = await accountOf(ports);
        if (accountScope !== prepared.submission.accountScope) throw new CinemaError("APPROVAL_REQUIRED", "Autre compte que celui du devis.", ["account"]);
        assertCampaign(readLedger(ports.storage), ports.campaign, reserveAmount(prepared.submission.quote, approval));
        const submission: ShotSubmission = { ...prepared.submission, base: { ...base, project: snapshot.scope.projectId } };
        const receipt = await submitShotJob(submission, approval, {
          storage: ports.storage, client, now: ports.now, uuid: ports.uuid, trancheCapCredits: ports.trancheCapCredits,
          balanceCredits: await ports.balance().catch(() => null), openWeightsMode: ports.openWeightsMode,
          revalidate: current => revalidateShot(current, prepared.request),
        });
        const code: ControllerCode = receipt.state === "queued" ? "SHOT_SUBMITTED" : receipt.state === "submission_unknown" ? "SUBMISSION_UNKNOWN" : "PROVIDER_REFUSED";
        return answer(receipt.state === "queued", code, where, { state: receipt.state });
      });
    } catch (error) { return failure(error, where); }
  }

  /** Re-reads the shot now: same revision, not archived, same bindings with the same picture hashes. */
  async function revalidateShot(snapshot: ShotSnapshot, request: PrepareShotRequest): Promise<void> {
    const store = files(ports, snapshot.scope.projectId);
    const { storyboard, meta } = await readBoard(store, snapshot.scope);
    const found = trouverPlan(storyboard, snapshot.shotId);
    if (!found || meta.archived.includes(snapshot.shotId) || shotRevisionOf(meta, snapshot.shotId) !== snapshot.revision) throw new CinemaError("REVISION_CONFLICT", "Le plan a changé depuis son devis.", [snapshot.shotId]);
    const chain = await referenceChain(snapshot.scope.projectId, found.plan, request);
    if (chain.blocked || (await digestOf(chain.bindings)) !== (await digestOf(snapshot.bindings))) throw new CinemaError("APPROVAL_REQUIRED", "Les références ont changé depuis le devis.", ["references"]);
  }

  // ---------------------------------------------------------------- resume on open

  /**
   * On open, without mounting any storyboard component: incomplete journals first (each available
   * project), then the receipts (GET only). A result lands in the project it was sent from.
   */
  async function resumeResults(request: { projectIds: readonly string[]; outputsOf?: (jobId: string) => Promise<{ outputs: ProviderOutput[]; cost: ObservedCost }> }): Promise<ControllerAnswer<{ journals: number; receipt: ShotJobReceipt | null; released: string[] }>> {
    const diagnostics: CinemaDiagnostic[] = [];
    let journals = 0;
    for (const projectId of request.projectIds) {
      if (!(await ports.projectAvailable(projectId).catch(() => false))) { diagnostics.push({ code: "PROJECT_UNAVAILABLE", detail: projectId }); continue; }
      try { journals += (await recoverJournals(files(ports, projectId), ports.lock, projectId, () => ports.now().toISOString())).length; }
      catch (error) { diagnostics.push({ code: "STORAGE_UNAVAILABLE", detail: error instanceof Error ? error.message : projectId }); }
    }
    const intent = (() => { try { return readIntentReceipt(ports.storage); } catch { return null; } })();
    const keep = intent && !["settled", "failed", "provider_cancelled"].includes(intent.state) ? [intent.attemptId] : [];
    let resumed: { receipt: ShotJobReceipt | null; released: string[] };
    try { resumed = resumeShotJobs(ports.storage, ports.now(), keep); } catch (error) { return failure(error, target("")); }
    let receipt = resumed.receipt;
    if (!receipt) return answer(true, journals ? "RESULT_SETTLED" : "NOTHING_TO_RESUME", target(""), { journals, receipt: null, released: resumed.released }, diagnostics);
    const where = target(receipt.snapshot.scope.projectId, receipt.snapshot.scope.storyboardId, receipt.snapshot.shotId);
    const client = ports.client();
    if (!client) return answer(false, "ACCOUNT_UNAVAILABLE", where, { journals, receipt, released: resumed.released }, diagnostics);
    if (receipt.state === "queued" || receipt.state === "running") receipt = (await pollShotJob(ports.storage, client, ports.now())) ?? receipt;
    if (receipt.state === "queued" || receipt.state === "running") return answer(true, "JOB_RUNNING", where, { journals, receipt, released: resumed.released }, diagnostics);
    if (receipt.state === "submission_unknown") return answer(false, "SUBMISSION_UNKNOWN", where, { journals, receipt, released: resumed.released }, diagnostics);
    if (receipt.state === "failed" || receipt.state === "provider_cancelled") return answer(false, "JOB_FAILED", where, { journals, receipt, released: resumed.released }, diagnostics);
    if (!request.outputsOf || !receipt.providerJobId) return answer(false, "RESULT_PENDING", where, { journals, receipt, released: resumed.released }, diagnostics);
    let currentAccountScope: string | null = null;
    try { currentAccountScope = (await accountOf(ports)).scope; } catch { /* kept pending below */ }
    const { outputs, cost } = await request.outputsOf(receipt.providerJobId);
    const settled = await settleShotJob({ receipt, outputs, cost, currentAccountScope }, {
      vault: ports.vault, projectAvailable: ports.projectAvailable, lock: ports.lock, now: () => ports.now().toISOString(),
      download: async output => {
        if (!client.file) throw new Error("no download");
        return client.file({ filename: output.filename, subfolder: output.subfolder ?? "", type: output.type ?? "output" });
      },
    });
    const pending = readPending(ports.storage);
    if (pending) {
      try { ports.storage.setItem(PENDING_RENDER_KEY, JSON.stringify(withCinemaReceipt(pending, settled.receipt))); } catch { /* reread on next open */ }
    }
    if (settled.outcome === "settled") {
      try { writeLedger(ports.storage, closeWithUnknownCost(recordCost(readLedger(ports.storage), receipt.attemptId, cost, ports.now()), receipt.attemptId, ports.now())); } catch { /* stays reserved */ }
      if (pending?.jobId) clearPending(ports.storage, pending.jobId);
    }
    return answer(settled.outcome === "settled", settled.outcome === "settled" ? "RESULT_SETTLED" : "RESULT_PENDING", where, { journals, receipt: settled.receipt, released: resumed.released }, [...diagnostics, ...settled.diagnostics]);
  }

  return { prepareIntent, submitIntent, resumeIntent, bindIntent, declareIntentAbsent, applyLocal, undo, approveKeyframe, prepareShot, submitShot, resumeResults };
}

export type CinemaController = ReturnType<typeof createCinemaController>;

export interface KeyframeApproval { assetId: string; revision: number; bindingsDigest: string; approvedAt: string }

export interface PrepareShotRequest {
  scope: Scope;
  shotId: string;
  output: "keyframe" | "video";
  planFilmId: string;
  /** The authorized manifest for this action (keyframe or animation), documented and qualified. */
  manifest: WorkflowManifest;
  catalogue: readonly CatalogueEntry[];
  pixels: PreparationPorts;
  capacity: ReferenceCapacity;
  labels: ReadonlyMap<string, SlotLabel>;
  tag: (index: number) => string;
  lockedReferenceIds?: ReadonlySet<string>;
  resolution: string;
  /** Builds the exact graph from the prompt, pictures and seed (render/run.ts takeGraphFor in the studio). */
  graphFor(input: { prompt: string; pictures: readonly string[]; seed: number; plan: PlanSB }): Record<string, unknown>;
  estimate?: { credits: number; uncertainty: number; basis: "provider" | "measured_similar_job" } | null;
}

export interface PreparedShot { submission: Omit<ShotSubmission, "base">; request: PrepareShotRequest }

export { INTENT_RECEIPT_KEY };

/** The person's approval for this exact shot payload (quote, snapshot, workflow and payload digests). */
export function shotApproval(prepared: PreparedShot, ceilingCredits: number, ids: { id: string; trancheId: string }, now: Date): SpendApproval {
  const { submission } = prepared;
  return {
    id: ids.id, trancheId: ids.trancheId, operationId: submission.operationId, quoteId: submission.quote.id,
    snapshotDigest: submission.snapshot.digest, workflowDigest: submission.quote.workflowDigest, payloadDigest: submission.quote.payloadDigest,
    authorizedCeilingCredits: ceilingCredits, actor: "user", approvedAt: now.toISOString(), consumedByAttemptId: null,
  };
}
