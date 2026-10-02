import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const JARGON = /\b(seedance|comfy|fal|lora|flux|blender|night city)\b/i;
const ESSAY = /Trois gestes pour un film|On te reconnaît|Le visage, la lumière|Tu commences par ton style/;

describe("accueil cinéma", () => {
  const home = readFileSync("src/components/landing/home.tsx", "utf8");
  const page = readFileSync("src/app/page.tsx", "utf8");
  const studio = readFileSync("src/app/studio/page.tsx", "utf8");

  it("shows one line, three labels, and one door into the studio", () => {
    assert.match(home, /Ton style, ta scène/);
    assert.match(home, /la prise\./);
    assert.match(home, /name: "Look"/);
    assert.match(home, /plain: "Ton style"/);
    assert.match(home, /name: "Plateau"/);
    assert.match(home, /plain: "Ta scène"/);
    assert.match(home, /name: "Take"/);
    assert.match(home, /plain: "La prise"/);
    assert.match(home, /Entrer dans le studio/);
    assert.match(home, /Rien à payer/);
    assert.match(home, /assetPath\("\/studio"\)/);
    assert.doesNotMatch(home, ESSAY);
    assert.doesNotMatch(`${page}\n${home}`, JARGON);
  });

  it("keeps the working shell on /studio", () => {
    assert.match(page, /HomeLanding/);
    assert.doesNotMatch(page, /StudioShell/);
    assert.match(studio, /StudioShell/);
    assert.match(readFileSync("src/components/landing/legacy-hash.tsx", "utf8"), /\/studio/);
  });

  it("opens the studio on a plain first step", () => {
    const create = readFileSync("src/components/studio/create-view.tsx", "utf8");
    const panel = readFileSync("src/components/studio/create-panel.tsx", "utf8");
    const shell = readFileSync("src/components/studio/shell.tsx", "utf8");
    assert.match(create, /Dépose tes photos/);
    assert.match(create, /D’abord tes photos/);
    assert.match(create, /Avant un long entraînement/);
    assert.match(shell, /Rien à payer/);
    assert.doesNotMatch(create, /Créer une LoRA|lot en PASS|Expert \/ repli|clé fal|Le gate est/);
    assert.doesNotMatch(shell, /Vente HOLD/);
    assert.doesNotMatch(panel, /clé fal|Proxy fal|vers fal/);
  });
});
