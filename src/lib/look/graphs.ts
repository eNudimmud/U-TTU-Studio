// Graphs the anime look sends. Templates stay templates: Wan is slot overrides on the
// official i2v graph, never a rebuilt copy. Finish is a core graph (Real-ESRGAN anime).
// It sharpens the frames it is given. It does not sample a new picture.

export interface ApiNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta: { title: string };
}

export type ApiGraph = Record<string, ApiNode>;

export const KREA_STYLE_TEMPLATE = "image_krea2_turbo_int8_image_style_reference";
export const KREA_T2I_TEMPLATE = "image_krea2_turbo_t2i_int8";
export const QWEN_EDIT_TEMPLATE = "image_qwen_image_2_1_image_edit";
export const QWEN_EDIT_TURBO = "image_qwen_image_2_1_turbo_image_edit";
export const KLEIN_EDIT_TEMPLATE = "image_flux3_klein_image_edit";
export const WAN_I2V_TEMPLATE = "video_wan2_2_14B_i2v";
export const LTX_I2V_TEMPLATE = "video_ltx2_5_i2v";
export const LTX_FLF_TEMPLATE = "video_ltx2_5_flf2v";
export { FINISH_TEMPLATE, REALESRGAN_ANIME, grapheFinition, type FinishInput } from "./finish-graph.ts";
export const LORA_STYLE = "krea2_style_reference";
export const LORA_RETRO = "krea2_retroanime";

/** Verified slots on `video_wan2_2_14B_i2v`. The graph itself is not rewritten. */
export const ANISORA_HIGH = "Wan2_2-I2V_AniSoraV3_2_HIGH_14B_fp8_e4m3fn_scaled_KJ.safetensors";
export const ANISORA_LOW = "Wan2_2-I2V_AniSoraV3_2_LOW_14B_fp8_e4m3fn_scaled_KJ.safetensors";
export const ANISORA_SLOTS = {
  "129.unet_name": ANISORA_HIGH,
  "129.unet_name_1": ANISORA_LOW,
} as const;

export const QWEN_REFS_MAX = 2;

const PARTNER = /Gemini|Kling|Vidu|Tripo|Meshy|OpenAI|Ideogram|ByteDance|Seedream|Seedance|Flux3Image|ElevenLabs|Sonilo|Hailuo|Bria|SyncSo|Veed|Grok|Higgsfield|Mirelo|Topaz|fal/i;
const SAMPLER = /KSampler|SamplerCustom|EmptyLatent|WanImageToVideo|LTXV|UNETLoader|CLIPLoader|VAEDecode|Flux|Qwen/i;

export function noeudPartenaire(graph: ApiGraph): boolean {
  return Object.values(graph).some(node => PARTNER.test(node.class_type) || node.class_type.startsWith("API"));
}

/** True when a graph would draw a new picture instead of enlarging the one it loaded. */
export function regenere(graph: ApiGraph): boolean {
  return Object.values(graph).some(node => SAMPLER.test(node.class_type));
}

