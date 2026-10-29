// Which node of a sent graph holds the final result. Never « the first file of the
// right kind »: Comfy lists loaded inputs among a job's outputs too.

import { NOEUD_SORTIE } from "../workflows/registre.ts";
import type { ApiGraph } from "./take-graph.ts";

const SAVE = /^(Save|VHS_VideoCombine$)/;

/** Save nodes of a graph (SaveVideo, SaveImage, SaveImageAdvanced, SaveAudio…, SaveGLB, Save3DAdvanced, VHS_VideoCombine). */
export function saveNodes(graph: ApiGraph): string[] {
  return Object.entries(graph).filter(([, node]) => SAVE.test(String(node?.class_type ?? ""))).map(([id]) => id);
}

/**
 * The registry's node for this template when the graph has it as a save node,
 * otherwise the graph's only save node. Undefined when that is ambiguous.
 */
export function noeudSortie(graph: ApiGraph, template?: string): string | undefined {
  const saves = saveNodes(graph);
  const listed = template ? NOEUD_SORTIE[template] : undefined;
  if (listed && saves.includes(listed)) return listed;
  return saves.length === 1 ? saves[0] : undefined;
}
