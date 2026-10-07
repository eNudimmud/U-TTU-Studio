import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CATALOG_WATCH, catalogAllowsComfyFile, catalogAllowsPlaceStill } from "../src/lib/comfy/catalog-watch.ts";
import { workflowFiches } from "../src/lib/workflow-fiches.ts";

const empty = { rendu: null, former: null, lieu: null, image: null };
const sample = { seconds: 5, resolution: "768P" as const, steps: 1000 };

describe("dernier contrôle catalogue", () => {
  it("keeps both parked gestures closed after the 7 October read", () => {
    assert.equal(CATALOG_WATCH.readAt, "2026-10-07T15:24:41.277Z");
    assert.equal(CATALOG_WATCH.nodeCount, 3772);
    assert.equal(CATALOG_WATCH.saveLoraPresent, false);
    assert.equal(CATALOG_WATCH.trainLoraWritesFile, false);
    assert.equal(CATALOG_WATCH.comfyFileQuote, null);
    assert.equal(CATALOG_WATCH.placeStillTemplate, null);
    assert.equal(CATALOG_WATCH.placeStillQuote, null);
    assert.deepEqual([...CATALOG_WATCH.saveLoraNames], ["SaveLoRA", "SaveLora", "SaveLoRANode", "LoraSave", "SaveLoraNode"]);
    assert.deepEqual([...CATALOG_WATCH.trainLoraOutputs], ["LORA_MODEL", "LOSS_MAP", "INT"]);
    assert.equal(catalogAllowsComfyFile(), false);
    assert.equal(catalogAllowsPlaceStill(), false);
    assert.equal(workflowFiches(empty, sample).find(fiche => fiche.id === "image"), undefined);
    assert.equal(readFileSync("src/lib/comfy/catalog-watch.ts", "utf8").includes("estimate_credits"), false);
    assert.equal(readFileSync("src/lib/comfy/catalog-watch.ts", "utf8").includes("run_template"), false);
  });

  it("records the watch as fact, and does not put the node name on a screen", () => {
    const decisions = readFileSync("docs/DECISIONS.md", "utf8");
    const f9 = decisions.slice(0, decisions.indexOf("## F8"));
    assert.match(f9, /F9 — watch SaveLoRA/);
    assert.match(f9, /3772/);
    assert.match(f9, /SaveLoRA/);
    assert.match(f9, /TrainLoraNode/);
    assert.match(f9, /templates_text_prompt_to_360hdr\.app/);
    assert.match(f9, /0 crédit/);
    assert.match(f9, /`run_template`, `submit_workflow` et `partner_generate` n’ont pas été appelés/);
    const screens = readFileSync("src/components/app/screens.tsx", "utf8");
    const sheets = readFileSync("src/components/app/sheets.tsx", "utf8");
    assert.doesNotMatch(screens + sheets, /class_type|SaveLoRA|panneau de nœuds|catalog-watch/);
  });
});
