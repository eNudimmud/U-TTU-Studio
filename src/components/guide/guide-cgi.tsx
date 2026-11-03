"use client";

// The Cinema prompting guide (/guide/cgi): where the precise cinematography terms live, never
// as chips or panels inside the studio workspace itself.

import { useLocaleSwitch } from "@/components/i18n/provider";
import { assetPath } from "@/lib/site";
import { cgiGuide } from "@/lib/guide/cgi-copy";
import { GuideBar } from "./guide-bar";
import "./guide.css";
import "./guide-cgi.css";

export function GuideCgi() {
  const { locale } = useLocaleSwitch();
  const copy = cgiGuide(locale);
  return <>
    <GuideBar />
    <div className="g-wrap">
      <div className="g-hero">
        <div className="eyebrow">{copy.kicker}</div>
        <h1>{copy.title} <em>{copy.titleEm}</em></h1>
        <p className="g-lede">{copy.lede}</p>
        <p><a className="g-link" href={assetPath("/studio/cgi")}>{copy.backLink} ›</a></p>
      </div>
      <section className="g-sec" id="glossary">
        <h2>{copy.glossaryTitle}</h2>
        <p className="g-muted gg-lede">{copy.glossaryLede}</p>
        <dl className="gg-glossary">
          {copy.glossary.map(item => <div className="gg-term" key={item.term}>
            <dt>{item.term}</dt>
            <dd>{item.gloss}</dd>
          </div>)}
        </dl>
      </section>
      <section className="g-sec" id="tools">
        <h2>{copy.toolsTitle}</h2>
        <p className="g-muted gg-lede">{copy.toolsLede}</p>
        <div className="gg-tools">
          {copy.tools.map(tool => <article className="gg-tool" key={tool.name}>
            <h3>{tool.name}</h3>
            <p className="gg-tip">{tool.tip}</p>
            <p className="gg-example gg-good"><span>{copy.goodLabel}</span>{tool.good}</p>
            <p className="gg-example gg-bad"><span>{copy.badLabel}</span>{tool.bad}</p>
            <p className="gg-why">{tool.badWhy}</p>
          </article>)}
        </div>
      </section>
    </div>
  </>;
}
