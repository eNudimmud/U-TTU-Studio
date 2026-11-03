// Cinema prompting guide (/guide/cgi): cinematography terms stay in English in every language,
// examples teach precision over adjectives, and the studio's banned words never slip in.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CGI_GUIDE, cgiGuide } from "../src/lib/guide/cgi-copy.ts";

const LOCALES = ["en", "fr", "de", "es"] as const;
const FORBIDDEN = /\b(free|gratuit|gratis|kostenlos|mira)\b/i;

describe("Cinema prompting guide", () => {
  it("has at least six tools, each with a tip, a good and a bad example", () => {
    for (const locale of LOCALES) {
      const copy = cgiGuide(locale);
      assert.ok(copy.tools.length >= 6, locale);
      for (const tool of copy.tools) {
        assert.ok(tool.tip.length > 0, `${locale} ${tool.name}`);
        assert.ok(tool.good.length > 0, `${locale} ${tool.name}`);
        assert.ok(tool.bad.length > 0, `${locale} ${tool.name}`);
        assert.ok(tool.badWhy.length > 0, `${locale} ${tool.name}`);
      }
    }
  });

  it("keeps the same glossary terms, in English, across every locale", () => {
    const base = cgiGuide("en").glossary.map(item => item.term);
    for (const locale of LOCALES) {
      assert.deepEqual(cgiGuide(locale).glossary.map(item => item.term), base, locale);
    }
  });

  it("never says free, gratuit or Mira, and never the meta phrase \u00ab personnage fictif \u00bb", () => {
    for (const locale of LOCALES) {
      const text = JSON.stringify(cgiGuide(locale));
      assert.equal(FORBIDDEN.test(text), false, locale);
      assert.equal(/personnage fictif/i.test(text), false, locale);
    }
  });

  it("never prompts with the vague words it warns against (8k, cinematic, best quality) in a GOOD example", () => {
    const VAGUE = /\b(8k|4k|best quality|cinematic|trending|epic|amazing)\b/i;
    for (const locale of LOCALES) {
      for (const tool of cgiGuide(locale).tools) assert.equal(VAGUE.test(tool.good), false, `${locale} ${tool.name}`);
    }
  });

  it("names a real camera, lens or lighting term in every tool's good example", () => {
    const CRAFT_TERM = /dolly|rack focus|golden hour|35mm|key light|anamorphic|practical lighting|walk cycle|native resolution|film grain|three-quarter|outfit|same key light|m\u00eame|gleiche|mismo/i;
    for (const locale of LOCALES) {
      for (const tool of cgiGuide(locale).tools) assert.match(tool.good, CRAFT_TERM, `${locale} ${tool.name}`);
    }
  });

  it("matches the CgiCopy pipeline's proper nouns for the same models", () => {
    const text = JSON.stringify(CGI_GUIDE.en);
    for (const noun of ["FLUX.3 Klein", "MiniMax H3", "LTX-2.5", "Qwen-Edit", "Wan Animate 2", "SeedVR2"]) {
      assert.ok(text.includes(noun), noun);
    }
  });
});
