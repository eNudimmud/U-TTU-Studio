import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KLEIN_BASE_CFG } from "../src/lib/render/klein-graph.ts";
import { ltxTakeGraph } from "../src/lib/render/ltx-graph.ts";
import { stillGraph } from "../src/lib/creation/still.ts";
import { suiteGraph } from "../src/lib/suite/graphs.ts";
import type { ApiGraph } from "../src/lib/render/take-graph.ts";

/** The cfg of every KSampler-like node running the Klein base checkpoint or the distilled 9B. */
function samplerCfg(graph: ApiGraph, unet: RegExp): number[] {
  const loaders = Object.entries(graph).filter(([, node]) => typeof node.inputs.unet_name === "string" && unet.test(node.inputs.unet_name as string)).map(([id]) => id);
  assert.ok(loaders.length > 0, `no loader for ${unet}`);
  return Object.values(graph).filter(node => typeof node.inputs.cfg === "number").map(node => node.inputs.cfg as number);
}

const BASE = /flux3-image-klein-base/;

describe("Klein base guidance (30.10.2026 before/after)", () => {
  it("guides place edits (décor photo, change the time) at cfg 3.5", () => {
    const graph = stillGraph({ kind: "photo-decor", prompt: "À l’aube.", images: ["rue.jpg"], seed: 1 });
    assert.deepEqual(samplerCfg(graph, BASE), [KLEIN_BASE_CFG]);
    assert.equal(KLEIN_BASE_CFG, 3.5);
  });

  it("keeps CAST photo edits at cfg 1: at 3.5 the same job lost the hood, braids and costume", () => {
    const graph = stillGraph({ kind: "photo-cast", prompt: "Même personne.", images: ["uttu.jpg"], seed: 1 });
    assert.deepEqual(samplerCfg(graph, BASE), [1]);
  });

  it("guides the « Modifier » next step at cfg 3.5", () => {
    const graph = suiteGraph({ geste: "suite-modifier", files: { source: "toit.png" }, prompt: "Ajoute de la neige.", seed: 1 });
    assert.deepEqual(samplerCfg(graph, BASE), [KLEIN_BASE_CFG]);
  });

  it("leaves the distilled Klein 9B (élargir) at cfg 1", () => {
    const graph = suiteGraph({ geste: "suite-elargir", files: { source: "plan.png" }, prompt: "", seed: 1 });
    const cfgs = samplerCfg(graph, /flux-2-klein-9b/);
    assert.ok(cfgs.length > 0);
    for (const cfg of cfgs) assert.equal(cfg, 1);
  });

  it("guides the PRISE first frame at cfg 3.5", () => {
    const graph = ltxTakeGraph({ prompt: "Uttu entre dans le parc.", pictures: ["uttu.jpg", "parc.jpg"], seconds: 5, aspect: "horizontal", seed: 7 });
    const frame = Object.entries(graph).filter(([id, node]) => id.startsWith("frame_") && typeof node.inputs.cfg === "number");
    assert.equal(frame.length, 1);
    assert.equal(frame[0][1].inputs.cfg, KLEIN_BASE_CFG);
  });
});
