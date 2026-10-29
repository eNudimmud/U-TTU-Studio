// « Décor depuis un lieu », v2 : la vue 3D garde la géométrie, les photos donnent l'apparence.
// FLUX.1 dev + LoRA depth : la profondeur de la vue 3D entre par InstructPixToPixConditioning
// (structure, active à chaque pas). Les photos du lieu entrent par FLUX Redux (StyleModelApply) :
// seule l'apparence — matières, couleurs, lumière — passe, jamais l'image elle-même dans le latent.
// Mesuré sur Comfy Cloud : docs/mesures/decor-3d-2026-10-29.md.

import type { ApiGraph } from "./take-graph.ts";

export const DECOR_3D_TEMPLATE = "decor-3d-apparence" as const;
export const DECOR_3D_WIDTH = 1024;
export const DECOR_3D_HEIGHT = 576;
export const DECOR_3D_PHOTOS_MAX = 3;
/** Guidance FLUX pour la LoRA depth (valeur du modèle officiel). */
export const DECOR_3D_GUIDANCE = 10;
export const DECOR_3D_STEPS = 20;
/**
 * Poids Redux par photo (attn_bias). Mesuré : à 0,6 la matière passe fort mais, sur une vue au sol
 * plat (Central Park), la photo impose son propre cadrage (sol −235 px) ; à 0,3 aussi. À 0,1 la ligne
 * du sol tient (4 px) et la pierre et la brique passent ; le verre passe mal. Le cadrage d'abord.
 */
export const DECOR_3D_STYLE_STRENGTH = 0.1;
export const DECOR_3D_STYLE_TYPE: "attn_bias" | "multiply" = "attn_bias";
/** Départ « vue » : débruitage partiel depuis la vue 3D (comparé au bruit pur, voir la mesure). */
export const DECOR_3D_VIEW_DENOISE = 0.8;

/** Sans effet à cfg 1 (FLUX dev distillé) ; gardé pour la trace et un cfg > 1 éventuel. */
export const DECOR_3D_NEGATIVE = "blocky, voxel, maze, low-poly, clay render, untextured massing, checkerboard façades, abstract cubes, plastic CG, metallic CG, cartoon buildings";

export type Decor3dStart = "bruit" | "vue";

export interface Decor3dRender {
  /** Vue 3D en couleur (capture du repérage). Requise si `depth` manque ou si `start` vaut "vue". */
  view?: string;
  /** Profondeur exportée par le moteur 3D (proche clair). Sinon Lotus l'estime depuis `view`. */
  depth?: string;
  /** Photos du lieu : apparence seulement (Redux). */
  photos: readonly string[];
  prompt: string;
  seed: number;
  start?: Decor3dStart;
  /** Poids Redux (attn_bias) ; défaut DECOR_3D_STYLE_STRENGTH. */
  styleStrength?: number;
  styleType?: "attn_bias" | "multiply";
  /** Débruitage du départ « vue » ; défaut DECOR_3D_VIEW_DENOISE. */
  viewDenoise?: number;
}

/** Texte envoyé au modèle (anglais). Aucune consigne de géométrie autre que « suivre la profondeur ». */
export function decor3dPrompt(input: { place?: string; detail?: string; photos: number }): string {
  const place = (input.place ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const detail = (input.detail ?? "").replace(/\s+/g, " ").replace(/"/g, "'").trim().slice(0, 240);
  return [
    `Photorealistic photograph${place ? ` of ${place}` : ""}, natural light, real camera.`,
    "Real buildings with readable windows, doors, cornices and weathered materials; real ground and sky.",
    input.photos > 0 ? "Materials, colours and light as in the reference photos." : "",
    detail ? `${detail}.` : "",
    "No people, no text, no 3D render look, no clay, no checkerboard façades.",
  ].filter(Boolean).join(" ");
}

function seedOf(seed: number): number {
  return Number.isSafeInteger(seed) && seed >= 0 ? seed : 0;
}

/**
 * Un graphe pour une ou plusieurs vues : les modèles sont chargés une fois et partagés.
 * Chaque rendu i sauve `uttu-decor-3d-i`. L'app envoie un seul rendu ; la mesure en envoie plusieurs.
 */
export function decor3dGraph(renders: readonly Decor3dRender[]): ApiGraph {
  if (renders.length === 0) throw new Error("Aucune vue à rendre.");
  const g: ApiGraph = {
    unet: { class_type: "UNETLoader", inputs: { unet_name: "flux1-dev.safetensors", weight_dtype: "default" }, _meta: { title: "FLUX.1 dev" } },
    depth_lora: { class_type: "LoraLoaderModelOnly", inputs: { model: ["unet", 0], lora_name: "flux1-depth-dev-lora.safetensors", strength_model: 1 }, _meta: { title: "Structure : LoRA depth" } },
    clip: { class_type: "DualCLIPLoader", inputs: { clip_name1: "t5xxl_fp8_e4m3fn_scaled.safetensors", clip_name2: "clip_l.safetensors", type: "flux", device: "default" } },
    vae: { class_type: "VAELoader", inputs: { vae_name: "ae.safetensors" } },
    vision: { class_type: "CLIPVisionLoader", inputs: { clip_name: "sigclip_vision_patch14_384.safetensors" } },
    redux: { class_type: "StyleModelLoader", inputs: { style_model_name: "flux1-redux-dev.safetensors" }, _meta: { title: "Apparence : Redux" } },
  };
  let lotus = false;
  renders.forEach((r, i) => {
    const p = `r${i}_`;
    const prompt = r.prompt.trim();
    if (!prompt) throw new Error("Le texte est vide.");
    const start: Decor3dStart = r.start ?? "bruit";
    const view = r.view?.trim();
    const depth = r.depth?.trim();
    if (!depth && !view) throw new Error("Le décor part d’une vue 3D gardée.");
    if (start === "vue" && !view) throw new Error("Le départ « vue » demande la vue 3D.");
    const scale = (src: string): [string, number] => {
      g[`${p}${src}_scale`] = { class_type: "ImageScale", inputs: { image: [`${p}${src}`, 0], upscale_method: "lanczos", width: DECOR_3D_WIDTH, height: DECOR_3D_HEIGHT, crop: "center" } };
      return [`${p}${src}_scale`, 0];
    };
    let viewPx: [string, number] | null = null;
    if (view) {
      g[`${p}view`] = { class_type: "LoadImage", inputs: { image: view }, _meta: { title: "Vue 3D" } };
      viewPx = scale("view");
    }
    let depthPx: [string, number];
    if (depth) {
      g[`${p}depth`] = { class_type: "LoadImage", inputs: { image: depth }, _meta: { title: "Profondeur de la vue 3D" } };
      depthPx = scale("depth");
    } else {
      if (!lotus) {
        lotus = true;
        g.lotus_unet = { class_type: "UNETLoader", inputs: { unet_name: "lotus-depth-d-v1-1.safetensors", weight_dtype: "default" } };
        g.lotus_vae = { class_type: "VAELoader", inputs: { vae_name: "vae-ft-mse-840000-ema-pruned.safetensors" } };
        g.lotus_cond = { class_type: "LotusConditioning", inputs: {} };
        g.lotus_noise = { class_type: "DisableNoise", inputs: {} };
        g.lotus_guider = { class_type: "BasicGuider", inputs: { model: ["lotus_unet", 0], conditioning: ["lotus_cond", 0] } };
        g.lotus_sched = { class_type: "BasicScheduler", inputs: { model: ["lotus_unet", 0], scheduler: "normal", steps: 1, denoise: 1 } };
        g.lotus_sigma = { class_type: "SetFirstSigma", inputs: { sigmas: ["lotus_sched", 0], sigma: 999 } };
        g.lotus_sampler = { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } };
      }
      g[`${p}lotus_enc`] = { class_type: "VAEEncode", inputs: { pixels: viewPx!, vae: ["lotus_vae", 0] } };
      g[`${p}lotus_run`] = { class_type: "SamplerCustomAdvanced", inputs: { noise: ["lotus_noise", 0], guider: ["lotus_guider", 0], sampler: ["lotus_sampler", 0], sigmas: ["lotus_sigma", 0], latent_image: [`${p}lotus_enc`, 0] } };
      g[`${p}lotus_dec`] = { class_type: "VAEDecode", inputs: { samples: [`${p}lotus_run`, 0], vae: ["lotus_vae", 0] } };
      g[`${p}lotus_depth`] = { class_type: "ImageInvert", inputs: { image: [`${p}lotus_dec`, 0] }, _meta: { title: "Profondeur estimée (Lotus) de la vue 3D" } };
      depthPx = [`${p}lotus_depth`, 0];
    }
    g[`${p}pos`] = { class_type: "CLIPTextEncode", inputs: { clip: ["clip", 0], text: prompt } };
    g[`${p}neg`] = { class_type: "CLIPTextEncode", inputs: { clip: ["clip", 0], text: DECOR_3D_NEGATIVE } };
    let positive: [string, number] = [`${p}pos`, 0];
    r.photos.slice(0, DECOR_3D_PHOTOS_MAX).forEach((photo, k) => {
      g[`${p}photo${k}`] = { class_type: "LoadImage", inputs: { image: photo }, _meta: { title: `Photo du lieu ${k + 1} (apparence)` } };
      g[`${p}photo${k}_vision`] = { class_type: "CLIPVisionEncode", inputs: { clip_vision: ["vision", 0], image: [`${p}photo${k}`, 0], crop: "center" } };
      g[`${p}photo${k}_style`] = { class_type: "StyleModelApply", inputs: { conditioning: positive, style_model: ["redux", 0], clip_vision_output: [`${p}photo${k}_vision`, 0], strength: r.styleStrength ?? DECOR_3D_STYLE_STRENGTH, strength_type: r.styleType ?? DECOR_3D_STYLE_TYPE } };
      positive = [`${p}photo${k}_style`, 0];
    });
    g[`${p}guidance`] = { class_type: "FluxGuidance", inputs: { conditioning: positive, guidance: DECOR_3D_GUIDANCE } };
    g[`${p}structure`] = { class_type: "InstructPixToPixConditioning", inputs: { positive: [`${p}guidance`, 0], negative: [`${p}neg`, 0], vae: ["vae", 0], pixels: depthPx }, _meta: { title: "Structure : profondeur de la vue 3D" } };
    let latent: [string, number] = [`${p}structure`, 2];
    if (start === "vue") {
      g[`${p}view_latent`] = { class_type: "VAEEncode", inputs: { pixels: viewPx!, vae: ["vae", 0] } };
      latent = [`${p}view_latent`, 0];
    }
    g[`${p}sample`] = { class_type: "KSampler", inputs: { model: ["depth_lora", 0], positive: [`${p}structure`, 0], negative: [`${p}structure`, 1], latent_image: latent, seed: seedOf(r.seed), steps: DECOR_3D_STEPS, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: start === "vue" ? r.viewDenoise ?? DECOR_3D_VIEW_DENOISE : 1 } };
    g[`${p}decode`] = { class_type: "VAEDecode", inputs: { samples: [`${p}sample`, 0], vae: ["vae", 0] } };
    g[`${p}save`] = { class_type: "SaveImage", inputs: { images: [`${p}decode`, 0], filename_prefix: `uttu-decor-3d-${i}` } };
  });
  return g;
}
