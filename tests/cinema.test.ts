import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CINEMA_PATH, CINEMA_STEPS, LOOK_HELD_LINE, LOOK_OPEN_LINE, PLATEAU_EMPTY_LINE, PLATEAU_EMPTY_TITLE, PLATEAU_HELP,
  TAKE_CHAIN, TAKE_HELP, TAKE_LEAD, TAKE_SOON_LINE, TAKE_WAIT, placeFromLocation, takeReady,
} from "../src/lib/cinema.ts";
import {
  PLATEAU_FRAME_MAX, createPlateauScene, parsePlateau, parseTakeNote, readPlateau, readTakeNote, readyWorlds,
  savePlateau, saveTakeNote, serializePlateau, worldReady,
} from "../src/lib/plateau.ts";

const JARGON = /\b(seedance|comfy|fal|lora|flux|blender|night city)\b/i;

function memory() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
}

describe("shell Look Plateau Take", () => {
  it("opens on Ton style and keeps Clerk hashes", () => {
    assert.deepEqual(CINEMA_STEPS.map(step => step.plain), ["Ton style", "Ta scène", "La prise"]);
    assert.deepEqual(CINEMA_STEPS.map(step => step.name), ["Look", "Plateau", "Take"]);
    assert.deepEqual(placeFromLocation(""), { kind: "cinema", step: "look" });
    assert.deepEqual(placeFromLocation("#"), { kind: "cinema", step: "look" });
    assert.deepEqual(placeFromLocation("", "?step=look"), { kind: "cinema", step: "look" });
    assert.deepEqual(placeFromLocation("", "step=plateau"), { kind: "cinema", step: "plateau" });
    assert.deepEqual(placeFromLocation("", "?step=prise"), { kind: "cinema", step: "take" });
    assert.deepEqual(placeFromLocation("#creer"), { kind: "cinema", step: "look" });
    assert.deepEqual(placeFromLocation("#LOOK"), { kind: "cinema", step: "look" });
    assert.deepEqual(placeFromLocation("#scène"), { kind: "cinema", step: "plateau" });
    assert.deepEqual(placeFromLocation("#monde"), { kind: "cinema", step: "plateau" });
    assert.deepEqual(placeFromLocation("#prise"), { kind: "cinema", step: "take" });
    assert.deepEqual(placeFromLocation("#compte"), { kind: "atelier", mode: "compte" });
    assert.deepEqual(placeFromLocation("#sphère"), { kind: "atelier", mode: "sphere" });
    assert.deepEqual(placeFromLocation("#identité"), { kind: "atelier", mode: "identite" });
    assert.deepEqual(placeFromLocation("#bibliothèque&suite"), { kind: "atelier", mode: "bibliotheque" });
    assert.deepEqual(placeFromLocation("#studio?x=1"), { kind: "atelier", mode: "studio" });
    assert.deepEqual(placeFromLocation("#compte", "?step=look"), { kind: "atelier", mode: "compte" });
    assert.deepEqual(placeFromLocation("#inconnu"), { kind: "cinema", step: "look" });
  });

  it("tells the world path in plain French and parks engine names in the help", () => {
    const primary = [
      CINEMA_PATH,
      ...CINEMA_STEPS.flatMap(step => [step.plain, step.name, step.line]),
      ...TAKE_CHAIN.flatMap(step => [step.title, step.line]),
      LOOK_HELD_LINE,
      LOOK_OPEN_LINE,
      PLATEAU_EMPTY_TITLE,
      PLATEAU_EMPTY_LINE,
      TAKE_LEAD,
      TAKE_SOON_LINE,
      TAKE_WAIT,
    ].join("\n");
    assert.match(CINEMA_PATH, /monde/);
    assert.match(CINEMA_PATH, /look tenu/);
    assert.match(CINEMA_PATH, /prise courte/);
    assert.match(TAKE_LEAD, /préviz/);
    assert.match(TAKE_LEAD, /texte seul/);
    assert.match(PLATEAU_EMPTY_TITLE, /monde/);
    assert.doesNotMatch(primary, JARGON);
    assert.match(PLATEAU_HELP, /Blender/);
    assert.match(PLATEAU_HELP, /\.blend/);
    assert.match(TAKE_HELP, /Seedance/);
    assert.match(TAKE_HELP, /R2V/);
    assert.match(TAKE_HELP, /échange de personnage/);
    assert.match(TAKE_HELP, /n’est pas branché/);
    assert.doesNotMatch(`${PLATEAU_HELP}\n${TAKE_HELP}`, /night city/i);
  });

  it("opens a take only when the world is posed and the look is held", () => {
    assert.equal(takeReady({ lookHeld: false, worldReady: false }), false);
    assert.equal(takeReady({ lookHeld: true, worldReady: false }), false);
    assert.equal(takeReady({ lookHeld: false, worldReady: true }), false);
    assert.equal(takeReady({ lookHeld: true, worldReady: true }), true);
    assert.deepEqual(TAKE_CHAIN.map(step => step.id), ["monde", "look", "prise"]);
  });
});

describe("monde sur cet appareil", () => {
  it("keeps a named place, notes, stills and plate names, and nothing without a name", () => {
    assert.equal(createPlateauScene("   ", "lieu-1"), null);
    const scene = createPlateauScene("  Quai, nuit  ", "lieu-1");
    assert.ok(scene);
    assert.equal(scene?.name, "Quai, nuit");
    assert.equal(worldReady({ scenes: [scene!] }), false);
    const noted = { ...scene!, note: "pluie fine" };
    const still = { ...scene!, stills: [{ id: "s1", name: "plate.png", note: "large" }] };
    const sequence = {
      ...scene!,
      sequences: [{ id: "q1", name: "travelling", note: "lent", frames: ["a.png", "b.png"] }],
    };
    assert.equal(worldReady({ scenes: [noted] }), true);
    assert.equal(worldReady({ scenes: [still] }), true);
    assert.equal(worldReady({ scenes: [sequence] }), true);
    assert.equal(worldReady({ scenes: [{ ...noted, name: "" }] }), false);
    const frames = Array.from({ length: PLATEAU_FRAME_MAX + 12 }, (_, index) => `f${index}.png`);
    const long = { ...scene!, sequences: [{ id: "q2", name: "", note: "", frames }] };
    assert.equal(readyWorlds({ scenes: [long] })[0]?.sequences[0]?.frames.length, PLATEAU_FRAME_MAX);
    assert.equal(readyWorlds({ scenes: [long] })[0]?.sequences[0]?.name, "Suite");

    const storage = memory();
    const second = { ...noted, id: "lieu-2", name: "Serre" };
    assert.equal(savePlateau(storage, { scenes: [sequence, second, sequence] }), true);
    const book = readPlateau(storage);
    assert.equal(book.scenes.length, 2);
    assert.equal(book.scenes[1]?.name, "Serre");
    assert.equal(book.scenes[0]?.sequences[0]?.frames[1], "b.png");
    assert.equal(parsePlateau("non").scenes.length, 0);
    assert.equal(parsePlateau(serializePlateau({ scenes: [noted] })).scenes[0]?.note, "pluie fine");
    assert.equal(saveTakeNote(storage, { sceneId: "lieu-1", line: "  elle traverse  " }), true);
    assert.deepEqual(readTakeNote(storage), { sceneId: "lieu-1", line: "elle traverse" });
    assert.equal(parseTakeNote("{").line, "");
  });
});

describe("surfaces du monde", () => {
  const files = [
    "src/components/studio/plateau-panel.tsx",
    "src/components/studio/take-panel.tsx",
    "src/components/studio/look-status.tsx",
    "src/components/studio/shell.tsx",
  ];

  it("does not call the network and keeps engine names out of the panels", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(text, /fetch\(|XMLHttpRequest|new WebSocket|fal\.ai|cloud\.comfy\.org/, file);
      assert.doesNotMatch(text, JARGON, file);
    }
    const shell = readFileSync("src/components/studio/shell.tsx", "utf8");
    assert.match(shell, /cinema-nav/);
    assert.match(shell, /PlateauPanel/);
    assert.match(shell, /TakePanel/);
    assert.match(readFileSync("src/components/studio/create-view.tsx", "utf8"), /Dépose tes/);
    assert.match(readFileSync("src/components/landing/home.tsx", "utf8"), /step=look/);
    assert.match(readFileSync("src/lib/cinema.ts", "utf8"), /prise courte/);
  });
});
