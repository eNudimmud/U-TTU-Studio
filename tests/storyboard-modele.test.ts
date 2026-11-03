import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ajouterPlan, archiver, changerFormat, cheminJson, cheminMarkdown, choisirProposition, deplacerPlan, dureeTotale, ecrireReplique,
  etatDuPlan, filtrer, idDuChemin, lireStoryboard, majPlan, nouvelId, planVide, progression, refsPropres, retirerPlan,
  storyboardJson, storyboardVide, tousLesPlans, trouverPlan, type Storyboard,
} from "../src/lib/storyboard/storyboard.ts";
import { storyboardActif, cookieDemande, lireCookie, STORYBOARD_COOKIE } from "../src/lib/storyboard/drapeau.ts";
import { ajouterPlan as ajouterPlanFilm, ajouterPrise, nouveauPlan, registreVide } from "../src/lib/film/registre.ts";

const NOW = "2026-10-31T12:00:00.000Z";

function sb(): Storyboard {
  const base = storyboardVide({ id: "quai-x1", titre: "Le quai", idee: "Uttu marche sur le quai", now: NOW });
  return {
    ...base,
    sequences: [
      { id: "s1", titre: "Un", resume: "", plans: [{ ...planVide("p1"), action: "A", duree: 5 }, { ...planVide("p2"), action: "B", duree: 8 }] },
      { id: "s2", titre: "Deux", resume: "", plans: [{ ...planVide("p3"), action: "C", duree: 10 }] },
    ],
  };
}

test("paths stay inside the project: one Markdown note and one hidden JSON per storyboard", () => {
  const id = nouvelId("Un DJ traverse la ville !", "k2");
  assert.match(id, /^[a-z0-9-]+$/);
  assert.equal(cheminJson(id), `.uttu/sb-${id}.json`);
  assert.equal(cheminMarkdown(id), `Storyboard/${id}.md`);
  assert.equal(idDuChemin(cheminJson(id)), id);
  assert.equal(idDuChemin(".uttu/registre-plans.json"), null);
  // Vault segments: ≤ 4 and each matching the store's rule.
  for (const path of [`Projets/p/${cheminMarkdown(id)}`, `Projets/p/${cheminJson(id)}`]) {
    const parts = path.split("/");
    assert.ok(parts.length <= 4, path);
    for (const part of parts) assert.match(part, /^[._]?[A-Za-z0-9][A-Za-z0-9._ -]{0,80}$/, part);
  }
});

test("a storyboard reads back as written, and a broken file is null, never thrown", () => {
  const board = sb();
  assert.deepEqual(lireStoryboard(storyboardJson(board)), board);
  assert.equal(lireStoryboard("{nope"), null);
  assert.equal(lireStoryboard(null), null);
  assert.equal(lireStoryboard(JSON.stringify({ hello: 1 })), null);
  // Unknown lengths fall back to 5 s; text is clipped.
  const raw = JSON.parse(storyboardJson(board));
  raw.sequences[0].plans[0].duree = 3;
  raw.sequences[0].plans[0].action = "x".repeat(900);
  const read = lireStoryboard(JSON.stringify(raw))!;
  assert.equal(read.sequences[0].plans[0].duree, 5);
  assert.ok(read.sequences[0].plans[0].action.length <= 240);
});

test("references: three characters, one place, seven in all, no double", () => {
  const refs = refsPropres([
    { role: "qui", nom: "A", id: "a" }, { role: "qui", nom: "a", id: null }, { role: "qui", nom: "B", id: null },
    { role: "qui", nom: "C", id: null }, { role: "qui", nom: "D", id: null },
    { role: "ou", nom: "L1", id: null }, { role: "ou", nom: "L2", id: null },
    ...["o1", "o2", "o3", "o4", "o5"].map(nom => ({ role: "objet" as const, nom, id: null })),
  ]);
  assert.equal(refs.filter(ref => ref.role === "qui").length, 3);
  assert.equal(refs.filter(ref => ref.role === "ou").length, 1);
  assert.equal(refs.length, 7);
});

test("add, move across scenes, remove: numbering follows the board", () => {
  let board = sb();
  board = ajouterPlan(board, "s1", planVide("p4"), "p1", NOW);
  assert.deepEqual(tousLesPlans(board).map(plan => plan.id), ["p1", "p4", "p2", "p3"]);
  board = deplacerPlan(board, "p2", 1, NOW);
  assert.deepEqual(board.sequences.map(seq => seq.plans.map(plan => plan.id)), [["p1", "p4"], ["p2", "p3"]]);
  board = deplacerPlan(board, "p1", -1, NOW);
  assert.deepEqual(tousLesPlans(board).map(plan => plan.id), ["p1", "p4", "p2", "p3"], "first shot stays first");
  assert.equal(trouverPlan(board, "p3")?.numero, 4);
  board = retirerPlan(board, "p4", NOW);
  assert.deepEqual(tousLesPlans(board).map(plan => plan.id), ["p1", "p2", "p3"]);
  assert.equal(dureeTotale(board), 23);
});

test("a line typed by the visitor is theirs; picking another proposal costs no call", () => {
  let board = majPlan(sb(), "p2", { dialogue: { type: "replique", qui: "Uttu", texte: "Un", source: "uttu", propositions: ["Un", "Deux"] } });
  board = choisirProposition(board, "p2", 1);
  assert.equal(trouverPlan(board, "p2")!.plan.dialogue.texte, "Deux");
  board = ecrireReplique(board, "p2", "Le mien");
  assert.equal(trouverPlan(board, "p2")!.plan.dialogue.source, "visiteur");
  assert.ok(trouverPlan(board, "p2")!.plan.dialogue.texte.length <= 160);
});

test("a shot is filmed when the register keeps a take for it", () => {
  let board = majPlan(sb(), "p1", { planFilmId: "sb-quai-x1-p1" });
  let reg = ajouterPlanFilm(registreVide(), nouveauPlan(registreVide(), "sb-quai-x1-p1"));
  assert.equal(etatDuPlan(trouverPlan(board, "p1")!.plan, reg), "a-tourner");
  reg = ajouterPrise(reg, "sb-quai-x1-p1", { id: "t1", fichier: "Prises/t1.mp4" });
  assert.equal(etatDuPlan(trouverPlan(board, "p1")!.plan, reg), "tourne");
  assert.deepEqual(progression(board, reg), { tournes: 1, total: 3 });
  board = changerFormat(board, "portrait", reg, NOW);
  assert.equal(trouverPlan(board, "p1")!.plan.format, "paysage", "a filmed shot keeps its format");
  assert.equal(trouverPlan(board, "p2")!.plan.format, "portrait");
});

test("filters: in progress, filmed, archived", () => {
  const a = sb();
  const b = archiver({ ...sb(), id: "b" }, true, NOW);
  assert.deepEqual(filtrer([a, b], "tous", null).map(item => item.id), ["quai-x1"]);
  assert.deepEqual(filtrer([a, b], "archives", null).map(item => item.id), ["b"]);
  assert.deepEqual(filtrer([a, b], "tournes", null), []);
});

test("open to everyone (SB11): on by default, ?storyboard=0 turns it off for this device, ?storyboard=1 back on", () => {
  assert.equal(storyboardActif("", null), true);
  assert.equal(storyboardActif("", "1"), true);
  assert.equal(storyboardActif("?storyboard=0", null), false);
  assert.equal(storyboardActif("", "0"), false);
  assert.equal(storyboardActif("?storyboard=1", "0"), true);
  assert.equal(lireCookie(`a=b; ${STORYBOARD_COOKIE}=0`), "0");
  assert.match(cookieDemande("?storyboard=0") ?? "", new RegExp(`^${STORYBOARD_COOKIE}=0`));
  assert.match(cookieDemande("?storyboard=1") ?? "", /Max-Age=0/i);
  assert.equal(cookieDemande("?x=1"), null);
});
