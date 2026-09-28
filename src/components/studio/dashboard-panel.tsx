"use client";

import { DATASET_SIZE } from "@/lib/comfy-stack";
import { falProxyUrl } from "@/lib/site";
import { useStudioSession } from "./session";

export function DashboardPanel() {
  const { boot } = useStudioSession();
  const preparing = boot.phase !== "idle";

  return <section className="mode-panel" aria-labelledby="mode-title">
    <header className="mode-hero">
      <p className="eyebrow">Studio</p>
      <h1 id="mode-title" tabIndex={-1}>Le tableau, <em>en attente.</em></h1>
      <p className="mode-lead">Travaux, LoRA, crédits. Pas de compte. Pas de paiement. Vente HOLD.</p>
    </header>
    {!falProxyUrl && <aside className="offline-fal" role="status"><p><strong>Calcul fal non branché.</strong> Aucune file distante. Les cartes ci-dessous décrivent cette session, rien d’autre.</p></aside>}
    <div className="dash-grid">
      <article className="dash-card">
        <p className="eyebrow">Cette session</p>
        <h2>Travaux</h2>
        {preparing
          ? <p role="status">Préparation du lot, dans cette page. {boot.done} / {DATASET_SIZE}.</p>
          : <p>{boot.message || "Aucun travail en cours."}</p>}
        <p className="soon-mark">Bientôt · historique</p>
      </article>
      <article className="dash-card">
        <p className="eyebrow">Fichiers</p>
        <h2>LoRA</h2>
        <p>Aucune LoRA rangée ici. Un fichier fal se télécharge au moment du run, depuis Identité. Il ne reste pas dans le studio.</p>
        <p className="soon-mark">Bientôt</p>
      </article>
      <article className="dash-card">
        <p className="eyebrow">Compte absent</p>
        <h2>Crédits</h2>
        <p>Rien à afficher. La page ne facture pas. La vente reste en HOLD.</p>
        <p className="soon-mark">Bientôt</p>
      </article>
    </div>
  </section>;
}
