// A measured quote is the drop between two balance readings at one take setting.
// A bare credit number, or the Cloud estimator's 0, is not one.

import { measuredCost, type CostRecord } from "../credits.ts";

export const QUOTE_FILE = ".uttu/devis.json";
export const QUOTE_KEEP = 3;

const PROFILE = /^h3-\d+pas-\d+s-(?:vertical|horizontal|carre)$/;
const ASPECT: Record<string, string> = { vertical: "9:16", horizontal: "16:9", carre: "1:1" };

export interface MeasuredQuote {
  profile: string;
  before: number;
  after: number;
  credits: number;
  at: string;
}

export interface ProfileParts {
  steps: number;
  seconds: number;
  aspect: string;
}

/** The two readings, or nothing. A balance that rose, or did not move, is not a quote. */
export function quoteFromReadings(profile: string, before: number | null, after: number | null, at: string): MeasuredQuote | null {
  if (!PROFILE.test(profile) || !at) return null;
  const credits = measuredCost(before, after);
  if (credits === null || credits <= 0 || before === null || after === null) return null;
  return { profile, before, after, credits, at };
}

/** Comfy takes only. The stored credit figure is ignored: the two readings are the measure. */
export function quoteFromTake(take: {
  engine: string;
  profile: string;
  balanceBefore: number | null;
  balanceAfter: number | null;
  at: string;
}): MeasuredQuote | null {
  if (take.engine !== "comfy") return null;
  return quoteFromReadings(take.profile, take.balanceBefore, take.balanceAfter, take.at);
}

/** Keep the three newest readings of this setting. Older ones leave the quote. */
export function rememberQuote(quotes: readonly MeasuredQuote[], next: MeasuredQuote): MeasuredQuote[] {
  const others = quotes.filter(item => item.profile !== next.profile);
  const same = [...quotes.filter(item => item.profile === next.profile && item.at !== next.at), next]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-QUOTE_KEEP);
  return [...others, ...same].sort((a, b) => a.profile.localeCompare(b.profile) || a.at.localeCompare(b.at));
}

export function forgetQuote(quotes: readonly MeasuredQuote[], profile: string): MeasuredQuote[] {
  return quotes.filter(item => item.profile !== profile);
}

/** First opening: readings already written on takes become the quote file. */
export function seedQuotes(takes: readonly {
  engine: string;
  profile: string;
  balanceBefore: number | null;
  balanceAfter: number | null;
  at: string;
}[]): MeasuredQuote[] {
  let quotes: MeasuredQuote[] = [];
  const ordered = [...takes].sort((a, b) => a.at.localeCompare(b.at));
  for (const take of ordered) {
    const quote = quoteFromTake(take);
    if (quote) quotes = rememberQuote(quotes, quote);
  }
  return quotes;
}

export function quotesToRecords(quotes: readonly MeasuredQuote[]): CostRecord[] {
  return quotes.map(quote => ({ profile: quote.profile, credits: quote.credits, gpuSeconds: null, at: quote.at }));
}

export function profileParts(profile: string): ProfileParts | null {
  const match = /^h3-(\d+)pas-(\d+)s-(vertical|horizontal|carre)$/.exec(profile);
  if (!match) return null;
  return { steps: Number(match[1]), seconds: Number(match[2]), aspect: ASPECT[match[3]] };
}

/** Absent file returns null, so the studio can seed it once. An empty list means it was cleared. */
export function parseQuoteFile(source: string | undefined): MeasuredQuote[] | null {
  if (source === undefined) return null;
  try {
    const data = JSON.parse(source) as { seeded?: unknown; quotes?: unknown };
    if (!data || data.seeded !== true || !Array.isArray(data.quotes)) return null;
    const quotes: MeasuredQuote[] = [];
    for (const row of data.quotes) {
      if (!row || typeof row !== "object") continue;
      const item = row as Record<string, unknown>;
      const profile = typeof item.profile === "string" ? item.profile : "";
      const before = typeof item.before === "number" ? item.before : null;
      const after = typeof item.after === "number" ? item.after : null;
      const at = typeof item.at === "string" ? item.at : "";
      const quote = quoteFromReadings(profile, before, after, at);
      if (quote && quote.credits === item.credits) quotes.push(quote);
    }
    return quotes;
  } catch {
    return null;
  }
}

export function quotesJson(quotes: readonly MeasuredQuote[]): string {
  return JSON.stringify({ seeded: true, quotes });
}
