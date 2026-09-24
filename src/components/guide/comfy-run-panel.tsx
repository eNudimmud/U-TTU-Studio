"use client";

import { useSyncExternalStore } from "react";
import { APP_LABELS, COMFY_APPS, FLUX_STACK } from "@/lib/comfy-stack";
import { assetPath } from "@/lib/site";
import { trackEvent, type StudioEvent } from "@/lib/analytics";
import { Arrow } from "../glyph";

type ComfyApp = keyof typeof COMFY_APPS;

const PANELS: Record<ComfyApp, { heading: string; note: string; event: StudioEvent }> = {
  train: {
    heading: "Dataset → LoRA → 1 image",
    note: `Ton compte Comfy Cloud, tes crédits : le studio n’en fournit pas. Test à blanc d’abord (${FLUX_STACK.training.testSteps} étapes, 1 image), run réel ensuite. Tes images restent sur ton appareil jusqu’à ce que tu les déposes dans Comfy.`,
    event: "comfy_app_opened",
  },
  prompt: {
    heading: APP_LABELS.promptTest,
    note: "Ton compte Comfy Cloud, tes crédits. Sans LoRA : ce test règle la scène. L’image avec ta LoRA sort de l’app de l’étape 2.",
    event: "prompt_app_opened",
  },
};

const LOGIN_NOTE = "Connexion à refaire dans le cadre, même si Comfy est ouvert dans un autre onglet. Si elle échoue, « Ouvrir en plein onglet » ouvre la même app.";

const noSubscription = () => () => {};

export function ComfyRunPanel({ app }: { app: ComfyApp }) {
  const { url, title, file } = COMFY_APPS[app];
  const { heading, note, event } = PANELS[app];
  // Comfy answers with `frame-ancestors 'self' https:`: a page served over http cannot frame it.
  const framable = useSyncExternalStore(noSubscription, () => window.location.protocol === "https:", () => true);

  return <section className="comfy-run-panel" aria-labelledby={`comfy-${app}-title`}>
    <header className="comfy-run-head">
      <div>
        <p className="eyebrow">App Comfy Cloud</p>
        <h4 id={`comfy-${app}-title`}>{heading}</h4>
      </div>
      <a className="button button-outline" href={url} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent(event)}>Ouvrir en plein onglet <Arrow diagonal /><span className="sr-only">(nouvel onglet)</span></a>
    </header>
    {framable
      ? <iframe className="comfy-run-frame" src={url} title={title} loading="lazy" allow="clipboard-write; fullscreen" />
      : <p className="inline-status warn">Page en HTTP : Comfy ne s’affiche dans un cadre que depuis une page HTTPS. Utilise « Ouvrir en plein onglet ».</p>}
    <div className="comfy-run-foot">
      <p className="small-print">{note} {LOGIN_NOTE}</p>
      <a className="quiet-link" href={assetPath(file)} download>Workflow .json</a>
    </div>
  </section>;
}
