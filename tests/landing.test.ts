import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const JARGON = /\b(seedance|comfy|fal|lora|flux|blender|night city)\b/i;
const LANGS = ["fr", "en", "de", "es"] as const;
const catalog = (lang: string) => JSON.parse(readFileSync(`messages/${lang}.json`, "utf8"));

describe("accueil", () => {
  const home = readFileSync("src/components/landing/home.tsx", "utf8");
  const css = readFileSync("src/components/landing/home.css", "utf8");
  const page = readFileSync("src/app/page.tsx", "utf8");

  it("opens on the hero: JD's whole logo, the hook, a guided door, the studio door and « Powered by ComfyUI »", () => {
    assert.match(home, /<BrandLockup className="hv-lockup" alt="U\*TTU Studio" \/>/);
    assert.match(home, /t\("accueil\.kicker"\)/);
    assert.match(home, /rich\("accueil\.h1"\)/);
    assert.match(home, /t\("landing\.tryFree"\)/);
    assert.match(home, /t\("landing\.enter"\)/);
    assert.match(home, /assetPath\("\/studio\?uttu=1"\)/);
    assert.match(home, /assetPath\("\/studio"\)/);
    assert.match(home, /<PoweredBy className="hv-badge" \/>/);
    assert.match(home, /LanguageSwitcher/);
    assert.doesNotMatch(`${page}\n${home}`, JARGON);
    assert.match(page, /HomeLanding/);
    assert.match(readFileSync("src/components/landing/legacy-hash.tsx", "utf8"), /raw === "compte"\) window\.location\.replace\(assetPath\("\/studio"\)\)/);
  });

  it("crossfades five inspiration images, Uttu on the quay first, and can be paused", () => {
    const order = ["uttu-quai", "uttu-portrait", "hero-gare", "hero-village\\.webp", "hero-village-clair"].map(name => home.search(new RegExp(name)));
    assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), "slide order");
    for (const size of [960, 1280, 1920, 2560]) {
      assert.equal(existsSync(`public/images/accueil/uttu-quai-${size}.webp`), true);
      assert.equal(existsSync(`public/images/accueil/uttu-portrait-${size}.webp`), true);
    }
    for (const name of ["hero-gare", "hero-village", "hero-village-clair", "gare", "village", "village-clair", "capture-cadrage"]) {
      assert.equal(existsSync(`public/images/accueil/${name}.webp`), true, name);
    }
    for (const name of ["loop-map", "loop-stage"]) {
      for (const ext of ["webm", "mp4"]) assert.equal(existsSync(`public/media/accueil/${name}.${ext}`), true, name);
    }
    assert.match(home, /accueil\.pause/);
    assert.match(home, /visibilitychange/);
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /\.hv-pp \{ display: none; \}/);
  });

  it("says what it is in every language, with tutoiement and no lore", () => {
    for (const lang of LANGS) {
      const { landing, accueil } = catalog(lang);
      assert.match(accueil.kicker, /ComfyUI/, lang);
      assert.match(accueil.kicker, /open.source|código abierto/i, lang);
      assert.match(accueil.kicker, /MIT/, lang);
      assert.match(accueil.h1, /<em>.+<\/em>/, lang);
      assert.match(accueil.h1, /ComfyUI/, lang);
      assert.match(landing.tryFree, /Uttu/, lang);
      assert.doesNotMatch(landing.tryFree, /gratuit|free|kostenlos|gratis|0 cr/i, lang);
      assert.equal(Object.keys(accueil.caps).length, 5, lang);
      assert.equal(Object.keys(accueil.flow).length, 5, lang);
      assert.equal(Object.keys(accueil.trust).length, 3, lang);
      assert.match(accueil.ltxBody, /≈ 15–30 cr[ée]dit/i, lang);
      assert.doesNotMatch(JSON.stringify(accueil), /\bfal\b/i, lang);
    }
    assert.match(catalog("de").accueil.h1, /Dein/);
    assert.match(catalog("es").accueil.h1, /^Tu /);
    assert.doesNotMatch(JSON.stringify(catalog("en").accueil), /DÉCOR|PRISE/);
  });

  it("opens the U*TTU guide when the studio is reached through « Découvrir avec Uttu »", () => {
    const app = readFileSync("src/components/app/studio-app.tsx", "utf8");
    assert.match(app, /searchParams\.get\("uttu"\) === "1"/);
    assert.match(app, /toggleAssistant\(true\)/);
  });
});
