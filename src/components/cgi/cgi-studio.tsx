"use client";

// Cinema CGI — the photoreal door into the studio (src/app/studio/cgi). A curated menu, not a
// new render surface: every card deep-links into the real tool at /studio#outils/<id>, which
// keeps its own quote, its own account check and its own graph. Nothing here calls Comfy.

import { Brand } from "@/components/brand";
import { LanguageSwitcher, useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { CGI_PIPELINE, cgiResolve, type CgiStepId } from "@/lib/cgi/pipeline";
import { cgiCopy } from "@/lib/cgi/copy";
import { outilPartenaire, outilRow } from "@/lib/outils/catalogue";
import { assetPath } from "@/lib/site";
import "@/components/guide/guide.css";
import "./cgi.css";

const STEP_ORDER: readonly CgiStepId[] = ["cast", "decor", "prise", "montage", "finaliser"];

function CgiBar() {
  const { t } = useI18n();
  return <header className="g-top">
    <Brand href={assetPath("/")} />
    <span className="g-crumb">/ Cinema</span>
    <span className="g-sp" />
    <LanguageSwitcher />
    <a className="g-link" href={assetPath("/studio")}>{t("chrome.studio")}</a>
  </header>;
}

export function CgiStudio() {
  const { locale } = useLocaleSwitch();
  const { t } = useI18n();
  const copy = cgiCopy(locale);
  const licences = [copy.licence.h3, copy.licence.qwenEdit, copy.licence.klein9b];
  return <>
    <CgiBar />
    <div className="g-wrap cgi-wrap">
      <div className="g-hero">
        <div className="eyebrow">{copy.kicker}</div>
        <h1>{copy.title} <em>{copy.titleEm}</em></h1>
        <p className="g-lede">{copy.lede}</p>
        <p className="cgi-note">{copy.openWeightsNote}</p>
        <p><a className="g-link" href={assetPath("/guide/cgi")}>{copy.guideLink} ›</a></p>
      </div>
      {STEP_ORDER.map(id => {
        const step = CGI_PIPELINE.find(item => item.id === id);
        if (!step) return null;
        const groups = cgiResolve(step);
        const stepCopy = copy.step[id];
        return <section className="g-sec cgi-step" id={id} key={id}>
          <h2>{stepCopy.title}</h2>
          <p className="g-lede cgi-step-lede">{stepCopy.lede}</p>
          {groups.map(group => <div className="cgi-group" key={group.key}>
            <p className="cgi-group-title">{copy.group[group.key as keyof typeof copy.group]}</p>
            <div className="cgi-grid">
              {group.tools.map(tool => {
                const credits = outilRow(tool.outil)?.credits ?? null;
                const partner = outilPartenaire(tool.outil);
                return <a key={tool.id} className="cgi-card" href={assetPath(`/studio#outils/${tool.id}`)} data-cgi-tool={tool.id}>
                  <span className="cgi-card-top">
                    <strong>{t(`outils.t.${tool.id}.title`)}</strong>
                    {partner && <span className="g-ph">{copy.partnerBadge}</span>}
                  </span>
                  <span className="cgi-card-line">{copy.why[tool.why]}</span>
                  {credits !== null && <span className="cgi-card-cost">≈ {formatCredits(credits)}</span>}
                </a>;
              })}
            </div>
          </div>)}
        </section>;
      })}
      <section className="g-sec cgi-licence">
        <h2>{copy.licenceTitle}</h2>
        <ul className="cgi-licence-list">
          {licences.map(line => <li key={line}>{line}</li>)}
        </ul>
      </section>
    </div>
  </>;
}
