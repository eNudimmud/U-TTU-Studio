// Quotes for CAST and DÉCOR. These numbers are hypotheses, not a measured bill.
// Nothing here calls Comfy. A missing number never becomes a spend.

export interface CreationQuote {
  /** Shown as « environ N crédits ». */
  credits: number;
  /** Ceiling written next to the estimate. Not a measured bound. */
  high: number;
  template: string;
  kind: "hypothese";
}

/** Flux.3 Image, one still. See docs/TEMPLATES-COMFY.md. */
export const CAST_TEXT_QUOTE: CreationQuote = {
  credits: 8,
  high: 12,
  template: "api_bfl_flux3_t2i",
  kind: "hypothese",
};

/** Gemini turnaround, two images (close-up and full body). */
export const CAST_PHOTO_QUOTE: CreationQuote = {
  credits: 16,
  high: 24,
  template: "templates-character_sheet",
  kind: "hypothese",
};

/** Flux.3 Image, one cinema still. */
export const DECOR_TEXT_QUOTE: CreationQuote = {
  credits: 8,
  high: 12,
  template: "api_bfl_flux3_t2i",
  kind: "hypothese",
};

/** Flux.3 Image edit, one place photo in, one still out. */
export const DECOR_PHOTO_QUOTE: CreationQuote = {
  credits: 8,
  high: 12,
  template: "api_bfl_flux3_image_edit",
  kind: "hypothese",
};

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
