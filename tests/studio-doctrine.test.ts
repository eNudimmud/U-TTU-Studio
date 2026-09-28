import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  BUDGET_ANON, BUDGET_EMPTY, BUDGET_LOCAL, EMPTY_JOURNAL, addBudgetLine, journalIsEmpty, parseJournal, removeBudgetLine, serializeJournal,
} from "../src/lib/budget.ts";
import {
  BURN_WARN, CONTINUITY_TIP, DOCTRINE_CHECKS, MUSIC_NOTE, SCENE_ANGLE_REMINDER, SCENE_FICHES, SCENE_VAULT, VIDEO_BURN_NOTE,
  admitBurn, burnNeedsConfirm, canonChecklist, lookHeld,
} from "../src/lib/doctrine.ts";
import { CREATION_PROCESSES, processShareId } from "../src/lib/processes.ts";
import { SPHERE_PRESETS } from "../src/lib/studio-modes.ts";

const open = { refCount: 0, trigger: "", invariants: "", canonNoted: false };
const held = { refCount: 2, trigger: "mira_v1", invariants: "green eyes, freckles", canonNoted: true };

describe("canon avant le burn", () => {
  it("lists angles, trigger, invariants and CANON.md", () => {
    assert.deepEqual(DOCTRINE_CHECKS.map(check => check.id), ["angles", "trigger", "invariants", "canon"]);
    assert.deepEqual(canonChecklist(open).map(mark => mark.held), [false, false, false, false]);
    assert.equal(lookHeld(open), false);
    assert.equal(lookHeld(held), true);
    assert.equal(lookHeld({ ...held, refCount: 1 }), false);
    assert.equal(lookHeld({ ...held, trigger: "woman" }), false);
    assert.equal(lookHeld({ ...held, invariants: "green eyes" }), false);
    assert.equal(lookHeld({ ...held, canonNoted: false }), false);
  });

  it("warns on a costly burn and leaves stills open", () => {
    assert.equal(burnNeedsConfirm("still", false), false);
    assert.equal(burnNeedsConfirm("still", true), false);
    assert.equal(burnNeedsConfirm("train", false), true);
    assert.equal(burnNeedsConfirm("video", false), true);
    assert.equal(burnNeedsConfirm("train", true), false);
    assert.equal(admitBurn("still", false, false), true);
    assert.equal(admitBurn("train", false, false), false);
    assert.equal(admitBurn("train", false, true), true);
    assert.equal(admitBurn("video", false, true), true);
    assert.equal(admitBurn("train", true, false), true);
    assert.match(BURN_WARN, /entraînement/);
    assert.match(BURN_WARN, /vidéo/);
    assert.match(MUSIC_NOTE, /musique/);
    assert.doesNotMatch(`${BURN_WARN} ${MUSIC_NOTE}`, /https?:|share=|stripe/i);
  });
});

describe("fiches de lieu", () => {
  it("covers Avant, Après and Entre, with four angles and scenes/", () => {
    assert.deepEqual(SCENE_FICHES.map(fiche => fiche.id), SPHERE_PRESETS.map(preset => preset.id));
    assert.deepEqual(SCENE_FICHES.map(fiche => fiche.title), ["Avant", "Après", "Entre deux images"]);
    assert.equal(SCENE_ANGLE_REMINDER.length, 4);
    for (const fiche of SCENE_FICHES) {
      assert.equal(fiche.vault, SCENE_VAULT);
      assert.equal(fiche.vault, "scenes/");
      assert.deepEqual([...fiche.angles], [...SCENE_ANGLE_REMINDER]);
      assert.match(fiche.spatial, /gauche/);
      assert.match(fiche.spatial, /droite/);
      assert.equal(fiche.video, VIDEO_BURN_NOTE);
    }
    assert.match(CONTINUITY_TIP, /[Pp]rolonger/);
    assert.match(VIDEO_BURN_NOTE, /Bientôt/);
    const entre = CREATION_PROCESSES.find(process => process.id === "entre");
    assert.equal(entre?.state, "gap");
    assert.equal(processShareId(entre!), null);
    assert.equal(CREATION_PROCESSES.filter(process => process.appUrl).length, 2);
    const copy = `${CONTINUITY_TIP} ${VIDEO_BURN_NOTE} ${SCENE_FICHES.map(fiche => fiche.spatial).join(" ")}`;
    assert.doesNotMatch(copy, /share=|cloud\.comfy\.org|fal\.ai/);
  });
});

describe("budget local", () => {
  it("stays empty until a person writes a line, and never keeps a balance", () => {
    assert.equal(journalIsEmpty(EMPTY_JOURNAL), true);
    assert.equal(journalIsEmpty(parseJournal(null)), true);
    assert.equal(journalIsEmpty(parseJournal("not json")), true);
    assert.equal(journalIsEmpty(parseJournal(JSON.stringify({ balance: 500, credits: 12 }))), true);
    assert.equal(journalIsEmpty(parseJournal(JSON.stringify({ lines: [{ id: "x", gesture: "  ", estimate: "9" }] }))), true);
    const noted = addBudgetLine(EMPTY_JOURNAL, " Tester un prompt ", " à ta main ", "2026-09-28", "line-1");
    assert.deepEqual(noted.lines, [{ id: "line-1", label: "Tester un prompt", estimate: "à ta main", date: "2026-09-28" }]);
    assert.equal(journalIsEmpty(parseJournal(serializeJournal(noted))), false);
    assert.equal(journalIsEmpty(removeBudgetLine(noted, "line-1")), true);
    assert.equal(addBudgetLine(EMPTY_JOURNAL, "   ", "9", "2026-09-28", "line-2"), EMPTY_JOURNAL);
    assert.match(BUDGET_EMPTY, /Aucun run/);
    assert.match(BUDGET_ANON, /Créer/);
    assert.match(BUDGET_LOCAL, /Pas un solde/);
    assert.doesNotMatch(`${BUDGET_EMPTY} ${BUDGET_ANON} ${BUDGET_LOCAL}`, /stripe|fal\.ai|pk_|sk_/i);
  });
});

describe("doctrine dans les panneaux", () => {
  const create = readFileSync("src/components/studio/create-view.tsx", "utf8");
  const identity = readFileSync("src/components/studio/identity-panel.tsx", "utf8");
  const sphere = readFileSync("src/components/studio/sphere-panel.tsx", "utf8");
  const fiches = readFileSync("src/components/studio/scene-fiches.tsx", "utf8");
  const account = readFileSync("src/components/studio/account-panel.tsx", "utf8");
  const journal = readFileSync("src/components/studio/budget-journal.tsx", "utf8");
  const rail = readFileSync("src/components/guide/fal-rail.tsx", "utf8");

  it("shows the canon and the cheap test on Créer, without a wall", () => {
    assert.match(create, /DoctrineBurn/);
    assert.match(create, /former-access/);
    assert.match(create, /launch\.request\(former\.id\)/);
    assert.match(create, /launch\.request\(tester\.id\)/);
    assert.match(create, /go\("sphere"\)/);
    assert.match(create, /admitBurn\("train"/);
    assert.match(create, /BURN_CONFIRM_LABEL/);
    assert.doesNotMatch(create, /@clerk\/nextjs|\/sign-in/);
    assert.match(identity, /DoctrineBurn/);
    assert.match(identity, /armTrain=\{!held\}/);
    assert.match(rail, /armTrain/);
    assert.match(rail, /BURN_CONFIRM_LABEL/);
    assert.match(rail, /Générer la grille/);
  });

  it("puts scene sheets on Sphère and a local budget on Compte", () => {
    assert.match(sphere, /SceneFiches/);
    assert.match(sphere, /ProcessCard/);
    assert.match(fiches, /fiche\.vault/);
    assert.match(fiches, /À gauche/);
    assert.match(fiches, /À droite/);
    assert.match(fiches, /Bientôt/);
    assert.match(fiches, /onOpenEntre/);
    assert.match(fiches, /processAction/);
    assert.match(fiches, /state === "live"/);
    assert.doesNotMatch(fiches, /share=|cloud\.comfy\.org|fetch\(/);
    assert.match(account, /Budget/);
    assert.match(account, /Tes runs/);
    assert.match(account, /Ton studio cloud/);
    assert.match(account, /Hors ligne/);
    assert.match(account, /sans compte/);
    assert.match(account, /BUDGET_ANON/);
    assert.match(account, /userId=\{user\.id\}/);
    assert.match(account, /BudgetJournal userId=\{userId\}/);
    assert.match(journal, /BUDGET_EMPTY/);
    assert.match(journal, /localStorage/);
    assert.match(journal, /journalMarkdown/);
    assert.match(journal, /BUDGET_EXPORT_FILE/);
    assert.doesNotMatch(journal, /u-ttu-budget"/);
    assert.doesNotMatch(`${account}\n${journal}`, /fetch\(|XMLHttpRequest|stripe|fal\.ai|balance/i);
  });
});
