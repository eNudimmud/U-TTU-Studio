// What the screen says before an export. The byte count is an estimate, not a measurement.

export const EXPORT_FPS = 12;
export const EXPORT_WIDTH = 960;
export const EXPORT_HEIGHT = 540;
/** Guess for a low-quality H.264 picture at the export size. The file itself is the measure. */
export const EXPORT_VIDEO_BPS = 800_000;
export const EXPORT_AUDIO_BPS = 128_000;
/** A phone tab runs out of memory past this. The button stays off. */
export const EXPORT_MAX_SECONDS = 60;

export interface ExportEstimate {
  seconds: number;
  bytes: number;
  frames: number;
}

export function exportEstimate(seconds: number): ExportEstimate | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const frames = Math.max(1, Math.round(seconds * EXPORT_FPS));
  const bytes = Math.ceil(((EXPORT_VIDEO_BPS + EXPORT_AUDIO_BPS) * seconds) / 8);
  return { seconds, bytes, frames };
}

export function exportAllowed(seconds: number): boolean {
  const estimate = exportEstimate(seconds);
  return estimate !== null && estimate.seconds <= EXPORT_MAX_SECONDS;
}
