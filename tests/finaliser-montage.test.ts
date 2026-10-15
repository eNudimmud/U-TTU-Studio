import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { FINAL_MAX_SECONDS, finalFileId, finalGraph, finalQuote, finalSize } from "../src/lib/montage/finaliser.ts";

describe("Finaliser le montage (R8)", () => {
  it("quotes one pass on the whole edit from the measured numbers", () => {
    assert.deepEqual(finalQuote(5, { resolution: "1080p", nettoyer: "aucun" }), { credits: 4.1, ceiling: 6.5, kind: "mesure" });
    const thirty = finalQuote(30, { resolution: "1080p", nettoyer: "aucun" });
    assert.equal(thirty?.credits, 4.5);
    assert.equal(thirty?.kind, "mesure");
    assert.equal(finalQuote(30, { resolution: "4k", nettoyer: "aucun" })?.kind, "estimation");
    assert.equal(finalQuote(30, { resolution: "1080p", nettoyer: "bruit" })?.kind, "estimation");
    assert.equal(finalQuote(0, { resolution: "1080p", nettoyer: "aucun" }), null);
    assert.equal(finalQuote(FINAL_MAX_SECONDS + 1, { resolution: "1080p", nettoyer: "aucun" }), null);
    for (const s of [1, 12, 45, 60]) {
      const q = finalQuote(s, { resolution: "4k", nettoyer: "flou" })!;
      assert.ok(q.ceiling > q.credits);
    }
  });

  it("builds a graph that never regenerates and keeps the sound", () => {
    const graph = finalGraph({ file: "uttu-montage.mp4", ratio: "9/16", resolution: "1080p", nettoyer: "aucun" });
    const types = Object.values(graph).map(node => node.class_type);
    assert.deepEqual(types, ["LoadVideo", "GetVideoComponents", "RTXVideoSuperResolution", "CreateVideo", "SaveVideo"]);
    assert.deepEqual(graph.video.inputs.audio, ["parts", 1]);
    assert.equal(graph.upscale.inputs["resize_type.width"], 1080);
    assert.equal(graph.upscale.inputs["resize_type.height"], 1920);
    const clean = finalGraph({ file: "a.mp4", ratio: "16/9", resolution: "4k", nettoyer: "flou" });
    assert.equal(clean.clean.inputs.quality, "DEBLUR_HIGH");
    assert.deepEqual(clean.upscale.inputs.images, ["clean", 0]);
    assert.deepEqual(finalSize("4k", "16/9"), { width: 3840, height: 2160 });
    assert.doesNotMatch(JSON.stringify(clean), /KSampler|Wan|SeedVR|fal/i);
  });

  it("names the saved file for Mon studio", () => {
    assert.equal(finalFileId("Mon Été", "4k", new Date("2026-10-14T11:05:00Z")), "mon-ete-final-4k-202610141105");
  });

  it("wires MONTAGE with a quote, a confirm and no cancel", () => {
    const stage = readFileSync("src/components/app/montage-stage.tsx", "utf8");
    assert.match(stage, /data-finaliser-open/);
    assert.match(stage, /finaliser\.confirm/);
    assert.match(stage, /u-why-final-go/);
    const session = readFileSync("src/components/app/studio-session.tsx", "utf8");
    const body = session.slice(session.indexOf("const finaliseMontage"), session.indexOf("const rewriteCast"));
    assert.match(body, /spendAllowed\(quote\.credits, input\.confirmed\)/);
    assert.doesNotMatch(body, /cancel|signal/);
    assert.match(body, /\/Assets\//);
  });
});
