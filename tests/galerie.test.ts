import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, it } from "node:test";
import { castNote, decorNote, readCastNote, readDecorNote } from "../src/lib/creation/fiche.ts";
import { prisePick } from "../src/lib/creation/gallery.ts";
import { DEMO_CAST, DEMO_DECOR } from "../src/lib/creation/demo.ts";
import { spendAllowed } from "../src/lib/creation/quotes.ts";
import { memoryVault } from "../src/lib/coffre/store.ts";

const BRAND = /fal(?!se|lback)/i;
const read = (path: string) => readFileSync(path, "utf8");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function dependencies(source: string): string[] {
  const clean = stripComments(source)
    .replace(/import\s+type\s+[\s\S]*?\sfrom\s+["'][^"']+["']/g, "")
    .replace(/import\s+type\s+["'][^"']+["']/g, "");
  const found = new Set<string>();
  for (const match of clean.matchAll(/from\s+["']([^"']+)["']/g)) found.add(match[1]);
  for (const match of clean.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) found.add(match[1]);
  return [...found];
}

function resolveImport(fromFile: string, spec: string): string | null {
  let target = "";
  if (spec.startsWith("@/")) target = join("src", spec.slice(2));
  else if (spec.startsWith(".")) target = resolve(dirname(fromFile), spec);
  else return null;
  const candidates = [target, `${target}.ts`, `${target}.tsx`, `${target}.css`, `${target}.json`, join(target, "index.ts"), join(target, "index.tsx")];
  return candidates.find(path => existsSync(path)) ?? null;
}

function clientFiles(): string[] {
  const roots = [
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/app/studio/page.tsx",
    "src/app/mon-studio/page.tsx",
    "src/app/compte/page.tsx",
    "src/app/manifest.ts",
    "src/app/sitemap.ts",
    "src/app/robots.ts",
    "src/app/sign-in/[[...sign-in]]/page.tsx",
    "src/app/sign-up/[[...sign-up]]/page.tsx",
  ];
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length) {
    const file = queue.pop();
    if (!file || seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    for (const spec of dependencies(read(file))) {
      const next = resolveImport(file, spec);
      if (next) queue.push(relative(process.cwd(), next));
    }
  }
  return [...seen];
}

function walkJs(dir: string, out: string[]) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkJs(path, out);
    else if (name.endsWith(".js") && !name.endsWith(".map")) out.push(path);
  }
}

describe("galerie CAST et DÉCOR", () => {
  it("keeps the brand out of the catalogues and the client graph", () => {
    for (const locale of ["fr", "en", "de", "es"]) {
      const text = read(`messages/${locale}.json`);
      assert.equal(BRAND.test(text), false, locale);
    }
    const files = clientFiles();
    assert.ok(files.includes("messages/fr.json"), "the French catalogue is in the client graph");
    assert.ok(files.includes("src/app/mon-studio/page.tsx"));
    assert.equal(files.some(file => file.includes("studio-context") || file.includes("/fal/") || file.includes("sheets.tsx")), false);
    for (const file of files) {
      const text = file.endsWith(".json") ? read(file) : stripComments(read(file));
      assert.equal(BRAND.test(text), false, file);
    }
    const built: string[] = [];
    walkJs(".next/static", built);
    const brandWord = /\bfal\b|fal\.ai/i;
    for (const file of built) assert.equal(brandWord.test(read(file)), false, file);
  });

  it("writes a markdown fiche and reads the same frontmatter back", async () => {
    const store = memoryVault();
    const cast = castNote({
      id: "mira",
      name: "Mira",
      at: "2026-10-08T12:00:00.000Z",
      prompt: "Une femme au manteau sombre.",
      source: "texte",
      photos: ["Projets/atelier/Cast/mira-p1.jpg"],
      sheet: "Projets/atelier/Cast/mira-p1.jpg",
      template: "api_bfl_flux3_t2i",
      quote: 8,
      cost: null,
      project: "atelier",
    });
    assert.match(cast, /^---\n/);
    assert.match(cast, /type: "cast"/);
    assert.match(cast, /moteur: "comfy"/);
    assert.match(cast, /cout: null/);
    await store.put({ path: "Projets/atelier/Cast/mira.md", text: cast, updatedAt: 1 });
    const back = readCastNote("mira", (await store.get("Projets/atelier/Cast/mira.md"))?.text ?? "");
    assert.equal(back?.name, "Mira");
    assert.equal(back?.prompt, "Une femme au manteau sombre.");
    assert.equal(back?.quote, 8);
    assert.equal(back?.cost, null);
    assert.equal(back?.template, "api_bfl_flux3_t2i");

    const decor = decorNote({
      id: "quai",
      name: "Le quai, la nuit",
      at: "2026-10-08T12:00:00.000Z",
      prompt: "Un quai la nuit, sans personne.",
      sheet: "Projets/atelier/Decors/quai.jpg",
      template: "api_bfl_flux3_t2i",
      quote: 8,
      cost: null,
      project: "atelier",
      castLink: "Projets/atelier/Cast/mira.md",
    });
    assert.match(decor, /\[\[Projets\/atelier\/Cast\/mira\.md\|Personnage\]\]/);
    assert.match(decor, /type: "decor"/);
    await store.put({ path: "Projets/atelier/Decors/quai.md", text: decor, updatedAt: 2 });
    const place = readDecorNote("quai", (await store.get("Projets/atelier/Decors/quai.md"))?.text ?? "");
    assert.equal(place?.name, "Le quai, la nuit");
    assert.equal(place?.castLink, "Projets/atelier/Cast/mira.md");
    assert.equal(place?.cost, null);
  });

  it("refuses a spend until a quote is confirmed", () => {
    assert.equal(spendAllowed(8, false), false);
    assert.equal(spendAllowed(8, true), true);
    assert.equal(spendAllowed(0, true), false);
    assert.equal(spendAllowed(null, true), false);
    assert.equal(spendAllowed(Number.NaN, true), false);
    const session = read("src/components/app/studio-session.tsx");
    const cast = session.slice(session.indexOf("const createCast"), session.indexOf("const createDecor"));
    const decor = session.slice(session.indexOf("const createDecor"), session.indexOf("const rewriteCast"));
    assert.ok(cast.indexOf("spendAllowed") < cast.indexOf("runStill"));
    assert.ok(cast.indexOf("runStill") < cast.indexOf("writeText"));
    assert.ok(decor.indexOf("spendAllowed") < decor.indexOf("runStill"));
    assert.ok(decor.indexOf("runStill") < decor.indexOf("writeScene"));
    assert.doesNotMatch(cast + decor, /fetch\(|submit_workflow|run_template|partner_generate|estimate_credits/);
    assert.match(read("src/components/app/stage-screens.tsx"), /create\.needLink/);
    const prise = read("src/components/app/stage-screens.tsx");
    const board = prise.slice(prise.indexOf("export function PriseStage"));
    assert.match(board, /requestRun\(\)/);
    assert.doesNotMatch(board, /confirmRun\(/);
  });

  it("sends a gallery card into PRISE and keeps a 44px target", () => {
    const picked = prisePick({ castId: "demo-mira", decorId: "demo-quai", cast: DEMO_CAST, decor: DEMO_DECOR });
    assert.equal(picked.who?.name, "Mira");
    assert.equal(picked.where?.name, "Le quai, la nuit");
    assert.equal(picked.ready, true);
    assert.equal(prisePick({ castId: "absent", decorId: "demo-quai", cast: DEMO_CAST, decor: DEMO_DECOR }).ready, false);
    const stage = read("src/components/app/stage-screens.tsx");
    assert.match(stage, /pickCast\(/);
    assert.match(stage, /pickDecor\(/);
    assert.match(stage, /EXEMPLES_DECOR/);
    assert.match(stage, /EXEMPLES_CAST/);
    assert.doesNotMatch(stage, /images\/decors\/\$\{preset/);
    const css = read("src/components/app/app.css");
    assert.match(css, /\.u-modes button, \.u-suggest button, \.u-card-actions button, \.u-gallery button, \.u-filter button \{ min-height: 44px; \}/);
    assert.match(css, /\.u-primary, \.u-secondary \{[^}]*min-height: 54px/);
    assert.match(read("src/components/app/atelier-page.tsx"), /atelier\.linkFolder/);
    assert.match(read("src/components/app/atelier-page.tsx"), /studio\.memory/);
    assert.match(read("src/components/app/atelier-page.tsx"), /studio\.shots/);
  });

  it("reserves stable slots for the homemade examples", () => {
    const manifest = JSON.parse(read("public/exemples/manifest.json")) as {
      items: { id: string; file: string; kind: string; aspect: string; statut: string; license: string }[];
    };
    const decor = ["decor-quai-nuit", "decor-rue-pluie", "decor-piece", "decor-toit-aube", "decor-gare", "decor-couloir"];
    const places = manifest.items.filter(item => item.kind === "decor");
    const people = manifest.items.filter(item => item.kind === "cast");
    assert.deepEqual(places.map(item => item.id), decor);
    assert.deepEqual(people.map(item => item.id), ["cast-mira", "cast-coursiere", "cast-vieil-homme", "cast-dj"]);
    for (const item of manifest.items) {
      assert.equal(item.statut, "maison");
      assert.equal(existsSync(item.file.replace(/^\//, "public/")), true, item.file);
      if (item.kind === "decor") assert.equal(item.aspect, "16:9");
    }
    const stage = read("src/components/app/stage-screens.tsx");
    const cast = stage.slice(stage.indexOf("export function CastStage"), stage.indexOf("export function DecorStage"));
    const board = stage.slice(stage.indexOf("export function DecorStage"), stage.indexOf("export function PriseStage"));
    assert.match(cast, /EXEMPLES_CAST/);
    assert.doesNotMatch(cast, /EXEMPLES_DECOR/);
    assert.match(board, /EXEMPLES_DECOR/);
    assert.doesNotMatch(board, /EXEMPLES_CAST/);
    assert.match(read("src/components/app/app.css"), /aspect-ratio: 16 \/ 9/);
    assert.equal(existsSync("public/exemples/port.jpg"), false);
    assert.equal(existsSync("public/exemples/decor-quai-nuit.jpg"), false);
    assert.equal(existsSync("public/exemples/cast-guide.webp"), false);
    const maison = "Rendu maison U*TTU, généré avec Seedream 4.5 via Comfy Cloud";
    for (const item of manifest.items) {
      if (item.id === "cast-mira") continue;
      assert.equal(item.statut, "maison");
      assert.equal(item.license, maison);
      assert.equal(item.file.endsWith(".webp"), true, item.file);
    }
  });
});
