import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  createProject, dropTakeLink, loadStudio, normalizeLinks, parseSequence, sequenceMarkdown, sequenceStem, writeBlob, writeSequence, writeTake, type Take,
} from "../src/lib/coffre/model.ts";
import { memoryVault } from "../src/lib/coffre/store.ts";

const read = (path: string) => readFileSync(path, "utf8");

const take = (id: string, line: string): Take => ({
  id,
  at: "2026-10-07T12:00:00.000Z",
  sceneId: "le-quai",
  sceneName: "Le quai",
  line,
  settings: { seconds: 5, quality: "rapide", aspect: "vertical" },
  profile: "h3-4pas-5s-vertical",
  jobId: "0f6c1b1e-8d47-4f39-9e16-5f5d0f0b9a11",
  video: `Projets/uttu/Prises/${id}.mp4`,
  poster: null,
  prompt: "",
  gpuSeconds: null,
  costCredits: null,
  balanceBefore: null,
  balanceAfter: null,
  engine: "comfy",
  loraId: null,
  resolution: null,
  costUsd: null,
  costSource: null,
  announcedCredits: null,
  announcedHigh: null,
});

describe("séquences", () => {
  it("keeps order and the raccord, and never names the file sequence.md", () => {
    assert.equal(sequenceStem("Séquence"), "suite");
    assert.equal(sequenceStem(""), "suite");
    assert.equal(sequenceStem("Quai, la nuit"), "quai-la-nuit");
    const links = normalizeLinks([
      { takeId: "prise-b", raccord: "regard à gauche, même lampe" },
      { takeId: "prise-b", raccord: "doublon" },
      { takeId: "prise-a", raccord: "ne doit pas rester en tête" },
    ]);
    assert.deepEqual(links, [
      { takeId: "prise-b", raccord: "" },
      { takeId: "prise-a", raccord: "ne doit pas rester en tête" },
    ]);
    assert.deepEqual(dropTakeLink(links, "prise-b"), [{ takeId: "prise-a", raccord: "" }]);

    const sequence = {
      id: "quai-nuit",
      name: "Quai, la nuit",
      links: [
        { takeId: "prise-a", raccord: "" },
        { takeId: "prise-b", raccord: "même lumière, regard à gauche" },
      ],
    };
    const text = sequenceMarkdown(sequence, "uttu", [
      { id: "prise-a", line: "Elle entre" },
      { id: "prise-b", line: "Elle sort" },
    ]);
    assert.equal(parseSequence("index", text), null);
    assert.equal(parseSequence("sequence", text), null);
    assert.deepEqual(parseSequence("quai-nuit", text), sequence);
    assert.match(text, /\[\[Projets\/uttu\/Prises\/prise-a\|Elle entre\]\]/);
    assert.match(text, /Raccord : même lumière, regard à gauche/);
    assert.doesNotMatch(text, /class_type|SaveLoRA|panneau de nœuds/);
  });

  it("loads a sequence from the project and skips the folder note", async () => {
    const store = memoryVault();
    await createProject(store, "Uttu");
    const filmed = take("prise-a", "Elle entre");
    await writeBlob(store, filmed.video, new Blob(["mp4"], { type: "video/mp4" }));
    await writeTake(store, filmed, [filmed]);
    await writeSequence(store, {
      id: "quai-nuit",
      name: "Quai, la nuit",
      links: [
        { takeId: "prise-a", raccord: "ignoré en tête" },
        { takeId: "absente", raccord: "prop sur la table" },
      ],
    }, [filmed]);
    await writeSequence(store, { id: "sequence", name: "Interdit", links: [] });
    const studio = await loadStudio(store);
    assert.equal(studio.sequences.length, 1);
    assert.equal(studio.sequences[0]?.name, "Quai, la nuit");
    assert.deepEqual(studio.sequences[0]?.links, [
      { takeId: "prise-a", raccord: "" },
      { takeId: "absente", raccord: "prop sur la table" },
    ]);
    assert.equal(await store.get("Projets/uttu/Sequences/sequence.md"), null);
    assert.match((await store.get("Projets/uttu/Sequences/index.md"))?.text ?? "", /Une séquence relie/);
    assert.match((await store.get("Projets/uttu/Templates/modele-sequence.md"))?.text ?? "", /raccord/);
    const moc = (await store.get("Projets/uttu/_MOC.md"))?.text ?? "";
    assert.match(moc, /Sequences\/quai-nuit\|Quai, la nuit/);
    assert.doesNotMatch(moc, /Sequences\/sequence\|/);
  });

  it("opens sequences from the take and the project view, without a graph", () => {
    const screens = read("src/components/app/screens.tsx");
    const sheets = read("src/components/app/sheets.tsx");
    assert.match(screens, /setSheet\("sequences"\)/);
    assert.match(screens, /sequence\.inSequence/);
    assert.match(sheets, /sequence\.raccord/);
    assert.match(sheets, /<Why on=\{blocked\}/);
    assert.doesNotMatch(screens + sheets, /class_type|SaveLoRA|panneau de nœuds/);
  });
});
