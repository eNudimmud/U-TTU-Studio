// Historical price gate for the retired payer. The live studio does not import this file.

import type { RunGate } from "../credits.ts";

export interface UsdBalance {
  usd: number;
  readAt: number;
}

const dollars = new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (value: number) => `${dollars.format(value)} $`;

/** `required` blocks when the balance was not read. `optional` is a key that authenticated without Admin scope. */
export type FalBalanceMode = "required" | "optional";

/**
 * Training and the old file take were quoted from a live unit price before the tap.
 * An empty balance, no quote, or a quote above a readable balance: nothing leaves.
 */
export function falGate(balance: UsdBalance | null, quote: number | null, what: "formation" | "prise", mode: FalBalanceMode = "required"): RunGate {
  const label = what === "formation" ? "Cette formation" : "Cette prise";
  if (quote === null) return { allowed: false, tone: "block", line: "Prix fal illisible. Rien ne part sans un prix." };
  if (!balance) {
    if (mode === "optional") return { allowed: true, tone: "warn", line: `${label} : ${money(quote)} au prix fal du jour. Solde non lu. Le débit part sur ton compte fal.` };
    return { allowed: false, tone: "block", line: "Solde fal illisible. Rien ne part sans lire le compte qui paiera." };
  }
  if (balance.usd <= 0) return { allowed: false, tone: "block", line: "Solde fal vide. Recharge-le sur fal.ai, puis relis-le ici." };
  if (balance.usd < quote) return { allowed: false, tone: "block", line: `Solde trop bas : ${money(balance.usd)} pour ${label.toLowerCase()} à ${money(quote)}.` };
  return { allowed: true, tone: "ok", line: `${label} : ${money(quote)} au prix fal du jour, débités sur ton compte fal.` };
}
