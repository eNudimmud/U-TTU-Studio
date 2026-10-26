import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CADRE_PHOTOS_MAX, cadrePrompt, cadreQuote } from "../src/lib/creation/decor-cadre.ts";
import { stillGraph } from "../src/lib/creation/still.ts";

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

  it("asks to keep image 1's camera and take the look of images 2 to N, with no people or text", () => {
    const one = cadrePrompt({ photos: 1, ambiance: "photos" });
    assert.match(one, /Image 1 is a 3D frame/);
    assert.match(one, /keep its exact camera position, eye level, angle, lens, composition and building volumes/);
    assert.match(one, /from image 2,/);
    assert.match(one, /16:9/);
    assert.match(one, /No people/);
    assert.match(one, /No text/);
    const three = cadrePrompt({ photos: 3, ambiance: "nuit", detail: "  pavés   mouillés " });
    assert.match(three, /from images 2 to 4/);
    assert.match(three, /Night/);
    assert.match(three, /The visitor's wish, in their own words: "pavés mouillés"\./);
    assert.match(three, /where it differs from images 2 to 4, the wish wins/);
    assert.match(three.split("\n").at(-1)!, /^Whatever the wish says, image 1's camera, framing and building volumes stay exactly the same/);
    assert.ok(!cadrePrompt({ photos: 1, ambiance: "pluie", detail: "x".repeat(400) }).includes("x".repeat(241)));
  });

  it("a wish without photos replaces the default daylight, keeps the frame authoritative, and quotes safely", () => {
    const text = cadrePrompt({ photos: 0, ambiance: "photos", detail: 'Sous la neige, "lampions"' });
    assert.doesNotMatch(text, /Natural daylight/);
    assert.doesNotMatch(text, /image 2/);
    assert.match(text, /"Sous la neige, 'lampions'"/);
    assert.match(text, /mood, season, time of day, weather, materials and added elements\.$/m);
    assert.match(text.split("\n").at(-1)!, /no people and no text\.$/);
    assert.equal(cadreQuote(0)?.credits, 4); // the text costs nothing more: the quote only counts photos
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

  it("direct path: no photo, the place and the view's context in the prompt, the frame as the only image", () => {
    const text = cadrePrompt({ photos: 0, ambiance: "photos", contexte: ["The place is real: City Center, New York, United States.", "In view: Central Park (park) ahead."] });
    assert.doesNotMatch(text, /image 2/);
    assert.match(text, /real façades/);
    assert.match(text, /City Center, New York/);
    assert.match(text, /Central Park \(park\) ahead/);
    assert.match(text, /Natural daylight/);
    assert.doesNotMatch(text, /reference photos/);
    const graph = stillGraph({ kind: "cadre-decor", prompt: text, images: ["cadre.png"], seed: 1 });
    assert.deepEqual(nodes(graph).filter(([, node]) => node.class_type === "LoadImage").map(([, node]) => node.inputs.image), ["cadre.png"]);
  });

  it("refuses a cadre without the frame, and any engine other than Klein", () => {
    assert.throws(() => stillGraph({ kind: "cadre-decor", prompt: "x", images: [], seed: 1 }), /cadre 3D/);
    assert.throws(() => stillGraph({ kind: "cadre-decor", prompt: "x", images: ["cadre.png", "a.png"], seed: 1, template: "api_bfl_flux3_image" }), /Klein/);
  });
});
