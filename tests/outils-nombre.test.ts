import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { outilsPublics } from "../src/lib/outils/catalogue.ts";
import { NOMBRE_OUTILS, NOMBRE_OUTILS_OPEN_WEIGHTS, NOMBRE_OUTILS_TOUS, OUTILS_HORS_CATALOGUE } from "../src/lib/outils/nombre.ts";
import { OPEN_WEIGHTS_MODE } from "../src/lib/open-weights.ts";

test("the home page tool count is the studio count (catalogue + 3D row), in both modes", () => {
  assert.equal(NOMBRE_OUTILS_TOUS, outilsPublics({}).length + OUTILS_HORS_CATALOGUE);
  assert.equal(NOMBRE_OUTILS_OPEN_WEIGHTS, outilsPublics({ openWeightsOnly: true }).length + OUTILS_HORS_CATALOGUE);
  assert.equal(NOMBRE_OUTILS, OPEN_WEIGHTS_MODE ? NOMBRE_OUTILS_OPEN_WEIGHTS : NOMBRE_OUTILS_TOUS);
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

test("the partner switch never changes the tool count (44 → 33 bug), with open-weights mode off", async () => {
  const { DEFAULT_PREFS, prefsSession } = await import("../src/lib/studio-prefs.ts");
  const { FAMILLES } = await import("../src/lib/outils/catalogue.ts");
  const famille = (f: string, filtre: object) => outilsPublics(filtre).filter(t => t.famille === f).length;
  const firstPaint = prefsSession(DEFAULT_PREFS, false).outilsFiltre;
  for (const partenaires of [false, true]) {
    const after = prefsSession({ ...DEFAULT_PREFS, partenaires }, false);
    assert.equal(outilsPublics(after.outilsFiltre).length + OUTILS_HORS_CATALOGUE, NOMBRE_OUTILS_TOUS, `partenaires ${partenaires}`);
    for (const f of FAMILLES) assert.equal(famille(f, after.outilsFiltre), famille(f, firstPaint), f);
  }
  // Generation stays open weights unless partner models are on…
  assert.equal(prefsSession(DEFAULT_PREFS, false).prefs.openWeightsOnly, true);
  assert.equal(prefsSession({ ...DEFAULT_PREFS, partenaires: true }, false).prefs.openWeightsOnly, false);
  // …and the explicit device choice still filters the catalogue.
  const strict = prefsSession({ ...DEFAULT_PREFS, openWeightsOnly: true }, false).outilsFiltre;
  assert.ok(outilsPublics(strict).length < NOMBRE_OUTILS_TOUS - OUTILS_HORS_CATALOGUE);
});

test("open-weights mode: one count from the first paint on, whatever the stored switches say", async () => {
  const { DEFAULT_PREFS, prefsSession } = await import("../src/lib/studio-prefs.ts");
  for (const stored of [DEFAULT_PREFS, { ...DEFAULT_PREFS, partenaires: true }, { ...DEFAULT_PREFS, partenaires: true, nanoBanana: true }, { ...DEFAULT_PREFS, openWeightsOnly: true }]) {
    const { prefs, outilsFiltre } = prefsSession(stored, true);
    assert.equal(outilsPublics(outilsFiltre).length + OUTILS_HORS_CATALOGUE, NOMBRE_OUTILS_OPEN_WEIGHTS, JSON.stringify(stored));
    assert.equal(prefs.openWeightsOnly, true);
    assert.equal(prefs.partenaires, false);
    assert.equal(prefs.nanoBanana, false);
  }
});
