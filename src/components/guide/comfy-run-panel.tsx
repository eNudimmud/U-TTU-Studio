"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { comfyEmbedHref } from "@/lib/comfy-proxy";
import { APP_LABELS, COMFY_APPS, FLUX_STACK } from "@/lib/comfy-stack";
import { assetPath } from "@/lib/site";
import { trackEvent, type StudioEvent } from "@/lib/analytics";
import { Arrow } from "../glyph";
import "./workspace.css";

type ComfyApp = keyof typeof COMFY_APPS;

const PANELS: Record<ComfyApp, { heading: string; note: string; event: StudioEvent }> = {
  train: {
    heading: "Dataset → LoRA → 1 image",
    note: `Ton compte Comfy Cloud, tes crédits : le studio n’en fournit pas. Test à blanc d’abord (${FLUX_STACK.training.testSteps} étapes, 1 image), run réel ensuite. Tes images restent sur ton appareil jusqu’à ce que tu les déposes dans Comfy.`,
    event: "comfy_app_opened",
  },
  prompt: {
    heading: APP_LABELS.promptTest,
    note: "Ton compte Comfy Cloud, tes crédits. Sans LoRA : ce test règle la scène. L’image avec ta LoRA sort de l’app d’entraînement.",
    event: "prompt_app_opened",
  },
  entre: {
    heading: "Entre deux images",
    note: "Deux images, le temps qui les relie. Ton compte Comfy, tes crédits. Rien n’est chargé avant le clic.",
    event: "entre_app_opened",
  },
};

const LOGIN_NOTE = "Connexion à refaire dans le cadre, même si Comfy est ouvert dans un autre onglet. Si elle échoue, « Ouvrir en plein onglet » ouvre la même app.";

const noSubscription = () => () => {};

export function ComfyRunPanel({ app, heading, note, showFile = true }: { app: ComfyApp; heading?: string; note?: string; showFile?: boolean }) {
  const { url, title, file } = COMFY_APPS[app];
  const panel = PANELS[app];
  const detail = note ?? panel.note;
  const event = panel.event;
  const label = heading ?? panel.heading;
  const embed = url ? comfyEmbedHref(url) : null;
  // The media cookie is Secure. An http page, including next dev, cannot store it.
  const framable = useSyncExternalStore(noSubscription, () => window.location.protocol === "https:", () => true);
  // Stays 0 until the visitor clicks: Comfy's pages load third-party ad and analytics tags.
  const [loads, setLoads] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (loads === 1) frame.current?.focus({ preventScroll: true });
  }, [loads]);

  function load() {
    setLoads(1);
    trackEvent(event);
  }

  return <section className="comfy-run-panel" aria-labelledby={`comfy-${app}-title`}>
    <header className="comfy-run-head">
      <div>
        <p className="eyebrow">App Comfy Cloud · ton compte et tes crédits</p>
        <h4 id={`comfy-${app}-title`}>{label}</h4>
      </div>
      {url
        ? <a className="button button-outline" href={url} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent(event)}>Ouvrir en plein onglet <Arrow diagonal /><span className="sr-only">(nouvel onglet)</span></a>
        : <p className="soon-mark">Partage manquant</p>}
    </header>
    {!url
      ? <p className="inline-status warn">Aucun partage Comfy. Rien n’est chargé.</p>
      : !framable
      ? <p className="inline-status warn">Page en HTTP : Comfy ne s’affiche dans un cadre que depuis une page HTTPS. Utilise « Ouvrir en plein onglet ».</p>
      : loads && embed
        ? <iframe key={loads} ref={frame} className="comfy-run-frame" src={assetPath(embed)} title={title} allow="clipboard-write; fullscreen" />
        : <div className="comfy-run-consent">
          <p id={`comfy-${app}-consent`}><strong>Rien n’est chargé depuis Comfy avant ton clic.</strong> Le bouton affiche l’app Comfy Cloud dans cette page, via le studio, pour que les images et les vidéos générées s’affichent. Comfy peut alors charger ses propres traceurs tiers : publicité et mesure d’audience, dont Google et LinkedIn sur sa page de connexion.</p>
          <button type="button" className="button button-primary" onClick={load} aria-describedby={`comfy-${app}-consent`}>Charger l’app Comfy ici <Arrow /></button>
        </div>}
    <div className="comfy-run-foot">
      <p className="small-print">{detail} {LOGIN_NOTE}</p>
      <div className="comfy-run-links">
        {loads > 0 && <button type="button" className="text-button" onClick={() => setLoads(count => count + 1)}>Recharger l’app</button>}
        {showFile && file && <a className="quiet-link" href={assetPath(file)} download>Workflow .json</a>}
      </div>
    </div>
  </section>;
}
