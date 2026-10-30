import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { decorPresetOf, DECOR_PRESETS } from "../src/lib/decor-catalog.ts";
import { BILLED_MEASURE } from "../src/lib/render/billed-quote.ts";
import { castReady, decorReady, priseNext, priseReady, quotedCredits } from "../src/lib/stage.ts";

const read = (path: string) => readFileSync(path, "utf8");

describe("CAST, DÉCOR, PRISE", () => {
  it("treats two photos and the offered name as ready, and a cleared name as empty", () => {
    assert.equal(castReady({ name: "Personnage 1", photos: ["a", "b"] }), true);
    assert.equal(castReady({ name: "Personnage 1", photos: ["a"] }), false);
    assert.equal(castReady({ name: "Personnage 1", photos: ["a", "b", "c", "d"] }), false);
    assert.equal(castReady({ name: "  ", photos: ["a", "b"] }), false);
    assert.equal(decorReady(0), false);
    assert.equal(decorReady(1), true);
    assert.equal(priseReady({ cast: true, decor: true, line: "Le personnage est dans le lieu." }), true);
    assert.equal(priseReady({ cast: true, decor: true, line: "  " }), false);
    assert.equal(priseReady({ cast: false, decor: true, line: "Le personnage est dans le lieu." }), false);
  });

  it("offers generate only after the pieces, the account and a spendable quote", () => {
    const base = { cast: true, decor: true, line: "Elle avance.", connected: true, canSpend: true };
    assert.equal(priseNext({ ...base, cast: false }), "cast");
    assert.equal(priseNext({ ...base, decor: false }), "decor");
    assert.equal(priseNext({ ...base, line: "" }), "action");
    assert.equal(priseNext({ ...base, connected: false }), "connect");
    assert.equal(priseNext({ ...base, canSpend: false }), "hold");
    assert.equal(priseNext(base), "generate");
  });

  it("quotes the billed 4 credits and nothing when the setting is unmeasured", () => {
    assert.equal(quotedCredits({ source: "billed", measure: BILLED_MEASURE }), 4);
    assert.equal(quotedCredits({ source: "balance", credits: 4, at: "2026-10-07", runs: 1, high: 6 }), 4);
    assert.equal(quotedCredits({ source: "unmeasured" }), null);
  });


  it("keeps Quai, Rue and Pièce as pictures, without a new stored plan", () => {
    assert.deepEqual(DECOR_PRESETS.map(item => item.id), ["quai", "rue", "piece", "toit", "gare", "couloir"]);
    assert.equal(decorPresetOf({ id: "decor-quai", previz: "quai" }), "quai");
    assert.equal(decorPresetOf({ id: "le-quai", previz: "quai" }), "quai");
    assert.equal(decorPresetOf({ id: "decor-toit", previz: null }), "toit");
    assert.equal(decorPresetOf({ id: "lieu-1", previz: null }), null);
    assert.equal(DECOR_PRESETS.find(item => item.id === "toit")?.plan, null);
    assert.equal(DECOR_PRESETS.find(item => item.id === "piece")?.plan, "piece");
  });
});
