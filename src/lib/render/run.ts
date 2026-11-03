// One take, start to finish, without leaving the studio: send the pictures,
// queue the graph, follow the job, bring the video back, and measure what the
// account was charged from two real balance readings. Following is separate
// so a take queued before a reload can be picked up again.

import { BILLED_CREDITS_PER_GPU_SECOND, gpuTimeCredits, measuredCost } from "../credits.ts";
import { executionSeconds, jobStage, pickOutput, pickOutputs, RenderError, type OutputRef, type RenderClient } from "./client.ts";
import { LTX_REFS_MAX, ltxTakeGraph } from "./ltx-graph.ts";
import type { UploadedControls } from "./framed-key.ts";
import { TAKE_PICTURES_MAX, takeEngine, takeGraph, takeRendu, type ApiGraph, type TakeSettings } from "./take-graph.ts";

export function referenceLimit(settings: TakeSettings): number { return takeEngine(settings) === "ltx" ? LTX_REFS_MAX : TAKE_PICTURES_MAX; }

function checkReferences(settings: TakeSettings, count: number): void {
  if (count > referenceLimit(settings)) throw new RenderError("invalid", `Ce moteur accepte au plus ${referenceLimit(settings)} images de référence. Réduis les références avant de générer.`);
}

/** The graph for the chosen engine. Same pictures, same text. */
export function takeGraphFor(settings: TakeSettings, prompt: string, pictures: readonly string[], seed: number, controls?: UploadedControls, roles?: string): ApiGraph {
  checkReferences(settings, pictures.length);
  if (Boolean(settings.cadrage) !== Boolean(controls) || (controls && takeEngine(settings) !== "ltx")) throw new RenderError("invalid", "Le cadrage gardé demande ses deux contrôles et le moteur LTX.");
  if (takeEngine(settings) === "ltx") return ltxTakeGraph({ prompt, pictures, seed, seconds: settings.seconds, aspect: settings.aspect, apercu: takeRendu(settings) === "apercu", controls, ...(roles ? { roles } : {}) });
  return takeGraph({ ...settings, prompt, pictures, seed });
}

export interface TakeRunInput {
  controls?: { depth: { blob: Blob; name: string }; edges: { blob: Blob; name: string }; guide?: { blob: Blob; name: string } };
  pictures: readonly { blob: Blob; name: string }[];
  prompt: string;
  settings: TakeSettings;
  seed: number;
  clientId: string;
  /** CE1 slot text for an LTX take with two or more characters. Absent: the historical preamble. */
  roles?: string;
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
  /** With `all`: the other files the final node saved, after the first one. */
  extras?: { blob: Blob; filename: string }[];
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
  /** Id of the node that saves the final result (render/sortie.ts). Only that node is read. */
  outputNode?: string;
  /** Also fetch every other file of `outputNode` (a lot of 8 angles saved by one node). */
  all?: boolean;
  /**
   * Resolve as soon as the output bytes exist. Cost is read afterward and reported via
   * `onCost` (and a trailing `measure` event) without blocking the result.
   */
  deferMeasure?: boolean;
  /** Fired when a deferred (or sync) balance read finishes. */
  onCost?: (info: { balanceAfter: number | null; costCredits: number | null; gpuSeconds?: number | null; gpuCredits?: number | null }) => void;
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
  const graph = takeGraphFor(input.settings, input.prompt, names, input.seed, controls, input.roles);
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
  // A deferred read never blocks the result, so it can wait for Comfy's slow balance update
  // (about a minute) and for the job's billed row in the event feed, instead of leaving the cost unread.
  const measureTries = options.measureTries ?? (options.deferMeasure ? 24 : 4);
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
  const ref = pickOutput(detail.outputs, kind, options.outputNode);
  const missing = { image: "aucune image", audio: "aucun son", mesh: "aucun volume 3D", video: "aucune vidéo" }[kind];
  if (!ref) throw new RenderError("failed", `Le rendu est fini, mais ${missing} n’est sorti${kind === "image" || kind === "video" ? "e" : ""}.`);
  const video = await client.file(ref);
  const extras: { blob: Blob; filename: string }[] = [];
  if (options.all && options.outputNode !== undefined) {
    for (const more of pickOutputs(detail.outputs, kind, options.outputNode).slice(1)) extras.push({ blob: await client.file(more), filename: more.filename });
  }
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
    ...(options.all ? { extras } : {}),
  });

  const gpuSeconds = executionSeconds(detail);
  const readCost = async (): Promise<{ balanceAfter: number | null; costCredits: number | null; gpuSeconds: number | null; gpuCredits: number | null }> => {
    // When deferred, skip the measure stage event so the progress label never says
    // « Lecture du coût réel… » after the bytes are already shown (or mid-render).
    if (!options.deferMeasure) onEvent({ stage: "measure", jobId });
    let balanceAfter: number | null = null;
    let billed: number | null = null;
    for (let attempt = 0; attempt < measureTries; attempt++) {
      // The job's own billed row first (GPU seconds × the billed rate): a balance moves with grants,
      // other tabs and invoice lag, so its difference is only the fallback.
      const charge = typeof client.jobCharge === "function" ? await client.jobCharge(jobId, BILLED_CREDITS_PER_GPU_SECOND).catch(() => null) : null;
      if (charge) billed = charge.credits;
      balanceAfter = await client.balance().catch(() => null);
      if (billed !== null || (balanceAfter !== null && balanceAfter !== balanceBefore)) break;
      if (attempt < measureTries - 1) await sleep(measureMs);
    }
    const charged = balanceAfter !== null && balanceAfter !== balanceBefore ? balanceAfter : null;
    const costCredits = billed ?? measuredCost(balanceBefore, charged);
    // Neither readable yet: keep the job's compute time as a fallback figure (« ≈ … estimés »).
    const info = { balanceAfter: charged, costCredits, gpuSeconds, gpuCredits: costCredits === null ? gpuTimeCredits(gpuSeconds) : null };
    options.onCost?.(info);
    return info;
  };

  if (options.deferMeasure) {
    // Never block the result on the balance poll: show bytes first, fill the quote line later.
    void readCost().catch(() => {
      options.onCost?.({ balanceAfter: null, costCredits: null, gpuSeconds, gpuCredits: gpuTimeCredits(gpuSeconds) });
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
