// Refonte FILM · PR 5 — what the Qui and Où sheets change on a plan. The sentence proposes, the sheet
// decides: a picked card replaces what was read, a new one is created inside the same quote.
// F16: a photo already in the gallery (same SHA-256) is offered back instead of being imported twice.

import type { OuCompris, PlanCompris, QuiCompris } from "./comprendre.ts";
import { REFS_MAX } from "./registre.ts";

export type ChoixQui = { id: string; nom: string } | { id: null; nom: string; source: "texte" | "photos"; description?: string };
export type ChoixOu = { id: string; nom: string } | { id: null; nom: string; source: "texte" | "photo"; description?: string };
export interface Choix { qui: ChoixQui[] | null; ou: ChoixOu | null }

export const CHOIX_VIDE: Choix = { qui: null, ou: null };

/** The plan after the sheets: chosen cast and place win over the sentence, at most 3 characters. */
export function appliquerChoix(plan: PlanCompris, choix: Choix): PlanCompris {
  const qui: QuiCompris[] = choix.qui
    ? choix.qui.slice(0, REFS_MAX).map(item => item.id !== null ? { id: item.id, nom: item.nom, nouveau: false } : { id: null, nom: item.nom, nouveau: true, source: item.source, ...(item.description ? { description: item.description } : {}) })
    : plan.qui;
  const ou: OuCompris | null = choix.ou
    ? choix.ou.id !== null ? { id: choix.ou.id, nom: choix.ou.nom, nouveau: false } : { id: null, nom: choix.ou.nom, nouveau: true, source: choix.ou.source, ...(choix.ou.description ? { description: choix.ou.description } : {}) }
    : plan.ou;
  return { ...plan, qui, ou, decorDeLaPhrase: choix.ou ? false : plan.decorDeLaPhrase };
}

/** Adds or removes one card from the Qui choice; never more than 3. */
export function basculerQui(current: readonly ChoixQui[], item: ChoixQui): ChoixQui[] {
  const same = (a: ChoixQui) => a.id ? a.id === item.id : !item.id && a.nom.toLowerCase() === item.nom.toLowerCase();
  if (current.some(same)) return current.filter(a => !same(a));
  return current.length >= REFS_MAX ? [...current] : [...current, item];
}

export interface GalerieImage { sha256: string; id: string; nom: string }
export interface TriPhotos {
  /** Indexes of the picked files to keep: no twin among them, none already in the gallery, at most `max`. */
  garder: number[];
  /** Twins dropped inside the pick. */
  doublons: number;
  /** A picked photo that is already a card's picture. */
  dejaLa: { id: string; nom: string } | null;
}

/** F16: sorts picked photos by their SHA-256 against each other and against the gallery. */
export function trierPhotos(shas: readonly string[], galerie: readonly GalerieImage[], max = REFS_MAX): TriPhotos {
  const seen = new Set<string>();
  const garder: number[] = [];
  let doublons = 0;
  let dejaLa: TriPhotos["dejaLa"] = null;
  shas.forEach((sha, index) => {
    const hit = galerie.find(item => item.sha256 === sha);
    if (hit) { if (!dejaLa) dejaLa = { id: hit.id, nom: hit.nom }; return; }
    if (seen.has(sha)) { doublons += 1; return; }
    seen.add(sha);
    if (garder.length < max) garder.push(index);
  });
  return { garder, doublons, dejaLa };
}
