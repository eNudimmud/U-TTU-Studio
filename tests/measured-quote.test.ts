import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { costClaim, runGate } from "../src/lib/credits.ts";
import { createProject, loadStudio, writeBlob, writeQuotes, writeTake, type Take } from "../src/lib/coffre/model.ts";
import { memoryVault } from "../src/lib/coffre/store.ts";
import {
  forgetQuote, parseQuoteFile, profileParts, quoteFromReadings, quoteFromTake, quotesJson, quotesToRecords, rememberQuote, seedQuotes, QUOTE_FILE,
} from "../src/lib/render/measured-quote.ts";

const PROFILE = "h3-4pas-5s-vertical";

const filmed = (patch: Partial<Take> = {}): Take => ({
  id: "prise-a",
  at: "2026-10-07T12:00:00.000Z",
  sceneId: "le-quai",
  sceneName: "Le quai",
  line: "Elle entre",
  settings: { seconds: 5, quality: "rapide", aspect: "vertical" },
  profile: PROFILE,
  jobId: "0f6c1b1e-8d47-4f39-9e16-5f5d0f0b9a11",
  video: "Projets/uttu/Prises/prise-a.mp4",
  poster: null,
  prompt: "",
  gpuSeconds: null,
  costCredits: null,
  balanceBefore: null,
  balanceAfter: null,
  engine: "comfy",
  loraId: null,
  resolution: null,
  costUsd: null,
  costSource: null,
  announcedCredits: null,
  announcedHigh: null,
  ...patch,
});

describe("devis mesuré", () => {
  it("keeps only a real drop between two readings", () => {
    assert.equal(quoteFromReadings(PROFILE, null, 8000, "2026-10-07T12:00:00.000Z"), null);
    assert.equal(quoteFromReadings(PROFILE, 9000, null, "2026-10-07T12:00:00.000Z"), null);
    assert.equal(quoteFromReadings(PROFILE, 9000, 9100, "2026-10-07T12:00:00.000Z"), null);
    assert.equal(quoteFromReadings(PROFILE, 9000, 9000, "2026-10-07T12:00:00.000Z"), null);
    assert.equal(quoteFromReadings("custom", 9000, 8800, "2026-10-07T12:00:00.000Z"), null);
    assert.equal(quoteFromReadings(PROFILE, 9000, 8800, ""), null);
    const quote = quoteFromReadings(PROFILE, 9000, 8860, "2026-10-07T12:00:00.000Z");
    assert.deepEqual(quote, { profile: PROFILE, before: 9000, after: 8860, credits: 140, at: "2026-10-07T12:00:00.000Z" });
    assert.equal(quoteFromTake({ ...filmed(), engine: "lora", balanceBefore: 9000, balanceAfter: 8860 }), null);
    assert.equal(quoteFromTake(filmed({ costCredits: 140 })), null);
    assert.deepEqual(profileParts(PROFILE), { steps: 4, seconds: 5, aspect: "9:16" });
  });

  it("remembers three readings, trusts the delta, and forgets one setting", () => {
    const reading = (at: string, before: number, credits: number) => quoteFromReadings(PROFILE, before, before - credits, at)!;
    let quotes = rememberQuote([], reading("2026-10-01T00:00:00.000Z", 1000, 10));
    quotes = rememberQuote(quotes, reading("2026-10-02T00:00:00.000Z", 1000, 20));
    quotes = rememberQuote(quotes, reading("2026-10-03T00:00:00.000Z", 1000, 30));
    quotes = rememberQuote(quotes, reading("2026-10-04T00:00:00.000Z", 1000, 40));
    assert.deepEqual(quotes.map(quote => quote.credits), [20, 30, 40]);
    const other = quoteFromReadings("h3-8pas-8s-horizontal", 500, 400, "2026-10-05T00:00:00.000Z")!;
    quotes = rememberQuote(quotes, other);
    assert.equal(forgetQuote(quotes, PROFILE).length, 1);
    assert.equal(forgetQuote(quotes, PROFILE)[0]?.profile, "h3-8pas-8s-horizontal");

    const seeded = seedQuotes([
      filmed({ id: "bare", at: "2026-10-01T00:00:00.000Z", costCredits: 99 }),
      filmed({ id: "pair", at: "2026-10-02T00:00:00.000Z", costCredits: 1, balanceBefore: 9000, balanceAfter: 8860 }),
    ]);
    assert.equal(seeded.length, 1);
    assert.equal(seeded[0]?.credits, 140);
    const claim = costClaim(PROFILE, quotesToRecords(seeded));
    assert.equal(claim.state, "measured");
    if (claim.state === "measured") {
      const open = runGate({ credits: 9000, readAt: 1 }, claim);
      assert.equal(open.allowed, true);
      assert.match(open.line, /140/);
    }
    const held = runGate({ credits: 9000, readAt: 1 }, costClaim(PROFILE, []));
    assert.equal(held.allowed, false);
    assert.match(held.line, /Devis absent/);
  });

  it("seeds the project once, and a cleared file stays empty", async () => {
    const store = memoryVault();
    await createProject(store, "Uttu");
    const take = filmed({ balanceBefore: 9000, balanceAfter: 8860, costCredits: 12 });
    await writeBlob(store, take.video, new Blob(["mp4"], { type: "video/mp4" }));
    await writeTake(store, take, [take]);
    const seeded = await loadStudio(store);
    assert.equal(seeded.quotes.length, 1);
    assert.equal(seeded.quotes[0]?.credits, 140);
    assert.equal(seeded.takes[0]?.costCredits, 12);
    const file = (await store.get(`Projets/uttu/${QUOTE_FILE}`))?.text ?? "";
    assert.match(file, /"seeded":true/);
    assert.equal(parseQuoteFile(undefined), null);
    assert.equal(parseQuoteFile("{"), null);
    assert.deepEqual(parseQuoteFile(quotesJson([])), []);

    await writeQuotes(store, []);
    const cleared = await loadStudio(store);
    assert.deepEqual(cleared.quotes, []);
    assert.equal(cleared.takes.length, 1);
    const kept = (await store.get(`Projets/uttu/${QUOTE_FILE}`))?.text ?? "";
    assert.match(kept, /"quotes":\[\]/);
  });

  it("shows where to clear a measured quote, and records the decision", () => {
    const screens = readFileSync("src/components/app/screens.tsx", "utf8");
    const sheets = readFileSync("src/components/app/sheets.tsx", "utf8");
    assert.match(screens, /sheet\.clearQuote/);
    assert.match(sheets, /sheet\.measuredLead/);
    assert.match(sheets, /sheet\.clearQuote/);
    assert.match(screens, /why\.hold/);
    assert.doesNotMatch(screens + sheets, /SaveLoRA|class_type|panneau de nœuds/);
    const decisions = readFileSync("docs/DECISIONS.md", "utf8");
    const f11 = decisions.slice(0, decisions.indexOf("## F10"));
    assert.match(f11, /F11 — devis mesuré/);
    assert.match(f11, /temps GPU/);
    assert.match(f11, /devis\.json/);
    assert.match(f11, /0 crédit brûlé/);
    assert.match(f11, /estimate_credits/);
    assert.doesNotMatch(readFileSync("src/lib/render/measured-quote.ts", "utf8"), /run_template|submit_workflow|partner_generate|estimate_credits/);
  });
});
