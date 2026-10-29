// ComfyUI/comfy_api_nodes/nodes_higgsfield.py price_badge, verified 2026-10-28.
// Public tariff estimate only; no generation of this Studio flow has been billed.
export const GENJUTSU_TEMPLATE = "api_higgsfield_genjutsu_motion_transfer";
export const GENJUTSU_RESOLUTIONS = ["480p", "720p", "1080p"] as const;
export type GenjutsuResolution = (typeof GENJUTSU_RESOLUTIONS)[number];
export const GENJUTSU_DEFAULT_RESOLUTION: GenjutsuResolution = "480p";
export const GENJUTSU_USD_PER_SECOND = { "480p": .45474, "720p": .97383, "1080p": 2.33376 } as const;

export function genjutsuResolution(value: unknown): GenjutsuResolution {
  if (value === undefined) return GENJUTSU_DEFAULT_RESOLUTION;
  if (GENJUTSU_RESOLUTIONS.includes(value as GenjutsuResolution)) return value as GenjutsuResolution;
  throw new Error("Résolution Genjutsu invalide.");
}

/** The official node uses the first 30 seconds; shorter than 4 s is invalid. */
export function genjutsuSeconds(seconds: number | undefined): number | null {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 4 ? Math.min(seconds, 30) : null;
}

export function genjutsuQuote(seconds: number | undefined, resolution?: GenjutsuResolution) {
  const duration = genjutsuSeconds(seconds);
  if (duration === null) return null;
  const size = genjutsuResolution(resolution);
  const credits = Math.ceil(GENJUTSU_USD_PER_SECOND[size] * duration * 211);
  return { credits, high: Math.ceil(credits * 1.5), kind: "estime" as const };
}
