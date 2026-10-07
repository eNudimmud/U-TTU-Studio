import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { castShelf, characterPaths, decorShelf, exampleTakeQuote, pickEngine, priseAction, priseGaps, WIRED_ENGINES } from "../src/lib/studio-comfort.ts";
import { formatUsd } from "../src/lib/fal/prices.ts";

describe("confort studio", () => {
  it("offers only the engines the take can run", () => {
    assert.deepEqual(WIRED_ENGINES.map(engine => engine.id), ["comfy", "lora"]);
    assert.equal(pickEngine("comfy"), "comfy");
    assert.equal(pickEngine("lora"), "lora");
    assert.equal(pickEngine("flux"), null);
    assert.equal(pickEngine("seedance"), null);
    assert.equal(pickEngine(""), null);
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
    assert.equal(priseAction(bare).id, "relier-rendu");
    assert.equal(priseAction({ ...bare, engine: "lora" }).id, "relier-fal");
    assert.equal(priseAction({ ...bare, connected: true }).id, "photos");
    assert.equal(priseAction({ ...bare, connected: true, lookReady: true }).id, "scene");
    assert.equal(priseAction({ ...bare, engine: "lora", falLinked: true, lookReady: true, hasScene: true, hasCharacter: false }).id, "fichier");
    assert.equal(priseAction({ ...bare, connected: true, lookReady: true, hasScene: true, canSpend: false }).id, "bloque");
    assert.equal(priseAction({ ...bare, connected: true, lookReady: true, hasScene: true, canSpend: true, price: "12,00 $" }).label, "Tourner · 12,00 $");
    const gaps = priseGaps({ lookReady: false, hasScene: false, engine: "comfy", falLinked: false, connected: false, hasCharacter: false });
    assert.deepEqual(gaps.map(gap => gap.id), ["photos", "scene", "relier-rendu"]);
    assert.match(exampleTakeQuote({ engine: "lora", seconds: 5, resolution: "768P" }), /Exemple/);
    assert.match(exampleTakeQuote({ engine: "lora", seconds: 5, resolution: "768P" }), /Rien n’est débité/);
    assert.match(exampleTakeQuote({ engine: "comfy", seconds: 8, resolution: "480P" }), /0,39/);
    assert.match(exampleTakeQuote({ engine: "comfy", seconds: 8, resolution: "480P" }), /8 s/);
    assert.doesNotMatch(exampleTakeQuote({ engine: "comfy", seconds: 5, resolution: "768P" }), /Relier mon compte fal/);
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
