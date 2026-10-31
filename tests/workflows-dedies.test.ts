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
  ImageScale: "décor 3D : la vue 3D et sa profondeur ramenées au 1024×576 du rendu",
  BatchImagesNode: "les 8 angles (29.10.2026) : les 8 images sortent par un seul nœud final, au lieu de 8 SaveImage",
  StringConcatenate: "bulle image : le style demandé (photo…) est redit après l’upsampler, qui réécrit la demande (JD 31.10.2026, nœud cœur déjà dans des templates officiels)",
  SaveImage: "détourer : le template n'a qu'un aperçu ; le PNG transparent doit être enregistré (demande JD)",
};
/** prise-plan chains two official templates: Klein edit makes the first frame, LTX-2.5 animates it.
 *  prise-plan-cadre adds the InstantX ControlNet template (kept framing).
 *  decor-3d-apparence joins the FLUX depth LoRA template (structure) and the FLUX Redux template (photos as style). */
const CHAINED: Record<string, string[]> = {
  "prise-plan": ["workflows/cast/cast-photos.json"],
  "prise-plan-cadre": ["workflows/cast/cast-photos.json", "workflows/prise/sources/image_qwen_image_instantx_controlnet.json"],
  "decor-3d-apparence": ["workflows/decor/decor-3d-apparence-redux.json"],
};

describe("workflows Comfy dédiés", () => {
  it("sends only the dedicated template's nodes, plus the named additions", () => {
    const wired = index.filter(entry => entry.api_file);
    assert.ok(wired.length >= 20);
    for (const entry of wired) {
      const allowed = templateTypes(entry.template_file);
      for (const file of CHAINED[entry.id] ?? []) for (const type of templateTypes(file)) allowed.add(type);
      // Only this chain adds official core sizing nodes, to match the control PNGs.
      if (entry.id === "prise-plan-cadre") for (const type of ["GetImageSize", "ImageScale"]) allowed.add(type);
      const graph = JSON.parse(readFileSync(entry.api_file!, "utf8")) as Record<string, { class_type: string }>;
      const foreign = [...new Set(Object.values(graph).map(node => node.class_type))].filter(type => !allowed.has(type) && !(type in ADDED));
      assert.deepEqual(foreign, [], `${entry.id} (${entry.template})`);
    }
  });
});
