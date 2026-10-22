import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const fr = JSON.parse(read("messages/fr.json")) as {
  _status: string;
  nav: { character: string; scene: string; take: string; edit: string; chain: string; studio: string };
  verb: Record<string, string>;
};

describe("lexique français", () => {
  it("snapshots the canon strings", () => {
    const copy = read("messages/fr.json");
    for (const line of [
      "Photos des références",
      "Remettre ces références",
      "Ce qui tient les références",
      "Lieux",
      "Ce lieu se rouvre avec sa caméra.",
      "Tes prises",
      "Fichier",
      "Références",
      "CAST",
      "DÉCOR",
      "PRISE",
      "Ajoute 2 photos (face et trois-quarts).",
      "Générer la vidéo",
      "Mes crédits",
      "Connecter mon compte Comfy",
      "Moteur",
      "Mes créations",
      "Les photos des références manquent dans mes créations.",
      "Au moins une photo des références.",
      "Modèle · Prise",
    ]) {
      assert.ok(copy.includes(line), line);
    }
  });

  it("keeps the six verbs distinct", () => {
    assert.equal(fr.verb.relier, "Relier");
    assert.equal(fr.verb.lancer, "Lancer");
    assert.equal(fr.verb.tourner, "Tourner");
    assert.equal(fr.verb.former, "Former");
    assert.equal(fr.verb.filmer, "Filmer");
    assert.equal(fr.verb.batir, "Bâtir");
  });

  it("drops the retired French labels", () => {
    const values = JSON.stringify(JSON.parse(read("messages/fr.json")));
    for (const retired of [
      "Photos du look",
      "Remettre ce look",
      "Ce qui tient le look",
      "Mon look",
      "Décors",
      "Ce décor",
      "Cohérence",
      "\"Vault\"",
      "\"Cast\"",
      "\"Shot\"",
      "Exporter le coffre",
      "Importer un coffre",
    ]) {
      assert.equal(values.includes(retired), false, retired);
    }
    assert.equal(values.includes("Coffre"), false);
  });

  it("names the chain, the file engine and the file path apart", () => {
    const steps = read("src/components/app/studio-app.tsx");
    const chain = steps.slice(steps.indexOf("const STEPS"), steps.indexOf("export function StudioApp"));
    assert.match(chain, /key: "nav.character"/);
    assert.match(chain, /key: "nav.scene"/);
    assert.match(chain, /key: "nav.take"/);
    assert.equal(fr.nav.character, "CAST");
    assert.equal(fr.nav.scene, "DÉCOR");
    assert.equal(fr.nav.take, "PRISE");
    assert.equal(fr.nav.edit, "MONTAGE");
    assert.equal(fr.nav.chain, "CAST, DÉCOR, PRISE, MONTAGE");
    assert.equal(fr.nav.studio, "Mes créations");
    assert.doesNotMatch(chain, /Personnage \(fichier\)|Look|Rôle/);
  });

  it("keeps #look and the fiche payers", () => {
    const route = read("src/lib/studio-route.ts");
    assert.match(route, /look: "look"/);
    assert.match(route, /#look/);
    assert.match(read("package.json"), /"next-intl"/);
    assert.equal(fr._status, "source");
  });
});
