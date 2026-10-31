// Model choices kept on this device. Nothing here spends or reaches a network.
// Open Weights Only hides every gesture that runs a partner (paid API) node.
// Nano Banana stays an option, off by default: FLUX 3 is the image engine.

import type { TakeEngine } from "./render/take-graph.ts";
import type { FiltreGestes } from "./workflows/registre.ts";

export interface StudioPrefs {
  openWeightsOnly: boolean;
  nanoBanana: boolean;
  engine: TakeEngine;
  /** True once the engine was picked by hand in Avancé; otherwise PRISE chooses from the intention. */
  engineManual: boolean;
  /** Account setting (film2): « Utiliser aussi des services partenaires payants ». Off by default. */
  partenaires: boolean;
}

export const PREFS_KEY = "u-ttu-moteurs";
export const DEFAULT_PREFS: StudioPrefs = { openWeightsOnly: false, nanoBanana: false, engine: "ltx", engineManual: false, partenaires: false };

export function readPrefs(storage: Pick<Storage, "getItem"> | null): StudioPrefs {
  try {
    const data = JSON.parse(storage?.getItem(PREFS_KEY) ?? "null") as Partial<StudioPrefs> | null;
    if (!data || typeof data !== "object") return { ...DEFAULT_PREFS };
    return {
      openWeightsOnly: data.openWeightsOnly === true,
      nanoBanana: data.nanoBanana === true,
      engine: data.engine === "h3" ? "h3" : "ltx",
      engineManual: data.engineManual === true,
      partenaires: data.partenaires === true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(storage: Pick<Storage, "setItem"> | null, prefs: StudioPrefs): void {
  try { storage?.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
}

/** film2: the account setting decides. Paid partner services stay off until the visitor says yes. */
export function prefsFilm2(prefs: StudioPrefs): StudioPrefs {
  return { ...prefs, openWeightsOnly: !prefs.partenaires, nanoBanana: prefs.partenaires && prefs.nanoBanana };
}

/**
 * What the tool catalogue (Outils, rail, search, home count) filters on: only the explicit
 * « Open weights only » / « Nano Banana » choices kept on this device. The film2 account switch
 * « services partenaires » drives FILM's own choices and never shrinks the catalogue: before this,
 * the rail read 44 on the first paint, then 33 once the film2 flag was read (11 partner tools hidden).
 * Every partner tool still shows its « ≈ X crédits estimés » and asks before spending.
 */
export function filtreOutils(prefs: Pick<StudioPrefs, "openWeightsOnly" | "nanoBanana">): FiltreGestes {
  return { openWeightsOnly: prefs.openWeightsOnly, nanoBanana: prefs.nanoBanana };
}

/** What the session derives from the stored prefs: the generation prefs (film2 forces open weights
 *  unless partner models are on) and the catalogue filter, which never depends on film2. */
export function prefsSession(stored: StudioPrefs, film2: boolean): { prefs: StudioPrefs; outilsFiltre: FiltreGestes } {
  return { prefs: film2 ? prefsFilm2(stored) : stored, outilsFiltre: filtreOutils(stored) };
}
