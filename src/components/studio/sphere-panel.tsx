"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { SHELF_LEAD, SHELF_NOTE, SHELF_TITLE } from "@/lib/cinema";
import { CREATION_PROCESSES, processById, sphereLead } from "@/lib/processes";
import { PostTake } from "./post-take";
import { ProcessCard } from "./process-card";
import { SceneFiches } from "./scene-fiches";
import { useProcessLaunch } from "./process-launch";
import { useGoToMode } from "./mode-context";

const loading = () => <p className="loading-panel" role="status">Ouverture…</p>;
const ComfyRunPanel = dynamic(() => import("../guide/comfy-run-panel").then(m => m.ComfyRunPanel), { loading });

/** The media shelf. A requested process takes the frame; otherwise the shelf opens on the light app. */
export function SpherePanel() {
  const go = useGoToMode();
  const launch = useProcessLaunch();
  const entre = processById("entre");
  const opened = launch.id ? processById(launch.id) : undefined;
  const shown = opened?.state === "live" && opened.app && opened.appUrl ? opened : undefined;

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

  return <section className="mode-panel sphere-shelf" aria-labelledby="mode-title">
    <header className="mode-hero">
      <h1 id="mode-title" tabIndex={-1}>Ta <em>sphère.</em></h1>
      <p className="mode-lead">{SHELF_LEAD}</p>
    </header>
    <div id="process-run" className="process-stage">
      {shown?.app
        ? <ComfyRunPanel key={shown.id} app={shown.app} heading={shown.title} note={shown.consent ?? shown.pitch} showFile={false} />
        : <ComfyRunPanel key="shelf" app="prompt" heading={SHELF_TITLE} note={SHELF_NOTE} showFile={false} />}
    </div>
    <PostTake titleId="sphere-post-title" />
    <details className="disclosure create-drawer">
      <summary>Autres gestes</summary>
      <p className="expert-note">{sphereLead(entre)}</p>
      <button type="button" className="text-button" onClick={() => go("studio")}>Le coffre note les scènes et les processus.</button>
      <SceneFiches onOpenEntre={entre?.state === "live" ? () => open(entre.id) : undefined} />
      <div className="soon-grid process-grid">
        {CREATION_PROCESSES.map(process => <ProcessCard key={process.id} process={process} onLaunch={process.state === "live" ? () => open(process.id) : undefined} />)}
      </div>
    </details>
  </section>;
}
