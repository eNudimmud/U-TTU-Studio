// CAST, DÉCOR, PRISE. The stored vault is unchanged: one look, places, takes.
// A section is vide or prêt. Generate is offered only when the pieces, the
// account and a real quote all allow it.

import { lookCheck, type Look } from "./coffre/model.ts";
import type { TakeQuote } from "./render/billed-quote.ts";

export const CAST_PHOTO_MIN = 2;
export const CAST_PHOTO_MAX = 3;

export type StageId = "cast" | "decor" | "prise";
export type StageMark = "vide" | "pret";

/** Two photos and a name. The offered default name counts; a cleared field does not. */
export function castReady(look: Pick<Look, "name" | "photos">): boolean {
  return lookCheck({ name: look.name, traits: [], photos: [...look.photos], note: "" }).photos
    && lookCheck({ name: look.name, traits: [], photos: [...look.photos], note: "" }).name
    && look.photos.length <= CAST_PHOTO_MAX;
}

export function decorReady(placeCount: number): boolean {
  return placeCount > 0;
}

export function priseReady(input: { cast: boolean; decor: boolean; line: string }): boolean {
  return input.cast && input.decor && input.line.trim().length > 0;
}

/** What the single gold button on PRISE does. Generate is last. */
export type PriseNext = "cast" | "decor" | "action" | "connect" | "hold" | "generate";

export function priseNext(input: {
  cast: boolean;
  decor: boolean;
  line: string;
  connected: boolean;
  canSpend: boolean;
}): PriseNext {
  if (!input.cast) return "cast";
  if (!input.decor) return "decor";
  if (!input.line.trim()) return "action";
  if (!input.connected) return "connect";
  if (!input.canSpend) return "hold";
  return "generate";
}

/** A number from a real quote. An unmeasured setting contributes nothing. */
export function quotedCredits(quote: TakeQuote): number | null {
  if (quote.source === "balance") return quote.credits;
  if (quote.source === "billed") return quote.measure.credits;
  return null;
}
