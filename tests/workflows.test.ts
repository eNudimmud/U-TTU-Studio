import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { stillGraph } from "../src/lib/creation/still.ts";
import {
  REGISTRE, TEMPLATES_OFFICIELS, gesteOuvert, gestesOnglet, mapReferences,
} from "../src/lib/workflows/registre.ts";

const doc = readFileSync("docs/WORKFLOWS.md", "utf8");
const known = new Set<string>(TEMPLATES_OFFICIELS);

describe("registre des gestes", () => {
  it("points every gesture at a template that is in the official list and in the catalog", () => {
    assert.ok(REGISTRE.length >= 16);
    for (const row of REGISTRE) {
      assert.equal(known.has(row.template), true, row.id);
      assert.match(doc, new RegExp(row.template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(doc, new RegExp(row.id));
    }
  });

  it("keeps four first gestures per tab and the rest behind the fold", () => {
    for (const onglet of ["cast", "decor", "prise", "montage"] as const) {
      const { premiers, suite } = gestesOnglet(onglet);
      assert.equal(premiers.length, 4, onglet);
      assert.ok(suite.length >= 2, onglet);
      assert.ok(premiers.every(item => item.premier));
      assert.ok(suite.every(item => !item.premier));
    }
  });

  it("maps a reference onto the first free slot of the same role and does not reuse it", () => {
    const row = REGISTRE.find(item => item.id === "cast-photos");
    assert.ok(row);
    const mapped = mapReferences(row, [
      { id: "a", role: "visage" },
      { id: "b", role: "visage" },
      { id: "c", role: "style" },
    ]);
    assert.deepEqual(mapped, [
      { slot: "image_1", refId: "a" },
      { slot: "image_2", refId: "b" },
      { slot: "image_3", refId: "c" },
    ]);
    const place = REGISTRE.find(item => item.id === "decor-photo");
    assert.ok(place);
    assert.deepEqual(mapReferences(place, [{ id: "face", role: "visage" }]), []);
    assert.deepEqual(mapReferences(place, [{ id: "quai", role: "lieu" }]), [{ slot: "image_1", refId: "quai" }]);
  });

  it("opens only gestures that already have a graph and a quote", () => {
    const open = REGISTRE.filter(gesteOuvert).map(item => item.id);
    assert.ok(open.includes("cast-photos"));
    assert.ok(open.includes("decor-photo"));
    assert.ok(open.includes("prise-plan"));
    assert.equal(open.includes("cast-angle"), false);
    assert.equal(open.includes("mont-voix"), false);
    assert.equal(open.includes("prise-vidu"), false);
  });

  it("sends a second photo to the second image slot", () => {
    const graph = stillGraph({ kind: "photo-cast", prompt: "Même personne.", images: ["a.jpg", "b.jpg"], seed: 1 });
    const still = graph.still?.inputs as Record<string, unknown>;
    assert.deepEqual(still["model.images.image_1"], ["load", 0]);
    assert.deepEqual(still["model.images.image_2"], ["load2", 0]);
    assert.equal(graph.load2?.inputs.image, "b.jpg");
  });
});
