import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Le studio tutoie partout : FR « tu », DE « du », ES « tú ».
// Ce garde-fou interdit le retour du vouvoiement, dans les catalogues comme dans les phrases écrites dans le code.

const root = new URL("../", import.meta.url).pathname;
const load = (locale: string) => JSON.parse(readFileSync(join(root, `messages/${locale}.json`), "utf8"));
const flat = (node: unknown, path = ""): [string, string][] =>
  typeof node === "string" ? [[path, node]] : Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => flat(v, path ? `${path}.${k}` : k));

const VOUS = /(?<![\p{L}])(vous|votre|vôtre|vos)(?![\p{L}])/iu;
// Mots en -ez qui ne sont pas des impératifs (et quelques mots espagnols).
const WHITELIST = new Set(["chez", "assez", "nez", "rez", "fez", "raz", "diez", "vez", "nitidez", "rapidez", "pez", "jerez", "lopez", "lópez", "perez", "pérez", "gonzalez", "gonzález", "martinez", "martínez", "rodriguez", "rodríguez", "sanchez", "sánchez", "suez"]);
const EZ = /(?<![\p{L}])(\p{L}+ez)(?![\p{L}])/giu;

function frHits(text: string): string[] {
  const hits: string[] = [];
  const v = text.match(VOUS);
  if (v) hits.push(v[0]);
  for (const m of text.matchAll(EZ)) if (!WHITELIST.has(m[1].toLowerCase())) hits.push(m[1]);
  return hits;
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|mts|js|mjs)$/.test(name) ? [path] : [];
  });
}

// Retire les commentaires : seules les phrases visibles comptent.
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

test("aucun texte FR du catalogue ne vouvoie", () => {
  const bad = flat(load("fr")).filter(([, text]) => frHits(text).length).map(([key, text]) => `${key}: ${frHits(text).join(", ")} — ${text}`);
  assert.deepEqual(bad, []);
});

test("aucune phrase FR écrite dans le code ne vouvoie (erreurs, avis, aria-label, title, métadonnées)", () => {
  const bad: string[] = [];
  for (const file of sources(join(root, "src"))) {
    stripComments(readFileSync(file, "utf8")).split("\n").forEach((line, i) => {
      const hits = frHits(line);
      if (hits.length) bad.push(`${file.slice(root.length)}:${i + 1}: ${hits.join(", ")}`);
    });
  }
  assert.deepEqual(bad, []);
});

test("le catalogue DE tutoie (du/dein), sans Sie de politesse", () => {
  const formal = /(?<![\p{L}])(Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres|Ihnen)(?![\p{L}])|[A-ZÄÖÜa-zäöüß]+en Sie(?![\p{L}])|(?<=[a-zäöüß,;:] )Sie (können|möchten|müssen|haben|sind)(?![\p{L}])/u;
  const bad = flat(load("de")).filter(([, text]) => formal.test(text)).map(([key, text]) => `${key}: ${text}`);
  assert.deepEqual(bad, []);
});

test("le catalogue ES tutoie (tú), sans usted", () => {
  const formal = /(?<![\p{L}])(usted|ustedes|Revise|Elija|Verifique|Compruebe|Seleccione|Utilice|Conserve|Vuelva a|Intente)(?![\p{L}])/u;
  const bad = flat(load("es")).filter(([, text]) => formal.test(text)).map(([key, text]) => `${key}: ${text}`);
  assert.deepEqual(bad, []);
});

test("les phrases FR de fiabilité traduites par phrase.ts restent identiques au catalogue", () => {
  const fr = load("fr");
  const get = (key: string) => key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], fr);
  const source = readFileSync(join(root, "src/lib/i18n/phrase.ts"), "utf8");
  const exact = [...source.matchAll(/^\s*"([^"]+)": "([\w.]+)",?$/gm)];
  assert.ok(exact.length > 20);
  for (const [, sentence, key] of exact) {
    const value = get(key);
    if (key.startsWith("runtimeSafe.") && typeof value === "string" && !value.includes("{")) assert.equal(value, sentence, key);
  }
});
