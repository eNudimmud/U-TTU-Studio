"use client";

// Shared tool shell (coque): one stage for source → progress → result, declarative slots,
// a compact bar, and an « Annuler la suppression » toast. Tools declare slots and suites;
// the shell stays the same (see maquette-galerie/OUTILS.md).

import { useEffect, useId, useState, type ReactNode } from "react";
import { useI18n } from "@/components/i18n/provider";

export type StageView = "source" | "result" | "compare";

export interface ShellSlot {
  key: string;
  label: string;
  required?: boolean;
  src?: string;
  name?: string;
}

export interface ToolStageProps {
  view: StageView;
  onView?(view: StageView): void;
  source?: ReactNode;
  result?: ReactNode;
  /** Compare slider: before = source, after = result (Finaliser). */
  compare?: boolean;
  progress?: { label: string; seconds?: number } | null;
  lab?: ReactNode;
  className?: string;
}

/** In-stage surface: source, progress overlay, result, optional Source|Résultat toggle or before/after. */
export function ToolStage({ view, onView, source, result, compare, progress, lab, className }: ToolStageProps) {
  const { t } = useI18n();
  const toggleId = useId();
  return <div className={`u-tool-stage${className ? ` ${className}` : ""}`} data-tool-stage={view} data-compare={compare ? "" : undefined}>
    <div className="u-tool-stage-frame">
      {view === "compare" && compare ? <div className="u-tool-compare" data-tool-compare="">
        <div className="u-tool-compare-before">{source}</div>
        <div className="u-tool-compare-after">{result}</div>
      </div> : view === "result" ? result : source}
      {progress && <div className="u-tool-stage-progress" role="status" data-tool-progress="">
        <span className="u-fil-bar" aria-hidden="true"><span /></span>
        <p>{progress.label}{typeof progress.seconds === "number" ? ` · ${progress.seconds} s` : ""}</p>
      </div>}
    </div>
    {lab && <div className="u-tool-stage-lab">{lab}</div>}
    {onView && (source && result) && !compare && <div className="u-tool-seg" role="group" aria-label={t("shell.compare")} id={toggleId}>
      <button type="button" aria-pressed={view === "source"} data-tool-view="source" onClick={() => onView("source")}>{t("shell.source")}</button>
      <button type="button" aria-pressed={view === "result"} data-tool-view="result" onClick={() => onView("result")}>{t("shell.result")}</button>
    </div>}
  </div>;
}

export function ShellSlots({ slots, onAdd, onRemove }: {
  slots: ShellSlot[];
  onAdd?(key: string): void;
  onRemove?(key: string): void;
}) {
  const { t } = useI18n();
  return <ul className="u-tool-slots" role="list" data-tool-slots="">
    {slots.map(slot => <li key={slot.key}>
      {slot.src
        ? <div className="u-tool-slot" data-tool-slot={slot.key} data-filled="">
          <img src={slot.src} alt="" width={64} height={64} />
          <span>{slot.name || slot.label}</span>
          {onRemove && <button type="button" className="u-tool-slot-x" aria-label={t("shell.removeSlot", { name: slot.name || slot.label })} data-tool-slot-remove={slot.key} onClick={() => onRemove(slot.key)}>×</button>}
        </div>
        : <button type="button" className="u-tool-slot is-empty" data-tool-slot={slot.key} data-required={slot.required ? "" : undefined} onClick={() => onAdd?.(slot.key)}>
          <span aria-hidden="true">＋</span>{slot.label}
          <small>{slot.required ? t("shell.required") : t("shell.optional")}</small>
        </button>}
    </li>)}
  </ul>;
}

/** Toast with undo for a removed slot/chip. Auto-dismisses after `ms`. */
export function UndoToast({ message, thumb, onUndo, onGone, ms = 6000 }: {
  message: string;
  thumb?: string;
  onUndo(): void;
  onGone?(): void;
  ms?: number;
}) {
  const { t } = useI18n();
  useEffect(() => {
    const timer = window.setTimeout(() => onGone?.(), ms);
    return () => window.clearTimeout(timer);
  }, [ms, onGone]);
  return <div className="u-undo-toast" role="status" data-undo-toast="">
    {thumb && <img src={thumb} alt="" width={36} height={36} />}
    <p>{message}</p>
    <button type="button" data-undo-toast-undo="" onClick={() => { onUndo(); onGone?.(); }}>{t("shell.undoRemove")}</button>
  </div>;
}

export function ToolShell({ stage, bar, examples, toast }: {
  stage: ReactNode;
  bar: ReactNode;
  examples?: ReactNode;
  toast?: ReactNode;
}) {
  return <section className="u-tool-shell" data-tool-shell="">
    {stage}
    {bar}
    {examples}
    {toast}
  </section>;
}
