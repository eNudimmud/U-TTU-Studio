// The take, as the API graph Comfy Cloud runs: the official template
// `video_minimax_h3_r2v` (h3-base.ts), switches kept. Up to nine reference pictures, in connection order:
// <Picture 1> is the first photo of the look.

import { H3_R2V_BASE } from "./h3-base.ts";

export const TAKE_MODELS = {
  unet: "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
  clip: "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors",
  videoVae: "minimax_h3_video_vae_int8_convrot.safetensors",
  audioVae: "minimax_h3_audio_vae_fp32.safetensors",
  turboLora: "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
} as const;

export const TAKE_PICTURES_MAX = 9;
export const TAKE_FPS = 24;
export const TAKE_SECONDS = [5, 8, 10] as const;
export const TAKE_STEPS = { fine: 20, rapide: 4 } as const;
export const TAKE_ASPECTS = {
  vertical: "9:16 (Portrait Widescreen)",
  horizontal: "16:9 (Widescreen)",
  carre: "1:1 (Square)",
} as const;
export const TAKE_MEGAPIXELS = 0.4;
export const TAKE_OUTPUT_PREFIX = "uttu/prise";

export type TakeSeconds = (typeof TAKE_SECONDS)[number];
export type TakeQuality = keyof typeof TAKE_STEPS;
export type TakeAspect = keyof typeof TAKE_ASPECTS;

/** Shot engine. LTX-2.5 is the default; MiniMax H3 stays selectable. */
export const TAKE_ENGINES = ["ltx", "h3"] as const;
export type TakeEngine = (typeof TAKE_ENGINES)[number];
export const TAKE_ENGINE_TEMPLATE: Record<TakeEngine, string> = { ltx: "video_ltx2_5_i2v", h3: "video_minimax_h3_r2v" };

/**
 * LTX only. « finale » is today's two passes (half size, latent ×2, refine).
 * « apercu » keeps the first pass only, about 480p, same seed: cheaper to try,
 * finalised later by an upscale (Finaliser), never re-rendered.
 */
export const TAKE_RENDUS = ["apercu", "finale"] as const;
export type TakeRendu = (typeof TAKE_RENDUS)[number];
export const DEFAULT_RENDU: TakeRendu = "finale";

export interface TakeSettings {
  seconds: TakeSeconds;
  quality: TakeQuality;
  aspect: TakeAspect;
  /** Missing on settings saved before LTX: those were H3 takes. */
  engine?: TakeEngine;
  /** Missing means « finale » (every take before the option). */
  rendu?: TakeRendu;
}

export const DEFAULT_TAKE: TakeSettings = { seconds: 5, quality: "rapide", aspect: "vertical", engine: "ltx" };

export function takeEngine(settings: Pick<TakeSettings, "engine">): TakeEngine {
  return settings.engine === "ltx" ? "ltx" : "h3";
}

/** Aperçu exists for LTX only. H3 is always one take at its own size. */
export function takeRendu(settings: Pick<TakeSettings, "engine" | "rendu">): TakeRendu {
  return takeEngine(settings) === "ltx" && settings.rendu === "apercu" ? "apercu" : "finale";
}

/** A take profile made with Aperçu. Its cost is kept apart from « finale ». */
export function isApercuProfile(profile: string): boolean {
  return /^ltx25-apercu-/.test(profile);
}

export interface TakeGraphInput extends TakeSettings {
  prompt: string;
  /** Uploaded input names, Picture 1 first. */
  pictures: readonly string[];
  seed: number;
}

type Link = [string, number];
export type ApiNode = { class_type: string; inputs: Record<string, unknown>; _meta?: { title: string } };
export type ApiGraph = Record<string, ApiNode>;

/** The template's frame rule: at least 5 frames, then the next count of the form 17k + 5. */
export function takeFrames(seconds: number): number {
  const base = Math.max(5, Math.round(seconds * TAKE_FPS));
  return base + ((5 - (base % 17)) % 17 + 17) % 17;
}

/** Same profile, same cost: what calibration is keyed on. */
/** The Comfy workflow a take ran: the template its graph comes from. */
export function takeWorkflow(settings: TakeSettings): string {
  return takeEngine(settings) === "ltx" ? "ltx-2.5-i2v" : "video_minimax_h3_r2v";
}

/** Where Comfy Cloud keeps an output. Reading it needs the account's own sign-in; no key is stored here. */
export function comfyStorageUrl(ref: { filename: string; subfolder: string; type: string }): string {
  const query = new URLSearchParams({ filename: ref.filename, subfolder: ref.subfolder, type: ref.type });
  return `https://cloud.comfy.org/api/view?${query}`;
}

export function takeProfile(settings: TakeSettings): string {
  if (takeEngine(settings) === "ltx") {
    const apercu = takeRendu(settings) === "apercu" ? "apercu-" : "";
    return `ltx25-${apercu}${settings.seconds}s-${settings.aspect}`;
  }
  return `h3-${TAKE_STEPS[settings.quality]}pas-${settings.seconds}s-${settings.aspect}`;
}

export function takeGraph(input: TakeGraphInput): ApiGraph {
  const pictures = input.pictures.filter(name => typeof name === "string" && name.trim()).slice(0, TAKE_PICTURES_MAX);
  if (pictures.length === 0) throw new Error("Au moins une photo des références.");
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Le plan est vide.");
  const seed = Number.isSafeInteger(input.seed) && input.seed >= 0 ? input.seed : 0;
  // The official template, as exported (h3-base.ts). Only text, pictures, length, frame, turbo switch and seed change.
  const graph: ApiGraph = structuredClone(H3_R2V_BASE);
  graph["138"].inputs.value = prompt;
  graph["132"].inputs.value = input.seconds;
  graph["146"].inputs.value = input.quality === "rapide";
  graph["143"].inputs.value = TAKE_STEPS.fine;
  graph["144"].inputs.value = TAKE_STEPS.rapide;
  graph["115"].inputs.aspect_ratio = TAKE_ASPECTS[input.aspect];
  graph["115"].inputs.megapixels = TAKE_MEGAPIXELS;
  graph["129"].inputs.noise_seed = seed;
  graph["130"].inputs.fps = TAKE_FPS;
  graph["92"].inputs.filename_prefix = TAKE_OUTPUT_PREFIX;
  graph["92"].inputs.format = "mp4";
  graph["92"].inputs["format.codec"] = "h264";
  pictures.forEach((name, index) => {
    const id = `picture_${index + 1}`;
    graph[id] = { class_type: "LoadImage", inputs: { image: name }, _meta: { title: `Picture ${index + 1}` } };
    graph["136"].inputs[`ref_images.ref_image_${index}`] = [id, 0];
  });
  return graph;
}
