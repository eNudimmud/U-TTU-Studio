import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
/** Width and height of a baseline or progressive JPEG (SOF0/SOF2 marker). */
function jpegSize(path: string): [number, number] {
  const bytes = readFileSync(path);
  for (let i = 2; i < bytes.length;) {
    const marker = bytes[i + 1];
    const length = bytes.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc2) return [bytes.readUInt16BE(i + 7), bytes.readUInt16BE(i + 5)];
    i += 2 + length;
  }
  return [0, 0];
}

describe("DA et logo partout", () => {
  it("garde la personnalisation hors de l'app (pas de lore)", () => {
    const app = [...files("src"), "messages/fr.json", "messages/en.json", "messages/de.json", "messages/es.json"]
      .filter(path => /\.(tsx?|css|json)$/.test(path) && !path.endsWith("place-template.ts"));
    for (const path of app) {
      const text = read(path);
      assert.doesNotMatch(text, /THE BLOC|THE BREACH|NEUKOAI|\bNABU\b|\bENKI\b/, path);
    }
    assert.doesNotMatch(read("src/lib/creation/demo.ts"), /demo-uttu|cast-uttu/);
    for (const gone of ["public/exemples/cast-uttu.webp", "public/exemples/cast-uttu-planche.webp", "public/exemples/apres-cast-photos.webp", "public/images/uttu-canon-portrait.webp", "public/images/uttu-guide-face.webp"]) {
      assert.equal(existsSync(gone), false, gone);
    }
  });

  it("n'a qu'un accent : les liens prennent l'or du logo, plus de bleu", () => {
    const css = read("src/app/globals.css");
    assert.match(css, /--accent: #c9a75b/i);
    assert.match(css, /--link: var\(--accent\)/);
    assert.doesNotMatch(css + read("src/components/app/app.css") + read("src/lib/clerk-appearance.ts"), /#8ab4ff/i);
    assert.doesNotMatch(read("src/components/app/glyphs.tsx"), /export const (Web|Iii)\b/);
  });

  it("publie icônes, manifeste et aperçus de lien depuis le logo de JD", () => {
    for (const icon of ["src/app/favicon.ico", "src/app/icon0.svg", "src/app/icon1.png", "src/app/icon2.png", "src/app/icon3.png", "src/app/apple-icon.png", "public/brand/icon-v3-192.png", "public/brand/icon-v3-512.png", "public/brand/icon-v3-maskable-512.png"]) {
      assert.equal(existsSync(icon), true, icon);
    }
    for (const old of ["public/brand/icon-192.png", "public/brand/icon-512.png", "public/brand/icon-maskable-512.png"]) {
      assert.equal(existsSync(old), false, old);
    }
    for (const icon of [] as string[]) {
      assert.equal(existsSync(icon), true, icon);
    }
    assert.match(read("src/app/icon0.svg"), /<image [^>]*href="data:image\/png;base64,/);
    assert.doesNotMatch(read("src/app/icon0.svg"), /<path|<circle|<line/);
    const manifest = read("src/app/manifest.ts");
    assert.match(manifest, /purpose: "maskable"/);
    assert.match(manifest, /icon-\$\{V\}-maskable-512\.png/);
    assert.match(manifest, /background_color: "#0F0F11"/);
    assert.match(manifest, /theme_color: "#0F0F11"/);
    const routes = JSON.parse(read("src/lib/route-meta.json")) as { id: string; path: string; title: string; description: string }[];
    assert.deepEqual(routes.map(route => route.path), ["/", "/studio", "/mon-studio", "/compte", "/sign-in", "/sign-up"]);
    for (const route of routes) {
      assert.match(route.title, /U\*TTU Studio/, route.id);
      assert.ok(route.description.length > 20 && route.description.length < 200, route.id);
      assert.deepEqual(jpegSize(`public/og/${route.id}.jpg`), [1200, 630], route.id);
    }
    assert.deepEqual(jpegSize("public/og.jpg"), [1200, 630]);
    for (const page of ["src/app/page.tsx", "src/app/studio/page.tsx", "src/app/mon-studio/page.tsx", "src/app/compte/page.tsx"]) {
      assert.match(read(page), /routeMetadata\("/, page);
    }
  });

  it("a une page 404 et une page d'erreur à la DA, logo entier", () => {
    assert.match(read("src/app/not-found.tsx"), /StatusPage kind="introuvable"/);
    assert.match(read("src/app/error.tsx"), /StatusPage kind="erreur"/);
    const page = read("src/components/status-page.tsx");
    assert.match(page, /BrandLockup/);
    assert.match(page, /alt="U\*TTU Studio"/);
    assert.match(page, /PoweredBy/);
  });
});
