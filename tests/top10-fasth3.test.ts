// Audit n° 8 (29.10.2026), JD 23:05 « on garde le meilleur ou les deux s'ils se complètent »:
// FastH3 OmniRef is the second model of « Vidéo fidèle aux références », H3 stays the default.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { noeudSortie } from "../src/lib/render/sortie.ts";
import { intentDe, modelesIntent, outilEtat, outilParId, outilsPublics } from "../src/lib/outils/catalogue.ts";
import { fastH3Prompt } from "../src/lib/outils/fasth3-prompt.ts";
import { outilGraph, outilQuote } from "../src/lib/outils/graphs.ts";
import { vignette } from "../src/lib/outils/vignettes.ts";
import { gesteParId, NOEUD_SORTIE, TEMPLATES_OFFICIELS } from "../src/lib/workflows/registre.ts";

type Node = { class_type: string; inputs: Record<string, unknown> };
const ask = "Uttu marche lentement le long du quai, la brume se lève.";

describe("audit · FastH3 OmniRef, second model of « Vidéo fidèle aux références »", () => {
  const outil = outilParId("vid-fasth3")!;

  it("comes after H3, which stays the default, and has no card of its own", () => {
    assert.equal(intentDe("vid-fasth3"), "vid-h3-refs");
    assert.deepEqual(modelesIntent("vid-h3-refs").map(item => item.id).slice(0, 2), ["vid-h3-refs", "vid-fasth3"]);
    assert.equal(outilsPublics().some(item => item.id === "vid-fasth3"), false);
    assert.equal(outilEtat(outil).kind, "pret");
    assert.equal(outil.paire, "lieu");
    assert.equal(vignette("vid-fasth3"), "/exemples/vignettes/vid-h3-refs.webp");
  });

  it("runs the template's recipe with two named references at the measured 0.4 MP, 5 s", () => {
    const graph = outilGraph(outil, { files: { images: ["uttu.png", "quai.png"] }, prompt: ask, seed: 4242 }) as Record<string, Node>;
    assert.equal(graph["137"].inputs.image, "uttu.png");
    assert.equal(graph["150"].inputs.image, "quai.png");
    assert.deepEqual(graph["136"].inputs["ref_images.ref_image_0"], ["137", 0]);
    assert.deepEqual(graph["136"].inputs["ref_images.ref_image_1"], ["150", 0]);
    assert.equal(graph["136"].inputs.ref_image_size, "match");
    assert.equal(graph["115"].inputs.megapixels, 0.4);
    assert.equal(graph["115"].inputs.aspect_ratio, "16:9 (Widescreen)");
    assert.equal(graph["132"].inputs.value, 5);
    assert.equal(graph["124"].inputs.steps, 8);
    assert.equal(graph["127"].inputs.unet_name, "fasth3_omniref_8step_pruned_int8_convrot.safetensors");
    assert.deepEqual([graph["141"].inputs.shift_video, graph["141"].inputs.shift_audio], [12, 3]);
    assert.equal(graph["143"].inputs.selection, "vsa");
    assert.equal(graph["143"].inputs["selection.keep_percent"], 10);
    assert.equal(graph["129"].inputs.noise_seed, 4242);
    assert.equal(graph["138"].inputs.value, fastH3Prompt(ask));
    assert.equal(noeudSortie(graph, outil.template), "92");
    assert.equal(NOEUD_SORTIE[outil.template], "92");
  });

  it("refuses without the place or without a request", () => {
    assert.throws(() => outilGraph(outil, { files: { images: ["uttu.png"] }, prompt: ask, seed: 1 }));
    assert.throws(() => outilGraph(outil, { files: { images: ["uttu.png", "quai.png"] }, prompt: " ", seed: 1 }));
  });

  it("is quoted from job ddd54cb2 (7,78 crédits), open weights, official template", () => {
    assert.deepEqual(outilQuote(outil), { credits: 8, high: 12, kind: "estime" });
    const row = gesteParId("outil-vid-fasth3")!;
    assert.equal(row.nature, "mesure");
    assert.equal(row.partenaire, false);
    assert.ok((TEMPLATES_OFFICIELS as readonly string[]).includes(outil.template));
  });
});

describe("audit · FastH3 structured prompt", () => {
  it("writes the documented sections in order, the request in the summary and the shot", () => {
    const text = fastH3Prompt(ask);
    const order = ["subject_definitions:", "summary:", "retention_analysis:", "detailed_description:", "overall_soundscape:", "non_diegetic_music:"].map(head => text.indexOf(head));
    assert.ok(order.every((at, index) => at >= 0 && (index === 0 || at > order[index - 1])), String(order));
    assert.match(text, /<Subject 1> is the character in <Picture 1>\./);
    assert.match(text, /<Subject 2> is the setting in <Picture 2>\./);
    assert.match(text, /\[reference generation\] The target video is a 5-second cinematic shot\. Uttu marche/);
    assert.match(text, /\[Shot 1\] <Subject 1> in <Subject 2>: Uttu marche/);
    assert.match(text, /non_diegetic_music:\nNone\./);
  });

  it("names references when the studio knows them, up to 9", () => {
    const text = fastH3Prompt(ask, [{ role: "personnage", name: "Uttu" }, { role: "lieu", name: "le quai de nuit" }]);
    assert.match(text, /<Subject 1> is the character in <Picture 1>: Uttu\./);
    assert.match(text, /<Subject 2> is the setting in <Picture 2>: le quai de nuit\./);
    assert.throws(() => fastH3Prompt(ask, Array.from({ length: 10 }, () => ({ role: "lieu" as const }))));
    assert.throws(() => fastH3Prompt(""));
  });
});
