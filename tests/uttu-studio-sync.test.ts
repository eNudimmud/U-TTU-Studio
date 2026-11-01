import { test } from "node:test";
import assert from "node:assert/strict";
import { knowledge } from "../scripts/agent-knowledge.mjs";
import { OUTILS, outilEtat, outilsPublics } from "../src/lib/outils/catalogue.ts";
import { UTTU_LOCALES, type Knowledge } from "../src/lib/agent/uttu.ts";
import { GUIDE_FAQ, allowedTools, buildPack, quoteText, routerBody } from "../src/lib/agent/uttu-comfy.ts";

// Uttu knows the studio from the same catalogue and registry the studio renders. These tests keep
// it that way: a tool that opens is known (with its quote), a tool that is closed is never named.
const k = knowledge("abcdef0123456789", false) as Knowledge;
const open = outilsPublics().filter(o => outilEtat(o).kind === "pret").map(o => o.id);
const closed = OUTILS.map(o => o.id).filter(id => !open.includes(id));
const word = (id: string) => new RegExp(`(^|[^\\w-])${id.replace(/[-]/g, "\\-")}(?![\\w-])`);

test("sync: every open studio tool is known to Uttu, with title, line and registry quote, in every language", () => {
  assert.ok(open.length >= 30, String(open.length));
  assert.deepEqual([...allowedTools(k)].sort(), [...open].sort());
  for (const locale of UTTU_LOCALES) {
    const pack = buildPack(k, locale, "?");
    for (const id of open) {
      const info = k.locales[locale].tools[id];
      assert.ok(info?.title && info.line, `${locale} ${id}`);
      const line = pack.split("\n").find(l => l.startsWith(`- ${id}: `));
      assert.ok(line, `${locale} ${id} missing from the pack`);
      assert.ok(line.includes(info.title), `${locale} ${id} title`);
      const tool = k.tools.find(t => t.id === id)!;
      const quote = quoteText(locale, tool.cost, tool.nature);
      if (quote) assert.ok(line.includes(quote), `${locale} ${id} quote`);
    }
  }
});

test("sync: no closed or hidden tool is named to the model or accepted as an action", () => {
  assert.ok(closed.length > 0);
  for (const locale of UTTU_LOCALES) {
    const pack = buildPack(k, locale, "Quel outil pour une vidéo ?");
    for (const id of closed) assert.doesNotMatch(pack, word(id), `${locale} ${id}`);
    // Engines that only closed tools use are not named either. Nano Banana 2.1 composes the
    // image bubble's references since 31.10.2026, so the bubble guide names it.
    assert.doesNotMatch(pack, /\b(Kling|Seedance|Tripo|Meshy|Hunyuan)\b/i, locale);
    const body = routerBody(k, locale, "Quel outil ?", []);
    for (const id of closed) assert.ok(!body.text.format.schema.properties.tool.enum.includes(id), id);
  }
});

test("sync: quotes are written in credits, never as free, image vs video vs sound is explicit", () => {
  assert.equal(quoteText("fr", [3, 6], "mesure"), "≈ 3–6 crédits mesurés");
  assert.equal(quoteText("fr", [1, 1], "mesure"), "≈ 1 crédit mesuré");
  assert.equal(quoteText("en", [4, 6], "hypothese"), "≈ 4–6 credits estimated");
  assert.equal(quoteText("de", [2.46, 3.69], "hypothese"), "≈ 2,46–3,69 Credits geschätzt");
  assert.equal(quoteText("es", [480, 720], "hypothese"), "≈ 480–720 créditos estimados");
  assert.equal(quoteText("fr", null, "mesure"), null);
  for (const locale of UTTU_LOCALES) {
    const pack = buildPack(k, locale, "?");
    assert.doesNotMatch(pack, /\b(gratuit|gratuite|free|kostenlos|gratis)\b/i, locale);
    assert.match(pack, /- img-klein: [^\n]*\[image/);
    assert.match(pack, /- vid-h3-refs: [^\n]*\[video/);
    assert.match(pack, /- son-dialogue: [^\n]*\[sound/);
    assert.match(pack, /\nSTEPS /);
  }
});

test("sync: the guide entries (bubble, references, PRISE in 5 steps, upload, Finaliser, which tool) exist and always travel", () => {
  for (const locale of UTTU_LOCALES) {
    const faq = k.locales[locale].faq;
    for (const id of ["bubble", "refs", "prise5", "upload", "finaliser", "which"]) assert.ok(faq.some(f => f.id === id), `${locale} ${id}`);
    const pack = buildPack(k, locale, "Hallo");
    for (const id of GUIDE_FAQ) {
      const entry = faq.find(f => f.id === id);
      assert.ok(entry, `${locale} ${id}`);
      assert.ok(pack.includes(`Q: ${entry.q}`), `${locale} ${id} not in the pack`);
    }
    const prise = faq.find(f => f.id === "prise5")!.a;
    assert.equal((prise.match(/[1-5]\./g) ?? []).length, 5, locale);
    const bubble = faq.find(f => f.id === "bubble")!.a;
    for (const engine of ["Nano Banana 2.1", "Klein", "MiniMax H3", "LTX"]) assert.ok(bubble.includes(engine), `${locale} ${engine}`);
    assert.match(faq.find(f => f.id === "upload")!.a, /200/);
  }
});

test("sync: Uttu is the only guide, and no answer calls a render free", () => {
  for (const locale of UTTU_LOCALES) {
    const L = k.locales[locale];
    const text = JSON.stringify(L.faq);
    assert.doesNotMatch(text, /\bMira\b/, locale);
    for (const f of L.faq) assert.doesNotMatch(f.a, /\b(gratuit|gratuite|gratuitement|free|kostenlos|gratis)\b/i, `${locale} ${f.id}`);
  }
});

test("sync: top 10 paths are guided, unintegrated workflows are never proposed", () => {
  for (const locale of UTTU_LOCALES) {
    const pack = buildPack(k, locale, "Quel outil pour plusieurs angles et une vidéo à partir de références ?");
    for (const id of ["ret-angles-perso", "ret-angles-decor", "ret-camera", "son-bruitage-video", "son-separer", "vid-multi", "vid-transition-style", "ret-eclairer-ouvert", "vid-h3-refs"]) {
      assert.ok(open.includes(id), id);
      assert.ok(pack.includes(k.locales[locale].tools[id].title), `${locale} ${id}`);
    }
    const which = k.locales[locale].faq.find(f => f.id === "which")!.a;
    assert.match(which, /≈ 14 /, `${locale} multi-camera recipe`);
    assert.ok(which.includes(k.locales[locale].tools["ret-angles-perso"].title), locale);
    // Not integrated (docs/mesures/workflows-top10-2026-10-29.md, LTX reference sheet) and the merged card is gone.
    assert.doesNotMatch(pack, /planche LTX|LTX reference sheet|ic_lora_ingredients|Vidéo à références multiples|vid-vidu/i, locale);
  }
});

test("sync: the audit's open-weight models are guided inside their card, by model name, with the audit's tips", () => {
  const tool = (id: string) => k.tools.find(t => t.id === id)!;
  assert.deepEqual(tool("vid-h3-refs").variantes, ["vid-fasth3", "vid-pika"]);
  assert.ok(tool("ret-eclairer-ouvert").variantes.includes("ret-lumiere-image"));
  // Partner models of a card are never named.
  assert.ok(!tool("vid-h3-refs").variantes.includes("vid-vidu"));
  assert.ok(!tool("ret-eclairer-ouvert").variantes.includes("ret-eclairer"));
  const tips: Record<string, [RegExp, RegExp]> = {
    fr: [/contrastée avec le portrait/, /consigne structurée/], en: [/contrasts with the portrait/, /structured prompt/],
    de: [/vom Porträt abheben/, /strukturierte Anweisung/], es: [/contraste con el retrato/, /instrucción estructurada/],
  };
  for (const locale of UTTU_LOCALES) {
    const L = k.locales[locale];
    const pack = buildPack(k, locale, "Une vidéo de mon personnage sur le quai, et copier la lumière d’une photo ?");
    const lines = pack.split("\n");
    const under = (card: string) => lines[lines.findIndex(line => line.startsWith(`- ${card}: `)) + 1];
    const fasth3 = under("vid-h3-refs");
    assert.ok(fasth3.startsWith("  + "), `${locale} FastH3 under its card`);
    assert.ok(fasth3, `${locale} FastH3 line`);
    assert.ok(fasth3.includes(L.tools["vid-fasth3"].model!), locale);
    assert.ok(fasth3.includes(quoteText(locale, tool("vid-fasth3").cost, tool("vid-fasth3").nature)!), `${locale} FastH3 quote`);
    assert.match(fasth3, /FastH3/);
    assert.match(fasth3, tips[locale][1]);
    const light = under("ret-eclairer-ouvert");
    assert.ok(light.startsWith("  + "), `${locale} light under its card`);
    assert.ok(light, `${locale} light line`);
    assert.ok(light.includes(L.tools["ret-lumiere-image"].model!), locale);
    assert.match(light, tips[locale][0]);
    // Model ids are never offered as tools of their own.
    assert.doesNotMatch(pack, /(^|[^\w-])(vid-fasth3|ret-lumiere-image)(?![\w-])/, locale);
  }
});
