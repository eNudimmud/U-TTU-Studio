"use client";

import { useLocaleSwitch } from "@/components/i18n/provider";
import { animeGuide } from "@/lib/guide/anime-copy";
import { assetPath } from "@/lib/site";
import { GuideBar } from "./guide-bar";
import "./guide.css";
import "./guide-anime.css";

export function GuideAnime() {
  const { locale } = useLocaleSwitch();
  const copy = animeGuide(locale);
  return <>
    <GuideBar />
    <div className="g-wrap">
      <div className="g-hero">
        <div className="eyebrow">{copy.kicker}</div>
        <h1>{copy.title} <em>{copy.titleEm}</em></h1>
        <p className="g-lede">{copy.lede}</p>
      </div>
      <section className="g-sec" id="glossary">
        <h2>{copy.glossaryTitle}</h2>
        <p className="g-muted">{copy.glossaryLede}</p>
        <dl className="ga-glossary">
          {copy.glossary.map(item => <div className="ga-term" key={item.term}>
            <dt>{item.term}</dt>
            <dd>{item.body}</dd>
          </div>)}
        </dl>
      </section>
      <section className="g-sec" id="style">
        <h2>{copy.styleTitle}</h2>
        <p className="g-muted">{copy.styleLede}</p>
        <dl className="ga-glossary">
          {copy.styles.map(item => <div className="ga-term" key={item.term}>
            <dt>{item.term}</dt>
            <dd>{item.body}</dd>
          </div>)}
        </dl>
      </section>
      <section className="g-sec" id="prompts">
        <h2>{copy.modelsTitle}</h2>
        <p className="g-muted">{copy.modelsLede}</p>
        <div className="ga-models">
          {copy.models.map(model => <article className="ga-model" key={model.title}>
            <h3>{model.title}</h3>
            <code className="ga-template">{model.template}</code>
            <div className="ga-good">
              <span className="ga-tag ga-tag-good">Good</span>
              <p>{model.good}</p>
            </div>
            <div className="ga-bad">
              <span className="ga-tag ga-tag-bad">Bad</span>
              <p>{model.bad}</p>
              <p className="g-muted">{model.badNote}</p>
            </div>
          </article>)}
        </div>
      </section>
      <p><a className="g-link" href={assetPath("/guide")}>{copy.back}</a></p>
    </div>
  </>;
}
