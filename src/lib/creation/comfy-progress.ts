// Shared wait progress for every long Comfy tool. Comfy's job status is stage-only
// (queue / prepare / render) — no percent — so we ease toward ~95 % from a typical
// duration, then crawl until the job finishes. Pure: no React, no network.

/** Typical wall-clock seconds once the job is on GPU (queue not included). */
export const TYPICAL_WAIT_SEC = {
  still: 40,
  "cadre-decor": 40,
  retoucher: 45,
  image: 40,
  "video-ltx": 90,
  "video-wan": 140,
  video: 120,
  prise: 120,
  son: 50,
  mesh: 100,
  "3d": 100,
  finaliser: 180,
  "montage-export": 45,
  outil: 105,
} as const;

export type TypicalWaitKey = keyof typeof TYPICAL_WAIT_SEC;

/**
 * Eased percent 0–95 from elapsed seconds and an optional typical duration.
 * Caps at 95 until the caller marks done (100).
 */
export function estimateProgressPercent(elapsedSec: number, typicalSec?: number | null): number {
  const elapsed = Math.max(0, elapsedSec);
  if (!(typicalSec && typicalSec > 0)) {
    // Asymptotic toward 90 when we have no estimate.
    return Math.min(90, Math.round(100 * (1 - Math.exp(-elapsed / 45))));
  }
  const ratio = elapsed / typicalSec;
  if (ratio < 1) {
    // Ease-out: faster at first, then slower; scale so typical ≈ 90 %.
    const eased = 1 - Math.pow(1 - ratio, 1.35);
    return Math.min(95, Math.round(eased * 90));
  }
  // Past typical: crawl 90 → 95.
  const over = elapsed - typicalSec;
  return Math.min(95, 90 + Math.round(5 * (1 - Math.exp(-over / Math.max(12, typicalSec * 0.35)))));
}

/** Whole seconds still expected; null when unknown. Never negative. */
export function estimateRemainingSec(elapsedSec: number, typicalSec?: number | null): number | null {
  if (!(typicalSec && typicalSec > 0)) return null;
  return Math.max(0, Math.round(typicalSec - Math.max(0, elapsedSec)));
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m} min` : `${m} min ${r} s`;
}
