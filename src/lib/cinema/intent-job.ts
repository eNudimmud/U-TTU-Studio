// The agent's text job (CE0, ADR-02): an asynchronous Comfy job and a spend like any other.
// prepare → user approval → receipt persisted BEFORE the POST → one POST → poll → text read from
// the history (PreviewAny) → stored for CE3's validator. Never a fake media item, never a cancel,
// never a second POST after a lost response, never a terminal state undone by a stale poll.
//
// Storage: its own key (`u-ttu-intent-op`) so the historical `u-ttu-operation` receipt (v1, takes)
// is untouched; one submission at a time across both keys. CE2 unifies the journals.

import type { RenderClient } from "../render/client.ts";
import { RenderError, jobStage } from "../render/client.ts";
import { PENDING_RENDER_KEY } from "../render/recovery.ts";
import { OPEN_WEIGHTS_MODE } from "../open-weights.ts";
import { assertSubmittable } from "./workflow-policy.ts";
import { assertNoSecretFields, canonicalJson, digestOf, sha256Text } from "./digest.ts";
import {
  INTENT_GRAPH_TEMPLATE, INTENT_MANIFEST, INTENT_OUTPUT_MAX_CHARS, INTENT_OUTPUT_NODE,
  assertRunnable, intentGraph, intentGraphDigest, type IntentGraph,
} from "./intent-workflow.ts";
import {
  CinemaError, JOB_STATES, TERMINAL_JOB_STATES,
  type IntentContext, type IntentJobReceipt, type IntentJobSnapshot, type IntentTextOutput,
  type JobState, type Quote, type SpendApproval, type StorageLike, type WorkflowManifest,
} from "./types.ts";

export const INTENT_RECEIPT_KEY = "u-ttu-intent-op";
export const QUOTE_TTL_MS = 15 * 60_000;
/** Poll backoff after a failed status read (the job keeps running on the provider). */
export const POLL_BACKOFF_MS = [2_000, 4_000, 8_000, 15_000, 30_000] as const;

export type IntentClient = Pick<RenderClient, "submit" | "status" | "job">;

export interface IntentJobDeps {
  storage: StorageLike;
  client: IntentClient;
  now(): Date;
  uuid(): string;
  openWeightsMode?: boolean;
  manifest?: WorkflowManifest;
}

export interface IntentPreparation {
  operationId: string;
  accountScope: string;
  snapshot: IntentJobSnapshot;
  graph: IntentGraph;
  quote: Quote;
}

export interface PrepareIntentInput {
  context: IntentContext;
  /** Bounded context text (CE3 context.ts); its digest is the context digest. */
  contextText: string;
  userText: string;
  /** Opaque account id (e.g. Comfy user id). Never the key, never a hash of the key. */
  accountScope: string;
  seed: number;
  /** A provider estimate when one exists (« ≈ X crédits estimés »); otherwise the quote says unknown. */
  estimate?: { credits: number; uncertainty: number; basis: "provider" | "measured_similar_job" } | null;
}

/** Pure preparation: no network, no storage, no spend. */
export async function prepareIntent(input: PrepareIntentInput, deps: Pick<IntentJobDeps, "now" | "uuid">): Promise<IntentPreparation> {
  if (!input.accountScope || input.accountScope.length > 200) throw new CinemaError("PROJECT_UNAVAILABLE", "No account scope.");
  const graph = intentGraph({ userText: input.userText, contextText: input.contextText, seed: input.seed });
  const workflowDigest = await intentGraphDigest(INTENT_GRAPH_TEMPLATE);
  const contextDigest = await sha256Text(input.contextText);
  const shotRevisions = Object.fromEntries(input.context.shots.map(shot => [shot.shotId, shot.revision]));
  const base = {
    schemaVersion: 1 as const, kind: "intent" as const,
    scope: input.context.scope, selectedShotId: input.context.selectedShotId,
    storyboardRevision: input.context.storyboardRevision, shotRevisions,
    userText: input.userText.trim(), locale: input.context.locale,
    contextDigest, workflowId: INTENT_MANIFEST.id, workflowDigest,
  };
  const snapshot: IntentJobSnapshot = { ...base, digest: await digestOf({ ...base, graph }) };
  const now = deps.now();
  const estimate = input.estimate ?? null;
  const quote: Quote = {
    id: deps.uuid(),
    snapshotDigest: snapshot.digest,
    workflowDigest,
    estimatedCredits: estimate ? estimate.credits : null,
    uncertaintyCredits: estimate ? estimate.uncertainty : null,
    basis: estimate ? estimate.basis : "unavailable",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + QUOTE_TTL_MS).toISOString(),
  };
  return { operationId: deps.uuid(), accountScope: input.accountScope, snapshot, graph, quote };
}

/** What the UI creates when the visitor taps the launch button. Only a person approves a spend. */
export function userApproval(prep: IntentPreparation, ceilingCredits: number, ids: { id: string; trancheId: string }, now: Date): SpendApproval {
  return {
    id: ids.id, trancheId: ids.trancheId, operationId: prep.operationId, quoteId: prep.quote.id,
    snapshotDigest: prep.snapshot.digest, workflowDigest: prep.quote.workflowDigest,
    authorizedCeilingCredits: ceilingCredits, actor: "user", approvedAt: now.toISOString(), consumedByAttemptId: null,
  };
}

function checkApproval(prep: IntentPreparation, approval: SpendApproval, now: Date): void {
  const problems: string[] = [];
  if (approval?.actor !== "user") problems.push("actor");
  if (approval.consumedByAttemptId !== null) problems.push("consumed");
  if (approval.operationId !== prep.operationId) problems.push("operation");
  if (approval.quoteId !== prep.quote.id) problems.push("quote");
  if (approval.snapshotDigest !== prep.snapshot.digest || prep.quote.snapshotDigest !== prep.snapshot.digest) problems.push("snapshot");
  if (approval.workflowDigest !== prep.quote.workflowDigest) problems.push("workflow");
  if (Date.parse(prep.quote.expiresAt) <= now.getTime()) problems.push("expired");
  if (!(Number.isFinite(approval.authorizedCeilingCredits) && approval.authorizedCeilingCredits > 0)) problems.push("ceiling");
  else if (prep.quote.estimatedCredits !== null && prep.quote.estimatedCredits > approval.authorizedCeilingCredits) problems.push("ceiling");
  if (problems.length) throw new CinemaError("APPROVAL_REQUIRED", "A fresh user approval is required.", problems);
}

// ---------------------------------------------------------------- receipt storage

function isReceipt(value: unknown): value is IntentJobReceipt {
  const r = value as IntentJobReceipt | null;
  return !!r && r.schemaVersion === 2 && typeof r.operationId === "string" && typeof r.attemptId === "string"
    && typeof r.accountScope === "string" && r.snapshot?.kind === "intent" && (JOB_STATES as readonly string[]).includes(r.state)
    && (r.providerJobId === null || typeof r.providerJobId === "string") && r.approval?.actor === "user";
}

/**
 * The stored receipt after a reload. A receipt left in `submitting` means the tab closed between
 * the write and the answer: the POST may have left, so it reads as `submission_unknown`.
 */
export function readIntentReceipt(storage: Pick<Storage, "getItem">): IntentJobReceipt | null {
  let raw: string | null;
  try { raw = storage.getItem(INTENT_RECEIPT_KEY); } catch { throw new CinemaError("STORAGE_UNAVAILABLE", "Storage unreadable."); }
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new CinemaError("STORAGE_UNAVAILABLE", "Receipt unreadable."); }
  if (!isReceipt(parsed)) throw new CinemaError("STORAGE_UNAVAILABLE", "Unknown receipt version.");
  if (parsed.state === "submitting") return { ...parsed, state: "submission_unknown", error: { code: "SUBMISSION_UNKNOWN", safeMessage: "Submission outcome unknown." } };
  return parsed;
}

function writeReceipt(storage: StorageLike, receipt: IntentJobReceipt): void {
  try {
    // A credential-looking field or a signed URL is never written (it would outlive the session).
    assertNoSecretFields(receipt);
    const text = JSON.stringify(receipt);
    storage.setItem(INTENT_RECEIPT_KEY, text);
    if (storage.getItem(INTENT_RECEIPT_KEY) !== text) throw new Error("readback");
  } catch {
    throw new CinemaError("STORAGE_UNAVAILABLE", "The receipt could not be saved: nothing was sent.");
  }
}

const RANK: Record<JobState, number> = {
  prepared: 0, awaiting_approval: 1, authorized: 2, submitting: 3, submission_unknown: 4,
  queued: 5, running: 6, result_pending: 7, succeeded: 8, failed: 9, provider_cancelled: 9, settled: 10,
};

/** Moves forward only. A terminal state (or an older rank) never comes back from a stale read. */
export function advance(current: JobState, next: JobState): JobState {
  if (TERMINAL_JOB_STATES.includes(current)) return current;
  if (current === "succeeded" && next !== "settled") return current;
  return RANK[next] >= RANK[current] ? next : current;
}

function busy(storage: StorageLike): boolean {
  let other: string | null = null;
  try { other = storage.getItem(PENDING_RENDER_KEY); } catch { /* unreadable reads as busy below */ return true; }
  if (other) return true;
  const mine = readIntentReceipt(storage);
  return !!mine && !TERMINAL_JOB_STATES.includes(mine.state);
}

// ---------------------------------------------------------------- submit, poll, reconcile

export interface SubmitOptions {
  /** `qualification` lets a `candidate` manifest run: only for the user-authorized Cloud test. */
  purpose: "demo" | "qualification";
}

/**
 * Exactly one POST for one approval. The receipt (approval consumed) is written before the POST;
 * if it cannot be written nothing is sent. A lost answer becomes `submission_unknown`: no retry.
 */
export async function submitApprovedIntent(prep: IntentPreparation, approval: SpendApproval, deps: IntentJobDeps, options: SubmitOptions): Promise<IntentJobReceipt> {
  const now = deps.now();
  checkApproval(prep, approval, now);
  assertRunnable(deps.manifest ?? INTENT_MANIFEST, options.purpose);
  assertSubmittable(prep.graph, { openWeightsMode: deps.openWeightsMode ?? OPEN_WEIGHTS_MODE });
  // The graph sent is exactly the pinned template plus the data slots of this snapshot.
  const rebuilt = intentGraph({ userText: prep.snapshot.userText, contextText: "", seed: 0 });
  if (canonicalJson(stripData(prep.graph)) !== canonicalJson(stripData(rebuilt))) throw new CinemaError("WORKFLOW_UNQUALIFIED", "Graph differs from the pinned workflow.");
  if (busy(deps.storage)) throw new CinemaError("BUDGET_RESERVED", "Another operation is still pending.");

  const attemptId = deps.uuid();
  let receipt: IntentJobReceipt = {
    schemaVersion: 2, operationId: prep.operationId, attemptId, accountScope: prep.accountScope,
    snapshot: prep.snapshot, quote: prep.quote, approval: { ...approval, consumedByAttemptId: attemptId },
    state: "submitting", providerJobId: null, submittedAt: null, updatedAt: now.toISOString(),
    outputs: [], settlement: "none", text: null,
  };
  writeReceipt(deps.storage, receipt);

  let jobId: string;
  try {
    jobId = await deps.client.submit(prep.graph as never, attemptId);
  } catch (error) {
    const code = error instanceof RenderError ? error.code : "network";
    const refused = code === "auth" || code === "credits" || code === "subscription" || code === "invalid";
    receipt = {
      ...receipt, state: refused ? "failed" : "submission_unknown", updatedAt: deps.now().toISOString(),
      error: refused ? { code: "PROVIDER_REFUSED", safeMessage: `Refused by the provider (${code}).` }
        : { code: "SUBMISSION_UNKNOWN", safeMessage: "The provider's answer was lost. Check the Comfy history before any new attempt." },
    };
    writeReceiptQuiet(deps.storage, receipt);
    return receipt;
  }
  receipt = { ...receipt, state: "queued", providerJobId: jobId, submittedAt: deps.now().toISOString(), updatedAt: deps.now().toISOString() };
  writeReceiptQuiet(deps.storage, receipt);
  return receipt;
}

function stripData(graph: IntentGraph): IntentGraph {
  const copy: IntentGraph = structuredClone(graph);
  copy["2"].inputs.prompt = "";
  copy["2"].inputs["sampling_mode.seed"] = 0;
  return copy;
}

/** After the POST the answer matters more than the write: a failed write leaves `submitting` (= unknown on reload). */
function writeReceiptQuiet(storage: StorageLike, receipt: IntentJobReceipt): void {
  try { writeReceipt(storage, receipt); } catch { /* reload reads `submitting` as submission_unknown */ }
}

/** The text of a PreviewAny output in the job history, bounded. Null when absent. */
export async function readIntentText(outputs: Record<string, unknown> | undefined, node = INTENT_OUTPUT_NODE): Promise<IntentTextOutput | null> {
  const entry = outputs?.[node] as { text?: unknown } | undefined;
  const raw = Array.isArray(entry?.text) ? entry.text.find(item => typeof item === "string") : typeof entry?.text === "string" ? entry.text : undefined;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const cut = raw.length > INTENT_OUTPUT_MAX_CHARS;
  const text = cut ? raw.slice(0, INTENT_OUTPUT_MAX_CHARS) : raw;
  const body = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return { text, sha256: await sha256Text(text), truncated: cut || !body.endsWith("}"), node };
}

export type PollResult =
  | { receipt: IntentJobReceipt; retryAfterMs: null }
  | { receipt: IntentJobReceipt; retryAfterMs: number };

/**
 * One poll step. Reads only (status, then job history once done). A read failure keeps the state
 * and returns a backoff; it never cancels and never resubmits.
 */
export async function pollIntent(deps: IntentJobDeps, attempt = 0): Promise<PollResult | null> {
  const receipt = readIntentReceipt(deps.storage);
  if (!receipt) return null;
  if (!receipt.providerJobId || !["queued", "running", "result_pending"].includes(receipt.state)) return { receipt, retryAfterMs: null };
  const backoff = POLL_BACKOFF_MS[Math.min(attempt, POLL_BACKOFF_MS.length - 1)];
  let next: IntentJobReceipt = receipt;
  try {
    const stage = jobStage(await deps.client.status(receipt.providerJobId));
    if (stage === "queue") next = { ...receipt, state: advance(receipt.state, "queued") };
    else if (stage === "prepare" || stage === "render") next = { ...receipt, state: advance(receipt.state, "running") };
    else if (stage === "failed") next = { ...receipt, state: advance(receipt.state, "failed"), error: { code: "OUTPUT_INVALID", safeMessage: "The provider reports a failed job." } };
    else if (stage === "cancelled") next = { ...receipt, state: advance(receipt.state, "provider_cancelled") };
    else {
      const detail = await deps.client.job(receipt.providerJobId);
      const text = await readIntentText(detail.outputs);
      next = text
        ? { ...receipt, state: advance(receipt.state, "succeeded"), text, outputs: [{ assetId: `text:${text.sha256}`, kind: "text", sha256: text.sha256 }] }
        : { ...receipt, state: advance(receipt.state, "failed"), error: { code: "OUTPUT_INVALID", safeMessage: "The job finished without a text answer." } };
    }
  } catch {
    return { receipt, retryAfterMs: backoff };
  }
  next = { ...next, updatedAt: deps.now().toISOString() };
  writeReceiptQuiet(deps.storage, next);
  const waiting = next.state === "queued" || next.state === "running" || next.state === "result_pending";
  return waiting ? { receipt: next, retryAfterMs: POLL_BACKOFF_MS[0] } : { receipt: next, retryAfterMs: null };
}

/**
 * `submission_unknown` → the visitor found the job in their Comfy history and pastes its id.
 * Bound with a GET only (the job must exist on this account); never a new POST.
 */
export async function bindUnknownIntent(rawId: string, deps: IntentJobDeps): Promise<IntentJobReceipt> {
  const receipt = readIntentReceipt(deps.storage);
  if (!receipt || receipt.state !== "submission_unknown") throw new CinemaError("SUBMISSION_UNKNOWN", "No uncertain submission to bind.");
  const id = rawId.trim();
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) throw new CinemaError("SUBMISSION_UNKNOWN", "Not a job id.");
  await deps.client.job(id);
  const next: IntentJobReceipt = { ...receipt, state: "queued", providerJobId: id, updatedAt: deps.now().toISOString(), error: undefined };
  writeReceipt(deps.storage, next);
  return next;
}

/**
 * `submission_unknown` → the visitor checked their Comfy history and the job is not there. Their
 * decision closes the receipt (failed); only then may a new approval start a new attempt.
 */
export function declareUnknownAbsent(deps: Pick<IntentJobDeps, "storage" | "now">, confirmedByUser: boolean): IntentJobReceipt {
  const receipt = readIntentReceipt(deps.storage);
  if (!receipt || receipt.state !== "submission_unknown") throw new CinemaError("SUBMISSION_UNKNOWN", "No uncertain submission.");
  if (!confirmedByUser) throw new CinemaError("APPROVAL_REQUIRED", "Only the visitor can say the job is absent.");
  const next: IntentJobReceipt = { ...receipt, state: "failed", updatedAt: deps.now().toISOString(), error: { code: "SUBMISSION_UNKNOWN", safeMessage: "Declared absent from the Comfy history by the visitor." } };
  writeReceipt(deps.storage, next);
  return next;
}

/** CE3 stored and validated the proposal: the receipt can close. Only from `succeeded`. */
export function settleIntent(deps: Pick<IntentJobDeps, "storage" | "now">): IntentJobReceipt {
  const receipt = readIntentReceipt(deps.storage);
  if (!receipt || receipt.state !== "succeeded" || !receipt.text) throw new CinemaError("OUTPUT_INVALID", "Nothing to settle.");
  const next: IntentJobReceipt = { ...receipt, state: advance(receipt.state, "settled"), settlement: "projections_saved", updatedAt: deps.now().toISOString() };
  writeReceipt(deps.storage, next);
  return next;
}

/** Removes a receipt only once it is terminal; an open one is never dropped silently. */
export function forgetIntent(storage: StorageLike): boolean {
  const receipt = readIntentReceipt(storage);
  if (receipt && !TERMINAL_JOB_STATES.includes(receipt.state)) return false;
  storage.removeItem(INTENT_RECEIPT_KEY);
  return true;
}
