// « Doubler une prise »: VEED Dubbing (partner node VeedDubbingNode, template api_veed_dubbing),
// read on Comfy Cloud 30.10.2026. It translates the speech of a clip, clones the voice and
// re-syncs the lips. Billed per second of the dubbed video: estimate_credits gives 33 credits/s
// on standard and 54 credits/s on pro. No studio run has been billed yet: the quote is an estimate.
// Pure functions: nothing here opens a network.

import type { ApiGraph } from "../render/take-graph.ts";

export const VEED_TEMPLATE = "api_veed_dubbing";
export const VEED_NODE = "VeedDubbingNode";

export const VEED_TIERS = ["standard", "pro"] as const;
export type VeedTier = (typeof VEED_TIERS)[number];
export const VEED_CREDITS_PER_SECOND: Record<VeedTier, number> = { standard: 33, pro: 54 };
/** The node takes up to 599 seconds; the dubbed video is as long as its audio track. */
export const VEED_MAX_SECONDS = 599;

/** The languages offered in the panel. Each maps to the node's own value per tier. */
export const VEED_CIBLES = ["en", "fr", "de", "es", "it", "pt", "ja", "zh"] as const;
export type VeedCible = (typeof VEED_CIBLES)[number];
export const VEED_SOURCES = ["auto", "fr", "en", "de", "es", "it"] as const;
export type VeedSource = (typeof VEED_SOURCES)[number];

const CIBLE: Record<VeedTier, Record<VeedCible, string>> = {
  standard: { en: "English", fr: "French", de: "German", es: "Spanish", it: "Italian", pt: "Portuguese", ja: "Japanese", zh: "Chinese (Mandarin)" },
  pro: { en: "English (US)", fr: "French (France)", de: "German", es: "Spanish (Spain)", it: "Italian", pt: "Portuguese (Portugal)", ja: "Japanese", zh: "Chinese (Mandarin)" },
};
const SOURCE: Record<Exclude<VeedSource, "auto">, string> = { fr: "French", en: "English", de: "German", es: "Spanish", it: "Italian" };

export interface VeedChoix { tier: VeedTier; cible: VeedCible; source: VeedSource }
export const VEED_DEFAULT: VeedChoix = { tier: "standard", cible: "en", source: "auto" };

export function veedChoix(value: Partial<VeedChoix> | undefined): VeedChoix {
  const tier = value?.tier ?? VEED_DEFAULT.tier;
  const cible = value?.cible ?? VEED_DEFAULT.cible;
  const source = value?.source ?? VEED_DEFAULT.source;
  if (!VEED_TIERS.includes(tier)) throw new Error("Version VEED invalide.");
  if (!VEED_CIBLES.includes(cible)) throw new Error("Langue VEED invalide.");
  if (!VEED_SOURCES.includes(source)) throw new Error("Langue VEED invalide.");
  return { tier, cible, source };
}

/** The node's values for one choice. */
export function veedLangues(choix: VeedChoix): { target_language: string; source_language: string } {
  const sure = veedChoix(choix);
  return { target_language: CIBLE[sure.tier][sure.cible], source_language: sure.source === "auto" ? "auto" : SOURCE[sure.source] };
}

/** Same language in and out: nothing to dub. */
export function veedMemeLangue(choix: VeedChoix): boolean {
  return choix.source !== "auto" && choix.source === choix.cible;
}

export function veedSeconds(seconds: number | undefined): number | null {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, VEED_MAX_SECONDS) : null;
}

/** Per second of the dubbed video, rounded up; high leaves room for a translation longer than the source. */
export function veedQuote(seconds: number | undefined, tier: VeedTier = VEED_DEFAULT.tier) {
  const duration = veedSeconds(seconds);
  if (duration === null) return null;
  if (!VEED_TIERS.includes(tier)) throw new Error("Version VEED invalide.");
  const credits = Math.ceil(VEED_CREDITS_PER_SECOND[tier] * duration);
  return { credits, high: Math.ceil(credits * 1.5), kind: "estime" as const };
}

// Converted from the official template api_veed_dubbing (Comfy Cloud, 30.10.2026): LoadVideo 1 →
// VEED Dubbing 5 → SaveVideo 3. The Markdown note is dropped.
export const VEED_BASE: ApiGraph = {
  "1": { inputs: { file: "api_veed_dubbing_input_video.mp4" }, class_type: "LoadVideo" },
  "5": {
    inputs: { model: "standard", "model.video": ["1", 0], "model.target_language": "Japanese", "model.source_language": "auto", "model.seed": 42 },
    class_type: VEED_NODE,
  },
  "3": { inputs: { filename_prefix: "video/veed_dubbing", format: "auto", "format.codec": "auto", video: ["5", 0] }, class_type: "SaveVideo" },
};
