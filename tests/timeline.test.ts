import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createProject, loadStudio } from "../src/lib/coffre/model.ts";
import { DEFAULT_TAKE } from "../src/lib/render/take-graph.ts";
import { memoryVault } from "../src/lib/coffre/store.ts";
import {
  addAudio, appendVideo, audioEnd, canSplit, clipGain, collectSnapPoints, commit, deleteClip, editDuration,
  emptyEdit, historyOf, mixInto, moveAudio, peakBars, redo, reorderVideo, resolveSnap, snapThreshold, splitVideo,
  trimAudio, trimVideo, undo, videoDuration,
  type AudioClip, type Edit, type VideoClip,
} from "../src/lib/montage/edit.ts";
import { exportAllowed, exportEstimate } from "../src/lib/montage/export-plan.ts";
import { EXEMPLE_MUSIC_SECONDS, EXEMPLE_VOICE_SECONDS, exempleEdit } from "../src/lib/montage/exemple.ts";
import { parseSequenceFiche, sequenceFiche } from "../src/lib/montage/fiche.ts";
import { chooseEdit } from "../src/lib/montage/from-takes.ts";
import { sfxQuote, voiceQuote } from "../src/lib/montage/quotes.ts";
import { placeLocalSources, readMontages, writeMontageEdit } from "../src/lib/montage/vault.ts";
import type { Shot } from "../src/lib/coffre/model.ts";

const read = (path: string) => readFileSync(path, "utf8");

function plan(id: string, seconds: number): VideoClip {
  return { id, kind: "image", source: `/exemples/${id}.webp`, label: id, media: seconds, start: 0, end: seconds, takeId: null };
}

function tone(id: string, at: number, seconds: number): AudioClip {
  return {
    id, track: "voix", source: `/exemples/${id}.wav`, label: id, media: seconds, start: 0, end: seconds,
    at, volume: 1, fadeIn: 0, fadeOut: 0,
  };
}

function shot(id: string, sequenceId: string, takeIds: string[]): Shot {
  return { id, name: id, sequenceId, takeIds, note: "", ordre: 1 };
}

function wavSeconds(buffer: Buffer): number {
  const rate = buffer.readUInt32LE(24);
  const channels = buffer.readUInt16LE(22);
  const bits = buffer.readUInt16LE(34);
  const data = buffer.readUInt32LE(40);
  return data / (rate * channels * (bits / 8));
}

describe("timeline", () => {
  it("reorders, trims with ripple, and splits only inside a shot", () => {
    const start = emptyEdit("seq", "Séquence");
    const withPlans = [plan("a", 2), plan("b", 3), plan("c", 1)].reduce((edit, clip) => appendVideo(edit, clip), start);
    const moved = reorderVideo(withPlans, 0, 2);
    assert.deepEqual(moved.video.map(clip => clip.id), ["b", "c", "a"]);
    assert.equal(reorderVideo(moved, 0, 0), moved);

    const trimmed = trimVideo(withPlans, "a", "end", 1);
    assert.equal(trimmed.video[0].end, 1);
    assert.equal(videoDuration(trimmed), 5);
    const opened = trimVideo(trimmed, "a", "start", 0.4);
    assert.equal(opened.video[0].start, 0.4);
    assert.equal(opened.video[0].end, 1);
    assert.equal(videoDuration(opened), 4.6);

    const split = splitVideo(withPlans, 1, "plan-coupe");
    assert.equal(split.video.length, 4);
    assert.equal(split.video[0].end, 1);
    assert.equal(split.video[1].id, "plan-coupe");
    assert.equal(split.video[1].start, 1);
    assert.equal(videoDuration(split), videoDuration(withPlans));
    assert.equal(canSplit(withPlans, 1), true);
    assert.equal(splitVideo(withPlans, 0, "plan-bord"), withPlans);
    assert.equal(splitVideo(withPlans, 0.05, "plan-bord"), withPlans);
    assert.equal(splitVideo(split, 1, "plan-coupe"), split);
    assert.equal(deleteClip(split, "plan-coupe").video.some(clip => clip.id === "plan-coupe"), false);
  });

  it("moves audio without ripple, snaps to the nearest edge, and keeps a tie on the first point", () => {
    const edit = addAudio(appendVideo(emptyEdit("seq", "Séquence"), plan("a", 4)), tone("voix", 1, 2));
    const moved = moveAudio(edit, "voix", 3);
    assert.equal(moved.audio[0].at, 3);
    assert.equal(audioEnd(moved.audio[0]), 5);
    const cut = trimAudio(moved, "voix", "start", 3.5);
    assert.ok(Math.abs(cut.audio[0].at - 3.5) < 1e-9);
    assert.ok(Math.abs(cut.audio[0].start - 0.5) < 1e-9);
    assert.equal(edit.audio[0].at, 1);

    assert.equal(snapThreshold(100), 0.1);
    assert.equal(snapThreshold(50), 0.2);
    const points = collectSnapPoints(edit, 4, "voix");
    assert.equal(points.some(point => point.clipId === "voix"), false);
    assert.equal(resolveSnap(0.08, points, 0.1), 0);
    const tie = resolveSnap(0.5, [{ time: 0, kind: "start" }, { time: 1, kind: "end" }], 0.5);
    assert.equal(tie, 0);
    assert.equal(resolveSnap(2, points, 0.1), 2);
  });

  it("measures the longer of picture and sound, and mixes gain with a fade", () => {
    const edit: Edit = {
      id: "seq",
      name: "Séquence",
      video: [plan("a", 4)],
      audio: [{ ...tone("bed", 3, 3), track: "musique", volume: 0.5, fadeIn: 1, fadeOut: 0 }],
    };
    assert.equal(editDuration(edit), 6);
    assert.equal(clipGain({ volume: 1, fadeIn: 0.2, fadeOut: 0 }, 0.1, 1), 0.5);

    const output = new Float32Array(4);
    mixInto(output, new Float32Array([1, 1, 1, 1]), {
      at: 0, trim: 0, duration: 0.4, volume: 0.5, fadeIn: 0, fadeOut: 0, sampleRate: 10, sourceRate: 10,
    });
    assert.ok(output.slice(0, 4).every(sample => Math.abs(sample - 0.5) < 1e-6));
    const bars = peakBars(new Float32Array([0, 0.25, -0.5, 0.125]), 2);
    assert.deepEqual(bars, [0.25, 0.5]);
  });

  it("round-trips the sequence sheet and refuses an older cut list", () => {
    const edit = exempleEdit();
    const sheet = sequenceFiche(edit, "mira");
    assert.match(sheet, /type: "sequence"/);
    assert.match(sheet, /gesture: "montage"/);
    assert.match(sheet, /\| Ordre \| Piste \| Nom \| Début \| Durée \| Volume \| Fondu \| Source \|/);
    assert.match(sheet, /Le quai, la nuit/);
    assert.match(sheet, /2,5 s/);
    assert.doesNotMatch(sheet, /class_type|api_elevenlabs|estimate_credits/);
    const back = parseSequenceFiche("exemple", sheet);
    assert.ok(back);
    assert.equal(back.video.length, 3);
    assert.equal(back.audio.length, 2);
    assert.equal(back.audio[0].track, "voix");
    assert.equal(back.audio[1].track, "musique");
    assert.equal(editDuration(back), editDuration(edit));
    assert.equal(parseSequenceFiche("exemple", "---\ntype: montage\n---\n\n# Exemple\n"), null);
    assert.equal(parseSequenceFiche("seq-1", "---\ntype: sequence\nnom: Séquence 1\n---\n\n# Séquence 1\n"), null);
  });

  it("keeps the example out of the vault until it is written, then restores it", async () => {
    const fresh = chooseEdit({ saved: [], sequences: [], shots: [], takes: [] });
    assert.equal(fresh.stored, false);
    assert.equal(fresh.edit.id, "exemple");
    assert.equal(fresh.edit.video.length, 3);
    assert.equal(fresh.edit.audio.map(clip => clip.track).join(","), "voix,musique");

    const filed = chooseEdit({
      saved: [],
      sequences: [{ id: "seq-1", name: "Séquence 1" }],
      shots: [shot("plan-1", "seq-1", ["prise-1"])],
      takes: [{ id: "prise-1", line: "Elle avance", video: "Projets/mira/Prises/prise-1.mp4", settings: DEFAULT_TAKE }],
    });
    assert.equal(filed.stored, false);
    assert.equal(filed.edit.video[0].takeId, "prise-1");
    assert.equal(filed.edit.id, "seq-1");

    const kept = chooseEdit({
      saved: [emptyEdit("seq-1", "Vide")],
      sequences: [{ id: "seq-1", name: "Séquence 1" }],
      shots: [shot("plan-1", "seq-1", ["prise-1"])],
      takes: [{ id: "prise-1", line: "Elle avance", video: "Projets/mira/Prises/prise-1.mp4", settings: DEFAULT_TAKE }],
    });
    assert.equal(kept.stored, true);
    assert.equal(kept.edit.video.length, 0);

    const store = memoryVault();
    await createProject(store, "Mira");
    const placed = placeLocalSources(addAudio(exempleEdit(), { ...tone("son-abc", 0, 1), source: "local:son-abc" }), "mira", { "son-abc": "mp3" });
    assert.equal(placed.audio.at(-1)?.source, "Projets/mira/Sequences/son-abc.mp3");
    await writeMontageEdit(store, exempleEdit());
    const note = await store.get("Projets/mira/Sequences/exemple-montage.md");
    assert.ok(note?.text);
    const loaded = await readMontages(store, "mira");
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].video.length, 3);
    const studio = await loadStudio(store);
    assert.equal(studio.sequences.some(sequence => sequence.id === "exemple" || sequence.id.endsWith("-montage")), false);
  });

  it("announces a size before export and leaves voice quotes unmeasured", () => {
    const estimate = exportEstimate(7);
    assert.ok(estimate);
    assert.equal(estimate.frames, 84);
    assert.equal(estimate.bytes, Math.ceil(((800_000 + 128_000) * 7) / 8));
    assert.equal(exportAllowed(60), true);
    assert.equal(exportAllowed(61), false);
    assert.equal(exportEstimate(0), null);
    assert.equal(voiceQuote(0), null);
    const voice = voiceQuote(100);
    assert.equal(voice?.kind, "hypothese");
    assert.equal(voice?.credits, 2);
    assert.equal(voice?.high, 3);
    const effect = sfxQuote(5);
    assert.equal(effect?.credits, 2);
    assert.equal(effect?.high, 3);
    const history = commit(historyOf(emptyEdit("a", "A")), exempleEdit());
    const back = undo(history);
    assert.equal(back.present.video.length, 0);
    assert.equal(redo(back).present.video.length, 3);
  });

  it("ships example tones at the written lengths, and hides the render graph", () => {
    assert.equal(wavSeconds(readFileSync("public/exemples/voix-exemple.wav")), EXEMPLE_VOICE_SECONDS);
    assert.equal(wavSeconds(readFileSync("public/exemples/musique-exemple.wav")), EXEMPLE_MUSIC_SECONDS);
    const fr = JSON.parse(read("messages/fr.json")) as { montage: { needLink: string } };
    assert.equal(fr.montage.needLink, "Relie ton compte de rendu pour créer.");
    const stage = read("src/components/app/montage-stage.tsx");
    assert.match(stage, /data-section="montage"/);
    assert.doesNotMatch(stage, /class_type|api_elevenlabs|estimate_credits|partner_generate|submit_workflow|run_template/);
    assert.match(read("src/components/app/prise-stage.tsx"), /data-lire-sequence/);
    assert.match(read("src/components/app/prise-stage.tsx"), /onMontage\(\)/);
  });
});
