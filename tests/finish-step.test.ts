import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finishPlan } from "../src/lib/film/finish-step.ts";
import { grapheFinition, regenere } from "../src/lib/look/graphs.ts";

describe("Finish", () => {
  it("enhances a kept take and never redraws it", () => {
    const video = finishPlan({ media: "video", anime: false, seconds: 5 });
    const anime = finishPlan({ media: "video", anime: true, seconds: 5 });
    const still = finishPlan({ media: "image", anime: false });
    assert.equal(video.engine, "seedvr2");
    assert.equal(video.tool, "vid-finaliser");
    assert.equal(video.regenerates, false);
    assert.ok(video.credits > 0 && video.high >= video.credits);
    assert.equal(anime.engine, "realesrgan-anime");
    assert.equal(anime.geste, "anime-finish");
    assert.equal(anime.regenerates, false);
    assert.equal(still.tool, "ret-finaliser");
    assert.equal(still.engine, "seedvr2");
    const graph = grapheFinition({ video: "kept.mp4" });
    assert.equal(regenere(graph), false);
    assert.equal(Object.values(graph).some(node => /KSampler|EmptyLatent|WanImageToVideo/.test(node.class_type)), false);
  });
});
