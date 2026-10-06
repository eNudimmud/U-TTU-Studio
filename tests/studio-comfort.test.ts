import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { castShelf, decorShelf, pickEngine, WIRED_ENGINES } from "../src/lib/studio-comfort.ts";

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
