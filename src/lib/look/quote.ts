// Unmeasured anime steps stay hypotheses. A figure is always « estimated ».
// The illustrated 3-shot film on the Look page is 13 + 3 × 19 = 70 (spec §3).

import type { Locale } from "../i18n/config.ts";

export type CoutNature = "mesure" | "hypothese";

export interface CoutEstime {
  credits: number;
  high: number;
  nature: CoutNature;
  estimated: true;
}

const row = (credits: number, high: number, nature: CoutNature): CoutEstime => ({ credits, high, nature, estimated: true });

/** Krea 2 style frame. Hypothesis, near Klein T2I (measured 3.49). */
export const COUT_CADRE = row(3, 5, "hypothese");
/** Qwen Image 2.1 edit sheet. Hypothesis; Qwen T2I was measured at 3.00. */
export const COUT_PLANCHE = row(4, 6, "hypothese");
/** Painted background. Hypothesis. */
export const COUT_DECOR = row(3, 5, "hypothese");
/** First frame. Hypothesis; Klein first frames were measured between 4.75 and 7.68. */
export const COUT_PREMIERE = row(4, 8, "hypothese");
/** Wan 2.2 + AniSora, 5 s. Hypothesis, range 10–17 from the measured Wan 2.2 job (8.44). */
export const COUT_JEU = row(12, 17, "hypothese");
/** LTX-2.5 i2v, 5 s, first frame included. Measured 15.10. */
export const COUT_CAMERA = row(15, 23, "mesure");
/** Real-ESRGAN anime, 5 s, never a regeneration. Hypothesis. */
export const COUT_FINITION = row(3, 5, "hypothese");
/** Color match on the way out. Short, folded into the finish figure on the page. */
export const COUT_COULEUR = row(0, 1, "hypothese");

/** First frame + acting + finish, the per-shot figure on the page. */
export const COUT_PLAN_JEU = row(COUT_PREMIERE.credits + COUT_JEU.credits + COUT_FINITION.credits, COUT_PREMIERE.high + COUT_JEU.high + COUT_FINITION.high, "hypothese");
/** LTX already includes its first frame (measured). Finish stays an estimate, so the shot does too. */
export const COUT_PLAN_CAMERA = row(COUT_CAMERA.credits + COUT_FINITION.credits, COUT_CAMERA.high + COUT_FINITION.high, "hypothese");

/** Shots step on the page: first frame + animation, before finish. */
export const COUT_PLANS_PAGE = row(16, 25, "hypothese");

export const EXEMPLE_PREPA = 13;
export const EXEMPLE_PLAN = 19;
export const EXEMPLE_FILM = 70;

const LABELS: Record<Locale, (n: number) => string> = {
  en: n => `≈ ${n} credits estimated`,
  fr: n => `≈ ${n} crédits estimés`,
  de: n => `≈ ${n} Credits geschätzt`,
  es: n => `≈ ${n} créditos estimados`,
};

/** The only price line a button may show. Never « free ». */
export function libelleEstime(locale: Locale, credits: number): string {
  return LABELS[locale](credits);
}

export function additionner(rows: readonly CoutEstime[]): CoutEstime {
  const credits = rows.reduce((sum, item) => sum + item.credits, 0);
  const high = rows.reduce((sum, item) => sum + item.high, 0);
  const nature: CoutNature = rows.every(item => item.nature === "mesure") && rows.length > 0 ? "mesure" : "hypothese";
  return row(credits, high, nature);
}

/** 1 style frame + sheets + painted places. The bible's 1 + 1 + 2 is 13. */
export function devisPreparation(sheets: number, places: number): CoutEstime {
  return additionner([
    COUT_CADRE,
    ...Array.from({ length: Math.max(0, sheets) }, () => COUT_PLANCHE),
    ...Array.from({ length: Math.max(0, places) }, () => COUT_DECOR),
  ]);
}

export function devisPlan(route: "acting" | "camera"): CoutEstime {
  return route === "camera" ? COUT_PLAN_CAMERA : COUT_PLAN_JEU;
}

export function devisFilm(routes: readonly ("acting" | "camera")[], sheets: number, places: number): CoutEstime {
  return additionner([devisPreparation(sheets, places), ...routes.map(devisPlan)]);
}
