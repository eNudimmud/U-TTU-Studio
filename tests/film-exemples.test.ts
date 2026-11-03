import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { coutExemple, EXEMPLES_FILM, lireExempleEnAttente, mediaApres } from "../src/lib/film/exemples.ts";

// Refonte FILM · PR 4 — one model for every example.

const LANGS = ["fr", "en", "de", "es"] as const;
const messages = Object.fromEntries(LANGS.map(lang => [lang, JSON.parse(readFileSync(`messages/${lang}.json`, "utf8"))]));
const get = (lang: string, key: string) => key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages[lang]);

test("every example: a type, real before and after files, a video result is a clip, never the place's still", () => {
  assert.ok(EXEMPLES_FILM.some(item => item.type === "video") && EXEMPLES_FILM.some(item => item.type === "image"));
  for (const item of EXEMPLES_FILM) {
    for (const avant of item.avant) if (avant.kind !== "texte") for (const file of [avant.image, avant.thumb]) assert.ok(existsSync(`public${file}`), file);
    const apres = mediaApres(item);
    assert.ok(existsSync(`public${apres}`), apres);
    if (item.type === "video") {
      assert.match(apres, /\.mp4$/);
      assert.ok("poster" in item.apres && existsSync(`public${item.apres.poster}`));
      assert.ok(item.avant.every(avant => avant.kind === "texte" || avant.image !== apres));
      assert.equal(item.refaire.vers, "plan");
      assert.ok(item.phrase);
    } else assert.doesNotMatch(apres, /\.mp4$/);
  }
});

test("the price to redo it comes from the studio quotes; no price, no number", () => {
  const prix = { prise: (rendu: string) => rendu === "rapide" ? 6 : 4, cast: (source: string) => source === "texte" ? 5 : 7, decor: (source: string) => source === "photo" ? 3 : 8 };
  assert.deepEqual(EXEMPLES_FILM.map(item => coutExemple(item, prix)), [6, 3, 5]);
  assert.equal(coutExemple(EXEMPLES_FILM[0]!, { ...prix, prise: () => null }), null);
});

test("every key exists in FR/EN/DE/ES and no example is ever called free", () => {
  const keys = ["titre", "liste", "resultat", "reel", "video", "image", "recetteVideo", "recetteTexte", "recettePhoto", "sansPrix", "refaire", "prepare", "note", "introuvable"].map(key => `film2.exemples.${key}`);
  for (const item of EXEMPLES_FILM) {
    keys.push(item.titre);
    if (item.phrase) keys.push(item.phrase);
    for (const avant of item.avant) if (avant.kind === "texte") keys.push(avant.texte);
  }
  for (const lang of LANGS) {
    for (const key of keys) assert.equal(typeof get(lang, key), "string", `${lang} ${key}`);
    assert.doesNotMatch(JSON.stringify(get(lang, "film2.exemples")), /gratuit|free|kostenlos|gratis/i, lang);
  }
});

test("the hand-off to CAST / DÉCOR is read once, for its own form only", () => {
  assert.equal(lireExempleEnAttente(JSON.stringify({ vers: "decor", geste: "decor-photo" }), "decor"), "decor-photo");
  assert.equal(lireExempleEnAttente(JSON.stringify({ vers: "decor", geste: "decor-photo" }), "cast"), null);
  assert.equal(lireExempleEnAttente(JSON.stringify({ vers: "cast", geste: "../x" }), "cast"), null);
  assert.equal(lireExempleEnAttente("{", "cast"), null);
  assert.equal(lireExempleEnAttente(null, "cast"), null);
});
