import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DEFAULT_LOCALE, readLocaleValue, requestLocaleFrom } from "../src/lib/i18n/config.ts";
import { loopPage } from "../src/lib/studio-origin-page.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const en = JSON.parse(read("messages/en.json"));

/** Words and accents that only French text carries. A hit in an English string is a leftover. */
const FRENCH = /[éèêàùçœ«»]|\b(?:le|la|les|une|des|du|avec|pour|dans|ton|tes|vous|crédits?|prises?|décors?|montage|lieux?|personnages?|gratuit|outils|aucun|rien|déjà|tourner|finaliser)\b/i;
/** Proper names and language names the visitor reads as such in every language. */
const ALLOWED = new Set(["rep3d.example.place", "uttu.faq.language.a", "accueil.also.langs.body", "lang.fr"]);

function strings(node: unknown, path: string[] = [], out: [string, string][] = []): [string, string][] {
  if (typeof node === "string") out.push([path.join("."), node]);
  else if (node && typeof node === "object") for (const [key, value] of Object.entries(node)) strings(value, [...path, key], out);
  return out;
}

describe("English by default", () => {
  it("a fresh visitor gets English, even with a French browser", () => {
    assert.equal(DEFAULT_LOCALE, "en");
    assert.equal(requestLocaleFrom(undefined, "fr-CH,fr;q=0.9"), "en");
    assert.equal(readLocaleValue(undefined), "en");
    assert.equal(readLocaleValue("xx"), "en");
  });

  it("a saved choice (cookie) is respected", () => {
    for (const locale of ["fr", "de", "es", "en"] as const) assert.equal(requestLocaleFrom(locale, "en-US"), locale);
  });

  it("the cross-origin notice page follows the saved choice, English otherwise", () => {
    const page = (cookie: string | undefined) => loopPage({ locale: requestLocaleFrom(cookie, "fr-CH,fr;q=0.9"), retry: "https://studio.example/studio", home: "/", origin: "https://studio.example", email: "a@b.c" });
    assert.match(page(undefined), /<html lang="en"/);
    assert.match(page("fr"), /<html lang="fr-CH"/);
  });

  it("the English catalogue carries no French leftovers (simple scan of every string)", () => {
    const all = strings(en);
    assert.ok(all.length > 2000, `scanned ${all.length} strings`);
    const hits = all.filter(([key, value]) => !key.startsWith("_") && !ALLOWED.has(key) && FRENCH.test(value));
    assert.deepEqual(hits, []);
  });

  it("section names are CAST · SET · SHOOT · EDIT in English", () => {
    assert.deepEqual(
      [en.accueil.flow.cast.name, en.accueil.flow.decor.name, en.accueil.flow.prise.name, en.accueil.flow.montage.name, en.accueil.flow.finaliser.name],
      ["CAST", "SET", "SHOOT", "EDIT", "FINISH"],
    );
    assert.equal(en.nav.take, "Shoot");
  });

  it("link previews, manifest and examples are in English", () => {
    const routes = JSON.parse(read("src/lib/route-meta.json")) as { title: string; ogTitle: string; kicker: string; description: string }[];
    for (const route of routes) for (const text of [route.title, route.ogTitle, route.kicker, route.description]) assert.doesNotMatch(text, FRENCH, text);
    assert.match(read("src/lib/route-meta.ts"), /locale: "en_GB"/);
    assert.match(en.meta.title, /Open-source AI film studio/);
    assert.doesNotMatch(en.meta.description, FRENCH);
    const manifest = read("src/app/manifest.ts");
    assert.match(manifest, /lang: "en"/);
    assert.doesNotMatch(manifest.match(/description: "([^"]+)"/)![1], FRENCH);
    const examples = JSON.parse(read("public/exemples/manifest.json")) as { items: { title: string; prompt: string }[] };
    for (const item of examples.items) for (const text of [item.title, item.prompt]) assert.doesNotMatch(text, FRENCH, text);
    assert.match(read("src/lib/site.ts"), /og\.jpg\?v=4/);
  });

  it("share images are 1200×630", () => {
    for (const file of ["public/og.jpg", "public/og/accueil.jpg", "public/og/studio.jpg", "public/og/creations.jpg"]) {
      const bytes = readFileSync(new URL(`../${file}`, import.meta.url));
      let at = 2;
      while (at < bytes.length && !(bytes[at + 1] >= 0xc0 && bytes[at + 1] <= 0xc2)) at += 2 + bytes.readUInt16BE(at + 2);
      assert.deepEqual([bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5)], [1200, 630], file);
    }
  });

  it("the layout reads the locale from the saved choice only", () => {
    const server = read("src/lib/i18n/server.ts");
    assert.doesNotMatch(server, /accept-language/);
    assert.match(server, /LOCALE_COOKIE/);
  });
});
