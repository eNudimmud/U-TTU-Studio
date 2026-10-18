import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanPath } from "../src/lib/coffre/store.ts";
import { activeState, bindCards, emptyMemory, changeState, inherit, memoryJson, memoryMarkdown, migrateMemory, parseMemory, shotCode, syncShots } from "../src/lib/memoire/model.ts";

const PLANS = [{ id: "plan-01", action: "Léa entre dans le laboratoire" }, { id: "plan-02", action: "Léa traverse le labo" }, { id: "plan-03", action: "Léa sort" }];

// Neutral fixture project, test code only: nothing is seeded in the app.
function project() {
  const memory = syncShots(emptyMemory("Projet test"), PLANS);
  memory.characters = [{ id: "perso-lea", name: "Léa", aliases: ["L*ÉA"], identity: "", refs: [], castId: null }];
  memory.environments = [{ id: "lieu-laboratoire", name: "Le laboratoire", aliases: ["labo"], note: "", refs: [], decorId: null }];
  return bindCards(memory, [{ id: "cast-lea", name: "Lea", sheet: "Projets/test/Cast/lea.webp" }], [{ id: "lab-1", name: "Le laboratoire" }]);
}

describe("P1 · mémoire de production", () => {
  it("plans numérotés A-01… dans l’ordre de PRISE", () => {
    const memory = project();
    assert.deepEqual(PLANS.map(plan => shotCode(memory, plan.id)), ["A-01", "A-02", "A-03"]);
  });

  it("les cartes CAST se lient par nom ou alias", () => {
    const memory = project();
    assert.equal(memory.characters.find(item => item.name === "Léa")?.castId, "cast-lea");
    assert.equal(memory.environments.find(item => item.name === "Le laboratoire")?.decorId, "lab-1");
  });

  it("3 plans : 2 et 3 héritent de la tenue de chasseur, le 3 la change", () => {
    let memory = project();
    memory = changeState(memory, "perso-lea", "plan-01", "tenue de chasseur", "2026-10-17T20:01:00.000Z");
    const who = [{ id: "cast-lea", name: "Lea" }];
    assert.equal(inherit(memory, "plan-02", who)[0].state?.label, "tenue de chasseur");
    assert.equal(inherit(memory, "plan-02", who)[0].state?.fromCode, "A-01");
    assert.equal(inherit(memory, "plan-03", who)[0].state?.label, "tenue de chasseur");
    memory = changeState(memory, "perso-lea", "plan-03", "combinaison de labo", "2026-10-17T20:02:00.000Z");
    assert.equal(inherit(memory, "plan-02", who)[0].state?.label, "tenue de chasseur");
    const third = inherit(memory, "plan-03", who)[0];
    assert.equal(third.state?.label, "combinaison de labo");
    assert.equal(third.startsHere, true);
    assert.equal(third.state?.fromCode, "A-03");
    assert.equal(memory.history.filter(event => event.kind === "etat").length, 2);
  });

  it("un état suit son plan quand le storyboard est réordonné", () => {
    let memory = project();
    memory = changeState(memory, "perso-lea", "plan-02", "blessé", "t");
    assert.equal(activeState(memory, "perso-lea", "plan-01"), null);
    memory = syncShots(memory, [PLANS[1], PLANS[0], PLANS[2]]);
    assert.equal(activeState(memory, "perso-lea", "plan-01")?.label, "blessé");
  });

  it("changer l’état au même plan le remplace, vide le retire", () => {
    let memory = project();
    memory = changeState(memory, "perso-lea", "plan-01", "tenue A", "t");
    memory = changeState(memory, "perso-lea", "plan-01", "tenue B", "t");
    assert.equal(memory.states.length, 1);
    memory = changeState(memory, "perso-lea", "plan-01", "", "t");
    assert.equal(memory.states.length, 0);
  });

  it("JSON aller-retour, entrée abîmée ignorée", () => {
    const memory = changeState(project(), "perso-lea", "plan-01", "tenue de chasseur", "t");
    assert.deepEqual(parseMemory(memoryJson(memory)), memory);
    assert.equal(parseMemory("{oops"), null);
    assert.equal(parseMemory(JSON.stringify({ characters: [{ name: 3 }], states: [{}] }))?.characters.length, 0);
  });

  it("migration d’un projet existant : CAST, DÉCOR, plans ; rien d’inventé", () => {
    const memory = migrateMemory({ title: "Mon film", cast: [{ id: "c1", name: "Lina", sheet: "Projets/m/Cast/lina.webp" }], decor: [{ id: "d1", name: "Le quai", stills: ["Projets/m/Decors/q.webp"] }], plans: PLANS.slice(0, 2) });
    assert.deepEqual(memory.characters.map(item => [item.name, item.castId, item.identity]), [["Lina", "c1", ""]]);
    assert.equal(memory.environments[0].decorId, "d1");
    assert.equal(memory.sequences[0].shots.length, 2);
    assert.equal(memory.states.length, 0);
  });

  it("export Obsidian : canon, personnages avec états, séquences, historique", () => {
    const memory = changeState(project(), "perso-lea", "plan-01", "tenue de chasseur", "2026-10-17T20:01:00.000Z");
    const files = memoryMarkdown(memory, "projet-test");
    const lea = files.find(file => file.file === "Memoire/Personnage-lea.md");
    assert.ok(lea?.text.includes("- depuis A-01 : tenue de chasseur"));
    assert.ok(files.some(file => file.file === "Memoire/Canon.md"));
    // Every note fits the vault's path rule (4 segments max) under its project.
    for (const file of files) assert.ok(cleanPath(`Projets/projet-test/${file.file}`), file.file);
    assert.ok(files.some(file => file.file === "Memoire/Sequences.md" && file.text.includes("## Séquence F")));
    assert.ok(files.some(file => file.file === "Memoire/Historique.md" && file.text.includes("tenue de chasseur")));
  });
});
