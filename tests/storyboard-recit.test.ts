import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lireCorrection, lireReglage } from "../src/lib/storyboard/corriger.ts";
import { ecrireStoryboard, titreDeLIdee, type Gabarits } from "../src/lib/storyboard/ecrire.ts";
import { catalogue, contexteDuCatalogue } from "../src/lib/storyboard/identites.ts";
import { appliquerATous, appliquerNote, ciblesNote, lireDemande } from "../src/lib/storyboard/note.ts";
import { decouper, ecrireDepuisRecit, estRecit, type OptionsRecit } from "../src/lib/storyboard/recit.ts";
import { arreterEntreLesPlans, storyboardU11Actif } from "../src/lib/storyboard/u11.ts";
import { tousLesPlans, type Storyboard } from "../src/lib/storyboard/storyboard.ts";

const gabarits = (lang: string): Gabarits => JSON.parse(readFileSync(`messages/storyboard/${lang}.json`, "utf8")).storyboard.gabarits;
const CTX = {
  cast: [{ id: "enki", name: "Enki" }, { id: "fizz", name: "Fizz" }],
  decor: [{ id: "blanche", name: "Blanche Of Castille" }],
};
const opts = (over: Partial<OptionsRecit> = {}): OptionsRecit => ({
  dureeCible: null, format: "paysage", formatChoisi: true, gabarits: gabarits("en"), now: "2026-11-01T12:00:00.000Z", suffixe: "u11",
  dureeChiffree: () => true, ...over,
});
const JD = "Enki and Fizz meet at night in Blanche Of Castille; Enki hands Fizz a glowing golden thread while rain falls outside.";
const FIL = `The Golden Thread. Night, heavy rain at @Blanche Of Castille.
@Enki waits under the stone arch, a golden thread in his hand.
@Fizz runs in from the rain, soaked.
Enki: "You came back." Fizz: "I always do."
Enki ties the golden thread around Fizz's wrist. Thunder. The thread glows, and they walk into the castle together.`;
const GENERIC = new Set(["The place", "Arrival", "A detail", "The moment", "The look", "Opening", "Heart", "Ending", "The action"]);

test("the flag is the address or the tab, and 0/1 leave the classic page", () => {
  assert.equal(storyboardU11Actif("?storyboard=u11", null), true);
  assert.equal(storyboardU11Actif("", "u11"), true);
  assert.equal(storyboardU11Actif("", null), false);
  assert.equal(storyboardU11Actif("?storyboard=1", "u11"), false);
  assert.equal(storyboardU11Actif("?storyboard=0", "u11"), false);
});

test("stopping between shots drops only the shots still waiting", () => {
  const file = arreterEntreLesPlans({ restants: ["b", "c"], enCours: "a", faits: [], echecs: [] });
  assert.deepEqual(file.restants, []);
  assert.equal(file.enCours, "a");
});

test("JD's sentence: two action shots, Enki and Fizz linked, Blanche is the place and never a character", () => {
  assert.equal(estRecit(JD), true);
  const { storyboard, mode } = ecrireDepuisRecit(JD, CTX, opts());
  assert.equal(mode, "recit");
  const plans = tousLesPlans(storyboard);
  assert.equal(plans.length, 2);
  assert.deepEqual(plans.map(plan => plan.titre), plans.map(plan => titreDeLIdee(plan.action)));
  for (const plan of plans) {
    assert.ok(!GENERIC.has(plan.titre), plan.titre);
    const qui = plan.refs.filter(ref => ref.role === "qui").map(ref => ref.nom);
    const ou = plan.refs.filter(ref => ref.role === "ou");
    assert.deepEqual(qui, ["Enki", "Fizz"]);
    assert.equal(ou.length, 1);
    assert.equal(ou[0]!.nom, "Blanche Of Castille");
    assert.equal(ou[0]!.id, "blanche");
    assert.ok(plan.refs.every(ref => ref.role !== "qui" || !/blanche|castille/i.test(ref.nom)));
    assert.ok(!plan.refs.some(ref => /rain|pluie/i.test(ref.nom)));
  }
  assert.equal(plans[0]!.refs.find(ref => ref.nom === "Fizz")!.id, "fizz");
  assert.equal(plans[1]!.titre, titreDeLIdee(plans[1]!.action));
  assert.match(plans[0]!.titre, /Enki/);
  assert.match(plans[1]!.action, /golden thread/i);
});

test("a script keeps its title, its dialogue and one shot per action", () => {
  const { storyboard, etapes } = ecrireDepuisRecit(FIL, CTX, opts());
  const plans = tousLesPlans(storyboard);
  assert.equal(storyboard.titre, "The Golden Thread");
  assert.equal(plans.length, 6);
  assert.equal(etapes.plans, 6);
  assert.equal(etapes.lieu, "Blanche Of Castille");
  assert.equal(etapes.lieuConnu, true);
  assert.deepEqual(etapes.personnages, ["Enki", "Fizz"]);
  assert.equal(etapes.personnagesConnus, true);
  const parle = plans.find(plan => plan.dialogue.texte.includes("You came back"));
  assert.ok(parle, "dialogue kept");
  assert.match(parle!.dialogue.texte, /I always do/);
  assert.equal(parle!.dialogue.source, "idee");
  assert.equal(parle!.duree, 8);
  for (const plan of plans) assert.ok(!GENERIC.has(plan.titre), plan.titre);
  assert.ok(plans.every(plan => plan.refs.filter(ref => ref.role === "ou").length === 1));
  assert.ok(plans.every(plan => !plan.refs.some(ref => ref.role === "qui" && /blanche/i.test(ref.nom))));
});

test("a one-sentence idea stays on the template writer", () => {
  const idee = "Enki waits for Fizz in Blanche Of Castille.";
  assert.equal(estRecit(idee), false);
  const recit = ecrireDepuisRecit(idee, CTX, opts({ dureeCible: 15 }));
  const classic = ecrireStoryboard(idee, CTX, { ...opts({ dureeCible: 15 }), dureeCible: 15 });
  assert.equal(recit.mode, "gabarit");
  assert.equal(tousLesPlans(recit.storyboard).length, tousLesPlans(classic.storyboard).length);
});

test("a place is never split, a card without a picture still links, a homonym is not created again", () => {
  const cat = catalogue(
    [{ id: "fizz", name: "Fizz" }, { id: "fizz-2", name: "Fizz", photos: ["a.webp"] }, { id: "enki", name: "Enki" }],
    [{ id: "blanche", name: "Blanche Of Castille" }],
    [],
  );
  const ctx = contexteDuCatalogue(cat);
  assert.ok(ctx.cast.some(item => item.id === "enki"));
  assert.ok(!ctx.cast.some(item => item.name === "Fizz"), "two Fizz stay unresolved");
  const { storyboard } = ecrireDepuisRecit("Enki waits under the arch; Fizz runs in from the rain at Blanche Of Castille.", ctx, opts());
  const refs = tousLesPlans(storyboard).flatMap(plan => plan.refs);
  assert.ok(refs.some(ref => ref.nom === "Enki" && ref.id === "enki"));
  assert.ok(!refs.some(ref => ref.role === "qui" && ref.nom === "Fizz"));
  assert.ok(refs.some(ref => ref.role === "ou" && ref.nom === "Blanche Of Castille" && ref.id === "blanche"));
  assert.equal(decouper("1. Blanche Of Castille. Rain on the walls.\n2. Enki waits.").length, 2);
});

test("Make it a close-up is framing, Remove the rain changes no structure", () => {
  const structural = new Set(["ajouter", "retirer", "deplacer", "format", "raccourcir"]);
  for (const text of ["Make it a close-up", "Remove the rain", "Make shot 5 a close-up"]) {
    const read = lireDemande(text);
    assert.ok(read.kind !== "correction" || !structural.has(read.correction.type), text);
  }
  assert.equal(lireCorrection("Make it a close-up"), null);
  assert.equal(lireCorrection("Remove the rain"), null);
  assert.equal(lireReglage("Remove the rain", 2), null);
  assert.equal(lireDemande("Make shot 5 a close-up").kind, "correction");
  const close = lireDemande("Make it a close-up");
  assert.equal(close.kind, "toutes");
  if (close.kind === "toutes") assert.equal(close.correction.cadrage, "serre");
  const rain = lireDemande("Remove the rain", 2);
  assert.equal(rain.kind, "note");
  assert.equal(lireDemande("remove shot 3").kind, "correction");
  assert.deepEqual(lireDemande("Add a closing shot"), { kind: "correction", correction: { type: "ajouter", fin: true } });
});

test("a note is undoable data: same shots, same order, words added only", () => {
  const { storyboard } = ecrireDepuisRecit(JD, CTX, opts());
  const before = tousLesPlans(storyboard).map(plan => plan.id);
  const targets = ciblesNote(storyboard, "Remove the rain", null);
  assert.ok(targets.length >= 1);
  const noted = appliquerNote(storyboard, targets, "Remove the rain");
  assert.deepEqual(tousLesPlans(noted).map(plan => plan.id), before);
  assert.ok(tousLesPlans(noted).some(plan => plan.action.includes("Remove the rain")));
  assert.ok(tousLesPlans(noted).every((plan, index) => plan.dialogue.texte === tousLesPlans(storyboard)[index]!.dialogue.texte));
  const sample = lireDemande("Make it a close-up");
  assert.equal(sample.kind, "toutes");
  if (sample.kind !== "toutes") return;
  const framed = appliquerATous(storyboard, sample.correction, null);
  assert.deepEqual(tousLesPlans(framed).map(plan => plan.id), before);
  assert.ok(tousLesPlans(framed).every(plan => plan.cadrage === "serre"));
  const titles = (sb: Storyboard) => tousLesPlans(sb).map(plan => plan.titre);
  assert.deepEqual(titles(framed), titles(storyboard));
});
