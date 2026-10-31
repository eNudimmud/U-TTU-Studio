import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFrontmatter } from "../src/lib/coffre/markdown.ts";
import { vaultPathFromZip } from "../src/lib/coffre/import.ts";
import { ajouterPlan as ajouterPlanFilm, ajouterPrise, nouveauPlan, registreVide } from "../src/lib/film/registre.ts";
import { devisPlan, devisRepliques, devisStoryboard, PROFIL_REPLIQUES } from "../src/lib/storyboard/devis.ts";
import { finDuPlan, fileVide, planFilmId, suivantDeLaFile, versPlanFilm } from "../src/lib/storyboard/film.ts";
import { storyboardMarkdown, type LibellesMd } from "../src/lib/storyboard/markdown.ts";
import { promptCalcule, promptDuPlan } from "../src/lib/storyboard/prompt.ts";
import { appliquerRepliques, lireRepliques, promptRepliques } from "../src/lib/storyboard/repliques.ts";
import { majPlan, planVide, storyboardVide, tousLesPlans, trouverPlan, type Storyboard } from "../src/lib/storyboard/storyboard.ts";

const NOW = "2026-10-31T12:00:00.000Z";
const md = (lang: string): LibellesMd => {
  const sb = JSON.parse(readFileSync(`messages/storyboard/${lang}.json`, "utf8")).storyboard;
  return { ...sb.md, cadrage: sb.sheet.cadrage, camera: sb.sheet.cam, landscape: sb.format.paysage, portrait: sb.format.portrait };
};

function board(): Storyboard {
  const base = storyboardVide({ id: "quai-a1", titre: "Le quai", idee: "Uttu sur le quai", now: NOW });
  return {
    ...base,
    logline: "Uttu sur le quai, la nuit.",
    sequences: [{ id: "s1", titre: "Ouverture", resume: "", plans: [
      { ...planVide("p1"), titre: "Le quai", action: "Le quai sous la pluie.", cadrage: "large", camera: "fixe", refs: [{ role: "ou", nom: "Le quai", id: "quai" }], planFilmId: "sb-quai-a1-p1" },
      { ...planVide("p2"), titre: "Nora", action: "Nora attend Uttu.", cadrage: "moyen", camera: "suit", duree: 8, refs: [{ role: "qui", nom: "Uttu", id: "uttu" }, { role: "qui", nom: "Nora", id: null }, { role: "ou", nom: "La gare", id: null }], dialogue: { type: "replique", qui: "Nora", texte: "Tu es en retard.", source: "idee", propositions: [] } },
      { ...planVide("p3"), titre: "Nora part", action: "Nora part.", cadrage: "serre", camera: "fixe", refs: [{ role: "qui", nom: "Nora", id: null }] },
    ] }],
  };
}

const prix = (s: { seconds: number }) => (s.seconds === 10 ? null : s.seconds === 8 ? 7 : 4);
const CTX = { prixPrise: prix, creation: { personnage: 4, lieu: 3 } };

test("the shot's quote lists the new references first, and a new reference is counted once for the board", () => {
  const p2 = trouverPlan(board(), "p2")!.plan;
  const one = devisPlan(p2, CTX);
  assert.deepEqual(one.etapes.map(step => step.type), ["personnage", "lieu", "prise"]);
  assert.equal(one.total, 4 + 3 + 7);
  const all = devisStoryboard(board(), CTX, null);
  // p1 4, p2 4+3+7, p3 4 (Nora already counted).
  assert.equal(all.total, 4 + 14 + 4);
  assert.equal(all.plans[2]!.etapes.length, 1);
});

test("no quote is never zero: the shot and the board say unavailable", () => {
  const sb = majPlan(board(), "p3", { duree: 10 });
  assert.equal(devisPlan(trouverPlan(sb, "p3")!.plan, CTX).total, null);
  assert.equal(devisStoryboard(sb, CTX, null).total, null);
});

test("filmed shots leave the quote to finish", () => {
  let reg = ajouterPlanFilm(registreVide(), nouveauPlan(registreVide(), "sb-quai-a1-p1"));
  reg = ajouterPrise(reg, "sb-quai-a1-p1", { id: "t1", fichier: "Prises/t1.mp4" });
  assert.equal(devisStoryboard(board(), CTX, reg).plans.length, 2);
});

test("suggesting lines has no price until one call was measured", () => {
  assert.equal(devisRepliques([], 3), null);
  assert.equal(devisRepliques([{ profile: "autre", credits: 2, at: NOW }], 3), null);
  assert.equal(devisRepliques([{ profile: PROFIL_REPLIQUES, credits: 0.8, at: NOW }], 3), 0.8);
});

test("the prompt: framing in English, the action, the camera, the words said, the continuity", () => {
  const p2 = trouverPlan(board(), "p2")!.plan;
  assert.equal(promptCalcule(p2), 'Medium shot. Nora attend Uttu. The camera follows the character. The character says: "Tu es en retard."');
  assert.match(promptCalcule({ ...p2, raccord: true }), /same light/i);
  assert.equal(promptDuPlan({ ...p2, promptManuel: "  Mon prompt  " }), "Mon prompt");
});

test("the Markdown note links cards and the kept take, never copies media", () => {
  let reg = ajouterPlanFilm(registreVide(), nouveauPlan(registreVide(), "sb-quai-a1-p1"));
  reg = ajouterPrise(reg, "sb-quai-a1-p1", { id: "t1", fichier: "Projets/p/Prises/t1.mp4" });
  const text = storyboardMarkdown(board(), {
    projet: "p",
    registre: reg,
    lienRef: ref => ref.id === "quai" ? "Projets/p/Lieux/quai" : ref.id === "uttu" ? "Projets/p/Cast/uttu" : null,
    prise: () => ({ note: "Projets/p/Prises/t1", image: "Projets/p/Prises/t1.png", id: "t1" }),
    devis: plan => devisPlan(plan, CTX).total,
    devisRestant: 22,
    date: NOW,
    credits: n => `≈ ${n} crédits estimés`,
  }, md("fr"));
  const { fields, body } = readFrontmatter(text);
  assert.equal(fields.type, "storyboard");
  assert.equal(fields.plans, 3);
  assert.equal(fields.tournes, 1);
  assert.match(body, /\[\[Projets\/p\/Lieux\/quai\|Le quai\]\]/);
  assert.match(body, /\[\[Projets\/p\/Cast\/uttu\|Uttu\]\]/);
  assert.match(body, /Nora \*\(nouveau · sera créé\)\*/);
  assert.match(body, /!\[\[Projets\/p\/Prises\/t1\.png\]\]/);
  assert.match(body, /« Tu es en retard\. »/);
  assert.match(body, /≈ 14 crédits estimés/);
  assert.doesNotMatch(body, /gratuit|\bcr\./i);
});

test("the vault import keeps Storyboard notes", () => {
  assert.equal(vaultPathFromZip("Projets/p/Storyboard/quai-a1.md"), "Projets/p/Storyboard/quai-a1.md");
  assert.equal(vaultPathFromZip("Projets/p/.uttu/sb-quai-a1.json"), "Projets/p/.uttu/sb-quai-a1.json");
});

test("a storyboard shot goes to film2 with its references, its prompt and its settings", () => {
  const sb = board();
  const envoi = versPlanFilm(sb, trouverPlan(sb, "p2")!.plan, { cast: [{ id: "uttu", name: "Uttu" }], decor: [{ id: "gare", name: "la gare" }] });
  assert.equal(envoi.planId, planFilmId(sb, { id: "p2" }));
  assert.deepEqual(envoi.castIds, ["uttu"]);
  assert.deepEqual(envoi.nouveaux, [{ nom: "Nora" }]);
  assert.equal(envoi.decorId, "gare", "a place made by an earlier shot is linked, not made again");
  assert.equal(envoi.nouveauLieu, null);
  assert.equal(envoi.settings.seconds, 8);
  assert.equal(envoi.settings.engine, "h3");
  assert.match(envoi.ligne, /^Medium shot\./);
});

test("film N shots: one after the other, a running take is never replaced", () => {
  let file = suivantDeLaFile(fileVide(["p1", "p2", "p3"]));
  assert.equal(file.enCours, "p1");
  assert.equal(suivantDeLaFile(file), file, "the next waits");
  file = suivantDeLaFile(finDuPlan(file, false));
  assert.equal(file.enCours, "p2");
  file = suivantDeLaFile(finDuPlan(file, true));
  file = finDuPlan(file, true);
  assert.deepEqual([file.faits, file.echecs, file.restants, file.enCours], [["p2", "p3"], ["p1"], [], null]);
});

test("lines from the text model: tolerant, short, only the project's names, the visitor's text kept", () => {
  const sb = board();
  const demande = promptRepliques(sb, "fr");
  assert.deepEqual(demande.plans, ["p2", "p3"]);
  assert.match(demande.system, /Only these characters exist: Uttu, Nora/);
  const answer = `Voici : {"shots":[{"id":"p2","lines":["Tu es en retard, Bob.","${"x".repeat(300)}","Tu es en retard, Bob."]},{"id":"p9","lines":["?"]},{"id":"p3","lines":[42,"Adieu."]}]} fin`;
  const lines = lireRepliques(answer, demande.plans, ["Uttu", "Nora"], ["Bob"]);
  assert.deepEqual(lines.get("p2")?.[0], "Tu es en retard.");
  assert.equal(lines.get("p2")?.[1]?.length, 160);
  assert.equal(lines.get("p2")?.length, 2);
  assert.equal(lines.has("p9"), false);
  assert.deepEqual(lines.get("p3"), ["Adieu."]);
  assert.equal(lireRepliques("not json", demande.plans, []).size, 0);
  const next = appliquerRepliques(sb, lines);
  assert.equal(trouverPlan(next, "p2")!.plan.dialogue.texte, "Tu es en retard.", "the idea's line stays");
  assert.equal(trouverPlan(next, "p3")!.plan.dialogue.type, "replique");
  assert.equal(trouverPlan(next, "p3")!.plan.dialogue.texte, "");
  assert.deepEqual(trouverPlan(next, "p3")!.plan.dialogue.propositions, ["Adieu."]);
  assert.equal(tousLesPlans(next).length, 3);
});
