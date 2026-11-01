// P0 non-regression (0 crédit): Intention → Storyboard → envoi du plan → prise associée → montage → export.
// Only the pure pieces that exist today; no network, no Comfy call. Generic names only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ecrireStoryboard, type Gabarits } from "../src/lib/storyboard/ecrire.ts";
import { CADRAGES, DUREES_PLAN, etatDuPlan, lireStoryboard, majPlan, progression, storyboardJson, tousLesPlans } from "../src/lib/storyboard/storyboard.ts";
import { finDuPlan, fileVide, planFilmId, suivantDeLaFile, versPlanFilm } from "../src/lib/storyboard/film.ts";
import { ajouterPlan, ajouterPrise, auMontage, garderPrise, lireRegistre, nouveauPlan, priseGardee, refsDuClip, registreJson, registreVide } from "../src/lib/film/registre.ts";
import { chooseExportRoute, exportExtension } from "../src/lib/montage/encode.ts";

const gabarits = (lang: string): Gabarits => JSON.parse(readFileSync(`messages/storyboard/${lang}.json`, "utf8")).storyboard.gabarits;
const CTX = { cast: [{ id: "c-ada", name: "Ada" }, { id: "c-pip", name: "Pip" }], decor: [{ id: "d-port", name: "Harbour" }] };
const NOW = "2026-11-01T03:00:00.000Z";
const write = (idee: string, lang = "en") => ecrireStoryboard(idee, CTX, { dureeCible: 15, format: "paysage", formatChoisi: true, gabarits: gabarits(lang), now: NOW, suffixe: "t1" });

describe("P0 · storyboard écrit : forme de la sortie", () => {
  const ecrit = write("Ada and Pip cross the Harbour at night.");
  const plans = tousLesPlans(ecrit.storyboard);

  it("returns a storyboard, a question slot and the linked/new names", () => {
    assert.deepEqual(Object.keys(ecrit).sort(), ["nouveaux", "question", "repris", "storyboard"]);
    assert.equal(ecrit.question, null, "format chosen and cast known: nothing to ask");
    assert.deepEqual([...ecrit.repris].sort(), ["Ada", "Harbour", "Pip"]);
    assert.deepEqual(ecrit.nouveaux, []);
  });

  it("writes 3 well-formed shots for 15 s", () => {
    assert.equal(plans.length, 3);
    const ids = new Set<string>();
    for (const plan of plans) {
      assert.ok(plan.id && !ids.has(plan.id), "unique shot ids"); ids.add(plan.id);
      assert.ok((DUREES_PLAN as readonly number[]).includes(plan.duree));
      assert.ok(plan.cadrage === null || (CADRAGES as readonly string[]).includes(plan.cadrage));
      assert.equal(plan.format, "paysage");
      assert.equal(plan.planFilmId, null, "nothing sent yet");
      assert.equal(plan.etat, "a-tourner");
      assert.ok(plan.action.trim().length > 0 || plan.titre.trim().length > 0);
    }
  });

  it("links every known character by id, never invents a new identity", () => {
    const qui = plans.flatMap(plan => plan.refs.filter(ref => ref.role === "qui"));
    assert.ok(qui.length > 0);
    for (const ref of qui) assert.ok(CTX.cast.some(card => card.id === ref.id && card.name === ref.nom), ref.nom);
    const ou = plans.flatMap(plan => plan.refs.filter(ref => ref.role === "ou"));
    for (const ref of ou) assert.equal(ref.id, "d-port");
  });

  it("survives a save/load round trip unchanged", () => {
    assert.deepEqual(lireStoryboard(storyboardJson(ecrit.storyboard)), ecrit.storyboard);
  });
});

describe("P0 · plan → prise : le résultat revient sur son plan", () => {
  const sb = write("Ada and Pip cross the Harbour at night.").storyboard;
  const plan = tousLesPlans(sb)[1]!;
  const envoi = versPlanFilm(sb, plan, CTX);

  it("sends the shot with its own cast and place ids and a stable register id", () => {
    assert.equal(envoi.planId, planFilmId(sb, plan));
    assert.equal(envoi.planId, versPlanFilm(sb, plan, CTX).planId, "a retry finds the same id");
    assert.ok(envoi.castIds.every(id => CTX.cast.some(card => card.id === id)));
    assert.equal(new Set(envoi.castIds).size, envoi.castIds.length, "no character sent twice");
    assert.deepEqual(envoi.nouveaux, []);
    assert.ok(envoi.ligne.trim().length > 0);
  });

  it("marks the shot filmed only once its register plan holds a take", () => {
    const linked = majPlan(sb, plan.id, { planFilmId: envoi.planId }, NOW);
    const shot = tousLesPlans(linked).find(item => item.id === plan.id)!;
    let registre = ajouterPlan(registreVide(), { ...nouveauPlan(registreVide(), envoi.planId, envoi.phrase), quiIds: envoi.castIds, ouId: envoi.decorId });
    assert.equal(etatDuPlan(shot, registre), "a-tourner");
    assert.equal(etatDuPlan(shot, registre, envoi.planId), "en-cours");
    registre = ajouterPrise(registre, envoi.planId, { id: "p1", fichier: "Projets/x/Prises/p1.mp4" });
    assert.equal(etatDuPlan(shot, registre), "tourne");
    assert.deepEqual(progression(linked, registre), { tournes: 1, total: 3 });
    // Other shots are untouched: a take never lands on the wrong shot.
    for (const other of tousLesPlans(linked).filter(item => item.id !== plan.id)) assert.equal(etatDuPlan(other, registre), "a-tourner");
  });

  it("keeps the first take, and a new take never overwrites the kept one", () => {
    let registre = ajouterPlan(registreVide(), nouveauPlan(registreVide(), envoi.planId));
    registre = ajouterPrise(registre, envoi.planId, { id: "p1", fichier: "a.mp4" });
    registre = ajouterPrise(registre, envoi.planId, { id: "p2", fichier: "b.mp4" });
    assert.equal(priseGardee(registre.plans[0]!)?.id, "p1");
    registre = garderPrise(registre, envoi.planId, "p2");
    assert.equal(priseGardee(registre.plans[0]!)?.id, "p2");
    assert.equal(registre.plans[0]!.prises.length, 2);
  });

  it("films the queue one shot at a time, never two at once", () => {
    let file = suivantDeLaFile(fileVide(["a", "b"]));
    assert.equal(file.enCours, "a");
    assert.equal(suivantDeLaFile(file), file, "no second take while one runs");
    file = suivantDeLaFile(finDuPlan(file, false));
    assert.deepEqual({ enCours: file.enCours, echecs: file.echecs }, { enCours: "b", echecs: ["a"] });
  });
});

describe("P0 · montage et export", () => {
  it("puts the kept take in the cut once, and the clip finds its references back", () => {
    let registre = registreVide();
    registre = { ...registre, personnages: [{ id: "c-ada", nom: "Ada", refs: [{ sha256: "aa", path: "Projets/x/Cast/ada.png" }], castId: "c-ada", entraine: false }], lieux: [] };
    registre = ajouterPlan(registre, { ...nouveauPlan(registre, "sb-x-1"), quiIds: ["c-ada"] });
    registre = ajouterPrise(registre, "sb-x-1", { id: "p1", fichier: "Projets/x/Prises/p1.mp4" });
    registre = auMontage(registre, "sb-x-1", 5);
    assert.equal(auMontage(registre, "sb-x-1", 5), registre, "added once");
    assert.deepEqual(registre.montage.clips, [{ planId: "sb-x-1", priseId: "p1", in: 0, out: 5 }]);
    const refs = refsDuClip(registre, registre.montage.clips[0]!);
    assert.equal(refs?.prise?.fichier, "Projets/x/Prises/p1.mp4");
    assert.deepEqual(refs?.personnages.map(item => item.id), ["c-ada"]);
    assert.deepEqual(refs?.refs.map(item => item.path), ["Projets/x/Cast/ada.png"]);
    assert.deepEqual(lireRegistre(registreJson(registre)).montage, registre.montage, "the cut survives a reload");
  });

  it("exports MP4 with WebCodecs first, falls back to recording, never a silent dead end", () => {
    assert.deepEqual(chooseExportRoute({ video: "avc", audio: "aac", recorder: [] }), { kind: "webcodecs", video: "avc", audio: "aac", container: "mp4" });
    assert.equal(chooseExportRoute({ video: null, audio: null, recorder: ["video/webm"] }).kind, "recorder");
    assert.equal(chooseExportRoute({ video: "vp9", audio: "opus", recorder: [], strict: true }).kind, "none");
    assert.equal(chooseExportRoute({ video: null, audio: null, recorder: [] }).kind, "none");
    assert.equal(exportExtension(new Blob([], { type: "video/webm" })), "webm");
    assert.equal(exportExtension(new Blob([], { type: "video/mp4" })), "mp4");
  });
});
