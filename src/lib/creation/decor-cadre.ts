// « Décor depuis un lieu » : the kept 3D frame is image 1 (camera, composition, volumes).
// The direct path needs nothing else: the place and what the frame shows (contexte.ts) go in the prompt.
// Zero to three reference photos can follow as images 2–4 (materials, colours, light). One Klein edit pass.
// Pure: no network, no storage. The graph itself is built by still.ts (kind "cadre-decor").

import { KLEIN_REFS_MAX } from "../render/klein-graph.ts";

/** Reference photos next to the frame. Klein takes four images in the studio pipeline: 1 frame + 3 photos. */
export const CADRE_PHOTOS_MAX = KLEIN_REFS_MAX - 1;

export type CadreAmbiance = "photos" | "nuit" | "pluie" | "aube";
export const CADRE_AMBIANCES: readonly CadreAmbiance[] = ["photos", "nuit", "pluie", "aube"];

export interface CadreQuote {
  /** Estimate shown on the button, in Comfy credits. */
  credits: number;
  /** Ceiling checked against the balance before anything runs. */
  high: number;
  template: "image_flux3_klein_image_edit";
}

/**
 * Klein edit measured at 2.6–4 cr. for one reference (docs/WORKFLOWS.md): the frame alone is ≈ 4, cap 6.
 * Each reference photo adds encoder and latent work: about one more credit, same 2-credit margin.
 */
export function cadreQuote(photos: number): CadreQuote | null {
  if (!Number.isInteger(photos) || photos < 0 || photos > CADRE_PHOTOS_MAX) return null;
  return { credits: 4 + photos, high: 6 + photos, template: "image_flux3_klein_image_edit" };
}

const AMBIANCE: Record<CadreAmbiance, string> = {
  photos: "Keep the time of day and weather of the reference photos.",
  // Shown as « Lumière du jour » when there is no photo.
  nuit: "Night: street lights and lit windows, dark sky.",
  pluie: "Rain: wet ground with reflections, overcast sky.",
  aube: "Dawn: low warm light, long soft shadows.",
};

/** The text sent with the images. English for the model; the visitor's detail is appended as is. */
export function cadrePrompt(input: { photos: number; ambiance: CadreAmbiance; detail?: string; contexte?: readonly string[] }): string {
  const count = Math.max(0, Math.min(CADRE_PHOTOS_MAX, Math.floor(input.photos)));
  const refs = count === 1 ? "image 2" : `images 2 to ${count + 1}`;
  const detail = (input.detail ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
  const ambiance = input.ambiance === "photos" && count === 0 ? "Natural daylight, as on an ordinary clear day there." : AMBIANCE[input.ambiance] ?? AMBIANCE.photos;
  return [
    "Image 1 is a 3D frame of a real place: keep its exact camera position, eye level, angle, lens, composition and building volumes.",
    count === 0
      ? "Turn the plain volumes into the real façades, streets, ground and vegetation of this place."
      : `Take the materials, colours, textures and light from ${refs}, photos of the same place.`,
    ...(input.contexte ?? []).map(line => line.replace(/\s+/g, " ").trim().slice(0, 320)).filter(Boolean).slice(0, 5),
    "Photorealistic cinema still, 16:9. No people. No text, no letters, no signs with words.",
    ambiance,
    detail,
  ].filter(Boolean).join("\n");
}
