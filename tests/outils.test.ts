import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { cherche, dansFamille, FAMILLES, INTENT_MODELES, OUTILS, intentDe, modelesIntent, outilEtat, outilParGeste, outilRow, outilsOnglet, outilsPublics } from "../src/lib/outils/catalogue.ts";
import { routePrompt } from "../src/lib/outils/route.ts";
import { OUTIL_BASES } from "../src/lib/outils/base.ts";
import { outilExample, outilGraph, outilQuote } from "../src/lib/outils/graphs.ts";
import { gesteOuvert, TEMPLATES_OFFICIELS } from "../src/lib/workflows/registre.ts";

const map = readFileSync("docs/WORKFLOWS.md", "utf8");
const langs = ["fr", "en", "de", "es"].map(lang => [lang, JSON.parse(readFileSync(`messages/${lang}.json`, "utf8"))] as const);
const wired = OUTILS.filter(item => outilEtat(item, { nanoBanana: true }).kind === "pret");
const soon = OUTILS.filter(item => outilEtat(item, { nanoBanana: true }).kind === "bientot");

function links(graph: Record<string, { inputs: Record<string, unknown> }>): string[] {
  const missing: string[] = [];
  for (const [id, node] of Object.entries(graph)) {
    for (const [name, value] of Object.entries(node.inputs)) {
      if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && typeof value[1] === "number" && !graph[value[0]]) missing.push(`${id}.${name} → ${value[0]}`);
    }
  }
  return missing;
}

describe("hub Outils", () => {
  it("lists the 54 map rows with a ready Comfy template as 57 cards, every one in a family", () => {
    assert.equal(OUTILS.length, 57);
    assert.equal(new Set(OUTILS.map(item => item.id)).size, 57);
    assert.equal(new Set(OUTILS.map(item => item.num)).size, 54);
    for (const item of OUTILS) assert.ok(FAMILLES.includes(item.famille), item.id);
    for (const famille of FAMILLES) assert.ok(OUTILS.some(item => dansFamille(item, famille)), famille);
  });

  it("wires 47 cards and says « bientôt » with a reason for the other 10", () => {
    assert.equal(wired.length, 47);
    assert.equal(soon.length, 10);
    for (const item of soon) assert.ok(item.bientot, item.id);
    for (const item of wired) {
      const row = outilRow(item)!;
      assert.ok(row && gesteOuvert(row), item.id);
      assert.ok((TEMPLATES_OFFICIELS as readonly string[]).includes(row.template), item.id);
      assert.ok(map.includes(row.template), row.template);
    }
  });

  it("builds a complete graph for every wired card, with no dangling link, no fal and no cancel", () => {
    for (const item of wired) {
      const graph = outilGraph(item, outilExample(item));
      assert.ok(Object.keys(graph).length > 0, item.id);
      assert.deepEqual(links(graph), [], item.id);
      const text = JSON.stringify(graph);
      assert.doesNotMatch(text, /fal\.ai|fal-ai/i, item.id);
      assert.ok(Object.values(graph).some(node => /^Save|VideoCombine/.test((node as { class_type: string }).class_type)), item.id);
    }
  });

  it("keeps the official templates intact apart from the visitor's inputs", () => {
    for (const [template, graph] of Object.entries(OUTIL_BASES)) {
      assert.ok((TEMPLATES_OFFICIELS as readonly string[]).includes(template), template);
      assert.deepEqual(links(graph as Record<string, { inputs: Record<string, unknown> }>), [], template);
    }
    const source = readFileSync("src/lib/outils/graphs.ts", "utf8") + readFileSync("src/components/app/outils-hub.tsx", "utf8");
    assert.doesNotMatch(source, /\.cancel\(/);
    assert.doesNotMatch(source, /fal\.ai|@fal-ai/);
  });

  it("estimates every wired card, per started 5 s block for per-length tools", () => {
    for (const item of wired) {
      const quote = outilQuote(item, item.parTranche ? { seconds: 5 } : {});
      assert.ok(quote && quote.credits > 0 && quote.high >= quote.credits, item.id);
      assert.equal(quote.kind, "estime");
    }
    const lips = OUTILS.find(item => item.id === "vid-levres")!;
    assert.equal(outilQuote(lips, { seconds: 5 })!.credits * 2, outilQuote(lips, { seconds: 7 })!.credits);
    assert.equal(outilQuote(lips, { seconds: 5.04 })!.credits, outilQuote(lips, { seconds: 5 })!.credits);
    const musique = OUTILS.find(item => item.id === "son-musique-video")!;
    assert.equal(outilQuote(musique), null);
    assert.equal(outilQuote(musique, { seconds: 5 })!.credits, 10);
    assert.equal(outilQuote(musique, { seconds: 10 })!.credits, 20);
  });

  it("feeds each tab from the same hub data", () => {
    for (const onglet of ["cast", "decor", "prise", "montage"] as const) {
      const list = outilsOnglet(onglet);
      assert.ok(list.length > 0, onglet);
      for (const item of list) assert.ok(OUTILS.includes(item));
    }
    assert.equal(outilParGeste("suite-detourer")?.id, "ret-detourer");
  });

  it("searches without accents", () => {
    assert.ok(cherche("Détourer une vidéo", "detourer video"));
    assert.ok(!cherche("Musique", "voix"));
  });

  it("names every card and reason in FR, EN, DE and ES", () => {
    for (const [lang, messages] of langs) {
      for (const item of OUTILS) {
        assert.ok(messages.outils.t[item.id]?.title, `${lang} ${item.id}`);
        assert.ok(messages.outils.t[item.id]?.line, `${lang} ${item.id}`);
        if (item.bientot) assert.ok(messages.outils.why[item.bientot], `${lang} ${item.bientot}`);
      }
      for (const famille of FAMILLES) assert.ok(messages.outils.fam[famille], `${lang} ${famille}`);
    }
  });

  it("publishes one card per intent and hides the ten unwired tools", () => {
    const cards = outilsPublics();
    assert.equal(cards.length, 34);
    const ids = cards.map(item => item.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(cards.length < OUTILS.length);
    assert.equal(cards.filter(item => item.bientot).length, 0);
    for (const soon of OUTILS.filter(item => item.bientot)) assert.equal(cards.some(item => item.id === soon.id), false, soon.id);
    assert.equal(intentDe("vid-kling"), "vid-wan");
    assert.equal(intentDe("vid-animer"), "vid-wan");
    assert.equal(intentDe("vid-ltx-image"), "vid-wan");
    assert.equal(modelesIntent("vid-kling")[0]?.id, "vid-wan");
    assert.equal(intentDe("3d-meshy"), "3d-ouvert");
    assert.equal(intentDe("son-voix"), "son-voix-ouverte");
    assert.equal(intentDe("vid-prolonger-grok"), "vid-prolonger");
    assert.equal(cards.filter(item => item.id === "vid-wan").length, 1);
    assert.equal(cards.some(item => item.id === "vid-kling"), false);
    assert.equal(Object.values(INTENT_MODELES).flat().length, 6 + 2 + 4 + 2 + 2 + 2);
    // Nano stays off unless the visitor asks for it; the open card is still there.
    assert.equal(cards.some(item => item.id === "img-nano"), false);
    assert.equal(outilsPublics({ nanoBanana: true }).some(item => item.id === "img-nano"), true);
  });

  it("routes a free prompt to a still, a video tool, or the film", () => {
    assert.deepEqual(routePrompt("Une femme au manteau sombre, regard calme."), { kind: "outil", id: "img-klein" });
    assert.deepEqual(routePrompt("Animer un portrait : elle se tourne vers la caméra."), { kind: "outil", id: "vid-wan" });
    assert.deepEqual(routePrompt("Une vidéo d'un chat qui dort."), { kind: "outil", id: "vid-texte" });
    assert.deepEqual(routePrompt("Un court film : un personnage, un lieu, un plan."), { kind: "film" });
    assert.deepEqual(routePrompt("A short film: a character and a place."), { kind: "film" });
  });

  it("never names a model in a « bientôt » reason", () => {
    for (const [, messages] of langs) {
      for (const reason of Object.values(messages.outils.why) as string[]) {
        assert.doesNotMatch(reason, /flux|qwen|kling|seedance|hunyuan|tripo|meshy|chatterbox|eleven|grok|wan|ltx|minimax|vidu|bria|sync/i, reason);
      }
    }
  });
});
