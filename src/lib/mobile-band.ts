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

export type MenuPlace = "above" | "below" | "sheet";

export interface MenuBox {
  place: MenuPlace;
  top: number;
  left: number;
  maxHeight: number;
  width: number;
}

/**
 * Puts a menu inside the open band (between the sticky header and the tab bar).
 * Prefers above the anchor, then below; if neither fits, docks as a sheet
 * inside the band (above the tabs). Horizontal position is clamped to the viewport.
 */
export function placeMenu(input: {
  anchor: { top: number; bottom: number; left: number; width: number };
  size: { width: number; height: number };
  band: { top: number; bottom: number };
  viewportWidth: number;
  gap?: number;
  margin?: number;
}): MenuBox {
  const gap = input.gap ?? 8;
  const margin = input.margin ?? 8;
  const width = Math.min(input.size.width, Math.max(0, input.viewportWidth - margin * 2));
  let left = input.anchor.left;
  left = Math.min(Math.max(margin, left), Math.max(margin, input.viewportWidth - margin - width));

  const bandTop = input.band.top + margin;
  const bandBottom = input.band.bottom - margin;
  const bandH = Math.max(0, bandBottom - bandTop);
  const need = input.size.height;
  const above = input.anchor.top - gap - bandTop;
  const below = bandBottom - (input.anchor.bottom + gap);

  if (above >= need && above >= below) {
    const natural = input.anchor.top - gap - need;
    const top = Math.max(bandTop, natural);
    const maxHeight = Math.min(need, input.anchor.top - gap - top);
    return { place: "above", top, left, maxHeight: Math.max(48, maxHeight), width };
  }
  if (below >= need) {
    return { place: "below", top: input.anchor.bottom + gap, left, maxHeight: need, width };
  }
  // Sheet: fill the band. Prefer sitting just above the tabs (bottom-aligned in the band).
  const maxHeight = Math.max(48, Math.min(need, bandH));
  const top = Math.max(bandTop, bandBottom - maxHeight);
  return {
    place: "sheet",
    top,
    left: margin,
    maxHeight,
    width: Math.min(Math.max(width, input.viewportWidth - margin * 2), input.viewportWidth - margin * 2),
  };
}
