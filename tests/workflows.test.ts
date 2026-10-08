import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { stillGraph } from "../src/lib/creation/still.ts";
import {
  REGISTRE, TEMPLATES_OFFICIELS, casesVisibles, gesteOuvert, gestesOnglet, mapReferences,
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
      { id: "c", role: "visage" },
      { id: "d", role: "visage" },
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
    assert.ok(open.includes("mont-voix"));
    assert.ok(open.includes("mont-effet"));
    assert.ok(open.includes("mont-musique"));
    assert.equal(open.includes("cast-angle"), false);
    assert.equal(open.includes("decor-elargir"), false);
    assert.equal(open.includes("prise-raccord"), false);
    assert.equal(open.includes("prise-vidu"), false);
    assert.equal(open.includes("mont-agrandir"), false);
  });

  it("shows the measured sheet price and a required outfit slot", () => {
    const sheet = REGISTRE.find(item => item.id === "cast-planche");
    assert.ok(sheet);
    assert.equal(sheet.credits, 71);
    assert.equal(sheet.high, 100);
    assert.equal(sheet.nature, "mesure");
    const wardrobe = REGISTRE.find(item => item.id === "cast-tenue");
    assert.ok(wardrobe);
    assert.equal(wardrobe.minRefs, 2);
    assert.deepEqual(casesVisibles(wardrobe).map(item => item.role), ["visage", "tenue"]);
    const bridge = REGISTRE.find(item => item.id === "prise-raccord");
    assert.ok(bridge);
    assert.deepEqual(casesVisibles(bridge).map(item => item.role), ["debut", "fin"]);
  });

  it("keeps an unpriced gesture closed with a one-line reason", () => {
    const fr = JSON.parse(readFileSync("messages/fr.json", "utf8")) as { gestes: { raisons: Record<string, string> } };
    for (const row of REGISTRE) {
      if (gesteOuvert(row)) {
        assert.equal(row.raison, undefined, row.id);
        continue;
      }
      assert.equal(typeof row.raison, "string", row.id);
      const key = row.raison?.split(".").pop() ?? "";
      const line = fr.gestes.raisons[key];
      assert.equal(typeof line, "string", row.id);
      assert.ok(line.length > 12 && line.length < 120, line);
      assert.doesNotMatch(line, /nœud|Comfy|LivePortrait|SeedVR|ControlNet|LTX|Wan|Vidu|MiniMax|4K/i);
    }
  });

  it("sends a second photo to the second image slot", () => {
    const graph = stillGraph({ kind: "photo-cast", prompt: "Même personne.", images: ["a.jpg", "b.jpg"], seed: 1 });
    const still = graph.still?.inputs as Record<string, unknown>;
    assert.deepEqual(still["model.images.image_1"], ["load", 0]);
    assert.deepEqual(still["model.images.image_2"], ["load2", 0]);
    assert.equal(graph.load2?.inputs.image, "b.jpg");
  });

  it("draws one face box per image the graph accepts", () => {
    const row = REGISTRE.find(item => item.id === "cast-photos");
    assert.ok(row);
    assert.deepEqual(casesVisibles(row).map(item => item.id), ["image_1", "image_2", "image_3"]);
    assert.deepEqual(casesVisibles(row).map(item => item.role), ["visage", "visage", "visage"]);
    assert.equal(casesVisibles(row).length, row.slots.length);
  });
});
