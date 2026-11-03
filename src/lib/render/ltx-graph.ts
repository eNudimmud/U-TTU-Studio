// The default take: LTX-2.5 image-to-video (open weights). When the take has
// both a character and a set, FLUX 3 Klein first edits them into one start
// frame, inside the same graph. One job, one quote.

import { KLEIN_BASE_CFG, kleinNodes } from "./klein-graph.ts";
import { framedKeyNodes, type UploadedControls } from "./framed-key.ts";
import { LTX_I2V_BASE } from "./ltx-base.ts";
import { TAKE_ASPECTS, TAKE_OUTPUT_PREFIX, type ApiGraph, type TakeAspect, type TakeSeconds } from "./take-graph.ts";

export const LTX_REFS_MAX = 4;
export const LTX_MEGAPIXELS = 0.9;
/** Aperçu: the first pass renders at the selector size instead of half of it. About 848×480. */
export const LTX_APERCU_MEGAPIXELS = 0.4;

/** The second pass of the template: latent ×2 upscaler, then a refine sampler. Aperçu drops them. */
const SECOND_PASS = ["398:371", "398:348", "398:349", "398:340", "398:338", "398:396", "398:391", "398:341", "398:368", "398:369"] as const;

const KLEIN_ASPECT = { vertical: "9:16", horizontal: "16:9", carre: "1:1" } as const;

export interface LtxTakeInput {
  controls?: UploadedControls;
  prompt: string;
  pictures: readonly string[];
  seed: number;
  seconds: TakeSeconds;
  aspect: TakeAspect;
  /** First pass only, about 480p. Same seed, same prompt. */
  apercu?: boolean;
  /**
   * CE1: the role of every picture, named with `<ref_image_i>` tags (cinema/references.ts `slotPrompt`).
   * When given, the first-frame text no longer assumes picture 1 is the one person and the last
   * picture the place. Absent: the historical text, unchanged.
   */
  roles?: string;
}

/**
 * Aperçu: the first sampler's video and audio go straight to the decoders.
 * The first pass renders at the selector size (no « a/2 »), so the output is about 480p.
 */
function firstPassOnly(graph: ApiGraph): void {
  for (const id of SECOND_PASS) {
    if (!graph[id]) throw new Error(`Nœud absent du gabarit LTX : ${id}`);
    delete graph[id];
  }
  graph["398:353"].inputs.expression = "a";
  graph["398:355"].inputs.expression = "a";
  graph["398:374"].inputs.samples = ["398:367", 0];
  graph["398:358"].inputs.samples = ["398:367", 1];
}

function byTitle(graph: ApiGraph, title: string): string {
  const id = Object.keys(graph).find(key => graph[key]._meta?.title === title);
  if (!id) throw new Error(`Nœud absent du gabarit LTX : ${title}`);
  return id;
}

export function ltxTakeGraph(input: LtxTakeInput): ApiGraph {
  const pictures = input.pictures.filter(name => typeof name === "string" && name.trim());
  if (pictures.length === 0) throw new Error("Au moins une photo des références.");
  // Never cut a reference to fit: the caller reduces them, or the shot is refused (CE1).
  if (pictures.length > LTX_REFS_MAX) throw new Error(`Ce moteur accepte au plus ${LTX_REFS_MAX} images de référence.`);
  const roles = input.roles?.trim();
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Le plan est vide.");
  const seed = Number.isSafeInteger(input.seed) && input.seed >= 0 ? input.seed : 0;
  const graph: ApiGraph = structuredClone(LTX_I2V_BASE);

  const first = byTitle(graph, "Load First Frame");
  graph[byTitle(graph, "Prompt")].inputs.value = prompt;
  graph[byTitle(graph, "Duration")].inputs.value = input.seconds;
  const size = graph["403"];
  size.inputs.aspect_ratio = TAKE_ASPECTS[input.aspect];
  size.inputs.megapixels = input.apercu ? LTX_APERCU_MEGAPIXELS : LTX_MEGAPIXELS;
  if (input.apercu) firstPassOnly(graph);
  for (const node of Object.values(graph)) {
    if (node.class_type === "RandomNoise") node.inputs.noise_seed = seed;
    if (node.class_type === "SaveVideo") node.inputs.filename_prefix = TAKE_OUTPUT_PREFIX;
  }

  if (pictures.length === 1 && !input.controls) {
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
  const guide = input.controls?.guide?.trim();
  if (guide) {
    graph.control_guide = { class_type: "LoadImage", inputs: { image: guide }, _meta: { title: "Guide du cadrage gardé (mise en place seule)" } };
    loads.push(["control_guide", 0]);
  }
  const guideTag = `<ref_image_${pictures.length}>`;
  Object.assign(graph, kleinNodes({
    prefix: "frame_",
    prompt: roles
      ? guide
        ? `Photorealistic film still. Use ${guideTag} only as the camera and layout guide: same camera distance, horizon height, figure size and position. Never copy its gold mannequins or its plain background. Replace the mannequins with the characters named below, each with their own face and outfit. ${roles} ${prompt} No text.`
        : `First frame of a film shot. ${roles} ${prompt} Keep each character's own face and outfit, and the place as shown. No text.`
      : guide
      ? `Photorealistic film still. Use ${guideTag} only as the camera and layout guide: same camera distance, horizon height, figure size and position. Never copy its gold mannequins or its plain background. Replace each mannequin with the person from <ref_image_0>, same face, same outfit, in the place from ${last}. ${prompt}`
      : prompt.includes("[framing reference]")
      ? `First frame of a film shot. Follow the named reference roles below: the framing guide controls composition only. ${prompt} Same face, same outfit, same place. No text.`
      : `First frame of a film shot. The person from <ref_image_0> stands in the place from ${last}. ${prompt} Same face, same outfit, same place. No text.`,
    seed,
    aspect: KLEIN_ASPECT[input.aspect],
    images: loads,
    ...(guide ? { referenceLimit: 7 as const } : {}),
    // Same frame, seed and pictures: at cfg 1 Uttu melted into a heap of cloth (594509e3);
    // at cfg 3.5 she walks in with hood, braids and coat (0d6b5c7e).
    cfg: KLEIN_BASE_CFG,
  }));
  if (input.controls) Object.assign(graph, framedKeyNodes({ initial: ["frame_decode", 0], controls: input.controls, prompt, seed }));
  for (const node of Object.values(graph)) {
    for (const [key, value] of Object.entries(node.inputs)) {
      if (Array.isArray(value) && value[0] === first) node.inputs[key] = [input.controls ? "control_111:8" : "frame_decode", 0];
    }
  }
  return graph;
}
