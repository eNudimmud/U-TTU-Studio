"use client";

import { SPHERE_PRESETS } from "@/lib/studio-modes";

export function SpherePanel() {
  return <section className="mode-panel" aria-labelledby="mode-title">
    <header className="mode-hero">
      <p className="eyebrow">Sphère</p>
      <h1 id="mode-title" tabIndex={-1}>Avant. Après. <em>Entre.</em></h1>
      <p className="mode-lead">Trois façons de tenir une scène. Le rendu vidéo n’est pas branché. Rien ne part.</p>
    </header>
    <div className="soon-grid">
      {SPHERE_PRESETS.map(preset => <article key={preset.id} className="soon-card" aria-labelledby={`sphere-${preset.id}`}>
        <p className="eyebrow">{preset.kicker}</p>
        <h2 id={`sphere-${preset.id}`}>{preset.title}</h2>
        <p className="soon-line">{preset.line}</p>
        <p>{preset.detail}</p>
        <button type="button" className="button button-outline" disabled>Bientôt</button>
      </article>)}
    </div>
  </section>;
}
