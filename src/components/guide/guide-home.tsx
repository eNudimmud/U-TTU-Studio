"use client";

import { useEffect, useRef, useState } from "react";
import { useLocaleSwitch } from "@/components/i18n/provider";
import { assetPath } from "@/lib/site";
import { guideHome } from "@/lib/guide/home-copy";
import { GuideBar } from "./guide-bar";
import "./guide.css";

export function GuideHome() {
  const { locale } = useLocaleSwitch();
  const copy = guideHome(locale);
  const active = useActiveSection(copy.toc.map(item => item.id));
  const toc = useRef<HTMLElement>(null);
  // Keep the current tab in view inside the scrolling row.
  useEffect(() => {
    const row = toc.current;
    const pill = row?.querySelector<HTMLElement>(`a[href="#${active}"]`);
    if (!row || !pill) return;
    const left = pill.offsetLeft - (row.clientWidth - pill.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);
  return <>
    <GuideBar />
    <div className="g-wrap">
      <div className="g-hero">
        <div className="eyebrow">{copy.kicker}</div>
        <h1>{copy.title} <em>{copy.titleEm}</em></h1>
        <p className="g-lede">{copy.lede}</p>
      </div>
      <nav className="g-toc" aria-label={copy.kicker} ref={toc}>
        {copy.toc.map(item => <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? "true" : undefined}>{item.label}</a>)}
        <a href={assetPath("/guide/tools")}>{copy.toolsLink}</a>
      </nav>
      <section className="g-sec" id="start">
        <h2>{copy.startTitle}</h2>
        <div className="g-cols">
          {copy.start.map(item => <div className="g-col" key={item.n}>
            <span className="n">{item.n}</span>
            <b>{item.title}</b>
            <span>{item.body}</span>
            {item.href && <a href={assetPath(item.href)}>{item.link} ›</a>}
          </div>)}
        </div>
      </section>
      <section className="g-sec" id="steps">
        <h2>{copy.stepsTitle}</h2>
        <div className="g-cols">
          {copy.steps.map(item => <div className="g-col" key={item.title}><b>{item.title}</b><span>{item.body}</span></div>)}
        </div>
      </section>
      <section className="g-sec" id="cgi">
        <h2>{copy.cgiTitle}</h2>
        <p className="g-muted">{copy.cgiBody}</p>
        <p><a className="g-link" href={assetPath("/studio/cgi")}>{copy.cgiLink} ›</a> · <a className="g-link" href={assetPath("/guide/cgi")}>/guide/cgi</a></p>
      </section>
      <section className="g-sec" id="look">
        <h2>{copy.lookTitle}</h2>
        <p className="g-muted">{copy.lookBody}</p>
        <p><a className="g-link" href={assetPath("/anime")}>/anime</a> · <a className="g-link" href={assetPath("/anime/bible")}>/anime/bible</a></p>
        <p><a className="g-link" href={assetPath("/guide/anime")}>{copy.animeGuideLink} ›</a></p>
      </section>
      <section className="g-sec" id="costs">
        <h2>{copy.costsTitle}</h2>
        <div>
          {copy.costs.map(row => <div className="g-row" key={row.label}><span>{row.label}</span><span>{row.price}</span></div>)}
        </div>
        <p className="g-muted">{copy.costsNote}</p>
      </section>
      <section className="g-sec g-faq" id="faq">
        <h2>{copy.faqTitle}</h2>
        {copy.faq.map(item => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}
      </section>
      <section className="g-sec" id="tools">
        <h2>{copy.toolsTitle}</h2>
        <p className="g-muted">{copy.toolsBody}</p>
        <a className="g-link" href={assetPath("/guide/tools")}>{copy.toolsLink} ›</a>
      </section>
    </div>
  </>;
}

/** The section whose top last crossed the sticky bars: drives the highlighted tab. */
function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? "");
  const key = ids.join(",");
  useEffect(() => {
    const list = key.split(",").filter(Boolean);
    const pick = () => {
      let current = list[0] ?? "";
      for (const id of list) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 160) current = id;
      }
      setActive(current);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    return () => window.removeEventListener("scroll", pick);
  }, [key]);
  return active;
}
