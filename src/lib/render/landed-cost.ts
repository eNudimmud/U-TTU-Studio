// What a finished take cost, compared with the quote that was in force before
// this take's own balance delta was stored. A missing second reading is said
// as unread. No number is filled in.

import { measuredCost, type RunGate } from "../credits.ts";
import { priseGate, resolveTakeQuote, type TakeQuote } from "./billed-quote.ts";
import { quoteFromReadings, quotesToRecords, rememberQuote, type MeasuredQuote } from "./measured-quote.ts";

export const REAL_COST_UNREAD = "Coût réel non lu";
export const COST_OVER_LINE = "Le coût réel dépasse le devis annoncé.";

export interface AnnouncedQuote {
  credits: number;
  /** The billed ceiling, only when the announcement was the billed record. */
  high: number | null;
}

export interface LandedCostTake {
  engine: string;
  announcedCredits: number | null;
  announcedHigh: number | null;
  costCredits: number | null;
}

export type TakeCostView =
  | { kind: "none" }
  | { kind: "unread"; announced: number; high: number | null }
  | { kind: "read"; announced: number; high: number | null; real: number; exceeded: boolean };

/** The quote Tourner was showing, before this take's delta is remembered. */
export function announcedFromQuote(quote: TakeQuote): AnnouncedQuote | null {
  if (quote.source === "balance") return { credits: quote.credits, high: null };
  if (quote.source === "billed") return { credits: quote.measure.credits, high: quote.measure.creditsHigh };
  return null;
}

/** The journal sentence for one landed take. Older notes, and fal takes, stay out of it. */
export function journalCostLine(take: LandedCostTake): string | null {
  if (take.engine !== "comfy" || take.announcedCredits === null) return null;
  const announced = take.announcedHigh !== null
    ? `devis annoncé ${take.announcedCredits} crédits, au plus ${take.announcedHigh}`
    : `devis annoncé ${take.announcedCredits} crédits`;
  if (take.costCredits === null) return `${announced}. ${REAL_COST_UNREAD}.`;
  const over = take.costCredits > take.announcedCredits ? ` ${COST_OVER_LINE}` : "";
  return `${announced}. Coût réel lu : ${take.costCredits} crédits.${over}`;
}

export function takeCostView(take: LandedCostTake): TakeCostView {
  if (take.engine !== "comfy" || take.announcedCredits === null) return { kind: "none" };
  if (take.costCredits === null) return { kind: "unread", announced: take.announcedCredits, high: take.announcedHigh };
  return {
    kind: "read",
    announced: take.announcedCredits,
    high: take.announcedHigh,
    real: take.costCredits,
    exceeded: take.costCredits > take.announcedCredits,
  };
}

export interface LearnedCost {
  announced: AnnouncedQuote | null;
  real: number | null;
  exceeded: boolean;
  quotes: MeasuredQuote[];
  stored: boolean;
  gate: RunGate;
}

/**
 * Remember a readable drop, then judge the next Tourner against that reference.
 * `balance` is the credits still on the account. Null means the account cannot be read.
 */
export function learnTakeCost(input: {
  profile: string;
  quotes: readonly MeasuredQuote[];
  before: number | null;
  after: number | null;
  at: string;
  balance: number | null;
}): LearnedCost {
  const announced = announcedFromQuote(resolveTakeQuote(input.profile, quotesToRecords(input.quotes)));
  const drop = measuredCost(input.before, input.after);
  const measured = drop !== null && drop > 0 ? quoteFromReadings(input.profile, input.before, input.after, input.at) : null;
  const real = measured?.credits ?? null;
  const quotes = measured ? rememberQuote(input.quotes, measured) : [...input.quotes];
  const gate = priseGate(
    input.balance === null ? null : { credits: input.balance, readAt: 1 },
    resolveTakeQuote(input.profile, quotesToRecords(quotes)),
  );
  return {
    announced,
    real,
    exceeded: announced !== null && real !== null && real > announced.credits,
    quotes,
    stored: measured !== null,
    gate,
  };
}
