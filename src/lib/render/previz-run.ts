// Sends the held GLB and brings back the still Render Mesh actually wrote.
// No pixels are invented here: if the job saves no image, this throws.

import { measuredCost } from "../credits.ts";
import { executionSeconds, imageOutput, jobStage, RenderError, type RenderClient } from "./client.ts";
import { previzGraph } from "./previz.ts";
import type { TakeRunOptions } from "./run.ts";

export type PrevizEvent =
  | { stage: "upload" }
  | { stage: "submit" }
  | { stage: "queue"; jobId: string }
  | { stage: "prepare"; jobId: string }
  | { stage: "render"; jobId: string; seconds: number }
  | { stage: "fetch"; jobId: string }
  | { stage: "measure"; jobId: string };

export interface PrevizResult {
  jobId: string;
  image: Blob;
  filename: string;
  gpuSeconds: number | null;
  balanceBefore: number;
  balanceAfter: number | null;
  costCredits: number | null;
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function submitPreviz(
  client: RenderClient,
  file: Blob,
  filename: string,
  clientId: string,
  onEvent: (event: PrevizEvent) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) throw new RenderError("cancelled", "Préviz annulée avant l’envoi.");
  onEvent({ stage: "upload" });
  const name = await client.upload(file, filename, "3d");
  if (signal?.aborted) throw new RenderError("cancelled", "Préviz annulée avant l’envoi.");
  onEvent({ stage: "submit" });
  return client.submit(previzGraph(name), clientId);
}

export async function followPreviz(
  client: RenderClient,
  jobId: string,
  balanceBefore: number,
  onEvent: (event: PrevizEvent) => void,
  options: TakeRunOptions = {},
): Promise<PrevizResult> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const pollMs = options.pollMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 20 * 60 * 1000;
  const measureTries = options.measureTries ?? 4;
  const measureMs = options.measureMs ?? 5000;
  const networkTries = options.networkTries ?? 5;
  const started = now();
  let renderFrom: number | null = null;
  let misses = 0;
  for (;;) {
    if (options.signal?.aborted) {
      await client.cancel(jobId).catch(() => {});
      throw new RenderError("cancelled", "Préviz annulée. Le temps déjà calculé peut être débité.");
    }
    if (now() - started > timeoutMs) throw new RenderError("timeout", "La préviz dépasse la durée permise.");
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
    if (stage === "cancelled") throw new RenderError("cancelled", "La préviz a été annulée dans le cloud.");
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
  const ref = imageOutput(detail.outputs);
  if (!ref) throw new RenderError("failed", "Le rendu est fini, mais aucune image n’est sortie.");
  const image = await client.file(ref);
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
    image,
    filename: ref.filename,
    gpuSeconds: executionSeconds(detail),
    balanceBefore,
    balanceAfter: charged,
    costCredits: measuredCost(balanceBefore, charged),
  };
}
