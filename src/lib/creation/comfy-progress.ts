// Shared wait progress for every long Comfy tool. Comfy's job status is stage-only
// (queue / prepare / render) — no percent — so we ease toward ~95 % from a typical
// duration, then crawl until the job finishes. Pure: no React, no network.

/** Typical wall-clock seconds once the job is on GPU (queue not included). */
export const TYPICAL_WAIT_SEC = {
  still: 40,
  "cadre-decor": 40,
  retoucher: 45,
  image: 40,
  "video-ltx": 120,
  "video-wan": 180,
  video: 180,
  prise: 150,
  son: 50,
  mesh: 100,
  "3d": 100,
  finaliser: 240,
  "montage-export": 45,
  outil: 150,
} as const;

export type TypicalWaitKey = keyof typeof TYPICAL_WAIT_SEC;

/**
 * Eased percent 0–98 from elapsed seconds and an optional typical duration.
 * Caps below 100 until the caller marks done (100). Past the typical window the
 * bar keeps creeping (instead of freezing at 92–95 for minutes on long jobs).
 */
export function estimateProgressPercent(elapsedSec: number, typicalSec?: number | null): number {
  const elapsed = Math.max(0, elapsedSec);
  if (!(typicalSec && typicalSec > 0)) {
    // Asymptotic toward 92 when we have no estimate.
    return Math.min(92, Math.round(100 * (1 - Math.exp(-elapsed / 55))));
  }
  const ratio = elapsed / typicalSec;
  if (ratio < 1) {
    // Ease-out: faster at first, then slower; scale so typical ≈ 88 %.
    const eased = 1 - Math.pow(1 - ratio, 1.35);
    return Math.min(88, Math.round(eased * 88));
  }
  // Past typical: crawl 88 → 98 so a long job still shows movement.
  const over = elapsed - typicalSec;
  return Math.min(98, 88 + Math.round(10 * (1 - Math.exp(-over / Math.max(20, typicalSec * 0.5)))));
}

/**
 * Whole seconds still expected; null when unknown.
 * Past the typical window, extrapolate a soft remaining so the UI does not sit on
 * « presque fini » for minutes while the job is still running.
 */
export function estimateRemainingSec(elapsedSec: number, typicalSec?: number | null): number | null {
  if (!(typicalSec && typicalSec > 0)) return null;
  const elapsed = Math.max(0, elapsedSec);
  if (elapsed <= typicalSec) return Math.max(0, Math.round(typicalSec - elapsed));
  // Overran: guess another ~25 % of typical, decaying as we wait longer.
  const over = elapsed - typicalSec;
  const soft = Math.round(typicalSec * 0.25 * Math.exp(-over / Math.max(30, typicalSec * 0.6)));
  return Math.max(15, soft);
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m} min` : `${m} min ${r} s`;
}
