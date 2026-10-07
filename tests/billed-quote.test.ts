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
    assert.equal(takeProfile(DEFAULT_TAKE), PROFILE);
    assert.doesNotMatch(read("src/lib/render/billed-quote.ts"), /submit_workflow|run_template|partner_generate|estimate_credits|class_type|UNETLoader/);
  });

  it("opens Tourner only for the measured profile, and lets a balance delta win", () => {
    const open = priseGate({ credits: 100, readAt: 1 }, resolveTakeQuote(PROFILE, []));
    assert.equal(open.allowed, true);
    assert.equal(open.tone, "ok");
    assert.match(open.line, /Environ 4 crédits, au plus 6/);
    assert.match(open.line, /prise réelle le 7 octobre/);
    assert.match(open.line, /temps GPU facturé, une seule mesure, modèles déjà chargés/);
    assert.match(open.line, /une première prise à froid peut coûter un peu plus/);
    assert.doesNotMatch(open.line, /51662|class_type|UNET|nœud/);

    const ceiling = priseGate({ credits: 6, readAt: 1 }, resolveTakeQuote(PROFILE, []));
    assert.equal(ceiling.allowed, true);
    const short = priseGate({ credits: 5, readAt: 1 }, resolveTakeQuote(PROFILE, []));
    assert.equal(short.allowed, false);
    assert.match(short.line, /Solde trop bas/);
    assert.match(short.line, /au plus 6/);
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
    assert.doesNotMatch(won.line, /au plus 6/);
    const quote = quoteSentence(delta);
    assert.match(quote, /140/);
    assert.equal(quoteSentence(resolveTakeQuote("h3-20pas-5s-horizontal", [])), UNMEASURED_LINE);
  });

  it("translates the novice lines and keeps the gesture behind the quote and the outgoing text", () => {
    const catalogs = {
      fr: JSON.parse(read("messages/fr.json")),
      en: JSON.parse(read("messages/en.json")),
      de: JSON.parse(read("messages/de.json")),
      es: JSON.parse(read("messages/es.json")),
    };
    assert.equal(catalogs.fr.runtime.notMeasured, UNMEASURED_LINE);
    assert.equal(catalogs.en._human, "native_open");
    assert.equal(catalogs.de._human, "native_open");
    assert.equal(catalogs.es._human, "native_open");
    const sentence = billedSentence(BILLED_MEASURE);
    assert.equal(
      catalogs.fr.runtime.billedQuote.replaceAll("{amount}", "4").replaceAll("{high}", "6").replaceAll("{date}", "7 octobre"),
      sentence,
    );
    assert.match(catalogs.en.runtime.billedQuote, /at most \{high\}/);
    assert.match(catalogs.de.runtime.billedQuote, /höchstens \{high\}/);
    assert.match(catalogs.es.runtime.billedQuote, /como máximo \{high\}/);
    assert.match(catalogs.en.runtime.notMeasured, /Not measured yet/);
    assert.match(catalogs.de.runtime.notMeasured, /Noch nicht gemessen/);
    assert.match(catalogs.es.runtime.notMeasured, /Aún no medido/);
    const t = (key: string) => key;
    assert.equal(phrase(t, sentence), "runtime.billedQuote");
    assert.equal(phrase(t, UNMEASURED_LINE), "runtime.notMeasured");
    assert.equal(phrase(t, "environ 4 crédits"), "runtime.billedMark");
    assert.doesNotMatch(sentence + UNMEASURED_LINE + catalogs.en.runtime.billedQuote + catalogs.de.runtime.notMeasured, /class_type|UNETLoader|SaveLoRA|nœud/);

    const sheets = read("src/components/app/sheets.tsx");
    const screens = read("src/components/app/screens.tsx");
    const confirm = read("src/components/app/studio-context.tsx");
    assert.match(sheets, /OutgoingTake/);
    assert.match(sheets, /canConfirm = gate\.allowed && gate\.line\.trim\(\)\.length > 0 && outgoing\.trim\(\)\.length > 0/);
    assert.match(screens, /quoteSentence\(takeQuote\)/);
    assert.match(screens, /OutgoingTake/);
    assert.match(confirm, /if \(!prompt\.trim\(\)\)/);
    assert.doesNotMatch(screens + sheets, /51662b20|class_type|UNETLoader/);

    const decisions = read("docs/DECISIONS.md");
    const f26 = decisions.slice(0, decisions.indexOf("## F25"));
    assert.match(f26, /F26 — Tourner au réglage mesuré/);
    assert.match(f26, /51662b20-4ac7-44bc-b203-a4127ff462a0/);
    assert.match(f26, /15,680729/);
    assert.match(f26, /gpu-facture|devis facturé/);
    assert.match(f26, /0 crédit brûlé/);
    assert.match(f26, /native_open/);
    assert.match(f26, /delta/);
  });
});
