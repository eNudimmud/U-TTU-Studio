// CE2: what a paid job may cost, and what it did cost, kept per attempt.
//
// - One submission at a time, across the take receipt, the intent receipt and this ledger.
// - An approval is consumed once, by one attempt, and written before the POST.
// - An unknown cost reserves the whole approved ceiling; an uncertain attempt (submission_unknown)
//   keeps its reserve until the provider proves it absent or bills it.
// - The balance is indicative: it never replaces a quote and an approval, and a balance going up
//   (top-up, monthly grant, late invoice) is never read as a negative or zero cost.
// - The observed cost names its source: billing_job (the account event feed of #209), gpu_estimate
//   (compute time × billed rate, shown « ≈ … estimés »), or unknown.
import type { JobCharge } from "../render/client.ts";
import { PENDING_RENDER_KEY } from "../render/recovery.ts";
import { gpuTimeCredits } from "../credits.ts";
import { INTENT_RECEIPT_KEY, readIntentReceipt } from "./intent-job.ts";
import { CinemaError, TERMINAL_JOB_STATES, type CinemaDiagnostic, type ObservedCost, type Quote, type SpendApproval, type StorageLike } from "./types.ts";

import { SPEND_LEDGER_KEY } from "./approval-ledger.ts";
// One ledger for every paid kind: the key (and the consumed approvals list) is shared with the intent job.
export { SPEND_LEDGER_KEY };
export const PAID_SESSION_KEY = "u-ttu-paid-session";
/** A paid session that has not said it is alive for this long is presumed closed. */
export const PAID_SESSION_TTL_MS = 45_000;

export type ReservationState = "reserved" | "uncertain" | "settled" | "released";

export interface Reservation {
  attemptId: string;
  operationId: string;
  approvalId: string;
  trancheId: string;
  accountScope: string;
  reservedCredits: number;
  /** `ceiling` when the quote had no estimate: the whole approved ceiling stays reserved. */
  basis: "estimate" | "ceiling";
  state: ReservationState;
  observed: ObservedCost | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpendLedger {
  schemaVersion: 1;
  consumedApprovals: string[];
  reservations: Reservation[];
}

export const emptyLedger = (): SpendLedger => ({ schemaVersion: 1, consumedApprovals: [], reservations: [] });

const ACTIVE: ReservationState[] = ["reserved", "uncertain"];

export function readLedger(storage: Pick<Storage, "getItem">): SpendLedger {
  let raw: string | null;
  try { raw = storage.getItem(SPEND_LEDGER_KEY); } catch { throw new CinemaError("STORAGE_UNAVAILABLE", "Registre des dépenses illisible."); }
  if (!raw) return emptyLedger();
  try {
    const data = JSON.parse(raw) as SpendLedger;
    if (data.schemaVersion !== 1 || !Array.isArray(data.reservations) || !Array.isArray(data.consumedApprovals)) throw new Error("shape");
    return data;
  } catch {
    // Unreadable is never read as « nothing reserved ».
    throw new CinemaError("STORAGE_UNAVAILABLE", "Registre des dépenses illisible : aucun envoi.");
  }
}

export function writeLedger(storage: StorageLike, ledger: SpendLedger): void {
  const text = JSON.stringify(ledger);
  try {
    storage.setItem(SPEND_LEDGER_KEY, text);
    if (storage.getItem(SPEND_LEDGER_KEY) !== text) throw new Error("readback");
  } catch { throw new CinemaError("STORAGE_UNAVAILABLE", "La réserve n'a pas pu être enregistrée : rien n'est envoyé."); }
}

/** Credits held by a tranche: settled costs (or their reserve when the cost is unknown) plus active reserves. */
export function trancheHeld(ledger: SpendLedger, trancheId: string): number {
  return ledger.reservations
    .filter(item => item.trancheId === trancheId && item.state !== "released")
    .reduce((sum, item) => sum + (item.state === "settled" && item.observed?.credits != null ? item.observed.credits : item.reservedCredits), 0);
}

/** Any paid operation still open in this browser: the legacy take receipt, the intent receipt, or an active reserve. */
export function submissionBusy(storage: StorageLike): boolean {
  try {
    if (storage.getItem(PENDING_RENDER_KEY)) return true;
    const intent = storage.getItem(INTENT_RECEIPT_KEY) ? readIntentReceipt(storage) : null;
    if (intent && !TERMINAL_JOB_STATES.includes(intent.state)) return true;
    return readLedger(storage).reservations.some(item => ACTIVE.includes(item.state));
  } catch { return true; }
}

export interface ReserveInput {
  ledger: SpendLedger;
  quote: Quote;
  approval: SpendApproval;
  attemptId: string;
  accountScope: string;
  /** Ceiling of the tranche the visitor opened (e.g. 300 credits). */
  trancheCapCredits: number;
  /** Indicative. Never a permission. */
  balanceCredits: number | null;
  now: Date;
  /** Another paid operation is open (submissionBusy, or a second session). */
  busy: boolean;
}

export interface Reserved { ledger: SpendLedger; reservation: Reservation; diagnostics: CinemaDiagnostic[] }

/** Consumes the approval and reserves its cost. Persist the result BEFORE the POST. */
export function reserve(input: ReserveInput): Reserved {
  const { ledger, quote, approval, now } = input;
  if (approval.actor !== "user") throw new CinemaError("APPROVAL_REQUIRED", "Seule une personne autorise une dépense.");
  if (approval.consumedByAttemptId || ledger.consumedApprovals.includes(approval.id)) throw new CinemaError("APPROVAL_REQUIRED", "Cette autorisation a déjà servi : une nouvelle est nécessaire.");
  if (approval.quoteId !== quote.id || approval.snapshotDigest !== quote.snapshotDigest || approval.workflowDigest !== quote.workflowDigest) throw new CinemaError("APPROVAL_REQUIRED", "L'autorisation ne correspond pas à ce devis.");
  if (Date.parse(quote.expiresAt) <= now.getTime()) throw new CinemaError("QUOTE_UNAVAILABLE", "Le devis a expiré : nouvelle estimation et nouvelle autorisation nécessaires.");
  if (input.busy || ledger.reservations.some(item => ACTIVE.includes(item.state))) throw new CinemaError("BUDGET_RESERVED", "Une autre opération payante est encore ouverte.");

  const known = quote.estimatedCredits !== null && quote.basis !== "unavailable";
  const estimate = known ? Math.ceil(quote.estimatedCredits! + (quote.uncertaintyCredits ?? 0)) : null;
  if (estimate !== null && estimate > approval.authorizedCeilingCredits) throw new CinemaError("APPROVAL_REQUIRED", "L'estimation dépasse le plafond autorisé.", [`≈ ${estimate} crédits estimés`]);
  const reservedCredits = estimate ?? approval.authorizedCeilingCredits;
  if (!(reservedCredits > 0)) throw new CinemaError("APPROVAL_REQUIRED", "Plafond autorisé invalide.");
  if (trancheHeld(ledger, approval.trancheId) + reservedCredits > input.trancheCapCredits) throw new CinemaError("BUDGET_RESERVED", "La tranche ne couvre pas cette réserve.", [`tranche ${input.trancheCapCredits}`]);

  const diagnostics: CinemaDiagnostic[] = [];
  if (input.balanceCredits !== null && input.balanceCredits < reservedCredits) diagnostics.push({ code: "BALANCE_LOW", detail: "indicative balance below the reserve" });
  const at = now.toISOString();
  const reservation: Reservation = {
    attemptId: input.attemptId, operationId: approval.operationId, approvalId: approval.id, trancheId: approval.trancheId,
    accountScope: input.accountScope, reservedCredits, basis: estimate === null ? "ceiling" : "estimate",
    state: "reserved", observed: null, createdAt: at, updatedAt: at,
  };
  return { ledger: { ...ledger, consumedApprovals: [...ledger.consumedApprovals, approval.id], reservations: [...ledger.reservations, reservation] }, reservation, diagnostics };
}

function update(ledger: SpendLedger, attemptId: string, change: (item: Reservation) => Reservation): SpendLedger {
  if (!ledger.reservations.some(item => item.attemptId === attemptId)) throw new CinemaError("BUDGET_RESERVED", "Réserve introuvable.", [attemptId]);
  return { ...ledger, reservations: ledger.reservations.map(item => item.attemptId === attemptId ? change(item) : item) };
}

/** The POST may have left (lost answer, tab closed while submitting): the reserve stays. */
export function markUncertain(ledger: SpendLedger, attemptId: string, now: Date): SpendLedger {
  return update(ledger, attemptId, item => item.state === "reserved" ? { ...item, state: "uncertain", updatedAt: now.toISOString() } : item);
}

/**
 * Releases a reserve only when the job provably never ran: refused before any POST, or confirmed
 * absent by the visitor after checking the provider history. An uncertain attempt is never released silently.
 */
export function release(ledger: SpendLedger, attemptId: string, proof: "never_sent" | "confirmed_absent", now: Date): SpendLedger {
  return update(ledger, attemptId, item => {
    if (!ACTIVE.includes(item.state)) return item;
    if (item.state === "uncertain" && proof !== "confirmed_absent") throw new CinemaError("SUBMISSION_UNKNOWN", "Envoi incertain : la réserve reste jusqu'à vérification.");
    return { ...item, state: "released", updatedAt: now.toISOString() };
  });
}

/** Records the observed cost. An unknown cost keeps the reserve (the attempt stays held, never counted as zero). */
export function recordCost(ledger: SpendLedger, attemptId: string, observed: ObservedCost, now: Date): SpendLedger {
  return update(ledger, attemptId, item => {
    if (item.state === "settled" || item.state === "released") return item;
    if (observed.provenance === "unknown" || observed.credits === null) return { ...item, observed, updatedAt: now.toISOString() };
    return { ...item, state: "settled", observed, updatedAt: now.toISOString() };
  });
}

/**
 * The cost of one job, from what the provider says about that job. The balance difference is not an
 * input: it rises with top-ups and late invoices (347 → 360 on 01.11.2026).
 */
export function observedCost(charge: JobCharge | null, gpuSeconds: number | null, readAt: string | null): ObservedCost {
  if (charge && Number.isFinite(charge.credits) && charge.credits >= 0) return { credits: charge.credits, provenance: "billing_job", unit: "credits", readAt };
  const estimate = gpuTimeCredits(gpuSeconds ?? charge?.gpuSeconds ?? null);
  if (estimate !== null) return { credits: estimate, provenance: "gpu_estimate", unit: "credits", readAt };
  return { credits: null, provenance: "unknown", unit: "credits", readAt };
}

/** « ≈ X crédits estimés » for an estimate, the billed figure otherwise; never « gratuit ». */
export function costLabel(cost: ObservedCost): string {
  if (cost.credits === null) return "coût inconnu (réserve conservée)";
  return cost.provenance === "billing_job" ? `${cost.credits} crédits facturés` : `≈ ${cost.credits} crédits estimés`;
}

// ---------------------------------------------------------------- second paid session

export interface PaidSessionLocks {
  request(name: string, options: { mode: "exclusive"; ifAvailable: true }, fn: (lock: unknown) => Promise<unknown>): Promise<unknown>;
}

/**
 * Holds the paid session while `fn` runs. With Web Locks the exclusion is real; without them there is
 * no reliable exclusion, so a second session is blocked as soon as another live marker is seen, and
 * the marker is only a best effort (documented, never claimed as a lock).
 */
export async function withPaidSession<T>(
  env: { locks: PaidSessionLocks | null; storage: StorageLike; sessionId: string; now: () => number },
  fn: () => Promise<T>,
): Promise<T> {
  if (env.locks) {
    let ran = false;
    let out: T;
    await env.locks.request("u-ttu-paid-session", { mode: "exclusive", ifAvailable: true }, async lock => {
      if (!lock) return;
      ran = true;
      out = await fn();
    });
    if (!ran) throw new CinemaError("BUDGET_RESERVED", "Une autre fenêtre envoie déjà un rendu payant.");
    return out!;
  }
  claimMarker(env.storage, env.sessionId, env.now());
  try { return await fn(); }
  finally { try { if (readMarker(env.storage)?.sessionId === env.sessionId) env.storage.removeItem(PAID_SESSION_KEY); } catch { /* the marker expires */ } }
}

function readMarker(storage: Pick<Storage, "getItem">): { sessionId: string; at: number } | null {
  try { const raw = storage.getItem(PAID_SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function claimMarker(storage: StorageLike, sessionId: string, now: number): void {
  const other = readMarker(storage);
  if (other && other.sessionId !== sessionId && now - other.at < PAID_SESSION_TTL_MS) throw new CinemaError("BUDGET_RESERVED", "Une autre fenêtre envoie déjà un rendu payant.");
  const text = JSON.stringify({ sessionId, at: now });
  try { storage.setItem(PAID_SESSION_KEY, text); } catch { throw new CinemaError("STORAGE_UNAVAILABLE", "Session payante non enregistrée : rien n'est envoyé."); }
  if (storage.getItem(PAID_SESSION_KEY) !== text) throw new CinemaError("BUDGET_RESERVED", "Une autre fenêtre envoie déjà un rendu payant.");
}
