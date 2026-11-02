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
export const FINISH_TEMPLATE = "core_realesrgan_anime";

export const REALESRGAN_ANIME = "RealESRGAN_x4plus_anime_6B.pth";
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

export interface FinishInput {
  video: string;
  /** Style frame, when the palette lock is on. Colors move toward it; the drawing does not. */
  styleFrame?: string | null;
  prefix?: string;
}

/**
 * Real-ESRGAN x4plus anime, then an optional color match. No sampler, no prompt, no seed.
 * `utility-gan_upscaler` is not used: that template is tagged API.
 */
export function grapheFinition(input: FinishInput): ApiGraph {
  const video = input.video.trim();
  if (!video) throw new Error("La finition part d'une prise déjà faite.");
  const graph: ApiGraph = {
    load: { class_type: "VHS_LoadVideo", inputs: { video, force_rate: 0, frame_load_cap: 0 }, _meta: { title: "Prise" } },
    model: { class_type: "UpscaleModelLoader", inputs: { model_name: REALESRGAN_ANIME }, _meta: { title: "Real-ESRGAN anime" } },
    upscale: { class_type: "ImageUpscaleWithModel", inputs: { upscale_model: ["model", 0], image: ["load", 0] }, _meta: { title: "Agrandir" } },
  };
  let images: [string, number] = ["upscale", 0];
  if (input.styleFrame) {
    graph.style = { class_type: "LoadImage", inputs: { image: input.styleFrame }, _meta: { title: "Cadre de style" } };
    graph.color = {
      class_type: "ColorTransfer",
      inputs: { image: ["upscale", 0], reference: ["style", 0], method: "mkl_lab", source_stats: "uniform" },
      _meta: { title: "Caler les couleurs" },
    };
    images = ["color", 0];
  }
  graph.save = {
    class_type: "VHS_VideoCombine",
    inputs: { images, frame_rate: 24, loop_count: 0, filename_prefix: input.prefix ?? "video/uttu-anime-finish", format: "video/h264-mp4", save_output: true },
    _meta: { title: "Enregistrer" },
  };
  return graph;
}
