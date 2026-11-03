import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appliquerCorrection, lireCorrection, lireReglage } from "../src/lib/storyboard/corriger.ts";
import { ecrireStoryboard, lieuEcrit } from "../src/lib/storyboard/ecrire.ts";
import { lieuDeLaPhrase } from "../src/lib/film/comprendre.ts";
import { tousLesPlans } from "../src/lib/storyboard/storyboard.ts";

const g = JSON.parse(readFileSync(new URL("../messages/storyboard/en.json", import.meta.url), "utf8")).storyboard.gabarits;
const idea = "Ana and Bo meet at night in Rose Of Avalon; Ana hands Bo a glowing thread while rain falls outside.";
const write = (ctx: Parameters<typeof ecrireStoryboard>[1]) =>
  ecrireStoryboard(idea, ctx, { dureeCible: 30, format: "paysage", formatChoisi: true, gabarits: g, now: "2026-11-01T00:00:00Z", suffixe: "t" });

test("a capitalised place name keeps all its words and its linking word", () => {
  assert.equal(lieuDeLaPhrase(idea), "Rose Of Avalon");
  assert.equal(lieuDeLaPhrase("They meet in Notre-Dame de Paris at dawn"), "Notre-Dame de Paris");
  assert.equal(lieuDeLaPhrase("Uttu walks on the pier at night"), "The pier");
});

test("a DÉCOR card or named place written without @ is the place, never a character", () => {
  assert.equal(lieuEcrit(idea, [{ id: "d1", name: "rose of avalon" }])?.id, "d1");
  assert.equal(lieuEcrit("A rosebud", [{ id: "d1", name: "Rose" }]), null);
  const named = write({ cast: [{ id: "a", name: "Ana" }], decor: [], lieuxNommes: ["Rose of Avalon"] });
  const first = tousLesPlans(named.storyboard)[0]!;
  assert.deepEqual(first.refs.map(ref => [ref.role, ref.nom]), [["ou", "Rose of Avalon"]]);
  assert.ok(!named.storyboard.sequences.flatMap(seq => seq.plans).some(plan => plan.refs.some(ref => ref.role === "qui" && /rose|avalon/i.test(ref.nom))));
  const card = write({ cast: [{ id: "a", name: "Ana" }], decor: [{ id: "d1", name: "Rose of Avalon" }] });
  assert.ok(card.repris.includes("Rose of Avalon"));
});

test("camera, framing and mood words for the selected shot are written into it, nothing else changes", () => {
  const text = "Make it more dramatic: low camera, slow push-in, rain on the stained glass.`";
  assert.equal(lireCorrection(text, 1), null);
  const c = lireReglage(text, 1);
  assert.deepEqual(c, { type: "reglage", n: 1, camera: "approche", cadrage: null, note: "More dramatic: low camera, slow push-in, rain on the stained glass" });
  const sb = write({ cast: [], decor: [] }).storyboard;
  const done = appliquerCorrection(sb, c!, null, "x")!;
  const [before, after] = [tousLesPlans(sb)[0]!, tousLesPlans(done.sb)[0]!];
  assert.equal(after.camera, "approche");
  assert.equal(after.cadrage, before.cadrage);
  assert.ok(after.action.endsWith("More dramatic: low camera, slow push-in, rain on the stained glass."));
  assert.deepEqual(tousLesPlans(done.sb).slice(1), tousLesPlans(sb).slice(1));
  assert.equal(lireReglage("shot 3: close-up, handheld")?.type, "reglage");
  assert.equal((lireReglage("shot 3: close-up, handheld") as { cadrage: string }).cadrage, "serre");
  assert.equal(lireReglage("Make it more dramatic"), null, "no shot: not applied locally");
  assert.equal(lireReglage("hello there", 2), null);
});
