import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { characterPaths, WIRED_ENGINES } from "../src/lib/studio-comfort.ts";
import { workflowFiches } from "../src/lib/workflow-fiches.ts";

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
      "Personnage (fichier)",
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
      "Mon studio",
      "Les photos des références manquent dans mon studio.",
      "Au moins une photo des références.",
      "Tes références, tes lieux et tes prises",
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
    assert.equal(fr.nav.studio, "Mon studio");
    assert.doesNotMatch(chain, /Personnage \(fichier\)|Look|Rôle/);
    assert.equal(WIRED_ENGINES.find(engine => engine.id === "comfy")?.label, "Références");
    assert.equal(WIRED_ENGINES.find(engine => engine.id === "lora")?.label, "Personnage (fichier)");
    const paths = characterPaths({ falLinked: false, quote: null, steps: 1000 });
    assert.equal(paths[0].title, "Références");
    assert.equal(paths[1].title, "Fichier");
    assert.match(paths[1].body, /« Personnage \(fichier\) »/);
  });

  it("keeps #look and the fiche payers", () => {
    const route = read("src/lib/studio-route.ts");
    assert.match(route, /look: "look"/);
    assert.match(route, /#look/);
    const fiches = workflowFiches(
      { rendu: null, former: null, lieu: null, image: null },
      { seconds: 5, resolution: "768P", steps: 1000 },
    );
    const personnage = fiches.find(fiche => fiche.id === "personnage");
    const references = fiches.find(fiche => fiche.id === "references");
    assert.equal(personnage?.name, "Prise · Personnage");
    assert.equal(personnage?.payer, "rendu");
    assert.equal(personnage?.engine, "comfy");
    assert.equal(references?.name, "Prise · Références");
    assert.equal(references?.payer, "rendu");
    assert.equal(references?.engine, "comfy");
    assert.match(read("package.json"), /"next-intl"/);
    assert.equal(fr._status, "source");
  });
});
