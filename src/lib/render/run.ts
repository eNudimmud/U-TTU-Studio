// One take, start to finish, without leaving the studio: send the pictures,
// queue the graph, follow the job, bring the video back, and measure what the
// account was charged from two real balance readings. Following is separate
// so a take queued before a reload can be picked up again.

import { measuredCost } from "../credits.ts";
import { executionSeconds, jobStage, RenderError, videoOutput, type RenderClient } from "./client.ts";
import { takeGraph, type TakeSettings } from "./take-graph.ts";

export interface TakeRunInput {
  pictures: readonly { blob: Blob; name: string }[];
  prompt: string;
  settings: TakeSettings;
  seed: number;
  clientId: string;
}

export type TakeRunEvent =
  | { stage: "upload"; done: number; total: number }
  | { stage: "submit" }
  | { stage: "queue"; jobId: string }
  | { stage: "prepare"; jobId: string }
  | { stage: "render"; jobId: string; seconds: number }
  | { stage: "fetch"; jobId: string }
  | { stage: "measure"; jobId: string };

export interface TakeRunResult {
  jobId: string;
  video: Blob;
  filename: string;
  gpuSeconds: number | null;
  balanceBefore: number;
  balanceAfter: number | null;
  costCredits: number | null;
}

export interface TakeRunOptions {
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  pollMs?: number;
  timeoutMs?: number;
  measureTries?: number;
  measureMs?: number;
  /** Consecutive unreachable status reads tolerated, for a phone changing networks. */
  networkTries?: number;
  signal?: AbortSignal;
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Sends the pictures and queues the take. Returns the cloud job id. */
export async function submitTake(
  client: RenderClient,
  input: TakeRunInput,
  onEvent: (event: TakeRunEvent) => void,
  signal?: AbortSignal,
): Promise<string> {
  const names: string[] = [];
  for (const [index, picture] of input.pictures.entries()) {
    if (signal?.aborted) throw new RenderError("cancelled", "Prise annulée avant l’envoi.");
    onEvent({ stage: "upload", done: index, total: input.pictures.length });
    names.push(await client.upload(picture.blob, picture.name));
  }
  onEvent({ stage: "upload", done: input.pictures.length, total: input.pictures.length });
  if (signal?.aborted) throw new RenderError("cancelled", "Prise annulée avant l’envoi.");
  onEvent({ stage: "submit" });
  const graph = takeGraph({ ...input.settings, prompt: input.prompt, pictures: names, seed: input.seed });
  return client.submit(graph, input.clientId);
}

/** `balanceBefore` must be the balance the adherent confirmed against. */
export async function followTake(
  client: RenderClient,
  jobId: string,
  balanceBefore: number,
  onEvent: (event: TakeRunEvent) => void,
  options: TakeRunOptions = {},
): Promise<TakeRunResult> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const pollMs = options.pollMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 35 * 60 * 1000;
  const measureTries = options.measureTries ?? 4;
  const measureMs = options.measureMs ?? 5000;
  const networkTries = options.networkTries ?? 5;

  const started = now();
  let renderFrom: number | null = null;
  let misses = 0;
  for (;;) {
    if (options.signal?.aborted) {
      await client.cancel(jobId).catch(() => {});
      throw new RenderError("cancelled", "Prise annulée. Le temps déjà calculé peut être débité.");
    }
    if (now() - started > timeoutMs) throw new RenderError("timeout", "La prise dépasse la durée permise.");
    let status: string;
    try {
      status = await client.status(jobId);
      misses = 0;
    } catch (error) {
      if (!(error instanceof RenderError) || error.code !== "network" || ++misses >= networkTries) throw error;
      await sleep(pollMs);
      continue;
    }
    const stage = jobStage(status);
    if (stage === "done") break;
    if (stage === "failed") {
      const detail = await client.job(jobId).catch(() => null);
      const reason = detail?.execution_error?.exception_message;
      throw new RenderError("failed", "Le rendu a échoué dans le cloud.", reason ? [reason] : []);
    }
    if (stage === "cancelled") throw new RenderError("cancelled", "La prise a été annulée dans le cloud.");
    if (stage === "render") {
      renderFrom ??= now();
      onEvent({ stage: "render", jobId, seconds: Math.round((now() - renderFrom) / 1000) });
    } else {
      onEvent({ stage, jobId });
    }
    await sleep(pollMs);
  }

  onEvent({ stage: "fetch", jobId });
  const detail = await client.job(jobId);
  const ref = videoOutput(detail.outputs);
  if (!ref) throw new RenderError("failed", "La prise est finie, mais aucune vidéo n’est sortie.");
  const video = await client.file(ref);

  onEvent({ stage: "measure", jobId });
  let balanceAfter: number | null = null;
  for (let attempt = 0; attempt < measureTries; attempt++) {
    balanceAfter = await client.balance().catch(() => null);
    if (balanceAfter !== null && balanceAfter !== balanceBefore) break;
    if (attempt < measureTries - 1) await sleep(measureMs);
  }
  const charged = balanceAfter !== null && balanceAfter !== balanceBefore ? balanceAfter : null;
  return {
    jobId,
    video,
    filename: ref.filename,
    gpuSeconds: executionSeconds(detail),
    balanceBefore,
    balanceAfter: charged,
    costCredits: measuredCost(balanceBefore, charged),
  };
}

export async function runTake(
  client: RenderClient,
  input: TakeRunInput,
  balanceBefore: number,
  onEvent: (event: TakeRunEvent) => void,
  options: TakeRunOptions = {},
): Promise<TakeRunResult> {
  const jobId = await submitTake(client, input, onEvent, options.signal);
  return followTake(client, jobId, balanceBefore, onEvent, options);
}
