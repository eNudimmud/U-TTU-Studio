import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const JARGON = /\b(seedance|comfy|fal|lora|flux|blender|night city)\b/i;

describe("accueil cinéma", () => {
  const home = readFileSync("src/components/landing/home.tsx", "utf8");
  const page = readFileSync("src/app/page.tsx", "utf8");
  const studio = readFileSync("src/app/studio/page.tsx", "utf8");

  it("shows Look, Plateau and Take, then a plain door into the studio", () => {
    assert.match(home, /Ton style\./);
    assert.match(home, /Ta scène\./);
    assert.match(home, /La prise\./);
    assert.match(home, /name: "Look"/);
    assert.match(home, /name: "Plateau"/);
    assert.match(home, /name: "Take"/);
    assert.match(home, /Ton style/);
    assert.match(home, /Ta scène/);
    assert.match(home, /La prise/);
    assert.match(home, /Entrer dans le studio/);
    assert.match(home, /assetPath\("\/studio"\)/);
    assert.doesNotMatch(`${page}\n${home}`, JARGON);
  });

  it("keeps the working shell on /studio", () => {
    assert.match(page, /HomeLanding/);
    assert.doesNotMatch(page, /StudioShell/);
    assert.match(studio, /StudioShell/);
    assert.match(readFileSync("src/components/landing/legacy-hash.tsx", "utf8"), /\/studio/);
  });
});
