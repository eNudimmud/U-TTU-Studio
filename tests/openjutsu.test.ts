import assert from "node:assert/strict";
import test from "node:test";
import { COMFY_APPS } from "../src/lib/outils/comfy-apps.ts";
import { familleVitrine, outilEtat, outilParId, outilPartenaire, outilsPublics, outilsPublicsOnglet } from "../src/lib/outils/catalogue.ts";
import { outilExample, outilGraph, outilQuote } from "../src/lib/outils/graphs.ts";
import { studioProductionMap } from "../src/lib/agent/studio-map.ts";

test("OpenJutsu is one public video tool and appears in PRISE's tools", () => {
  const tool = outilParId("vid-openjutsu")!;
  assert.equal(tool.comfyApp, "openjutsu");
  assert.equal(familleVitrine(tool), "video");
  assert.equal(outilEtat(tool).kind, "app");
  assert.equal(outilsPublics().filter(t => t.id === tool.id).length, 1);
  assert.ok(outilsPublicsOnglet("prise").some(t => t.id === tool.id));
  assert.equal(COMFY_APPS.openjutsu.url, "https://comfy.org/hub/apps/openjutsu/");
});

test("the hosted app never gets a fake Studio graph, quote or execution capability", () => {
  const tool = outilParId("vid-openjutsu")!;
  assert.equal(outilQuote(tool), null);
  assert.throws(() => outilGraph(tool, outilExample(tool)), /pas encore branché/);
  const op = studioProductionMap().find(op => op.toolId === tool.id)!;
  assert.equal(op.status, "disabled");
  assert.equal(op.reason, "runs-in-comfy-app");
  assert.equal(op.quote, undefined);
});

test("open-weights-only hides OpenJutsu because its hosted first frame can use Router", () => {
  const tool = outilParId("vid-openjutsu")!;
  assert.equal(outilPartenaire(tool), true);
  assert.deepEqual(outilEtat(tool, { openWeightsOnly: true }), { kind: "masque", raison: "openWeights" });
  assert.equal(outilsPublics({ openWeightsOnly: true }).some(t => t.id === tool.id), false);
});
