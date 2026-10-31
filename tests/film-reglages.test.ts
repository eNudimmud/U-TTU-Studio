import { test } from "node:test";
import assert from "node:assert/strict";
import { ligneDuPlan, lireReglages, reglagesChiffres, reglagesVersTake, REGLAGES_FILM } from "../src/lib/film/reglages.ts";
import { resolveTakeQuote } from "../src/lib/render/billed-quote.ts";
import { quoteCredits } from "../src/lib/prise/rendu.ts";
import { takeProfile } from "../src/lib/render/take-graph.ts";

const prix = (settings: Parameters<typeof takeProfile>[0]) => quoteCredits(resolveTakeQuote(takeProfile(settings), []));

test("the default rendu is « Plus fidèle », H3, landscape, 5 s — with a price", () => {
  const take = reglagesVersTake(REGLAGES_FILM);
  assert.equal(take.engine, "h3");
  assert.equal(take.aspect, "horizontal");
  assert.equal(take.seconds, 5);
  assert.ok((prix(take) ?? 0) > 0);
  assert.equal(reglagesVersTake({ ...REGLAGES_FILM, rendu: "rapide", format: "portrait" }).engine, "ltx");
  assert.equal(reglagesVersTake({ ...REGLAGES_FILM, rendu: "rapide" }).rendu, "apercu");
});

test("a duration without a price is never kept: no quote, no spend", () => {
  const fixed = reglagesChiffres({ ...REGLAGES_FILM, duree: 8 }, prix);
  assert.ok(prix(reglagesVersTake(fixed)) !== null);
  assert.equal(reglagesChiffres({ ...REGLAGES_FILM, duree: 8, rendu: "rapide" }, prix).duree, 8);
});

test("camera and words said go into the sentence sent, in plain English for the model", () => {
  assert.equal(ligneDuPlan("Uttu marche", { camera: "suit", paroles: "replique", texte: "On y va" }), 'Uttu marche The camera follows the character. The character says: "On y va"');
  assert.equal(ligneDuPlan("Uttu marche", { camera: null, paroles: "aucune", texte: "x" }), "Uttu marche");
});

test("stored settings are read safely", () => {
  assert.deepEqual(lireReglages("{oops"), REGLAGES_FILM);
  assert.equal(lireReglages(JSON.stringify({ duree: 3, rendu: "rapide", camera: "drone" })).duree, 5);
  assert.equal(lireReglages(JSON.stringify({ rendu: "rapide" })).rendu, "rapide");
});
