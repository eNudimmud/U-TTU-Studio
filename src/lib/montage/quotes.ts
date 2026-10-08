// Voice and sound-effect quotes. Hypotheses read from the chain note on 2026-10-08.
// Nothing here calls Comfy. A shown number is not a measured bill.

export const VOICE_TEMPLATE = "api_elevenlabs_v4_text_to_speech";
export const SFX_TEMPLATE = "api_elevenlabs_text_to_sound_effects";

/** Eleven v4, per 1 000 characters. Chain note: 24.14, same figure as the estimator. Not measured here. */
export const VOICE_PER_THOUSAND = 24.14;
/** Eleven sound effects, per minute. Chain note: 29.54. Not measured here. */
export const SFX_PER_MINUTE = 29.54;
/** A short effect, used when the visitor has not named a length. */
export const SFX_DEFAULT_SECONDS = 5;

export interface SoundQuote {
  credits: number;
  high: number;
  kind: "hypothese";
  template: string;
}

function ceiling(credits: number): number {
  return Math.max(credits, Math.ceil(credits * 1.5));
}

/** Zero characters has no bill. The screen shows the rate instead. */
export function voiceQuote(characters: number): SoundQuote | null {
  if (!Number.isFinite(characters) || characters <= 0) return null;
  const credits = Math.max(1, Math.round((VOICE_PER_THOUSAND * characters) / 1000));
  return { credits, high: ceiling(credits), kind: "hypothese", template: VOICE_TEMPLATE };
}

export function sfxQuote(seconds: number): SoundQuote | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const credits = Math.max(1, Math.round((SFX_PER_MINUTE * seconds) / 60));
  return { credits, high: ceiling(credits), kind: "hypothese", template: SFX_TEMPLATE };
}
