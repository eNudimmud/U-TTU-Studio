import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IntlMessageFormat } from "intl-messageformat";
import { parse } from "@formatjs/icu-messageformat-parser";
import { DEMO_CAST, DEMO_DECOR } from "../src/lib/creation/demo.ts";

const LANGS = ["en", "fr", "de", "es"] as const;
const load = (lang: string) => JSON.parse(readFileSync(`messages/storyboard/${lang}.json`, "utf8"));

function flat(node: unknown, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === "string") out[prefix] = node;
  else if (node && typeof node === "object") for (const [key, value] of Object.entries(node)) flat(value, prefix ? `${prefix}.${key}` : key, out);
  return out;
}
// Argument names, read by the ICU parser: plural branches are text, not arguments.
function names(nodes: readonly unknown[], out = new Set<string>()): Set<string> {
  for (const node of nodes as { value?: unknown; options?: Record<string, { value: unknown[] }> }[]) {
    if (node.options) {
      if (typeof node.value === "string") out.add(node.value);
      for (const option of Object.values(node.options)) names(option.value, out);
    } else if (typeof node.value === "string" && (node as { type?: number }).type !== 0) out.add(node.value);
  }
  return out;
}
const args = (text: string) => [...names(parse(text))].sort().join(",");

test("the storyboard speaks EN, FR, DE and ES on the same keys and the same placeholders", () => {
  const en = flat(load("en"));
  for (const lang of LANGS) {
    const cat = flat(load(lang));
    assert.deepEqual(Object.keys(cat).sort(), Object.keys(en).sort(), lang);
    for (const [key, text] of Object.entries(cat)) {
      assert.ok(text.trim().length > 0, `${lang} ${key} empty`);
      assert.equal(args(text), args(en[key]!), `${lang} ${key}`);
      assert.doesNotThrow(() => new IntlMessageFormat(text, lang).format(Object.fromEntries(args(text).split(",").filter(Boolean).map(name => [name, 2]))) , `${lang} ${key}`);
    }
  }
});

test("never « free », never « cr. », an estimate always names its unit", () => {
  for (const lang of LANGS) {
    for (const [key, text] of Object.entries(flat(load(lang)))) {
      assert.doesNotMatch(text, /\bcr\.|gratuit|free\b|kostenlos|gratis/i, `${lang} ${key}`);
      assert.doesNotMatch(text, /\{\w+\}\s*(estim|geschätzt)/i, `${lang} ${key}`);
    }
  }
});

test("no house example or other name is written in the copy or the templates; Uttu is the only example", () => {
  const names = [...DEMO_CAST, ...DEMO_DECOR].map(card => card.name).filter(name => name.length > 3);
  for (const lang of LANGS) {
    for (const [key, text] of Object.entries(flat(load(lang)))) {
      for (const name of [...names, "Mira"]) assert.ok(!text.includes(name), `${lang} ${key} names ${name}`);
      if (key.startsWith("storyboard.gabarits")) assert.doesNotMatch(text.replace(/\{\w+\}/g, ""), /Uttu/, `${lang} ${key}`);
    }
  }
});

test("the storyboard code names nobody", () => {
  for (const file of ["storyboard", "ecrire", "devis", "markdown", "prompt", "repliques", "film", "drapeau"]) {
    const code = readFileSync(`src/lib/storyboard/${file}.ts`, "utf8");
    assert.doesNotMatch(code, /Mira|coursière|vieil homme/i, file);
  }
});
