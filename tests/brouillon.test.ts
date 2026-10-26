import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { draftEmpty, forgetDrafts, lasting, loadDraft, saveDraft, type ToolDraft } from "../src/lib/outils/brouillon.ts";

const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  sessionStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  },
};

const base: ToolDraft = { inputs: {}, text: "", aspect: "horizontal", side: "cotes", fluide: false, mesh: "objet" };

describe("brouillon d’un outil", () => {
  beforeEach(() => { store.clear(); forgetDrafts(); });

  test("un formulaire vide n’est pas gardé", () => {
    assert.equal(draftEmpty(base), true);
    saveDraft("img-x", base);
    assert.equal(loadDraft("img-x", () => undefined), null);
  });

  test("on retrouve le texte, les réglages et l’image en revenant", () => {
    const draft = { ...base, text: "un chat roux", aspect: "vertical" as const, inputs: { image: { url: "blob:x", name: "chat.png" } } };
    saveDraft("img-x", draft);
    assert.deepEqual(loadDraft("img-x", () => undefined), draft);
  });

  test("après un rechargement : le texte reste, une image locale non, une image du studio revient", () => {
    saveDraft("vid-x", { ...base, text: "travelling", inputs: { image: { url: "blob:a", name: "a.png" }, image2: { url: "blob:b", name: "b.png", path: "Projets/p/Assets/b.png" } } });
    forgetDrafts();
    const back = loadDraft("vid-x", path => path === "Projets/p/Assets/b.png" ? "blob:nouveau" : undefined);
    assert.equal(back?.text, "travelling");
    assert.equal(back?.inputs.image, undefined);
    assert.equal(back?.inputs.image2?.url, "blob:nouveau");
  });

  test("vider le formulaire efface le brouillon", () => {
    saveDraft("img-x", { ...base, text: "a" });
    saveDraft("img-x", base);
    forgetDrafts();
    assert.equal(loadDraft("img-x", () => undefined), null);
  });

  test("un fichier choisi ne part jamais dans sessionStorage", () => {
    const kept = lasting({ ...base, inputs: { image: { url: "https://cdn/x.png", name: "x" }, audio: { url: "blob:s", name: "s" } } });
    assert.deepEqual(Object.keys(kept.inputs), ["image"]);
  });
});
