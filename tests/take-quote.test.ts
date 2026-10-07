import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runGate } from "../src/lib/credits.ts";
import { TAKE_QUOTE, takeHasWholeRunQuote } from "../src/lib/render/take-quote.ts";

describe("devis de la prise H3", () => {
  it("records a zero that is not a whole-run total", () => {
    assert.equal(TAKE_QUOTE.readAt, "2026-10-07");
    assert.equal(TAKE_QUOTE.template, "video_minimax_h3_r2v");
    assert.equal(TAKE_QUOTE.profile, "h3-4pas-5s-vertical");
    assert.equal(TAKE_QUOTE.estimatorCredits, 0);
    assert.equal(TAKE_QUOTE.paidApiNodes, false);
    assert.equal(TAKE_QUOTE.gpuIncluded, false);
    assert.equal(TAKE_QUOTE.wholeRunCredits, null);
    assert.equal(takeHasWholeRunQuote(), false);
    assert.equal(readFileSync("src/lib/render/take-quote.ts", "utf8").includes("run_template"), false);
  });

  it("keeps an unmeasured take from leaving, and a measured one behind its number", () => {
    const held = runGate({ credits: 9000, readAt: 1 }, { state: "uncalibrated" });
    assert.equal(held.allowed, false);
    assert.equal(held.tone, "block");
    assert.match(held.line, /Devis absent/);
    assert.doesNotMatch(held.line, /\d|sera débité/);
    const measured = runGate(
      { credits: 9000, readAt: 1 },
      { state: "measured", credits: 140, at: "2026-10-03T11:00:00.000Z", runs: 1 },
    );
    assert.equal(measured.allowed, true);
    assert.match(measured.line, /140/);
  });

  it("writes the absence on the engine notes and in the decision", () => {
    const project = readFileSync("src/lib/coffre/project.ts", "utf8");
    assert.match(project, /Prise · Références[\s\S]*devis de run est absent/);
    assert.match(project, /Prise · Personnage[\s\S]*devis de run est absent/);
    const decisions = readFileSync("docs/DECISIONS.md", "utf8");
    const f10 = decisions.slice(0, decisions.indexOf("## F9"));
    assert.match(f10, /F10 — devis Prise/);
    assert.match(f10, /video_minimax_h3_r2v/);
    assert.match(f10, /0 crédit brûlé/);
    assert.match(f10, /temps GPU/);
    assert.match(f10, /`dry_run`, `run_template`, `submit_workflow` et `partner_generate` n’ont pas été appelés/);
  });
});
