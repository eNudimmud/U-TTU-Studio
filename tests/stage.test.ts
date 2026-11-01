import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { decorPresetOf, DECOR_PRESETS } from "../src/lib/decor-catalog.ts";
import { BILLED_MEASURE } from "../src/lib/render/billed-quote.ts";

const read = (path: string) => readFileSync(path, "utf8");

describe("CAST, DÉCOR, PRISE", () => {

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
