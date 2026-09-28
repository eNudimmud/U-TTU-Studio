import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SCENE_ANGLE_REMINDER } from "../src/lib/doctrine.ts";
import {
  SCENE_DEVICE_NOTE, SCENE_FILE_NOTE, SCENE_STORAGE_KEY, SCENE_TEXT_MAX, SCENE_VAULT_POINTER,
  emptyBook, emptySheet, parseBook, parseSceneMarkdown, readBook, saveBook, sceneMarkdown, scenePath, serializeBook,
  type SceneSheet,
} from "../src/lib/scenes.ts";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    keys: () => [...data.keys()],
  };
}

const filled: SceneSheet = {
  lieu: "Cour intérieure",
  left: "la table",
  right: "la porte",
  angles: ["regard tenu", "épaule", "", "départ"],
};

describe("fiches scenes/", () => {
  it("writes a markdown sheet the vault can hold, and reads it back", () => {
    const markdown = sceneMarkdown("avant", filled);
    assert.match(markdown, /^# Avant\n/);
    assert.match(markdown, /`scenes\/avant\.md`/);
    assert.match(markdown, new RegExp(SCENE_FILE_NOTE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(markdown, /## Lieu\n\nCour intérieure/);
    assert.match(markdown, /- Face : regard tenu/);
    assert.match(markdown, /- 3\/4 : épaule/);
    assert.match(markdown, /- Profil\n/);
    assert.match(markdown, /- Dos : départ/);
    assert.match(markdown, /- À gauche : la table/);
    assert.match(markdown, /- À droite : la porte/);
    assert.deepEqual([...SCENE_ANGLE_REMINDER], ["Face", "3/4", "Profil", "Dos"]);
    const parsed = parseSceneMarkdown(markdown, "avant.md");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.id, "avant");
    assert.deepEqual(parsed.sheet, filled);
    assert.equal(scenePath("entre"), "scenes/entre.md");
    assert.equal(scenePath("apres"), "scenes/apres.md");
  });

  it("accepts a paste or a file name, and refuses a sheet for another fiche", () => {
    const apres = sceneMarkdown("apres", { ...emptySheet(), lieu: "Quai" }).replace(/\n/g, "\r\n");
    const byName = parseSceneMarkdown(apres, "U-TTU-Studio/scenes/apres.md");
    assert.equal(byName.ok && byName.id, "apres");
    assert.equal(byName.ok && byName.sheet.lieu, "Quai");
    const crossed = parseSceneMarkdown(apres, "avant.md");
    assert.equal(crossed.ok, false);
    assert.equal(parseSceneMarkdown("bonjour", "notes.md").ok, false);
    assert.equal(parseSceneMarkdown("# Avant\n\nSans sections.", "avant.md").ok, false);
    const titled = parseSceneMarkdown("# Entre deux images\n\n## Espace\n\n- À gauche : elle\n- À droite : lui\n", "fiche.md");
    assert.equal(titled.ok && titled.id, "entre");
    assert.equal(titled.ok && titled.sheet.left, "elle");
    assert.equal(titled.ok && titled.sheet.right, "lui");
    const long = "x".repeat(SCENE_TEXT_MAX + 20);
    const clipped = parseSceneMarkdown(`# Avant\n\n## Lieu\n\n${long}\n`, "avant.md");
    assert.equal(clipped.ok && clipped.sheet.lieu.length, SCENE_TEXT_MAX);
  });

  it("keeps the three fiches on this device and ignores a foreign key", () => {
    const store = memory();
    const book = emptyBook();
    book.avant = filled;
    assert.equal(saveBook(store, book), true);
    assert.deepEqual(store.keys(), [SCENE_STORAGE_KEY]);
    const read = readBook(store);
    assert.deepEqual(read.avant, filled);
    assert.deepEqual(read.apres, emptySheet());
    assert.deepEqual(read.entre, emptySheet());
    assert.deepEqual(readBook(null), emptyBook());
    assert.deepEqual(parseBook("not json"), emptyBook());
    assert.deepEqual(parseBook(JSON.stringify({ balance: 12, cloud: true })), emptyBook());
    const round = parseBook(serializeBook(book));
    assert.deepEqual(round.avant.lieu, filled.lieu);
    assert.equal(saveBook(null, book), false);
    const copy = `${SCENE_DEVICE_NOTE} ${SCENE_VAULT_POINTER} ${SCENE_FILE_NOTE} ${sceneMarkdown("entre", emptySheet())}`;
    assert.match(SCENE_VAULT_POINTER, /scenes\//);
    assert.match(SCENE_VAULT_POINTER, /Aucune sync/);
    assert.doesNotMatch(copy, /https?:|stripe|fal\.ai|share=|synchronis/i);
    const maison = readFileSync("src/components/studio/maison-panel.tsx", "utf8");
    assert.match(maison, /SCENE_VAULT_POINTER/);
    assert.doesNotMatch(maison, /fetch\(|cloud\.comfy\.org/);
  });
});
