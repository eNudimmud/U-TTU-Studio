/**
 * How far to scroll so a focused field sits in the open band
 * (below the sticky header, above the chain or the keyboard).
 * A positive result scrolls the page down.
 */
export function liftDelta(
  field: { top: number; bottom: number },
  bandTop: number,
  bandBottom: number,
): number {
  const height = field.bottom - field.top;
  const band = bandBottom - bandTop;
  if (band <= 0) return 0;
  if (height >= band) return field.top - bandTop;
  if (field.bottom > bandBottom) return field.bottom - bandBottom;
  if (field.top < bandTop) return field.top - bandTop;
  return 0;
}
