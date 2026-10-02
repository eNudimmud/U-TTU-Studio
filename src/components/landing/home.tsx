import Image from "next/image";
import { Arrow } from "@/components/glyph";
import { assetPath, contactEmail } from "@/lib/site";
import { LegacyStudioHash } from "./legacy-hash";

const STUDIO_HREF = assetPath("/studio");

const STEPS = [
  {
    name: "Look",
    plain: "Ton style",
    line: "Le visage, la lumière, ce qui ne doit pas changer.",
  },
  {
    name: "Plateau",
    plain: "Ta scène",
    line: "Le lieu et les angles. Tu prépares le plan avant de tourner.",
  },
  {
    name: "Take",
    plain: "La prise",
    line: "Un plan qui continue les autres. Le film se tient.",
  },
] as const;

export function HomeLanding() {
  return <div className="landing">
    <LegacyStudioHash />
    <header className="landing-header">
      <div className="landing-bar">
        <a href={assetPath("/")} className="wordmark" aria-label="U*TTU Studio — Accueil">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a>
        <a className="button button-outline landing-header-cta" href={STUDIO_HREF}>Entrer dans le studio <Arrow /></a>
      </div>
    </header>
    <main id="contenu" className="landing-main" tabIndex={-1}>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="eyebrow"><span className="iii">iii</span> Studio</p>
          <h1 id="landing-title">Ton style.<br />Ta scène.<br /><em>La prise.</em></h1>
          <p className="landing-lead">Trois gestes pour un film qui se tient. Le visage reste. La lumière reste.</p>
          <div className="landing-cta-row">
            <a className="button button-primary" href={STUDIO_HREF}>Entrer dans le studio <Arrow /></a>
            <p className="landing-quiet">Tu commences par ton style. Rien à payer.</p>
          </div>
        </div>
        <figure className="landing-still">
          <Image
            src={assetPath("/images/uttu-canon-portrait.webp")}
            alt="Portrait de référence : capuche noire, visage marqué de fines lignes dorées, fond sombre."
            fill
            preload
            sizes="(max-width: 899px) 100vw, 42vw"
          />
          <figcaption><span>U*TTU</span>Référence du studio.<br />Pas une image faite ici.</figcaption>
        </figure>
      </section>

      <section className="landing-steps" aria-labelledby="steps-title">
        <p className="eyebrow">Le chemin</p>
        <h2 id="steps-title">Trois gestes, dans l’ordre.</h2>
        <ol>
          {STEPS.map((step, index) => <li key={step.name}>
            <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
            <h3>{step.name}</h3>
            <p className="step-plain">{step.plain}</p>
            <p>{step.line}</p>
          </li>)}
        </ol>
      </section>

      <section className="landing-promise" aria-labelledby="promise-title">
        <h2 id="promise-title">On te reconnaît, d’un plan à l’autre.</h2>
        <div className="landing-promise-copy">
          <p>Ton style ne se défait pas quand la scène change. La prise suivante continue la précédente.</p>
          <a className="button button-primary" href={STUDIO_HREF}>Entrer dans le studio <Arrow /></a>
        </div>
      </section>
    </main>
    <footer className="studio-footer landing-footer">
      <span><span className="iii">iii</span> THE BLOC · SUISSE</span>
      <span>Rien à payer pour entrer.</span>
      <a href={`mailto:${contactEmail}`}>Contacter le studio ↗</a>
    </footer>
  </div>;
}
