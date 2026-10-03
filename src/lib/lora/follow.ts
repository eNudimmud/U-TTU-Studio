// Follows one fal request to the end and reads what it cost: fal's own billing
// event for that request, or, until fal books it, the balance difference.

import { FalError, type FalClient, type FalHandle } from "../fal/client.ts";

export interface FollowOptions {
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  pollMs?: number;
  timeoutMs?: number;
  /** Consecutive unreachable status reads tolerated, for a phone changing networks. */
  networkTries?: number;
  measureTries?: number;
  measureMs?: number;
  signal?: AbortSignal;
}

export type QueueEvent = { stage: "queue"; position: number | null } | { stage: "running"; seconds: number; log: string | null };

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Returns fal's inference time in seconds once the request completed without error. */
export async function followQueue(
  fal: FalClient,
  handle: FalHandle,
  onEvent: (event: QueueEvent) => void,
  options: FollowOptions,
  failure: string,
): Promise<number | null> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const pollMs = options.pollMs ?? 5000;
  const timeoutMs = options.timeoutMs ?? 60 * 60 * 1000;
  const networkTries = options.networkTries ?? 6;
  const started = now();
  let runningFrom: number | null = null;
  let misses = 0;
  for (;;) {
    if (options.signal?.aborted) {
      await fal.cancel(handle);
      throw new FalError("cancelled", "Annulé. Le temps déjà calculé peut être débité.");
    }
    if (now() - started > timeoutMs) throw new FalError("timeout", "fal n’a pas fini dans le temps prévu. Reviens plus tard : la demande continue.");
    let status;
    try {
      status = await fal.status(handle);
      misses = 0;
    } catch (error) {
      if (!(error instanceof FalError) || error.code !== "network" || ++misses >= networkTries) throw error;
      await sleep(pollMs);
      continue;
    }
    if (status.state === "done") {
      if (status.error) throw new FalError("failed", failure, [status.error]);
      return status.seconds;
    }
    if (status.state === "running") {
      runningFrom ??= now();
      onEvent({ stage: "running", seconds: Math.round((now() - runningFrom) / 1000), log: status.log });
    } else {
      onEvent({ stage: "queue", position: status.position });
    }
    await sleep(pollMs);
  }
}

export interface Charge {
  costUsd: number | null;
  /** "billing": fal's own event for this request. "balance": the balance moved by that much. */
  source: "billing" | "balance" | null;
  balanceAfter: number | null;
}

export async function measureCharge(fal: FalClient, requestId: string, balanceBefore: number, options: FollowOptions): Promise<Charge> {
  const sleep = options.sleep ?? defaultSleep;
  const tries = options.measureTries ?? 6;
  const ms = options.measureMs ?? 5000;
  let cost: number | null = null;
  for (let attempt = 0; attempt < tries && cost === null; attempt++) {
    cost = await fal.charged(requestId).catch(() => null);
    if (cost === null && attempt < tries - 1) await sleep(ms);
  }
  const after = (await fal.account().catch(() => null))?.usd ?? null;
  if (cost !== null) return { costUsd: cost, source: "billing", balanceAfter: after };
  const spent = after !== null ? Math.round((balanceBefore - after) * 100) / 100 : 0;
  return spent > 0 ? { costUsd: spent, source: "balance", balanceAfter: after } : { costUsd: null, source: null, balanceAfter: after };
}

/** A .safetensors file starts with its little-endian header length, then the JSON header. */
export async function isSafetensors(blob: Blob): Promise<boolean> {
  if (blob.size < 16) return false;
  const head = new DataView(await blob.slice(0, 9).arrayBuffer());
  const length = head.getUint32(0, true) + head.getUint32(4, true) * 2 ** 32;
  return length > 1 && length < 100_000_000 && 8 + length <= blob.size && head.getUint8(8) === 0x7b;
}
