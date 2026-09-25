import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { falQueueHeaders } from "../src/lib/fal-api.ts";
import {
  FAL_ENDPOINTS, FAL_GEN, FAL_PRICING, FAL_PRIVACY, FAL_TRAINING, USD_CHF,
  billedMegapixels, checkFalGen, checkFalSteps, estimateFalGen, estimateFalRun, estimateFalTrain, falGenInput, falTrainInput,
  formatChf, formatFalCost, formatStrength, formatUsd, isFalFileUrl, normalizeProxyUrl,
} from "../src/lib/fal-stack.ts";
import { FAKE } from "./fal-fixtures.ts";

const request = { lora: FAKE.lora, prompt: "mira_v1, plain grey background, soft even light", scale: 0.75, seed: 424242 };

describe("fal stack", () => {
  it("trains a subject LoRA on the documented endpoint, captions from the gate kept", () => {
    assert.equal(FAL_ENDPOINTS.train, "fal-ai/flux-lora-fast-training");
    assert.deepEqual(falTrainInput(FAKE.zipUrl, "mira_v1"), {
      images_data_url: FAKE.zipUrl, trigger_word: "mira_v1", steps: 1000, create_masks: true, is_style: false,
    });
    assert.equal(FAL_TRAINING.steps, 1000);
    assert.ok(FAL_TRAINING.slider.min <= FAL_TRAINING.steps && FAL_TRAINING.steps <= FAL_TRAINING.slider.max);
  });

  it("renders the 0.60 / 0.75 / 0.90 grid with fal-ai/flux-lora and settings fixed server side", () => {
    assert.equal(FAL_ENDPOINTS.gen, "fal-ai/flux-lora");
    assert.deepEqual([...FAL_GEN.strengths], [0.6, 0.75, 0.9]);
    assert.deepEqual(FAL_GEN.strengths.map(formatStrength), ["0,60", "0,75", "0,90"]);
    assert.ok(FAL_GEN.strengths.some(scale => scale === FAL_GEN.smokeStrength));
    for (const scale of FAL_GEN.strengths) assert.equal(checkFalGen({ ...request, scale }), null);
    assert.deepEqual(falGenInput(request), {
      prompt: request.prompt,
      loras: [{ path: FAKE.lora, scale: 0.75 }],
      image_size: { width: 1024, height: 1024 },
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      seed: 424242,
      enable_safety_checker: true,
      output_format: "jpeg",
    });
  });

  it("prices training per step and images per billed megapixel, as read on fal", () => {
    assert.equal(FAL_PRICING.trainUsdPer1000Steps, 2);
    assert.equal(estimateFalTrain(1000).usd, 2);
    assert.equal(estimateFalTrain(500).usd, 1);
    assert.equal(estimateFalTrain(20).usd, 0.04);
    assert.equal(billedMegapixels(1024, 1024), 1);
    assert.equal(billedMegapixels(1280, 1024), 2);
    assert.ok(Math.abs(estimateFalGen(1).usd - 0.035) < 1e-12);
    assert.equal(formatUsd(estimateFalGen(1).usd, 3), "0,035 $");
    assert.equal(formatUsd(estimateFalGen(3).usd), "0,11 $");
    assert.equal(formatUsd(estimateFalRun(1000, 3).usd), "2,11 $", "2,00 $ + 0,11 $ must not display as 2,10 $");
    assert.equal(formatUsd(estimateFalRun(1000, 1).usd), "2,04 $", "the smoke budget announced in the docs");
  });

  it("converts to CHF at a fixed rate that is labelled unverified", () => {
    assert.equal(USD_CHF.verified, false);
    assert.equal(estimateFalTrain(1000).chf, 2 * USD_CHF.rate);
    assert.equal(formatChf(estimateFalTrain(1000).chf), `CHF ${(2 * USD_CHF.rate).toFixed(2).replace(".", ",")}`);
    assert.match(formatFalCost(estimateFalRun(1000, 3)), /^2,11 \$ \(≈ CHF \d+,\d{2}\)$/);
  });

  it("bounds what the proxy forwards: steps, LoRA host, prompt, strength and seed", () => {
    assert.equal(checkFalSteps(1000), null);
    assert.equal(checkFalSteps(FAL_TRAINING.bounds.min), null);
    for (const steps of [0, 19, 2001, 1000.5, Number.NaN]) assert.ok(checkFalSteps(steps), String(steps));
    assert.match(checkFalGen({ ...request, lora: "https://evil.example/lora.safetensors" }) ?? "", /LoRA/);
    assert.match(checkFalGen({ ...request, prompt: " " }) ?? "", /Prompt/);
    assert.match(checkFalGen({ ...request, prompt: "x".repeat(FAL_GEN.maxPromptLength + 1) }) ?? "", /Prompt/);
    assert.match(checkFalGen({ ...request, scale: 2 }) ?? "", /Force/);
    assert.match(checkFalGen({ ...request, seed: -1 }) ?? "", /Seed/);
    assert.match(checkFalGen({}) ?? "", /LoRA/);
  });

  it("recognises files hosted by fal only", () => {
    assert.ok(isFalFileUrl(FAKE.lora));
    assert.ok(isFalFileUrl("https://v3b.fal.media/files/b/x.safetensors"));
    assert.ok(isFalFileUrl("https://storage.googleapis.com/fal-flux-lora/abc_pytorch_lora_weights.safetensors"));
    assert.ok(!isFalFileUrl("http://v3.fal.media/files/x.safetensors"));
    assert.ok(!isFalFileUrl("https://fal.media.evil.example/x.safetensors"));
    assert.ok(!isFalFileUrl("https://storage.googleapis.com/someone-else/x.safetensors"));
    assert.ok(!isFalFileUrl("not a url"));
  });

  it("accepts an https proxy URL, or plain http on localhost for development", () => {
    assert.equal(normalizeProxyUrl(undefined), "");
    assert.equal(normalizeProxyUrl("  "), "");
    assert.equal(normalizeProxyUrl("https://uttu-fal-proxy.example.workers.dev/"), "https://uttu-fal-proxy.example.workers.dev");
    assert.equal(normalizeProxyUrl("http://localhost:8787"), "http://localhost:8787");
    assert.equal(normalizeProxyUrl("http://proxy.example.com"), "");
    assert.equal(normalizeProxyUrl("javascript:alert(1)"), "");
  });

  it("asks fal to expire the LoRA and images and not to keep request payloads", () => {
    const headers = falQueueHeaders();
    assert.equal(headers["X-Fal-Store-IO"], "0");
    assert.deepEqual(JSON.parse(headers["X-Fal-Object-Lifecycle-Preference"]), { expiration_duration_seconds: FAL_PRIVACY.outputsExpiresSeconds });
    assert.equal(FAL_PRIVACY.zipExpiresSeconds, 24 * 3600);
    assert.equal(FAL_PRIVACY.outputsExpiresSeconds, 7 * 24 * 3600);
  });
});
