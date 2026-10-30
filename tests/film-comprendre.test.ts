import { test } from "node:test";
import assert from "node:assert/strict";
import { comprendrePlan, etapesPlan, lieuDeLaPhrase } from "../src/lib/film/comprendre.ts";

test("a sentence gives who and where; what is missing becomes a step of the same quote", () => {
  const plan = comprendrePlan("Uttu marche sur le quai la nuit, la caméra la suit", { cast: [], decor: [] });
  assert.deepEqual(plan.qui, [{ id: null, nom: "Uttu", nouveau: true }]);
  assert.deepEqual(plan.ou, { id: null, nom: "Le quai", nouveau: true });
  const { etapes, total } = etapesPlan(plan, { personnage: 4, lieu: 4, prise: 4 });
  assert.deepEqual(etapes.map(step => step.type), ["personnage", "lieu", "prise"]);
  assert.equal(total, 12);
});

test("known cards are reused, nothing is created twice", () => {
  const plan = comprendrePlan("Uttu marche sur le quai", { cast: [{ id: "uttu", name: "Uttu" }], decor: [{ id: "quai", name: "Le quai" }] });
  assert.deepEqual(plan.qui, [{ id: "uttu", nom: "Uttu", nouveau: false }]);
  assert.equal(plan.ou?.id, "quai");
  assert.deepEqual(etapesPlan(plan, { personnage: 4, lieu: 4, prise: 6 }).etapes.map(step => step.type), ["prise"]);
});

test("places in four languages, and a sentence without names still has a place to send", () => {
  assert.equal(lieuDeLaPhrase("Uttu marche sur le quai de la gare, caméra lente"), "Le quai de la gare");
  assert.equal(lieuDeLaPhrase("Uttu walks on the pier at night"), "The pier");
  assert.equal(lieuDeLaPhrase("Eine Frau läuft im Wald"), "Wald");
  assert.equal(lieuDeLaPhrase("Una mujer corre en el mercado"), "El mercado");
  const plan = comprendrePlan("Un chat dort", { cast: [], decor: [] });
  assert.equal(plan.decorDeLaPhrase, true);
  assert.equal(plan.ou?.nouveau, true);
});
