// One estimate per « Et ensuite ? » tool, read from the registry row. Always « estimé »:
// none of these graphs has been billed on a real run yet. The reserve (high) is what the
// balance must cover before anything leaves.

import { gesteParId, type Geste } from "../workflows/registre.ts";
import { SUITE_SECONDS, type SuiteGeste } from "./graphs.ts";

export interface SuiteQuote {
  credits: number;
  high: number;
  kind: "estime";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Finaliser vidéo and Fluidifier scale with length: one estimate per started block of
 * five seconds. Fluidifier inside Finaliser adds its own estimate.
 */
export function suiteQuote(geste: SuiteGeste, options: { seconds?: number; fluidifier?: boolean } = {}): SuiteQuote | null {
  const row: Geste | null = gesteParId(geste);
  if (!row || row.credits === null || row.high === null) return null;
  const perLength = geste === "suite-finaliser-video" || geste === "suite-fluidifier";
  const seconds = Number.isFinite(options.seconds) && (options.seconds ?? 0) > 0 ? options.seconds! : SUITE_SECONDS;
  const blocks = perLength ? Math.max(1, Math.ceil(seconds / SUITE_SECONDS - 1e-9)) : 1;
  let credits = row.credits * blocks;
  let high = row.high * blocks;
  if (geste === "suite-finaliser-video" && options.fluidifier) {
    const extra = suiteQuote("suite-fluidifier", { seconds });
    if (!extra) return null;
    credits += extra.credits;
    high += extra.high;
  }
  return { credits: round1(credits), high: round1(high), kind: "estime" };
}
