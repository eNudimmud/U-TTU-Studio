// « Élargir » (image and video): the visitor picks the frame the result must have. The new area is
// outpainted by the model; nothing is stretched or cropped away. Pure: no network, no storage.

/** Target frames, as width:height. */
export const CADRES = ["16:9", "9:16", "1:1", "4:3"] as const;
export type Cadre = (typeof CADRES)[number];

/** Frames the video outpainting offers (LTX-2.3 outpaint LoRA). */
export const CADRES_VIDEO = ["16:9", "9:16", "1:1"] as const satisfies readonly Cadre[];

export function isCadre(value: unknown): value is Cadre {
  return typeof value === "string" && (CADRES as readonly string[]).includes(value);
}

/** Width and height of the ratio, as integers (16:9 → [16, 9]). */
export function cadreParts(cadre: Cadre): [number, number] {
  const [w, h] = cadre.split(":").map(Number);
  return [w, h];
}

export function cadreRatio(cadre: Cadre): number {
  const [w, h] = cadreParts(cadre);
  return w / h;
}

/**
 * The frame a visitor most likely wants: a portrait or square source goes 16:9, a source that is
 * already 16:9 or wider goes 9:16. Unknown size: 16:9.
 */
export function cadreDefaut(source?: { width: number; height: number } | null, offerts: readonly Cadre[] = CADRES): Cadre {
  const ok = source && source.width > 0 && source.height > 0;
  const pick: Cadre = ok && source.width / source.height >= cadreRatio("16:9") - 0.01 ? "9:16" : "16:9";
  return offerts.includes(pick) ? pick : offerts[0];
}

/**
 * Pixels to add on each side so the picture reaches the frame exactly, centred, never cropped.
 * Mirrors the math nodes the graph runs on Comfy (the source size is only known there).
 */
export function padsVersCadre(source: { width: number; height: number }, cadre: Cadre): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
  const r = cadreRatio(cadre);
  const width = Math.max(source.width, Math.trunc(source.height * r));
  const height = Math.max(source.height, Math.trunc(source.width / r));
  const left = Math.trunc((width - source.width) / 2);
  const top = Math.trunc((height - source.height) / 2);
  return { left, top, right: width - source.width - left, bottom: height - source.height - top, width, height };
}

/**
 * Video outpainting sizes. `rendu` is what LTX renders (multiples of 32, ≈ 720p class);
 * `sortie` is the saved file, exactly the chosen frame.
 */
export const VIDEO_CADRE_TAILLE: Record<(typeof CADRES_VIDEO)[number], { rendu: { width: number; height: number }; sortie: { width: number; height: number } }> = {
  "16:9": { rendu: { width: 1280, height: 704 }, sortie: { width: 1280, height: 720 } },
  "9:16": { rendu: { width: 704, height: 1280 }, sortie: { width: 720, height: 1280 } },
  "1:1": { rendu: { width: 960, height: 960 }, sortie: { width: 960, height: 960 } },
};

export function videoCadre(cadre: Cadre | undefined): (typeof CADRES_VIDEO)[number] {
  return cadre && (CADRES_VIDEO as readonly string[]).includes(cadre) ? cadre as (typeof CADRES_VIDEO)[number] : "16:9";
}
