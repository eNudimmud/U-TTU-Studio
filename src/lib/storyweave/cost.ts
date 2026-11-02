// What a StoryWeave control may print. A missing or unmeasured figure is never
// shown as zero and never invented: the screen says the price comes before launch.

export type CostLine = { kind: "estimated"; credits: number } | { kind: "before-launch" };

/** A positive finite number is an estimate. Anything else is not a price. */
export function costLine(credits: number | null | undefined): CostLine {
  if (typeof credits === "number" && Number.isFinite(credits) && credits > 0) return { kind: "estimated", credits };
  return { kind: "before-launch" };
}
