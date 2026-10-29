import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CADRE_PHOTOS_MAX, cadreImages, cadrePrompt, cadreQuote } from "../src/lib/creation/decor-cadre.ts";
import { stillEngine, stillGraph } from "../src/lib/creation/still.ts";
import { estimateProgressPercent, estimateRemainingSec, formatClock, TYPICAL_WAIT_SEC } from "../src/lib/creation/comfy-progress.ts";
import { INSTANTX_CADRE_TEMPLATE } from "../src/lib/render/instantx-cadre.ts";
import { DECOR_3D_STYLE_STRENGTH, DECOR_3D_TEMPLATE, decor3dGraph } from "../src/lib/render/decor-3d.ts";

type Node = { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } };

function nodes(graph: ReturnType<typeof stillGraph>): [string, Node][] {
  return Object.entries(graph) as [string, Node][];
}

describe("décor depuis un cadre 3D", () => {
  it("quotes FLUX depth + Redux flat: ≈ 6 crédits (cap 9), any photo count 0–3", () => {
    assert.equal(CADRE_PHOTOS_MAX, 3);
    assert.deepEqual([0, 1, 2, 3].map(n => cadreQuote(n)).map(q => [q?.credits, q?.high, q?.template]), [
      [6, 9, DECOR_3D_TEMPLATE],
      [6, 9, DECOR_3D_TEMPLATE],
      [6, 9, DECOR_3D_TEMPLATE],
      [6, 9, DECOR_3D_TEMPLATE],
    ]);
    assert.equal(cadreQuote(-1), null);
    assert.equal(cadreQuote(4), null);
    assert.equal(cadreQuote(1.5), null);
  });

  it("prompt describes a real photograph and never instructs about images", () => {
    const one = cadrePrompt({ photos: 1, ambiance: "photos" });
    assert.match(one, /^Photorealistic photograph/);
    assert.match(one, /16:9/);
    assert.match(one, /Empty of people/);
    assert.match(one, /No text/);
    assert.match(one, /no clay/);
    assert.match(one, /checkerboard façades/);
    assert.match(one, /windows, doors, cornices/);
    assert.match(one, /reference photos/);
    // Nothing the model could copy as text or read as a layout order.
    assert.doesNotMatch(one, /image \d|ref_image|structural guide|Do NOT|STYLE ONLY/);
    assert.doesNotMatch(cadrePrompt({ photos: 0, ambiance: "photos" }), /reference photos/);
    const three = cadrePrompt({ photos: 3, ambiance: "nuit", detail: "  pavés   mouillés " });
    assert.match(three, /Night/);
    assert.match(three, /^pavés mouillés\.$/m);
    assert.ok(!cadrePrompt({ photos: 1, ambiance: "pluie", detail: "x".repeat(400) }).includes("x".repeat(241)));
    assert.match(cadrePrompt({ photos: 0, ambiance: "photos", detail: 'Sous la neige, "lampions"' }), /Sous la neige, 'lampions'\./);
    assert.doesNotMatch(cadrePrompt({ photos: 0, ambiance: "photos", detail: "brume" }), /Natural daylight/);
  });

  it("cadreImages sends the colour frame first, then the photos (structure-style)", () => {
    const frame = new File([new Uint8Array([1])], "cadre.png", { type: "image/png" });
    const lines = new File([new Uint8Array([2])], "lines.png", { type: "image/png" });
    const a = new File([new Uint8Array([3])], "a.jpg", { type: "image/jpeg" });
    const b = new File([new Uint8Array([4])], "b.jpg", { type: "image/jpeg" });
    const c = new File([new Uint8Array([5])], "c.jpg", { type: "image/jpeg" });
    const d = new File([new Uint8Array([6])], "d.jpg", { type: "image/jpeg" });
    const packed = cadreImages({ frame, lines, photos: [a, b, c, d] });
    assert.equal(packed.layout, "structure-style");
    assert.equal(packed.photos, 3);
    assert.deepEqual(packed.files.map(f => f.name), ["cadre.png", "a.jpg", "b.jpg", "c.jpg"]);
    assert.deepEqual(cadreImages({ frame, lines, photos: [] }).files.map(f => f.name), ["cadre.png"]);
  });

  it("the structure is fed by the 3D view, the photos only reach the style input", () => {
    assert.equal(stillEngine(DECOR_3D_TEMPLATE), "decor3d");
    const prompt = cadrePrompt({ photos: 2, ambiance: "aube" });
    const graph = stillGraph({ kind: "cadre-decor", prompt, images: ["cadre.png", "a.jpg", "b.jpg"], seed: 7, template: DECOR_3D_TEMPLATE, cadreLayout: "structure-style" });
    const all = nodes(graph);
    const byId = new Map(all);
    const loadOf = (image: string) => all.find(([, node]) => node.class_type === "LoadImage" && node.inputs.image === image)![0];
    // Every node reachable downstream of a LoadImage.
    const downstream = (from: string): Set<string> => {
      const seen = new Set([from]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const [id, node] of all) {
          if (seen.has(id)) continue;
          if (Object.values(node.inputs).some(v => Array.isArray(v) && typeof v[0] === "string" && seen.has(v[0]))) { seen.add(id); grew = true; }
        }
      }
      return seen;
    };
    const fromView = downstream(loadOf("cadre.png"));
    const structure = all.find(([, node]) => node.class_type === "InstructPixToPixConditioning")!;
    // Structure control: its pixels come from the 3D view (through Lotus), and only from it.
    const pixels = structure[1].inputs.pixels as [string, number];
    assert.ok(fromView.has(pixels[0]));
    assert.equal(byId.get(pixels[0])!.class_type, "ImageInvert");
    for (const photo of ["a.jpg", "b.jpg"]) {
      const reach = downstream(loadOf(photo));
      assert.ok(!reach.has(pixels[0]), `${photo} must not feed the depth`);
      // A photo's first consumer is CLIP Vision, then Redux: nothing else.
      const users = all.filter(([, node]) => Object.values(node.inputs).some(v => Array.isArray(v) && v[0] === loadOf(photo)));
      assert.deepEqual(users.map(([, node]) => node.class_type), ["CLIPVisionEncode"]);
      const style = all.filter(([, node]) => node.class_type === "StyleModelApply" && reach.has((node.inputs.clip_vision_output as [string, number])[0]));
      assert.equal(style.length, 1);
      // No photo reaches a VAEEncode (the latent) or the depth LoRA.
      assert.ok(![...reach].some(id => byId.get(id)!.class_type === "VAEEncode"));
    }
    // The control stays on for every step: LoRA depth on the model, the pixels concatenated at each step.
    const sampler = all.find(([, node]) => node.class_type === "KSampler")![1];
    assert.deepEqual(sampler.inputs.positive, [structure[0], 0]);
    assert.deepEqual(sampler.inputs.latent_image, [structure[0], 2]);
    assert.equal(sampler.inputs.denoise, 1);
    assert.equal(sampler.inputs.cfg, 1);
    assert.equal(sampler.inputs.seed, 7);
    assert.equal(byId.get((sampler.inputs.model as [string])[0])!.inputs.lora_name, "flux1-depth-dev-lora.safetensors");
    const style = all.filter(([, node]) => node.class_type === "StyleModelApply").map(([, node]) => node.inputs);
    assert.deepEqual(style.map(v => [v.strength, v.strength_type]), [[DECOR_3D_STYLE_STRENGTH, "attn_bias"], [DECOR_3D_STYLE_STRENGTH, "attn_bias"]]);
    assert.equal(all.find(([, node]) => node.class_type === "CLIPTextEncode" && node.inputs.text === prompt)?.[1].inputs.text, prompt);
    assert.ok(all.some(([, node]) => node.class_type === "CLIPTextEncode" && /checkerboard façades/.test(String(node.inputs.text))));
    assert.ok(all.some(([, node]) => node.class_type === "SaveImage"));
  });

  it("an exported depth replaces Lotus; the « vue » start encodes the 3D view, never a photo", () => {
    const graph = decor3dGraph([{ view: "vue.png", depth: "depth.png", photos: ["p.jpg"], prompt: "x", seed: 1, start: "vue" }]);
    const all = nodes(graph);
    assert.ok(!all.some(([, node]) => node.class_type === "LotusConditioning"));
    const structure = all.find(([, node]) => node.class_type === "InstructPixToPixConditioning")![1];
    const scaled = graph[(structure.inputs.pixels as [string])[0]] as Node;
    assert.equal((graph[(scaled.inputs.image as [string])[0]] as Node).inputs.image, "depth.png");
    const encode = all.find(([, node]) => node.class_type === "VAEEncode")![1];
    const src = graph[(encode.inputs.pixels as [string])[0]] as Node;
    assert.equal((graph[(src.inputs.image as [string])[0]] as Node).inputs.image, "vue.png");
    assert.equal(all.find(([, node]) => node.class_type === "KSampler")![1].inputs.denoise, 0.8);
    assert.throws(() => decor3dGraph([{ depth: "d.png", photos: [], prompt: "x", seed: 1, start: "vue" }]), /vue 3D/);
  });

  it("one graph for several views shares the loaders (measurement jobs)", () => {
    const graph = decor3dGraph([1, 2, 3].map(seed => ({ view: "v.png", photos: ["p.jpg"], prompt: "x", seed })));
    const count = (type: string) => nodes(graph).filter(([, node]) => node.class_type === type).length;
    assert.equal(count("UNETLoader"), 2); // FLUX + Lotus
    assert.equal(count("StyleModelLoader"), 1);
    assert.equal(count("KSampler"), 3);
    assert.equal(count("SaveImage"), 3);
  });

  it("routes cadre-decor to the 3D structure path when the template is absent; InstantX stays for old receipts", () => {
    const graph = stillGraph({ kind: "cadre-decor", prompt: cadrePrompt({ photos: 0, ambiance: "photos" }), images: ["cadre.png"], seed: 1 });
    assert.ok(nodes(graph).some(([, node]) => node.class_type === "InstructPixToPixConditioning"));
    assert.ok(!nodes(graph).some(([, node]) => node.class_type === "StyleModelApply"));
    const old = stillGraph({ kind: "cadre-decor", prompt: "x", images: ["cadre.png", "a.png"], seed: 1, template: INSTANTX_CADRE_TEMPLATE, cadreLayout: "depth-control" });
    assert.ok(nodes(old).some(([, node]) => node.class_type === "ControlNetApplyAdvanced"));
    assert.doesNotMatch(JSON.stringify(old), /a\.png/);
  });

  it("place context goes in the prompt", () => {
    const text = cadrePrompt({ photos: 0, ambiance: "photos", contexte: ["The place is real: City Center, New York, United States.", "In view: Central Park (park) ahead."] });
    assert.match(text, /City Center, New York/);
    assert.match(text, /Central Park \(park\) ahead/);
    assert.match(text, /Natural daylight/);
  });

  it("refuses a cadre without the frame, and any partner engine", () => {
    assert.throws(() => stillGraph({ kind: "cadre-decor", prompt: "x", images: [], seed: 1 }), /cadre 3D/);
    assert.throws(
      () => stillGraph({ kind: "cadre-decor", prompt: "x", images: ["a.png"], seed: 1, template: "api_bfl_flux3_pro" }),
      /structure 3D/,
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
