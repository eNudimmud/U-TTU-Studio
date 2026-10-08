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

/** One Nano Banana 2.1 still, prompted as a view sheet. About 12 credits an image. */
export const CAST_TEXT_QUOTE: CreationQuote = {
  credits: 12,
  high: 18,
  template: "api_nano_banana_2_1_t2i",
  kind: "hypothese",
};

/** One Nano Banana 2.1 edit from face photos. */
export const CAST_PHOTO_QUOTE: CreationQuote = {
  credits: 12,
  high: 18,
  template: "api_nano_banana_2_1_image_edit",
  kind: "hypothese",
};

/**
 * The view sheet: two GeminiImage2 stills at 2K, then a stitch.
 * Measured 70.74 (35.41 + 35.33) on 2026-10-08. The screen shows 71. Ceiling 100.
 */
export const CAST_SHEET_QUOTE: CreationQuote = {
  credits: 71,
  high: 100,
  template: "templates-character_sheet",
  kind: "mesure",
};

/** One Nano Banana 2.1 cinema still. */
export const DECOR_TEXT_QUOTE: CreationQuote = {
  credits: 12,
  high: 18,
  template: "api_nano_banana_2_1_t2i",
  kind: "hypothese",
};

/** One Nano Banana 2.1 edit of a place photo. */
export const DECOR_PHOTO_QUOTE: CreationQuote = {
  credits: 12,
  high: 18,
  template: "api_nano_banana_2_1_image_edit",
  kind: "hypothese",
};

/** The button stays off until the account is linked and the balance covers the ceiling. */
export function creationAllowed(connected: boolean, credits: number | null, high: number): boolean {
  return connected === true && typeof credits === "number" && Number.isFinite(credits) && Number.isFinite(high) && high > 0 && credits >= high;
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
