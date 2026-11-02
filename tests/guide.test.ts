import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { GUIDE_HOME } from "../src/lib/guide/home-copy.ts";

const FORBIDDEN = /\b(free|gratuit|gratis|kostenlos|mira)\b/i;

describe("guide", () => {
  it("describes five steps, estimated costs, and no free or Mira", () => {
    for (const [locale, copy] of Object.entries(GUIDE_HOME)) {
      const text = JSON.stringify(copy);
      assert.equal(FORBIDDEN.test(text), false, locale);
      assert.equal(copy.steps.length, 5, locale);
      assert.match(copy.steps[4]!.body, /regenerat|régénéré|neu erzeugt|regenera/i, locale);
      assert.ok(copy.costs.every(row => /estim|geschätzt|render|rendu/i.test(row.price)), locale);
      assert.equal(copy.faq.some(item => /Nano Banana/.test(item.a)), false, locale);
    }
    const faq = JSON.parse(readFileSync("messages/en.json", "utf8")).uttu.faq;
    assert.match(faq.tabs.a, /five steps/);
    assert.equal(faq.bubble.a.includes("Nano Banana"), false);
    assert.match(readFileSync("src/app/sitemap.ts", "utf8"), /\/guide/);
  });
});
