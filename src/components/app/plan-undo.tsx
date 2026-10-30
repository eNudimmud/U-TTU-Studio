"use client";

import { useEffect, useRef, useState } from "react";

/** Eight seconds of readable time; hovering, focus and touch all pause the clock. */
export function PlanUndo({ revision, text, label, onUndo, onVisible }: { revision: number; text: string; label: string; onUndo(): void; onVisible?(visible: boolean): void }) {
  const [visible, setVisible] = useState(true);
  // The owner hides its own « Annuler » while this one shows: one undo button on screen at a time.
  useEffect(() => { onVisible?.(visible); return () => onVisible?.(false); }, [visible, onVisible]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const remaining = useRef(8000);
  const started = useRef(0);
  const reasons = useRef(new Set<string>());
  function resume(reason: string) {
    reasons.current.delete(reason);
    if (reasons.current.size || timer.current) return;
    started.current = Date.now();
    timer.current = setTimeout(() => { timer.current = undefined; setVisible(false); }, remaining.current);
  }
  function pause(reason: string) {
    reasons.current.add(reason);
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    remaining.current = Math.max(0, remaining.current - (Date.now() - started.current));
  }
  useEffect(() => {
    setVisible(true);
    remaining.current = 8000;
    started.current = Date.now();
    if (!reasons.current.size) timer.current = setTimeout(() => { timer.current = undefined; setVisible(false); }, 8000);
    return () => { clearTimeout(timer.current); timer.current = undefined; };
  }, [revision]);
  if (!visible) return null;
  return <div className="u-plan-undo" role="status" data-plan-undo=""
    onPointerEnter={event => { if (event.pointerType === "mouse") pause("hover"); }} onPointerLeave={() => { resume("hover"); resume("touch"); }}
    onPointerDown={() => pause("touch")}
    onPointerUp={() => resume("touch")} onPointerCancel={() => resume("touch")}
    onFocus={() => pause("focus")} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) resume("focus"); }}>
    <span>{text}</span><button type="button" className="u-secondary" onClick={onUndo}>{label}</button>
  </div>;
}
