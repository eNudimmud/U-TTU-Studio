// « Décor depuis un lieu » : one Klein edit pass.
// With street photos, image order is photo-first (style) + edge map (structure) + more photos —
// Klein locks appearance to image 1; a grey 3D canvas stays clay, a photo canvas goes photoreal.
// Without photos, image 1 is the kept colour frame (massing) and the prompt asks for a full transform.
// Pure: no network, no storage. The graph itself is built by still.ts (kind "cadre-decor").

import { KLEIN_REFS_MAX } from "../render/klein-graph.ts";

/** Reference photos next to the structure guide. Klein takes four images: style/structure + photos. */
export const CADRE_PHOTOS_MAX = KLEIN_REFS_MAX - 1;

export type CadreAmbiance = "photos" | "nuit" | "pluie" | "aube";
export const CADRE_AMBIANCES: readonly CadreAmbiance[] = ["photos", "nuit", "pluie", "aube"];

/** How the kept 3D view is conditioned into Klein. */
export type CadreLayout = "frame-first" | "photo-lines";

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
  photos: "Match the time of day and weather visible in the reference photos.",
  // Shown as « Lumière du jour » when there is no photo.
  nuit: "Night: street lights and lit windows, dark sky.",
  pluie: "Rain: wet ground with reflections, overcast sky.",
  aube: "Dawn: low warm light, long soft shadows.",
};

/** Longest visitor wish kept in the prompt (the field allows the same). */
export const CADRE_DETAIL_MAX = 240;

const NO_WATER = "Do not invent a lake, sea or open water unless the structure guide clearly frames one.";

/**
 * The text sent with the images (Klein edit, upsampler off: this is exactly what the encoder reads).
 * English for the model.
 *
 * `layout: "photo-lines"` (photos ≥ 1 + edge map): image 1 = street photo (photoreal canvas),
 * image 2 = black-and-white edges of the 3D view (structure only), images 3+ = more photos.
 * `layout: "frame-first"` (default / no photos): image 1 = grey 3D massing as structure; photos 2–N.
 */
export function cadrePrompt(input: {
  photos: number;
  ambiance: CadreAmbiance;
  detail?: string;
  contexte?: readonly string[];
  layout?: CadreLayout;
}): string {
  const count = Math.max(0, Math.min(CADRE_PHOTOS_MAX, Math.floor(input.photos)));
  const layout: CadreLayout = input.layout === "photo-lines" && count >= 1 ? "photo-lines" : "frame-first";
  const detail = (input.detail ?? "").replace(/\s+/g, " ").replace(/"/g, "'").trim().slice(0, CADRE_DETAIL_MAX);
  const ambiance = input.ambiance === "photos"
    ? detail ? "" : count === 0 ? "Natural daylight, as on an ordinary clear day there." : AMBIANCE.photos
    : AMBIANCE[input.ambiance] ?? AMBIANCE.photos;
  const contexte = (input.contexte ?? []).map(line => line.replace(/\s+/g, " ").trim().slice(0, 320)).filter(Boolean).slice(0, 5);

  if (layout === "photo-lines") {
    // image 1 = style photo, image 2 = edges, images 3.. = more photos (count photos total).
    const styleRefs = count === 1
      ? "image 1"
      : count === 2
        ? "image 1 and image 3"
        : `image 1 and images 3 to ${count + 1}`;
    return [
      "Create a full-color outdoor photograph of this real place.",
      "Take the exact camera position, eye level, angle, composition and building silhouettes from image 2 — a black-and-white edge drawing of the 3D view (structure guide only).",
      `Take all materials, colours, textures, weathering, sky and light from ${styleRefs} (street photos of the same place).`,
      "Image 2 must not appear as lines or as a grey 3D model in the result: rebuild every surface as real stone, roof tiles, windows, paving and vegetation.",
      NO_WATER,
      ...contexte,
      "Full-color outdoor photograph, 16:9, empty of people. No text, no letters, no signs with words, no low-poly, no clay, no untextured massing, no metallic CG look.",
      ambiance,
      ...(detail ? [
        `The visitor's wish, in their own words: "${detail}".`,
        `Apply it to the mood, season, time of day, weather, materials and added elements; where it differs from ${styleRefs}, the wish wins.`,
        "Whatever the wish says, image 2's camera, framing and building layout stay exactly the same, with no people and no text, and the result must still look like a real photograph.",
      ] : []),
    ].filter(Boolean).join("\n");
  }

  const refs = count === 1 ? "image 2" : count === 2 ? "images 2 and 3" : `images 2 to ${count + 1}`;
  const style = count === 0
    ? "Invent plausible real façades, streets, ground, roofs, windows, vegetation and sky for this place — never leave flat grey, clay, plastic or low-poly surfaces."
    : `Take every material, colour, texture, weathering and light from ${refs} (street photos of the same place). Do not invent a different look when those photos already show one.`;
  return [
    "Convert the entire image 1 into a real photograph of this place.",
    "Image 1 is a grey untextured 3D massing / clay render: use it as structure only (camera position, eye level, angle, lens, composition and building layout), like a depth or canny guide — discard its flat grey look completely.",
    "Completely replace every flat grey roof, wall and ground with real materials, windows, roof tiles, paving and vegetation so the result looks like a photograph taken on site, not a tinted 3D model.",
    style,
    NO_WATER,
    ...contexte,
    "Full-color outdoor photograph, 16:9, empty of people. No text, no letters, no signs with words, no 3D-render look, no low-poly, no clay, no untextured massing.",
    ambiance,
    ...(detail ? [
      `The visitor's wish, in their own words: "${detail}".`,
      count === 0
        ? "Apply it to the mood, season, time of day, weather, materials and added elements."
        : `Apply it to the mood, season, time of day, weather, materials and added elements; where it differs from ${refs}, the wish wins.`,
      "Whatever the wish says, image 1's camera, framing and building layout stay exactly the same, with no people and no text, and the grey massing look must still be fully replaced by a real photograph.",
    ] : []),
  ].filter(Boolean).join("\n");
}

/**
 * Build the Klein image list for a cadre-decor run.
 * With photos + lines: [photo0, lines, ...photos.slice(1)] (max 4) — photoreal canvas + structure.
 * Otherwise: [frame, ...photos] (max 4).
 */
export function cadreImages(input: {
  frame: File;
  lines?: File | null;
  photos: readonly File[];
}): { files: File[]; layout: CadreLayout; photos: number } {
  const photos = input.photos.slice(0, CADRE_PHOTOS_MAX);
  if (photos.length >= 1 && input.lines) {
    const rest = photos.slice(1);
    const files = [photos[0]!, input.lines, ...rest].slice(0, KLEIN_REFS_MAX);
    return { files, layout: "photo-lines", photos: photos.length };
  }
  return { files: [input.frame, ...photos].slice(0, KLEIN_REFS_MAX), layout: "frame-first", photos: photos.length };
}
