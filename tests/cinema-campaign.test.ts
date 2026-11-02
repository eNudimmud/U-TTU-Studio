import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAMPAIGN } from "../src/lib/cinema/campaign.ts";
import { assertCampaign, emptyLedger } from "../src/lib/cinema/spend-ledger.ts";

describe("campaign limit (CE5)", () => {
  it("is the contest cap with a sourced, finite prior spend inside it", () => {
    assert.equal(CAMPAIGN.capCredits, 300);
    assert.ok(Number.isFinite(CAMPAIGN.priorCredits) && CAMPAIGN.priorCredits! >= 0 && CAMPAIGN.priorCredits! < CAMPAIGN.capCredits);
    assert.match(CAMPAIGN.asOf, /^\d{4}-\d{2}-\d{2}T/);
  });
  it("lets one small reserve through and refuses one that crosses the cap", () => {
    assert.doesNotThrow(() => assertCampaign(emptyLedger(), CAMPAIGN, 3));
    assert.throws(() => assertCampaign(emptyLedger(), CAMPAIGN, CAMPAIGN.capCredits - CAMPAIGN.priorCredits! + 1), /BUDGET|campagne/i);
  });
});
