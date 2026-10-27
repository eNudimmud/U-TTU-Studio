import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CADRE_PHOTOS_MAX, cadreImages, cadrePrompt, cadreQuote } from "../src/lib/creation/decor-cadre.ts";
import { stillEngine, stillGraph } from "../src/lib/creation/still.ts";
import { estimateProgressPercent, estimateRemainingSec, formatClock, TYPICAL_WAIT_SEC } from "../src/lib/creation/comfy-progress.ts";
import { INSTANTX_CADRE_TEMPLATE } from "../src/lib/render/instantx-cadre.ts";

type Node = { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } };

function nodes(graph: ReturnType<typeof stillGraph>): [string, Node][] {
  return Object.entries(graph) as [string, Node][];
}

describe("décor depuis un cadre 3D", () => {
  it("quotes InstantX + Lotus flat: ≈ 5 crédits (cap 8), any photo count 0–3", () => {
    assert.equal(CADRE_PHOTOS_MAX, 3);
    assert.deepEqual([0, 1, 2, 3].map(n => cadreQuote(n)).map(q => [q?.credits, q?.high, q?.template]), [
      [5, 8, INSTANTX_CADRE_TEMPLATE],
      [5, 8, INSTANTX_CADRE_TEMPLATE],
      [5, 8, INSTANTX_CADRE_TEMPLATE],
      [5, 8, INSTANTX_CADRE_TEMPLATE],
    ]);
    assert.equal(cadreQuote(-1), null);
    assert.equal(cadreQuote(4), null);
    assert.equal(cadreQuote(1.5), null);
  });

  it("prompt locks the 3D massing as structure and asks for a real photograph", () => {
    const one = cadrePrompt({ photos: 1, ambiance: "photos" });
    assert.match(one, /Photorealistic elevated photograph/);
    assert.match(one, /grey untextured 3D massing/);
    assert.match(one, /depth guide/);
    assert.match(one, /Match materials, colours, weathering/);
    assert.match(one, /Do not invent a lake, sea or open water/);
    assert.match(one, /16:9/);
    assert.match(one, /empty of people/);
    assert.match(one, /No text/);
    assert.match(one, /no clay|no untextured massing/);
    // Photos never addressed as image N — they are not uploaded.
    assert.doesNotMatch(one, /image 2/);
    assert.doesNotMatch(one, /from image 1/);
    const three = cadrePrompt({ photos: 3, ambiance: "nuit", detail: "  pavés   mouillés " });
    assert.match(three, /Night/);
    assert.match(three, /The visitor's wish, in their own words: "pavés mouillés"\./);
    assert.match(three, /structural guide's camera, framing and building layout stay exactly the same/);
    assert.match(three, /grey massing look must still be fully replaced/);
    assert.ok(!cadrePrompt({ photos: 1, ambiance: "pluie", detail: "x".repeat(400) }).includes("x".repeat(241)));
  });

  it("legacy layout aliases still produce the InstantX structure prompt", () => {
    const text = cadrePrompt({ photos: 3, ambiance: "photos", layout: "photo-lines" });
    assert.match(text, /Photorealistic elevated photograph/);
    assert.match(text, /grey untextured 3D massing/);
    assert.doesNotMatch(text, /black-and-white edge drawing/);
    const frame = cadrePrompt({ photos: 0, ambiance: "aube", layout: "frame-first", detail: "brume" });
    assert.match(frame, /Dawn/);
    assert.match(frame, /"brume"/);
  });

  it("cadreImages always returns only the colour frame (depth-control)", () => {
    const frame = new File([new Uint8Array([1])], "cadre.png", { type: "image/png" });
    const lines = new File([new Uint8Array([2])], "lines.png", { type: "image/png" });
    const a = new File([new Uint8Array([3])], "a.jpg", { type: "image/jpeg" });
    const b = new File([new Uint8Array([4])], "b.jpg", { type: "image/jpeg" });
    const c = new File([new Uint8Array([5])], "c.jpg", { type: "image/jpeg" });
    const withLines = cadreImages({ frame, lines, photos: [a, b, c] });
    assert.equal(withLines.layout, "depth-control");
    assert.equal(withLines.photos, 3);
    assert.deepEqual(withLines.files.map(f => f.name), ["cadre.png"]);
    const noLines = cadreImages({ frame, photos: [a, b] });
    assert.equal(noLines.layout, "depth-control");
    assert.deepEqual(noLines.files.map(f => f.name), ["cadre.png"]);
    const alone = cadreImages({ frame, lines, photos: [] });
    assert.equal(alone.layout, "depth-control");
    assert.deepEqual(alone.files.map(f => f.name), ["cadre.png"]);
  });

  it("a wish without photos replaces the default daylight and keeps the frame authoritative", () => {
    const text = cadrePrompt({ photos: 0, ambiance: "photos", detail: 'Sous la neige, "lampions"' });
    assert.doesNotMatch(text, /Natural daylight/);
    assert.doesNotMatch(text, /image 2/);
    assert.match(text, /"Sous la neige, 'lampions'"/);
    assert.match(text, /mood, season, time of day, weather, materials and added elements\.$/m);
    assert.match(text, /no people and no text/);
    assert.equal(cadreQuote(0)?.credits, 5);
    assert.match(cadrePrompt({ photos: 0, ambiance: "nuit", detail: "brume" }), /Night/);
  });

  it("builds one InstantX + Lotus graph: single LoadImage, ControlNet, Lotus depth, 4-step sampler", () => {
    assert.equal(stillEngine(INSTANTX_CADRE_TEMPLATE), "instantx");
    const prompt = cadrePrompt({ photos: 3, ambiance: "aube" });
    const graph = stillGraph({
      kind: "cadre-decor",
      prompt,
      images: ["cadre.png", "a.png", "b.png"],
      seed: 7,
      template: INSTANTX_CADRE_TEMPLATE,
      cadreLayout: "depth-control",
    });
    const loads = nodes(graph).filter(([, node]) => node.class_type === "LoadImage");
    assert.equal(loads.length, 1);
    assert.equal(loads[0]![1].inputs.image, "cadre.png");
    assert.equal(loads[0]![1]._meta?.title, "Cadre 3D (base fixe)");
    assert.ok(nodes(graph).some(([, node]) => node.class_type === "ControlNetApplyAdvanced"));
    assert.ok(nodes(graph).some(([, node]) => node.class_type === "LotusConditioning"));
    assert.ok(nodes(graph).some(([, node]) => node.class_type === "ImageInvert"));
    const sampler = nodes(graph).find(([, node]) => node.class_type === "KSampler")![1];
    assert.equal(sampler.inputs.steps, 4);
    assert.equal(sampler.inputs.seed, 7);
    const text = nodes(graph).find(([id]) => id === "111:6")![1];
    assert.equal(text.inputs.text, prompt);
    assert.equal((graph["60"] as Node).class_type, "SaveImageAdvanced");
    // Extra images in the call are ignored — InstantX takes the frame only.
    assert.doesNotMatch(JSON.stringify(graph), /a\.png/);
  });

  it("routes cadre-decor to InstantX even when the template string is absent", () => {
    const graph = stillGraph({ kind: "cadre-decor", prompt: cadrePrompt({ photos: 0, ambiance: "photos" }), images: ["cadre.png"], seed: 1 });
    assert.ok(nodes(graph).some(([, node]) => node.class_type === "ControlNetLoader"));
  });

  it("direct path: place context in the prompt, the frame as the only image", () => {
    const text = cadrePrompt({ photos: 0, ambiance: "photos", contexte: ["The place is real: City Center, New York, United States.", "In view: Central Park (park) ahead."] });
    assert.doesNotMatch(text, /image 2/);
    assert.match(text, /Invent plausible real façades/);
    assert.match(text, /City Center, New York/);
    assert.match(text, /Central Park \(park\) ahead/);
    assert.match(text, /Natural daylight/);
    const graph = stillGraph({ kind: "cadre-decor", prompt: text, images: ["cadre.png"], seed: 1, template: INSTANTX_CADRE_TEMPLATE });
    assert.deepEqual(nodes(graph).filter(([, node]) => node.class_type === "LoadImage").map(([, node]) => node.inputs.image), ["cadre.png"]);
  });

  it("refuses a cadre without the frame, and any partner engine other than InstantX", () => {
    assert.throws(() => stillGraph({ kind: "cadre-decor", prompt: "x", images: [], seed: 1 }), /cadre 3D/);
    assert.throws(
      () => stillGraph({ kind: "cadre-decor", prompt: "x", images: ["a.png"], seed: 1, template: "api_bfl_flux3_pro" }),
      /InstantX ControlNet/,
    );
  });
});

describe("comfy progress estimate", () => {
  it("eases toward 98 % and keeps moving past the typical window", () => {
    assert.equal(estimateProgressPercent(0, 40), 0);
    assert.ok(estimateProgressPercent(20, 40) > 40);
    assert.ok(estimateProgressPercent(20, 40) < 88);
    assert.equal(estimateProgressPercent(40, 40), 88);
    assert.ok(estimateProgressPercent(80, 40) <= 98);
    assert.ok(estimateProgressPercent(80, 40) > 88);
    assert.equal(estimateProgressPercent(10_000, 40), 98);
    assert.ok(estimateProgressPercent(30, null) > 0);
    assert.ok(estimateProgressPercent(30, null) <= 92);
    assert.ok((estimateRemainingSec(80, 40) ?? 0) >= 5);
  });

  it("remaining seconds and clock formatting", () => {
    assert.equal(estimateRemainingSec(10, 40), 30);
    assert.ok((estimateRemainingSec(50, 40) ?? 0) >= 5);
    assert.equal(estimateRemainingSec(10, null), null);
    assert.equal(formatClock(9), "9 s");
    assert.equal(formatClock(60), "1 min");
    assert.equal(formatClock(75), "1 min 15 s");
    assert.ok(TYPICAL_WAIT_SEC["cadre-decor"] > 0);
    assert.ok(TYPICAL_WAIT_SEC.prise > 0);
  });
});
