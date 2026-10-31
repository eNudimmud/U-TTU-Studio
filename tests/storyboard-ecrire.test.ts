import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { definirPersonnage, ecrireStoryboard, titreDeLIdee, type Gabarits } from "../src/lib/storyboard/ecrire.ts";
import { dureeTotale, tousLesPlans, DUREES_PLAN } from "../src/lib/storyboard/storyboard.ts";

const gabarits = (lang: string): Gabarits => JSON.parse(readFileSync(`messages/storyboard/${lang}.json`, "utf8")).storyboard.gabarits;
const CTX = { cast: [{ id: "uttu", name: "Uttu" }], decor: [{ id: "quai", name: "Le quai" }] };
const opts = (over: Partial<Parameters<typeof ecrireStoryboard>[2]> = {}) => ({ dureeCible: 30 as const, format: "paysage" as const, formatChoisi: false, gabarits: gabarits("fr"), now: "2026-10-31T12:00:00.000Z", suffixe: "a1", ...over });

test("15 s → 3 shots, 30 s → 3 scenes × 2, 60 s → 3 scenes of 3–4; lengths are 5/8/10 only", () => {
  for (const [cible, scenes, plans] of [[15, 1, 3], [30, 3, 6], [60, 3, 10]] as const) {
    const { storyboard } = ecrireStoryboard("Uttu marche sur le quai la nuit.", CTX, opts({ dureeCible: cible }));
    assert.equal(storyboard.sequences.length, scenes, `${cible}`);
    assert.equal(tousLesPlans(storyboard).length, plans, `${cible}`);
    for (const plan of tousLesPlans(storyboard)) assert.ok((DUREES_PLAN as readonly number[]).includes(plan.duree));
    assert.ok(Math.abs(dureeTotale(storyboard) - cible) <= cible * 0.5, `${cible} → ${dureeTotale(storyboard)}`);
  }
});

test("opens wide on the place, ends wide, and never two identical shots in a row", () => {
  const { storyboard } = ecrireStoryboard("Uttu court sur le quai sous la pluie.", CTX, opts({ dureeCible: 60 }));
  const plans = tousLesPlans(storyboard);
  assert.equal(plans[0]!.cadrage, "large");
  assert.equal(plans.at(-1)!.cadrage, "large");
  for (let i = 1; i < plans.length; i += 1) {
    assert.ok(!(plans[i]!.cadrage === plans[i - 1]!.cadrage && plans[i]!.camera === plans[i - 1]!.camera), `shots ${i} and ${i + 1}`);
  }
  // A motion verb gives a following camera on the main action.
  const action = plans.find(plan => plan.action.toLowerCase().includes("court"));
  assert.equal(action?.camera, "suit");
});

test("known names are linked, an unknown name is new and created later; nothing invented", () => {
  const ecrit = ecrireStoryboard("Uttu retrouve Nora sur le quai.", CTX, opts());
  assert.deepEqual(ecrit.repris.sort(), ["Le quai", "Uttu"]);
  assert.deepEqual(ecrit.nouveaux, ["Nora"]);
  const refs = tousLesPlans(ecrit.storyboard).flatMap(plan => plan.refs);
  assert.ok(refs.some(ref => ref.nom === "Uttu" && ref.id === "uttu"));
  assert.ok(refs.some(ref => ref.nom === "Nora" && ref.id === null));
  const names = new Set(refs.map(ref => ref.nom));
  for (const name of names) assert.ok(["Uttu", "Nora", "Le quai"].includes(name), name);
});

test("a quoted line in the idea is the line, marked as coming from the idea", () => {
  const { storyboard } = ecrireStoryboard("Uttu sur le quai dit « Il reste une heure. »", CTX, opts());
  const parle = tousLesPlans(storyboard).find(plan => plan.dialogue.texte);
  assert.equal(parle?.dialogue.texte, "Il reste une heure.");
  assert.equal(parle?.dialogue.source, "idee");
  assert.equal(parle?.duree, 8);
  assert.equal(parle?.dialogue.qui, "Uttu");
});

test("one question at most: who first (nobody known), else the format, else none", () => {
  assert.deepEqual(ecrireStoryboard("La pluie tombe sur la ville.", { cast: [], decor: [] }, opts()).question, { type: "qui" });
  assert.deepEqual(ecrireStoryboard("Uttu sur le quai.", CTX, opts()).question, { type: "format" });
  assert.equal(ecrireStoryboard("Uttu sur le quai.", CTX, opts({ formatChoisi: true })).question, null);
});

test("answering who fills the shots written around « the character »", () => {
  const g = gabarits("en");
  const { storyboard } = ecrireStoryboard("Rain falls over the city.", { cast: [], decor: [] }, opts({ gabarits: g }));
  assert.ok(tousLesPlans(storyboard).some(plan => plan.action.includes(g.quelquun)));
  const next = definirPersonnage(storyboard, "Uttu", { cast: [], decor: [] }, g.quelquun);
  assert.ok(tousLesPlans(next).every(plan => !plan.action.includes(g.quelquun)));
  assert.ok(tousLesPlans(next).some(plan => plan.refs.some(ref => ref.nom === "Uttu" && ref.id === null)));
});

test("10 s is only used when that length has a quote", () => {
  const sans = ecrireStoryboard("Uttu sur le quai.", CTX, opts({ dureeCible: 60 }));
  assert.ok(tousLesPlans(sans.storyboard).every(plan => plan.duree !== 10));
  const avec = ecrireStoryboard("Uttu sur le quai.", CTX, opts({ dureeCible: 60, dureeChiffree: () => true }));
  assert.ok(tousLesPlans(avec.storyboard).some(plan => plan.duree === 10));
});

test("the title comes from the idea's first words, never a quote", () => {
  assert.equal(titreDeLIdee("un DJ traverse la ville sous la pluie, puis joue"), "Un DJ traverse la ville");
  assert.equal(titreDeLIdee("« Bonjour » dit Uttu"), "Dit Uttu");
});

test("every language's templates fill every placeholder", () => {
  for (const lang of ["en", "fr", "de", "es"]) {
    const { storyboard } = ecrireStoryboard("Uttu sur le quai.", CTX, opts({ gabarits: gabarits(lang), dureeCible: 60 }));
    for (const plan of tousLesPlans(storyboard)) assert.doesNotMatch(plan.action, /[{}]/, `${lang} ${plan.action}`);
  }
});
