// A billed quote is one finished job's GPU time, times the rate on that bill.
// It is not a balance delta (F11), and it is not the Cloud estimator's 0.
// Only the profiles named in docs/mesures are quoted. Every other setting stays off.

import { COMFY_CLOUD } from "../comfy-stack.ts";
import { FRAMING_ESTIMATE } from "./framed-key.ts";
import { claimBasis, costClaim, formatCredits, runGate, type Balance, type CostRecord, type RunGate } from "../credits.ts";

export const BILLED_MEASURE_FILE = "docs/mesures/h3-4pas-5s-vertical.json";

/** The first billed take in the repo (H3 vertical). Keep this object equal to BILLED_MEASURE_FILE. */
export const BILLED_MEASURE = {
  version: 1,
  kind: "gpu-facture",
  profile: "h3-4pas-5s-vertical",
  at: "2026-10-07T21:16:45.000Z",
  displayDay: "7 octobre",
  jobId: "51662b20-4ac7-44bc-b203-a4127ff462a0",
  gpu: "rtx_pro_6000",
  gpuSeconds: 15.680729,
  usdPerGpuSecond: 0.001295,
  creditsPerUsd: COMFY_CLOUD.creditsPerUsd,
  gpuCreditsPerSecondBound: COMFY_CLOUD.gpuCreditsPerSecond,
  /** Math.round(gpuSeconds × usdPerGpuSecond × creditsPerUsd). The bill was about 4.3. */
  credits: 4,
  /** Novice ceiling. gpuSeconds × gpuCreditsPerSecond is about 6.1, announced as 6. */
  creditsHigh: 6,
  runs: 1,
  modelsWarm: true,
} as const;

export const BILLED_MEASURE_HORIZONTAL_FILE = "docs/mesures/h3-4pas-5s-horizontal.json";

/**
 * H3 16:9, same 0.4 MP budget as the vertical (864×480 against 480×864), 4 steps, 5 s, two references.
 * Billed on the « Créer » bubble, 30.10.2026 (job d5e843a4, 14.48 GPU s ≈ 3.96 crédits). PRISE and the
 * bubble send the same template at the same size, so one measure quotes both. Keep equal to its file.
 */
export const BILLED_MEASURE_HORIZONTAL = {
  version: 1,
  kind: "gpu-facture",
  profile: "h3-4pas-5s-horizontal",
  at: "2026-10-30T08:35:39.809Z",
  displayDay: "30 octobre",
  jobId: "d5e843a4-ead9-4c3a-856b-0322e04b252b",
  gpu: "rtx_pro_6000",
  gpuSeconds: 14.475616,
  usdPerGpuSecond: 0.001295,
  creditsPerUsd: COMFY_CLOUD.creditsPerUsd,
  gpuCreditsPerSecondBound: COMFY_CLOUD.gpuCreditsPerSecond,
  /** Math.round(14.475616 × 0.001295 × 211) = 4 (3.96). */
  credits: 4,
  /** Same novice ceiling as the vertical: a cold worker billed 21.9 s (≈ 5.98) on the same graph the same morning. */
  creditsHigh: 6,
  runs: 1,
  modelsWarm: true,
} as const;

export type BilledMeasure = typeof BILLED_MEASURE | typeof BILLED_MEASURE_HORIZONTAL;

export const UNMEASURED_LINE = "Pas encore mesuré. Cette durée, cette qualité ou ce format n’a pas de prise réelle. Rien ne part.";

export type TakeQuote =
  /** high: the billed (or estimated) upper bound for the same setting, when one exists above the measured delta. */
  | { source: "balance"; credits: number; at: string; runs: number; high: number | null }
  | { source: "billed"; measure: BilledMeasure }
  | { source: "estimated"; estimate: TakeEstimate }
  | { source: "unmeasured" };

/** An estimate is a hypothesis, never a measure. Shown as « estimé », with its high bound as the gate. */
export interface TakeEstimate {
  profile: string;
  credits: number;
  creditsHigh: number;
}

/**
 * LTX-2.5 i2v on Comfy Cloud, 5 s 16:9 0.9 MP with its Klein first frame. mesuré 27.10.2026 : 15,10 crédits
 * (job d4d2fa37) ; the first frame at cfg 3.5 adds 2,93 (30.10.2026 : 0d6b5c7e 7,68 against 594509e3 4,75) → 18 / 27.
 */
export const LTX_ESTIMATE_5S = { credits: 18, creditsHigh: 27 } as const;

/**
 * LTX-2.5 Aperçu (first pass only, about 480p). An estimate, not a measure: about half of
 * the two-pass take. TODO(mesure): one real 5 s Aperçu take, read on the balance, replaces
 * this pair. Nothing in the code spends to measure it.
 */
export const LTX_APERCU_ESTIMATE_5S = { credits: 6, creditsHigh: 12 } as const;

export function estimatedTake(profile: string): TakeEstimate | null {
  const controlled = profile.startsWith("ltx25-cadre-v1-");
  const match = /^ltx25-(apercu-)?(\d+)s-/.exec(profile.replace("ltx25-cadre-v1-", "ltx25-"));
  if (!match) return null;
  const base = match[1] ? LTX_APERCU_ESTIMATE_5S : LTX_ESTIMATE_5S;
  const factor = Number(match[2]) / 5;
  return { profile, credits: Math.round(base.credits * factor) + (controlled ? FRAMING_ESTIMATE.credits : 0), creditsHigh: Math.round(base.creditsHigh * factor) + (controlled ? FRAMING_ESTIMATE.high : 0) };
}

export function estimateSentence(estimate: Pick<TakeEstimate, "credits" | "creditsHigh">): string {
  return `Estimé : environ ${formatCredits(estimate.credits)} à ${formatCredits(estimate.creditsHigh)} crédits. Estimation, pas une mesure : aucune prise réelle facturée pour ce réglage.`;
}

/** The billed record for this exact profile, or nothing. No other profile is invented. */
export function billedMeasure(profile: string): BilledMeasure | null {
  return [BILLED_MEASURE, BILLED_MEASURE_HORIZONTAL].find(measure => measure.profile === profile) ?? null;
}

/**
 * A balance delta in Mon studio wins. Otherwise the billed record, for its one profile.
 * Anything else has not been measured.
 */
export function resolveTakeQuote(profile: string, records: readonly CostRecord[]): TakeQuote {
  const delta = costClaim(profile, records);
  if (delta.state === "measured") {
    // A balance delta has no upper bound of its own: one take can run longer on a cold worker (bug 9: 4 → 5,98).
    const bound = billedMeasure(profile)?.creditsHigh ?? estimatedTake(profile)?.creditsHigh ?? null;
    return { source: "balance", credits: delta.credits, at: delta.at, runs: delta.runs, high: bound !== null && bound > delta.credits ? bound : null };
  }
  const measure = billedMeasure(profile);
  if (measure) return { source: "billed", measure };
  const estimate = estimatedTake(profile);
  if (estimate) return { source: "estimated", estimate };
  return { source: "unmeasured" };
}

/** The novice sentence, without a balance check. The gate decides whether Tourner may leave. */
export function quoteSentence(quote: TakeQuote): string {
  if (quote.source === "billed") return billedSentence(quote.measure);
  if (quote.source === "balance") {
    const claim = { state: "measured" as const, credits: quote.credits, at: quote.at, runs: quote.runs };
    return `Environ ${formatCredits(quote.credits)} crédits, mesuré sur ${claimBasis(claim)}.`;
  }
  if (quote.source === "estimated") return estimateSentence(quote.estimate);
  return UNMEASURED_LINE;
}

export function billedSentence(measure: BilledMeasure): string {
  return `Environ ${formatCredits(measure.credits)} crédits, estimé d’après une prise du ${measure.displayDay}. Le prix final peut varier.`;
}

/** Tourner stays off unless this quote is a number and the balance covers it. */
export function priseGate(balance: Balance | null, quote: TakeQuote): RunGate {
  if (quote.source === "balance") {
    return runGate(balance, { state: "measured", credits: quote.credits, at: quote.at, runs: quote.runs });
  }
  if (quote.source === "unmeasured") return { allowed: false, tone: "block", line: UNMEASURED_LINE };
  const sentence = quote.source === "estimated" ? estimateSentence(quote.estimate) : billedSentence(quote.measure);
  const high = quote.source === "estimated" ? quote.estimate.creditsHigh : quote.measure.creditsHigh;
  if (!balance) return { allowed: false, tone: "block", line: `Solde illisible. Rien ne part sans lire le compte qui paiera. ${sentence}` };
  if (balance.credits <= 0) return { allowed: false, tone: "block", line: `Solde vide sur ton compte de rendu. ${sentence}` };
  if (balance.credits < high) {
    return { allowed: false, tone: "block", line: `Solde trop bas : ${formatCredits(balance.credits)} crédits. ${sentence}` };
  }
  return { allowed: true, tone: "ok", line: sentence };
}
