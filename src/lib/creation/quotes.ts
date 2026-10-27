// Quotes for CAST and DÉCOR. These numbers are hypotheses, not a measured bill.
// Nothing here calls Comfy. A missing number never becomes a spend.

export interface CreationQuote {
  /** Shown as « environ N crédits ». */
  credits: number;
  /** Ceiling written next to the estimate. Not a measured bound. */
  high: number;
  template: string;
  kind: "hypothese" | "mesure";
}

/**
 * One FLUX 3 Image Klein still (open weights, GPU time only).
 * Klein runs measured 2.6 to 4 credits on 2026-10-15 (0.27 credit a GPU-second).
 */
export const CAST_TEXT_QUOTE: CreationQuote = {
  credits: 4,
  high: 6,
  template: "image_flux3_klein_t2i",
  kind: "mesure",
};

/** One FLUX 3 Klein reference edit from face photos. Same files as text-to-image. */
export const CAST_PHOTO_QUOTE: CreationQuote = {
  credits: 4,
  high: 6,
  template: "image_flux3_klein_image_edit",
  kind: "hypothese",
};

/**
 * The view sheet: two FLUX 3 Image (partner) edits at 1K, then a stitch.
 * estimate_credits read 14 credits a FLUX 3 Image edit on 2026-10-16. Not measured.
 */
export const CAST_SHEET_QUOTE: CreationQuote = {
  credits: 28,
  high: 42,
  template: "api_bfl_flux3_image_edit",
  kind: "hypothese",
};

/** One FLUX 3 Klein cinema still. Measured 2.6 to 4 credits (DÉCOR examples, #109). */
export const DECOR_TEXT_QUOTE: CreationQuote = {
  credits: 4,
  high: 6,
  template: "image_flux3_klein_t2i",
  kind: "mesure",
};

/** One FLUX 3 Klein edit of a place photo. */
export const DECOR_PHOTO_QUOTE: CreationQuote = {
  credits: 4,
  high: 6,
  template: "image_flux3_klein_image_edit",
  kind: "mesure",
};

/**
 * Linked account whose known balance covers the ceiling.
 * An unread/null balance is not "too low": never block as insufficient when the
 * amount is unknown (header blank / transient balance read). Cloud still 402s.
 */
export function creationAllowed(connected: boolean, credits: number | null, high: number): boolean {
  if (connected !== true || !Number.isFinite(high) || high <= 0) return false;
  if (credits === null || !Number.isFinite(credits)) return true;
  return credits >= high;
}

export function quoteForCast(source: "texte" | "photos"): CreationQuote {
  return source === "photos" ? CAST_PHOTO_QUOTE : CAST_TEXT_QUOTE;
}

export function quoteForDecor(source: "texte" | "photo"): CreationQuote {
  return source === "photo" ? DECOR_PHOTO_QUOTE : DECOR_TEXT_QUOTE;
}

/**
 * A spend is allowed only after a real number and an explicit confirm.
 * Zero, NaN, or a missing quote stays closed. Confirm alone is not enough.
 */
export function spendAllowed(quote: number | null | undefined, confirmed: boolean): boolean {
  return confirmed === true && typeof quote === "number" && Number.isFinite(quote) && quote > 0;
}
