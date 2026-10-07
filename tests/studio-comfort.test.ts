import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { briefAction, castShelf, characterPaths, decorShelf, engineMark, exampleTakeQuote, pickEngine, priseAction, priseGaps, weaveBrief, WIRED_ENGINES } from "../src/lib/studio-comfort.ts";
import { formatUsd } from "../src/lib/fal/prices.ts";

describe("confort studio", () => {
  it("offers only the engines the take can run", () => {
    assert.deepEqual(WIRED_ENGINES.map(engine => engine.id), ["comfy", "lora"]);
    assert.equal(pickEngine("comfy"), "comfy");
    assert.equal(pickEngine("lora"), "lora");
    assert.equal(pickEngine("flux"), null);
    assert.equal(pickEngine("seedance"), null);
    assert.equal(pickEngine(""), null);
    assert.deepEqual(WIRED_ENGINES.map(engine => engine.model), ["MiniMax H3", "MiniMax H3"]);
    assert.match(WIRED_ENGINES.find(engine => engine.id === "comfy")!.sound, /Le son est dans la prise/);
    assert.match(WIRED_ENGINES.find(engine => engine.id === "lora")!.sound, /pas un réglage/);
  });

  it("prints an example price on each engine, and a live amount only when one was quoted", () => {
    assert.equal(engineMark({ id: "lora", seconds: 5, resolution: "768P", live: null }), `Exemple · ${formatUsd(0.075 * 5)}`);
    assert.equal(engineMark({ id: "lora", seconds: 8, resolution: "480P", live: null }), `Exemple · ${formatUsd(0.0625 * 8)}`);
    assert.equal(engineMark({ id: "lora", seconds: 5, resolution: "768P", live: "1,20 $" }), "1,20 $");
    assert.equal(engineMark({ id: "comfy", seconds: 8, resolution: "768P", live: null }), "Exemple · 0,39 crédit/s");
    assert.equal(engineMark({ id: "comfy", seconds: 5, resolution: "480P", live: "12 crédits" }), "12 crédits");
  });

  it("keeps named characters off the place files", () => {
    assert.deepEqual(castShelf([
      { id: "a", name: "Mira", kind: "personnage" },
      { id: "b", name: "Le quai", kind: "lieu" },
      { id: "c", name: "   ", kind: "personnage" },
    ]), [
      { id: "a", name: "Mira" },
      { id: "c", name: "Personnage" },
    ]);
  });

  it("keeps the two character paths apart, and only prices the file when fal has a quote", () => {
    const closed = characterPaths({ falLinked: false, quote: 15, steps: 1000 });
    assert.deepEqual(closed.map(path => path.id), ["references", "fichier"]);
    assert.equal(closed[0].action, "Tenir les photos");
    assert.equal(closed[1].action, "Former un fichier");
    assert.match(closed[0].body, /trois au plus/);
    assert.match(closed[0].body, /Rien à former/);
    assert.doesNotMatch(closed[0].body, /\$/);
    assert.match(closed[1].body, /compte fal/);
    assert.doesNotMatch(closed[1].body, /\$/);
    const unread = characterPaths({ falLinked: true, quote: null, steps: 1000 });
    assert.match(unread[1].body, /avant le geste/);
    assert.doesNotMatch(unread[1].body, /\$/);
    const quoted = characterPaths({ falLinked: true, quote: 15, steps: 1000 });
    assert.match(quoted[1].body, new RegExp(formatUsd(15).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(quoted[1].body, /2000 pas coûtent le double de 1000/);
    assert.doesNotMatch(quoted[0].body, /\$/);
  });

  it("lets a visitor read La prise, and only charges after Relier", () => {
    const bare = { engine: "comfy" as const, falLinked: false, connected: false, lookReady: false, hasScene: false, hasCharacter: false, canSpend: false, price: null };
    assert.equal(priseAction(bare).id, "relier");
    assert.equal(priseAction(bare).label, "Relier");
    assert.equal(priseAction({ ...bare, engine: "lora" }).id, "relier");
    assert.equal(priseAction({ ...bare, engine: "lora" }).label, "Relier");
    assert.equal(priseAction({ ...bare, connected: true }).id, "photos");
    assert.equal(priseAction({ ...bare, connected: true, lookReady: true }).id, "scene");
    assert.equal(priseAction({ ...bare, engine: "lora", falLinked: true, lookReady: true, hasScene: true, hasCharacter: false }).id, "fichier");
    assert.equal(priseAction({ ...bare, connected: true, lookReady: true, hasScene: true, canSpend: false }).id, "bloque");
    assert.equal(priseAction({ ...bare, connected: true, lookReady: true, hasScene: true, canSpend: true, price: "12,00 $" }).label, "Tourner · 12,00 $");
    const gaps = priseGaps({ lookReady: false, hasScene: false, engine: "comfy", hasCharacter: false });
    assert.deepEqual(gaps.map(gap => gap.id), ["photos", "scene"]);
    assert.deepEqual(priseGaps({ lookReady: true, hasScene: true, engine: "lora", hasCharacter: false }).map(gap => gap.id), ["fichier"]);
    assert.match(exampleTakeQuote({ engine: "lora", seconds: 5, resolution: "768P" }), /Exemple/);
    assert.match(exampleTakeQuote({ engine: "lora", seconds: 5, resolution: "768P" }), /Rien n’est débité/);
    assert.match(exampleTakeQuote({ engine: "comfy", seconds: 8, resolution: "480P" }), /0,39/);
    assert.match(exampleTakeQuote({ engine: "comfy", seconds: 8, resolution: "480P" }), /8 s/);
    assert.doesNotMatch(exampleTakeQuote({ engine: "comfy", seconds: 5, resolution: "768P" }), /Relier mon compte fal/);
  });

  it("writes the chosen cast and place into the brief, and lifts that prefix back off", () => {
    assert.equal(weaveBrief({ who: "Mira", place: "Le quai", action: "Elle traverse." }), "Mira · Le quai. Elle traverse.");
    assert.equal(weaveBrief({ who: "Mira", place: "", action: "" }), "Mira.");
    assert.equal(weaveBrief({ who: "", place: "", action: "Elle traverse." }), "Elle traverse.");
    assert.equal(briefAction("Mira · Le quai. Elle traverse.", "Mira", "Le quai"), "Elle traverse.");
    assert.equal(briefAction("Mira.", "Mira", ""), "");
    assert.equal(briefAction("Déjà écrit.", "Mira", "Le quai"), "Déjà écrit.");
  });

  it("names each place and says when its camera is stored", () => {
    assert.deepEqual(decorShelf([
      { id: "s", name: "Le quai", camera: { x: 0, y: 0, z: 0, aimX: 0, aimY: 0, aimZ: 0, endX: 1, endY: 0, endZ: 0, endAimX: 0, endAimY: 0, endAimZ: 0, lens: 35 } },
      { id: "t", name: "  ", camera: null },
    ]), [
      { id: "s", name: "Le quai", camera: true },
      { id: "t", name: "Sans nom", camera: false },
    ]);
  });
});
