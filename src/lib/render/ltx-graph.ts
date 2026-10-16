// The default take: LTX-2.5 image-to-video (open weights). When the take has
// both a character and a set, FLUX 3 Klein first edits them into one start
// frame, inside the same graph. One job, one quote.

import { kleinNodes } from "./klein-graph.ts";
import { LTX_I2V_BASE } from "./ltx-base.ts";
import { TAKE_ASPECTS, TAKE_OUTPUT_PREFIX, type ApiGraph, type TakeAspect, type TakeSeconds } from "./take-graph.ts";

export const LTX_REFS_MAX = 4;
export const LTX_MEGAPIXELS = 0.9;

const KLEIN_ASPECT = { vertical: "9:16", horizontal: "16:9", carre: "1:1" } as const;

export interface LtxTakeInput {
  prompt: string;
  pictures: readonly string[];
  seed: number;
  seconds: TakeSeconds;
  aspect: TakeAspect;
}

function byTitle(graph: ApiGraph, title: string): string {
  const id = Object.keys(graph).find(key => graph[key]._meta?.title === title);
  if (!id) throw new Error(`Nœud absent du gabarit LTX : ${title}`);
  return id;
}

export function ltxTakeGraph(input: LtxTakeInput): ApiGraph {
  const pictures = input.pictures.filter(name => typeof name === "string" && name.trim()).slice(0, LTX_REFS_MAX);
  if (pictures.length === 0) throw new Error("Au moins une photo des références.");
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Le plan est vide.");
  const seed = Number.isSafeInteger(input.seed) && input.seed >= 0 ? input.seed : 0;
  const graph: ApiGraph = structuredClone(LTX_I2V_BASE);

  const first = byTitle(graph, "Load First Frame");
  graph[byTitle(graph, "Prompt")].inputs.value = prompt;
  graph[byTitle(graph, "Duration")].inputs.value = input.seconds;
  const size = graph["403"];
  size.inputs.aspect_ratio = TAKE_ASPECTS[input.aspect];
  size.inputs.megapixels = LTX_MEGAPIXELS;
  for (const node of Object.values(graph)) {
    if (node.class_type === "RandomNoise") node.inputs.noise_seed = seed;
    if (node.class_type === "SaveVideo") node.inputs.filename_prefix = TAKE_OUTPUT_PREFIX;
  }

  if (pictures.length === 1) {
    graph[first].inputs.image = pictures[0];
    return graph;
  }
  // Several references: Klein makes the first frame from all of them.
  delete graph[first];
  const loads: [string, number][] = [];
  pictures.forEach((name, index) => {
    const id = `picture_${index + 1}`;
    graph[id] = { class_type: "LoadImage", inputs: { image: name }, _meta: { title: `Picture ${index + 1}` } };
    loads.push([id, 0]);
  });
  const last = `<ref_image_${pictures.length - 1}>`;
  Object.assign(graph, kleinNodes({
    prefix: "frame_",
    prompt: `First frame of a film shot. The person from <ref_image_0> stands in the place from ${last}. ${prompt} Same face, same outfit, same place. No text.`,
    seed,
    aspect: KLEIN_ASPECT[input.aspect],
    images: loads,
  }));
  for (const node of Object.values(graph)) {
    for (const [key, value] of Object.entries(node.inputs)) {
      if (Array.isArray(value) && value[0] === first) node.inputs[key] = ["frame_decode", 0];
    }
  }
  return graph;
}
