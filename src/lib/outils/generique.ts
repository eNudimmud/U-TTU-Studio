// The hub tools that run one official Comfy template as it is (outils/base.ts): only the
// uploaded files, the visitor text, the seed, a few studio choices and the output name are
// patched in. Pure functions: nothing here opens a network.

import { seedOf } from "../seed.ts";
import type { ApiGraph } from "../render/take-graph.ts";
import { OUTIL_BASES } from "./base.ts";

type At = readonly [node: string, input: string];
export type OutilAspect = "horizontal" | "vertical";

export interface OutilFiles {
  /** Uploaded input names. images[0] is required when the tool takes an image. */
  images?: readonly string[];
  video?: string;
  audio?: string;
}

export interface GeneriqueInput {
  template: string;
  files: OutilFiles;
  prompt: string;
  seed: number;
  prefix: string;
  aspect?: OutilAspect;
}

interface Spec {
  images?: readonly At[];
  video?: At;
  audio?: At;
  prompt?: readonly At[];
  seed?: readonly At[];
  save: At;
  aspect?: { at: At; horizontal: string; vertical: string };
  /** Width and height for the format, on one node (Wan keeps the frame instead of a square crop). */
  size?: { node: string; horizontal: { width: number; height: number }; vertical: { width: number; height: number } };
  /** Fixed studio choices (short lengths keep one estimate). */
  set?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** For text the graph needs in another shape. */
  patch?(graph: ApiGraph, prompt: string): void;
  /** The text the graph needs is required. */
  needsText?: boolean;
}

const RESOLUTION = { horizontal: "16:9 (Widescreen)", vertical: "9:16 (Portrait Widescreen)" };
const RATIO = { horizontal: "16:9", vertical: "9:16" };

/** Exact slot map per template, read in the api graph. */
export const GENERIQUE: Readonly<Record<string, Spec>> = {
  image_qwen_image_2_1_t2i: { prompt: [["459:471", "prompt"], ["459:474", "on_false"]], seed: [["459:458", "seed"]], save: ["461", "filename_prefix"], aspect: { at: ["13", "aspect_ratio"], ...RESOLUTION }, needsText: true },
  api_bfl_flux3_t2i: { prompt: [["1", "prompt"]], seed: [["1", "seed"]], save: ["2", "filename_prefix"], aspect: { at: ["1", "aspect_ratio"], horizontal: "16:9", vertical: "9:16" }, needsText: true },
  api_ideogram_v4_5_t2i: { prompt: [["1", "model.prompt"]], seed: [["1", "model.seed"]], save: ["5", "filename_prefix"], aspect: { at: ["1", "model.size"], horizontal: "16:9", vertical: "9:16" }, needsText: true },
  api_openai_gpt_image_2_t2i: { prompt: [["271", "prompt"]], seed: [["271", "seed"]], save: ["269", "filename_prefix"], needsText: true },
  api_bytedance_seedream_5_0_pro_t2i: { prompt: [["3", "prompt"]], seed: [["3", "model.seed"]], save: ["2", "filename_prefix"], needsText: true },
  api_nano_banana_2_1_t2i: { prompt: [["1", "prompt"]], seed: [["1", "seed"]], save: ["3", "filename_prefix"], needsText: true },
  image_qwen_image_2_1_image_edit: { images: [["470", "image"], ["475", "image"]], prompt: [["459:500", "prompt"], ["459:484", "on_false"]], seed: [["459:458", "seed"]], save: ["461", "filename_prefix"], needsText: true },
  video_ltx2_5_t2v: { prompt: [["405:376", "value"]], seed: [["405:339", "noise_seed"]], save: ["75", "filename_prefix"], aspect: { at: ["409", "aspect_ratio"], ...RESOLUTION }, set: { "405:362": { value: 5 } }, needsText: true },
  api_kling_v3_video: {
    images: [["1", "image"]], seed: [["3", "seed"]], save: ["2", "filename_prefix"], aspect: { at: ["3", "model.aspect_ratio"], ...RATIO }, needsText: true,
    patch(graph, prompt) {
      const inputs = graph["3"].inputs;
      for (const key of Object.keys(inputs)) if (key.startsWith("multi_shot.")) delete inputs[key];
      Object.assign(inputs, { multi_shot: "disabled", "multi_shot.prompt": prompt, "multi_shot.negative_prompt": "", "multi_shot.duration": 5 });
    },
  },
  api_seedance2_5_r2v: { images: [["12", "image"]], prompt: [["24", "model.prompt"]], seed: [["24", "seed"]], save: ["16", "filename_prefix"], needsText: true },
  // The template ships with its 4-step LoRA off (20 steps, ≈ 174 s of GPU measured on 2026-10-16):
  // the studio turns it on, so the run matches its estimate. 832×480 keeps the picture's frame.
  video_wan2_2_14B_i2v: {
    images: [["97", "image"]], prompt: [["129:93", "text"]], seed: [["129:86", "noise_seed"]], save: ["108", "filename_prefix"], needsText: true,
    set: { "129:131": { value: true } },
    size: { node: "129:98", horizontal: { width: 832, height: 480 }, vertical: { width: 480, height: 832 } },
  },
  api_vidu_q4_preview_r2v: { images: [["11", "image"], ["10", "image"]], prompt: [["9", "model.prompt"]], seed: [["9", "model.seed"]], save: ["6", "filename_prefix"], aspect: { at: ["9", "model.aspect_ratio"], ...RATIO }, needsText: true },
  api_minimax_h3_max_r2v: { images: [["6", "image"]], prompt: [["4", "model.prompt"]], seed: [["4", "seed"]], save: ["2", "filename_prefix"], needsText: true },
  video_wan_animate2: { images: [["189", "image"]], video: ["240", "file"], prompt: [["672:585", "text"]], seed: [["672:597", "noise_seed"]], save: ["246", "filename_prefix"] },
  api_tripo_p2_image_to_model: { images: [["16", "image"]], seed: [["15", "model.model_seed"]], save: ["14", "filename_prefix"] },
  api_hunyuan3d_image_to_model: { images: [["1", "image"]], seed: [["2", "seed"]], save: ["13", "filename_prefix"] },
  api_meshy7_1_image_to_model: { images: [["8", "image"]], seed: [["13", "seed"]], save: ["17", "filename_prefix"] },
  "audio-chatterbox_tts_multilingual": { audio: ["2", "audio"], prompt: [["1", "text"]], seed: [["1", "seed"]], save: ["3", "filename_prefix"], needsText: true },
  api_elevenlabs_v4_text_to_dialogue: {
    seed: [["218", "seed"]], save: ["220", "filename_prefix"], needsText: true,
    patch(graph, prompt) {
      // One line per reply, two voices taking turns, four replies at most.
      const lines = prompt.split(/\n+/).map(line => line.trim()).filter(Boolean).slice(0, 4);
      const inputs = graph["218"].inputs;
      for (const key of Object.keys(inputs)) if (key.startsWith("inputs.")) delete inputs[key];
      inputs.inputs = String(lines.length);
      lines.forEach((line, index) => {
        inputs[`inputs.text${index + 1}`] = line;
        inputs[`inputs.voice${index + 1}`] = [index % 2 === 0 ? "211" : "219", 0];
      });
    },
  },
  audio_ace_step1_5_xl_turbo: { prompt: [["94", "tags"]], seed: [["109", "value"]], save: ["111", "filename_prefix"], set: { "94": { lyrics: "[Instrumental]", duration: 30 }, "98": { seconds: 30 } }, needsText: true },
  audio_stable_audio_3_medium: { prompt: [["52:31", "value"]], seed: [["52:3", "seed"]], save: ["57", "filename_prefix"], set: { "52:36": { value: 10 } }, needsText: true },
  template_qwen_Image_2512_360_lora: {
    prompt: [["269", "value"]], seed: [["238:230", "seed"]], save: ["60", "filename_prefix"], needsText: true,
    // Keep 2:1 latent; reinforce equirectangular (trigger word stays on node 266).
    set: { "238:232": { width: 2048, height: 1024, batch_size: 1 } },
    patch(graph, prompt) {
      const scene = prompt.trim();
      graph["269"].inputs.value = scene;
      graph["266"].inputs.value = "equirectangular 360 panorama, seamless full environment wrapping left-right, ";
      graph["238:228"].inputs.text = (
        "cut-out, cutout, isolated subject on white, plain white background, studio backdrop, "
        + "portrait crop, product shot, low resolution, low quality, deformed limbs, deformed fingers, "
        + "oversaturated, waxy skin, face without detail, overly smooth, AI look, messy composition, blurry text"
      );
    },
  },
  image_qwen_Image_2512_controlnet: { images: [["121", "image"]], prompt: [["86:81", "text"]], seed: [["86:3", "seed"]], save: ["60", "filename_prefix"], needsText: true },
  template_character_portrait_relighting: {
    images: [["124", "image"]], seed: [["136", "seed"]], save: ["138", "filename_prefix"], needsText: true,
    patch(graph, prompt) {
      graph["136"].inputs.prompt = `Maintain the identity of input image 1. Change only the lighting: ${prompt}`;
    },
  },
  api_grok_video_extend: { video: ["1", "file"], prompt: [["2", "prompt"]], seed: [["2", "seed"]], save: ["3", "filename_prefix"], needsText: true },
  api_bria_remove_video_background: { video: ["4", "file"], seed: [["2", "seed"]], save: ["5", "filename_prefix"] },
  api_sync_so_lip_sync_video: { video: ["9", "file"], audio: ["11", "audio"], seed: [["8", "seed"]], save: ["13", "filename_prefix"] },
  api_sonilo_v2m: { video: ["705", "file"], prompt: [["703", "prompt"]], seed: [["703", "seed"]], save: ["728", "filename_prefix"] },
};

export function isGenerique(template: string): boolean {
  return template in GENERIQUE && template in OUTIL_BASES;
}

/** What the template takes, read from its slot map. */
export function generiqueEntrees(template: string): { images: number; video: boolean; audio: boolean; text: boolean } {
  const spec = GENERIQUE[template];
  return { images: spec?.images?.length ?? 0, video: Boolean(spec?.video), audio: Boolean(spec?.audio), text: Boolean(spec?.needsText) };
}

function safeName(name: string | undefined, what: string): string {
  if (!name || /[\\\u0000]/.test(name)) throw new Error(`${what} manquant.`);
  return name;
}

function put(graph: ApiGraph, [node, input]: At, value: unknown): void {
  const target = graph[node];
  if (!target) throw new Error(`Nœud absent : ${node}`);
  target.inputs[input] = value;
}

export function generiqueGraph(input: GeneriqueInput): ApiGraph {
  const spec = GENERIQUE[input.template];
  const base = OUTIL_BASES[input.template];
  if (!spec || !base) throw new Error(`Outil non branché : ${input.template}`);
  const graph = structuredClone(base);
  const prompt = input.prompt.trim();
  if (spec.needsText && !prompt) throw new Error("Le texte est vide.");
  const images = input.files.images ?? [];
  spec.images?.forEach((at, index) => {
    // A second picture is optional: the first one fills its slot.
    put(graph, at, safeName(images[index] ?? images[0], "Image"));
  });
  if (spec.video) put(graph, spec.video, safeName(input.files.video, "Vidéo"));
  if (spec.audio) put(graph, spec.audio, safeName(input.files.audio, "Audio"));
  for (const at of spec.prompt ?? []) put(graph, at, prompt);
  const seed = seedOf(input.seed);
  for (const at of spec.seed ?? []) put(graph, at, seed);
  for (const [node, values] of Object.entries(spec.set ?? {})) Object.assign(graph[node].inputs, values);
  if (spec.aspect) put(graph, spec.aspect.at, spec.aspect[input.aspect ?? "horizontal"]);
  if (spec.size) Object.assign(graph[spec.size.node].inputs, spec.size[input.aspect ?? "horizontal"]);
  spec.patch?.(graph, prompt);
  put(graph, spec.save, input.prefix);
  return graph;
}
