// Filmmaker tiles. One tap sets the framing the visitor can name.
// Focal length, the 180° line and the matrices stay in the preset.

import type { Cadrage, CameraMove } from "../prise/copy.ts";

export const TUILE_IDS = ["large", "taille", "contre", "reac", "impact", "regard"] as const;
export type TuileId = (typeof TUILE_IDS)[number];

export interface TuilePreset {
  id: TuileId;
  /** Stable French name. The screen translates it; matching still knows this form. */
  label: string;
  hint: string;
  cadrage: Cadrage;
  camera: CameraMove;
  /** English cinema words for the request. Not a node and not a number. */
  prompt: string;
  theta: number;
  phi: number;
  radius: number;
  /** Champ / contrechamp, réaction et plan taille demandent deux personnages. */
  pair: boolean;
}

export const TUILES: readonly TuilePreset[] = [
  { id: "large", label: "Plan large", hint: "Tout le décor", prompt: "wide shot, the whole set", cadrage: "large", camera: "fixe", theta: 0.2, phi: 1.25, radius: 11, pair: false },
  { id: "taille", label: "Plan taille", hint: "Les deux, à la taille", prompt: "waist-up framing", cadrage: "americain", camera: "fixe", theta: 0.35, phi: 1.35, radius: 6.5, pair: true },
  { id: "contre", label: "Champ / contrechamp", hint: "On suit qui parle", prompt: "over-the-shoulder, following whoever speaks", cadrage: "epaule", camera: "panoramique", theta: -0.9, phi: 1.4, radius: 4, pair: true },
  { id: "reac", label: "Réaction muette", hint: "Gros plan sur qui écoute", prompt: "silent close-up on the listener", cadrage: "gros", camera: "fixe", theta: 2.6, phi: 1.45, radius: 3, pair: true },
  { id: "impact", label: "Zoom d'impact", hint: "Pour un choc", prompt: "impact push-in", cadrage: "gros", camera: "travelling-avant", theta: 0, phi: 1.5, radius: 2.6, pair: false },
  { id: "regard", label: "Regard caméra", hint: "Il nous fixe", prompt: "looks straight into the lens", cadrage: "gros", camera: "fixe", theta: 0, phi: 1.5, radius: 4, pair: false },
];

export function tuileNeedsPair(id: string | null | undefined): boolean {
  return tuileById(id).pair;
}

export function tuileById(id: string | null | undefined): TuilePreset {
  return TUILES.find(item => item.id === id) ?? TUILES[1];
}

export function isTuile(id: string): id is TuileId {
  return (TUILE_IDS as readonly string[]).includes(id);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The tile named in the sentence, or null. Longer names win. */
export function tuileInText(text: string, labels: readonly { id: TuileId; label: string }[] = TUILES): TuileId | null {
  const hay = text.toLowerCase();
  const found = labels
    .map(item => ({ ...item, at: hay.indexOf(item.label.toLowerCase()) }))
    .filter(item => item.label.trim().length > 0 && item.at >= 0)
    .sort((a, b) => b.label.length - a.label.length || a.at - b.at);
  return found[0]?.id ?? null;
}

/** Writing and tiles stay one sentence. The new name replaces the old one. */
export function rewriteScene(text: string, nextLabel: string, labels: readonly string[]): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const known = [...labels].filter(label => label.trim().length > 0).sort((a, b) => b.length - a.length);
  const hit = known.find(label => trimmed.toLowerCase().includes(label.toLowerCase()));
  if (hit) return trimmed.replace(new RegExp(escapeRegExp(hit), "i"), nextLabel.toLowerCase());
  if (!trimmed) return nextLabel;
  return `${trimmed.replace(/[.\s]+$/, "")}, ${nextLabel.toLowerCase()}.`;
}
