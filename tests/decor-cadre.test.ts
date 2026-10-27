import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CADRE_PHOTOS_MAX, cadreImages, cadrePrompt, cadreQuote } from "../src/lib/creation/decor-cadre.ts";
import { stillGraph } from "../src/lib/creation/still.ts";
import { estimateProgressPercent, estimateRemainingSec, formatClock, TYPICAL_WAIT_SEC } from "../src/lib/creation/comfy-progress.ts";

type Node = { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } };

function nodes(graph: ReturnType<typeof stillGraph>): [string, Node][] {
  return Object.entries(graph) as [string, Node][];
}

describe("décor depuis un cadre 3D", () => {
  it("quotes one Klein edit: ≈ 4 for the frame alone (cap 6), one more per photo, and refuses more than 3 photos", () => {
    assert.equal(CADRE_PHOTOS_MAX, 3);
    assert.deepEqual([0, 1, 2, 3].map(n => cadreQuote(n)).map(q => [q?.credits, q?.high]), [[4, 6], [5, 7], [6, 8], [7, 9]]);
    assert.equal(cadreQuote(0)?.template, "image_flux3_klein_image_edit");
    assert.equal(cadreQuote(-1), null);
    assert.equal(cadreQuote(4), null);
    assert.equal(cadreQuote(1.5), null);
  });

  it("asks to convert the grey 3D massing into a real photo, structure only from image 1, look from images 2 to N", () => {
    const one = cadrePrompt({ photos: 1, ambiance: "photos" });
    assert.match(one, /Convert the entire image 1 into a real photograph/);
    assert.match(one, /grey untextured 3D massing/);
    assert.match(one, /structure only/);
    assert.match(one, /depth or canny guide/);
    assert.match(one, /from image 2/);
    assert.match(one, /Do not invent a lake, sea or open water/);
    assert.match(one, /16:9/);
    assert.match(one, /empty of people/);
    assert.match(one, /No text/);
    assert.match(one, /not a tinted 3D model|no clay|no untextured massing/);
    const three = cadrePrompt({ photos: 3, ambiance: "nuit", detail: "  pavés   mouillés " });
    assert.match(three, /from images 2 to 4/);
    assert.match(three, /Night/);
    assert.match(three, /The visitor's wish, in their own words: "pavés mouillés"\./);
    assert.match(three, /where it differs from images 2 to 4, the wish wins/);
    assert.match(three.split("\n").at(-1)!, /image 1's camera, framing and building layout stay exactly the same/);
    assert.match(three.split("\n").at(-1)!, /grey massing look must still be fully replaced/);
    assert.ok(!cadrePrompt({ photos: 1, ambiance: "pluie", detail: "x".repeat(400) }).includes("x".repeat(241)));
  });

  it("photo-lines layout: image 1 style photo, image 2 edges as structure, no water invented", () => {
    const text = cadrePrompt({ photos: 3, ambiance: "photos", layout: "photo-lines" });
    assert.match(text, /Create a full-color outdoor photograph/);
    assert.match(text, /from image 2 — a black-and-white edge drawing/);
    assert.match(text, /from image 1 and images 3 to 4/);
    assert.match(text, /Do not invent a lake, sea or open water/);
    assert.match(text, /no metallic CG look/);
    assert.doesNotMatch(text, /grey untextured 3D massing/);
    const one = cadrePrompt({ photos: 1, ambiance: "aube", layout: "photo-lines", detail: "brume" });
    assert.match(one, /from image 1 \(street photos/);
    assert.match(one, /image 2's camera, framing and building layout stay exactly the same/);
    // Without photos, photo-lines falls back to frame-first.
    assert.match(cadrePrompt({ photos: 0, ambiance: "photos", layout: "photo-lines" }), /Convert the entire image 1/);
  });

  it("cadreImages puts a style photo first when lines exist, otherwise the colour frame", () => {
    const frame = new File([new Uint8Array([1])], "cadre.png", { type: "image/png" });
    const lines = new File([new Uint8Array([2])], "lines.png", { type: "image/png" });
    const a = new File([new Uint8Array([3])], "a.jpg", { type: "image/jpeg" });
    const b = new File([new Uint8Array([4])], "b.jpg", { type: "image/jpeg" });
    const c = new File([new Uint8Array([5])], "c.jpg", { type: "image/jpeg" });
    const withLines = cadreImages({ frame, lines, photos: [a, b, c] });
    assert.equal(withLines.layout, "photo-lines");
    assert.equal(withLines.photos, 3);
    assert.deepEqual(withLines.files.map(f => f.name), ["a.jpg", "lines.png", "b.jpg", "c.jpg"]);
    const noLines = cadreImages({ frame, photos: [a, b] });
    assert.equal(noLines.layout, "frame-first");
    assert.deepEqual(noLines.files.map(f => f.name), ["cadre.png", "a.jpg", "b.jpg"]);
    const alone = cadreImages({ frame, lines, photos: [] });
    assert.equal(alone.layout, "frame-first");
    assert.deepEqual(alone.files.map(f => f.name), ["cadre.png"]);
  });

  it("a wish without photos replaces the default daylight, keeps the frame authoritative, and quotes safely", () => {
    const text = cadrePrompt({ photos: 0, ambiance: "photos", detail: 'Sous la neige, "lampions"' });
    assert.doesNotMatch(text, /Natural daylight/);
    assert.doesNotMatch(text, /image 2/);
    assert.match(text, /"Sous la neige, 'lampions'"/);
    assert.match(text, /mood, season, time of day, weather, materials and added elements\.$/m);
    assert.match(text.split("\n").at(-1)!, /no people and no text/);
    assert.equal(cadreQuote(0)?.credits, 4);
    assert.match(cadrePrompt({ photos: 0, ambiance: "nuit", detail: "brume" }), /Night/);
  });

  it("builds one Klein edit graph: the frame is image 1, then up to three photos", () => {
    const prompt = cadrePrompt({ photos: 3, ambiance: "aube" });
    const graph = stillGraph({ kind: "cadre-decor", prompt, images: ["cadre.png", "a.png", "b.png", "c.png", "extra.png"], seed: 7 });
    const loads = nodes(graph).filter(([, node]) => node.class_type === "LoadImage");
    assert.deepEqual(loads.map(([, node]) => node.inputs.image), ["cadre.png", "a.png", "b.png", "c.png"]);
    assert.equal((graph.load as Node)._meta?.title, "Cadre 3D (base fixe)");
    const multi = nodes(graph).find(([, node]) => node.class_type === "ReferenceMultiLatent")![1];
    assert.deepEqual(multi.inputs["images.image0"], ["load", 0]);
    assert.equal(Object.keys(multi.inputs).filter(key => key.startsWith("images.image")).length, 4);
    const text = nodes(graph).find(([id, node]) => node.class_type === "PrimitiveStringMultiline" && id === "klein_61")![1];
    assert.equal(text.inputs.value, prompt);
    assert.equal(nodes(graph).filter(([, node]) => node.class_type === "KSampler").length, 1);
  });

  it("photo-lines graph titles: style photo, then edges, then more photos", () => {
    const prompt = cadrePrompt({ photos: 2, ambiance: "photos", layout: "photo-lines" });
    const graph = stillGraph({
      kind: "cadre-decor",
      prompt,
      images: ["style.jpg", "lines.png", "b.jpg"],
      seed: 3,
      cadreLayout: "photo-lines",
    });
    assert.equal((graph.load as Node)._meta?.title, "Photo du lieu (style)");
    assert.equal((graph.load2 as Node)._meta?.title, "Cadre 3D (lignes / structure)");
    assert.equal((graph.load3 as Node)._meta?.title, "Photo du lieu 2");
  });

  it("direct path: no photo, the place and the view's context in the prompt, the frame as the only image", () => {
    const text = cadrePrompt({ photos: 0, ambiance: "photos", contexte: ["The place is real: City Center, New York, United States.", "In view: Central Park (park) ahead."] });
    assert.doesNotMatch(text, /image 2/);
    assert.match(text, /Invent plausible real façades/);
    assert.match(text, /City Center, New York/);
    assert.match(text, /Central Park \(park\) ahead/);
    assert.match(text, /Natural daylight/);
    assert.doesNotMatch(text, /reference photos/);
    const graph = stillGraph({ kind: "cadre-decor", prompt: text, images: ["cadre.png"], seed: 1 });
    assert.deepEqual(nodes(graph).filter(([, node]) => node.class_type === "LoadImage").map(([, node]) => node.inputs.image), ["cadre.png"]);
  });

  it("refuses a cadre without the frame, and any engine other than Klein", () => {
    assert.throws(() => stillGraph({ kind: "cadre-decor", prompt: "x", images: [], seed: 1 }), /cadre 3D/);
    assert.throws(() => stillGraph({ kind: "cadre-decor", prompt: "x", images: ["a.png"], seed: 1, template: "api_bfl_flux3_pro" }), /FLUX 3 Klein/);
  });
});

describe("comfy progress estimate", () => {
  it("eases toward 95 % and never exceeds it before done", () => {
    assert.equal(estimateProgressPercent(0, 40), 0);
    assert.ok(estimateProgressPercent(20, 40) > 40);
    assert.ok(estimateProgressPercent(20, 40) < 90);
    assert.equal(estimateProgressPercent(40, 40), 90);
    assert.ok(estimateProgressPercent(80, 40) <= 95);
    assert.equal(estimateProgressPercent(10_000, 40), 95);
    assert.ok(estimateProgressPercent(30, null) > 0);
    assert.ok(estimateProgressPercent(30, null) <= 90);
  });

  it("remaining seconds and clock formatting", () => {
    assert.equal(estimateRemainingSec(10, 40), 30);
    assert.equal(estimateRemainingSec(50, 40), 0);
    assert.equal(estimateRemainingSec(10, null), null);
    assert.equal(formatClock(9), "9 s");
    assert.equal(formatClock(60), "1 min");
    assert.equal(formatClock(75), "1 min 15 s");
    assert.ok(TYPICAL_WAIT_SEC["cadre-decor"] > 0);
    assert.ok(TYPICAL_WAIT_SEC.prise > 0);
  });
});
