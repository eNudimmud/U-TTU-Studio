// Audit des échecs (29.10.2026), n° 7: Light Migration, wired the way its LoRA card says
// (subject in image1, light in image2), joins « Changer la lumière » as its second model.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { noeudSortie } from "../src/lib/render/sortie.ts";
import { intentDe, modelesIntent, OUTILS, outilEtat, outilParId, outilsPublics } from "../src/lib/outils/catalogue.ts";
import { outilGraph, outilQuote } from "../src/lib/outils/graphs.ts";
import { vignette } from "../src/lib/outils/vignettes.ts";
import { gesteParId, NOEUD_SORTIE, TEMPLATES_OFFICIELS } from "../src/lib/workflows/registre.ts";

type Node = { class_type: string; inputs: Record<string, unknown> };

describe("audit · copier la lumière d’une image (Qwen 2509 Light Migration)", () => {
  const outil = outilParId("ret-lumiere-image")!;

  it("sends the subject in image1 and the light in image2, the default prompt, 4 Lightning steps", () => {
    assert.equal(outilEtat(outil).kind, "pret");
    assert.equal(outil.texte, "aucun");
    assert.equal(outil.paire, "lumiere");
    const graph = outilGraph(outil, { files: { images: ["uttu.png", "quai.png"] }, prompt: "", seed: 9 }) as Record<string, Node>;
    assert.equal(graph["7"].inputs.image, "uttu.png");
    assert.equal(graph["6"].inputs.image, "quai.png");
    for (const id of ["471:114", "471:116"]) {
      assert.deepEqual(graph[id].inputs.image1, ["471:120", 0], id);
      assert.deepEqual(graph[id].inputs.image2, ["6", 0], id);
      assert.equal("image3" in graph[id].inputs, false, id);
    }
    assert.equal(graph["471:116"].inputs.prompt, "参考色调，移除图1原有的光照并参考图2的光照和色调对图1重新照明");
    assert.equal(graph["471:443"].inputs.value, true);
    assert.equal(graph["471:436"].inputs.value, 4);
    assert.equal(graph["471:472"].inputs.lora_name, "Qwen-Image-Edit-2509-Light-Migration.safetensors");
    assert.equal(graph["471:121"].inputs.seed, 9);
    assert.equal(noeudSortie(graph, outil.template), "5");
    assert.equal(NOEUD_SORTIE[outil.template], "5");
  });

  it("refuses to run without the light picture", () => {
    assert.throws(() => outilGraph(outil, { files: { images: ["uttu.png"] }, prompt: "", seed: 9 }));
  });

  it("is the second model of the one « Changer la lumière » card, not a card of its own", () => {
    assert.equal(intentDe("ret-lumiere-image"), "ret-eclairer-ouvert");
    assert.equal(modelesIntent("ret-eclairer")[1]?.id, "ret-lumiere-image");
    assert.equal(outilsPublics().some(item => item.id === "ret-lumiere-image"), false);
    assert.equal(vignette("ret-lumiere-image"), "/exemples/vignettes/ret-eclairer.webp");
  });

  it("is quoted from the measured job, open weights, official template", () => {
    assert.deepEqual(outilQuote(outil), { credits: 3, high: 6, kind: "estime" });
    assert.equal(gesteParId("outil-ret-lumiere-image")!.nature, "mesure");
    assert.ok((TEMPLATES_OFFICIELS as readonly string[]).includes(outil.template));
  });

  it("keeps FastH3 and the LTX reference sheet out of the catalogue", () => {
    for (const template of ["video_fasth3_ominiref_r2v", "template_ltx2_3_ic_lora_ingredients"]) assert.equal(OUTILS.some(item => item.template === template), false, template);
  });
});
