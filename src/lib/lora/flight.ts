// What the app needs to pick up a training or a LoRA take after a reload, and
// where the vault's LoRA was last uploaded. Kept in this browser only.

import type { FalHandle } from "../fal/client.ts";
import type { LoraResolution } from "../fal/prices.ts";
import type { TakeSettings } from "../render/take-graph.ts";
import type { TrainingAspect } from "./dataset.ts";

export const TRAINING_FLIGHT_KEY = "u-ttu-formation";
export const LORA_TAKE_FLIGHT_KEY = "u-ttu-tournage-lora";
export const LORA_UPLOADS_KEY = "u-ttu-lora-envois";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;

function queueUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "queue.fal.run" ? url.toString() : null;
  } catch {
    return null;
  }
}

function readHandle(value: unknown): FalHandle | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const urls = [row.statusUrl, row.responseUrl, row.cancelUrl].map(queueUrl);
  if (typeof row.requestId !== "string" || !/^[A-Za-z0-9-]{8,80}$/.test(row.requestId) || urls.some(url => !url)) return null;
  return { requestId: row.requestId, statusUrl: urls[0]!, responseUrl: urls[1]!, cancelUrl: urls[2]! };
}

function read(storage: Store, key: string): Record<string, unknown> | null {
  try {
    const data = JSON.parse(storage?.getItem(key) ?? "null") as unknown;
    return data && typeof data === "object" ? data as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function write(storage: Store, key: string, value: unknown): void {
  try {
    if (!storage) return;
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch {}
}

export interface TrainingFlight {
  handle: FalHandle;
  at: string;
  name: string;
  trigger: string;
  steps: number;
  aspect: TrainingAspect;
  clips: number;
  balanceBefore: number;
}

export function readTrainingFlight(storage: Store): TrainingFlight | null {
  const data = read(storage, TRAINING_FLIGHT_KEY);
  const handle = data ? readHandle(data.handle) : null;
  if (!data || !handle || typeof data.trigger !== "string" || typeof data.balanceBefore !== "number" || typeof data.at !== "string") return null;
  const aspect = data.aspect === "16:9" || data.aspect === "1:1" ? data.aspect : "9:16";
  return {
    handle,
    at: data.at,
    name: typeof data.name === "string" ? data.name : "",
    trigger: data.trigger,
    steps: typeof data.steps === "number" ? data.steps : 0,
    aspect,
    clips: typeof data.clips === "number" ? data.clips : 0,
    balanceBefore: data.balanceBefore,
  };
}

export const saveTrainingFlight = (storage: Store, value: TrainingFlight | null) => write(storage, TRAINING_FLIGHT_KEY, value);

export interface LoraTakeFlight {
  handle: FalHandle;
  at: string;
  sceneId: string | null;
  sceneName: string;
  line: string;
  prompt: string;
  settings: TakeSettings;
  resolution: LoraResolution;
  loraId: string;
  balanceBefore: number;
}

export function readLoraTakeFlight(storage: Store): LoraTakeFlight | null {
  const data = read(storage, LORA_TAKE_FLIGHT_KEY);
  const handle = data ? readHandle(data.handle) : null;
  if (!data || !handle || typeof data.loraId !== "string" || typeof data.balanceBefore !== "number" || typeof data.at !== "string" || !data.settings) return null;
  return {
    handle,
    at: data.at,
    sceneId: typeof data.sceneId === "string" ? data.sceneId : null,
    sceneName: typeof data.sceneName === "string" ? data.sceneName : "",
    line: typeof data.line === "string" ? data.line : "",
    prompt: typeof data.prompt === "string" ? data.prompt : "",
    settings: data.settings as TakeSettings,
    resolution: data.resolution === "480P" ? "480P" : "768P",
    loraId: data.loraId,
    balanceBefore: data.balanceBefore,
  };
}

export const saveLoraTakeFlight = (storage: Store, value: LoraTakeFlight | null) => write(storage, LORA_TAKE_FLIGHT_KEY, value);

export interface LoraUpload {
  url: string;
  until: number;
}

export function readLoraUploads(storage: Store): Record<string, LoraUpload> {
  const data = read(storage, LORA_UPLOADS_KEY) ?? {};
  const out: Record<string, LoraUpload> = {};
  for (const [id, value] of Object.entries(data)) {
    const row = value as { url?: unknown; until?: unknown } | null;
    if (!row || typeof row.url !== "string" || typeof row.until !== "number") continue;
    try {
      const url = new URL(row.url);
      if (url.protocol === "https:" && (url.hostname === "fal.media" || url.hostname.endsWith(".fal.media"))) out[id] = { url: url.toString(), until: row.until };
    } catch {}
  }
  return out;
}

export const saveLoraUploads = (storage: Store, value: Record<string, LoraUpload>) => write(storage, LORA_UPLOADS_KEY, value);
