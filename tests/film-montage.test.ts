import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIONS, actionPourTouche, agir, ajouterALaFin, placements, pourquoiPas } from "../src/lib/film/montage.ts";
import type { Edit, VideoClip } from "../src/lib/montage/edit.ts";

const clip = (id: string, media = 5): VideoClip => ({ id, kind: "video", source: `${id}.mp4`, label: id, media, start: 0, end: media, takeId: id });
const film = (): Edit => ({ id: "suite", name: "Mon film", video: [clip("a"), clip("b", 4), clip("c")], audio: [] });
let n = 0;
const nextId = () => `n${++n}`;

test("every tool has a name key and a shortcut, and shortcuts are unique", () => {
  const keys = ACTIONS.map(action => action.touche);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(actionPourTouche({ key: "s", ctrl: false, shift: false }), "couper");
  assert.equal(actionPourTouche({ key: "z", ctrl: true, shift: false }), "annuler");
  assert.equal(actionPourTouche({ key: "Z", ctrl: true, shift: true }), "retablir");
  assert.equal(actionPourTouche({ key: "Delete", ctrl: false, shift: false }), "supprimer");
});

test("P1: deleting plan 2 makes plan 3 start where plan 1 ends — no gap", () => {
  const next = agir("supprimer", { edit: film(), time: 6, selected: "b" }, nextId);
  const [one, three] = placements(next.edit);
  assert.equal(next.edit.video.length, 2);
  assert.equal(three!.clip.id, "c");
  assert.equal(three!.start, one!.end);
});

test("P2: cut here, remove before, remove after work at the playhead", () => {
  const cut = agir("couper", { edit: film(), time: 2, selected: null }, nextId);
  assert.equal(cut.edit.video.length, 4);
  assert.deepEqual(placements(cut.edit).map(item => item.end), [2, 5, 9, 14]);
  const before = agir("enleverAvant", { edit: film(), time: 7, selected: null }, nextId);
  assert.deepEqual(placements(before.edit).map(item => item.end), [5, 7, 12]);
  assert.equal(before.time, 5);
  const after = agir("enleverApres", { edit: film(), time: 2, selected: null }, nextId);
  assert.deepEqual(placements(after.edit).map(item => item.end), [2, 6, 11]);
});

test("a tool that cannot run says why", () => {
  assert.equal(pourquoiPas("couper", { edit: film(), time: 5, selected: null }, { past: 0, future: 0 }), "film2.montage.pourquoi.placer");
  assert.equal(pourquoiPas("annuler", { edit: film(), time: 1, selected: null }, { past: 0, future: 0 }), "film2.montage.pourquoi.rienAnnuler");
  assert.equal(pourquoiPas("supprimer", { edit: { ...film(), video: [] }, time: 0, selected: null }, { past: 0, future: 0 }), "film2.montage.pourquoi.vide");
  assert.equal(pourquoiPas("couper", { edit: film(), time: 2, selected: null }, { past: 0, future: 0 }), null);
});

test("P6: a bin tap appends at the end, even a plan already in the film", () => {
  const next = ajouterALaFin(film(), { ...clip("a"), id: "a2" });
  assert.equal(next.video.length, 4);
  assert.equal(next.video.at(-1)!.id, "a2");
  assert.equal(next.video.at(-1)!.takeId, null);
});
