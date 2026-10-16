import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CATALOG_WATCH, catalogAllowsComfyFile, catalogAllowsPlaceStill } from "../src/lib/comfy/catalog-watch.ts";

const empty = { rendu: null, former: null, lieu: null, image: null };
const sample = { seconds: 5, resolution: "768P" as const, steps: 1000 };

describe("dernier contrôle catalogue", () => {
  it("keeps both parked gestures closed after the F19 read", () => {
    assert.equal(CATALOG_WATCH.readAt, "2026-10-07T19:01:20.907Z");
    assert.equal(CATALOG_WATCH.nodeCount, 3772);
    assert.equal(CATALOG_WATCH.saveLoraPresent, false);
    assert.equal(CATALOG_WATCH.trainLoraWritesFile, false);
    assert.equal(CATALOG_WATCH.comfyFileQuote, null);
    assert.equal(CATALOG_WATCH.placeStillTemplate, null);
    assert.equal(CATALOG_WATCH.placeStillQuote, null);
    assert.deepEqual([...CATALOG_WATCH.saveLoraNames], ["SaveLoRA", "SaveLora", "SaveLoRANode", "LoraSave", "SaveLoraNode"]);
    assert.deepEqual([...CATALOG_WATCH.trainLoraOutputs], ["LORA_MODEL", "LOSS_MAP", "INT"]);
    assert.deepEqual([...CATALOG_WATCH.refusedLoraNodes], ["LoraExtractKJ", "LoraReduceRankKJ"]);
    assert.equal(catalogAllowsComfyFile(), false);
    assert.equal(catalogAllowsPlaceStill(), false);
    assert.equal(readFileSync("src/lib/comfy/catalog-watch.ts", "utf8").includes("estimate_credits"), false);
    assert.equal(readFileSync("src/lib/comfy/catalog-watch.ts", "utf8").includes("run_template"), false);
  });

});
