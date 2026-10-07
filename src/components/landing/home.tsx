import Image from "next/image";
import { Arrow } from "@/components/glyph";
import { assetPath, contactEmail } from "@/lib/site";
import { LegacyStudioHash } from "./legacy-hash";

const STUDIO_HREF = assetPath("/studio");

const STEPS = [
  { name: "Personnage", plain: "Deux façons" },
  { name: "Scène", plain: "Ton lieu" },
  { name: "Prise", plain: "La vidéo" },
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
      <section className="landing-splash" aria-labelledby="landing-title">
        <div className="landing-copy">
          <h1 id="landing-title">Ton personnage, ta scène, <em>la prise.</em></h1>
          <div className="landing-sheet">
            <ol className="landing-pills" aria-label="Trois gestes">
              {STEPS.map((step, index) => <li key={step.name}>
                <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
                <strong>{step.name}</strong>
                <span className="step-plain">{step.plain}</span>
              </li>)}
            </ol>
            <div className="landing-cta-row">
              <a className="button button-primary" href={STUDIO_HREF}>Entrer dans le studio <Arrow /></a>
              <p className="landing-quiet">Le studio ne vend rien. Le rendu se paie sur ton compte cloud.</p>
            </div>
          </div>
        </div>
        <figure className="landing-still">
          <Image
            src={assetPath("/images/uttu-canon-portrait.webp")}
            alt="U*TTU : capuche noire, visage marqué de fines lignes dorées, fond sombre."
            fill
            preload
            sizes="(max-width: 899px) 100vw, 42vw"
          />
          <figcaption>U*TTU · elle te guide dans le studio</figcaption>
        </figure>
      </section>
    </main>
    <footer className="studio-footer landing-footer">
      <span><span className="iii">iii</span> THE BLOC · SUISSE</span>
      <a href={`mailto:${contactEmail}`}>Contacter le studio ↗</a>
    </footer>
  </div>;
}
