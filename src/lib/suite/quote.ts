// One quote per « Et ensuite ? » tool, read from the registry row. Shown « estimé »: the rows
// marked « mesure » were billed once on 27.10.2026 (docs/mesures/test-visiteur-2026-10-27.md),
// a next run can still differ. The reserve (high) is what the balance must cover before anything leaves.

import { gesteParId, type Geste } from "../workflows/registre.ts";
import { FINAL_SHORTER, SUITE_SECONDS, type SuiteGeste } from "./graphs.ts";

export interface SuiteQuote {
  credits: number;
  high: number;
  kind: "estime";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** What the clip to upscale is, read in the browser before anything leaves. Missing = studio defaults. */
export interface FinaliserSource { width?: number; height?: number; fps?: number }

/**
 * SeedVR2 bills per output frame and output size: credits ≈ RATE × frames × output megapixels,
 * the shorter side always going to FINAL_SHORTER (1080). Calibrated on real runs:
 *   27.10 job 414d76ab: 5 s 832×480 (Wan, 16 fps → 81 frames) → 1872×1080 : 27,50 crédits
 *   31.10, 7 runs: 5,17 s 1280×736 H3 (24 fps → 124 frames) → 1878×1080 : 41 à 43 crédits
 * Both give ≈ 0,167 crédit per frame-megapixel. The old flat 28 per 5 s block was the 16 fps
 * case and under-quoted every 24 fps clip by half.
 */
export const FINALISER_RATE = 0.167;
/** Unknown frame rate: the studio's clips (LTX, H3) run at 24 fps. The upload keeps at most 30. */
export const FINALISER_FPS = 24;
const FINALISER_MAX_FPS = 30;
const FINALISER_MARGIN = 1.5;

export function finaliserVideoCredits(seconds: number, source: FinaliserSource = {}): { credits: number; high: number } {
  const width = source.width && source.width > 0 ? source.width : 1280;
  const height = source.height && source.height > 0 ? source.height : 720;
  const fps = source.fps && Number.isFinite(source.fps) && source.fps > 0 ? Math.min(source.fps, FINALISER_MAX_FPS) : FINALISER_FPS;
  const scale = FINAL_SHORTER / Math.min(width, height);
  const megapixels = Math.round(width * scale) * Math.round(height * scale) / 1e6;
  const frames = Math.max(1, Math.round(seconds * fps));
  const credits = FINALISER_RATE * frames * megapixels;
  return { credits, high: credits * FINALISER_MARGIN };
}

/**
 * Finaliser vidéo and Fluidifier scale with length: one estimate per started block of
 * five seconds. Fluidifier inside Finaliser adds its own estimate.
 */
export function suiteQuote(geste: SuiteGeste, options: { seconds?: number; fluidifier?: boolean; source?: FinaliserSource } = {}): SuiteQuote | null {
  const row: Geste | null = gesteParId(geste);
  if (!row || row.credits === null || row.high === null) return null;
  const perLength = geste === "suite-finaliser-video" || geste === "suite-fluidifier";
  const seconds = Number.isFinite(options.seconds) && (options.seconds ?? 0) > 0 ? options.seconds! : SUITE_SECONDS;
  // Same 0.25 s grace as outilQuote: a 5.04 s studio clip must stay one block.
  const blocks = perLength ? Math.max(1, Math.ceil(Math.max(0, seconds - 0.25) / SUITE_SECONDS - 1e-9)) : 1;
  let credits = row.credits * blocks;
  let high = row.high * blocks;
  if (geste === "suite-finaliser-video") ({ credits, high } = finaliserVideoCredits(seconds, options.source));
  if (geste === "suite-finaliser-video" && options.fluidifier) {
    const extra = suiteQuote("suite-fluidifier", { seconds });
    if (!extra) return null;
    credits += extra.credits;
    high += extra.high;
  }
  return { credits: round1(credits), high: round1(high), kind: "estime" };
}
