// CE5 · the contest campaign limit (CE5 §3: 300 crédits, including the agent and the known prior runs).
// `priorCredits` is a plain configured number, not a secret: what the Comfy account already spent since
// JD approved the campaign budget (31.10.2026 22:14 Zurich, cap 300, his yes per tranche), read from the
// account's invoice-backed usage report (read-only), rounded UP, so it may over-count, never under-count.
//
// Source (2026-11-01, report up to 17:00 UTC): GPU Hours $0.0650 (hour bucket 31.10 21:00 UTC, counted
// whole though its one job finished 2 min before the approval) + $0.1658 (1.11 00:00 UTC) = $0.2308,
// × 211 crédits/$ (Comfy rate) = 48.7 → 49. No partner-node spend in that window.
// Each browser's spend ledger adds what the app reserves after that. Spend made outside the app
// (other tools, other machines) is not seen by the ledger: update this value before each test tranche.
// Revert = set `priorCredits` back to null: every paid cinema submission is then refused again.
import type { CampaignLimit } from "./spend-ledger.ts";

export const CAMPAIGN: CampaignLimit & { asOf: string } = { capCredits: 300, priorCredits: 49, asOf: "2026-11-01T17:00:00Z" };
