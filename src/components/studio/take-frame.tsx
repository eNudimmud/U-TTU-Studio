"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { COMFY_MEDIA_SW } from "@/lib/comfy-media";
import { comfyTemplateHref } from "@/lib/comfy-proxy";
import { H3_R2V_TEMPLATE } from "@/lib/comfy-stack";
import {
  TAKE_FRAME_CONSENT, TAKE_FRAME_HTTP, TAKE_FRAME_LEAD, TAKE_FRAME_LINE, TAKE_FRAME_LOGIN, TAKE_LOAD, TAKE_SOON_TITLE, TAKE_TAB,
} from "@/lib/cinema";
import { assetPath } from "@/lib/site";
import { trackEvent } from "@/lib/analytics";
import { Arrow } from "../glyph";
import "../guide/workspace.css";

const noSubscription = () => () => {};

export function TakeFrame() {
  const embed = comfyTemplateHref(H3_R2V_TEMPLATE.id);
  const framable = useSyncExternalStore(noSubscription, () => window.location.protocol === "https:", () => true);
  const [loads, setLoads] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (loads === 1) frame.current?.focus({ preventScroll: true });
  }, [loads]);
  useEffect(() => {
    if (!loads || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register(COMFY_MEDIA_SW).catch(() => {});
  }, [loads]);

  function load() {
    setLoads(1);
    trackEvent("take_template_opened");
  }

  return <section className="comfy-run-panel take-run" aria-labelledby="prise-frame-title">
    <header className="comfy-run-head">
      <div>
        <p className="eyebrow">{TAKE_FRAME_LEAD}</p>
        <h2 id="prise-frame-title">{TAKE_SOON_TITLE}</h2>
      </div>
      <a className="button button-outline" href={H3_R2V_TEMPLATE.page} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("take_template_opened")}>{TAKE_TAB} <Arrow diagonal /><span className="sr-only">(nouvel onglet)</span></a>
    </header>
    {!framable
      ? <p className="inline-status warn">{TAKE_FRAME_HTTP}</p>
      : loads && embed
        ? <iframe key={loads} ref={frame} className="comfy-run-frame" src={assetPath(embed)} title={TAKE_SOON_TITLE} allow="clipboard-write; fullscreen" />
        : <div className="comfy-run-consent">
          <p id="prise-frame-consent">{TAKE_FRAME_CONSENT}</p>
          <button type="button" className="button button-primary" onClick={load} aria-describedby="prise-frame-consent">{TAKE_LOAD} <Arrow /></button>
        </div>}
    <div className="comfy-run-foot">
      <p className="small-print">{TAKE_FRAME_LINE} {TAKE_FRAME_LOGIN}</p>
      {loads > 0 && <button type="button" className="text-button" onClick={() => setLoads(count => count + 1)}>Recharger l’app</button>}
    </div>
  </section>;
}
