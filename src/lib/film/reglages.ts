// Refonte FILM · PR 7 — « Réglages du plan » in plain words. Each choice names its effect; the studio
// picks the engine. Rendu « Plus fidèle à mes références » is the default (H3, decision 1), « Rapide »
// is the cheap try (LTX aperçu, enhanced later, never re-rendered). Engine names only reach « Ce qui
// sera envoyé ». A duration with no quote for the chosen rendu is not offered: no price, no spend.

import type { Camera, Format, Paroles, Rendu } from "./registre.ts";
import { DEFAULT_TAKE, TAKE_SECONDS, type TakeSeconds, type TakeSettings } from "../render/take-graph.ts";

export interface ReglagesFilm {
  duree: TakeSeconds;
  format: Format;
  /** null: what the sentence says (or nothing). */
  camera: Camera | null;
  paroles: Paroles;
  /** The line said, or the voice-over text. */
  texte: string;
  rendu: Rendu;
}

export const REGLAGES_FILM: ReglagesFilm = { duree: 5, format: "paysage", camera: null, paroles: "aucune", texte: "", rendu: "fidele" };
export const REGLAGES_KEY = "u-ttu-film2-reglages";
export const DUREES: readonly TakeSeconds[] = TAKE_SECONDS;
export const CAMERAS: readonly Camera[] = ["fixe", "suit", "approche", "autour"];
export const PAROLES: readonly Paroles[] = ["aucune", "replique", "voixoff"];
export const RENDUS: readonly Rendu[] = ["rapide", "fidele"];

export function reglagesVersTake(reglages: Pick<ReglagesFilm, "duree" | "format" | "rendu">): TakeSettings {
  const aspect = reglages.format === "portrait" ? "vertical" : "horizontal";
  return reglages.rendu === "rapide"
    ? { ...DEFAULT_TAKE, engine: "ltx", rendu: "apercu", seconds: reglages.duree, aspect }
    : { ...DEFAULT_TAKE, engine: "h3", seconds: reglages.duree, aspect };
}

const CAMERA_EN: Record<Camera, string> = {
  fixe: "Static camera, it does not move.",
  suit: "The camera follows the character.",
  approche: "The camera slowly moves closer to the subject.",
  autour: "The camera slowly circles around the subject.",
};

/** The sentence sent for the take: the visitor's words, then the camera and the words said. */
export function ligneDuPlan(phrase: string, reglages: Pick<ReglagesFilm, "camera" | "paroles" | "texte">): string {
  const parts = [phrase.trim()];
  if (reglages.camera) parts.push(CAMERA_EN[reglages.camera]);
  const texte = reglages.texte.trim().replace(/"/g, "'").slice(0, 160);
  if (reglages.paroles === "replique" && texte) parts.push(`The character says: "${texte}"`);
  if (reglages.paroles === "voixoff" && texte) parts.push(`Voice-over: "${texte}"`);
  return parts.filter(Boolean).join(" ");
}

/** The settings with a quote: a duration missing a price for this rendu falls back to the closest priced one. */
export function reglagesChiffres(reglages: ReglagesFilm, prix: (settings: TakeSettings) => number | null): ReglagesFilm {
  if (prix(reglagesVersTake(reglages)) !== null) return reglages;
  const priced = DUREES.filter(duree => prix(reglagesVersTake({ ...reglages, duree })) !== null);
  if (!priced.length) return reglages;
  const duree = priced.reduce((best, item) => Math.abs(item - reglages.duree) < Math.abs(best - reglages.duree) ? item : best, priced[0]!);
  return { ...reglages, duree };
}

export function lireReglages(raw: string | null | undefined): ReglagesFilm {
  try {
    const data = JSON.parse(raw ?? "null") as Partial<ReglagesFilm> | null;
    if (!data || typeof data !== "object") return { ...REGLAGES_FILM };
    return {
      duree: DUREES.includes(data.duree as TakeSeconds) ? data.duree as TakeSeconds : REGLAGES_FILM.duree,
      format: data.format === "portrait" ? "portrait" : "paysage",
      camera: CAMERAS.includes(data.camera as Camera) ? data.camera as Camera : null,
      paroles: PAROLES.includes(data.paroles as Paroles) ? data.paroles as Paroles : "aucune",
      texte: typeof data.texte === "string" ? data.texte.slice(0, 160) : "",
      rendu: data.rendu === "rapide" ? "rapide" : "fidele",
    };
  } catch {
    return { ...REGLAGES_FILM };
  }
}
