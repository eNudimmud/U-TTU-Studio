import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DATASET_SIZE } from "../src/lib/comfy-stack.ts";
import {
  bootstrapCaption, bootstrapPlan, falVaryInput, sniffImage, varyPrompt,
} from "../src/lib/fal-bootstrap.ts";
import { FAL_ENDPOINTS, FAL_VARY, estimateFalVary } from "../src/lib/fal-stack.ts";
import { repeatedTerms } from "../src/lib/gate/captions.ts";
import { evaluateGate, framingTarget } from "../src/lib/gate/rules.ts";
import { FACE_ANGLES, FRAMINGS } from "../src/lib/gate/vocabulary.ts";
import { allConfirmed, makeImage } from "./fixtures.ts";

const TRIGGER = "uttu_v1";
const INVARIANTS = "green eyes, freckles, scar on left cheek";

describe("bootstrap plan", () => {
  const plan = bootstrapPlan();

  it("proposes exactly 15 shots inside the gate framing target", () => {
    assert.equal(plan.length, DATASET_SIZE);
    assert.equal(FAL_ENDPOINTS.vary, "fal-ai/flux-pro/kontext/multi");
    for (const framing of FRAMINGS) {
      const count = plan.filter(slot => slot.framing === framing.id).length;
      const { min, max } = framingTarget(framing.id);
      assert.ok(count >= min && count <= max, `${framing.id} ${count} outside ${min}–${max}`);
    }
    for (const angle of FACE_ANGLES) assert.ok(plan.some(slot => slot.angle === angle), angle);
    const share = Math.max(...FACE_ANGLES.map(angle => plan.filter(slot => slot.angle === angle).length)) / plan.length;
    assert.ok(share <= 0.6, String(share));
    assert.equal(new Set(plan.map(slot => slot.seed)).size, plan.length);
  });

  it("builds gate captions that pass with a light human review", () => {
    const images = plan.map(slot => makeImage({ angle: slot.angle, framing: slot.framing, variables: slot.variables }));
    const result = evaluateGate({ trigger: TRIGGER, invariants: INVARIANTS, images, confirmations: allConfirmed() });
    assert.equal(result.verdict, "PASS", result.checks.filter(check => check.status === "fail" || check.status === "todo").map(check => `${check.id} ${check.detail}`).join(" | "));
    assert.equal(repeatedTerms(plan.map(slot => slot.variables)).length, 0);
    assert.deepEqual(result.captions, plan.map(slot => bootstrapCaption(TRIGGER, slot)));
    for (const caption of result.captions) assert.ok(caption.startsWith(`${TRIGGER}, `));
  });

  it("asks Kontext to change camera and scene only, without the trigger", () => {
    const urls = ["https://v3.fal.media/files/test/a.jpg", "https://v3.fal.media/files/test/b.jpg"];
    for (const slot of plan) {
      const prompt = varyPrompt(slot);
      assert.ok(!prompt.includes(TRIGGER));
      assert.ok(!prompt.toLowerCase().includes("green eyes"));
      assert.ok(prompt.length < 500);
      const input = falVaryInput(urls, slot);
      assert.equal(input.prompt, prompt);
      assert.deepEqual(input.image_urls, urls);
      assert.equal(input.num_images, 1);
      assert.equal(input.enhance_prompt, false);
      assert.equal(input.output_format, "jpeg");
      assert.equal(input.aspect_ratio, "1:1");
      assert.equal(input.seed, slot.seed);
    }
    assert.equal(estimateFalVary(DATASET_SIZE).usd, DATASET_SIZE * FAL_VARY.usdPerImage);
    assert.equal(estimateFalVary(15).usd, 0.6);
  });

  it("recognises the image kinds the worker accepts", () => {
    assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
    assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    assert.equal(sniffImage(webp), "image/webp");
    assert.equal(sniffImage(new Uint8Array([0x00, 0x01, 0x02, 0x03])), null);
  });
});
