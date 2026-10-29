// « Décor depuis un lieu » : la vue 3D garde la géométrie, les photos donnent l'apparence.
// Structure : profondeur de la vue 3D (Lotus) → FLUX.1 dev + LoRA depth, active à chaque pas.
// Apparence : photos du lieu → FLUX Redux (StyleModelApply), jamais dans le latent ni comme cadre.
// L'ancien chemin InstantX (vue seule, photos dans le texte) reste pour les reçus « depth-control ».
// Pure: no network, no storage. The graph itself is built by still.ts (kind "cadre-decor").

import { DECOR_3D_TEMPLATE } from "../render/decor-3d.ts";
import { INSTANTX_CADRE_TEMPLATE } from "../render/instantx-cadre.ts";

/** Photos du lieu (apparence seulement, via Redux). */
export const CADRE_PHOTOS_MAX = 3;
export type CadreAmbiance = "photos" | "nuit" | "pluie" | "aube";
export const CADRE_AMBIANCES: readonly CadreAmbiance[] = ["photos", "nuit", "pluie", "aube"];

/**
 * How the kept 3D view is conditioned.
 * `structure-style` (current): 3D depth as structure, photos as style (decor-3d.ts).
 * `depth-control`: former InstantX + Lotus on the frame alone. Other aliases are legacy.
 */
export type CadreLayout = "structure-style" | "depth-control" | "frame-first" | "photo-lines";

export interface CadreQuote {
  /** Estimate shown on the button, in Comfy credits. */
  credits: number;
  /** Ceiling checked against the balance before anything runs. */
  high: number;
  template: typeof DECOR_3D_TEMPLATE | typeof INSTANTX_CADRE_TEMPLATE;
}

/**
 * FLUX depth + Redux mesuré sur Comfy Cloud (docs/mesures/decor-3d-2026-10-29.md) :
 * 35,4 gpu_s pour 5 rendus à froid (9,67 crédits), ≈ 1 crédit par rendu à chaud.
 * Un rendu seul à froid ≈ 21 gpu_s ≈ 5,7 crédits. Une photo ajoute un encodage CLIP Vision
 * (moins d'une seconde) : devis plat ≈ 6, plafond 9.
 */
export function cadreQuote(photos: number): CadreQuote | null {
  if (!Number.isInteger(photos) || photos < 0 || photos > CADRE_PHOTOS_MAX) return null;
  return { credits: 6, high: 9, template: DECOR_3D_TEMPLATE };
}

const AMBIANCE: Record<CadreAmbiance, string> = {
  photos: "Match the time of day and weather of an ordinary day at this place.",
  nuit: "Night: street lights and lit windows, dark sky.",
  pluie: "Rain: wet ground with reflections, overcast sky.",
  aube: "Dawn: low warm light, long soft shadows.",
};

/** Longest visitor wish kept in the prompt (the field allows the same). */
export const CADRE_DETAIL_MAX = 240;

/** Negative text, kept on the graph for the record (no effect at cfg 1). */
export { DECOR_3D_NEGATIVE as CADRE_NEGATIVE } from "../render/decor-3d.ts";

/**
 * Text for FLUX (English). Descriptive only: the geometry comes from the 3D depth, the look
 * from the photos (Redux). No instruction about "images", nothing the model could draw as text.
 */
export function cadrePrompt(input: {
  photos: number;
  ambiance: CadreAmbiance;
  detail?: string;
  contexte?: readonly string[];
  layout?: CadreLayout;
}): string {
  const count = Math.max(0, Math.min(CADRE_PHOTOS_MAX, Math.floor(input.photos)));
  const detail = (input.detail ?? "").replace(/\s+/g, " ").replace(/"/g, "'").trim().slice(0, CADRE_DETAIL_MAX);
  const ambiance = input.ambiance === "photos"
    ? detail ? "" : count === 0 ? "Natural daylight, as on an ordinary clear day there." : AMBIANCE.photos
    : AMBIANCE[input.ambiance] ?? AMBIANCE.photos;
  const contexte = (input.contexte ?? []).map(line => line.replace(/\s+/g, " ").trim().slice(0, 320)).filter(Boolean).slice(0, 5);
  return [
    "Photorealistic photograph of this real place, natural light, real camera, 16:9.",
    "Real buildings with readable windows, doors, cornices, gutters and weathered materials; real paving, vegetation and sky.",
    count > 0 ? "Materials, colours and light as in the reference photos of this place." : "",
    ...contexte,
    ambiance,
    detail ? `${detail}.` : "",
    "Empty of people. No text, no signs with words, no 3D render look, no clay, no low-poly, no checkerboard façades.",
  ].filter(Boolean).join("\n");
}

/**
 * Build the image list for a cadre-decor run: the colour frame first (structure, depth
 * re-estimated by Lotus), then the photos (style only). Lines are not sent.
 */
export function cadreImages(input: {
  frame: File;
  lines?: File | null;
  photos: readonly File[];
}): { files: File[]; layout: CadreLayout; photos: number } {
  const photos = input.photos.slice(0, CADRE_PHOTOS_MAX);
  return { files: [input.frame, ...photos], layout: "structure-style", photos: photos.length };
}
