import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseTake, takeMarkdown, type Take } from "../src/lib/coffre/model.ts";
import { clipTier, finalQuote, isFinalisedSource, replaceClipSource, singleClipEdit } from "../src/lib/montage/finaliser.ts";
import type { Edit } from "../src/lib/montage/edit.ts";
import { quoteCredits, readRendu, saveRendu } from "../src/lib/prise/rendu.ts";
import { estimatedTake, resolveTakeQuote } from "../src/lib/render/billed-quote.ts";
import { LTX_APERCU_MEGAPIXELS, ltxTakeGraph } from "../src/lib/render/ltx-graph.ts";
import { DEFAULT_RENDU, isApercuProfile, takeProfile, takeRendu } from "../src/lib/render/take-graph.ts";

const graph = (apercu: boolean) => ltxTakeGraph({ prompt: "Elle traverse le quai.", pictures: ["a.png"], seconds: 5, aspect: "vertical", seed: 42, apercu });

function dangling(g: ReturnType<typeof graph>): string[] {
  return Object.entries(g).flatMap(([id, node]) => Object.values(node.inputs).flatMap(value => Array.isArray(value) && typeof value[0] === "string" && !g[value[0]] ? [`${id}→${value[0]}`] : []));
}

describe("Aperçu ou Qualité finale (prise)", () => {
  it("keeps Qualité finale as the default and today's profile", () => {
    assert.equal(DEFAULT_RENDU, "finale");
    assert.equal(takeRendu({ engine: "ltx" }), "finale");
    assert.equal(takeProfile({ seconds: 5, quality: "rapide", aspect: "vertical", engine: "ltx" }), "ltx25-5s-vertical");
  });

  it("gives Aperçu its own profile, LTX only", () => {
    assert.equal(takeProfile({ seconds: 5, quality: "rapide", aspect: "vertical", engine: "ltx", rendu: "apercu" }), "ltx25-apercu-5s-vertical");
    assert.equal(takeProfile({ seconds: 5, quality: "rapide", aspect: "vertical", engine: "h3", rendu: "apercu" }), "h3-4pas-5s-vertical");
    assert.ok(isApercuProfile("ltx25-apercu-10s-paysage"));
    assert.ok(!isApercuProfile("ltx25-5s-vertical"));
  });

  it("drops the second pass and decodes the first sampler, same seed", () => {
    const full = graph(false);
    const apercu = graph(true);
    assert.equal(full["398:368"].class_type.length > 0, true);
    for (const id of ["398:348", "398:368", "398:369", "398:371"]) assert.equal(apercu[id], undefined, id);
    assert.deepEqual(apercu["398:374"].inputs.samples, ["398:367", 0]);
    assert.deepEqual(apercu["398:358"].inputs.samples, ["398:367", 1]);
    assert.equal(apercu["403"].inputs.megapixels, LTX_APERCU_MEGAPIXELS);
    assert.equal(apercu["398:353"].inputs.expression, "a");
    assert.deepEqual(dangling(apercu), []);
    assert.deepEqual(dangling(full), []);
    const seeds = Object.values(apercu).filter(node => node.class_type === "RandomNoise").map(node => node.inputs.noise_seed);
    assert.ok(seeds.length > 0 && seeds.every(seed => seed === 42));
  });

  it("quotes Aperçu as an estimate, about half of the finale", () => {
    assert.deepEqual(estimatedTake("ltx25-apercu-5s-vertical"), { profile: "ltx25-apercu-5s-vertical", credits: 6, creditsHigh: 12 });
    assert.deepEqual(estimatedTake("ltx25-5s-vertical"), { profile: "ltx25-5s-vertical", credits: 15, creditsHigh: 23 });
    assert.equal(quoteCredits(resolveTakeQuote("ltx25-apercu-5s-vertical", [])), 6);
    assert.match(readFileSync("src/lib/render/billed-quote.ts", "utf8"), /TODO\(mesure\)/);
  });

  it("remembers the choice per project", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
    assert.equal(readRendu(storage, "atelier"), "finale");
    saveRendu(storage, "atelier", "apercu");
    assert.equal(readRendu(storage, "atelier"), "apercu");
    assert.equal(readRendu(storage, "autre"), "finale");
    assert.equal(readRendu(null, "atelier"), "finale");
  });

  it("writes and reads an Aperçu take back", () => {
    const take: Take = {
      id: "20261026-140000-le-quai", at: "2026-10-26T13:00:00.000Z", sceneId: "le-quai", sceneName: "Le quai", line: "Elle traverse le quai.",
      settings: { seconds: 5, quality: "rapide", aspect: "vertical", engine: "ltx", rendu: "apercu" }, profile: "ltx25-apercu-5s-vertical",
      jobId: "0f6c1b1e-8d47-4f39-9e16-5f5d0f0b9a11", video: "Projets/atelier/Prises/a.mp4", poster: "Projets/atelier/Prises/a.jpg", prompt: "x", engine: "comfy",
    } as Take;
    const text = takeMarkdown(take);
    assert.match(text, /apercu: true/);
    const back = parseTake(take.id, text);
    assert.equal(back?.settings.rendu, "apercu");
    assert.equal(back?.profile, "ltx25-apercu-5s-vertical");
  });
});

describe("Aperçu ou Qualité finale (montage)", () => {
  const takes = [{ id: "t1", profile: "ltx25-apercu-5s-vertical" }, { id: "t2", profile: "ltx25-5s-vertical" }];
  const edit: Edit = {
    id: "m", name: "Montage",
    video: [
      { id: "c1", kind: "video", source: "Projets/a/Prises/t1.mp4", label: "Plan 1", media: 5, start: 1, end: 4, takeId: "t1", speed: 2 },
      { id: "c2", kind: "video", source: "Projets/a/Prises/t2.mp4", label: "Plan 2", media: 5, start: 0, end: 5, takeId: "t2" },
      { id: "c3", kind: "video", source: "Projets/a/Assets/import.mp4", label: "Import", media: 5, start: 0, end: 5, takeId: null },
    ],
    audio: [],
  } as Edit;

  it("tags each take, not the imports", () => {
    assert.deepEqual(edit.video.map(clip => clipTier(clip, takes)), ["apercu", "finale", null]);
    assert.ok(isFinalisedSource("Projets/a/Assets/plan-1-final-1080p-20261026-1400-ab12cd34.mp4"));
  });

  it("finalises one shot whole, then swaps it in place", () => {
    const one = singleClipEdit(edit, "c1");
    assert.equal(one?.video.length, 1);
    assert.deepEqual([one?.video[0].start, one?.video[0].end, one?.video[0].speed], [0, 5, undefined]);
    assert.ok(finalQuote(5, { resolution: "1080p", nettoyer: "aucun" }));
    const path = "Projets/a/Assets/plan-1-final-1080p-20261026-1400-ab12cd34.mp4";
    const next = replaceClipSource(edit, "c1", path);
    assert.equal(next.video[0].source, path);
    assert.deepEqual([next.video[0].start, next.video[0].end, next.video[0].speed], [1, 4, 2]);
    assert.equal(clipTier(next.video[0], takes), "finale");
  });
});
