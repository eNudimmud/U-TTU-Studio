// One take, start to finish, without leaving the studio: send the pictures,
// queue the graph, follow the job, bring the video back, and measure what the
// account was charged from two real balance readings. Following is separate
// so a take queued before a reload can be picked up again.

import { measuredCost } from "../credits.ts";
import { audioOutput, executionSeconds, imageOutput, jobStage, meshOutput, RenderError, videoOutput, type OutputRef, type RenderClient } from "./client.ts";
import { LTX_REFS_MAX, ltxTakeGraph } from "./ltx-graph.ts";
import type { UploadedControls } from "./framed-key.ts";
import { TAKE_PICTURES_MAX, takeEngine, takeGraph, takeRendu, type ApiGraph, type TakeSettings } from "./take-graph.ts";

export function referenceLimit(settings: TakeSettings): number { return takeEngine(settings) === "ltx" ? LTX_REFS_MAX : TAKE_PICTURES_MAX; }

function checkReferences(settings: TakeSettings, count: number): void {
  if (count > referenceLimit(settings)) throw new RenderError("invalid", `Ce moteur accepte au plus ${referenceLimit(settings)} images de référence. Réduis les références avant de générer.`);
}

/** The graph for the chosen engine. Same pictures, same text. */
export function takeGraphFor(settings: TakeSettings, prompt: string, pictures: readonly string[], seed: number, controls?: UploadedControls): ApiGraph {
  checkReferences(settings, pictures.length);
  if (Boolean(settings.cadrage) !== Boolean(controls) || (controls && takeEngine(settings) !== "ltx")) throw new RenderError("invalid", "Le cadrage gardé demande ses deux contrôles et le moteur LTX.");
  if (takeEngine(settings) === "ltx") return ltxTakeGraph({ prompt, pictures, seed, seconds: settings.seconds, aspect: settings.aspect, apercu: takeRendu(settings) === "apercu", controls });
  return takeGraph({ ...settings, prompt, pictures, seed });
}

export interface TakeRunInput {
  controls?: { depth: { blob: Blob; name: string }; edges: { blob: Blob; name: string }; guide?: { blob: Blob; name: string } };
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
  /** Output bytes are in hand — UI may show the result before cost is known. */
  | { stage: "ready"; jobId: string; video: Blob; filename: string }
  | { stage: "measure"; jobId: string };

export interface TakeRunResult {
  jobId: string;
  video: Blob;
  filename: string;
  /** The output as Comfy Cloud names it (filename, subfolder, type). */
  output: OutputRef;
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
  /** What the job saves. A take is a video; « Et ensuite ? » image tools save a still. */
  output?: "video" | "image" | "audio" | "mesh";
  /**
   * Resolve as soon as the output bytes exist. Cost is read afterward and reported via
   * `onCost` (and a trailing `measure` event) without blocking the result.
   */
  deferMeasure?: boolean;
  /** Fired when a deferred (or sync) balance read finishes. */
  onCost?: (info: { balanceAfter: number | null; costCredits: number | null }) => void;
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Sends the pictures and queues the take. Returns the cloud job id. */
export async function submitTake(
  client: RenderClient,
  input: TakeRunInput,
  onEvent: (event: TakeRunEvent) => void,
  signal?: AbortSignal,
): Promise<string> {
  checkReferences(input.settings, input.pictures.length);
  // Reject incomplete controls before uploading or submitting anything.
  if (Boolean(input.settings.cadrage) !== Boolean(input.controls) || (input.controls && (takeEngine(input.settings) !== "ltx" || !input.controls.depth?.blob.size || !input.controls.edges?.blob.size))) throw new RenderError("invalid", "Les contrôles de cadrage sont incomplets.");
  const names: string[] = [];
  for (const [index, picture] of input.pictures.entries()) {
    if (signal?.aborted) throw new RenderError("cancelled", "Prise annulée avant l’envoi.");
    onEvent({ stage: "upload", done: index, total: input.pictures.length });
    names.push(await client.upload(picture.blob, picture.name));
  }
  onEvent({ stage: "upload", done: input.pictures.length, total: input.pictures.length });
  if (signal?.aborted) throw new RenderError("cancelled", "Prise annulée avant l’envoi.");
  const controls = input.controls ? {
    depth: await client.upload(input.controls.depth.blob, input.controls.depth.name),
    edges: await client.upload(input.controls.edges.blob, input.controls.edges.name),
    ...(input.controls.guide?.blob.size ? { guide: await client.upload(input.controls.guide.blob, input.controls.guide.name) } : {}),
  } : undefined;
  if (signal?.aborted) throw new RenderError("cancelled", "Envoi interrompu avant la soumission.");
  onEvent({ stage: "submit" });
  const graph = takeGraphFor(input.settings, input.prompt, names, input.seed, controls);
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
      // Never cancel a Comfy job: stop waiting here only. The job keeps running in the cloud.
      throw new RenderError("cancelled", "Suivi arrêté sur cet appareil. La prise continue chez Comfy ; son résultat se récupère plus tard (Récupérer le rendu, ou la médiathèque).");
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
  const kind = options.output ?? "video";
  const ref = kind === "image" ? imageOutput(detail.outputs) : kind === "audio" ? audioOutput(detail.outputs) : kind === "mesh" ? meshOutput(detail.outputs) : videoOutput(detail.outputs);
  const missing = { image: "aucune image", audio: "aucun son", mesh: "aucun volume 3D", video: "aucune vidéo" }[kind];
  if (!ref) throw new RenderError("failed", `Le rendu est fini, mais ${missing} n’est sorti${kind === "image" || kind === "video" ? "e" : ""}.`);
  const video = await client.file(ref);
  onEvent({ stage: "ready", jobId, video, filename: ref.filename });

  const pack = (balanceAfter: number | null, costCredits: number | null): TakeRunResult => ({
    jobId,
    video,
    filename: ref.filename,
    output: { filename: ref.filename, subfolder: ref.subfolder, type: ref.type },
    gpuSeconds: executionSeconds(detail),
    balanceBefore,
    balanceAfter,
    costCredits,
  });

  const readCost = async (): Promise<{ balanceAfter: number | null; costCredits: number | null }> => {
    // When deferred, skip the measure stage event so the progress label never says
    // « Lecture du coût réel… » after the bytes are already shown (or mid-render).
    if (!options.deferMeasure) onEvent({ stage: "measure", jobId });
    let balanceAfter: number | null = null;
    for (let attempt = 0; attempt < measureTries; attempt++) {
      balanceAfter = await client.balance().catch(() => null);
      if (balanceAfter !== null && balanceAfter !== balanceBefore) break;
      if (attempt < measureTries - 1) await sleep(measureMs);
    }
    const charged = balanceAfter !== null && balanceAfter !== balanceBefore ? balanceAfter : null;
    const info = { balanceAfter: charged, costCredits: measuredCost(balanceBefore, charged) };
    options.onCost?.(info);
    return info;
  };

  if (options.deferMeasure) {
    // Never block the result on the balance poll: show bytes first, fill the quote line later.
    void readCost().catch(() => {
      options.onCost?.({ balanceAfter: null, costCredits: null });
    });
    return pack(null, null);
  }

  const measured = await readCost();
  return pack(measured.balanceAfter, measured.costCredits);
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
