import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { LOCALE_COOKIE, LOCALES, readLocaleValue } from "../src/lib/i18n/config.ts";
import { phrase } from "../src/lib/i18n/phrase.ts";

const read = (path: string) => readFileSync(path, "utf8");

function keysOf(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => keysOf(item, prefix ? `${prefix}.${key}` : key));
}

describe("langues du studio", () => {
  it("keeps FR, EN, DE and ES on the same keys", () => {
    const catalogs = Object.fromEntries(LOCALES.map(locale => [locale, JSON.parse(read(`messages/${locale}.json`))]));
    const keys = keysOf(catalogs.fr).sort();
    for (const locale of LOCALES) assert.deepEqual(keysOf(catalogs[locale]).sort(), keys, locale);
    assert.equal(catalogs.fr._status, "source");
    assert.equal(catalogs.en._status, "reviewed_calques");
    assert.equal(catalogs.de._status, "needs_human_audit");
    assert.equal(catalogs.es._status, "needs_human_audit");
    assert.equal(catalogs.en.nav.studio, "My studio");
    assert.equal(catalogs.de.nav.studio, "Mein Studio");
    assert.equal(catalogs.es.nav.studio, "Mi estudio");
    assert.equal(catalogs.en.tree.modelTake, "Template · Take");
    assert.doesNotMatch(JSON.stringify(catalogs.en), /Vault|Tresor|Cofre/);
  });

  it("translates a gabarit and leaves a real take name", () => {
    const t = (key: string) => key;
    assert.equal(phrase(t, "Modèle · Prise"), "tree.modelTake");
    assert.equal(phrase(t, "Moteur · Personnage"), "tree.engineCharacter");
    assert.equal(phrase(t, "Prises"), "tree.takes");
    assert.equal(phrase(t, "une.md"), "une.md");
    assert.equal(phrase(t, "20261003-153000-le-quai.md"), "20261003-153000-le-quai.md");
    assert.equal(readLocaleValue("es"), "es");
    assert.equal(readLocaleValue("nope"), "fr");
    assert.equal(LOCALE_COOKIE, "u-ttu-locale");
  });

  it("switches language without a locale in the path", () => {
    assert.equal(existsSync("src/app/[locale]"), false);
    assert.match(read("src/components/app/studio-app.tsx"), /<LanguageSwitcher \/>/);
    assert.match(read("src/components/app/studio-app.tsx"), /<LanguageSwitcher rail \/>/);
    assert.match(read("src/components/landing/home.tsx"), /<LanguageSwitcher \/>/);
    assert.match(read("src/app/layout.tsx"), /u-ttu-locale|LOCALE_COOKIE/);
  });
});
