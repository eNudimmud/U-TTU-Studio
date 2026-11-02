"use client";

import type { ReactNode } from "react";
import { LanguageSwitcher, useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { NOMBRE_OUTILS } from "@/lib/outils/nombre";
import { OPEN_WEIGHTS_MODE } from "@/lib/open-weights";
import { assetPath, contactEmail, sourceRepo } from "@/lib/site";
import { landingCopy } from "@/lib/landing/page-copy";
import { LegacyStudioHash } from "./legacy-hash";
import { Brand, BrandLockup } from "@/components/brand";
import { PoweredBy } from "@/components/powered-by";
import { useStudioHref } from "@/components/use-studio-href";
import "./home.css";
import "./landing.css";

const STUDIO = assetPath("/studio");

export function HomeLanding() {
  const { t } = useI18n();
  const { locale } = useLocaleSwitch();
  const copy = landingCopy(locale);
  const studioHref = useStudioHref(STUDIO);
  const rich = (key: string) => t.rich(key, { em: (chunks: ReactNode) => <em>{chunks}</em> });
  return <div className="ln">
    <LegacyStudioHash />
    <header className="ln-top">
      <Brand href={assetPath("/")} label={t("landing.home")} />
      <span className="ln-sp" />
      <a className="hv-btn hv-glass ln-hide" href={assetPath("/guide")}>{copy.readGuide}</a>
      <LanguageSwitcher />
      <a className="hv-btn hv-gold" href={studioHref}>{t("landing.enter")}</a>
    </header>
    <main id="contenu" tabIndex={-1}>
      <section className="ln-hero" data-hero="" aria-labelledby="landing-title">
        <img src={assetPath("/images/accueil/uttu-quai-1920.webp")} alt={t("accueil.g1Alt")} fetchPriority="high" />
        <div className="ln-hero-in">
          <BrandLockup className="hv-lockup" alt="U*TTU Studio" />
          <p className="eyebrow" data-landing-kicker="">{t("accueil.kicker")}</p>
          <h1 id="landing-title">{rich("accueil.h1")}</h1>
          <p className="ln-lead">{copy.heroLead}</p>
          <div className="ln-ctas">
            <a className="hv-btn hv-gold" href={studioHref} data-enter-studio="">{t("landing.enter")}</a>
            <a className="hv-btn hv-glass" href={assetPath("/guide")} data-read-guide="">{copy.readGuide}</a>
          </div>
          <p className="ln-fine">{t("accueil.sub2", { n: String(NOMBRE_OUTILS) })}</p>
          <PoweredBy className="hv-badge" />
        </div>
      </section>

      <div className="ln-wrap">
        <section id="steps">
          <p className="eyebrow">{t("accueil.flowTitle")}</p>
          <h2>{copy.stepsTitle}</h2>
          <p className="ln-lead">{copy.stepsLead}</p>
          <ol className="ln-steps">
            {copy.steps.map((step, index) => <li key={step.id}>
              <a href={assetPath(step.href)}>
                <div className="ln-im">{step.image ? <img src={assetPath(step.image)} alt={step.alt} /> : <span className="ln-ph">{step.placeholder}</span>}</div>
                <span className="ln-n">0{index + 1}</span>
                <b>{step.name}</b>
                <p>{step.body}</p>
                <span className="ln-go">{step.go}</span>
              </a>
            </li>)}
          </ol>
        </section>

        <section id="anime" className="ln-split">
          <div>
            <img src={assetPath("/look/anime/hero-key.webp")} alt="" />
            <div className="ln-strip">
              <img src={assetPath("/look/anime/shot-1-wide.webp")} alt="" />
              <img src={assetPath("/look/anime/shot-2-medium.webp")} alt="" />
              <img src={assetPath("/look/anime/shot-3-closeup.webp")} alt="" />
            </div>
          </div>
          <div>
            <p className="eyebrow">{copy.animeLook}</p>
            <h2>{copy.animeTitle}</h2>
            <p className="ln-lead">{copy.animeBody}</p>
            <ul>{copy.animePoints.map(point => <li key={point}>{point}</li>)}</ul>
            <p className="ln-fine">{copy.animeCost}</p>
            <div className="ln-ctas">
              <a className="hv-btn hv-glass" href={assetPath("/look")}>{copy.animeLook}</a>
              <a className="ln-go" href={assetPath("/look/bible")}>{copy.animeBible}</a>
            </div>
          </div>
        </section>

        <section id="h3" className="ln-split">
          <div>
            <img src={assetPath("/exemples/vignettes/vid-h3-refs@2x.webp")} alt="" />
            <div className="ln-strip">
              <img src={assetPath("/exemples/vignettes/vid-multi@2x.webp")} alt="" />
              <span className="ln-ph">{copy.swapPlaceholder}</span>
            </div>
          </div>
          <div>
            <p className="eyebrow">{copy.h3Badge}</p>
            <h2>{copy.h3Title}</h2>
            <p className="ln-lead">{copy.h3Body}</p>
            <ul className="ln-feat">
              {copy.h3.map(item => <li key={item.name} data-soon={item.soon ? "" : undefined}>
                {item.href && !item.soon
                  ? <a href={assetPath(item.href)}><b>{item.name}</b><span>{item.body}</span><small>{item.cost}</small></a>
                  : <div><b>{item.name} {item.soon && <span className="ln-soon">{copy.soonWord}</span>}</b><span>{item.body}</span><small>{item.cost}</small></div>}
              </li>)}
            </ul>
          </div>
        </section>

        <section id="only">
          <h2>{copy.onlyTitle}</h2>
          <p className="ln-lead">{copy.onlyLead}</p>
          <div className="ln-duo">
            <div>
              <img src={assetPath("/media/accueil/loop-map-poster.webp")} alt="" />
              <h3>{copy.scoutTitle}</h3>
              <p>{copy.scoutBody}</p>
              <a className="ln-go" href={assetPath("/studio#outils/reperage")}>{copy.scoutLink}</a>
            </div>
            <div>
              <span className="ln-ph ln-stage">{copy.stagePlaceholder}</span>
              <h3>{copy.stageTitle}</h3>
              <p>{copy.stageBody}</p>
              <a className="ln-go" href={assetPath("/studio#prise")}>{copy.stageLink}</a>
            </div>
          </div>
        </section>

        <section id="uttu" className="ln-split">
          <img src={assetPath("/images/uttu-portrait-1280.webp")} alt={t("accueil.g1Alt")} />
          <div>
            <h2>{copy.uttuTitle}</h2>
            <p className="ln-lead">{copy.uttuBody}</p>
            <p className="ln-fine">{copy.uttuCost}</p>
            <a className="hv-btn hv-glass" href={assetPath("/guide")}>{copy.uttuLink}</a>
          </div>
        </section>

        <section id="storyweave" className="ln-band">
          <span className="ln-soon">{copy.soonWord}</span>
          <h3>{copy.swTitle}</h3>
          <p>{copy.swBody}</p>
          <a className="ln-go" href={assetPath("/storyboard")}>{copy.swLink}</a>
        </section>

        <section id="models">
          <h2>{copy.modelsTitle}</h2>
          <p className="ln-lead">{copy.modelsLead}</p>
          <div className="ln-models">
            <div>
              <h3>{copy.openTitle} <span className="ln-lic">{copy.openOn}</span></h3>
              <p className="ln-fine">{copy.openWhy}</p>
              <dl>{copy.openList.map(row => <div key={row.k}><dt>{row.k}</dt><dd>{row.v}</dd></div>)}</dl>
            </div>
            <div>
              <h3>{copy.partnerTitle} <span className="ln-lic ln-lic-p">{t("accueil.partnerBadge")}</span></h3>
              <p className="ln-fine">{copy.partnerWhy}</p>
              <p data-partner-mode={OPEN_WEIGHTS_MODE ? "hidden" : "on"}>{OPEN_WEIGHTS_MODE ? copy.partnerHidden : copy.partnerOn}</p>
              <dl>{copy.partnerList.map(row => <div key={row.k}><dt>{row.k}</dt><dd>{row.v}</dd></div>)}</dl>
              <p className="ln-fine">{copy.partnerMore}</p>
            </div>
          </div>
        </section>

        <section id="costs">
          <h2>{copy.costsTitle}</h2>
          <p className="ln-lead">{copy.costsLead}</p>
          {copy.costs.map(row => <div className="ln-price" key={row.label}><span>{row.label}</span><span>{row.price}</span></div>)}
          <a className="ln-go" href={assetPath("/guide#costs")}>{copy.costsLink}</a>
        </section>

        <section className="ln-end">
          <h2>{copy.endTitle}</h2>
          <div className="ln-ctas">
            <a className="hv-btn hv-gold" href={studioHref}>{t("landing.enter")}</a>
            <a className="hv-btn hv-glass" href={assetPath("/guide")}>{copy.readGuide}</a>
          </div>
          <ul className="ln-trust">{copy.trust.map(line => <li key={line}>{line}</li>)}</ul>
        </section>
      </div>
    </main>
    <footer className="ln-foot">
      <span>{t("accueil.foot")}</span>
      <a href={assetPath("/guide")}>{copy.readGuide}</a>
      <a href={sourceRepo} target="_blank" rel="noopener noreferrer">{t("landing.code")}</a>
      <a href={`mailto:${contactEmail}`}>{t("landing.contact")}</a>
      <span>{t("accueil.attrib")}</span>
    </footer>
  </div>;
}
