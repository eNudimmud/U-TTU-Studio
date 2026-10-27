// Build one InstantX + Lotus cadre-decor graph from the kept 3D colour frame.
// Photos never enter the graph in v1: they only colour the visitor prompt (decor-cadre.ts).

import { INSTANTX_CADRE_BASE, INSTANTX_CADRE_TEMPLATE } from "./instantx-cadre-base.ts";
import type { ApiGraph } from "./take-graph.ts";

export { INSTANTX_CADRE_TEMPLATE };

/**
 * Clone the InstantX base and patch the frame name, the positive prompt and the seed.
 * The decoded save is node `60` (SaveImageAdvanced → uttu-still).
 */
export function instantxCadreGraph(input: { image: string; prompt: string; seed: number }): ApiGraph {
  const image = input.image.trim();
  if (!image) throw new Error("Le décor part d’un cadre 3D gardé.");
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Le texte est vide.");
  const seed = Number.isSafeInteger(input.seed) && input.seed >= 0 ? input.seed : 0;
  const graph = structuredClone(INSTANTX_CADRE_BASE);
  graph["71"].inputs.image = image;
  graph["111:6"].inputs.text = prompt;
  graph["111:3"].inputs.seed = seed;
  return graph;
}
