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
    assert.equal(catalogs.de._status, "reviewed");
    assert.equal(catalogs.es._status, "reviewed");
    assert.equal(catalogs.en.nav.studio, "My studio");
    assert.equal(catalogs.de.nav.studio, "Mein Studio");
    assert.equal(catalogs.es.nav.studio, "Mi estudio");
    assert.equal(catalogs.de.nav.character, "Figur");
    assert.equal(catalogs.de.nav.take, "Take");
    assert.equal(catalogs.es.nav.character, "Personaje");
    assert.equal(catalogs.es.nav.take, "Toma");
    assert.equal(catalogs.de.verb.relier, "Verbinden");
    assert.equal(catalogs.de.verb.lancer, "Aufrufen");
    assert.equal(catalogs.de.verb.tourner, "Drehen");
    assert.equal(catalogs.de.verb.former, "Trainieren");
    assert.equal(catalogs.es.verb.relier, "Vincular");
    assert.equal(catalogs.es.verb.lancer, "Lanzar");
    assert.equal(catalogs.es.verb.tourner, "Rodar");
    assert.equal(catalogs.es.verb.former, "Entrenar");
    assert.equal(catalogs.de.sheet.walletTitle, "Guthaben");
    assert.equal(catalogs.es.sheet.walletTitle, "Saldo");
    assert.equal(catalogs.de.sheet.quote, "Kalkulation");
    assert.equal(catalogs.es.sheet.quote, "Presupuesto");
    assert.equal(catalogs.de.take.soft, "Es ist nicht zustande gekommen.");
    assert.equal(catalogs.es.take.soft, "No ha salido.");
    assert.equal(catalogs.de.why.hold, "Die Kalkulation oder das Guthaben hält die Geste zurück.");
    assert.equal(catalogs.es.why.hold, "El presupuesto o el saldo frena el gesto.");
    assert.equal(catalogs.fr.verb.batir, "Bâtir");
    assert.equal(catalogs.fr.verb.buildThis, undefined);
    assert.equal(catalogs.fr.verb.buildPriced, undefined);
    assert.equal(catalogs.fr.scene.formedNew, undefined);
    assert.equal(catalogs.fr.fiche.image, undefined);
    assert.doesNotMatch(JSON.stringify(catalogs.de), /Angebot|Charakter|Tresor|Vault|Cofre/);
    assert.doesNotMatch(JSON.stringify(catalogs.es), /Cofre|Vault|Tresor|Carácter/);
    assert.equal(catalogs.en.tree.modelTake, "Template · Take");
    assert.equal(catalogs.fr.sequence.raccord, "Raccord");
    assert.equal(catalogs.en.sequence.raccord, "Continuity");
    assert.equal(catalogs.de.sequence.raccord, "Anschluss");
    assert.equal(catalogs.de.sequence.title, "Sequenzen");
    assert.equal(catalogs.es.sequence.raccord, "Raccord");
    assert.equal(catalogs.es.sequence.title, "Secuencias");
    assert.equal(catalogs.en.tree.modelSequence, "Template · Sequence");
    assert.doesNotMatch(JSON.stringify(catalogs.en), /Vault|Tresor|Cofre/);
  });

  it("translates a gabarit and leaves a real take name", () => {
    const t = (key: string) => key;
    assert.equal(phrase(t, "Modèle · Prise"), "tree.modelTake");
    assert.equal(phrase(t, "Modèle · Séquence"), "tree.modelSequence");
    assert.equal(phrase(t, "Modèle · Plan"), "tree.modelShot");
    assert.equal(phrase(t, "Séquence créée."), "sequence.created");
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
