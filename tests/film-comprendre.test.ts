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

import { appliquerChoix, basculerQui, trierPhotos } from "../src/lib/film/choix.ts";

test("the Qui and Où sheets win over the sentence, and a new one stays one step of the same quote", () => {
  const read = comprendrePlan("Uttu marche sur le quai", { cast: [], decor: [{ id: "gare", name: "La gare" }] });
  const plan = appliquerChoix(read, { qui: [{ id: "c1", nom: "La coursière" }, { id: null, nom: "Le vieil homme", source: "photos" }], ou: { id: "gare", nom: "La gare" } });
  assert.deepEqual(plan.qui.map(who => [who.nom, who.nouveau]), [["La coursière", false], ["Le vieil homme", true]]);
  assert.equal(plan.ou?.id, "gare");
  const { etapes, total } = etapesPlan(plan, { personnage: 4, personnagePhotos: 5, lieu: 4, prise: 6 });
  assert.deepEqual(etapes.map(step => [step.type, step.credits]), [["personnage", 5], ["prise", 6]]);
  assert.equal(total, 11);
});

test("never more than 3 characters, a second tap removes", () => {
  let qui = basculerQui([], { id: "a", nom: "A" });
  qui = basculerQui(qui, { id: "b", nom: "B" });
  qui = basculerQui(qui, { id: "c", nom: "C" });
  assert.equal(basculerQui(qui, { id: "d", nom: "D" }).length, 3);
  assert.deepEqual(basculerQui(qui, { id: "b", nom: "B" }).map(item => item.id), ["a", "c"]);
});

test("F16: twins are dropped, a photo already in the gallery is offered back", () => {
  const sorted = trierPhotos(["x", "y", "x", "z", "w"], [{ sha256: "y", id: "uttu", nom: "Uttu" }]);
  assert.deepEqual(sorted.garder, [0, 3, 4]);
  assert.equal(sorted.doublons, 1);
  assert.deepEqual(sorted.dejaLa, { id: "uttu", nom: "Uttu" });
  assert.equal(trierPhotos(["a"], []).dejaLa, null);
});
