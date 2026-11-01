// CE5: account scope from the opaque Comfy user id only; ledger additions for the shared budget
// (caller-consumed approval, job closed with an unknown cost, global campaign limit).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cinemaAccountScope, isCinemaScope, opaqueUserId } from "../src/lib/cinema/account.ts";
import { assertCampaign, campaignHeld, closeWithUnknownCost, emptyLedger, recordCost, reserve, type SpendLedger } from "../src/lib/cinema/spend-ledger.ts";
import { CinemaError, type Quote, type SpendApproval } from "../src/lib/cinema/types.ts";

const NOW = new Date("2026-11-01T12:00:00Z");
const code = (fn: () => unknown, expected: string) => assert.throws(fn, (e: unknown) => e instanceof CinemaError && e.code === expected);

describe("account scope", () => {
  it("is a digest of the opaque id, stable across key rotation, different per account", async () => {
    const a = await cinemaAccountScope({ id: "acct-1", email: "x@y" });
    assert.ok(isCinemaScope(a));
    assert.equal(await cinemaAccountScope({ id: "acct-1" }), a);
    assert.notEqual(await cinemaAccountScope({ id: "acct-2" }), a);
    assert.ok(!a.includes("acct-1"));
  });
  it("refuses a missing, empty or oversized id: no fallback on user_id, uid or a key hash", async () => {
    for (const user of [null, {}, { id: "" }, { id: 12 }, { user_id: "u" }, { uid: "u" }, { id: "x".repeat(201) }]) {
      assert.equal(opaqueUserId(user), null);
      await assert.rejects(cinemaAccountScope(user), (e: unknown) => e instanceof CinemaError && e.code === "ACCOUNT_UNAVAILABLE");
    }
  });
});

describe("ledger additions", () => {
  const quote: Quote = { id: "q", snapshotDigest: "s", workflowDigest: "w", estimatedCredits: null, uncertaintyCredits: null, basis: "unavailable", createdAt: NOW.toISOString(), expiresAt: "2026-11-01T13:00:00Z" };
  const approval: SpendApproval = { id: "ap", trancheId: "t", operationId: "op", quoteId: "q", snapshotDigest: "s", workflowDigest: "w", authorizedCeilingCredits: 3, actor: "user", approvedAt: NOW.toISOString(), consumedByAttemptId: null };
  const held = (ledger: SpendLedger, consumedByCaller = false) => reserve({ ledger, quote, approval, attemptId: "a1", accountScope: "acc", trancheCapCredits: 10, balanceCredits: null, now: NOW, busy: false, consumedByCaller }).ledger;

  it("a caller-consumed approval reserves once and is listed once", () => {
    const consumed = { ...emptyLedger(), consumedApprovals: ["ap"] };
    code(() => held(consumed), "APPROVAL_REQUIRED");
    const ledger = held(consumed, true);
    assert.deepEqual(ledger.consumedApprovals, ["ap"]);
  });
  it("an unknown cost closes without blocking, keeps counting, and can be reconciled", () => {
    let ledger = closeWithUnknownCost(held(emptyLedger()), "a1", NOW);
    assert.equal(ledger.reservations[0]!.state, "settled");
    assert.equal(campaignHeld(ledger), 3, "the ceiling still counts, never zero");
    ledger = recordCost(ledger, "a1", { credits: 1.4, provenance: "billing_job", unit: "credits", readAt: NOW.toISOString() }, NOW);
    assert.equal(ledger.reservations[0]!.observed!.credits, 1.4);
  });
  it("the campaign limit: prior spend required, cap enforced", () => {
    const ledger = held(emptyLedger());
    code(() => assertCampaign(ledger, { capCredits: 300, priorCredits: null }, 3), "BUDGET_RESERVED");
    code(() => assertCampaign(ledger, { capCredits: 0, priorCredits: 0 }, 3), "BUDGET_RESERVED");
    code(() => assertCampaign(ledger, { capCredits: 300, priorCredits: 295 }, 3), "BUDGET_RESERVED");
    assertCampaign(ledger, { capCredits: 300, priorCredits: 294 }, 3);
  });
});
