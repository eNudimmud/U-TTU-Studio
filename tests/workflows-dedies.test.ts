// Règle JD (2026-10-16) : chaque fonction passe par son workflow Comfy dédié.
// Le graphe envoyé ne contient que des nœuds du template officiel, plus une
// courte liste d'ajouts nommés ici, chacun avec sa raison.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

interface Entry { id: string; template: string; template_file: string; api_file: string | null }
const index = (JSON.parse(readFileSync("workflows/index.json", "utf8")) as { workflows: Entry[] }).workflows;

function templateTypes(path: string): Set<string> {
  const workflow = JSON.parse(readFileSync(path, "utf8")) as { nodes?: { type: string }[]; definitions?: { subgraphs?: { nodes?: { type: string }[] }[] } };
  const types = new Set<string>();
  for (const node of workflow.nodes ?? []) types.add(node.type);
  for (const sub of workflow.definitions?.subgraphs ?? []) for (const node of sub.nodes ?? []) types.add(node.type);
  return types;
}

/** Nodes the studio adds to a template, and why. Nothing else is allowed. */
const ADDED: Record<string, string> = {
  LoadImage: "les photos du visiteur entrent par un LoadImage",
  SaveImageAdvanced: "la sortie image du studio (nom de fichier stable)",
  ImageStitch: "planche : deux passes FLUX 3 cousues côte à côte",
  ImageFromBatch: "élargir : la première image du clip remplace une seconde photo",
  SaveImage: "détourer : le template n'a qu'un aperçu ; le PNG transparent doit être enregistré (demande JD)",
};
/** prise-plan chains two official templates: Klein edit makes the first frame, LTX-2.5 animates it. */
const CHAINED: Record<string, string> = { "prise-plan": "workflows/cast/cast-photos.json" };

describe("workflows Comfy dédiés", () => {
  it("sends only the dedicated template's nodes, plus the named additions", () => {
    const wired = index.filter(entry => entry.api_file);
    assert.ok(wired.length >= 20);
    for (const entry of wired) {
      const allowed = templateTypes(entry.template_file);
      if (CHAINED[entry.id]) for (const type of templateTypes(CHAINED[entry.id])) allowed.add(type);
      const graph = JSON.parse(readFileSync(entry.api_file!, "utf8")) as Record<string, { class_type: string }>;
      const foreign = [...new Set(Object.values(graph).map(node => node.class_type))].filter(type => !allowed.has(type) && !(type in ADDED));
      assert.deepEqual(foreign, [], `${entry.id} (${entry.template})`);
    }
  });
});
