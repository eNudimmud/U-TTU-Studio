import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const JARGON = /\b(seedance|comfy|fal|lora|flux|blender|night city)\b/i;

describe("accueil", () => {
  const home = readFileSync("src/components/landing/home.tsx", "utf8");
  const page = readFileSync("src/app/page.tsx", "utf8");
  const fr = readFileSync("messages/fr.json", "utf8");

  it("shows one line and one door into the studio, without jargon", () => {
    assert.match(home, /t\("landing\.before"\)/);
    assert.match(home, /t\("nav\.character"\)/);
    assert.match(home, /t\("landing\.twoWays"\)/);
    assert.match(home, /t\("landing\.enter"\)/);
    assert.ok(fr.includes("Ton personnage, ta scène"));
    assert.ok(fr.includes("\"character\": \"Personnage\""));
    assert.ok(fr.includes("Deux façons"));
    assert.ok(fr.includes("Entrer dans le studio"));
    assert.doesNotMatch(home, /name: "Look"/);
    assert.match(home, /className="landing-copy"/);
    assert.match(home, /LanguageSwitcher/);
    assert.match(home, /assetPath\("\/studio"\)/);
    assert.doesNotMatch(`${page}\n${home}`, JARGON);
    assert.match(page, /HomeLanding/);
    assert.match(readFileSync("src/components/landing/legacy-hash.tsx", "utf8"), /ACCOUNT_PATH/);
  });
});
