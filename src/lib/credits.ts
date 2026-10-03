// What a paid cloud run costs, shown before the click. Estimates stay labelled.
// The Comfy balance is read from the visitor's own session inside the frame
// and stays in this browser. The usage journal stays on this device.

import {
  COMFY_CLOUD, DATASET_SIZE, FLUX_STACK, estimateGpuSeconds, estimatePromptTest, estimateTrainRun, type Range, type RunEstimate,
} from "./comfy-stack.ts";
import { FAL_TRAINING, estimateFalTrain, estimateFalVary, formatUsd } from "./fal-stack.ts";

/** One MiniMax H3 reference clip as the template ships it (5 s, 124 frames). GPU time is a hypothesis until a run is recorded. */
export const TAKE_TIMING = {
  measured: false,
  full: { steps: 20, seconds: { low: 240, high: 720 } },
  turbo: { steps: 4, seconds: { low: 90, high: 240 } },
} as const;

export function estimateTake(turbo: boolean): RunEstimate {
  return estimateGpuSeconds(TAKE_TIMING[turbo ? "turbo" : "full"].seconds);
}

/** Comfy reports balances in US cents even where the field says micros. */
export const centsToCredits = (cents: number) => Math.round((cents * COMFY_CLOUD.creditsPerUsd) / 100);

const group = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 0 });
export const formatCredits = (value: number) => group.format(Math.round(value));
export const formatCreditRange = (range: Range) => `${formatCredits(range.low)} à ${formatCredits(range.high)} crédits`;

export interface PriceLine {
  id: string;
  label: string;
  value: string;
  payer: "toi" | "studio";
}

export function priceList(): PriceLine[] {
  return [
    { id: "take", label: `La prise · ${TAKE_TIMING.full.steps} pas`, value: formatCreditRange(estimateTake(false).credits), payer: "toi" },
    { id: "take-turbo", label: `La prise · turbo ${TAKE_TIMING.turbo.steps} pas`, value: formatCreditRange(estimateTake(true).credits), payer: "toi" },
    { id: "former", label: `Former mon look · ${FLUX_STACK.training.steps} pas`, value: formatCreditRange(estimateTrainRun(FLUX_STACK.training.steps, 1).credits), payer: "toi" },
    { id: "image", label: "Une image d’essai", value: formatCreditRange(estimatePromptTest().credits), payer: "toi" },
    { id: "lot", label: `${DATASET_SIZE} images préparées`, value: `≈ ${formatUsd(estimateFalVary(DATASET_SIZE).usd)}`, payer: "studio" },
    { id: "train", label: `Entraînement · ${FAL_TRAINING.steps} pas`, value: `≈ ${formatUsd(estimateFalTrain(FAL_TRAINING.steps).usd)}`, payer: "studio" },
  ];
}

export const USAGE_KEY = "u-ttu-usage";
export const USAGE_MAX = 40;
export const USAGE_LABEL_MAX = 60;

export type UsageEngine = "comfy" | "fal";

/** Comfy lines count credits. Studio lines count US dollars. */
export interface UsageLine {
  id: string;
  date: string;
  engine: UsageEngine;
  label: string;
  low: number;
  high: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanLine(value: unknown): UsageLine | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim().slice(0, 40) : "";
  const date = typeof row.date === "string" && DATE.test(row.date) ? row.date : "";
  const engine = row.engine === "comfy" || row.engine === "fal" ? row.engine : null;
  const label = typeof row.label === "string" ? row.label.replace(/\s+/g, " ").trim().slice(0, USAGE_LABEL_MAX) : "";
  const low = typeof row.low === "number" && Number.isFinite(row.low) && row.low >= 0 ? row.low : null;
  const high = typeof row.high === "number" && Number.isFinite(row.high) && row.high >= 0 ? row.high : null;
  if (!id || !date || !engine || !label || low === null || high === null || high < low || high > 1_000_000) return null;
  return { id, date, engine, label, low, high };
}

export function parseUsage(raw: string | null | undefined): UsageLine[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    const rows = data && typeof data === "object" && Array.isArray((data as { lines?: unknown }).lines) ? (data as { lines: unknown[] }).lines : [];
    return rows.flatMap(row => {
      const line = cleanLine(row);
      return line ? [line] : [];
    }).slice(-USAGE_MAX);
  } catch {
    return [];
  }
}

export function serializeUsage(lines: readonly UsageLine[]): string {
  return JSON.stringify({ lines: lines.slice(-USAGE_MAX) });
}

export function addUsage(lines: readonly UsageLine[], next: UsageLine): UsageLine[] {
  const line = cleanLine(next);
  if (!line) return [...lines];
  return [...lines, line].slice(-USAGE_MAX);
}

export function readUsage(storage: { getItem(key: string): string | null } | null): UsageLine[] {
  try {
    return storage ? parseUsage(storage.getItem(USAGE_KEY)) : [];
  } catch {
    return [];
  }
}

export function saveUsage(storage: { setItem(key: string, value: string): void } | null, lines: readonly UsageLine[]): boolean {
  try {
    if (!storage) return false;
    storage.setItem(USAGE_KEY, serializeUsage(lines));
    return true;
  } catch {
    return false;
  }
}

export function usageStamp(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export interface UsageTotal {
  count: number;
  low: number;
  high: number;
}

export function monthUsage(lines: readonly UsageLine[], now = new Date()): Record<UsageEngine, UsageTotal> {
  const month = usageStamp(now).slice(0, 7);
  const total = (): UsageTotal => ({ count: 0, low: 0, high: 0 });
  const sums: Record<UsageEngine, UsageTotal> = { comfy: total(), fal: total() };
  for (const line of lines) {
    if (!line.date.startsWith(month)) continue;
    const sum = sums[line.engine];
    sum.count += 1;
    sum.low += line.low;
    sum.high += line.high;
  }
  return sums;
}

export interface CreditsReading {
  credits: number;
  readAt: number;
}

/** A balance posted by the frame. Anything malformed is dropped. */
export function readCreditsMessage(data: unknown): CreditsReading | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.type !== "uttu-credits") return null;
  const credits = row.credits;
  const readAt = row.readAt;
  if (typeof credits !== "number" || !Number.isFinite(credits) || Math.abs(credits) > 1e9) return null;
  if (typeof readAt !== "number" || !Number.isFinite(readAt) || readAt <= 0) return null;
  return { credits: Math.round(credits), readAt };
}

export interface RunReading {
  label: string;
  low: number | null;
  high: number | null;
  accepted: boolean;
}

/** A run the visitor confirmed or refused in the frame. */
export function readRunMessage(data: unknown): RunReading | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (row.type !== "uttu-run" || typeof row.accepted !== "boolean") return null;
  const label = typeof row.label === "string" ? row.label.replace(/\s+/g, " ").trim().slice(0, USAGE_LABEL_MAX) : "";
  if (!label) return null;
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000 ? value : null);
  const low = number(row.low);
  const high = number(row.high);
  if ((low === null) !== (high === null) || (low !== null && high !== null && high < low)) return null;
  return { label, low, high, accepted: row.accepted };
}
