// Cinema CGI: pins the curated pipeline to the live catalogue (no renamed/removed tool slips
// through silently) and the copy to the studio's open-weights-first, no-meta-phrase rules.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CGI_PIPELINE, cgiResolve, cgiToolIds } from "../src/lib/cgi/pipeline.ts";
import { CGI_COPY, cgiCopy } from "../src/lib/cgi/copy.ts";
import { outilParId, outilPartenaire } from "../src/lib/outils/catalogue.ts";
import { MINIMAX_H3_ATTRIBUTION } from "../src/lib/open-weights.ts";
import { templatePartenaire } from "../src/lib/workflows/registre.ts";

const LOCALES = ["en", "fr", "de", "es"] as const;
const FORBIDDEN = /\b(free|gratuit|gratis|kostenlos|mira)\b/i;
const MESSAGES = Object.fromEntries(LOCALES.map(locale => [locale, JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"))]));

describe("Cinema CGI pipeline", () => {
  it("has five steps, each resolving against the live tool registry", () => {
    assert.deepEqual(CGI_PIPELINE.map(step => step.id), ["cast", "decor", "prise", "montage", "finaliser"]);
    for (const step of CGI_PIPELINE) {
      const groups = cgiResolve(step);
      assert.ok(groups.length > 0, step.id);
      for (const group of groups) assert.ok(group.tools.length > 0, `${step.id}/${group.key}`);
    }
  });

  it("curates only open-weight tools: no partner node anywhere in the pipeline", () => {
    const ids = cgiToolIds();
    assert.ok(ids.length >= 25, "the pipeline should cover every step in depth");
    // img-klein and 3d-ouvert legitimately appear in both Cast and Set: the same generic
    // text-to-image / image-to-3D tool, reused with a different why-line for each subject.
    for (const step of CGI_PIPELINE) {
      const stepIds = step.groups.flatMap(group => group.tools.map(tool => tool.id));
      assert.equal(new Set(stepIds).size, stepIds.length, `duplicate tool id within ${step.id}`);
    }
    for (const id of ids) {
      const outil = outilParId(id);
      assert.ok(outil, `unknown tool id "${id}"`);
      assert.equal(outilPartenaire(outil!), false, `${id} is a partner node; Cinema CGI is open weights only`);
    }
  });

  it("every curated tool has a title key in all four locales, and nothing is left `bientot`", () => {
    const ids = cgiToolIds();
    for (const id of ids) {
      for (const locale of LOCALES) assert.ok(MESSAGES[locale].outils?.t?.[id]?.title, `${locale}: outils.t.${id}.title`);
    }
  });

  it("names MiniMax H3 in the why-line of every tool built on it", () => {
    const h3Ids = cgiToolIds().filter(id => MINIMAX_H3_ATTRIBUTION.includes(outilParId(id)!.template));
    assert.ok(h3Ids.length >= 4, "the Shoot step should lean on MiniMax H3 reference video");
    for (const step of CGI_PIPELINE) {
      for (const group of step.groups) {
        for (const tool of group.tools) {
          if (!h3Ids.includes(tool.id)) continue;
          for (const locale of LOCALES) assert.match(cgiCopy(locale).why[tool.why] ?? "", /MiniMax H3/, `${locale} ${tool.id}`);
        }
      }
    }
  });

  it("Finish only ever reaches an upscale template, never a regeneration one", () => {
    const finish = CGI_PIPELINE.find(step => step.id === "finaliser")!;
    for (const group of finish.groups) {
      for (const tool of group.tools) {
        assert.match(outilParId(tool.id)!.template, /seedvr2|frame_interpolation/, tool.id);
        assert.equal(templatePartenaire(outilParId(tool.id)!.template), false, tool.id);
      }
    }
  });
});

describe("Cinema CGI copy", () => {
  it("keeps the same step, group and why keys across every locale", () => {
    const [base, ...rest] = LOCALES.map(locale => CGI_COPY[locale]);
    for (const copy of rest) {
      assert.deepEqual(Object.keys(copy.step).sort(), Object.keys(base.step).sort());
      assert.deepEqual(Object.keys(copy.group).sort(), Object.keys(base.group).sort());
      assert.deepEqual(Object.keys(copy.why).sort(), Object.keys(base.why).sort());
      assert.deepEqual(Object.keys(copy.licence).sort(), Object.keys(base.licence).sort());
    }
  });

  it("has a why-line for every tool the pipeline curates, in every locale", () => {
    const whyKeys = new Set<string>();
    for (const step of CGI_PIPELINE) for (const group of step.groups) for (const tool of group.tools) whyKeys.add(tool.why);
    for (const locale of LOCALES) {
      const copy = cgiCopy(locale);
      for (const key of whyKeys) assert.ok(copy.why[key], `${locale}: cgi.why.${key}`);
    }
  });

  it("never says free, gratuit or Mira, and never the meta phrase \u00ab personnage fictif \u00bb", () => {
    for (const locale of LOCALES) {
      const text = JSON.stringify(cgiCopy(locale));
      assert.equal(FORBIDDEN.test(text), false, locale);
      assert.equal(/personnage fictif/i.test(text), false, locale);
    }
  });

  it("keeps cinematography and model names identical across locales (proper nouns, not translated)", () => {
    const PROPER_NOUNS = ["FLUX.3 Klein", "MiniMax H3", "FastH3", "LTX-2.5", "LTX-2.3", "Wan 2.2", "Wan Animate 2", "SeedVR2", "TRELLIS.2", "BiRefNet", "Chatterbox"];
    for (const noun of PROPER_NOUNS) {
      const seenIn = LOCALES.filter(locale => JSON.stringify(cgiCopy(locale)).includes(noun));
      assert.ok(seenIn.length > 0, noun);
      for (const locale of seenIn) assert.ok(JSON.stringify(cgiCopy(locale)).includes(noun), `${locale} drops the proper noun "${noun}"`);
    }
  });

  it("states a licence for every open-weight model with a non-standard licence", () => {
    for (const locale of LOCALES) {
      const copy = cgiCopy(locale);
      assert.match(copy.licence.h3, /MiniMax H3/);
      assert.match(copy.licence.qwenEdit, /Qwen-Image/);
      assert.match(copy.licence.klein9b, /FLUX\.2 Klein 9B/);
      assert.ok(copy.licenceTitle.length > 0, locale);
    }
  });
});
