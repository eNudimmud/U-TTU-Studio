// Sends the place's .blend to Farpy and brings back the PNG Blender wrote.
// Inspect does not spend. Start is a separate call. No pixels are invented:
// if the job returns no PNG, this throws.

import { FarpyError, inspectBlend, pngFromJob, readJob, startRender, filmState, type FilmQuote } from "./farpy.ts";

export type PrevizEvent =
  | { stage: "write" }
  | { stage: "inspect" }
  | { stage: "start" }
  | { stage: "queue"; jobId: string }
  | { stage: "render"; jobId: string; seconds: number }
  | { stage: "fetch"; jobId: string };

export interface FilmRunOptions {
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  pollMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function quoteFilm(key: string, file: Blob, filename: string, signal?: AbortSignal): Promise<FilmQuote> {
  return inspectBlend(key, file, filename, signal);
}

export async function followFilm(
  key: string,
  jobId: string,
  onEvent: (event: PrevizEvent) => void,
  options: FilmRunOptions = {},
): Promise<{ jobId: string; image: Blob }> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const pollMs = options.pollMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 20 * 60 * 1000;
  const started = now();
  let renderFrom: number | null = null;
  for (;;) {
    if (options.signal?.aborted) throw new DOMException("Filmage annulé.", "AbortError");
    if (now() - started > timeoutMs) throw new FarpyError("Le rendu dépasse la durée permise.");
    const job = await readJob(key, jobId, options.signal);
    const state = filmState(job);
    if (state === "done") {
      onEvent({ stage: "fetch", jobId });
      const image = await pngFromJob(key, job, options.signal);
      return { jobId, image };
    }
    if (state === "failed") throw new FarpyError("Blender n’a pas rendu l’image.");
    if (state === "cancelled") throw new FarpyError("Le rendu a été annulé sur le compte.");
    renderFrom ??= now();
    onEvent({ stage: "render", jobId, seconds: Math.round((now() - renderFrom) / 1000) });
    await sleep(pollMs);
  }
}

export { startRender };
