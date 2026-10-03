import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COMFY_CLOUD } from "../src/lib/comfy-stack.ts";
import {
  TAKE_TIMING, USAGE_MAX, addUsage, centsToCredits, estimateTake, formatCreditRange, monthUsage, parseUsage, priceList,
  readCreditsMessage, readRunMessage, readUsage, saveUsage, serializeUsage, type UsageLine,
} from "../src/lib/credits.ts";

function memory() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
}

const line = (patch: Partial<UsageLine> = {}): UsageLine => ({
  id: "l1", date: "2026-10-03", engine: "comfy", label: "La prise · 20 pas", low: 94, high: 281, ...patch,
});

describe("crédits avant le rendu", () => {
  it("prices a take from GPU seconds, labelled as not measured", () => {
    assert.equal(TAKE_TIMING.measured, false);
    const full = estimateTake(false);
    const turbo = estimateTake(true);
    assert.equal(full.credits.low, TAKE_TIMING.full.seconds.low * COMFY_CLOUD.gpuCreditsPerSecond);
    assert.equal(full.credits.high, TAKE_TIMING.full.seconds.high * COMFY_CLOUD.gpuCreditsPerSecond);
    assert.ok(turbo.credits.high < full.credits.high);
    assert.match(formatCreditRange({ low: 1234.4, high: 2000 }), /^1.234 à 2.000 crédits$/);
    assert.equal(centsToCredits(100), COMFY_CLOUD.creditsPerUsd);
    assert.equal(centsToCredits(1000), 2110);
    const prices = priceList();
    assert.deepEqual(prices.map(price => price.id), ["take", "take-turbo", "former", "image", "lot", "train"]);
    assert.equal(prices.find(price => price.id === "take")?.payer, "toi");
    assert.equal(prices.find(price => price.id === "lot")?.payer, "studio");
    assert.match(prices.find(price => price.id === "lot")?.value ?? "", /\$/);
  });

  it("keeps a device journal that refuses junk and sums the month", () => {
    assert.deepEqual(parseUsage("non"), []);
    assert.deepEqual(parseUsage(JSON.stringify({ lines: [{ id: "x", date: "hier", engine: "comfy", label: "a", low: 1, high: 2 }] })), []);
    assert.deepEqual(parseUsage(JSON.stringify({ lines: [line({ engine: "stripe" as never })] })), []);
    assert.deepEqual(parseUsage(JSON.stringify({ lines: [line({ low: 5, high: 2 })] })), []);
    let lines = addUsage([], line());
    lines = addUsage(lines, line({ id: "l2", engine: "fal", label: "15 images préparées", low: 0.6, high: 0.6 }));
    lines = addUsage(lines, line({ id: "l3", date: "2026-09-30" }));
    assert.equal(addUsage(lines, line({ id: "" })).length, 3);
    const month = monthUsage(lines, new Date(2026, 9, 3));
    assert.deepEqual(month.comfy, { count: 1, low: 94, high: 281 });
    assert.deepEqual(month.fal, { count: 1, low: 0.6, high: 0.6 });
    const storage = memory();
    assert.equal(saveUsage(storage, lines), true);
    assert.deepEqual(readUsage(storage), lines);
    const many = Array.from({ length: USAGE_MAX + 5 }, (_, index) => line({ id: `l${index}` }));
    assert.equal(parseUsage(serializeUsage(many)).length, USAGE_MAX);
    assert.equal(JSON.stringify(lines).includes("@"), false);
  });

  it("reads only well-formed messages from the frame", () => {
    assert.deepEqual(readCreditsMessage({ type: "uttu-credits", credits: 1234.4, readAt: 1 }), { credits: 1234, readAt: 1 });
    assert.equal(readCreditsMessage({ type: "uttu-credits", credits: "12", readAt: 1 }), null);
    assert.equal(readCreditsMessage({ type: "other", credits: 12, readAt: 1 }), null);
    assert.equal(readCreditsMessage({ type: "uttu-credits", credits: 12 }), null);
    assert.deepEqual(readRunMessage({ type: "uttu-run", label: "La prise · 20 pas", low: 94, high: 281, accepted: true }), {
      label: "La prise · 20 pas", low: 94, high: 281, accepted: true,
    });
    assert.deepEqual(readRunMessage({ type: "uttu-run", label: "Ce rendu", low: null, high: null, accepted: false }), {
      label: "Ce rendu", low: null, high: null, accepted: false,
    });
    assert.equal(readRunMessage({ type: "uttu-run", label: "x", low: 5, high: null, accepted: true }), null);
    assert.equal(readRunMessage({ type: "uttu-run", label: "", low: 1, high: 2, accepted: true }), null);
    assert.equal(readRunMessage({ type: "uttu-run", label: "x", low: 1, high: 2 }), null);
  });
});
