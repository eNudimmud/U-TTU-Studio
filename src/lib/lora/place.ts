// A place LoRA. The H3 trainer (minimax/h3/ref2va/trainer) refuses an archive
// of stills, so a place cannot go through it. The trainer that already takes
// stills is fal-ai/flux-lora-fast-training, in style mode, with masks off.
// Reloading that file is fal-ai/flux-lora, a new still of the place.
// Neither call is the H3 take graph. The file is not a mesh: the Blender
// file remains the 3D of the place.

import { FalError, type FalClient, type FalHandle } from "../fal/client.ts";
import { PLACE_SCENE, PLACE_TRAINER } from "../fal/prices.ts";
import { createZipBlob } from "../zip.ts";
import { followQueue, isSafetensors, measureCharge, type FollowOptions } from "./follow.ts";

export const PLACE_SHOTS_MIN = 4;
export const PLACE_SHOTS_MAX = 16;
export const PLACE_VIEWS_MAX = 12;
export const PLACE_STEPS = 1000;
export const PLACE_WIDTH = 768;
export const PLACE_HEIGHT = 1024;
export const PLACE_UPLOAD_KEEP_SECONDS = 24 * 3600;
export const PLACE_KEEP_SECONDS = 7 * 24 * 3600;

export { PLACE_SCENE, PLACE_TRAINER };

/** Distinct from a character trigger, so a prompt cannot mix the two by accident. */
export function placeTrigger(name: string): string {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return `${base || "lieu"}_lieu`;
}

/** Stills, filmed frames, then extra views. Duplicates drop. The trainer sees at most sixteen. */
export function placeShotList(input: { stills: readonly string[]; frames: readonly string[]; views: readonly string[] }): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of [...input.stills, ...input.frames, ...input.views]) {
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push(path);
    if (out.length >= PLACE_SHOTS_MAX) break;
  }
  return out;
}

export function placeShotLine(count: number): { ready: boolean; line: string } {
  if (count < PLACE_SHOTS_MIN) {
    const missing = PLACE_SHOTS_MIN - count;
    return { ready: false, line: `${PLACE_SHOTS_MIN} vues au moins. Il en manque ${missing}.` };
  }
  return { ready: true, line: `${count} vues. Le fichier apprend ce lieu, pas une personne.` };
}

export function placeTrainInput(zipUrl: string, trigger: string, steps = PLACE_STEPS): Record<string, unknown> {
  return {
    images_data_url: zipUrl,
    trigger_word: trigger,
    steps,
    create_masks: false,
    is_style: true,
  };
}

export function placeSceneInput(loraUrl: string, trigger: string, place: string, seed: number): Record<string, unknown> {
  const name = place.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const prompt = `${trigger}, ${name || "the place"}, the same place, empty of people, photographic still`.slice(0, 500);
  return {
    prompt,
    loras: [{ path: loraUrl, scale: 0.9 }],
    image_size: { width: PLACE_WIDTH, height: PLACE_HEIGHT },
    num_inference_steps: 28,
    guidance_scale: 3.5,
    num_images: 1,
    seed,
    enable_safety_checker: true,
    output_format: "jpeg",
  };
}

export function placeFileNames(index: number, type: string): { image: string; caption: string } {
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const base = String(index + 1).padStart(2, "0");
  return { image: `${base}.${ext}`, caption: `${base}.txt` };
}

export interface PlaceTrainResult {
  requestId: string;
  lora: Blob;
  loraUrl: string;
  seconds: number | null;
  costUsd: number | null;
  costSource: "billing" | "balance" | null;
  balanceAfter: number | null;
}

export async function submitPlaceTraining(
  fal: FalClient,
  input: { images: readonly Blob[]; trigger: string; steps?: number },
  signal?: AbortSignal,
): Promise<FalHandle> {
  if (input.images.length < PLACE_SHOTS_MIN) throw new FalError("invalid", `${PLACE_SHOTS_MIN} vues au moins.`);
  const caption = new Blob([input.trigger], { type: "text/plain" });
  const entries = input.images.slice(0, PLACE_SHOTS_MAX).flatMap((blob, index) => {
    const names = placeFileNames(index, blob.type);
    return [
      { name: names.image, blob },
      { name: names.caption, blob: caption },
    ];
  });
  const archive = await createZipBlob(entries);
  if (signal?.aborted) throw new FalError("cancelled", "Formation annulée avant l’envoi.");
  const dataUrl = await fal.upload(archive, `uttu-lieu-${input.trigger}.zip`, { expiresIn: PLACE_UPLOAD_KEEP_SECONDS, signal });
  return fal.submit(PLACE_TRAINER, placeTrainInput(dataUrl, input.trigger, input.steps ?? PLACE_STEPS), { expiresIn: PLACE_KEEP_SECONDS, signal });
}

export async function followPlaceTraining(
  fal: FalClient,
  handle: FalHandle,
  balanceBefore: number,
  options: FollowOptions = {},
): Promise<PlaceTrainResult> {
  const seconds = await followQueue(fal, handle, () => {}, { pollMs: 10_000, timeoutMs: 8 * 60 * 60 * 1000, networkTries: 12, ...options }, "La formation du lieu a échoué chez fal.");
  const output = await fal.result<{ diffusers_lora_file?: { url?: unknown }; lora_file?: { url?: unknown } }>(handle);
  const loraUrl = typeof output.diffusers_lora_file?.url === "string"
    ? output.diffusers_lora_file.url
    : typeof output.lora_file?.url === "string" ? output.lora_file.url : "";
  if (!loraUrl) throw new FalError("failed", "fal a fini sans rendre de fichier pour ce lieu.");
  const lora = await fal.download(loraUrl, options.signal);
  if (!(await isSafetensors(lora))) throw new FalError("failed", "Le fichier rendu n’est pas un LoRA .safetensors.");
  const charge = await measureCharge(fal, handle.requestId, balanceBefore, options);
  return {
    requestId: handle.requestId,
    lora: lora.type ? lora : new Blob([lora], { type: "application/octet-stream" }),
    loraUrl,
    seconds,
    costUsd: charge.costUsd,
    costSource: charge.source,
    balanceAfter: charge.balanceAfter,
  };
}

export async function submitPlaceScene(
  fal: FalClient,
  input: { loraUrl: string; trigger: string; place: string; seed: number },
  signal?: AbortSignal,
): Promise<FalHandle> {
  return fal.submit(PLACE_SCENE, placeSceneInput(input.loraUrl, input.trigger, input.place, input.seed), { expiresIn: PLACE_KEEP_SECONDS, signal });
}

export async function followPlaceScene(
  fal: FalClient,
  handle: FalHandle,
  balanceBefore: number,
  options: FollowOptions = {},
): Promise<{ image: Blob; costUsd: number | null; costSource: "billing" | "balance" | null; balanceAfter: number | null }> {
  await followQueue(fal, handle, () => {}, { pollMs: 3000, timeoutMs: 20 * 60 * 1000, ...options }, "L’image du lieu n’a pas abouti.");
  const output = await fal.result<{ images?: { url?: unknown }[] }>(handle);
  const url = typeof output.images?.[0]?.url === "string" ? output.images[0].url : "";
  if (!url) throw new FalError("failed", "fal a fini sans image de ce lieu.");
  const image = await fal.download(url, options.signal);
  const charge = await measureCharge(fal, handle.requestId, balanceBefore, options);
  return { image, costUsd: charge.costUsd, costSource: charge.source, balanceAfter: charge.balanceAfter };
}
