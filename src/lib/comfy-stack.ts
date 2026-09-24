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

export const COMFY_APPS = {
  train: {
    title: "C·micro — Dataset → LoRA → 1 image (Flux.1 dev)",
    url: process.env.NEXT_PUBLIC_COMFY_TRAIN_APP_URL || "https://cloud.comfy.org/?share=798eb224b972",
    file: "/comfy/c-micro-train-image.json",
  },
  prompt: {
    title: "C·micro — Test de prompt sans LoRA (Flux.1 dev)",
    url: process.env.NEXT_PUBLIC_COMFY_PROMPT_APP_URL || "https://cloud.comfy.org/?share=25954f3b0278",
    file: "/comfy/c-micro-prompt-test.json",
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
