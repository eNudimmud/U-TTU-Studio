// Top 10, batch lumière (29.10.2026): open-weight relight (n° 7) leads « Changer la lumière ».
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { noeudSortie } from "../src/lib/render/sortie.ts";
import { intentDe, modelesIntent, outilEtat, outilParId, outilsPublics } from "../src/lib/outils/catalogue.ts";
import { outilGraph, outilQuote } from "../src/lib/outils/graphs.ts";
import { vignette } from "../src/lib/outils/vignettes.ts";
import { gesteParId, NOEUD_SORTIE, TEMPLATES_OFFICIELS } from "../src/lib/workflows/registre.ts";

type Node = { class_type: string; inputs: Record<string, unknown> };

describe("top 10 · changer la lumière en poids ouverts (Qwen 2509 Relight)", () => {
  const outil = outilParId("ret-eclairer-ouvert")!;

  it("sends the portrait and the consigne behind the LoRA trigger", () => {
    assert.equal(outilEtat(outil).kind, "pret");
    const graph = outilGraph(outil, { files: { images: ["uttu.png"] }, prompt: "contre-jour, coucher de soleil", seed: 9 }) as Record<string, Node>;
    assert.equal(graph["11"].inputs.image, "uttu.png");
    assert.equal(graph["15"].inputs.value, "contre-jour, coucher de soleil");
    assert.equal(graph["14"].inputs.string_a, "重新照明,");
    assert.equal(graph["10:3"].inputs.seed, 9);
    assert.equal(graph["10:3"].inputs.steps, 4);
    assert.equal(noeudSortie(graph, outil.template), "12");
    assert.equal(NOEUD_SORTIE[outil.template], "12");
  });

  it("is the default model of the one « Changer la lumière » card; the partner model stays second", () => {
    assert.equal(intentDe("ret-eclairer"), "ret-eclairer-ouvert");
    assert.deepEqual(modelesIntent("ret-eclairer").map(item => item.id), ["ret-eclairer-ouvert", "ret-eclairer"]);
    const cards = outilsPublics().map(item => item.id);
    assert.ok(cards.includes("ret-eclairer-ouvert"));
    assert.equal(cards.includes("ret-eclairer"), false);
    assert.equal(vignette("ret-eclairer-ouvert"), "/exemples/vignettes/ret-eclairer.webp");
  });

  it("is quoted from the measured job, open weights, official template", () => {
    assert.deepEqual(outilQuote(outil), { credits: 4, high: 6, kind: "estime" });
    assert.equal(gesteParId("outil-ret-eclairer-ouvert")!.nature, "mesure");
    assert.ok((TEMPLATES_OFFICIELS as readonly string[]).includes(outil.template));
  });
});
