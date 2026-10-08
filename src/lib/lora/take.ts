// A take that loads the adherent's own LoRA: the .safetensors file from the
// vault goes to fal's storage, and H3 reference-to-video applies it by URL,
// with the look's photos and the place's stills as references.

import { FalError, type FalClient, type FalHandle } from "../fal/client.ts";
import { LORA_TAKE, type LoraResolution } from "../fal/prices.ts";
import type { TrainingAspect } from "./dataset.ts";
import { followQueue, measureCharge, type FollowOptions } from "./follow.ts";
import { LORA_PICTURES_MAX, loraTakeRequest } from "./take-request.ts";

export { LORA_PICTURES_MAX, LORA_SCALE, loraTakeRequest } from "./take-request.ts";

/** Same settings, same quote: what a LoRA take is filed under in the vault. */
export function loraTakeProfile(seconds: number, aspect: string, resolution: LoraResolution): string {
  return `fal-h3-lora-${resolution}-${seconds}s-${aspect}`;
}
export const LORA_UPLOAD_KEEP_SECONDS = 24 * 3600;
export const LORA_TAKE_KEEP_SECONDS = 7 * 24 * 3600;
/** An earlier copy on fal is reused only with this much life left; else the vault file is sent again. */
const REUSE_MARGIN_MS = 2 * 3600 * 1000;

export interface LoraFile {
  id: string;
  blob: Blob;
  /** Where the vault file was last uploaded, and until when fal keeps that copy. */
  url: string | null;
  urlUntil: number | null;
}

export interface LoraTakeInput {
  lora: LoraFile;
  pictures: readonly { blob: Blob; name: string }[];
  prompt: string;
  seconds: number;
  aspect: TrainingAspect;
  resolution: LoraResolution;
  seed: number;
}

export type LoraTakeEvent =
  | { stage: "upload"; done: number; total: number }
  | { stage: "lora"; loaded: number; total: number }
  | { stage: "submit" }
  | { stage: "queue"; position: number | null }
  | { stage: "render"; seconds: number }
  | { stage: "fetch" }
  | { stage: "measure" };

export interface SubmittedLoraTake {
  handle: FalHandle;
  loraUrl: string;
  loraUrlUntil: number;
}

export async function submitLoraTake(
  fal: FalClient,
  input: LoraTakeInput,
  onEvent: (event: LoraTakeEvent) => void,
  { signal, now = Date.now }: { signal?: AbortSignal; now?: () => number } = {},
): Promise<SubmittedLoraTake> {
  const pictures = input.pictures.slice(0, LORA_PICTURES_MAX);
  if (pictures.length === 0) throw new FalError("invalid", "Au moins une photo des références.");
  const imageUrls: string[] = [];
  for (const [index, picture] of pictures.entries()) {
    if (signal?.aborted) throw new FalError("cancelled", "Prise annulée avant l’envoi.");
    onEvent({ stage: "upload", done: index, total: pictures.length });
    imageUrls.push(await fal.upload(picture.blob, picture.name, { expiresIn: LORA_UPLOAD_KEEP_SECONDS, signal }));
  }
  onEvent({ stage: "upload", done: pictures.length, total: pictures.length });

  let loraUrl = input.lora.url;
  let loraUrlUntil = input.lora.urlUntil ?? 0;
  if (!loraUrl || loraUrlUntil - now() < REUSE_MARGIN_MS || !(await fal.alive(loraUrl))) {
    onEvent({ stage: "lora", loaded: 0, total: input.lora.blob.size });
    loraUrl = await fal.upload(input.lora.blob, `${input.lora.id}.safetensors`, {
      expiresIn: LORA_UPLOAD_KEEP_SECONDS,
      signal,
      onProgress: (loaded, total) => onEvent({ stage: "lora", loaded, total }),
    });
    loraUrlUntil = now() + LORA_UPLOAD_KEEP_SECONDS * 1000;
  }
  if (signal?.aborted) throw new FalError("cancelled", "Prise annulée avant l’envoi.");
  onEvent({ stage: "submit" });
  const handle = await fal.submit(LORA_TAKE, loraTakeRequest({ ...input, imageUrls, loraUrl }), { expiresIn: LORA_TAKE_KEEP_SECONDS, signal });
  return { handle, loraUrl, loraUrlUntil };
}

export interface LoraTakeResult {
  requestId: string;
  video: Blob;
  seconds: number | null;
  costUsd: number | null;
  costSource: "billing" | "balance" | null;
  balanceAfter: number | null;
}

export async function followLoraTake(
  fal: FalClient,
  handle: FalHandle,
  balanceBefore: number,
  onEvent: (event: LoraTakeEvent) => void,
  options: FollowOptions = {},
): Promise<LoraTakeResult> {
  const seconds = await followQueue(
    fal,
    handle,
    event => onEvent(event.stage === "queue" ? event : { stage: "render", seconds: event.seconds }),
    { pollMs: 3000, timeoutMs: 45 * 60 * 1000, ...options },
    "Le rendu a échoué chez fal.",
  );
  onEvent({ stage: "fetch" });
  const output = await fal.result<{ video?: { url?: unknown } }>(handle);
  const url = typeof output.video?.url === "string" ? output.video.url : "";
  if (!url) throw new FalError("failed", "fal a fini sans rendre de vidéo.");
  const video = await fal.download(url, options.signal);
  onEvent({ stage: "measure" });
  const charge = await measureCharge(fal, handle.requestId, balanceBefore, options);
  return { requestId: handle.requestId, video, seconds, costUsd: charge.costUsd, costSource: charge.source, balanceAfter: charge.balanceAfter };
}
