// A playable cut from the stills already in public/exemples, plus two synthesized tones.
// It does not require an account and it is not written until the visitor changes it.

import { EXEMPLES } from "../creation/exemples.ts";
import type { Edit } from "./edit.ts";

export const EXEMPLE_ID = "exemple";
export const EXEMPLE_VOICE_SECONDS = 2.4;
export const EXEMPLE_MUSIC_SECONDS = 7;
export const EXEMPLE_VOICE = "/exemples/voix-exemple.wav";
export const EXEMPLE_MUSIC = "/exemples/musique-exemple.wav";

function still(id: string): string {
  return EXEMPLES.find(item => item.id === id)?.file ?? "";
}

function title(id: string): string {
  return EXEMPLES.find(item => item.id === id)?.title ?? id;
}

/** Three décor stills, a voice tone, a music bed. Holds are chosen here, not read from the pictures. */
export function exempleEdit(): Edit {
  const plans: { id: string; seconds: number }[] = [
    { id: "decor-quai-nuit", seconds: 2.5 },
    { id: "decor-rue-pluie", seconds: 2.5 },
    { id: "decor-piece", seconds: 2 },
  ];
  return {
    id: EXEMPLE_ID,
    name: "Exemple",
    video: plans.map(plan => ({
      id: `plan-${plan.id}`,
      kind: "image" as const,
      source: still(plan.id),
      label: title(plan.id),
      media: plan.seconds,
      start: 0,
      end: plan.seconds,
      takeId: null,
    })),
    audio: [
      {
        id: "voix-exemple",
        track: "voix",
        source: EXEMPLE_VOICE,
        label: "Voix d’exemple",
        media: EXEMPLE_VOICE_SECONDS,
        start: 0,
        end: EXEMPLE_VOICE_SECONDS,
        at: 0.6,
        volume: 0.9,
        fadeIn: 0.15,
        fadeOut: 0.3,
      },
      {
        id: "musique-exemple",
        track: "musique",
        source: EXEMPLE_MUSIC,
        label: "Musique d’exemple",
        media: EXEMPLE_MUSIC_SECONDS,
        start: 0,
        end: EXEMPLE_MUSIC_SECONDS,
        at: 0,
        volume: 0.35,
        fadeIn: 0.4,
        fadeOut: 0.8,
      },
    ],
  };
}
