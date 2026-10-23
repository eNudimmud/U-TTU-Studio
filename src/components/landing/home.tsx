"use client";

import Image from "next/image";
import { Arrow } from "@/components/glyph";
import { LanguageSwitcher, useI18n } from "@/components/i18n/provider";
import { assetPath, contactEmail } from "@/lib/site";
import { LegacyStudioHash } from "./legacy-hash";
import { Brand, BrandLockup } from "@/components/brand";
import { PoweredBy } from "@/components/powered-by";

const STUDIO_HREF = assetPath("/studio");
/** « Try free (0 credits) »: the studio opens with the free U*TTU guide (start, FAQ, cost simulator) and the example tiles. */
const TRY_FREE_HREF = assetPath("/studio?uttu=1");
/** The hero still: a real frame of the 3D mock-up in TAKE (local three.js, 0 credits). */
const HERO_STILL = "/images/accueil/previs-maquette.webp";
/** Slot for the mock-up → LTX loop. Set to an MP4 path in public/ once the first LTX takes are rendered; the still stays its poster. */
const HERO_LOOP: string | null = null;
const EXAMPLES = [
  { src: "/exemples/cast-coursiere.webp", key: "landing.exCast" },
  { src: "/exemples/decor-quai-nuit.webp", key: "landing.exSet" },
] as const;

export function HomeLanding() {
  const { t } = useI18n();
  const steps = [
    { name: t("nav.character"), plain: t("landing.twoWays") },
    { name: t("nav.scene"), plain: t("landing.yourPlace") },
    { name: t("nav.take"), plain: t("landing.theVideo") },
    { name: t("nav.edit"), plain: t("landing.theCut") },
  ];
  const flow = [t("landing.stepFinger"), t("landing.stepQuote"), t("landing.stepFilm")];
  return <div className="landing">
    <LegacyStudioHash />
    <header className="landing-header">
      <div className="landing-bar">
        <Brand href={assetPath("/")} label={t("landing.home")} desktop={64} />
        <div className="landing-tools">
          <LanguageSwitcher />
          <a className="button button-outline landing-header-cta" href={STUDIO_HREF}>{t("landing.enter")} <Arrow /></a>
        </div>
      </div>
    </header>
    <main id="contenu" className="landing-main" tabIndex={-1}>
      <section className="landing-splash" aria-labelledby="landing-title">
        <div className="landing-copy">
          <BrandLockup className="landing-lockup" />
          <p className="landing-kicker" data-landing-kicker="">{t("landing.kicker")}</p>
          <h1 id="landing-title">{t("landing.before")}<em>{t("landing.em")}</em></h1>
          <p className="landing-sub">{t("landing.sub")}</p>
          <div className="landing-cta-row">
            <a className="button button-primary" href={TRY_FREE_HREF} data-try-free="">{t("landing.tryFree")} <Arrow /></a>
            <a className="button button-outline" href={STUDIO_HREF}>{t("landing.enter")} <Arrow /></a>
          </div>
          <p className="landing-quiet">{t("landing.tryFreeNote")}</p>
          <ol className="landing-pills" aria-label={t("landing.pills")}>
            {steps.map((step, index) => <li key={step.name}>
              <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.name}</strong>
              <span className="step-plain">{step.plain}</span>
            </li>)}
          </ol>
        </div>
        <figure className="landing-still">
          <div className="landing-still-frame" data-hero-visual={HERO_LOOP ? "loop" : "still"}>
            {HERO_LOOP
              ? <video src={assetPath(HERO_LOOP)} poster={assetPath(HERO_STILL)} autoPlay muted loop playsInline aria-label={t("landing.alt")} />
              : <Image src={assetPath(HERO_STILL)} alt={t("landing.alt")} fill preload sizes="(max-width: 899px) 100vw, 600px" />}
            <span className="landing-still-tag">{t("landing.theVideo")}</span>
          </div>
          <ol className="landing-flow" data-landing-flow="">
            {flow.map((line, index) => <li key={line}><span className="step-index">{index + 1}</span>{line}</li>)}
          </ol>
          <figcaption>{t("landing.caption")}</figcaption>
          <div className="landing-examples">
            {EXAMPLES.map(example => <div key={example.src} className="landing-example">
              <Image src={assetPath(example.src)} alt="" fill sizes="(max-width: 899px) 50vw, 300px" />
              <span>{t(example.key)}</span>
            </div>)}
            <p>{t("landing.examples")}</p>
          </div>
        </figure>
      </section>
    </main>
    <footer className="studio-footer landing-footer">
      <span>U*TTU Studio</span>
      <PoweredBy />
      <span className="landing-footer-quiet">{t("landing.quiet")}</span>
      <a href={`mailto:${contactEmail}`}>{t("landing.contact")}</a>
    </footer>
  </div>;
}
