// One payer: the adherent's own Comfy Cloud account. The studio reads the
// balance that will be charged, and quotes a take's cost only once a take with
// the same settings has been measured from two real balance readings.

import { COMFY_CLOUD } from "./comfy-stack.ts";

export const CREDITS_PER_USD = COMFY_CLOUD.creditsPerUsd;

/** Comfy reports balances in US cents even where the field says micros. */
export const centsToCredits = (cents: number) => Math.round((cents * CREDITS_PER_USD) / 100);

const group = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 0 });
export const formatCredits = (value: number) => group.format(Math.round(value));

export interface Balance {
  credits: number;
  readAt: number;
}

/** What one finished take cost, as the vault keeps it. */
export interface CostRecord {
  profile: string;
  credits: number | null;
  gpuSeconds: number | null;
  at: string;
}

export type CostClaim =
  | { state: "uncalibrated" }
  | { state: "measured"; credits: number; at: string; runs: number };

/** The highest of the last three measured takes at this setting, or no claim at all. */
export function costClaim(profile: string, records: readonly CostRecord[]): CostClaim {
  const measured = records
    .filter(record => record.profile === profile && typeof record.credits === "number" && record.credits >= 0)
    .sort((a, b) => a.at.localeCompare(b.at));
  if (measured.length === 0) return { state: "uncalibrated" };
  const recent = measured.slice(-3);
  return {
    state: "measured",
    credits: Math.max(...recent.map(record => record.credits as number)),
    at: measured[measured.length - 1].at,
    runs: measured.length,
  };
}

export type RunGate = { allowed: boolean; tone: "ok" | "warn" | "block"; line: string };

const day = new Intl.DateTimeFormat("fr-CH", { day: "numeric", month: "short" });

/** What a measured claim stands on, in the words the studio shows. */
export function claimBasis(claim: Extract<CostClaim, { state: "measured" }>): string {
  return claim.runs > 1 ? `la plus chère de tes ${Math.min(claim.runs, 3)} dernières prises à ce réglage` : `ta prise du ${day.format(new Date(claim.at))} à ce réglage`;
}

export function runGate(balance: Balance | null, claim: CostClaim): RunGate {
  if (!balance) return { allowed: false, tone: "block", line: "Solde illisible. Rien ne part sans lire le compte qui paiera." };
  if (balance.credits <= 0) return { allowed: false, tone: "block", line: "Solde vide sur ton compte de rendu." };
  if (claim.state === "uncalibrated") {
    return { allowed: false, tone: "block", line: "Devis absent. Le total de cette prise n’est pas un nombre. Rien ne part." };
  }
  const basis = claimBasis(claim);
  if (balance.credits < claim.credits) {
    return {
      allowed: false,
      tone: "block",
      line: `Solde trop bas : ${formatCredits(balance.credits)} crédits. Il en faut environ ${formatCredits(claim.credits)}, mesuré sur ${basis}.`,
    };
  }
  return { allowed: true, tone: "ok", line: `Environ ${formatCredits(claim.credits)} crédits, mesuré sur ${basis}.` };
}

/** Two real readings around a take. A top-up in between makes it unreadable. */
export function measuredCost(before: number | null, after: number | null): number | null {
  if (before === null || after === null) return null;
  const spent = before - after;
  return spent >= 0 ? spent : null;
}
