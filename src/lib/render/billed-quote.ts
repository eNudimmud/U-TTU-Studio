// A billed quote is one finished job's GPU time, times the rate on that bill.
// It is not a balance delta (F11), and it is not the Cloud estimator's 0.
// Only the profile named in docs/mesures is quoted. Every other setting stays off.

import { COMFY_CLOUD } from "../comfy-stack.ts";
import { claimBasis, costClaim, formatCredits, runGate, type Balance, type CostRecord, type RunGate } from "../credits.ts";

export const BILLED_MEASURE_FILE = "docs/mesures/h3-4pas-5s-vertical.json";

/** The only billed take in the repo. Keep this object equal to BILLED_MEASURE_FILE. */
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

export type BilledMeasure = typeof BILLED_MEASURE;

export const UNMEASURED_LINE = "Pas encore mesuré. Cette durée, cette qualité ou ce format n’a pas de prise réelle. Rien ne part.";

export type TakeQuote =
  | { source: "balance"; credits: number; at: string; runs: number }
  | { source: "billed"; measure: BilledMeasure }
  | { source: "estimated"; estimate: TakeEstimate }
  | { source: "unmeasured" };

/** An estimate is a hypothesis, never a measure. Shown as « estimé », with its high bound as the gate. */
export interface TakeEstimate {
  profile: string;
  credits: number;
  creditsHigh: number;
}

/** LTX-2.5 i2v on Comfy Cloud: no billed take yet. 12–25 credits for 5 s, scaled by duration. */
export const LTX_ESTIMATE_5S = { credits: 12, creditsHigh: 25 } as const;

export function estimatedTake(profile: string): TakeEstimate | null {
  const match = /^ltx25-(\d+)s-/.exec(profile);
  if (!match) return null;
  const factor = Number(match[1]) / 5;
  return { profile, credits: Math.round(LTX_ESTIMATE_5S.credits * factor), creditsHigh: Math.round(LTX_ESTIMATE_5S.creditsHigh * factor) };
}

export function estimateSentence(estimate: Pick<TakeEstimate, "credits" | "creditsHigh">): string {
  return `Estimé : environ ${formatCredits(estimate.credits)} à ${formatCredits(estimate.creditsHigh)} crédits. Estimation, pas une mesure : aucune prise réelle facturée pour ce réglage.`;
}

/** The billed record for this exact profile, or nothing. No other profile is invented. */
export function billedMeasure(profile: string): BilledMeasure | null {
  return profile === BILLED_MEASURE.profile ? BILLED_MEASURE : null;
}

/**
 * A balance delta in Mon studio wins. Otherwise the billed record, for its one profile.
 * Anything else has not been measured.
 */
export function resolveTakeQuote(profile: string, records: readonly CostRecord[]): TakeQuote {
  const delta = costClaim(profile, records);
  if (delta.state === "measured") return { source: "balance", credits: delta.credits, at: delta.at, runs: delta.runs };
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
