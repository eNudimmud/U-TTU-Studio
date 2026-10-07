"use client";

import Image from "next/image";
import { Arrow } from "@/components/glyph";
import { LanguageSwitcher, useI18n } from "@/components/i18n/provider";
import { assetPath, contactEmail } from "@/lib/site";
import { LegacyStudioHash } from "./legacy-hash";

const STUDIO_HREF = assetPath("/studio");

export function HomeLanding() {
  const { t } = useI18n();
  const steps = [
    { name: t("nav.character"), plain: t("landing.twoWays") },
    { name: t("nav.scene"), plain: t("landing.yourPlace") },
    { name: t("nav.take"), plain: t("landing.theVideo") },
  ];
  return <div className="landing">
    <LegacyStudioHash />
    <header className="landing-header">
      <div className="landing-bar">
        <a href={assetPath("/")} className="wordmark" aria-label={t("landing.home")}>U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a>
        <div className="landing-tools">
          <LanguageSwitcher />
          <a className="button button-outline landing-header-cta" href={STUDIO_HREF}>{t("landing.enter")} <Arrow /></a>
        </div>
      </div>
    </header>
    <main id="contenu" className="landing-main" tabIndex={-1}>
      <section className="landing-splash" aria-labelledby="landing-title">
        <div className="landing-copy">
          <h1 id="landing-title">{t("landing.before")}<em>{t("landing.em")}</em></h1>
          <div className="landing-sheet">
            <ol className="landing-pills" aria-label={t("landing.pills")}>
              {steps.map((step, index) => <li key={step.name}>
                <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
                <strong>{step.name}</strong>
                <span className="step-plain">{step.plain}</span>
              </li>)}
            </ol>
            <div className="landing-cta-row">
              <a className="button button-primary" href={STUDIO_HREF}>{t("landing.enter")} <Arrow /></a>
              <p className="landing-quiet">{t("landing.quiet")}</p>
            </div>
          </div>
        </div>
        <figure className="landing-still">
          <Image
            src={assetPath("/images/uttu-canon-portrait.webp")}
            alt={t("landing.alt")}
            fill
            preload
            sizes="(max-width: 899px) 100vw, 42vw"
          />
          <figcaption>{t("landing.caption")}</figcaption>
        </figure>
      </section>
    </main>
    <footer className="studio-footer landing-footer">
      <span><span className="iii">iii</span> THE BLOC · SUISSE</span>
      <a href={`mailto:${contactEmail}`}>{t("landing.contact")}</a>
    </footer>
  </div>;
}
