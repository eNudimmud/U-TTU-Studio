// U1.1 · one change request. Structural commands and camera settings come from the whole-sentence
// reader (corriger.ts, CE5-L R10). Anything it does not take becomes a director's note on a shot:
// journaled, undoable, 0 credits. A note never moves, deletes or adds a shot.

import {
  appliquerCorrection, lireCorrection, lireReglage, type Correction,
} from "./corriger.ts";
import {
  ACTION_MAX, majPlan, tousLesPlans, type Storyboard,
} from "./storyboard.ts";
import type { Registre } from "../film/registre.ts";

const SHOT = "(?:plan|shot|einstellung|plano)";
const NUM = "(\\d{1,2})";

export type Demande =
  | { kind: "correction"; correction: Correction }
  /** A framing or mood line that names no shot: the same setting on every shot, nothing structural. */
  | { kind: "toutes"; correction: Extract<Correction, { type: "reglage" }> }
  | { kind: "note"; n: number | null; text: string };

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** The shots a note lands on: a named « shot N », else every shot whose action mentions a content word, else all. */
export function ciblesNote(sb: Storyboard, text: string, named: number | null): number[] {
  const plans = tousLesPlans(sb);
  if (!plans.length) return [];
  if (named && named >= 1 && named <= plans.length) return [named];
  const skip = new Set(["the", "a", "an", "it", "to", "of", "and", "le", "la", "les", "un", "une", "de", "du", "des", "et", "der", "die", "das", "und", "el", "los", "las", "y", "en", "remove", "delete", "make", "shot", "plan", "plano"]);
  const words = fold(text).split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 4 && !skip.has(word));
  const hits = plans.flatMap((plan, index) => {
    const hay = fold(`${plan.titre} ${plan.action} ${plan.dialogue.texte}`);
    return words.some(word => hay.includes(word)) ? [index + 1] : [];
  });
  return hits.length ? hits : plans.map((_, index) => index + 1);
}

/**
 * Reads one request the way the simplified page does. `selected` is the shot next to the field
 * (1-based). « Make it a close-up » is a framing. « Remove the rain » is not a removal.
 */
export function lireDemande(raw: string, selected?: number): Demande {
  const text = raw.replace(/\s+/g, " ").trim();
  const direct = lireCorrection(text) ?? (selected ? lireCorrection(text, selected) : null) ?? lireReglage(text, selected);
  if (direct) return { kind: "correction", correction: direct };
  const named = new RegExp(`${SHOT}\\s*(?:n[o°]?\\s*)?${NUM}`, "iu").exec(fold(text));
  if (!named && !selected) {
    const sample = lireReglage(text, 1);
    if (sample?.type === "reglage") return { kind: "toutes", correction: sample };
  }
  const n = named ? Number(named[1]) : selected && selected > 0 ? selected : null;
  return { kind: "note", n, text };
}

/** Writes the visitor's sentence onto the targeted shots. Order, count and dialogue stay. */
export function appliquerNote(sb: Storyboard, shots: readonly number[], text: string, now?: string): Storyboard {
  const note = text.replace(/\s+/g, " ").trim().slice(0, 160);
  if (!note) return sb;
  const plans = tousLesPlans(sb);
  const ids = new Set(shots.flatMap(n => plans[n - 1] ? [plans[n - 1]!.id] : []));
  if (!ids.size) return sb;
  let next = sb;
  for (const id of ids) {
    const plan = tousLesPlans(next).find(item => item.id === id);
    if (!plan || plan.action.includes(note)) continue;
    const action = `${plan.action.replace(/[\s.]+$/u, "")}${plan.action.trim() ? ". " : ""}Note: ${note}.`.slice(0, ACTION_MAX);
    next = majPlan(next, id, { action }, now);
  }
  return next;
}

/** The same camera / framing / mood line, applied to every shot. A filmed shot is left as it is. */
export function appliquerATous(sb: Storyboard, sample: Extract<Correction, { type: "reglage" }>, registre: Pick<Registre, "plans"> | null, now?: string): Storyboard {
  let next = sb;
  const total = tousLesPlans(sb).length;
  for (let n = 1; n <= total; n += 1) {
    const applied = appliquerCorrection(next, { ...sample, n }, registre, "note", now);
    if (applied) next = applied.sb;
  }
  return next;
}
