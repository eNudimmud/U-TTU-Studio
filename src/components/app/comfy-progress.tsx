"use client";

// One shared wait surface for every long Comfy tool: determinate bar + % +
// elapsed / ≈ remaining. Used by barre-fil, ToolStage, repérage→décor, outils,
// vidéo, PRISE, son/3D, finaliser and montage export.

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import {
  estimateProgressPercent,
  estimateRemainingSec,
  formatClock,
  TYPICAL_WAIT_SEC,
  type TypicalWaitKey,
} from "@/lib/creation/comfy-progress";

export type ComfyProgressProps = {
  /** Stage line already translated by the caller (e.g. « Création en cours… »). */
  label: string;
  /** Elapsed whole seconds since the wait started. */
  elapsedSec: number;
  /** Typical total seconds for this tool; drives % and ≈ remaining. */
  typicalSec?: number | null;
  /** Real 0–100 from an API when available; otherwise the eased estimate. */
  percent?: number | null;
  /** Optional keep-open note under the bar. */
  note?: string;
  className?: string;
  /** data-* marker for tests / CSS. */
  marker?: string;
};

/** Determinate bar + percent + elapsed / ≈ remaining. */
export function ComfyProgress({
  label,
  elapsedSec,
  typicalSec,
  percent,
  note,
  className,
  marker = "comfy-progress",
}: ComfyProgressProps) {
  const { t } = useI18n();
  const value = typeof percent === "number" && Number.isFinite(percent)
    ? Math.max(0, Math.min(100, Math.round(percent)))
    : estimateProgressPercent(elapsedSec, typicalSec);
  const remaining = estimateRemainingSec(elapsedSec, typicalSec);
  const timeLine = remaining === null
    ? t("progress.elapsed", { time: formatClock(elapsedSec) })
    : remaining === 0
      ? t("progress.elapsedAlmost", { time: formatClock(elapsedSec) })
      : t("progress.elapsedRemaining", { elapsed: formatClock(elapsedSec), remaining: formatClock(remaining) });

  return (
    <div
      className={`u-comfy-progress${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-busy={value < 100 ? "true" : undefined}
      data-comfy-progress={marker}
    >
      <div
        className="u-comfy-progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={label}
      >
        <span style={{ width: `${value}%` }} />
      </div>
      <p className="u-comfy-progress-label">
        <span>{label}</span>
        <span className="u-comfy-progress-pct" data-comfy-progress-pct="">{value}&nbsp;%</span>
      </p>
      <p className="u-comfy-progress-time" data-comfy-progress-time="">{timeLine}</p>
      {note ? <p className="u-small u-comfy-progress-note">{note}</p> : null}
    </div>
  );
}

/** Ticks elapsed seconds while `active` is true; resets to 0 when it goes false. */
export function useComfyElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    setElapsed(0);
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [active]);
  return elapsed;
}

/** Resolve a typical duration key to seconds. */
export function typicalFor(key: TypicalWaitKey | undefined): number | null {
  if (!key) return null;
  return TYPICAL_WAIT_SEC[key] ?? null;
}

export { TYPICAL_WAIT_SEC, estimateProgressPercent, formatClock, type TypicalWaitKey };
