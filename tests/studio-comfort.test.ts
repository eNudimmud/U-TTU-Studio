import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { briefAction, castFile, castShelf, characterPaths, decorShelf, engineMark, exampleTakeQuote, pickEngine, priseAction, priseGaps, vueProjet, weaveBrief, WIRED_ENGINES } from "../src/lib/studio-comfort.ts";
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
    assert.equal(WIRED_ENGINES.find(engine => engine.id === "comfy")!.label, "Références");
    assert.equal(WIRED_ENGINES.find(engine => engine.id === "lora")!.label, "Personnage (fichier)");
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

  it("loads the chosen character file, and never a place file", () => {
    const files = [
      { id: "lieu", kind: "lieu" as const, file: "loras/quai.safetensors" },
      { id: "mira", kind: "personnage" as const, file: "loras/mira.safetensors" },
      { id: "leo", kind: "personnage" as const, file: "loras/leo.safetensors" },
    ];
    assert.equal(castFile(files, "leo")?.id, "leo");
    assert.equal(castFile(files, "lieu")?.id, "mira");
    assert.equal(castFile(files, "")?.id, "mira");
    assert.equal(castFile(files, "absent")?.id, "mira");
    assert.equal(castFile([{ id: "lieu", kind: "lieu" as const }], "lieu"), null);
    assert.equal(castFile([], null), null);
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

  it("groups a reopened place with its characters and its takes", () => {
    const loras = [
      { id: "mira", name: "Mira", kind: "personnage" as const },
      { id: "quai", name: "Le quai", kind: "lieu" as const },
    ];
    const takes = [
      { id: "p2", sceneId: "quai", line: "  ", engine: "comfy" as const, loraId: null },
      { id: "p1", sceneId: "quai", line: "Elle traverse.", engine: "lora" as const, loraId: "mira" },
      { id: "p0", sceneId: "quai", line: "Elle revient.", engine: "lora" as const, loraId: "mira" },
      { id: "other", sceneId: "serre", line: "Ailleurs.", engine: "lora" as const, loraId: "mira" },
      { id: "place", sceneId: "quai", line: "Le décor.", engine: "lora" as const, loraId: "quai" },
      { id: "gone", sceneId: "quai", line: "Sans fichier.", engine: "lora" as const, loraId: "absent" },
    ];
    const group = vueProjet({ scene: { id: "quai", name: " Le quai " }, takes, loras, lookName: "Léa" });
    assert.equal(group.lieu, "Le quai");
    assert.deepEqual(group.personnages, ["Léa", "Mira", "Personnage"]);
    assert.deepEqual(group.prises.map(prise => prise.id), ["p2", "p1", "p0", "place", "gone"]);
    assert.equal(group.prises[0].line, "Prise");
    assert.equal(group.prises[1].line, "Elle traverse.");
    const empty = vueProjet({ scene: { id: "neuf", name: "   " }, takes, loras, lookName: "" });
    assert.equal(empty.lieu, "Sans nom");
    assert.deepEqual(empty.personnages, []);
    assert.deepEqual(empty.prises, []);
    const refs = vueProjet({
      scene: { id: "rue", name: "La rue" },
      takes: [{ id: "r", sceneId: "rue", line: "Elle marche.", engine: "comfy", loraId: null }],
      loras,
      lookName: "   ",
    });
    assert.deepEqual(refs.personnages, ["Références"]);
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
