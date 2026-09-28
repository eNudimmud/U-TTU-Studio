import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SPHERE_PRESETS, STUDIO_MODES, modeFromHash } from "../src/lib/studio-modes.ts";

describe("studio shell modes", () => {
  it("exposes the five modes, in nav order, with ASCII hashes", () => {
    assert.deepEqual(STUDIO_MODES.map(mode => mode.label), ["Créer", "Sphère", "Identité", "Bibliothèque", "Studio"]);
    assert.deepEqual(STUDIO_MODES.map(mode => mode.id), ["creer", "sphere", "identite", "bibliotheque", "studio"]);
    for (const mode of STUDIO_MODES) assert.match(mode.id, /^[a-z]+$/);
  });

  it("reads a hash and falls back to Créer", () => {
    assert.equal(modeFromHash(""), "creer");
    assert.equal(modeFromHash("#"), "creer");
    assert.equal(modeFromHash("#inconnu"), "creer");
    assert.equal(modeFromHash("#creer"), "creer");
    assert.equal(modeFromHash("#SPHERE"), "sphere");
    assert.equal(modeFromHash("#sphère"), "sphere");
    assert.equal(modeFromHash("#identite"), "identite");
    assert.equal(modeFromHash("#identité"), "identite");
    assert.equal(modeFromHash("#bibliotheque"), "bibliotheque");
    assert.equal(modeFromHash("#bibliothèque&suite"), "bibliotheque");
    assert.equal(modeFromHash("#studio?x=1"), "studio");
  });
});

describe("sphère presets", () => {
  it("names Avant, Après and Entre, without a video backend", () => {
    assert.deepEqual(SPHERE_PRESETS.map(preset => preset.id), ["avant", "apres", "entre"]);
    assert.deepEqual(SPHERE_PRESETS.map(preset => preset.title), ["Avant", "Après", "Entre"]);
    for (const preset of SPHERE_PRESETS) {
      const text = `${preset.line} ${preset.detail}`;
      assert.doesNotMatch(text, /https?:|fal\.ai|iframe|fetch\(/i);
    }
  });
});

describe("shell sources stay offline", () => {
  const panels = [
    "src/components/studio/sphere-panel.tsx",
    "src/components/studio/library-panel.tsx",
    "src/components/studio/dashboard-panel.tsx",
  ];

  it("does not call the network from the bientôt panels", () => {
    for (const file of panels) {
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(text, /fetch\(|XMLHttpRequest|new WebSocket|fal\.ai|cloud\.comfy\.org/, file);
    }
  });
});
