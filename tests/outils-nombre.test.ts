import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { outilsPublics } from "../src/lib/outils/catalogue.ts";
import { NOMBRE_OUTILS, OUTILS_HORS_CATALOGUE } from "../src/lib/outils/nombre.ts";

test("the home page tool count is the studio count (catalogue + 3D row)", () => {
  assert.equal(NOMBRE_OUTILS, outilsPublics({}).length + OUTILS_HORS_CATALOGUE);
});

test("no message hard-codes the tool count: every language reads {n}", () => {
  for (const lang of ["fr", "en", "de", "es"]) {
    const m = JSON.parse(readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), "utf8"));
    for (const text of [m.meta.description, m.accueil.sub2, m.accueil.also.library.name]) {
      assert.match(text, /\{n\}/, `${lang}: ${text}`);
      assert.doesNotMatch(text, /\b4\d\b/, `${lang}: ${text}`);
    }
  }
});
