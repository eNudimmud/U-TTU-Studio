// The filmed shot. Blender renders the empty place along the camera path.
// The adherent's LoRA is the person, and it enters only when this shot is
// submitted. A volume in the .blend is never called the character.

import type { RunGate } from "../credits.ts";
import { LORA_TAKE, formatUsd, type LoraResolution } from "../fal/prices.ts";
import { loraTakeRequest } from "../lora/take-request.ts";
import type { TrainingAspect } from "../lora/dataset.ts";
import type { FilmQuote } from "./farpy.ts";

export const SHOT_SECONDS = 5;
export const SHOT_RESOLUTION: LoraResolution = "768P";
export const SHOT_ASPECT: TrainingAspect = "9:16";
export const SHOT_LINE = "La caméra parcourt le lieu.";

export type FilmKind = "place" | "plan" | "blender" | "role" | "fal" | "film";

/** What the one gold action does, from what is still missing on this screen. The button stays a jump, never a silent stop. */
export function filmAction(input: { scene: boolean; plan: boolean; blender: boolean; character: boolean; fal: boolean }): { kind: FilmKind; label: string; missing: string } {
  if (!input.scene) return { kind: "place", label: "Poser un lieu", missing: "Il manque un lieu. Nomme-le, puis choisis un espace." };
  if (!input.plan) return { kind: "plan", label: "Choisir un espace", missing: "Il manque un espace. Pièce, Quai ou Rue." };
  if (!input.blender) return { kind: "blender", label: "Relier Blender", missing: "Il manque la clé Blender, sur cet appareil." };
  if (!input.character) return { kind: "role", label: "Former le personnage", missing: "Il manque un personnage formé." };
  if (!input.fal) return { kind: "fal", label: "Relier le compte fal", missing: "Il manque le compte fal. Il paie le personnage dans le trajet." };
  return { kind: "film", label: "Filmer ce trajet", missing: "" };
}

function clip(value: string, max: number): string {
  return value.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().replace(/[.!?…]+$/, "").slice(0, max);
}

/** The person is the LoRA. The images are the place, from the moving camera, and they do not contain the person. */
export function shotPrompt(input: { subject: string; place: string; note: string; frames: number; line: string }): string {
  const frames = Math.max(1, Math.floor(input.frames));
  const subject = clip(input.subject, 60);
  const place = clip(input.place, 80);
  const who = subject ? `${subject} is the person.` : "The trained person is the person.";
  const lines = [
    `${who} Keep the same person for the whole shot. The person is not drawn in the place images.`,
    `Image 1 to Image ${frames} show the place${place ? `, ${place}` : ""}. The camera moves from Image 1 to Image ${frames}. Follow that camera through the place.`,
  ];
  const note = clip(input.note, 280);
  if (note) lines.push(`The place holds: ${note}.`);
  const shot = clip(input.line, 240);
  if (shot) lines.push(`The shot: ${shot}.`);
  return lines.join(" ").slice(0, 1600);
}

export function shotRequest(input: { prompt: string; imageUrls: readonly string[]; loraUrl: string; seed: number }): Record<string, unknown> {
  return loraTakeRequest({
    prompt: input.prompt,
    imageUrls: input.imageUrls,
    loraUrl: input.loraUrl,
    seconds: SHOT_SECONDS,
    aspect: SHOT_ASPECT,
    resolution: SHOT_RESOLUTION,
    seed: input.seed,
  });
}

/** Both prices, or only the character once Blender has already returned this path. No number is filled in. */
export function shotGate(input: { blender: FilmQuote | null; characterUsd: number | null; trajetReady: boolean }): RunGate {
  const characterOk = input.characterUsd !== null && Number.isFinite(input.characterUsd) && input.characterUsd >= 0;
  if (input.trajetReady) {
    if (!characterOk || input.characterUsd === null) return { allowed: false, tone: "block", line: "Le prix du personnage n’est pas lu. Rien ne part." };
    return { allowed: true, tone: "warn", line: `Le trajet est déjà rendu. Le personnage : ${formatUsd(input.characterUsd)}.` };
  }
  const blender = input.blender;
  if (!blender?.quoteId || !blender.uploadId || !Number.isFinite(blender.priceCents) || blender.priceCents < 0 || !characterOk || input.characterUsd === null) {
    return { allowed: false, tone: "block", line: "Les deux prix ne sont pas lus. Rien ne part." };
  }
  const images = blender.frameCount === 1 ? "1 image" : `${blender.frameCount} images`;
  return {
    allowed: true,
    tone: "warn",
    line: `Blender : ${formatUsd(blender.priceCents / 100)} pour ${images} du trajet. Personnage : ${formatUsd(input.characterUsd)}.`,
  };
}

export const SHOT_ENDPOINT = LORA_TAKE;
