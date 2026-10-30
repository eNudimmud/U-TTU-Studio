import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveTakeQuote, BILLED_MEASURE } from "../src/lib/render/billed-quote.ts";
import { announcedFromQuote } from "../src/lib/render/landed-cost.ts";
import { quoteWords } from "../src/lib/render/quote-words.ts";

const fr = JSON.parse(readFileSync("messages/fr.json", "utf8"));
const t = (key: string, values: Record<string, string | number> = {}) => {
  const text = key.split(".").reduce((node: any, part) => node[part], fr) as string;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name]));
};
const H3 = BILLED_MEASURE.profile;

test("a billed quote reads as a range up to its billed upper bound", () => {
  assert.equal(quoteWords(t, resolveTakeQuote(H3, [])), "≈ 4 à 6 crédits estimés");
});

test("a balance-measured quote borrows the billed upper bound of the same setting", () => {
  const quote = resolveTakeQuote(H3, [{ profile: H3, credits: 4, gpuSeconds: 14.5, at: "2026-10-30T09:00:00Z" }]);
  assert.equal(quote.source, "balance");
  assert.equal(quote.source === "balance" && quote.high, 6);
  assert.equal(quoteWords(t, quote), "≈ 4 à 6 crédits estimés, mesuré sur tes prises.");
  assert.deepEqual(announcedFromQuote(quote), { credits: 4, high: 6 });
});

test("no range when the measured take already reaches the bound", () => {
  const quote = resolveTakeQuote(H3, [{ profile: H3, credits: 7, gpuSeconds: 25, at: "2026-10-30T09:00:00Z" }]);
  assert.equal(quote.source === "balance" && quote.high, null);
  assert.match(quoteWords(t, quote), /^Mesuré sur tes prises : environ 7 crédits\.$/);
});

test("chips and the gold button print the same range", async () => {
  const { quoteAmount } = await import("../src/lib/render/quote-words.ts");
  assert.equal(quoteAmount(t, resolveTakeQuote(H3, [])), "4 à 6");
  assert.equal(quoteAmount(t, { source: "unmeasured" }), null);
});
