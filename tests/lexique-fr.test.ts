import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { characterPaths, WIRED_ENGINES } from "../src/lib/studio-comfort.ts";
import { workflowFiches } from "../src/lib/workflow-fiches.ts";

const read = (path: string) => readFileSync(path, "utf8");

/** Visible French copy. Technical ids (#look, type look, LookScreen) stay out of this bundle. */
const COPY = [
  "src/components/app/screens.tsx",
  "src/components/app/sheets.tsx",
  "src/components/app/lora-screen.tsx",
  "src/components/app/fiches-screen.tsx",
  "src/components/app/studio-app.tsx",
  "src/components/app/studio-context.tsx",
  "src/components/account/account-page.tsx",
  "src/components/landing/home.tsx",
  "src/lib/studio-comfort.ts",
  "src/lib/render/take-graph.ts",
  "src/lib/lora/take.ts",
  "src/lib/coffre/model.ts",
].map(read).join("\n");

describe("lexique français", () => {
  it("snapshots the canon strings", () => {
    for (const line of [
      "Photos des références",
      "Remettre ces références",
      "Ce qui tient les références",
      'aria-label="Lieux"',
      "Ce lieu se rouvre avec sa caméra.",
      "Tes prises",
      "Personnage (fichier)",
      'title: "Fichier"',
      'title: "Références"',
      "Distribution",
      'className="u-label">Moteur',
      "Mon studio",
      "Les photos des références manquent dans mon studio.",
      "Au moins une photo des références.",
      "Tes références, tes lieux et tes prises",
    ]) {
      assert.ok(COPY.includes(line), line);
    }
  });

  it("keeps the six verbs distinct", () => {
    for (const verb of ["Relier", "Lancer", "Tourner", "Former", "Filmer", "Bâtir"]) {
      assert.match(COPY, new RegExp(`\\b${verb}\\b`));
    }
  });

  it("drops the retired French labels", () => {
    for (const retired of [
      "Photos du look",
      "Remettre ce look",
      "Ce qui tient le look",
      "Mon look",
      "du look",
      "Décors",
      "Ce décor",
      "Cohérence",
      '"Vault"',
      '"Cast"',
      '"Shot"',
      "Exporter le coffre",
      "Importer un coffre",
    ]) {
      assert.equal(COPY.includes(retired), false, retired);
    }
  });

  it("names the chain, the file engine and the file path apart", () => {
    const steps = read("src/components/app/studio-app.tsx");
    const chain = steps.slice(steps.indexOf("const STEPS"), steps.indexOf("export function StudioApp"));
    assert.match(chain, /label: "Personnage"/);
    assert.match(chain, /label: "Scène"/);
    assert.match(chain, /label: "Prise"/);
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
    assert.doesNotMatch(read("package.json"), /next-intl/);
  });
});
