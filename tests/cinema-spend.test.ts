// CE2: the spend ledger. Approval consumed once, unknown cost reserved, uncertain attempt keeps its
// reserve, expired estimate refused, balance indicative only (a rising balance is never a cost),
// cost per job with its provenance, second paid session blocked without Web Locks. No network.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PENDING_RENDER_KEY } from "../src/lib/render/recovery.ts";
import { INTENT_RECEIPT_KEY } from "../src/lib/cinema/intent-job.ts";
import { assertNoSecretFields } from "../src/lib/cinema/digest.ts";
import {
  PAID_SESSION_TTL_MS, SPEND_LEDGER_KEY, costLabel, emptyLedger, markUncertain, observedCost, readLedger, recordCost, release, reserve,
  submissionBusy, trancheHeld, withPaidSession, writeLedger, type ReserveInput,
} from "../src/lib/cinema/spend-ledger.ts";
import { CinemaError, type Quote, type SpendApproval, type StorageLike } from "../src/lib/cinema/types.ts";

const NOW = new Date("2026-11-01T12:00:00.000Z");
const quote = (estimated: number | null = 4, expiresAt = "2026-11-01T12:15:00.000Z"): Quote => ({
  id: "q1", snapshotDigest: "d", workflowDigest: "w", estimatedCredits: estimated, uncertaintyCredits: estimated === null ? null : 1,
  basis: estimated === null ? "unavailable" : "measured_similar_job", createdAt: NOW.toISOString(), expiresAt,
});
const approval = (over: Partial<SpendApproval> = {}): SpendApproval => ({
  id: "a1", trancheId: "t1", operationId: "op1", quoteId: "q1", snapshotDigest: "d", workflowDigest: "w",
  authorizedCeilingCredits: 10, actor: "user", approvedAt: NOW.toISOString(), consumedByAttemptId: null, ...over,
});
const input = (over: Partial<ReserveInput> = {}): ReserveInput => ({
  ledger: emptyLedger(), quote: quote(), approval: approval(), attemptId: "att-1", accountScope: "comfy-user-7f3a",
  trancheCapCredits: 300, balanceCredits: 100, now: NOW, busy: false, ...over,
});
const code = (c: string) => (e: unknown) => e instanceof CinemaError && e.code === c;

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); } };
}

describe("CE2 spend ledger", () => {
  it("reserves the estimate plus its uncertainty and consumes the approval once", () => {
    const { ledger, reservation } = reserve(input());
    assert.equal(reservation.reservedCredits, 5);
    assert.equal(reservation.basis, "estimate");
    assert.deepEqual(ledger.consumedApprovals, ["a1"]);
    const released = release(ledger, "att-1", "never_sent", NOW);
    assert.throws(() => reserve(input({ ledger: released, attemptId: "att-2" })), code("APPROVAL_REQUIRED"));
    assert.throws(() => reserve(input({ approval: approval({ consumedByAttemptId: "att-0" }) })), code("APPROVAL_REQUIRED"));
  });

  it("an unknown cost reserves the whole approved ceiling, never zero", () => {
    const { reservation } = reserve(input({ quote: quote(null) }));
    assert.equal(reservation.reservedCredits, 10);
    assert.equal(reservation.basis, "ceiling");
  });

  it("an expired estimate, a foreign quote or an estimate above the ceiling needs a new approval", () => {
    assert.throws(() => reserve(input({ quote: quote(4, "2026-11-01T11:59:59.000Z") })), code("QUOTE_UNAVAILABLE"));
    assert.throws(() => reserve(input({ approval: approval({ quoteId: "q-other" }) })), code("APPROVAL_REQUIRED"));
    assert.throws(() => reserve(input({ quote: quote(20) })), code("APPROVAL_REQUIRED"));
    assert.throws(() => reserve(input({ approval: approval({ actor: "model" as never }) })), code("APPROVAL_REQUIRED"));
  });

  it("a high balance never replaces a quote and an approval; a low one is only a warning", () => {
    assert.throws(() => reserve(input({ balanceCredits: 1_000_000, approval: approval({ snapshotDigest: "changed" }) })), code("APPROVAL_REQUIRED"));
    assert.equal(reserve(input({ balanceCredits: 2 })).diagnostics[0].code, "BALANCE_LOW");
    assert.equal(reserve(input({ balanceCredits: null })).diagnostics.length, 0);
  });

  it("one submission at a time, and the tranche cap holds", () => {
    const { ledger } = reserve(input());
    assert.throws(() => reserve(input({ ledger, approval: approval({ id: "a2" }), attemptId: "att-2" })), code("BUDGET_RESERVED"));
    assert.throws(() => reserve(input({ busy: true })), code("BUDGET_RESERVED"));
    const settled = recordCost(ledger, "att-1", { credits: 296, provenance: "billing_job", unit: "credits", readAt: null }, NOW);
    assert.equal(trancheHeld(settled, "t1"), 296);
    assert.throws(() => reserve(input({ ledger: settled, approval: approval({ id: "a2" }), attemptId: "att-2" })), code("BUDGET_RESERVED"));
  });

  it("an uncertain attempt keeps its reserve until the provider history proves it absent", () => {
    const uncertain = markUncertain(reserve(input()).ledger, "att-1", NOW);
    assert.equal(uncertain.reservations[0].state, "uncertain");
    assert.throws(() => release(uncertain, "att-1", "never_sent", NOW), code("SUBMISSION_UNKNOWN"));
    assert.equal(trancheHeld(uncertain, "t1"), 5);
    assert.equal(release(uncertain, "att-1", "confirmed_absent", NOW).reservations[0].state, "released");
  });

  it("cost per job with provenance; a rising balance is never read as a cost", () => {
    assert.deepEqual(observedCost({ credits: 3, gpuSeconds: 10 }, null, "t"), { credits: 3, provenance: "billing_job", unit: "credits", readAt: "t" });
    const estimated = observedCost(null, 20, "t");
    assert.equal(estimated.provenance, "gpu_estimate");
    assert.ok(estimated.credits! > 0);
    // Balance went 347 → 360: no charge row, no GPU time. Unknown, and the reserve stays.
    const unknown = observedCost(null, null, "t");
    assert.equal(unknown.provenance, "unknown");
    const ledger = recordCost(reserve(input()).ledger, "att-1", unknown, NOW);
    assert.equal(ledger.reservations[0].state, "reserved");
    assert.equal(trancheHeld(ledger, "t1"), 5);
  });

  it("labels say « ≈ X crédits estimés », never « gratuit »", () => {
    assert.equal(costLabel({ credits: 2, provenance: "gpu_estimate", unit: "credits", readAt: null }), "≈ 2 crédits estimés");
    assert.equal(costLabel({ credits: 2, provenance: "billing_job", unit: "credits", readAt: null }), "2 crédits facturés");
    for (const label of [costLabel({ credits: 0, provenance: "gpu_estimate", unit: "credits", readAt: null }), costLabel({ credits: null, provenance: "unknown", unit: "credits", readAt: null })]) {
      assert.doesNotMatch(label, /gratuit|free/i);
    }
  });

  it("persists with read-back; an unreadable ledger is never « nothing reserved »", () => {
    const storage = memoryStorage();
    const { ledger } = reserve(input());
    writeLedger(storage, ledger);
    assert.deepEqual(readLedger(storage), ledger);
    assertNoSecretFields(ledger);
    storage.setItem(SPEND_LEDGER_KEY, "{broken");
    assert.throws(() => readLedger(storage), code("STORAGE_UNAVAILABLE"));
    assert.equal(submissionBusy(storage), true);
  });

  it("busy across the take receipt, the intent receipt and active reserves", () => {
    const storage = memoryStorage();
    assert.equal(submissionBusy(storage), false);
    storage.setItem(PENDING_RENDER_KEY, "{}");
    assert.equal(submissionBusy(storage), true);
    storage.removeItem(PENDING_RENDER_KEY);
    storage.setItem(INTENT_RECEIPT_KEY, "{broken");
    assert.equal(submissionBusy(storage), true);
    storage.removeItem(INTENT_RECEIPT_KEY);
    writeLedger(storage, reserve(input()).ledger);
    assert.equal(submissionBusy(storage), true);
  });
});

describe("CE2 second paid session", () => {
  it("with Web Locks: the second session is refused while the first holds it", async () => {
    let held = false;
    const locks = { request: async (_n: string, _o: unknown, fn: (lock: unknown) => Promise<unknown>) => { if (held) return fn(null); held = true; try { return await fn({}); } finally { held = false; } } };
    const storage = memoryStorage();
    let inner: Promise<unknown> | null = null;
    await withPaidSession({ locks, storage, sessionId: "tab-a", now: () => 0 }, async () => {
      inner = withPaidSession({ locks, storage, sessionId: "tab-b", now: () => 0 }, async () => "ran");
      await assert.rejects(inner, code("BUDGET_RESERVED"));
    });
    assert.equal(await withPaidSession({ locks, storage, sessionId: "tab-b", now: () => 0 }, async () => "ran"), "ran");
  });

  it("without Web Locks there is no reliable exclusion: a second live session is blocked", async () => {
    const storage = memoryStorage();
    storage.setItem("u-ttu-paid-session", JSON.stringify({ sessionId: "tab-a", at: 1_000 }));
    await assert.rejects(withPaidSession({ locks: null, storage, sessionId: "tab-b", now: () => 2_000 }, async () => "ran"), code("BUDGET_RESERVED"));
    assert.equal(await withPaidSession({ locks: null, storage, sessionId: "tab-b", now: () => 1_000 + PAID_SESSION_TTL_MS }, async () => "ran"), "ran");
    assert.equal(storage.getItem("u-ttu-paid-session"), null, "the marker is cleared after the session");
  });
});
