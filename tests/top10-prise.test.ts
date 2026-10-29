// Top 10, batch PRISE (29.10.2026): H3 keyframes (n° 4) and LTX style transition (n° 9).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { noeudSortie } from "../src/lib/render/sortie.ts";
import { outilEtat, outilParId, outilsOnglet, OUTILS } from "../src/lib/outils/catalogue.ts";
import { outilGraph, outilQuote } from "../src/lib/outils/graphs.ts";
import { gesteOuvert, gesteParId, NOEUD_SORTIE, TEMPLATES_OFFICIELS } from "../src/lib/workflows/registre.ts";

type Node = { class_type: string; inputs: Record<string, unknown> };
const saves = (graph: Record<string, Node>) => Object.values(graph).filter(node => /^Save/.test(node.class_type));

describe("top 10 · images clés fidèles (H3 multiframe)", () => {
  const outil = outilParId("vid-multi")!;

  it("is open: picture 1 is the reference, picture 2 the 5 s keyframe, middle guides removed", () => {
    assert.equal(outil.bientot, undefined);
    assert.equal(outilEtat(outil).kind, "pret");
    assert.ok(outilsOnglet("prise").includes(outil));
    const graph = outilGraph(outil, { files: { images: ["uttu.png", "uttu-gros-plan.png"] }, prompt: "Uttu baisse les yeux", seed: 7, aspect: "vertical" }) as Record<string, Node>;
    assert.equal(graph["164"].inputs.image, "uttu.png");
    assert.equal(graph["167"].inputs.image, "uttu-gros-plan.png");
    assert.equal(graph["138"].inputs.value, "Uttu baisse les yeux");
    assert.equal(graph["129"].inputs.noise_seed, 7);
    assert.equal(graph["115"].inputs.aspect_ratio, "9:16 (Portrait Widescreen)");
    for (const gone of ["147", "157", "159", "162"]) assert.equal(graph[gone], undefined, gone);
    assert.deepEqual(graph["169"].inputs.positive, ["136", 0]);
    assert.equal(saves(graph).length, 1);
    assert.equal(noeudSortie(graph, outil.template), "92");
    assert.equal(NOEUD_SORTIE[outil.template], "92");
  });

  it("uses the first picture twice when only one is given", () => {
    const graph = outilGraph(outil, { files: { images: ["uttu.png"] }, prompt: "plan", seed: 1 }) as Record<string, Node>;
    assert.equal(graph["167"].inputs.image, "uttu.png");
  });

  it("is quoted from the measured job, open weights", () => {
    assert.deepEqual(outilQuote(outil), { credits: 14, high: 21, kind: "estime" });
    const row = gesteParId("outil-vid-multi")!;
    assert.equal(row.nature, "mesure");
    assert.equal(row.partenaire, false);
    assert.ok(gesteOuvert(row));
  });
});

describe("top 10 · transition de style (LTX 2.3)", () => {
  const outil = outilParId("vid-transition-style")!;

  it("goes from the first picture to the second and adds the trigger word", () => {
    assert.equal(outilEtat(outil).kind, "pret");
    assert.ok(outilsOnglet("prise").includes(outil));
    const graph = outilGraph(outil, { files: { images: ["photo.png", "aquarelle.png"] }, prompt: "Uttu lève les yeux, la photo devient aquarelle.", seed: 3 }) as Record<string, Node>;
    assert.equal(graph["138"].inputs.image, "photo.png");
    assert.equal(graph["137"].inputs.image, "aquarelle.png");
    assert.equal(graph["139:128"].inputs.text, "Uttu lève les yeux, la photo devient aquarelle. zhuanchang");
    assert.equal(graph["139:100"].inputs.noise_seed, 3);
    assert.equal(graph["139:113"].inputs.value, 720);
    assert.equal(graph["139:98"].inputs.value, 1280);
    assert.equal(saves(graph).length, 1);
    assert.equal(noeudSortie(graph, outil.template), "68");
  });

  it("keeps a trigger word already there and turns for 16:9", () => {
    const graph = outilGraph(outil, { files: { images: ["a.png", "b.png"] }, prompt: "fondu zhuanchang", seed: 3, aspect: "horizontal" }) as Record<string, Node>;
    assert.equal(graph["139:128"].inputs.text, "fondu zhuanchang");
    assert.equal(graph["139:113"].inputs.value, 1280);
    assert.equal(graph["139:98"].inputs.value, 720);
  });

  it("is quoted from the measured job, open weights, official template", () => {
    assert.deepEqual(outilQuote(outil), { credits: 7, high: 11, kind: "estime" });
    const row = gesteParId("outil-vid-transition-style")!;
    assert.equal(row.nature, "mesure");
    assert.equal(row.partenaire, false);
    assert.ok((TEMPLATES_OFFICIELS as readonly string[]).includes(outil.template));
  });
});

describe("top 10 · not exposed", () => {
  it("has no card for FastH3 nor for the LTX reference sheet (see docs/mesures)", () => {
    for (const template of ["video_fasth3_ominiref_r2v", "template_ltx2_3_ic_lora_ingredients"]) assert.equal(OUTILS.some(item => item.template === template), false, template);
  });
});
