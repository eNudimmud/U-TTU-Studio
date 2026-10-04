import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { placeSceneQuote, placeTrainQuote } from "../src/lib/fal/prices.ts";
import { placeFileNames, placeSceneInput, placeShotLine, placeShotList, placeTrainInput, placeTrigger, PLACE_SCENE, PLACE_TRAINER } from "../src/lib/lora/place.ts";

describe("un LoRA de lieu", () => {
  it("learns stills on the Flux trainer, and never on the H3 graph", () => {
    assert.equal(PLACE_TRAINER, "fal-ai/flux-lora-fast-training");
    assert.equal(PLACE_SCENE, "fal-ai/flux-lora");
    assert.equal(placeTrigger("Le quai"), "le_quai_lieu");
    const input = placeTrainInput("https://fal.media/vues.zip", "le_quai_lieu", 1000);
    assert.equal(input.is_style, true);
    assert.equal(input.create_masks, false);
    assert.equal(input.trigger_word, "le_quai_lieu");
    const scene = placeSceneInput("https://fal.media/lieu.safetensors", "le_quai_lieu", "Le quai", 7);
    assert.deepEqual(scene.loras, [{ path: "https://fal.media/lieu.safetensors", scale: 0.9 }]);
    assert.match(String(scene.prompt), /le_quai_lieu/);
    assert.equal(placeFileNames(0, "image/png").image, "01.png");
    assert.equal(placeFileNames(1, "image/jpeg").caption, "02.txt");
    const graph = readFileSync("src/lib/render/take-graph.ts", "utf8");
    assert.doesNotMatch(graph, /flux-lora/);
    assert.doesNotMatch(readFileSync("src/lib/lora/place.ts", "utf8"), /take-graph|reference-to-video/);
  });

  it("needs four views and reloads only this place's shots", () => {
    assert.equal(placeShotLine(3).ready, false);
    assert.equal(placeShotLine(4).ready, true);
    assert.deepEqual(placeShotList({
      stills: ["scenes/a.jpg"],
      frames: ["scenes/a.jpg", "scenes/f1.png", "scenes/f2.png"],
      views: ["scenes/v.jpg", "scenes/v2.jpg"],
    }).length, 5);
  });

  it("quotes from the live unit, or not at all", () => {
    assert.equal(placeTrainQuote({ endpointId: "x", unitPrice: 2, unit: "1000 steps", currency: "USD" }, 1000), 2);
    assert.equal(placeTrainQuote({ endpointId: "x", unitPrice: 2, unit: "images", currency: "USD" }, 1000), null);
    assert.equal(placeSceneQuote({ endpointId: "x", unitPrice: 0.035, unit: "megapixels", currency: "USD" }, 768, 1024), 0.04);
    assert.equal(placeSceneQuote({ endpointId: "x", unitPrice: 0.035, unit: "image", currency: "USD" }, 768, 1024), 0.04);
    assert.equal(placeSceneQuote({ endpointId: "x", unitPrice: 0.035, unit: "steps", currency: "USD" }, 768, 1024), null);
  });
});
