import { FLUX_STACK } from "./comfy-stack.ts";

export const FAL_ENDPOINTS = {
  train: "fal-ai/flux-lora-fast-training",
  gen: "fal-ai/flux-lora",
} as const;
export type FalJob = keyof typeof FAL_ENDPOINTS;

export const FAL_API = {
  queue: "https://queue.fal.run",
  storageInitiate: "https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",
} as const;

// Subject mode. `is_style: true` would drop the face masks and train on the trigger alone, ignoring the gate's captions.
export const FAL_TRAINING = {
  steps: 1000,
  bounds: { min: 20, max: 2000 },
  slider: { min: 500, max: 2000, step: 100 },
  createMasks: true,
  isStyle: false,
  maxZipBytes: 50 * 1024 * 1024,
} as const;

export const FAL_GEN = {
  strengths: [0.6, 0.75, 0.9],
  smokeStrength: 0.75,
  scaleBounds: { min: 0.5, max: 1.3 },
  width: 1024,
  height: 1024,
  inferenceSteps: 28,
  guidanceScale: FLUX_STACK.sampling.guidance,
  images: 1,
  outputFormat: "jpeg",
  safetyChecker: true,
  seed: FLUX_STACK.image.seed,
  smokeScene: "plain grey background, soft even light",
  maxPromptLength: 500,
} as const;

// Read on the endpoint pages; not yet checked against an invoice.
export const FAL_PRICING = {
  trainUsdPer1000Steps: 2,
  genUsdPerMegapixel: 0.035,
  megapixel: 1024 * 1024,
  checkedOn: "2026-09-25",
} as const;

export const USD_CHF = { rate: 0.82, verified: false, checkedOn: "2026-09-25" } as const;

// Sent as fal headers. Without them fal keeps CDN files forever, publicly readable, and request payloads for 30 days.
export const FAL_PRIVACY = {
  zipExpiresSeconds: 24 * 3600,
  outputsExpiresSeconds: 7 * 24 * 3600,
  storeRequestPayloads: false,
} as const;

export const FAL_PROXY_ROUTES = { train: "/train", status: "/status", gen: "/gen" } as const;

export interface FalTrainResult { lora: string; config: string | null }
export interface FalGenResult { image: string; width: number; height: number; seed: number | null; nsfw: boolean }
export interface FalJobResult { train: FalTrainResult; gen: FalGenResult }
export type FalJobStatus<T> =
  | { status: "IN_QUEUE"; position: number | null }
  | { status: "IN_PROGRESS"; log: string | null }
  | { status: "COMPLETED"; result: T }
  | { status: "FAILED"; error: string };
export interface FalGenRequest { lora: string; prompt: string; scale: number; seed: number }

export const falZipName = (trigger: string) => `c-micro-${trigger}-fal.zip`;

export function falTrainInput(zipUrl: string, trigger: string, steps: number = FAL_TRAINING.steps) {
  return { images_data_url: zipUrl, trigger_word: trigger, steps, create_masks: FAL_TRAINING.createMasks, is_style: FAL_TRAINING.isStyle };
}

export function falGenInput({ lora, prompt, scale, seed }: FalGenRequest) {
  return {
    prompt,
    loras: [{ path: lora, scale }],
    image_size: { width: FAL_GEN.width, height: FAL_GEN.height },
    num_inference_steps: FAL_GEN.inferenceSteps,
    guidance_scale: FAL_GEN.guidanceScale,
    num_images: FAL_GEN.images,
    seed,
    enable_safety_checker: FAL_GEN.safetyChecker,
    output_format: FAL_GEN.outputFormat,
  };
}

export const isFalRequestId = (id: string) => /^[A-Za-z0-9-]{8,64}$/.test(id);

// fal serves files from its CDN; older LoRA trainings wrote to a fal bucket on Google Cloud Storage.
export function isFalFileUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (/(^|\.)fal\.media$/.test(url.hostname) || (url.hostname === "storage.googleapis.com" && url.pathname.startsWith("/fal")));
  } catch {
    return false;
  }
}

export function checkFalSteps(steps: number): string | null {
  const { min, max } = FAL_TRAINING.bounds;
  return Number.isInteger(steps) && steps >= min && steps <= max ? null : `Étapes : un entier de ${min} à ${max}.`;
}

export function checkFalGen(request: Partial<FalGenRequest>): string | null {
  const { min, max } = FAL_GEN.scaleBounds;
  if (typeof request.lora !== "string" || !isFalFileUrl(request.lora)) return "LoRA : un fichier hébergé par fal est attendu.";
  if (typeof request.prompt !== "string" || !request.prompt.trim() || request.prompt.length > FAL_GEN.maxPromptLength) return `Prompt : 1 à ${FAL_GEN.maxPromptLength} caractères.`;
  if (typeof request.scale !== "number" || !Number.isFinite(request.scale) || request.scale < min || request.scale > max) return `Force : de ${min} à ${max}.`;
  if (typeof request.seed !== "number" || !Number.isInteger(request.seed) || request.seed < 0 || request.seed > 0xffffffff) return `Seed : un entier de 0 à ${0xffffffff}.`;
  return null;
}

export function normalizeProxyUrl(raw: string | undefined): string {
  const value = raw?.trim().replace(/\/+$/, "") ?? "";
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) ? value : "";
  } catch {
    return "";
  }
}

export interface FalCost { usd: number; chf: number }
const cost = (usd: number): FalCost => ({ usd, chf: usd * USD_CHF.rate });

export const billedMegapixels = (width: number, height: number) => Math.ceil((width * height) / FAL_PRICING.megapixel);
export const estimateFalTrain = (steps: number) => cost((steps / 1000) * FAL_PRICING.trainUsdPer1000Steps);
export const estimateFalGen = (images: number) => cost(images * billedMegapixels(FAL_GEN.width, FAL_GEN.height) * FAL_PRICING.genUsdPerMegapixel);
export const estimateFalRun = (steps: number, images: number) => cost(estimateFalTrain(steps).usd + estimateFalGen(images).usd);

// Half up: 2.105 is stored as 2.10499…, and 2,00 $ + 0,11 $ must not add up to 2,10 $.
const money = (value: number, digits = 2) => (Math.round(value * 10 ** digits + 1e-6) / 10 ** digits).toFixed(digits).replace(".", ",");
export const formatUsd = (value: number, digits = 2) => `${money(value, digits)} $`;
export const formatChf = (value: number) => `CHF ${money(value)}`;
export const formatFalCost = (value: FalCost) => `${formatUsd(value.usd)} (≈ ${formatChf(value.chf)})`;
export const formatStrength = (value: number) => money(value);
