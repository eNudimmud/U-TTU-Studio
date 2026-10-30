import { formatCredits } from "../credits.ts";
import type { TakeQuote } from "./billed-quote.ts";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The estimate, in the user's language: a measured quote reads as a range up to its billed upper bound. */
export function quoteWords(t: Translate, quote: TakeQuote): string {
  if (quote.source === "estimated") return t("p0.quote.estimated", { low: formatCredits(quote.estimate.credits), high: formatCredits(quote.estimate.creditsHigh) });
  if (quote.source === "billed") return t("p0.quote.measured", { credits: formatCredits(quote.measure.credits), high: formatCredits(quote.measure.creditsHigh) });
  // Measured quotes read as a range: the measured take, up to the billed upper bound (bug 9: one take cost 5,98 for ≈ 4).
  if (quote.source === "balance") return quote.high !== null
    ? t("p0.quote.measuredBalanceRange", { credits: formatCredits(quote.credits), high: formatCredits(quote.high) })
    : t("p0.quote.measuredBalance", { credits: formatCredits(quote.credits) });
  return t("p0.quote.none");
}


/** The upper bound of a measured quote, when it has one above the measured take. */
export function measuredHigh(quote: TakeQuote): number | null {
  if (quote.source === "billed") return quote.measure.creditsHigh > quote.measure.credits ? quote.measure.creditsHigh : null;
  if (quote.source === "balance") return quote.high;
  return null;
}

/** The amount inside « ≈ … crédits estimés »: « 4 à 6 » for a measured quote with a bound, « 18 » otherwise. */
export function quoteAmount(t: Translate, quote: TakeQuote): string | null {
  const low = quote.source === "billed" ? quote.measure.credits : quote.source === "balance" ? quote.credits : quote.source === "estimated" ? quote.estimate.credits : null;
  if (low === null) return null;
  const high = measuredHigh(quote);
  return high === null ? formatCredits(low) : t("p0.rendu.range", { low: formatCredits(low), high: formatCredits(high) });
}
