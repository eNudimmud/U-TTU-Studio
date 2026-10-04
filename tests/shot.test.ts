import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filmAction, shotGate, shotPrompt, shotRequest } from "../src/lib/render/shot.ts";
import { LORA_TAKE } from "../src/lib/fal/prices.ts";

describe("le plan filmé", () => {
  it("asks for the character only after the place and the accounts are there", () => {
    assert.equal(filmAction({ plan: false, blender: true, character: true, fal: true }).label, "Choisis un plan");
    assert.equal(filmAction({ plan: true, blender: false, character: true, fal: true }).kind, "blender");
    assert.equal(filmAction({ plan: true, blender: true, character: false, fal: true }).kind, "role");
    assert.equal(filmAction({ plan: true, blender: true, character: true, fal: false }).kind, "fal");
    assert.equal(filmAction({ plan: true, blender: true, character: true, fal: true }).label, "Filmer ce plan");
  });

  it("tells the model the images are the empty place and the person is the LoRA", () => {
    const prompt = shotPrompt({ subject: "mira_uttu", place: "Le quai", note: "pluie", frames: 5, line: "elle avance" });
    assert.match(prompt, /mira_uttu is the person/);
    assert.match(prompt, /not drawn in the place images/);
    assert.match(prompt, /Image 1 to Image 5/);
    assert.match(prompt, /camera moves/);
    const body = shotRequest({ prompt, imageUrls: ["https://fal.media/a.png", "https://fal.media/b.png"], loraUrl: "https://fal.media/w.safetensors", seed: 3 });
    assert.equal(body.duration, 5);
    assert.deepEqual(body.loras, [{ path: "https://fal.media/w.safetensors", scale: 1 }]);
    assert.deepEqual(body.reference_image_urls, ["https://fal.media/a.png", "https://fal.media/b.png"]);
    assert.equal(LORA_TAKE, "minimax/h3/reference-to-video/lora");
  });

  it("quotes both payers, and only the character once the path is already rendered", () => {
    const both = shotGate({ blender: { quoteId: "q", uploadId: "u", priceCents: 250, frameCount: 5 }, characterUsd: 0.38, trajetReady: false });
    assert.equal(both.allowed, true);
    assert.match(both.line, /2,50/);
    assert.match(both.line, /0,38/);
    assert.match(both.line, /5 images/);
    const again = shotGate({ blender: null, characterUsd: 0.38, trajetReady: true });
    assert.equal(again.allowed, true);
    assert.match(again.line, /déjà rendu/);
    assert.match(again.line, /0,38/);
    const blocked = shotGate({ blender: null, characterUsd: null, trajetReady: false });
    assert.equal(blocked.allowed, false);
    assert.doesNotMatch(blocked.line, /\d/);
  });
});
