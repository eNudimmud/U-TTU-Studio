"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { CREATION_PROCESSES, processById } from "@/lib/processes";
import { ProcessCard } from "./process-card";
import { SceneFiches } from "./scene-fiches";
import { useProcessLaunch } from "./process-launch";
import { useGoToMode } from "./mode-context";

const loading = () => <p className="loading-panel" role="status">Ouverture…</p>;
const ComfyRunPanel = dynamic(() => import("../guide/comfy-run-panel").then(m => m.ComfyRunPanel), { loading });

export function SpherePanel() {
  const go = useGoToMode();
  const launch = useProcessLaunch();
  const opened = launch.id ? processById(launch.id) : undefined;
  const shown = opened?.state === "live" && opened.app ? opened : undefined;

  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(() => document.getElementById("process-run")?.scrollIntoView({ block: "start" }), 0);
    return () => window.clearTimeout(timer);
  }, [shown]);

  function open(id: string) {
    const process = processById(id);
    if (process?.state !== "live") return;
    launch.request(process.id);
  }

  return <section className="mode-panel" aria-labelledby="mode-title">
    <header className="mode-hero">
      <p className="eyebrow">Sphère</p>
      <h1 id="mode-title" tabIndex={-1}>Avant. Après. <em>Entre.</em></h1>
      <p className="mode-lead">Deux gestes sont prêts : former un look, tester un prompt. Les fiches tiennent le lieu. Avant, après, entre attendent. Rien ne part avant le clic.</p>
      <button type="button" className="text-button" onClick={() => go("studio")}>Le coffre note les scènes et les processus.</button>
    </header>
    <SceneFiches />
    <div className="soon-grid process-grid">
      {CREATION_PROCESSES.map(process => <ProcessCard key={process.id} process={process} onLaunch={process.state === "live" ? () => open(process.id) : undefined} />)}
    </div>
    {shown?.app && <div id="process-run" className="process-stage">
      <ComfyRunPanel key={shown.id} app={shown.app} heading={shown.title} note={shown.consent ?? shown.pitch} showFile={false} />
    </div>}
  </section>;
}
