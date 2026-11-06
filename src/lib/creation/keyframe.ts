// A key still for the current film: cast pictures then the place, Klein edit, open weights.
// Building the graph spends nothing. Sending it stays behind the existing confirm gate.

import type { CreationQuote } from "./quotes.ts";
import { kleinNodes, type KleinAspect } from "../render/klein-graph.ts";
import type { ApiGraph } from "../render/take-graph.ts";

export const KEYFRAME_QUOTE: CreationQuote = {
  credits: 4,
  high: 6,
  template: "image_flux3_klein_image_edit",
  kind: "hypothese",
};

/** Cast references first, the place last. Four pictures at most. Needs both. */
export function keyframeGraph(input: { prompt: string; images: readonly string[]; seed: number; aspect?: KleinAspect }): ApiGraph {
  const images = input.images.filter(name => name.trim()).slice(0, 4);
  if (images.length < 2) throw new Error("L’image clé part du personnage et du décor.");
  const aspect = input.aspect ?? "9:16";
  const frame = aspect === "16:9" ? "Horizontal 16:9 framing" : "Vertical 9:16 framing";
  const prompt = `${input.prompt.trim()}\n\n${frame}. First frame of a film shot. The same person and the same place. No text.`;
  const links = images.map((image, index) => {
    return [`load${index}`, 0] as [string, number];
  });
  const graph = kleinNodes({ prefix: "cle_", prompt, seed: input.seed, aspect, images: links });
  images.forEach((image, index) => {
    graph[`load${index}`] = { class_type: "LoadImage", inputs: { image } };
  });
  return graph;
}
