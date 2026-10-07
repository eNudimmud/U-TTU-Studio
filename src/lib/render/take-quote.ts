// Last read-only quote of the wired H3 take. estimate_credits only.
// Nothing here is a charge, and a printed 0 is not a whole-run total.

export const TAKE_QUOTE = {
  readAt: "2026-10-07",
  template: "video_minimax_h3_r2v",
  profile: "h3-4pas-5s-vertical",
  /** What the estimator printed. GPU time, queue, and storage are excluded. */
  estimatorCredits: 0,
  paidApiNodes: false,
  gpuIncluded: false,
  /** A whole-run integer, once one exists. Null keeps Tourner off. */
  wholeRunCredits: null as number | null,
} as const;

/** True only when a later read names a whole-run integer that includes GPU time. */
export function takeHasWholeRunQuote(): boolean {
  return TAKE_QUOTE.gpuIncluded && typeof TAKE_QUOTE.wholeRunCredits === "number";
}
