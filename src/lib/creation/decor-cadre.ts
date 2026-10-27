// « Décor depuis un lieu » : one InstantX + Lotus ControlNet pass.
// The kept 3D colour frame is the only image. Lotus estimates its depth; InstantX
// locks composition to that depth while Qwen Image fills photoreal materials.
// Street photos colour the prompt only in v1 (they do not enter the graph — feeding
// them as a second edit pass leaked people and drifted style in A/B).
// Pure: no network, no storage. The graph itself is built by still.ts (kind "cadre-decor").

import { INSTANTX_CADRE_TEMPLATE } from "../render/instantx-cadre.ts";

/** Street photos the visitor may pick (prompt / credit only — not wired into the graph). */
export const CADRE_PHOTOS_MAX = 3;

export type CadreAmbiance = "photos" | "nuit" | "pluie" | "aube";
export const CADRE_AMBIANCES: readonly CadreAmbiance[] = ["photos", "nuit", "pluie", "aube"];

/**
 * How the kept 3D view is conditioned.
 * `depth-control` (current): InstantX + Lotus on the colour frame alone.
 * Legacy aliases kept so older receipts / UI still type-check; they map to depth-control.
 */
export type CadreLayout = "depth-control" | "frame-first" | "photo-lines";

export interface CadreQuote {
  /** Estimate shown on the button, in Comfy credits. */
  credits: number;
  /** Ceiling checked against the balance before anything runs. */
  high: number;
  template: typeof INSTANTX_CADRE_TEMPLATE;
}

/**
 * InstantX + Lotus measured on Comfy Cloud (docs/test/reperage-depth/NOTES.md):
 * ≈ 3,8–4,3 crédits for the frame alone (13–16 gpu_s × 0.27325). Flat cost: photos
 * do not enter the graph. Quote ≈ 5, ceiling 8.
 */
export function cadreQuote(photos: number): CadreQuote | null {
  if (!Number.isInteger(photos) || photos < 0 || photos > CADRE_PHOTOS_MAX) return null;
  return { credits: 5, high: 8, template: INSTANTX_CADRE_TEMPLATE };
}

const AMBIANCE: Record<CadreAmbiance, string> = {
  photos: "Match the time of day and weather of an ordinary day at this place.",
  nuit: "Night: street lights and lit windows, dark sky.",
  pluie: "Rain: wet ground with reflections, overcast sky.",
  aube: "Dawn: low warm light, long soft shadows.",
};

/** Longest visitor wish kept in the prompt (the field allows the same). */
export const CADRE_DETAIL_MAX = 240;

const NO_WATER = "Do not invent a lake, sea or open water unless the structural guide clearly frames one.";

/** Negative CLIP text for InstantX cadre — keep geometry control in the positive prompt. */
export const CADRE_NEGATIVE = "blocky, voxel, maze, low-poly, clay render, untextured massing, checkerboard façades, abstract cubes, plastic CG, metallic CG, cartoon buildings";

/**
 * Text sent with the single 3D colour frame (InstantX ControlNet).
 * English for the model. Photos are never addressed as "image N" — they are not uploaded.
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

  const style = count === 0
    ? "Invent a continuous row of realistic street façades with distinct windows, cornices, gutters, doorways and weathered materials for this place — never leave flat grey, clay, plastic, blocky, voxel or low-poly surfaces."
    : [
      "Reference street photos inform STYLE ONLY: materials, colours, weathering, sky and light of this same place.",
      "Do NOT copy a photo's camera angle, framing, building count, skyline, lake, park layout or any geometry that is not in the structural guide.",
      "Dress each building as a continuous realistic façade row: readable windows, cornices, gutters, door frames and the materials seen in the photos — stone, brick, stucco, terracotta roof tiles, dormers, chimneys and paving — never a chaotic checkerboard of abstract blocks.",
    ].join(" ");

  return [
    "Photorealistic photograph of this real place, same exact camera position and composition as the structural guide.",
    "The input image is a grey untextured 3D massing / clay render: keep every building silhouette, roofline, vanishing point, relative size and ground plane exactly — like a depth guide — and discard its flat grey look completely.",
    "Completely replace every flat grey roof, wall and ground with real materials, windows, roof tiles, paving and vegetation so the result looks like a photograph taken on site, not a tinted 3D model.",
    "Never invent, merge or remove buildings; never turn a row of tall blocks into a single house; never add a lake, sea, skyline or park that the structural guide does not already frame.",
    style,
    NO_WATER,
    ...contexte,
    "Full-color outdoor photograph, 16:9, empty of people. No text, no letters, no signs with words, no 3D-render look, no low-poly, no clay, no untextured massing, no metallic CG look, no blocky voxel maze, no checkerboard of abstract cubes.",
    ambiance,
    ...(detail ? [
      `The visitor's wish, in their own words: "${detail}".`,
      "Apply it to the mood, season, time of day, weather, materials and added elements.",
      "Whatever the wish says, the structural guide's camera, framing and building layout stay exactly the same, with no people and no text, and the grey massing look must still be fully replaced by a real photograph.",
    ] : []),
  ].filter(Boolean).join("\n");
}

/**
 * Build the image list for a cadre-decor run.
 * Always just the colour frame (InstantX + Lotus). `photos` is kept for the quote
 * and the prompt; lines are ignored (depth is re-estimated by Lotus).
 */
export function cadreImages(input: {
  frame: File;
  lines?: File | null;
  photos: readonly File[];
}): { files: File[]; layout: CadreLayout; photos: number } {
  const photos = input.photos.slice(0, CADRE_PHOTOS_MAX);
  return { files: [input.frame], layout: "depth-control", photos: photos.length };
}
