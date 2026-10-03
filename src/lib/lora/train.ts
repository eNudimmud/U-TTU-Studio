// One LoRA training on the adherent's fal account: pack the clips and the look's
// photos, upload them, queue the H3 reference-to-video trainer, follow it,
// bring the .safetensors file back and read what fal charged.

import { createZipBlob } from "../zip.ts";
import { FalError, type FalClient, type FalHandle } from "../fal/client.ts";
import { LORA_TRAINER } from "../fal/prices.ts";
import { datasetLayout, type ClipFormat, type TrainingAspect } from "./dataset.ts";
import { followQueue, isSafetensors, measureCharge, type FollowOptions } from "./follow.ts";

export const TRAINING_STEPS = [1000, 2000] as const;
export type TrainingSteps = (typeof TRAINING_STEPS)[number];
/** Rank 16 keeps the file small enough to send again from a phone at each take. */
export const TRAINING_RANK = 16;
export const UPLOAD_KEEP_SECONDS = 24 * 3600;
/** Long enough to come back for the file after closing the app mid-training. */
export const TRAINING_KEEP_SECONDS = 7 * 24 * 3600;

export interface TrainingInput {
  clips: readonly { blob: Blob; format: ClipFormat }[];
  refs: readonly Blob[];
  trigger: string;
  steps: number;
  aspect: TrainingAspect;
}

export type TrainingEvent =
  | { stage: "pack" }
  | { stage: "upload"; loaded: number; total: number }
  | { stage: "submit" }
  | { stage: "queue"; position: number | null }
  | { stage: "train"; seconds: number; log: string | null }
  | { stage: "fetch" }
  | { stage: "measure" };

export function trainingRequest(dataUrl: string, input: Pick<TrainingInput, "trigger" | "steps" | "aspect">): Record<string, unknown> {
  return {
    training_data_url: dataUrl,
    trigger_phrase: input.trigger,
    number_of_steps: input.steps,
    rank: TRAINING_RANK,
    aspect_ratio: input.aspect,
    resolution: "medium",
    number_of_frames: 73,
    frame_rate: 24,
    // Splitting a clip drops its reference photos, so every clip stays whole.
    // The page already refuses anything over 30 s. A 3 s clip can be a frame
    // short of the 73-frame bucket; scaling keeps fal from skipping it.
    split_input_into_scenes: false,
    auto_scale_input: true,
  };
}

export async function submitTraining(
  fal: FalClient,
  input: TrainingInput,
  onEvent: (event: TrainingEvent) => void,
  signal?: AbortSignal,
): Promise<FalHandle> {
  onEvent({ stage: "pack" });
  const archive = await createZipBlob(datasetLayout(input.clips, input.refs));
  if (signal?.aborted) throw new FalError("cancelled", "Formation annulée avant l’envoi.");
  onEvent({ stage: "upload", loaded: 0, total: archive.size });
  const dataUrl = await fal.upload(archive, `uttu-clips-${input.trigger}.zip`, {
    expiresIn: UPLOAD_KEEP_SECONDS,
    signal,
    onProgress: (loaded, total) => onEvent({ stage: "upload", loaded, total }),
  });
  if (signal?.aborted) throw new FalError("cancelled", "Formation annulée avant l’envoi.");
  onEvent({ stage: "submit" });
  return fal.submit(LORA_TRAINER, trainingRequest(dataUrl, input), { expiresIn: TRAINING_KEEP_SECONDS, signal });
}

export interface TrainingResult {
  requestId: string;
  lora: Blob;
  loraUrl: string;
  configUrl: string | null;
  seconds: number | null;
  costUsd: number | null;
  costSource: "billing" | "balance" | null;
  balanceAfter: number | null;
}

/** `balanceBefore` must be the balance the adherent confirmed against. */
export async function followTraining(
  fal: FalClient,
  handle: FalHandle,
  balanceBefore: number,
  onEvent: (event: TrainingEvent) => void,
  options: FollowOptions = {},
): Promise<TrainingResult> {
  const seconds = await followQueue(
    fal,
    handle,
    event => onEvent(event.stage === "queue" ? event : { stage: "train", seconds: event.seconds, log: event.log }),
    { pollMs: 10_000, timeoutMs: 8 * 60 * 60 * 1000, networkTries: 12, ...options },
    "La formation a échoué chez fal.",
  );
  onEvent({ stage: "fetch" });
  const output = await fal.result<{ lora_file?: { url?: unknown }; config_file?: { url?: unknown } }>(handle);
  const loraUrl = typeof output.lora_file?.url === "string" ? output.lora_file.url : "";
  if (!loraUrl) throw new FalError("failed", "fal a fini sans rendre de fichier LoRA.");
  const lora = await fal.download(loraUrl, options.signal);
  if (!(await isSafetensors(lora))) throw new FalError("failed", "Le fichier rendu n’est pas un LoRA .safetensors.");
  onEvent({ stage: "measure" });
  const charge = await measureCharge(fal, handle.requestId, balanceBefore, options);
  return {
    requestId: handle.requestId,
    lora: lora.type ? lora : new Blob([lora], { type: "application/octet-stream" }),
    loraUrl,
    configUrl: typeof output.config_file?.url === "string" ? output.config_file.url : null,
    seconds,
    costUsd: charge.costUsd,
    costSource: charge.source,
    balanceAfter: charge.balanceAfter,
  };
}
