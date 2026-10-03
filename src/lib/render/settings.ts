// How this device reaches the adherent's renderer, and the take in flight.
// Kept in this browser only. The key is never part of the vault export.

import type { TakeSettings } from "./take-graph.ts";

export type RenderLink = { mode: "none" } | { mode: "session" } | { mode: "key"; key: string };

export const RENDER_LINK_KEY = "u-ttu-rendu";
export const IN_FLIGHT_KEY = "u-ttu-tournage";

const KEY_PATTERN = /^[A-Za-z0-9._~+/=-]{16,256}$/;

export function cleanApiKey(raw: string): string | null {
  const key = raw.trim();
  return KEY_PATTERN.test(key) ? key : null;
}

export function readRenderLink(storage: Pick<Storage, "getItem"> | null): RenderLink {
  try {
    const data = JSON.parse(storage?.getItem(RENDER_LINK_KEY) ?? "null") as { mode?: unknown; key?: unknown } | null;
    if (data?.mode === "session") return { mode: "session" };
    if (data?.mode === "key" && typeof data.key === "string") {
      const key = cleanApiKey(data.key);
      if (key) return { mode: "key", key };
    }
  } catch {}
  return { mode: "none" };
}

export function saveRenderLink(storage: Pick<Storage, "setItem" | "removeItem"> | null, link: RenderLink): void {
  try {
    if (!storage) return;
    if (link.mode === "none") storage.removeItem(RENDER_LINK_KEY);
    else storage.setItem(RENDER_LINK_KEY, JSON.stringify(link));
  } catch {}
}

/** What the app needs to finish a take that was queued before a reload. */
export interface InFlight {
  jobId: string;
  at: string;
  sceneId: string | null;
  sceneName: string;
  line: string;
  prompt: string;
  settings: TakeSettings;
  balanceBefore: number;
}

export function readInFlight(storage: Pick<Storage, "getItem"> | null): InFlight | null {
  try {
    const data = JSON.parse(storage?.getItem(IN_FLIGHT_KEY) ?? "null") as Partial<InFlight> | null;
    if (!data || typeof data.jobId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(data.jobId)) return null;
    if (typeof data.balanceBefore !== "number" || typeof data.at !== "string" || !data.settings) return null;
    return {
      jobId: data.jobId,
      at: data.at,
      sceneId: typeof data.sceneId === "string" ? data.sceneId : null,
      sceneName: typeof data.sceneName === "string" ? data.sceneName : "",
      line: typeof data.line === "string" ? data.line : "",
      prompt: typeof data.prompt === "string" ? data.prompt : "",
      settings: data.settings as TakeSettings,
      balanceBefore: data.balanceBefore,
    };
  } catch {
    return null;
  }
}

export function saveInFlight(storage: Pick<Storage, "setItem" | "removeItem"> | null, value: InFlight | null): void {
  try {
    if (!storage) return;
    if (value) storage.setItem(IN_FLIGHT_KEY, JSON.stringify(value));
    else storage.removeItem(IN_FLIGHT_KEY);
  } catch {}
}
