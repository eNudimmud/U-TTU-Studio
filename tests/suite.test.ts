import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SUITE_GESTES, SUITE_SORTIE, elargirPads, suiteExample, suiteGraph, type SuiteGeste } from "../src/lib/suite/graphs.ts";
import { MESURE_PLAFOND, mesurePlan } from "../src/lib/suite/mesure.ts";
import { suiteQuote } from "../src/lib/suite/quote.ts";
import { REGISTRE, TEMPLATES_OFFICIELS, gesteOuvert, gesteParId, gestesOnglet, gestesSuite } from "../src/lib/workflows/registre.ts";

type Graph = ReturnType<typeof suiteGraph>;
const PARTNER = /Gemini|Flux3ImageNode|ElevenLabs|Sonilo|Vidu|Kling|Bria|Tripo|Meshy|Magnific|Wavespeed|RTXVideo|ByteDance/i;

function links(graph: Graph): void {
  for (const [id, node] of Object.entries(graph)) {
    for (const [key, value] of Object.entries(node.inputs)) {
      if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && typeof value[1] === "number") {
        assert.ok(value[0] in graph, `${id}.${key} → ${value[0]}`);
      }
    }
  }
}

function build(geste: SuiteGeste, extra: Partial<Parameters<typeof suiteGraph>[0]> = {}): Graph {
  const input = suiteExample(geste);
  return suiteGraph({ ...input, files: { source: input.files.source.endsWith(".mp4") ? "clip.mp4" : "photo.png", audio: input.files.audio ? "voix.mp3" : undefined }, prompt: input.prompt ? "Elle sourit." : "", seed: 7, ...extra });
}

describe("Et ensuite ? graphes", () => {
  it("builds every tool from its template, open weights, links whole, one saved output", () => {
    for (const geste of SUITE_GESTES) {
      const graph = build(geste);
      links(graph);
      assert.equal(Object.values(graph).some(node => PARTNER.test(node.class_type)), false, geste);
      assert.equal(Object.values(graph).some(node => /Preview|ImageCompare|MaskPreview/.test(node.class_type)), false, geste);
      const saves = Object.values(graph).filter(node => node.class_type === (SUITE_SORTIE[geste] === "image" ? "SaveImage" : "SaveVideo"));
      assert.equal(saves.length, 1, geste);
      assert.match(String(saves[0].inputs.filename_prefix), /uttu-/);
      const files = JSON.stringify(graph);
      assert.match(files, SUITE_SORTIE[geste] === "image" || geste === "suite-animer" || geste === "suite-parler" || geste === "suite-prolonger" ? /photo\.png|clip\.mp4/ : /clip\.mp4/);
    }
  });

  it("Détourer saves a transparent PNG from the alpha join", () => {
    const graph = build("suite-detourer");
    assert.equal(graph.save.class_type, "SaveImage");
    assert.deepEqual(graph.save.inputs.images, ["19:16", 0]);
    assert.equal(graph["19:16"].class_type, "JoinImageWithAlpha");
  });

  it("Finaliser enhances and never regenerates: no text, one SeedVR2 step", () => {
    for (const geste of ["suite-finaliser-image", "suite-finaliser-video"] as const) {
      const graph = build(geste);
      assert.equal(Object.values(graph).some(node => /CLIPTextEncode|TextGenerate|EmptyLatent|EmptyLTXV|EmptyFlux/.test(node.class_type)), false, geste);
      const sampler = Object.values(graph).find(node => node.class_type === "KSampler");
      assert.equal(sampler?.inputs.steps, 1);
      assert.ok(Object.values(graph).some(node => node.class_type === "SeedVR2Conditioning"));
    }
    const image = build("suite-finaliser-image");
    assert.equal(image["66:57"].inputs["resize_type.multiplier"], 2);
    const video = build("suite-finaliser-video");
    assert.equal(video["66:57"].inputs.resize_type, "scale shorter dimension");
    assert.equal(video["66:57"].inputs["resize_type.shorter_size"], 1080);
    assert.equal("resize_type.multiplier" in video["66:57"].inputs, false);
    assert.equal(video["66:105"].inputs.value, false);
    assert.equal(build("suite-finaliser-video", { seconds: 30 })["66:105"].inputs.value, true);
  });

  it("Finaliser vidéo can add in-between frames in the same pass", () => {
    const graph = build("suite-finaliser-video", { fluidifier: true });
    links(graph);
    assert.equal(graph["f:frames"].class_type, "FrameInterpolate");
    assert.deepEqual(graph["66:75"].inputs.images, ["f:frames", 0]);
    assert.deepEqual(graph["66:75"].inputs.fps, ["f:fps", 0]);
  });

  it("Élargir pads the chosen sides and keeps the template instruction", () => {
    assert.deepEqual(elargirPads("cotes"), { left: 384, top: 0, right: 384, bottom: 0 });
    const graph = build("suite-elargir", { elargir: "haut-bas" });
    assert.equal(graph["164"].inputs.top, 384);
    assert.equal(graph["164"].inputs.left, 0);
    assert.match(String(graph["157"].inputs.text), /^remove the green part, continue the scene: Elle sourit\.$/);
    assert.equal(graph["158"].inputs.unet_name, "flux-2-klein-9b.safetensors");
  });

  it("Animer needs text; Prolonger starts from a frame and may stay silent", () => {
    assert.throws(() => build("suite-animer", { prompt: "" }));
    const animer = build("suite-animer", { aspect: "vertical" });
    assert.equal(animer["115"].inputs.aspect_ratio, "9:16 (Portrait Widescreen)");
    assert.equal(animer["105:126"].inputs.value, true);
    assert.equal(animer["105:111"].inputs.value, 5);
    const prolonger = build("suite-prolonger", { prompt: "", files: { source: "photo.png" } });
    assert.equal(prolonger["105:104"].inputs.prompt, "");
    assert.equal(prolonger["114"].inputs.image, "photo.png");
  });

  it("Faire parler matches the voice length (capped) and sends the text straight to the encoder", () => {
    const graph = build("suite-parler", { seconds: 12, aspect: "vertical" });
    links(graph);
    assert.equal(graph["340:331"].inputs.value, 12);
    assert.equal(graph["340:330"].inputs.value, 720);
    assert.equal(graph["340:324"].inputs.value, 1280);
    assert.deepEqual(graph["340:306"].inputs.text, ["340:319", 0]);
    assert.equal(Object.values(graph).some(node => node.class_type === "TextGenerateLTX2Prompt"), false);
    assert.equal(graph["276"].inputs.audio, "voix.mp3");
  });
});

describe("Et ensuite ? registre et devis", () => {
  it("opens every tool as an estimated, open-weights gesture outside the four tabs", () => {
    const rows = gestesSuite();
    assert.deepEqual(rows.map(row => row.id).sort(), [...SUITE_GESTES].sort());
    for (const row of rows) {
      assert.equal(gesteOuvert(row), true, row.id);
      assert.equal(row.nature, "hypothese");
      assert.equal(row.partenaire, false);
      assert.ok((TEMPLATES_OFFICIELS as readonly string[]).includes(row.template));
    }
    for (const onglet of ["cast", "decor", "prise", "montage"] as const) {
      const { premiers, suite } = gestesOnglet(onglet);
      assert.equal([...premiers, ...suite].some(row => row.onglet === "suite"), false);
    }
    assert.ok(REGISTRE.some(row => row.template === "utility_birefnet_remove_background"));
    assert.ok(REGISTRE.some(row => row.template === "templates_doc_workbox_klein_9b_image_extend"));
  });

  it("labels every quote « estimé » and scales length-based tools per 5 s block", () => {
    for (const geste of SUITE_GESTES) assert.equal(suiteQuote(geste)?.kind, "estime");
    assert.deepEqual(suiteQuote("suite-finaliser-video", { seconds: 5 }), { credits: 27, high: 40, kind: "estime" });
    assert.deepEqual(suiteQuote("suite-finaliser-video", { seconds: 5.04 }), { credits: 27, high: 40, kind: "estime" });
    assert.deepEqual(suiteQuote("suite-finaliser-video", { seconds: 12 }), { credits: 81, high: 120, kind: "estime" });
    assert.deepEqual(suiteQuote("suite-finaliser-video", { seconds: 5, fluidifier: true }), { credits: 29, high: 44, kind: "estime" });
    assert.equal(suiteQuote("suite-animer", { seconds: 30 })?.credits, gesteParId("suite-animer")?.credits);
  });

  it("keeps the measurement round under JD's ceiling", () => {
    const plan = mesurePlan();
    assert.equal(plan.runs.length, SUITE_GESTES.length);
    assert.ok(plan.high <= MESURE_PLAFOND, `${plan.high}`);
    assert.ok(plan.credits < plan.high);
  });

  it("names no fal route and never cancels a job in the new code", () => {
    for (const file of ["src/lib/suite/graphs.ts", "src/lib/suite/quote.ts", "src/lib/suite/media.ts", "src/components/app/et-ensuite.tsx"]) {
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(text, /\bfal(\.ai|_|-ai)?\b/i, file);
      assert.doesNotMatch(text, /\.cancel\(/, file);
    }
  });

  it("has every string in FR, EN, DE and ES", () => {
    const keys = (value: unknown, prefix = ""): string[] => value && typeof value === "object" ? Object.entries(value).flatMap(([key, inner]) => keys(inner, `${prefix}${key}.`)) : [prefix];
    const read = (lang: string) => (JSON.parse(readFileSync(`messages/${lang}.json`, "utf8")) as { suite: unknown }).suite;
    const fr = keys(read("fr")).sort();
    assert.ok(fr.length > 40);
    for (const lang of ["en", "de", "es"]) assert.deepEqual(keys(read(lang)).sort(), fr, lang);
  });
});
