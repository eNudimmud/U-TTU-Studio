// The exact API graphs the studio sends, with placeholder inputs, for the
// workflows/ folder. Pure functions: tests compare them with the files.

import { stillGraph, type StillKind } from "../creation/still.ts";
import { stemGraph, type StemKind } from "../creation/stem.ts";
import { ltxTakeGraph } from "../render/ltx-graph.ts";
import { isVideoGeste, videoGesteGraph } from "../render/video-gestes.ts";
import { isMeshGeste, meshGesteGraph } from "../render/mesh-gestes.ts";
import { DEFAULT_TAKE, takeGraph, type ApiGraph } from "../render/take-graph.ts";
import { isSuiteGeste, suiteExample, suiteGraph } from "../suite/graphs.ts";
import { outilParGeste } from "../outils/catalogue.ts";
import { outilExample, outilGraph } from "../outils/graphs.ts";
import { REGISTRE, type Geste } from "./registre.ts";

const PROMPT = "<texte du visiteur>";

/** The graph the studio builds for a wired gesture, or null when the card is not wired yet. */
export function graphForGeste(row: Geste): ApiGraph | null {
  if (row.still === null) return null;
  const images = row.slots.filter(slot => (slot.media ?? "image") === "image").map((_, index) => `uttu-${index + 1}.jpg`);
  if (row.still === "prise") {
    const pictures = ["uttu-personnage.jpg", "uttu-lieu.jpg"];
    if (row.template === "video_ltx2_5_i2v") return ltxTakeGraph({ prompt: PROMPT, pictures, seed: 0, seconds: DEFAULT_TAKE.seconds, aspect: DEFAULT_TAKE.aspect, ...(row.id === "prise-plan-cadre" ? { controls: { depth: "uttu-depth.png", edges: "uttu-edges.png" } } : {}) });
    return takeGraph({ ...DEFAULT_TAKE, prompt: PROMPT, pictures, seed: 0 });
  }
  if (row.still === "video") {
    if (!isVideoGeste(row.id)) return null;
    const files = Object.fromEntries(row.slots.map((slot, index) => [slot.slot, slot.media === "video" ? "uttu-plan.mp4" : `uttu-${index + 1}.jpg`]));
    return videoGesteGraph({ geste: row.id, files, prompt: PROMPT, seed: 0 });
  }
  if (row.still === "outil") {
    const outil = outilParGeste(row.id);
    return outil ? outilGraph(outil, outilExample(outil)) : null;
  }
  if (row.still === "suite") return isSuiteGeste(row.id) ? suiteGraph(suiteExample(row.id)) : null;
  if (row.still === "mesh") return isMeshGeste(row.id) ? meshGesteGraph({ geste: row.id, image: "uttu-1.jpg", seed: 0 }) : null;
  if (row.still === "voix" || row.still === "effet" || row.still === "musique") {
    return stemGraph({ kind: row.still as StemKind, text: PROMPT, seed: 0 });
  }
  const kind = row.still as StillKind;
  const text = kind === "texte-cast" || kind === "texte-decor";
  return stillGraph({ kind, prompt: [PROMPT, row.consigne].filter(Boolean).join("\n\n"), images: text ? [] : images, seed: 0, template: row.template });
}

export function wiredGraphs(): { id: string; onglet: string; graph: ApiGraph }[] {
  return REGISTRE.flatMap(row => {
    const graph = graphForGeste(row);
    return graph ? [{ id: row.id, onglet: row.onglet, graph }] : [];
  });
}
