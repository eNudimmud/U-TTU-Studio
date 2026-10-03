import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyTakeToTemplate, buildTakePrompt, safeAssetName } from "../src/lib/take-brief.ts";
import { chooseTakeSlots } from "../src/lib/take-files.ts";

const stock = {
  nodes: [
    { id: 137, type: "LoadImage", widgets_values: ["sample-a.png", "image"], widgets_values_named: { image: "sample-a.png", upload: "image" } },
    { id: 139, type: "LoadImage", widgets_values: ["sample-b.png", "image"], widgets_values_named: { image: "sample-b.png", upload: "image" } },
    { id: 138, type: "PrimitiveStringMultiline", widgets_values: ["stock prompt"], widgets_values_named: { value: "stock prompt" } },
    { id: 145, type: "LoraLoaderModelOnly", widgets_values: ["turbo.safetensors"], widgets_values_named: { lora_name: "turbo.safetensors" } },
    { id: 146, type: "PrimitiveBoolean", widgets_values: [false], widgets_values_named: { value: false } },
  ],
};

describe("brief de la prise", () => {
  it("names the person, the place, and the shot without inventing a city", () => {
    const prompt = buildTakePrompt({
      trigger: "mira_v1",
      invariants: "green eyes, freckles",
      placeName: "Quai",
      placeNote: "pluie fine",
      takeLine: "Elle traverse le quai.",
      picture2: "place",
    });
    assert.match(prompt, /<Picture 1>/);
    assert.match(prompt, /mira_v1/);
    assert.match(prompt, /green eyes, freckles/);
    assert.match(prompt, /<Picture 2> is the place, Quai/);
    assert.match(prompt, /pluie fine/);
    assert.match(prompt, /Elle traverse le quai/);
    assert.doesNotMatch(prompt, /night city/i);
    assert.ok(prompt.length <= 1600);
  });

  it("uses the second photo when the place has no still", () => {
    const prompt = buildTakePrompt({
      trigger: "mira_v1",
      invariants: "",
      placeName: "Quai",
      placeNote: "",
      takeLine: "",
      picture2: "second-look",
    });
    assert.match(prompt, /another photo of the same person/);
    assert.doesNotMatch(prompt, /<Picture 2> is the place/);
    const none = buildTakePrompt({
      trigger: "bad trigger",
      invariants: "",
      placeName: "",
      placeNote: "",
      takeLine: "",
      picture2: "none",
    });
    assert.doesNotMatch(none, /<Picture 2>|bad trigger/);
  });

  it("paints the prompt and only the image names that are safe", () => {
    const next = applyTakeToTemplate(stock, {
      prompt: "<Picture 1> keeps the same person.",
      images: { "137": "look.png", "139": "../secret.png" },
    }) as typeof stock;
    const byId = Object.fromEntries(next.nodes.map(node => [String(node.id), node]));
    assert.equal(byId["138"].widgets_values[0], "<Picture 1> keeps the same person.");
    assert.equal(byId["138"].widgets_values_named.value, "<Picture 1> keeps the same person.");
    assert.equal(byId["137"].widgets_values[0], "look.png");
    assert.equal(byId["137"].widgets_values[1], "image");
    assert.equal(byId["137"].widgets_values_named.image, "look.png");
    assert.equal(byId["139"].widgets_values[0], "sample-b.png");
    assert.equal(byId["145"].widgets_values_named.lora_name, "turbo.safetensors");
    assert.equal(byId["146"].widgets_values[0], false);
    assert.equal(stock.nodes[0].widgets_values[0], "sample-a.png");
    assert.equal(safeAssetName("look.png"), "look.png");
    assert.equal(safeAssetName("a/b.png"), "");
    assert.equal(safeAssetName("a\\b.png"), "");
    assert.equal(safeAssetName(`bad\u0000.png`), "");
    assert.equal(safeAssetName("x".repeat(181)), "");
    assert.equal(safeAssetName(12), "");
  });

  it("paints an API-format graph the same way", () => {
    const api = {
      "137": { class_type: "LoadImage", inputs: { image: "sample-a.png" } },
      "138": { class_type: "PrimitiveStringMultiline", inputs: { value: "stock" } },
      "139": { class_type: "LoadImage", inputs: { image: "sample-b.png" } },
      "145": { class_type: "LoraLoaderModelOnly", inputs: { lora_name: "turbo.safetensors" } },
    };
    const next = applyTakeToTemplate(api, { prompt: "held", images: { "139": "quai.png" } }) as typeof api;
    assert.equal(next["138"].inputs.value, "held");
    assert.equal(next["137"].inputs.image, "sample-a.png");
    assert.equal(next["139"].inputs.image, "quai.png");
    assert.equal(next["145"].inputs.lora_name, "turbo.safetensors");
  });

  it("keeps the place on the second picture and the person on the first", () => {
    const photo = { type: "image/png", name: "a.png", size: 12 };
    const other = { type: "image/jpeg", name: "b.jpg", size: 12 };
    const still = { type: "image/webp", name: "quai.webp", size: 20 };
    assert.deepEqual(chooseTakeSlots([photo, other], still), { identity: true, second: true, picture2: "place" });
    assert.deepEqual(chooseTakeSlots([photo, other], null), { identity: true, second: true, picture2: "second-look" });
    assert.deepEqual(chooseTakeSlots([photo], null), { identity: true, second: false, picture2: "none" });
    assert.deepEqual(chooseTakeSlots([], null), { identity: false, second: false, picture2: "none" });
    assert.deepEqual(chooseTakeSlots([{ type: "text/plain", name: "a.txt", size: 4 }], null), { identity: false, second: false, picture2: "none" });
  });
});
