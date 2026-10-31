// Refonte FILM · PR 8 — montage refait, principes OpenCut appliqués (P1–P11, opencut/PRINCIPES-MONTAGE.md).
// One registry of named actions with shortcuts (P7); the « Plans » track is packed from 0 with no gap
// (P1: the clip list *is* the track, deleting closes the hole); cut tools at the playhead (P2).

import { canSplit, clipOrigin, deleteClip, duplicateVideo, playSpan, splitVideo, trimVideo, videoAt, type Edit, type VideoClip } from "../montage/edit.ts";

export type ActionId = "lecture" | "annuler" | "retablir" | "couper" | "enleverAvant" | "enleverApres" | "dupliquer" | "supprimer";

export interface ActionMontage {
  id: ActionId;
  /** Shown next to the name on desktop, and given to aria-keyshortcuts. */
  touche: string;
  aria: string;
  match(key: { key: string; ctrl: boolean; shift: boolean }): boolean;
  /** In the tool bar (lecture lives on the player). */
  barre: boolean;
}

export const ACTIONS: readonly ActionMontage[] = [
  { id: "lecture", touche: "Espace", aria: "Space", barre: false, match: key => key.key === " " && !key.ctrl },
  { id: "annuler", touche: "Ctrl+Z", aria: "Control+Z", barre: true, match: key => key.ctrl && !key.shift && key.key.toLowerCase() === "z" },
  { id: "retablir", touche: "Ctrl+Maj+Z", aria: "Control+Shift+Z", barre: true, match: key => key.ctrl && ((key.shift && key.key.toLowerCase() === "z") || key.key.toLowerCase() === "y") },
  { id: "couper", touche: "S", aria: "S", barre: true, match: key => !key.ctrl && key.key.toLowerCase() === "s" },
  { id: "enleverAvant", touche: "Q", aria: "Q", barre: true, match: key => !key.ctrl && key.key.toLowerCase() === "q" },
  { id: "enleverApres", touche: "W", aria: "W", barre: true, match: key => !key.ctrl && key.key.toLowerCase() === "w" },
  { id: "dupliquer", touche: "D", aria: "D", barre: true, match: key => !key.ctrl && key.key.toLowerCase() === "d" },
  { id: "supprimer", touche: "Suppr", aria: "Delete", barre: true, match: key => key.key === "Delete" || key.key === "Backspace" },
];

export function actionPourTouche(key: { key: string; ctrl: boolean; shift: boolean }): ActionId | null {
  return ACTIONS.find(action => action.match(key))?.id ?? null;
}

/** Where each plan sits on the packed track: starts are always the previous end. */
export function placements(edit: Pick<Edit, "video">): { clip: VideoClip; start: number; end: number }[] {
  let cursor = 0;
  return edit.video.map(clip => {
    const start = cursor;
    cursor += playSpan(clip);
    return { clip, start, end: cursor };
  });
}

export interface Etat { edit: Edit; time: number; selected: string | null }

/** The plan the tools act on: the selected one, else the one under the playhead. */
export function cible(etat: Etat): VideoClip | null {
  return etat.edit.video.find(clip => clip.id === etat.selected) ?? videoAt(etat.edit, etat.time)?.clip ?? null;
}

/** The plan under the playhead, with the playhead strictly inside it (not on its edges). */
function dedans(etat: Etat): VideoClip | null {
  const hit = videoAt(etat.edit, etat.time);
  return hit && hit.offset > 0.05 && playSpan(hit.clip) - hit.offset > 0.05 ? hit.clip : null;
}

/** Why a tool is off, as an i18n key — or null when it can run. */
export function pourquoiPas(id: ActionId, etat: Etat, history: { past: number; future: number }): string | null {
  if (!etat.edit.video.length && id !== "annuler" && id !== "retablir") return "film2.montage.pourquoi.vide";
  switch (id) {
    case "annuler": return history.past ? null : "film2.montage.pourquoi.rienAnnuler";
    case "retablir": return history.future ? null : "film2.montage.pourquoi.rienRetablir";
    case "couper": return canSplit(etat.edit, etat.time) ? null : "film2.montage.pourquoi.placer";
    case "enleverAvant":
    case "enleverApres": return dedans(etat) ? null : "film2.montage.pourquoi.placer";
    case "dupliquer":
    case "supprimer": return cible(etat) ? null : "film2.montage.pourquoi.choisir";
    default: return null;
  }
}

/** Run an edit tool. Returns the next state (same edit when nothing changes). */
export function agir(id: Exclude<ActionId, "lecture" | "annuler" | "retablir">, etat: Etat, nextId: () => string): Etat {
  const { edit, time } = etat;
  if (id === "couper") {
    const made = nextId();
    const next = splitVideo(edit, time, made);
    return next === edit ? etat : { edit: next, time, selected: made };
  }
  if (id === "enleverAvant" || id === "enleverApres") {
    const clip = dedans(etat);
    if (!clip) return etat;
    const next = trimVideo(edit, clip.id, id === "enleverAvant" ? "start" : "end", time);
    // What was after the playhead slides back to where the plan begins.
    const origin = clipOrigin(next, clip.id) ?? time;
    return { edit: next, time: id === "enleverAvant" ? origin : time, selected: clip.id };
  }
  const clip = cible(etat);
  if (!clip) return etat;
  if (id === "dupliquer") {
    const made = nextId();
    return { edit: duplicateVideo(edit, clip.id, made), time, selected: made };
  }
  const next = deleteClip(edit, clip.id);
  const total = placements(next).at(-1)?.end ?? 0;
  return { edit: next, time: Math.min(time, total), selected: null };
}

/** « Mes plans » tap: the plan goes at the end of the track, even when it is already in the film. */
export function ajouterALaFin(edit: Edit, clip: VideoClip): Edit {
  if (edit.video.some(item => item.id === clip.id)) return edit;
  const takeId = clip.takeId && edit.video.some(item => item.takeId === clip.takeId) ? null : clip.takeId;
  return { ...edit, video: [...edit.video, { ...clip, takeId }] };
}
