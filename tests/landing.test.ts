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
    assert.ok(fr.includes("Mets en scène ton plan en 3D sur ton téléphone"));
    assert.match(home, /t\("landing\.kicker"\)/);
    assert.match(home, /t\("landing\.tryFree"\)/);
    assert.match(home, /assetPath\("\/studio\?uttu=1"\)/);
    assert.ok(fr.includes("\"character\": \"CAST\""));
    assert.ok(fr.includes("\"scene\": \"DÉCOR\""));
    assert.ok(fr.includes("\"take\": \"PRISE\""));
    assert.ok(fr.includes("2 photos"));
    assert.ok(fr.includes("Entrer dans le studio"));
    assert.doesNotMatch(home, /name: "Look"/);
    assert.match(home, /className="landing-copy"/);
    assert.match(home, /LanguageSwitcher/);
    assert.match(home, /assetPath\("\/studio"\)/);
    assert.doesNotMatch(`${page}\n${home}`, JARGON);
    assert.match(page, /HomeLanding/);
    assert.match(readFileSync("src/components/landing/legacy-hash.tsx", "utf8"), /raw === "compte"\) window\.location\.replace\(assetPath\("\/studio"\)\)/);
  });

  it("says what it is in every language: open source, ComfyUI, 3D, LTX, a free door", () => {
    for (const lang of ["fr", "en", "de", "es"]) {
      const landing = JSON.parse(readFileSync(`messages/${lang}.json`, "utf8")).landing;
      assert.match(landing.kicker, /ComfyUI/);
      assert.match(landing.kicker, /open.source|código abierto/i);
      assert.match(`${landing.before}${landing.em}`, /3D/);
      assert.match(landing.em, /LTX/);
      assert.match(landing.sub, /MIT/);
      assert.match(landing.sub, /Comfy.Cloud/);
      assert.match(landing.tryFree, /\(0 /);
    }
  });

  it("opens the free U*TTU guide when the studio is reached through « Try free »", () => {
    const app = readFileSync("src/components/app/studio-app.tsx", "utf8");
    assert.match(app, /searchParams\.get\("uttu"\) === "1"/);
    assert.match(app, /toggleAssistant\(true\)/);
  });
});
