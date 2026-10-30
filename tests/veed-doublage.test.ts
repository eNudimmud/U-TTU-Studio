import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { outilEtat, outilParId, outilRow, outilsPublics } from "../src/lib/outils/catalogue.ts";
import { outilExample, outilGraph, outilQuote } from "../src/lib/outils/graphs.ts";
import { VEED_MAX_SECONDS, veedLangues, veedQuote } from "../src/lib/outils/veed.ts";
import { NOEUD_SORTIE } from "../src/lib/workflows/registre.ts";

const tool = outilParId("vid-doubler")!;

test("Doubler une prise is a ready partner video tool in MONTAGE, hidden under Open Weights Only", () => {
  assert.equal(tool.template, "api_veed_dubbing");
  assert.deepEqual(tool.onglets, ["montage"]);
  assert.equal(outilEtat(tool).kind, "pret");
  assert.equal(outilRow(tool)?.partenaire, true);
  assert.equal(outilRow(tool)?.nature, "hypothese");
  assert.ok(outilsPublics().some(t => t.id === tool.id));
  assert.equal(outilsPublics({ openWeightsOnly: true }).some(t => t.id === tool.id), false);
  assert.equal(NOEUD_SORTIE.api_veed_dubbing, "3");
});

test("the graph sends the clip, the tier and the node's own language names", () => {
  const graph = outilGraph(tool, { files: { video: "prise.mp4" }, prompt: "", seed: 7, doublage: { tier: "pro", cible: "en", source: "fr" } });
  assert.equal(graph["5"].class_type, "VeedDubbingNode");
  assert.equal(graph["1"].inputs.file, "prise.mp4");
  assert.deepEqual(graph["5"].inputs["model.video"], ["1", 0]);
  assert.equal(graph["5"].inputs.model, "pro");
  assert.equal(graph["5"].inputs["model.target_language"], "English (US)");
  assert.equal(graph["5"].inputs["model.source_language"], "French");
  assert.equal(graph["5"].inputs["model.seed"], 7);
  assert.equal(graph["3"].inputs.filename_prefix, "video/uttu-vid-doubler");
  const standard = outilGraph(tool, { files: { video: "prise.mp4" }, prompt: "", seed: 7, doublage: { cible: "es" } });
  assert.equal(standard["5"].inputs.model, "standard");
  assert.equal(standard["5"].inputs["model.target_language"], "Spanish");
  assert.equal(standard["5"].inputs["model.source_language"], "auto");
  assert.throws(() => outilGraph(tool, { files: { video: "prise.mp4" }, prompt: "", seed: 7, doublage: { cible: "fr", source: "fr" } }), /identiques/);
  assert.throws(() => outilGraph(tool, { files: {}, prompt: "", seed: 7 }), /Vidéo/);
  assert.deepEqual(JSON.parse(readFileSync("workflows/outils/outil-vid-doubler.api.json", "utf8")), outilGraph(tool, outilExample(tool)));
});

test("every offered language exists in the node's list for its tier", () => {
  const spec = JSON.parse(readFileSync("workflows/outils/outil-vid-doubler.json", "utf8"));
  assert.ok(spec.nodes.some((node: { type: string }) => node.type === "VeedDubbingNode"));
  for (const tier of ["standard", "pro"] as const) for (const cible of ["en", "fr", "de", "es", "it", "pt", "ja", "zh"] as const) {
    assert.ok(veedLangues({ tier, cible, source: "auto" }).target_language.length > 0);
  }
});

test("the quote is per second of the clip and per tier, never without a length", () => {
  assert.deepEqual(veedQuote(5), { credits: 165, high: 248, kind: "estime" });
  assert.equal(veedQuote(5, "pro")?.credits, 270);
  assert.equal(veedQuote(5.04)?.credits, 167);
  assert.deepEqual(outilQuote(tool, { seconds: 5, doublage: { tier: "pro" } }), veedQuote(5, "pro"));
  for (const seconds of [undefined, NaN, Infinity, -1, 0]) assert.equal(veedQuote(seconds), null);
  assert.deepEqual(veedQuote(VEED_MAX_SECONDS + 100), veedQuote(VEED_MAX_SECONDS));
  assert.equal(outilRow(tool)?.credits, veedQuote(5)?.credits);
});
