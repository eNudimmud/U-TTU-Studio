import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { LANDING } from "../src/lib/landing/page-copy.ts";

const JARGON = /\b(seedance|comfy|fal|lora|flux|blender|night city)\b/i;
const LANGS = ["fr", "en", "de", "es"] as const;
const catalog = (lang: string) => JSON.parse(readFileSync(`messages/${lang}.json`, "utf8"));

describe("accueil", () => {
  const home = readFileSync("src/components/landing/home.tsx", "utf8");
  const css = readFileSync("src/components/landing/landing.css", "utf8");
  const page = readFileSync("src/app/page.tsx", "utf8");

  it("opens on the quay still, the studio door, and the Guide", () => {
    assert.match(home, /<BrandLockup className="hv-lockup" alt="U\*TTU Studio" \/>/);
    assert.match(home, /t\("accueil\.kicker"\)/);
    assert.match(home, /rich\("accueil\.h1"\)/);
    assert.match(home, /copy\.readGuide/);
    assert.match(home, /t\("landing\.enter"\)/);
    assert.match(home, /const studioHref = useStudioHref\(STUDIO\)/);
    assert.match(home, /className="hv-btn hv-gold" href=\{studioHref\} data-enter-studio=""/);
    assert.match(home, /data-read-guide=""/);
    assert.match(home, /assetPath\("\/guide"\)/);
    assert.match(home, /assetPath\("\/studio"\)/);
    assert.doesNotMatch(home, /uttu=1/);
    assert.doesNotMatch(home, /accueil\.also|loop-stage|Discover with Uttu/);
    // The step links live in the copy since the 3 Nov pass, home.tsx only renders them.
    assert.match(readFileSync("src/lib/landing/page-copy.ts", "utf8"), /#personnage[\s\S]*#scene[\s\S]*#prise[\s\S]*#montage[\s\S]*#finaliser/);
    assert.match(home, /vid-h3-refs|vid-multi|vid-fasth3|vid-animer/);
    assert.doesNotMatch(home, /<section id="models">|<section id="costs">|copy\.licenceNote|copy\.partnerList|copy\.costs\.map/);
    assert.match(home, /<PoweredBy className="hv-badge" \/>/);
    assert.match(home, /LanguageSwitcher/);
    assert.doesNotMatch(`${page}\n${home}`, JARGON);
    assert.match(page, /HomeLanding/);
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.equal(existsSync("public/images/accueil/uttu-quai-1920.webp"), true);
    assert.equal(existsSync("public/look/anime/hero-key.webp"), true);
  });

  it("says what it is in every language, with estimated prices and no free", () => {
    for (const lang of LANGS) {
      const { landing, accueil } = catalog(lang);
      const copy = LANDING[lang];
      assert.match(accueil.kicker, /ComfyUI/, lang);
      assert.match(accueil.kicker, /open.source|código abierto/i, lang);
      assert.match(accueil.h1, /<em>.+<\/em>/, lang);
      assert.match(landing.readGuide, /Guide|guide|guía/i, lang);
      assert.doesNotMatch(landing.readGuide, /gratuit|free|kostenlos|gratis|0 cr/i, lang);
      assert.equal(copy.steps.length, 5, lang);
      assert.equal(copy.trust.length, 3, lang);
      assert.match(copy.steps[3]!.body, /browser|navigateur|Browser|navegador/i, lang);
      assert.match(copy.steps[3]!.body, /no render|aucun rendu|kein Rendering|sin render/, lang);
      // Character swap is the Higgsfield partner node: named, priced, never « Soon ».
      const swap = copy.h3.find(item => item.partner);
      assert.ok(swap && !swap.soon && /Higgsfield Genjutsu/.test(swap.name) && /480/.test(swap.cost), lang);
      assert.equal(copy.h3.some(item => item.soon), false, lang);
      assert.match(copy.h3Title, /lui-même|the same|dieselbe|sí mismo/, lang);
      assert.doesNotMatch(JSON.stringify(copy.openList), /TripoSplat|Nano Banana/, lang);
      assert.match(JSON.stringify(copy.partnerList), /FLUX\.3 \[pro\]/, lang);
      assert.match(copy.licenceNote, /MiniMax[ -]H3/, lang);
      for (const step of copy.steps) {
        assert.ok(step.image && existsSync(`public${step.image}`), `${lang} ${step.id} has a real capture`);
        assert.ok(step.alt.trim() && !step.placeholder, `${lang} ${step.id} alt, no placeholder`);
      }
      assert.ok(copy.costs.every(row => /estim|geschätzt/i.test(row.price)), lang);
      assert.equal(/\bfal\b/i.test(JSON.stringify(copy)), false, lang);
      assert.equal(/\b(free|gratuit|kostenlos|gratis)\b/i.test(JSON.stringify(copy)), false, lang);
    }
    assert.match(catalog("de").accueil.h1, /Dein/);
    assert.match(catalog("es").accueil.h1, /^Tu /);
  });

  it("still opens Uttu when an old link asks with ?uttu=1", () => {
    const app = readFileSync("src/components/app/studio-app.tsx", "utf8");
    assert.match(app, /searchParams\.get\("uttu"\) === "1"/);
    assert.match(app, /toggleAssistant\(true\)/);
  });
});
