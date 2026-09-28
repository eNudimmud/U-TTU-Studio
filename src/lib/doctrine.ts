// Canon before a costly burn. Stills stay open. The vault is not read.

import { FAL_VARY } from "./fal-stack.ts";
import { checkTrigger, parseInvariants } from "./gate/captions.ts";
import { GATE } from "./gate/rules.ts";
import { ANGLES } from "./gate/vocabulary.ts";
import { SPHERE_PRESETS } from "./studio-modes.ts";

export const LOOK_REF_MIN = FAL_VARY.minRefs;

export const DOCTRINE_CHECKS = [
  {
    id: "angles",
    label: "Angles du look",
    detail: "Au moins deux vues de la même personne. Face, trois-quarts, profil, dos : le burn lit ce qui est déjà là.",
  },
  {
    id: "trigger",
    label: "Mot d’appel",
    detail: "Un trigger valide. Il porte l’identité d’un état à l’autre.",
  },
  {
    id: "invariants",
    label: "Traits constants",
    detail: "Yeux, marques. Au moins deux, en anglais, hors des légendes.",
  },
  {
    id: "canon",
    label: "CANON.md",
    detail: "Le même texte vit dans le coffre. Cette page ne l’écrit pas.",
  },
] as const;

export type DoctrineCheckId = (typeof DOCTRINE_CHECKS)[number]["id"];

export const BURN_WARN = "Ne lance pas un long entraînement, ni un burn vidéo, tant que le look n’est pas tenu.";
export const LOOK_HELD_LINE = "Le look est tenu. Le burn cher peut partir.";
export const LOOK_OPEN_LINE = "Le look n’est pas tenu. Une image fixe peut partir. Le burn cher demande une confirmation.";
export const BURN_CONFIRM_LABEL = "Confirmer le burn";
export const BURN_HOLD_LABEL = "Tenir le look";
export const CHEAP_BEFORE = "Tester un prompt d’abord. Pas d’upscale, pas d’entraînement. Le cheap précède le cher.";
export const MUSIC_NOTE = "Pas de musique dans la génération. Elle se pose au montage.";

export const CONTINUITY_TIP = "Prolonger une image tient le lieu mieux qu’une régénération isolée.";
export const VIDEO_BURN_NOTE = "Le burn vidéo attend le look tenu. Ici, il reste Bientôt.";
export const SPATIAL_NOTE = "Qui est à gauche, qui est à droite. Le cadre ne le devine pas.";
export const SCENE_VAULT = "scenes/";

export const SCENE_ANGLE_REMINDER = ANGLES.map(angle => angle.label);

export interface CanonInput {
  refCount: number;
  trigger: string;
  invariants: string;
  canonNoted: boolean;
}

export interface CanonMark {
  id: DoctrineCheckId;
  label: string;
  detail: string;
  held: boolean;
}

export type BurnKind = "still" | "train" | "video";

export function canonChecklist(input: CanonInput): CanonMark[] {
  const held: Record<DoctrineCheckId, boolean> = {
    angles: input.refCount >= LOOK_REF_MIN,
    trigger: input.trigger.trim().length > 0 && checkTrigger(input.trigger) === null,
    invariants: parseInvariants(input.invariants).length >= GATE.minInvariants,
    canon: input.canonNoted,
  };
  return DOCTRINE_CHECKS.map(check => ({ ...check, held: held[check.id] }));
}

export function lookHeld(input: CanonInput): boolean {
  return canonChecklist(input).every(mark => mark.held);
}

/** Stills never wait on this gate. A costly burn waits only for an explicit confirm. */
export function burnNeedsConfirm(kind: BurnKind, held: boolean): boolean {
  if (kind === "still") return false;
  return !held;
}

export function admitBurn(kind: BurnKind, held: boolean, confirmed: boolean): boolean {
  if (!burnNeedsConfirm(kind, held)) return true;
  return confirmed;
}

export const SCENE_FICHES = SPHERE_PRESETS.map(preset => ({
  id: preset.id,
  title: preset.title,
  vault: SCENE_VAULT,
  angles: SCENE_ANGLE_REMINDER,
  spatial: SPATIAL_NOTE,
  video: VIDEO_BURN_NOTE,
})) as readonly {
  id: (typeof SPHERE_PRESETS)[number]["id"];
  title: string;
  vault: typeof SCENE_VAULT;
  angles: readonly string[];
  spatial: string;
  video: string;
}[];
