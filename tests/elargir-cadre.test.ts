import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cadreDefaut, cadreRatio, padsVersCadre, VIDEO_CADRE_TAILLE, CADRES_VIDEO } from "../src/lib/outils/cadre.ts";
import { outilParId } from "../src/lib/outils/catalogue.ts";
import { outilGraph, outilQuote } from "../src/lib/outils/graphs.ts";
import { ELARGIR_CONSIGNE, videoGesteGraph } from "../src/lib/render/video-gestes.ts";
import { suiteGraph } from "../src/lib/suite/graphs.ts";
import type { ApiGraph } from "../src/lib/render/take-graph.ts";

/** Runs the graph's integer math the way Comfy does, for the nodes this test needs. */
function evalMath(graph: ApiGraph, id: string, slot: number, known: Record<string, number[]>): number {
  if (known[id]) return known[id][slot];
  const node = graph[id];
  if (node.class_type === "PrimitiveInt") return Number(node.inputs.value);
  assert.equal(node.class_type, "ComfyMathExpression", id);
  const values: Record<string, number> = {};
  for (const [key, value] of Object.entries(node.inputs)) {
    if (!key.startsWith("values.")) continue;
    const [from, at] = value as [string, number];
    values[key.slice(7)] = evalMath(graph, from, at, known);
  }
  const fn = new Function(...Object.keys(values), "max", `return ${String(node.inputs.expression)};`);
  const out = Number(fn(...Object.values(values), Math.max));
  return slot === 1 ? Math.trunc(out) : out;
}

describe("Élargir une vidéo : cadre choisi", () => {
  const files = { video_1: "plan.mp4" };

  it("sends the chosen ratio to the padding math and renders ≈ 720p, never the template's 9:16 half size", () => {
    for (const cadre of CADRES_VIDEO) {
      const graph = videoGesteGraph({ geste: "prise-elargir", files, prompt: "", seed: 1, cadre });
      const [w, h] = cadre.split(":").map(Number);
      assert.equal(graph["5151:5097"].inputs.value, w, cadre);
      assert.equal(graph["5151:5098"].inputs.value, h, cadre);
      const scale = graph["5151:5129"].inputs;
      assert.equal(scale.resize_type, "scale dimensions");
      assert.equal("resize_type.multiplier" in scale, false);
      assert.equal(scale["resize_type.width"], VIDEO_CADRE_TAILLE[cadre].rendu.width);
      assert.equal(scale["resize_type.height"], VIDEO_CADRE_TAILLE[cadre].rendu.height);
      assert.equal(Number(scale["resize_type.width"]) % 32, 0);
      assert.equal(Number(scale["resize_type.height"]) % 32, 0);
      const out = graph["5151:sortie"].inputs;
      assert.deepEqual(graph["5152"].inputs.images, ["5151:sortie", 0]);
      assert.deepEqual(out.input, ["5151:5143", 0]);
      assert.equal(Number(out["resize_type.width"]) / Number(out["resize_type.height"]), cadreRatio(cadre), cadre);
      assert.ok(Math.min(Number(out["resize_type.width"]), Number(out["resize_type.height"])) >= 720, cadre);
    }
  });

  it("a 464×688 portrait padded to 16:9 grows wider, never shrinks (bug: 224×384 out)", () => {
    const graph = videoGesteGraph({ geste: "prise-elargir", files, prompt: "", seed: 1, cadre: "16:9" });
    // VHS_VideoInfo source width (3) and height (4), as Comfy reads them.
    const known = { "5151:5137": [0, 0, 0, 464, 688, 24] };
    const width = evalMath(graph, "5151:5149", 1, known);
    const height = evalMath(graph, "5151:5150", 1, known);
    assert.equal(height, 688);
    assert.ok(Math.abs(width / height - 16 / 9) < 0.01, `${width}×${height}`);
    assert.deepEqual(graph["5151:5139"].inputs.target_width, ["5151:5149", 1]);
    assert.deepEqual(graph["5151:5139"].inputs.target_height, ["5151:5150", 1]);
    const out = graph["5151:sortie"].inputs;
    assert.equal(out["resize_type.width"], 1280);
    assert.equal(out["resize_type.height"], 720);
  });

  it("defaults to 16:9 and keeps an optional consigne", () => {
    const empty = videoGesteGraph({ geste: "prise-elargir", files, prompt: "", seed: 1 });
    assert.equal(empty["5151:5097"].inputs.value, 16);
    assert.equal(empty["5151:5138"].inputs.text, ELARGIR_CONSIGNE);
    const said = videoGesteGraph({ geste: "prise-elargir", files, prompt: "une forêt la nuit", seed: 1 });
    assert.match(String(said["5151:5138"].inputs.text), /une forêt la nuit$/);
  });

  it("the hub tool passes the visitor's frame and quotes per started 5 s block", () => {
    const outil = outilParId("vid-recadrer")!;
    assert.deepEqual(outil.reglages, ["cadre"]);
    assert.equal(outil.texte, "facultatif");
    const graph = outilGraph(outil, { files: { video: "plan.mp4" }, prompt: "", seed: 2, elargir: "9:16" });
    assert.equal(graph["5151:5097"].inputs.value, 9);
    assert.equal(graph["5151:5098"].inputs.value, 16);
    assert.equal(outilQuote(outil), null, "waits for the clip length");
    const five = outilQuote(outil, { seconds: 5 })!;
    const ten = outilQuote(outil, { seconds: 10 })!;
    assert.ok(five.credits >= 25, "720p outpaint costs at least what Effacer measured at 1280×704");
    assert.equal(ten.credits, five.credits * 2);
  });
});

describe("Élargir une image : cadre exact", () => {
  it("pads to the exact ratio, centred, never cropping", () => {
    assert.deepEqual(padsVersCadre({ width: 464, height: 688 }, "16:9"), { left: 379, top: 0, right: 380, bottom: 0, width: 1223, height: 688 });
    assert.deepEqual(padsVersCadre({ width: 1920, height: 1080 }, "9:16"), { left: 0, top: 1166, right: 0, bottom: 1167, width: 1920, height: 3413 });
    const sq = padsVersCadre({ width: 800, height: 600 }, "1:1");
    assert.equal(sq.width, sq.height);
    const four = padsVersCadre({ width: 1024, height: 1024 }, "4:3");
    assert.ok(Math.abs(four.width / four.height - 4 / 3) < 0.002);
  });

  it("wires Comfy's measured working size into the outpaint pads, same math as padsVersCadre", () => {
    const graph = suiteGraph({ geste: "suite-elargir", files: { source: "a.png" }, prompt: "", seed: 1, elargir: "16:9" });
    assert.deepEqual(graph["e:size"].inputs.image, ["147", 0]);
    const pads = graph["164"].inputs;
    // 464×688 at 1.5 MP ≈ 1006×1491.
    const known = { "e:size": [1006, 1491, 1] };
    const got = Object.fromEntries(["left", "top", "right", "bottom"].map(side => {
      const [from, at] = pads[side] as [string, number];
      return [side, evalMath(graph, from, at, known)];
    }));
    const want = padsVersCadre({ width: 1006, height: 1491 }, "16:9");
    assert.deepEqual(got, { left: want.left, top: want.top, right: want.right, bottom: want.bottom });
    assert.ok(Math.abs((1006 + got.left + got.right) / (1491 + got.top + got.bottom) - 16 / 9) < 0.002);
  });

  it("keeps the fixed bands as the advanced choice", () => {
    const graph = suiteGraph({ geste: "suite-elargir", files: { source: "a.png" }, prompt: "", seed: 1, elargir: "cotes" });
    assert.equal(graph["164"].inputs.left, 384);
    assert.equal(graph["e:size"], undefined);
  });

  it("picks 16:9 for a portrait, 9:16 for a wide source", () => {
    assert.equal(cadreDefaut({ width: 464, height: 688 }), "16:9");
    assert.equal(cadreDefaut({ width: 1920, height: 1080 }), "9:16");
    assert.equal(cadreDefaut(null), "16:9");
  });
});
