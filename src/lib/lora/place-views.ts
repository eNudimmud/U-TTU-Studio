// The place word and the view count. The first screens read these.
// The trainer, the ZIP and the fal client stay in place.ts.

import { PLACE_SHOTS_MAX, PLACE_SHOTS_MIN } from "./place-numbers.ts";

/** Distinct from a character trigger, so a prompt cannot mix the two by accident. */
export function placeTrigger(name: string): string {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return `${base || "lieu"}_lieu`;
}

/** Stills, filmed frames, then extra views. Duplicates drop. The trainer sees at most sixteen. */
export function placeShotList(input: { stills: readonly string[]; frames: readonly string[]; views: readonly string[] }): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const path of [...input.stills, ...input.frames, ...input.views]) {
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push(path);
    if (out.length >= PLACE_SHOTS_MAX) break;
  }
  return out;
}

export function placeShotLine(count: number): { ready: boolean; line: string } {
  if (count < PLACE_SHOTS_MIN) {
    const missing = PLACE_SHOTS_MIN - count;
    return { ready: false, line: `${PLACE_SHOTS_MIN} vues au moins. Il en manque ${missing}.` };
  }
  return { ready: true, line: `${count} vues. Le fichier apprend ce lieu, pas une personne.` };
}
