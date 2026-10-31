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

test("the tool count does not change between first paint and after film2 loads (44 → 33 bug)", async () => {
  const { DEFAULT_PREFS, prefsSession } = await import("../src/lib/studio-prefs.ts");
  const { FAMILLES } = await import("../src/lib/outils/catalogue.ts");
  const famille = (f: string, filtre: object) => outilsPublics(filtre).filter(t => t.famille === f).length;
  // First paint: film2 not read yet. After the effect reads it, film2 is on (default since PR9).
  const firstPaint = prefsSession(DEFAULT_PREFS, false).outilsFiltre;
  for (const partenaires of [false, true]) {
    const after = prefsSession({ ...DEFAULT_PREFS, partenaires }, true);
    assert.equal(outilsPublics(after.outilsFiltre).length + OUTILS_HORS_CATALOGUE, NOMBRE_OUTILS, `partenaires ${partenaires}`);
    for (const f of FAMILLES) assert.equal(famille(f, after.outilsFiltre), famille(f, firstPaint), f);
  }
  // Generation still follows film2 (open weights unless partner models are on)…
  assert.equal(prefsSession(DEFAULT_PREFS, true).prefs.openWeightsOnly, true);
  // …and the explicit device choice still filters the catalogue.
  const strict = prefsSession({ ...DEFAULT_PREFS, openWeightsOnly: true }, true).outilsFiltre;
  assert.ok(outilsPublics(strict).length < NOMBRE_OUTILS - OUTILS_HORS_CATALOGUE);
});
