import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { castShelf, characterPaths, decorShelf, pickEngine, WIRED_ENGINES } from "../src/lib/studio-comfort.ts";
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
