import { generiqueGraph } from "../outils/generique.ts";
import { ANISORA_HIGH, ANISORA_LOW } from "../look/graphs.ts";
import { outilGraph } from "../outils/graphs.ts";
import { outilParId } from "../outils/catalogue.ts";
import { noeudSortie } from "../render/sortie.ts";
import type { Section } from "./registry.ts";
export const VIDEO_TEMPLATE = "video_wan2_2_14B_i2v";
export function sectionVideoGraph(input: {
  section: Section;
  image: string;
  prompt: string;
  seed: number;
}) {
  if (!input.image || !input.prompt.trim())
    throw new Error("Choisis une image et décris le mouvement.");
  const graph = generiqueGraph({
    template: VIDEO_TEMPLATE,
    files: { images: [input.image] },
    prompt: input.prompt,
    seed: input.seed,
    prefix: `video/uttu-${input.section}`,
    aspect: "horizontal",
  });
  if (input.section === "anime") {
    graph["129:95"].inputs.unet_name = ANISORA_HIGH;
    graph["129:96"].inputs.unet_name = ANISORA_LOW;
    // Do not silently combine an unqualified acceleration LoRA with AniSora.
    graph["129:131"].inputs.value = false;
  }
  return graph;
}

export function videoBinding(input: Parameters<typeof sectionVideoGraph>[0]) {
  if (input.section === "anime")
    return {
      graph: sectionVideoGraph(input),
      outputNode: "108",
      template: `${VIDEO_TEMPLATE}_anisora32`,
    };
  const tool = outilParId("vid-ltx-image")!;
  const graph = outilGraph(tool, {
    files: { images: [input.image] },
    prompt: input.prompt,
    seed: input.seed,
    aspect: "horizontal",
  });
  const outputNode = noeudSortie(graph, tool.template);
  if (!outputNode) throw new Error("Sortie vidéo LTX introuvable.");
  return { graph, outputNode, template: tool.template };
}
