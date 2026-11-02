import assert from "node:assert/strict";
import test from "node:test";
import { storyboardSwActif } from "../src/lib/storyboard/storyweave.ts";
import { costLine } from "../src/lib/storyweave/cost.ts";
import { archiveOperation, duplicateOperation, lockFields, parseLocks, reorderOperation } from "../src/lib/storyweave/journal.ts";
import { cuesOf, scenesOf } from "../src/lib/storyweave/script.ts";
import {
  acceptResync, audioDrift, buildTimeline, emptySwEdit, freezeAudio, quotableDuration, shotSpan, TRACKS, trimShot,
} from "../src/lib/storyweave/timeline.ts";
import { parseVersions, publishVersion } from "../src/lib/storyweave/versions.ts";
import { zipNames, zipStore } from "../src/lib/storyweave/zip.ts";
import { dialogueVide, planVide, storyboardVide, type Storyboard } from "../src/lib/storyboard/storyboard.ts";

function board(): Storyboard {
  const now = "2026-11-02T00:00:00.000Z";
  const sb = storyboardVide({ id: "lantern-a", titre: "Night walk", idee: "A walk.", now });
  const first = planVide("shot-a", "paysage");
  first.titre = "Street";
  first.action = "She walks.";
  first.duree = 10;
  first.dialogue = { ...dialogueVide(), type: "voixoff", qui: null, texte: "Morning can wait.", source: "uttu", propositions: [] };
  const second = planVide("shot-b", "paysage");
  second.titre = "Gate";
  second.action = "He opens the gate.";
  second.duree = 8;
  second.dialogue = { ...dialogueVide(), type: "replique", qui: "Kai", texte: "This way.", source: "uttu", propositions: [] };
  sb.musique = "piano";
  sb.sequences = [{ id: "seq-a", titre: "", resume: "", plans: [first, second] }];
  return sb;
}

test("StoryWeave opens only on ?storyboard=sw", () => {
  assert.equal(storyboardSwActif("?storyboard=sw"), true);
  assert.equal(storyboardSwActif("storyboard=sw"), true);
  assert.equal(storyboardSwActif(""), false);
  assert.equal(storyboardSwActif("?storyboard=u11"), false);
  assert.equal(storyboardSwActif("?storyboard=legacy"), false);
  assert.equal(storyboardSwActif("?storyboard=1"), false);
});

test("unmeasured costs are not a number", () => {
  assert.deepEqual(costLine(null), { kind: "before-launch" });
  assert.deepEqual(costLine(0), { kind: "before-launch" });
  assert.deepEqual(costLine(undefined), { kind: "before-launch" });
  assert.deepEqual(costLine(12.2), { kind: "estimated", credits: 12.2 });
});

test("the timeline always has four tracks and a trim can desync sound", () => {
  const sb = board();
  const edit = emptySwEdit();
  const clips = buildTimeline(sb, edit, new Set());
  assert.deepEqual(TRACKS, ["video", "voice", "music", "text"]);
  for (const track of TRACKS) assert.equal(clips.some(clip => clip.track === track), true, track);
  const frozen = freezeAudio(sb, edit, new Set());
  const trimmed = trimShot(frozen, "shot-a", 9);
  assert.equal(shotSpan(sb.sequences[0]!.plans[0]!, trimmed), 9);
  assert.equal(quotableDuration(9), null);
  assert.equal(quotableDuration(8.1), 8);
  const drift = audioDrift(sb, trimmed, new Set());
  assert.equal(drift.some(item => item.shotId === "shot-b"), true);
  const synced = acceptResync(trimmed);
  assert.deepEqual(audioDrift(sb, synced, new Set()), []);
  const scenes = scenesOf(sb, edit);
  assert.equal(scenes[0]?.proposal, true);
  assert.equal(scenes[0]?.voice, true);
  assert.equal(cuesOf(sb, edit).some(cue => cue.group === "narration" && !cue.recorded), true);
  assert.equal(cuesOf(sb, edit).some(cue => cue.group === "music"), true);
});

test("a published version has no public address", () => {
  const sb = board();
  const versions = publishVersion([], sb, "2026-11-02T03:34:00.000Z");
  assert.equal(versions.length, 1);
  assert.equal(versions[0]?.name, "1");
  assert.equal("url" in (versions[0] as object), false);
  const raw = JSON.stringify(versions);
  assert.equal(raw.includes("http"), false);
  assert.equal(parseVersions(raw)[0]?.board.titre, "Night walk");
  assert.equal(parseVersions("{").length, 0);
});

test("journal operations stay inside the cinema kinds", () => {
  const scope = { projectId: "atelier", storyboardId: "lantern-a" };
  assert.equal(reorderOperation(scope, 2, ["shot-b", "shot-a"]).kind, "storyboard.reorder");
  assert.equal(archiveOperation(scope, "shot-a", 1).kind, "shot.archive");
  assert.equal(duplicateOperation(scope, "shot-a", 1).kind, "shot.duplicate");
  assert.equal(lockFields(true).includes("dialogue"), true);
  assert.deepEqual(lockFields(false), []);
  assert.deepEqual(parseLocks(JSON.stringify({ "shot-a": ["dialogue", "nope"] })), { "shot-a": ["dialogue"] });
});

test("a zip groups the files of one element", () => {
  const archive = zipStore([
    { name: "sheet.webp", data: new TextEncoder().encode("sheet") },
    { name: "view.webp", data: new TextEncoder().encode("view") },
  ]);
  assert.deepEqual(zipNames(archive), ["sheet.webp", "view.webp"]);
  assert.equal(archive[0], 0x50);
  assert.equal(archive[1], 0x4b);
});
