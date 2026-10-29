import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTake, takeMarkdown, type Take } from "../src/lib/coffre/model.ts";
import { placeStoryboard } from "../src/lib/montage/arrivee.ts";
import { framingGroups } from "../src/lib/prise/framing-refs.ts";
import { comfyStorageUrl, takeWorkflow } from "../src/lib/render/take-graph.ts";
import { IN_FLIGHT_KEY, readInFlight } from "../src/lib/render/settings.ts";

const take = (patch: Partial<Take> = {}): Take => ({
  id: "20261029-150000-le-quai", at: "2026-10-29T14:00:00.000Z", sceneId: "le-quai", sceneName: "Le quai", line: "Uttu traverse le quai.",
  settings: { seconds: 5, quality: "rapide", aspect: "vertical" }, profile: "h3-4pas-5s-vertical", jobId: "0f6c1b1e-8d47-4f39-9e16-5f5d0f0b9a11",
  video: "Projets/atelier/Prises/20261029-150000-le-quai.mp4", poster: null, prompt: "<Picture 1> shows Uttu.",
  gpuSeconds: 74, costCredits: 20.22, balanceBefore: 500, balanceAfter: 479.78, engine: "comfy", loraId: null, resolution: null,
  costUsd: null, costSource: null, announcedCredits: null, announcedHigh: null, ...patch,
});

describe("P1-4 · fiche de production d’une prise", () => {
  it("writes and reads workflow, job, real cost, references, origin plan and Comfy storage", () => {
    const storageUrl = comfyStorageUrl({ filename: "MiniMax_H3_00001_.mp4", subfolder: "video", type: "output" });
    const full = take({ workflow: takeWorkflow({ seconds: 5, quality: "rapide", aspect: "vertical" }), refs: ["Projets/atelier/Personnages/uttu.png", "Projets/atelier/Lieux/le-quai.png"], planId: "plan-2", storageUrl });
    const text = takeMarkdown(full);
    assert.match(text, /workflow: /);
    assert.match(text, /plan_id: /);
    assert.match(text, /stockage: /);
    assert.match(text, /Workflow : /);
    const back = parseTake(full.id, text);
    assert.deepEqual(back, full);
    assert.equal(back?.jobId, full.jobId);
    assert.equal(back?.costCredits, 20.22);
    assert.equal(storageUrl, "https://cloud.comfy.org/api/view?filename=MiniMax_H3_00001_.mp4&subfolder=video&type=output");
  });

  it("keeps older notes readable and drops what does not belong", () => {
    assert.deepEqual(parseTake(take().id, takeMarkdown(take())), take());
    const forged = takeMarkdown(take({ storageUrl: "https://example.com/api/view?x", refs: ["/etc/passwd"], planId: "Plan 2!", workflow: "a b" }));
    const back = parseTake(take().id, forged)!;
    assert.equal(back.storageUrl, undefined);
    assert.equal(back.refs, undefined);
    assert.equal(back.planId, undefined);
    assert.equal(back.workflow, undefined);
  });

  it("names the workflow of each engine", () => {
    assert.equal(takeWorkflow({ seconds: 5, quality: "rapide", aspect: "vertical", engine: "ltx" }), "ltx-2.5-i2v");
    assert.equal(takeWorkflow({ seconds: 5, quality: "rapide", aspect: "vertical", engine: "h3" }), "video_minimax_h3_r2v");
  });

  it("carries the references sent through a reload of the in-flight receipt", () => {
    const store = new Map<string, string>();
    store.set(IN_FLIGHT_KEY, JSON.stringify({ jobId: "job-0001-abcd", at: "2026-10-29T14:00:00.000Z", project: "atelier", planId: "plan-2", refs: ["Projets/atelier/a.png", "https://x/y.png"], sceneId: null, sceneName: "", line: "x", prompt: "p", settings: { seconds: 5, quality: "rapide", aspect: "vertical" }, balanceBefore: 10 }));
    const flight = readInFlight({ getItem: key => store.get(key) ?? null });
    assert.deepEqual(flight?.refs, ["Projets/atelier/a.png"]);
    assert.equal(flight?.planId, "plan-2");
  });
});

describe("P1-4 · prise gardée → MONTAGE", () => {
  it("places a kept take once, even when kept twice", () => {
    const plan = { id: "20261029-150000-le-quai", label: "Uttu traverse", seconds: 5, source: "Projets/atelier/Prises/20261029-150000-le-quai.mp4" };
    const once = placeStoryboard({ id: "suite", name: "Séquence", video: [], audio: [] }, plan, false);
    const twice = placeStoryboard(once, plan, false);
    assert.equal(twice.video.length, 1);
    assert.equal(twice.video[0].takeId, plan.id);
  });
});

describe("P1-4 · DÉCOR → PRISE : points de vue en référence de cadrage", () => {
  const scenes = [
    { id: "autre", name: "La gare", render: null, stills: ["Projets/a/Lieux/gare.png"], views: [], frames: [] },
    { id: "le-quai", name: "Le quai", render: "Projets/a/Lieux/quai-rendu.png", stills: ["Projets/a/Lieux/quai.png"], views: ["Projets/a/Lieux/quai.png", "Projets/a/Lieux/quai-2.png"], frames: ["Projets/a/Lieux/quai-3.jpg"] },
  ];
  const cast = [{ name: "Uttu", sheet: "Projets/a/Personnages/uttu-planche.png", photos: ["Projets/a/Personnages/uttu.png"] }];
  const paths = ["Projets/a/Lieux/quai-rendu.png", "Projets/a/Lieux/quai.png", "Projets/a/Lieux/quai-2.png", "Projets/a/Lieux/quai-3.jpg", "Projets/a/Lieux/gare.png", "Projets/a/Personnages/uttu-planche.png", "Projets/a/Personnages/uttu.png", "Projets/a/Import/x.webp", "Projets/a/Prises/p.mp4"];

  it("lists the plan's set viewpoints first, then other sets, then cast, then the rest", () => {
    const groups = framingGroups(paths, scenes, cast, "le-quai");
    assert.deepEqual(groups.map(group => group.group), ["decor", "cast", "autres"]);
    assert.deepEqual(groups[0].items.map(item => item.path), ["Projets/a/Lieux/quai-rendu.png", "Projets/a/Lieux/quai.png", "Projets/a/Lieux/quai-2.png", "Projets/a/Lieux/quai-3.jpg", "Projets/a/Lieux/gare.png"]);
    assert.equal(groups[0].items[0].kind, "rendu");
    assert.deepEqual(groups[0].items.slice(1, 4).map(item => item.n), [1, 2, 3]);
    assert.deepEqual(groups[2].items.map(item => item.path), ["Projets/a/Import/x.webp"]);
    const all = groups.flatMap(group => group.items.map(item => item.path));
    assert.equal(new Set(all).size, all.length);
    assert.ok(!all.includes("Projets/a/Prises/p.mp4"));
  });

  it("offers only what is in the project", () => {
    assert.deepEqual(framingGroups(["Projets/a/Personnages/uttu.png"], scenes, cast, null).map(group => group.group), ["cast"]);
  });
});
