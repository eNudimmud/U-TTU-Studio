// Pika H3 Flex Ref2VA (30.10.2026), JD 21:30 « on peut intégrer le workflow dans nos outils »:
// third model of « Vidéo fidèle aux références », MiniMax H3 stays the default, FastH3 stays.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { noeudSortie } from "../src/lib/render/sortie.ts";
import { TAKE_MODELS } from "../src/lib/render/take-graph.ts";
import { intentDe, modelesIntent, outilEtat, outilParId, outilsPublics } from "../src/lib/outils/catalogue.ts";
import { fastH3Prompt } from "../src/lib/outils/fasth3-prompt.ts";
import { outilGraph, outilQuote } from "../src/lib/outils/graphs.ts";
import { marquerModeleAbsent, oublierModelesAbsents, PIKA_FORBIDDEN_LORA, PIKA_MODELS, PIKA_SIGMAS, pikaGraphProblem, pikaRefusModele } from "../src/lib/outils/pika-h3-flex.ts";
import { vignette } from "../src/lib/outils/vignettes.ts";
import { gesteParId, NOEUD_SORTIE, TEMPLATES_OFFICIELS } from "../src/lib/workflows/registre.ts";

type Node = { class_type: string; inputs: Record<string, unknown> };
const ask = "Uttu marche lentement le long du quai, la brume se lève.";
const pika = () => outilParId("vid-pika")!;
const build = (images = ["uttu.png", "quai.png"], aspect?: "vertical" | "horizontal") =>
  outilGraph(pika(), { files: { images }, prompt: ask, seed: 4242, aspect }) as Record<string, Node>;

describe("Pika H3 Flex Ref2VA, a model of « Vidéo fidèle aux références »", () => {
  beforeEach(() => oublierModelesAbsents());

  it("comes after H3 (still the default) and FastH3, before Vidu, with no card of its own", () => {
    assert.equal(intentDe("vid-pika"), "vid-h3-refs");
    assert.deepEqual(modelesIntent("vid-h3-refs").map(item => item.id), ["vid-h3-refs", "vid-fasth3", "vid-pika", "vid-vidu"]);
    assert.equal(outilsPublics().some(item => item.id === "vid-pika"), false);
    assert.ok(outilsPublics().some(item => item.id === "vid-h3-refs"));
    assert.equal(outilEtat(pika()).kind, "pret");
    assert.equal(pika().paire, "lieu");
    assert.equal(pika().attribution, true);
    assert.equal(vignette("vid-pika"), "/exemples/vignettes/vid-h3-refs.webp");
  });

  it("builds the template's graph: Picture 1 the character, Picture 2 the place, 0.4 MP, 5 s", () => {
    const graph = build(["uttu.png", "quai.png"], "vertical");
    assert.equal(graph["149"].inputs.image, "uttu.png");
    assert.equal(graph["150"].inputs.image, "quai.png");
    assert.deepEqual(graph["136"].inputs["ref_images.ref_image_0"], ["149", 0]);
    assert.deepEqual(graph["136"].inputs["ref_images.ref_image_1"], ["150", 0]);
    assert.equal(graph["136"].inputs.ref_image_size, "match");
    assert.equal(graph["115"].inputs.megapixels, 0.4);
    assert.equal(graph["115"].inputs.aspect_ratio, "9:16 (Portrait Widescreen)");
    assert.equal(build()["115"].inputs.aspect_ratio, "16:9 (Widescreen)");
    assert.equal(graph["132"].inputs.value, 5);
    assert.equal(graph["129"].inputs.noise_seed, 4242);
    assert.equal(graph["138"].inputs.value, fastH3Prompt(ask));
    assert.match(String(graph["138"].inputs.value), /<Subject 1> is the character in <Picture 1>\.\n<Subject 2> is the setting in <Picture 2>\./);
    assert.equal(graph["92"].inputs.filename_prefix, "video/uttu-vid-pika");
    assert.equal(noeudSortie(graph, pika().template), "92");
    assert.equal(NOEUD_SORTIE[pika().template], "92");
  });

  it("runs Pika's recipe: its LoRA on the H3 Ref2VA weights, lcm and six fixed sigmas, never the turbo LoRA", () => {
    const graph = build();
    assert.equal(graph["127"].inputs.unet_name, PIKA_MODELS.unet);
    assert.equal(graph["145"].class_type, "LoraLoaderModelOnly");
    assert.equal(graph["145"].inputs.lora_name, PIKA_MODELS.lora);
    assert.equal(graph["145"].inputs.strength_model, 1);
    assert.deepEqual(graph["145"].inputs.model, ["127", 0]);
    assert.deepEqual(graph["126"].inputs.model, ["145", 0]);
    assert.equal(graph["123"].inputs.sampler_name, "lcm");
    assert.equal(graph["147"].class_type, "ManualSigmas");
    assert.equal(graph["147"].inputs.sigmas, PIKA_SIGMAS);
    assert.deepEqual(graph["125"].inputs.sigmas, ["147", 0]);
    assert.equal(graph["128"].inputs.clip_name, PIKA_MODELS.clip);
    assert.equal(graph["119"].inputs.vae_name, PIKA_MODELS.videoVae);
    assert.equal(graph["120"].inputs.vae_name, PIKA_MODELS.audioVae);
    const text = JSON.stringify(graph);
    assert.equal(PIKA_FORBIDDEN_LORA, TAKE_MODELS.turboLora);
    assert.ok(!text.includes(TAKE_MODELS.turboLora), "no H3 turbo LoRA");
    assert.equal(Object.values(graph).filter(node => /^Lora/.test(node.class_type)).length, 1);
    for (const gone of ["BasicScheduler", "ComfySwitchNode", "KSampler"]) assert.ok(!Object.values(graph).some(node => node.class_type === gone), gone);
    assert.equal(Object.values(graph).filter(node => /^Save/.test(node.class_type)).length, 1);
    assert.equal(pikaGraphProblem(graph), null);
  });

  it("refuses a graph with the turbo LoRA stacked, or missing a weight", () => {
    const graph = build();
    const stacked = structuredClone(graph);
    stacked["999"] = { class_type: "LoraLoaderModelOnly", inputs: { lora_name: PIKA_FORBIDDEN_LORA, strength_model: 1, model: ["145", 0] } };
    assert.match(pikaGraphProblem(stacked) ?? "", /turbo/);
    const missing = structuredClone(graph);
    delete missing["128"];
    assert.match(pikaGraphProblem(missing) ?? "", /qwen3vl/);
  });

  it("refuses without the place or without a request", () => {
    assert.throws(() => build(["uttu.png"]));
    assert.throws(() => outilGraph(pika(), { files: { images: ["uttu.png", "quai.png"] }, prompt: " ", seed: 1 }));
  });

  it("is quoted ≈ 8 crédits estimés (ceiling 12) from job 5f7c6344 (7,54 crédits), open weights, official template", () => {
    assert.deepEqual(outilQuote(pika()), { credits: 8, high: 12, kind: "estime" });
    const row = gesteParId("outil-vid-pika")!;
    assert.equal(row.nature, "mesure");
    assert.equal(row.partenaire, false);
    assert.ok((TEMPLATES_OFFICIELS as readonly string[]).includes(pika().template));
  });

  it("leaves the menu once Comfy says a weight or the node is missing; H3 and FastH3 stay", () => {
    assert.ok(pikaRefusModele("LoraLoaderModelOnly : Value not in list"));
    assert.ok(pikaRefusModele("UNETLoader : Value not in list"));
    assert.ok(pikaRefusModele("Le compte de rendu a refusé la prise. Rien n’a été envoyé. lora_name: 'pika_h3_flex_ref2va_v1_bf16.safetensors' not in []"));
    assert.ok(pikaRefusModele("Cannot execute because node MiniMaxH3ReferenceToVideo does not exist."));
    assert.equal(pikaRefusModele("Crédits insuffisants sur ton compte de rendu."), false);
    assert.equal(pikaRefusModele("RandomNoise : Value smaller than min"), false);
    marquerModeleAbsent("vid-pika");
    assert.deepEqual(modelesIntent("vid-h3-refs").map(item => item.id), ["vid-h3-refs", "vid-fasth3", "vid-vidu"]);
    oublierModelesAbsents();
    assert.ok(modelesIntent("vid-h3-refs").some(item => item.id === "vid-pika"));
  });

  it("names the model and MiniMax H3 in every language", () => {
    for (const lang of ["fr", "en", "de", "es"]) {
      const messages = JSON.parse(readFileSync(`messages/${lang}.json`, "utf8"));
      assert.match(messages.outils.modelName["vid-pika"], /MiniMax H3/, lang);
      assert.match(messages.outils.attribution["vid-pika"], /MiniMax H3/, lang);
      assert.ok(messages.outils.t["vid-pika"].title && messages.outils.t["vid-pika"].line, lang);
      assert.ok(messages.outils.modelGone, lang);
      assert.doesNotMatch(JSON.stringify([messages.outils.modelName["vid-pika"], messages.outils.t["vid-pika"]]), /gratuit|free|kostenlos|gratis/i, lang);
    }
  });
});
