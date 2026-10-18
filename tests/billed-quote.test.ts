import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { COMFY_CLOUD } from "../src/lib/comfy-stack.ts";
import { phrase } from "../src/lib/i18n/phrase.ts";
import {
  BILLED_MEASURE, BILLED_MEASURE_FILE, UNMEASURED_LINE, billedMeasure, billedSentence, priseGate, quoteSentence, resolveTakeQuote,
} from "../src/lib/render/billed-quote.ts";
import { DEFAULT_TAKE, takeProfile, type TakeSettings } from "../src/lib/render/take-graph.ts";

const PROFILE = "h3-4pas-5s-vertical";
const read = (path: string) => readFileSync(path, "utf8");

describe("devis facturé", () => {
  it("locks the versioned record to the one measured profile", () => {
    const files = readdirSync("docs/mesures").filter(name => name.endsWith(".json"));
    assert.deepEqual(files, ["h3-4pas-5s-vertical.json"]);
    const record = JSON.parse(read(BILLED_MEASURE_FILE));
    assert.deepEqual(record, BILLED_MEASURE);
    assert.equal(BILLED_MEASURE.profile, PROFILE);
    assert.equal(BILLED_MEASURE.version, 1);
    assert.equal(BILLED_MEASURE.kind, "gpu-facture");
    assert.equal(BILLED_MEASURE.jobId, "51662b20-4ac7-44bc-b203-a4127ff462a0");
    assert.equal(BILLED_MEASURE.at, "2026-10-07T21:16:45.000Z");
    assert.equal(BILLED_MEASURE.displayDay, "7 octobre");
    assert.equal(BILLED_MEASURE.gpuSeconds, 15.680729);
    assert.equal(BILLED_MEASURE.usdPerGpuSecond, 0.001295);
    assert.equal(BILLED_MEASURE.creditsPerUsd, COMFY_CLOUD.creditsPerUsd);
    assert.equal(BILLED_MEASURE.gpuCreditsPerSecondBound, COMFY_CLOUD.gpuCreditsPerSecond);
    const billed = BILLED_MEASURE.gpuSeconds * BILLED_MEASURE.usdPerGpuSecond * BILLED_MEASURE.creditsPerUsd;
    const bound = BILLED_MEASURE.gpuSeconds * BILLED_MEASURE.gpuCreditsPerSecondBound;
    assert.ok(billed > 4.2 && billed < 4.4, String(billed));
    assert.equal(Math.round(billed), 4);
    assert.ok(bound > 6 && bound < 6.2, String(bound));
    assert.equal(BILLED_MEASURE.credits, 4);
    assert.equal(BILLED_MEASURE.creditsHigh, 6);
    assert.equal(BILLED_MEASURE.runs, 1);
    assert.equal(BILLED_MEASURE.modelsWarm, true);
    assert.equal(billedMeasure(PROFILE), BILLED_MEASURE);
    assert.equal(billedMeasure("h3-4pas-8s-vertical"), null);
    assert.equal(billedMeasure("h3-20pas-5s-vertical"), null);
    assert.equal(billedMeasure("h3-4pas-5s-horizontal"), null);
    assert.equal(takeProfile({ ...DEFAULT_TAKE, engine: "h3" }), PROFILE);
    assert.equal(takeProfile(DEFAULT_TAKE), "ltx25-5s-vertical");
    assert.equal(billedMeasure(takeProfile(DEFAULT_TAKE)), null);
    assert.doesNotMatch(read("src/lib/render/billed-quote.ts"), /submit_workflow|run_template|partner_generate|estimate_credits|class_type|UNETLoader/);
  });

  it("opens Tourner only for the measured profile, and lets a balance delta win", () => {
    const open = priseGate({ credits: 100, readAt: 1 }, resolveTakeQuote(PROFILE, []));
    assert.equal(open.allowed, true);
    assert.equal(open.tone, "ok");
    assert.match(open.line, /Environ 4 crédits, estimé d’après une prise du 7 octobre/);
    assert.match(open.line, /Le prix final peut varier/);
    assert.doesNotMatch(open.line, /réserve|GPU|51662|class_type|UNET|nœud/);

    const ceiling = priseGate({ credits: 6, readAt: 1 }, resolveTakeQuote(PROFILE, []));
    assert.equal(ceiling.allowed, true);
    const short = priseGate({ credits: 5, readAt: 1 }, resolveTakeQuote(PROFILE, []));
    assert.equal(short.allowed, false);
    assert.match(short.line, /Solde trop bas/);
    assert.match(short.line, /Environ 4 crédits/);
    assert.doesNotMatch(short.line, /réserve/);
    assert.equal(priseGate({ credits: 0, readAt: 1 }, resolveTakeQuote(PROFILE, [])).allowed, false);
    assert.equal(priseGate(null, resolveTakeQuote(PROFILE, [])).allowed, false);
    assert.match(priseGate(null, resolveTakeQuote(PROFILE, [])).line, /Environ 4 crédits/);

    const other = (settings: TakeSettings) => priseGate({ credits: 9000, readAt: 1 }, resolveTakeQuote(takeProfile(settings), []));
    for (const gate of [
      other({ seconds: 8, quality: "rapide", aspect: "vertical" }),
      other({ seconds: 5, quality: "fine", aspect: "vertical" }),
      other({ seconds: 5, quality: "rapide", aspect: "horizontal" }),
      other({ seconds: 5, quality: "rapide", aspect: "carre" }),
    ]) {
      assert.equal(gate.allowed, false);
      assert.equal(gate.line, UNMEASURED_LINE);
      assert.match(gate.line, /Pas encore mesuré/);
      assert.doesNotMatch(gate.line, /\d/);
    }

    const delta = resolveTakeQuote(PROFILE, [{ profile: PROFILE, credits: 140, gpuSeconds: null, at: "2026-10-07T12:00:00.000Z" }]);
    assert.equal(delta.source, "balance");
    if (delta.source === "balance") assert.equal(delta.credits, 140);
    const won = priseGate({ credits: 9000, readAt: 1 }, delta);
    assert.equal(won.allowed, true);
    assert.match(won.line, /140/);
    assert.doesNotMatch(won.line, /réserve conseillée 6/);
    const quote = quoteSentence(delta);
    assert.match(quote, /140/);
    assert.equal(quoteSentence(resolveTakeQuote("h3-20pas-5s-horizontal", [])), UNMEASURED_LINE);
  });

});
