import { test } from "node:test";
import assert from "node:assert/strict";
import { appliquerCorrection, lireCorrection, resserrer } from "../src/lib/storyboard/corriger.ts";
import { dureeTotale, planVide, storyboardVide, tousLesPlans, trouverPlan, type Storyboard } from "../src/lib/storyboard/storyboard.ts";

const board = (): Storyboard => ({
  ...storyboardVide({ id: "a", titre: "A", idee: "", now: "x" }),
  sequences: [
    { id: "s1", titre: "", resume: "", plans: [{ ...planVide("p1"), duree: 8 }, { ...planVide("p2"), duree: 8 }] },
    { id: "s2", titre: "", resume: "", plans: [{ ...planVide("p3"), duree: 10 }, { ...planVide("p4"), duree: 8 }, { ...planVide("p5"), duree: 5 }] },
  ],
});

test("plain intentions in four languages", () => {
  assert.deepEqual(lireCorrection("ajoute un plan"), { type: "ajouter", fin: false });
  assert.deepEqual(lireCorrection("Add a closing shot"), { type: "ajouter", fin: true });
  assert.deepEqual(lireCorrection("retire le plan 3"), { type: "retirer", n: 3 });
  assert.deepEqual(lireCorrection("Einstellung 2 entfernen"), { type: "retirer", n: 2 });
  assert.deepEqual(lireCorrection("move shot 2 later"), { type: "deplacer", n: 2, pas: 1 });
  assert.deepEqual(lireCorrection("adelanta el plano 4"), { type: "deplacer", n: 4, pas: -1 });
  assert.deepEqual(lireCorrection("passe en portrait"), { type: "format", format: "portrait" });
  assert.deepEqual(lireCorrection("raccourcis à 15 s"), { type: "raccourcir", secondes: 15 });
  assert.deepEqual(lireCorrection("Le plan 2 dit : « Il reste une heure. »"), { type: "replique", n: 2, texte: "Il reste une heure." });
  assert.equal(lireCorrection("make it more poetic"), null);
});

test("tightening keeps the first and last shots and never goes under the target by removing too much", () => {
  const out = resserrer(board(), 15, null);
  assert.ok(dureeTotale(out) <= 15, String(dureeTotale(out)));
  const ids = tousLesPlans(out).map(plan => plan.id);
  assert.equal(ids[0], "p1");
  assert.equal(ids.at(-1), "p5");
});

test("a correction on a shot that does not exist changes nothing", () => {
  assert.equal(appliquerCorrection(board(), { type: "retirer", n: 9 }, null, "p9"), null);
  const added = appliquerCorrection(board(), { type: "ajouter", fin: true }, null, "p9")!;
  assert.equal(added.n, 6);
  assert.equal(trouverPlan(added.sb, "p9")?.plan.cadrage, "large");
  const said = appliquerCorrection(board(), { type: "replique", n: 1, texte: "Bonjour." }, null, "p9")!;
  assert.equal(trouverPlan(said.sb, "p1")!.plan.dialogue.type, "replique");
  assert.equal(trouverPlan(said.sb, "p1")!.plan.dialogue.source, "visiteur");
});

test("every suggestion button and every example Uttu gives is understood, in each language", async () => {
  const { readFileSync } = await import("node:fs");
  for (const lang of ["en", "fr", "de", "es"]) {
    const uttu = JSON.parse(readFileSync(new URL(`../messages/storyboard/${lang}.json`, import.meta.url), "utf8")).storyboard.uttu;
    for (const key of ["addClosing", "toPortrait", "toLandscape"]) assert.ok(lireCorrection(uttu[key]), `${lang} ${key}: ${uttu[key]}`);
    assert.deepEqual(lireCorrection(uttu.tighten.replace("{n}", "30")), { type: "raccourcir", secondes: 30 }, `${lang} tighten`);
    const examples = [...String(uttu.notUnderstood).matchAll(/[«“„]\s?([^»”“]+?)\s?[»”“]/g)].map(m => m[1].replace(/…$/, "Hello."));
    assert.ok(examples.length >= 6, `${lang} examples: ${examples.join(" | ")}`);
    for (const example of examples) assert.ok(lireCorrection(example), `${lang} not understood: ${example}`);
  }
});

test("CE5: selection as data, not a text prefix — a request naming no shot reads for the selected one; a named shot wins", () => {
    assert.deepEqual(lireCorrection("dit : on y va", 2), { type: "replique", n: 2, texte: "on y va" });
    assert.deepEqual(lireCorrection("retire-le", 3), { type: "retirer", n: 3 });
    assert.deepEqual(lireCorrection("move it later", 1), { type: "deplacer", n: 1, pas: 1 });
    assert.deepEqual(lireCorrection("remove shot 4", 2), { type: "retirer", n: 4 });
    assert.equal(lireCorrection("retire-le"), null, "without a selection nothing is guessed");
});
