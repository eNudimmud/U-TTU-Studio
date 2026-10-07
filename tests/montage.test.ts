import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { coffreZip } from "../src/lib/coffre/export.ts";
import { mergeCoffreZip } from "../src/lib/coffre/import.ts";
import {
  MONTAGE_SLATE_SECONDS, montageCues, montageMarkdown, sequenceIdFromMontage, writeMontage,
} from "../src/lib/coffre/montage.ts";
import {
  createProject, loadStudio, orderShots, parseSequence, sequenceStem, writeBlob, writeSequence, writeShot, writeTake, type Shot, type Take,
} from "../src/lib/coffre/model.ts";
import { memoryVault } from "../src/lib/coffre/store.ts";

const take = (id: string, line: string): Take => ({
  id,
  at: "2026-10-07T12:00:00.000Z",
  sceneId: "le-quai",
  sceneName: "Le quai",
  line,
  settings: { seconds: 5, quality: "rapide", aspect: "vertical" },
  profile: "h3-4pas-5s-vertical",
  jobId: "0f6c1b1e-8d47-4f39-9e16-5f5d0f0b9a11",
  video: `Projets/mira/Prises/${id}.mp4`,
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

const shot = (id: string, name: string, ordre: number, takeIds: string[]): Shot => ({
  id, name, sequenceId: "quai-nuit", takeIds, note: "", ordre,
});

describe("liste de montage", () => {
  it("chains takes in shot order and holds a slate where a shot has no take", () => {
    assert.equal(MONTAGE_SLATE_SECONDS, 2);
    assert.equal(sequenceStem("Le montage"), "le");
    assert.equal(sequenceStem("Montage"), "suite");
    assert.equal(sequenceIdFromMontage("quai-nuit-montage"), "quai-nuit");
    assert.equal(sequenceIdFromMontage("quai-nuit"), null);
    const takes = [take("prise-a", "Elle entre"), take("prise-b", "Elle sort")];
    const shots = [
      shot("arrivee", "Arrivée", 0, ["prise-a"]),
      shot("regard", "Le regard", 1, []),
      shot("depart", "Départ", 2, ["prise-b"]),
    ];
    assert.deepEqual(montageCues(shots, takes, "quai-nuit").map(cue => [cue.ordre, cue.shotId, cue.takeId, cue.seconds, cue.source]), [
      [1, "arrivee", "prise-a", 5, "Projets/mira/Prises/prise-a.mp4"],
      [2, "regard", null, 2, null],
      [3, "depart", "prise-b", 5, "Projets/mira/Prises/prise-b.mp4"],
    ]);
    const moved = orderShots(shots, "quai-nuit", ["depart", "arrivee", "regard"]);
    assert.deepEqual(montageCues(moved, takes, "quai-nuit").map(cue => cue.shotId), ["depart", "arrivee", "regard"]);
    const text = montageMarkdown({ id: "quai-nuit", name: "Quai, la nuit" }, shots, takes, "mira");
    assert.equal(parseSequence("quai-nuit-montage", text), null);
    assert.match(text, /\[\[Projets\/mira\/Shots\/arrivee\|Arrivée\]\]/);
    assert.match(text, /\[\[Projets\/mira\/Prises\/prise-a\|Elle entre\]\]/);
    assert.match(text, /\[\[Projets\/mira\/Sequences\/quai-nuit\|Quai, la nuit\]\]/);
    assert.match(text, /\| 2 \| \[\[Projets\/mira\/Shots\/regard\|Le regard\]\] \| — \| 2 s \| Plan sans prise \|/);
    assert.match(text, /!\[\[Projets\/mira\/Prises\/prise-b\.mp4\]\]/);
    assert.match(text, /Aucun film n’est assemblé/);
    assert.doesNotMatch(text, /class_type|SaveLoRA|estimate_credits|run_template|submit_workflow|partner_generate/);
  });

  it("keeps the cut list through a studio ZIP and does not read it as a sequence", async () => {
    const home = memoryVault();
    await createProject(home, "Mira");
    const takes = [take("prise-a", "Elle entre"), take("prise-b", "Elle sort")];
    for (const filmed of takes) {
      await writeBlob(home, filmed.video, new Blob(["mp4"], { type: "video/mp4" }));
      await writeTake(home, filmed, takes);
    }
    const sequence = { id: "quai-nuit", name: "Quai, la nuit", links: [{ takeId: "prise-a", raccord: "" }, { takeId: "prise-b", raccord: "même lampe" }] };
    await writeSequence(home, sequence, takes);
    const shots = [
      shot("arrivee", "Arrivée", 0, ["prise-a"]),
      shot("regard", "Le regard", 1, []),
      shot("depart", "Départ", 2, ["prise-b"]),
    ];
    for (const panel of shots) await writeShot(home, panel, takes, sequence.name);
    await writeMontage(home, sequence, shots, takes);
    const path = "Projets/mira/Sequences/quai-nuit-montage.md";
    const before = (await home.get(path))?.text ?? "";
    assert.match(before, /Plan sans prise/);

    const archive = await coffreZip(home);
    const empty = memoryVault();
    await mergeCoffreZip(empty, archive);
    assert.equal((await empty.get(path))?.text, before);

    const back = await loadStudio(empty);
    assert.equal(back.sequences.length, 1);
    assert.equal(back.sequences[0]?.id, "quai-nuit");
    assert.deepEqual(montageCues(back.shots, back.takes, "quai-nuit").map(cue => cue.shotId), ["arrivee", "regard", "depart"]);
    assert.equal(montageCues(back.shots, back.takes, "quai-nuit")[1]?.source, null);
  });

  it("opens playback from the sequence, with a reason when no shot exists", () => {
    const sheets = readFileSync("src/components/app/sheets.tsx", "utf8");
    const fr = readFileSync("messages/fr.json", "utf8");
    assert.match(sheets, /sequence\.play/);
    assert.match(sheets, /sequence\.playOff/);
    assert.match(sheets, /sequence\.slate/);
    assert.match(sheets, /className="u-drag"/);
    assert.match(sheets, /className="u-slate"/);
    assert.match(fr, /Lire la séquence/);
    assert.match(fr, /Plan sans prise/);
    assert.doesNotMatch(sheets, /class_type|SaveLoRA|panneau de nœuds|estimate_credits|partner_generate/);
    assert.equal(JSON.parse(readFileSync("messages/en.json", "utf8"))._human, "native_open");
    assert.equal(JSON.parse(readFileSync("messages/de.json", "utf8"))._human, "native_open");
    assert.equal(JSON.parse(readFileSync("messages/es.json", "utf8"))._human, "native_open");
  });
});
