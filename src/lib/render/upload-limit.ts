// Every file the studio sends to Comfy Cloud transits the same-origin relay
// (src/proxy.ts), because cloud.comfy.org sends no CORS headers. On Vercel that
// relay refuses a request body above ~4 MB with 413, before Comfy sees it.
// A 5 s phone clip (1080p, 30 fps) weighs 8 to 20 MB: it never left the phone.

/** Largest file sent in one upload, leaving room for the multipart envelope. */
export const UPLOAD_MAX_BYTES = 3_800_000;

/** French source line; phrase.ts maps it per locale (runtime.uploadHeavy). */
export const UPLOAD_HEAVY = "Fichier trop lourd pour l’envoi : 3,8 Mo au plus. Prends un clip plus court ou une photo plus légère.";

export function uploadTooHeavy(bytes: number): boolean {
  return bytes > UPLOAD_MAX_BYTES;
}

// Wan Animate (video_wan_animate2) works in 81-frame windows and the graph loops
// over the whole source: a 30 fps 5 s clip is two windows, twice the quote.
// One window at 16 fps (5,06 s) is what the 17 crédits estimés were measured on.
export const POSE_FPS = 16;
export const POSE_FRAMES = 81;
const BOX = { width: 482, height: 854 };

export interface PoseTarget { width: number; height: number; frameRate: number; end: number }

/** Size and length the pose video is re-encoded to before upload. Pure, unit-tested. */
export function poseVideoTarget(source: { width: number; height: number; seconds: number | null }): PoseTarget {
  const window = POSE_FRAMES / POSE_FPS;
  const end = source.seconds && Number.isFinite(source.seconds) && source.seconds > 0 ? Math.min(source.seconds, window) : window;
  const w = Math.max(2, source.width || BOX.width);
  const h = Math.max(2, source.height || BOX.height);
  // Cover the 482×854 box the graph centre-crops to; never upscale.
  const scale = Math.min(1, Math.max(BOX.width / w, BOX.height / h));
  const even = (value: number) => Math.max(2, Math.ceil(value / 2) * 2);
  return { width: even(w * scale), height: even(h * scale), frameRate: POSE_FPS, end };
}
