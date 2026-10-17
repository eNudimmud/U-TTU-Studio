// Model choices kept on this device. Nothing here spends or reaches a network.
// Open Weights Only hides every gesture that runs a partner (paid API) node.
// Nano Banana stays an option, off by default: FLUX 3 is the image engine.

import type { TakeEngine } from "./render/take-graph.ts";

export interface StudioPrefs {
  openWeightsOnly: boolean;
  nanoBanana: boolean;
  engine: TakeEngine;
  /** True once the engine was picked by hand in Avancé; otherwise PRISE chooses from the intention. */
  engineManual: boolean;
}

export const PREFS_KEY = "u-ttu-moteurs";
export const DEFAULT_PREFS: StudioPrefs = { openWeightsOnly: false, nanoBanana: false, engine: "ltx", engineManual: false };

export function readPrefs(storage: Pick<Storage, "getItem"> | null): StudioPrefs {
  try {
    const data = JSON.parse(storage?.getItem(PREFS_KEY) ?? "null") as Partial<StudioPrefs> | null;
    if (!data || typeof data !== "object") return { ...DEFAULT_PREFS };
    return {
      openWeightsOnly: data.openWeightsOnly === true,
      nanoBanana: data.nanoBanana === true,
      engine: data.engine === "h3" ? "h3" : "ltx",
      engineManual: data.engineManual === true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(storage: Pick<Storage, "setItem"> | null, prefs: StudioPrefs): void {
  try { storage?.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
}
