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

/** A bar that stays on screen (fixed or sticky): where it sits right now. */
export interface Bar { top: number; bottom: number }

/**
 * The open band between the bars stuck at the top and the bars stuck at the bottom,
 * clipped to what the keyboard leaves visible. A bar counts as « top » when its middle
 * is in the upper half of the visible area: the chain is at the bottom on a phone held
 * upright, at the top in MONTAGE, in landscape and on large screens.
 * When the bars leave no room for the field (landscape with the keyboard open), the band
 * falls back to the visible area alone so the field still ends up above the keyboard.
 */
export function openBand(bars: Bar[], visibleTop: number, visibleBottom: number, fieldHeight: number): { top: number; bottom: number } {
  const middle = (visibleTop + visibleBottom) / 2;
  let top = visibleTop;
  let bottom = visibleBottom;
  for (const bar of bars) {
    if (bar.bottom <= bar.top || bar.bottom <= visibleTop || bar.top >= visibleBottom) continue;
    if ((bar.top + bar.bottom) / 2 < middle) top = Math.max(top, bar.bottom);
    else bottom = Math.min(bottom, bar.top);
  }
  const strict = { top: top + 8, bottom: bottom - 12 };
  if (strict.bottom - strict.top >= Math.min(fieldHeight, 48)) return strict;
  return { top: visibleTop + 4, bottom: visibleBottom - 8 };
}
