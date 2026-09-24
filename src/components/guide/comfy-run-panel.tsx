"use client";

import { useEffect, useState } from "react";
import { COMFY_APPS } from "@/lib/comfy-stack";
import { assetPath } from "@/lib/site";
import { trackEvent, type StudioEvent } from "@/lib/analytics";
import { Arrow } from "../glyph";

type AppKey = keyof typeof COMFY_APPS;

const COPY: Record<AppKey, { eyebrow: string; heading: string; note: string; event: StudioEvent }> = {
  train: {
    eyebrow: "App Comfy",
    heading: "Dataset → LoRA → 1 image",
    note: "Compte Comfy Cloud et crédits : à toi. Commence par le test à blanc (20 étapes, 1 image) avant le run réel. Tes images restent sur cet appareil jusqu’à ce que tu les déposes dans Comfy. Si la connexion échoue dans le cadre, ouvre la même app en plein onglet.",
    event: "comfy_app_opened",
  },
  prompt: {
    eyebrow: "Test de prompt",
    heading: "Sans LoRA, avant l’entraînement",
    note: "Compte Comfy Cloud et crédits : à toi. Ce test ne charge pas la LoRA : règle la scène ici avant de payer l’entraînement. Tes images restent sur cet appareil jusqu’à ce que tu les déposes dans Comfy. Si la connexion échoue dans le cadre, ouvre la même app en plein onglet.",
    event: "prompt_app_opened",
  },
};

export function ComfyRunPanel({ app }: { app: AppKey }) {
  const share = COMFY_APPS[app];
  const copy = COPY[app];
  const [httpsPage, setHttpsPage] = useState(true);
  useEffect(() => setHttpsPage(window.location.protocol === "https:"), []);

  return <section className="comfy-run-panel" id={`comfy-${app}`} aria-labelledby={`comfy-${app}-title`}>
    <header className="comfy-run-head">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h4 id={`comfy-${app}-title`}>{copy.heading}</h4>
    </header>
    {httpsPage
      ? <iframe className="comfy-run-frame" src={share.url} title={share.title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
      : <p className="inline-status warn" role="status">Cette page n’est pas en HTTPS : Comfy refuse d’être affichée dans un cadre. Utilise le plein onglet.</p>}
    <div className="comfy-run-actions">
      <a className="button button-outline" href={share.url} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent(copy.event)}>Ouvrir en plein onglet <Arrow diagonal /><span className="sr-only">(nouvel onglet)</span></a>
      {"file" in share && <a className="quiet-link" href={assetPath(share.file)} download>Workflow .json</a>}
    </div>
    <p className="small-print">{copy.note}</p>
  </section>;
}
