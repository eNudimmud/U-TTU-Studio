// Aperçu or Qualité finale, remembered per project in this browser.
// Qualité finale is the default: nothing changes for someone who never opens the choice.

import { DEFAULT_RENDU, TAKE_RENDUS, type TakeRendu } from "../render/take-graph.ts";
import type { TakeQuote } from "../render/billed-quote.ts";

export const RENDU_KEY = "u-ttu-qualite";

function key(project: string | null): string {
  return `${RENDU_KEY}:${project || "_"}`;
}

export function readRendu(storage: Pick<Storage, "getItem"> | null, project: string | null): TakeRendu {
  try {
    const value = storage?.getItem(key(project));
    return (TAKE_RENDUS as readonly string[]).includes(value ?? "") ? value as TakeRendu : DEFAULT_RENDU;
  } catch {
    return DEFAULT_RENDU;
  }
}

export function saveRendu(storage: Pick<Storage, "setItem"> | null, project: string | null, rendu: TakeRendu): void {
  try { storage?.setItem(key(project), rendu); } catch {}
}

/** The single number shown on the button: the expected credits, never the ceiling. */
export function quoteCredits(quote: TakeQuote): number | null {
  if (quote.source === "estimated") return quote.estimate.credits;
  if (quote.source === "billed") return quote.measure.credits;
  if (quote.source === "balance") return quote.credits;
  return null;
}
