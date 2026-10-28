/** Read-only production map for the Studio Agent. No workflow execution authority. */
import { OUTILS, outilEtat, type Outil } from "../outils/catalogue.ts";
import { REGISTRE, gesteOuvert, gesteVisible, type FiltreGestes } from "../workflows/registre.ts";

export type StudioArea = "cast" | "decor" | "prise" | "montage" | "outils" | "coffre" | "projets";
export interface StudioOperation {
  id: string;
  area: StudioArea;
  label: string;
  status: "ready" | "disabled";
  inputKinds: readonly string[];
  outputKind: string;
  requiresPrompt: boolean;
  toolId?: string;
  template?: string;
  quote?: { credits: number; ceiling: number; estimated: boolean };
  reason?: string;
}
const areaFor = (tool: Outil): StudioArea => tool.onglets[0] ?? (tool.sous === "son" ? "montage" : tool.sous === "video" ? "prise" : "outils");
/** The actual tool/gesture registries, not a second manually maintained list. */
export function studioProductionMap(filters: FiltreGestes = {}): StudioOperation[] {
  const operations: StudioOperation[] = OUTILS.map(tool => {
    const state = outilEtat(tool, filters);
    const row = REGISTRE.find(item => item.id === tool.geste);
    return {
      id: `tool:${tool.id}`, area: areaFor(tool), label: tool.id,
      status: state.kind === "pret" ? "ready" : "disabled",
      inputKinds: tool.entrees.map(entry => entry === "image2" ? "image" : entry),
      outputKind: tool.sortie, requiresPrompt: tool.texte === "requis",
      toolId: tool.id, template: tool.template,
      ...(state.kind === "pret" && row?.credits != null && row.high != null ? { quote: { credits: row.credits, ceiling: row.high, estimated: row.nature !== "mesure" } } : {}),
      ...(state.kind !== "pret" ? { reason: state.kind === "bientot" ? state.raison : state.kind === "app" ? "runs-in-comfy-app" : "hidden-by-preferences" } : {}),
    };
  });
  for (const gesture of REGISTRE) {
    if (gesture.onglet !== "cast" && gesture.onglet !== "decor" && gesture.onglet !== "prise" && gesture.onglet !== "montage") continue;
    const ready = gesteOuvert(gesture) && gesteVisible(gesture, filters);
    operations.push({
      id: `gesture:${gesture.id}`, area: gesture.onglet, label: gesture.clef,
      status: ready ? "ready" : "disabled",
      inputKinds: gesture.fournit, outputKind: gesture.still ?? "unknown",
      requiresPrompt: gesture.fournit.includes("texte"), template: gesture.template,
      ...(ready && gesture.credits != null && gesture.high != null ? { quote: { credits: gesture.credits, ceiling: gesture.high, estimated: gesture.nature !== "mesure" } } : {}),
      ...(!ready ? { reason: gesture.raison ?? "not-ready" } : {}),
    });
  }
  return operations;
}
