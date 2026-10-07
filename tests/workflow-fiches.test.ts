import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatUsd } from "../src/lib/fal/prices.ts";
import { workflowFiches } from "../src/lib/workflow-fiches.ts";

const empty = { rendu: null, personnage: null, former: null, lieu: null, image: null };
const sample = { seconds: 5, resolution: "768P" as const, steps: 1000 };

describe("fiches de geste", () => {
  it("lists only the jobs already wired, as cards", () => {
    const fiches = workflowFiches(empty, sample);
    assert.deepEqual(fiches.map(fiche => fiche.id), ["references", "personnage", "former", "lieu", "image"]);
    assert.deepEqual(fiches.map(fiche => fiche.payer), ["rendu", "fal", "fal", "fal", "fal"]);
    assert.equal(fiches[0].engine, "comfy");
    assert.equal(fiches[1].engine, "lora");
    assert.equal(fiches[2].focus, "file");
    assert.equal(fiches[3].focus, "vues");
    assert.equal(fiches[4].focus, "image");
    const text = JSON.stringify(fiches);
    assert.doesNotMatch(text, /graphe|nœud|seedance|flux|workflow|UNET|class_type/i);
    assert.match(fiches[3].sentence, /pas un volume/);
    assert.match(fiches[4].sentence, /fichier Blender/);
  });

  it("keeps an example until a live price exists, and never invents one for a place", () => {
    const closed = workflowFiches(empty, sample);
    assert.match(closed[0].cost, /Exemple/);
    assert.match(closed[0].cost, /0,39/);
    assert.match(closed[0].cost, /Rien n’est débité/);
    assert.match(closed[1].cost, new RegExp(formatUsd(0.075 * 5).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(closed[1].cost, /Rien n’est débité/);
    assert.match(closed[2].cost, /Exemple/);
    assert.match(closed[2].cost, new RegExp(formatUsd(0.015 * 1000).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(closed[3].cost.includes("$"), false);
    assert.equal(closed[4].cost.includes("$"), false);
    assert.match(closed[3].cost, /avant le geste/);

    const open = workflowFiches({
      rendu: "Environ 12 crédits, mesuré sur ta prise.",
      personnage: "0,40 $",
      former: "15,00 $",
      lieu: "4,00 $",
      image: "0,03 $",
    }, sample);
    assert.equal(open[0].cost, "Environ 12 crédits, mesuré sur ta prise.");
    assert.doesNotMatch(open[0].cost, /Exemple/);
    assert.match(open[1].cost, /0,40 \$/);
    assert.match(open[1].cost, /lu sur le compte fal/);
    assert.match(open[3].cost, /4,00 \$/);
    assert.match(open[4].cost, /0,03 \$/);
    assert.doesNotMatch(open[3].cost, /Exemple/);
  });
});
