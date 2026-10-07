import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const JARGON = /\b(seedance|comfy|fal|lora|flux|blender|night city)\b/i;

describe("accueil", () => {
  const home = readFileSync("src/components/landing/home.tsx", "utf8");
  const page = readFileSync("src/app/page.tsx", "utf8");

  it("shows one line and one door into the studio, without jargon", () => {
    assert.match(home, /Ton personnage, ta scène/);
    assert.match(home, /Personnage/);
    assert.match(home, /Deux façons/);
    assert.doesNotMatch(home, /name: "Look"/);
    assert.match(home, /className="landing-copy"/);
    assert.match(home, /Entrer dans le studio/);
    assert.match(home, /assetPath\("\/studio"\)/);
    assert.doesNotMatch(`${page}\n${home}`, JARGON);
    assert.match(page, /HomeLanding/);
    assert.match(readFileSync("src/components/landing/legacy-hash.tsx", "utf8"), /ACCOUNT_PATH/);
  });
});
