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
  /**
   * CE5-R · an invoice above what was reserved. The invoice still counts in full (never capped); the
   * next paid operation is refused until the overrun is acknowledged (`acknowledgeOverrun`).
   */
  overrun?: { credits: number; recordedAt: string; acknowledgedAt: string | null };
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

/** Proof hierarchy of an observed cost (CE5-R): `billing_job > gpu_estimate > unknown`. */
const COST_RANK: Record<ObservedCost["provenance"], number> = { unknown: 0, gpu_estimate: 1, billing_job: 2 };

/**
 * What one reservation holds. An invoice of the job counts as billed, above or below the reserve.
 * Before an invoice, at least the reserve, or the most conservative estimate when it is higher.
 */
export function heldBy(item: Reservation): number {
  if (item.observed?.provenance === "billing_job" && item.observed.credits != null) return item.observed.credits;
  if (item.state === "released") return 0;
  const estimate = item.observed?.provenance === "gpu_estimate" && item.observed.credits != null ? item.observed.credits : 0;
  return Math.max(item.reservedCredits, estimate);
}

/** Credits held by a tranche: billed costs, otherwise the reserve or the higher estimate. */
export function trancheHeld(ledger: SpendLedger, trancheId: string): number {
  return ledger.reservations
    .filter(item => item.trancheId === trancheId)
    .reduce((sum, item) => sum + heldBy(item), 0);
}

/** An invoice above its reserve that nobody looked at yet: the next paid operation waits. */
export function unacknowledgedOverrun(ledger: SpendLedger): Reservation | null {
  return ledger.reservations.find(item => item.overrun && !item.overrun.acknowledgedAt) ?? null;
}

/** The person saw the overrun (billed above the reserve). The billed amount keeps counting. */
export function acknowledgeOverrun(ledger: SpendLedger, attemptId: string, now: Date): SpendLedger {
  return update(ledger, attemptId, item => item.overrun && !item.overrun.acknowledgedAt
    ? { ...item, overrun: { ...item.overrun, acknowledgedAt: now.toISOString() }, updatedAt: now.toISOString() } : item);
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
  /**
   * CE5 · intent jobs: CE0 already consumed this approval in the same ledger (approval-ledger.ts) just
   * before calling the reserve, under the same paid-session lock; it is not consumed twice. Not a
   * bypass: the approval must be listed as consumed, and no other reservation may already use it, so
   * the consumption binds to this attempt only. A media approval never sets this.
   */
  consumedByCaller?: boolean;
}

export interface Reserved { ledger: SpendLedger; reservation: Reservation; diagnostics: CinemaDiagnostic[] }

/** Consumes the approval and reserves its cost. Persist the result BEFORE the POST. */
export function reserve(input: ReserveInput): Reserved {
  const { ledger, quote, approval, now } = input;
  if (approval.actor !== "user") throw new CinemaError("APPROVAL_REQUIRED", "Seule une personne autorise une dépense.");
  if (approval.consumedByAttemptId || (!input.consumedByCaller && ledger.consumedApprovals.includes(approval.id))) throw new CinemaError("APPROVAL_REQUIRED", "Cette autorisation a déjà servi : une nouvelle est nécessaire.");
  if (input.consumedByCaller && (!ledger.consumedApprovals.includes(approval.id) || ledger.reservations.some(item => item.approvalId === approval.id))) {
    throw new CinemaError("APPROVAL_REQUIRED", "Cette autorisation n'est pas liée à cet envoi : une nouvelle est nécessaire.", ["consumed-by-caller"]);
  }
  if (approval.quoteId !== quote.id || approval.snapshotDigest !== quote.snapshotDigest || approval.workflowDigest !== quote.workflowDigest) throw new CinemaError("APPROVAL_REQUIRED", "L'autorisation ne correspond pas à ce devis.");
  if (Date.parse(quote.expiresAt) <= now.getTime()) throw new CinemaError("QUOTE_UNAVAILABLE", "Le devis a expiré : nouvelle estimation et nouvelle autorisation nécessaires.");
  if (input.busy || ledger.reservations.some(item => ACTIVE.includes(item.state))) throw new CinemaError("BUDGET_RESERVED", "Une autre opération payante est encore ouverte.");
  const overrun = unacknowledgedOverrun(ledger);
  if (overrun) throw new CinemaError("BUDGET_RESERVED", "Une facture a dépassé sa réserve : à vérifier avant tout nouvel envoi.", [`overrun ${overrun.overrun!.credits}`]);

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
  const consumedApprovals = ledger.consumedApprovals.includes(approval.id) ? ledger.consumedApprovals : [...ledger.consumedApprovals, approval.id];
  return { ledger: { ...ledger, consumedApprovals, reservations: [...ledger.reservations, reservation] }, reservation, diagnostics };
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

/**
 * Records the observed cost of one attempt (CE5-R). Proof hierarchy `billing_job > gpu_estimate >
 * unknown`: a stronger proof replaces a weaker one, never the reverse; the same proof is idempotent.
 * - An unknown cost keeps the reserve (the attempt stays held, never counted as zero).
 * - An estimate settles the job; it holds at least the reserve, or itself when higher.
 * - The invoice of the job supersedes any estimate, even above the reserve: the overrun is recorded
 *   and blocks the next operation (`reserve`), the cost is never capped. A later invoice (newer
 *   `readAt`) replaces an earlier one. An invoice also counts on a released reserve: it proves a spend.
 */
export function recordCost(ledger: SpendLedger, attemptId: string, observed: ObservedCost, now: Date): SpendLedger {
  const at = now.toISOString();
  return update(ledger, attemptId, item => {
    const known = observed.provenance !== "unknown" && observed.credits !== null && Number.isFinite(observed.credits) && observed.credits >= 0;
    if (!known) {
      // Never downgrade a known cost; an active reserve only notes that the cost is still unknown.
      if (!ACTIVE.includes(item.state) || (item.observed && COST_RANK[item.observed.provenance] > 0)) return item;
      return { ...item, observed: { ...observed, credits: null, provenance: "unknown" }, updatedAt: at };
    }
    const current = item.observed && item.observed.credits !== null ? item.observed : null;
    if (item.state === "released" && observed.provenance !== "billing_job") return item;
    if (current) {
      const rank = COST_RANK[observed.provenance] - COST_RANK[current.provenance];
      if (rank < 0) return item;
      if (rank === 0) {
        if (current.credits === observed.credits) return item;
        // Same proof, other figure: a newer invoice replaces; two estimates keep the higher one.
        if (observed.provenance === "billing_job" && current.readAt && observed.readAt && Date.parse(observed.readAt) < Date.parse(current.readAt)) return item;
        if (observed.provenance === "gpu_estimate" && observed.credits! < current.credits!) return item;
      }
    }
    const next: Reservation = { ...item, state: "settled", observed, updatedAt: at };
    if (observed.provenance === "billing_job" && observed.credits! > item.reservedCredits) {
      next.overrun = { credits: observed.credits! - item.reservedCredits, recordedAt: at, acknowledgedAt: null };
    } else if (observed.provenance === "billing_job") {
      delete next.overrun;
    }
    return next;
  });
}

/**
 * CE5 · the job is proven terminal on the provider but its cost is still unknown: the reserve keeps
 * counting in the tranche and the campaign (never zero, never an invoice, never a release), yet it no
 * longer blocks the next approved operation. `recordCost` can still reconcile it from the invoice.
 * Only for a job the provider reported terminal; an uncertain POST qualifies only once it has been
 * bound to a provider job id (`boundJobId`). Never for an unbound uncertain POST.
 */
export function closeWithUnknownCost(ledger: SpendLedger, attemptId: string, now: Date, proof: { terminal: true; boundJobId?: string | null } = { terminal: true }): SpendLedger {
  if (proof?.terminal !== true) throw new CinemaError("SUBMISSION_UNKNOWN", "Fin du job non prouvée : la réserve reste ouverte.");
  return update(ledger, attemptId, item => {
    if (item.state === "uncertain" && !proof.boundJobId) return item;
    if (!ACTIVE.includes(item.state)) return item;
    return { ...item, state: "settled", observed: item.observed ?? { credits: null, provenance: "unknown", unit: "credits", readAt: null }, updatedAt: now.toISOString() };
  });
}

/** Credits held by the whole campaign in this browser: every tranche, agent and media, settled or open (billed overruns included). */
export function campaignHeld(ledger: SpendLedger): number {
  return [...new Set(ledger.reservations.map(item => item.trancheId))].reduce((sum, id) => sum + trancheHeld(ledger, id), 0);
}

export interface CampaignLimit {
  /** The global ceiling JD set for the contest (300). */
  capCredits: number;
  /** Credits already spent before this ledger existed (earlier tests, agent included). Null = not entered yet. */
  priorCredits: number | null;
}

/**
 * The global campaign limit, on top of the tranche: prior spend + everything this ledger holds + the
 * new reserve must stay within the cap. A missing or non-finite figure refuses (the counter is not reliable).
 */
export function assertCampaign(ledger: SpendLedger, limit: CampaignLimit, addCredits: number): void {
  const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
  if (!finite(limit.capCredits) || !(limit.capCredits > 0)) throw new CinemaError("BUDGET_RESERVED", "Plafond de campagne invalide.", ["campaign-cap"]);
  if (!finite(limit.priorCredits)) throw new CinemaError("BUDGET_RESERVED", "Dépense antérieure de la campagne non renseignée : aucun envoi.", ["campaign-prior"]);
  if (!(Number.isFinite(addCredits) && addCredits > 0)) throw new CinemaError("APPROVAL_REQUIRED", "Plafond autorisé invalide.", ["ceiling"]);
  if (limit.priorCredits + campaignHeld(ledger) + addCredits > limit.capCredits) throw new CinemaError("BUDGET_RESERVED", "La limite de campagne ne couvre pas cette réserve.", [`campagne ${limit.capCredits}`]);
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
