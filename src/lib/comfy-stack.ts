export const DATASET_SIZE = 15;

export const FLUX_STACK = {
  name: "Flux.1 [dev]",
  models: {
    unet: "flux1-dev.safetensors",
    clipL: "clip_l.safetensors",
    t5: "t5xxl_fp16.safetensors",
    vae: "ae.safetensors",
  },
  training: {
    megapixels: 0.25,
    resolutionSteps: 16,
    steps: 800,
    testSteps: 20,
    learningRate: 0.0004,
    rank: 16,
    seed: 42,
  },
  sampling: { width: 1024, height: 1024, steps: 20, guidance: 3.5, sampler: "euler", scheduler: "simple" },
  image: { strength: 1, seed: 424242, count: 1, maxCount: 4 },
} as const;

export const COMFY_CLOUD = {
  gpuCreditsPerSecond: 0.39,
  creditsPerUsd: 211,
  runtimeLimitMinutes: { standard: 30, pro: 60 },
  checkedOn: "2026-09-24",
} as const;

export type ComfyPlan = keyof typeof COMFY_CLOUD.runtimeLimitMinutes;

// Hypotheses until a calibration run is recorded: set `measured` to true and replace the ranges.
export const TIMING = {
  measured: false,
  secondsPerStep: { low: 0.7, high: 1.4 },
  overheadSeconds: { low: 90, high: 240 },
  secondsPerImage: { low: 9, high: 14 },
} as const;

export const APP_LABELS = {
  image: (n: number) => `Image ${String(n).padStart(2, "0")}`,
  captions: `Légendes (${DATASET_SIZE} lignes, même ordre que les images)`,
  steps: "Étapes d’entraînement (test à blanc : 20)",
  prompt: "Prompt (commence par ton trigger)",
  strength: "Force LoRA",
  seed: "Seed",
  count: "Nombre d’images (1 à 4)",
  withLora: "Avec LoRA",
  control: "Témoin sans LoRA (même prompt, même seed)",
  loss: "Courbe de loss (ne juge pas le corpus)",
  promptTest: "Test de prompt sans LoRA",
} as const;

const SHARE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const TEMPLATE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;

/**
 * Official MiniMax H3 Reference-to-Video graph.
 * Node 145 `lora_name` holds the optional 4-step turbo file.
 * Node 146 stays off, so opening the graph does not apply it.
 * A Character-Swap file replaces that same `lora_name` by hand.
 * The Flux look LoRA is a different model and does not belong in this slot.
 * The stock graph has two LoadImage nodes (137, 139). Model limits are
 * 9 images / 3 videos / 3 audio; this template does not add those nodes.
 */
export const H3_R2V_TEMPLATE = {
  id: "video_minimax_h3_r2v",
  title: "MiniMax H3: Reference to Video",
  page: "https://cloud.comfy.org/?template=video_minimax_h3_r2v",
  model: "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
  loraNode: "145",
  loraInput: "lora_name",
  turboLora: "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors",
  turboToggleNode: "146",
  turboStepsNode: "144",
  turboSteps: 4,
  fullStepsNode: "143",
  fullSteps: 20,
  imageNodes: ["137", "139"],
} as const;

const ALLOWED_TEMPLATES = new Set<string>([H3_R2V_TEMPLATE.id]);

/** An allowlisted Comfy template id, or null. No other id, no path. */
export function resolveComfyTemplate(raw: string | undefined | null): string | null {
  const value = raw?.trim() ?? "";
  if (!value || !TEMPLATE_ID.test(value) || !ALLOWED_TEMPLATES.has(value)) return null;
  return value;
}

/** A public App Mode link, or null. Anything else is dropped: no invented host, no bare id. */
export function resolveComfyShare(raw: string | undefined | null): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "cloud.comfy.org") return null;
  const share = url.searchParams.get("share");
  if (!share || !SHARE_ID.test(share)) return null;
  return `https://cloud.comfy.org/?share=${share}`;
}

/** Entre may not reuse Former or Tester. Those apps do not hold a passage between two images. */
export function entreShareUrl(raw: string | undefined | null, takenUrls: readonly string[]): string | null {
  const url = resolveComfyShare(raw);
  if (!url) return null;
  const share = new URL(url).searchParams.get("share");
  const taken = new Set(takenUrls.flatMap(item => {
    const id = resolveComfyShare(item);
    return id ? [new URL(id).searchParams.get("share")] : [];
  }).filter((id): id is string => Boolean(id)));
  if (!share || taken.has(share)) return null;
  return url;
}

const TRAIN_APP = {
  title: "C·micro — Dataset → LoRA → 1 image (Flux.1 dev)",
  url: process.env.NEXT_PUBLIC_COMFY_TRAIN_APP_URL || "https://cloud.comfy.org/?share=798eb224b972",
  file: "/comfy/c-micro-train-image.json",
} as const;

const PROMPT_APP = {
  title: "C·micro — Test de prompt sans LoRA (Flux.1 dev)",
  url: process.env.NEXT_PUBLIC_COMFY_PROMPT_APP_URL || "https://cloud.comfy.org/?share=25954f3b0278",
  file: "/comfy/c-micro-prompt-test.json",
} as const;

export const COMFY_APPS = {
  train: TRAIN_APP,
  prompt: PROMPT_APP,
  entre: {
    title: "C·micro — Entre deux images",
    url: entreShareUrl(process.env.NEXT_PUBLIC_COMFY_ENTRE_APP_URL, [TRAIN_APP.url, PROMPT_APP.url]),
    file: "",
  },
} as const;

export interface Range { low: number; high: number }
export interface RunEstimate { seconds: Range; credits: Range; usd: Range }

const toEstimate = (seconds: Range): RunEstimate => {
  const credits = { low: seconds.low * COMFY_CLOUD.gpuCreditsPerSecond, high: seconds.high * COMFY_CLOUD.gpuCreditsPerSecond };
  return { seconds, credits, usd: { low: credits.low / COMFY_CLOUD.creditsPerUsd, high: credits.high / COMFY_CLOUD.creditsPerUsd } };
};

export function estimateTrainRun(steps: number, images: number): RunEstimate {
  const rendered = images + 1;
  return toEstimate({
    low: TIMING.overheadSeconds.low + steps * TIMING.secondsPerStep.low + rendered * TIMING.secondsPerImage.low,
    high: TIMING.overheadSeconds.high + steps * TIMING.secondsPerStep.high + rendered * TIMING.secondsPerImage.high,
  });
}

export function estimatePromptTest(): RunEstimate {
  return toEstimate({ low: 10 + TIMING.secondsPerImage.low, high: 60 + TIMING.secondsPerImage.high });
}

export const RUNTIME_SAFETY = 0.9;

export function maxSafeSteps(plan: ComfyPlan, images: number): number {
  const budget = COMFY_CLOUD.runtimeLimitMinutes[plan] * 60 * RUNTIME_SAFETY;
  const fixed = TIMING.overheadSeconds.high + (images + 1) * TIMING.secondsPerImage.high;
  return Math.max(0, Math.floor((budget - fixed) / TIMING.secondsPerStep.high / 50) * 50);
}
