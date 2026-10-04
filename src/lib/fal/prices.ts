// What the adherent's own LoRA costs on fal, quoted before any paid tap from
// the account's live unit price. An unknown billing unit gives no quote, and
// no quote keeps the button off.

import type { FalPrice } from "./client.ts";

/** Trains a MiniMax H3 reference-to-video LoRA: the take's own model family. */
export const LORA_TRAINER = "minimax/h3/ref2va/trainer";
/** H3 reference-to-video that loads LoRA files by URL. */
export const LORA_TAKE = "minimax/h3/reference-to-video/lora";

export type LoraResolution = "480P" | "768P";

/** fal's published prices, read on fal.ai on 3 October 2026. The live unit price wins; these give the 768p ratio. */
export const FAL_PUBLISHED = {
  checkedOn: "2026-10-03",
  trainerPerStep: 0.015,
  trainerMinSteps: 100,
  takePerSecond: { "480P": 0.0625, "768P": 0.075 } as Record<LoraResolution, number>,
} as const;

/** "step", "steps", "1000 steps" → how many of that thing one unit price buys. */
function perUnit(unit: string, kind: RegExp): number | null {
  const match = /^\s*(?:per\s+)?(\d+(?:[.,]\d+)?)?\s*([a-z_ -]+?)s?\s*$/i.exec(unit.trim());
  if (!match || !kind.test(match[2])) return null;
  const size = match[1] ? Number(match[1].replace(",", ".")) : 1;
  return Number.isFinite(size) && size > 0 ? size : null;
}

const ceilCents = (value: number) => Math.ceil(value * 100 - 1e-9) / 100;

function usable(price: FalPrice | null): price is FalPrice {
  return Boolean(price && price.currency === "USD" && Number.isFinite(price.unitPrice) && price.unitPrice > 0);
}

/** fal bills a training `max(100, steps)` step units. */
export function trainingQuote(price: FalPrice | null, steps: number): number | null {
  if (!usable(price)) return null;
  const size = perUnit(price.unit, /^step$/i);
  if (size === null) return null;
  return ceilCents((Math.max(FAL_PUBLISHED.trainerMinSteps, Math.round(steps)) / size) * price.unitPrice);
}

/**
 * A place is stills, and the H3 trainer refuses an image-only archive.
 * These two endpoints already exist for Flux stills. They never enter the H3 take graph.
 */
export const PLACE_TRAINER = "fal-ai/flux-lora-fast-training";
export const PLACE_SCENE = "fal-ai/flux-lora";

/** fal bills a take per second of video; 768p costs fal's published 480p→768p ratio more. */
export function loraTakeQuote(price: FalPrice | null, seconds: number, resolution: LoraResolution): number | null {
  if (!usable(price)) return null;
  const size = perUnit(price.unit, /^(second|sec|s|video second)$/i);
  if (size === null) return null;
  const ratio = FAL_PUBLISHED.takePerSecond[resolution] / FAL_PUBLISHED.takePerSecond["480P"];
  return ceilCents((seconds / size) * price.unitPrice * ratio);
}

/** Same step unit as a character training. An unknown unit leaves the button off. */
export function placeTrainQuote(price: FalPrice | null, steps: number): number | null {
  return trainingQuote(price, steps);
}

/** A new still of the place. Megapixels or one image; anything else is no quote. */
export function placeSceneQuote(price: FalPrice | null, width: number, height: number): number | null {
  if (!usable(price)) return null;
  const mega = perUnit(price.unit, /^megapixel$/i);
  if (mega !== null) {
    const billed = Math.max(1, (width * height) / 1_000_000);
    return ceilCents((billed / mega) * price.unitPrice);
  }
  const image = perUnit(price.unit, /^image$/i);
  if (image !== null) return ceilCents(price.unitPrice / image);
  return null;
}

const usd = new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatUsd = (value: number) => `${usd.format(value)} $`;
