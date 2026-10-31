import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The storyboard catalogs: same keys in the four languages, proper English in en.json (docs/GLOSSARY.md).

const load = (lang: string) => JSON.parse(readFileSync(new URL(`../messages/storyboard/${lang}.json`, import.meta.url), "utf8"));
const strings = (node: unknown, path = ""): [string, string][] => typeof node === "string" ? [[path, node]]
  : Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => strings(value, path ? `${path}.${key}` : key));
const FRENCH = /[éèêàùçœ«»]|\b(?:le|la|les|une|des|du|avec|pour|dans|ton|tes|vous|crédits?|prises?|décors?|montage|lieux?|personnages?|gratuit|outils|aucun|rien|déjà|tourner|finaliser)\b/i;

test("the four storyboard catalogs carry the same keys", () => {
  const keys = (lang: string) => strings(load(lang)).map(([key]) => key).sort();
  for (const lang of ["fr", "de", "es"]) assert.deepEqual(keys(lang), keys("en"), lang);
});

test("the English storyboard catalog has no French leftovers and uses the glossary words", () => {
  const en = strings(load("en")).map(([key, value]) => [key, value.replace(/\{[a-zA-Z]+[,}]/g, "")] as const);
  assert.deepEqual(en.filter(([, value]) => FRENCH.test(value)), []);
  assert.deepEqual(en.filter(([, value]) => /\bscenes?\b/i.test(value)), [], "« sequence », not « scene »");
  assert.ok(en.some(([, value]) => /credits estimated/.test(value)));
});
