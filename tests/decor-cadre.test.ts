import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CADRE_PHOTOS_MAX, cadrePrompt, cadreQuote } from "../src/lib/creation/decor-cadre.ts";
import { stillGraph } from "../src/lib/creation/still.ts";

type Node = { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } };

function nodes(graph: ReturnType<typeof stillGraph>): [string, Node][] {
  return Object.entries(graph) as [string, Node][];
}

describe("décor depuis un cadre 3D", () => {
  it("quotes one Klein edit per photo count, and refuses 0 or more than 3 photos", () => {
    assert.equal(CADRE_PHOTOS_MAX, 3);
    assert.deepEqual([1, 2, 3].map(n => cadreQuote(n)).map(q => [q?.credits, q?.high]), [[4, 8], [5, 9], [6, 10]]);
    assert.equal(cadreQuote(1)?.template, "image_flux3_klein_image_edit");
    assert.equal(cadreQuote(0), null);
    assert.equal(cadreQuote(4), null);
    assert.equal(cadreQuote(1.5), null);
  });

  it("asks to keep image 1's camera and take the look of images 2 to N, with no people or text", () => {
    const one = cadrePrompt({ photos: 1, ambiance: "photos" });
    assert.match(one, /Image 1 is a 3D frame/);
    assert.match(one, /keep its exact camera position, angle, lens, composition and building volumes/);
    assert.match(one, /from image 2,/);
    assert.match(one, /16:9/);
    assert.match(one, /No people/);
    assert.match(one, /No text/);
    const three = cadrePrompt({ photos: 3, ambiance: "nuit", detail: "  pavés   mouillés " });
    assert.match(three, /from images 2 to 4/);
    assert.match(three, /Night/);
    assert.ok(three.endsWith("pavés mouillés"));
    assert.ok(cadrePrompt({ photos: 1, ambiance: "pluie", detail: "x".repeat(400) }).split("\n").at(-1)!.length <= 240);
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

  it("refuses a cadre without a photo, and any engine other than Klein", () => {
    assert.throws(() => stillGraph({ kind: "cadre-decor", prompt: "x", images: ["cadre.png"], seed: 1 }), /photo du lieu/);
    assert.throws(() => stillGraph({ kind: "cadre-decor", prompt: "x", images: [], seed: 1 }), /cadre 3D/);
    assert.throws(() => stillGraph({ kind: "cadre-decor", prompt: "x", images: ["cadre.png", "a.png"], seed: 1, template: "api_bfl_flux3_image" }), /Klein/);
  });
});
