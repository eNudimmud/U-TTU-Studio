import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CREDITS_PER_USD, centsToCredits, costClaim, formatCredits, measuredCost, runGate, type CostRecord } from "../src/lib/credits.ts";
import { falGate } from "../src/lib/fal/gate.ts";

const record = (patch: Partial<CostRecord>): CostRecord => ({ profile: "h3-4pas-5s-vertical", credits: 120, gpuSeconds: 300, at: "2026-10-03T10:00:00.000Z", ...patch });

describe("un seul payeur, des chiffres mesurés", () => {
  it("converts the cloud's cents with Comfy's own rate", () => {
    assert.equal(CREDITS_PER_USD, 211);
    assert.equal(centsToCredits(100), 211);
    assert.equal(centsToCredits(4200), 8862);
    assert.match(formatCredits(8862), /^8.862$/);
  });

  it("quotes nothing until a take at the same setting was measured", () => {
    assert.deepEqual(costClaim("h3-4pas-5s-vertical", []), { state: "uncalibrated" });
    assert.deepEqual(costClaim("h3-4pas-5s-vertical", [record({ profile: "h3-20pas-5s-vertical" })]), { state: "uncalibrated" });
    assert.deepEqual(costClaim("h3-4pas-5s-vertical", [record({ credits: null })]), { state: "uncalibrated" });
    const claim = costClaim("h3-4pas-5s-vertical", [
      record({ credits: 90, at: "2026-10-01T10:00:00.000Z" }),
      record({ credits: 140, at: "2026-10-02T10:00:00.000Z" }),
      record({ credits: 110, at: "2026-10-03T10:00:00.000Z" }),
      record({ credits: 100, at: "2026-10-03T11:00:00.000Z" }),
    ]);
    assert.deepEqual(claim, { state: "measured", credits: 140, at: "2026-10-03T11:00:00.000Z", runs: 4 });
  });

  it("blocks a take the balance cannot cover, and never runs blind", () => {
    const uncalibrated = { state: "uncalibrated" } as const;
    assert.equal(runGate(null, uncalibrated).allowed, false);
    assert.equal(runGate({ credits: 0, readAt: 1 }, uncalibrated).allowed, false);
    const held = runGate({ credits: 500, readAt: 1 }, uncalibrated);
    assert.equal(held.allowed, false);
    assert.equal(held.tone, "block");
    assert.match(held.line, /Devis absent/);
    assert.doesNotMatch(held.line, /\d/);
    const measured = { state: "measured", credits: 140, at: "2026-10-03T11:00:00.000Z", runs: 2 } as const;
    assert.equal(runGate({ credits: 100, readAt: 1 }, measured).allowed, false);
    assert.match(runGate({ credits: 100, readAt: 1 }, measured).line, /140/);
    assert.equal(runGate({ credits: 400, readAt: 1 }, measured).allowed, true);
    assert.match(runGate({ credits: 400, readAt: 1 }, measured).line, /mesuré/);
  });

  it("refuses a fal training or take when the balance or the quote is missing or short", () => {
    const balance = { usd: 20, readAt: 1 };
    assert.equal(falGate(null, 15, "formation").allowed, false);
    assert.equal(falGate({ usd: 0, readAt: 1 }, 15, "formation").allowed, false);
    assert.equal(falGate(balance, null, "prise").allowed, false);
    assert.equal(falGate({ usd: 10, readAt: 1 }, 15, "formation").allowed, false);
    assert.match(falGate({ usd: 10, readAt: 1 }, 15, "formation").line, /15,00/);
    const open = falGate(balance, 15, "formation");
    assert.equal(open.allowed, true);
    assert.equal(open.tone, "ok");
    assert.match(open.line, /15,00 \$/);
    assert.match(falGate(balance, 0.38, "prise").line, /prise/i);
    const unread = falGate(null, 15, "formation", "optional");
    assert.equal(unread.allowed, true);
    assert.equal(unread.tone, "warn");
    assert.match(unread.line, /Solde non lu/);
    assert.match(unread.line, /15,00/);
    assert.equal(falGate(null, null, "formation", "optional").allowed, false);
  });

  it("takes the charge from two real readings, and refuses a reading a top-up spoiled", () => {
    assert.equal(measuredCost(5000, 4800), 200);
    assert.equal(measuredCost(5000, 5000), 0);
    assert.equal(measuredCost(5000, 9000), null);
    assert.equal(measuredCost(null, 4800), null);
    assert.equal(measuredCost(5000, null), null);
  });
});
