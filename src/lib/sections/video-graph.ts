import { generiqueGraph } from "../outils/generique.ts";
import { ANISORA_HIGH, ANISORA_LOW } from "../look/graphs.ts";
import type { Section } from "./registry.ts";
export const VIDEO_TEMPLATE = "video_wan2_2_14B_i2v";
export function sectionVideoGraph(input: { section: Section; image: string; prompt: string; seed: number }) {
  if (!input.image || !input.prompt.trim()) throw new Error("Choisis une image et décris le mouvement.");
  const graph = generiqueGraph({ template: VIDEO_TEMPLATE, files: { images: [input.image] }, prompt: input.prompt, seed: input.seed, prefix: `video/uttu-${input.section}`, aspect: "horizontal" });
  if (input.section === "anime") {
    graph["129:95"].inputs.unet_name = ANISORA_HIGH;
    graph["129:96"].inputs.unet_name = ANISORA_LOW;
    // Do not silently combine an unqualified acceleration LoRA with AniSora.
    graph["129:131"].inputs.value = false;
  }
  return graph;
}
