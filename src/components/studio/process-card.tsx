"use client";

import { processAction, processGap, processModeLabels, type CreationProcess } from "@/lib/processes";

export function ProcessCard({ process, onLaunch, hold = false }: {
  process: CreationProcess;
  onLaunch?: () => void;
  hold?: boolean;
}) {
  const action = processAction(process, hold);
  const gap = processGap(process);

  return <article className={`soon-card process-card${process.state === "live" ? " is-live" : ""}${process.state === "gap" ? " is-gap" : ""}`} data-process={process.id} data-state={process.state} aria-labelledby={`process-${process.id}`}>
    <p className="eyebrow">{processModeLabels(process)}</p>
    <h2 id={`process-${process.id}`}>{process.title}</h2>
    <p className="soon-line">{process.pitch}</p>
    {gap && <p className="process-hint">{gap}</p>}
    {process.consent && <p className="process-hint">{process.consent}</p>}
    <button type="button" className={`button ${action.enabled ? "button-primary" : "button-outline"}`} disabled={!action.enabled} onClick={onLaunch}>{action.label}</button>
  </article>;
}
