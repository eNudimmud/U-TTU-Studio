"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Arrow } from "@/components/glyph";
import { LanguageSwitcher, useI18n } from "@/components/i18n/provider";
import { assetPath, contactEmail, sourceRepo } from "@/lib/site";
import { LegacyStudioHash } from "./legacy-hash";
import { Brand, BrandLockup } from "@/components/brand";
import { PoweredBy } from "@/components/powered-by";
import "./home.css";

const STUDIO_HREF = assetPath("/studio");
/** « Try free · 0 credits »: the studio opens with the free U*TTU guide (start, FAQ, cost simulator) and the example tiles. */
const UTTU_HREF = assetPath("/studio?uttu=1");
const IMG = (name: string) => assetPath(`/images/accueil/${name}`);
const MEDIA = (name: string) => assetPath(`/media/accueil/${name}`);
/** Uttu in HD: one webp per width, the browser picks the one it needs. */
const srcset = (base: string) => [960, 1280, 1920, 2560].map(w => `${IMG(`${base}-${w}.webp`)} ${w}w`).join(", ");
/** On a portrait phone the hero image is drawn about 2.3× the screen width (object-fit: cover on a tall box). */
const HERO_SIZES = "(max-width: 900px) and (orientation: portrait) 232vw, 100vw";

/* Hero: five inspiration images in a slow Ken Burns crossfade (CSS only), Uttu on the quay first. */
const SLIDES = [
  { cls: "s1", src: IMG("uttu-quai-1920.webp"), set: srcset("uttu-quai") },
  { cls: "s2", src: IMG("uttu-portrait-1920.webp"), set: srcset("uttu-portrait") },
  { cls: "s3", src: IMG("hero-gare.webp") },
  { cls: "s4", src: IMG("hero-village.webp") },
  { cls: "s5", src: IMG("hero-village-clair.webp") },
] as const;
const FLOW = ["cast", "decor", "prise", "montage", "finaliser"] as const;
const ALSO = ["bubble", "refs", "angles", "video", "son", "multicam", "library", "upload", "guide", "creations", "quote", "langs"] as const;

function PauseIcon({ paused }: { paused: boolean }) {
  return paused
    ? <svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M3 1.5v11l9.5-5.5z" /></svg>
    : <svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><rect x="2" y="1" width="3.5" height="12" rx="1" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" /></svg>;
}

export function HomeLanding() {
  const { t } = useI18n();
  const rich = (key: string) => t.rich(key, { em: (chunks: ReactNode) => <em>{chunks}</em> });
  const list = (key: string, n: number) => Array.from({ length: n }, (_, i) => t(`${key}.${i}`));
  const root = useRef<HTMLDivElement>(null);
  const [solid, setSolid] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    const onVisible = () => setHidden(document.hidden);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.removeEventListener("scroll", onScroll); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  /* Sections below the hero rise in once; the two studio loops only play while on screen (never with reduced motion). */
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.dataset.reveal = still ? "off" : "on";
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in");
      reveal.unobserve(entry.target);
    }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
    el.querySelectorAll(".hv-rv").forEach(node => reveal.observe(node));
    const loops = new IntersectionObserver(entries => entries.forEach(entry => {
      const video = entry.target as HTMLVideoElement;
      if (still) return;
      if (entry.isIntersecting) { video.preload = "auto"; video.play().catch(() => {}); } else video.pause();
    }), { threshold: .25 });
    el.querySelectorAll<HTMLVideoElement>("video[data-lazy]").forEach(node => loops.observe(node));
    return () => { reveal.disconnect(); loops.disconnect(); };
  }, []);

  const paused = userPaused || hidden;
  return <div className="hv" ref={root}>
    <LegacyStudioHash />
    <header className={solid ? "hv-bar is-solid" : "hv-bar"}>
      <Brand href={assetPath("/")} label={t("landing.home")} className="wordmark hv-mark" />
      <span className="hv-sp" />
      <LanguageSwitcher />
      <a className="hv-btn hv-glass hv-bar-cta" href={STUDIO_HREF}>{t("landing.enter")}</a>
    </header>
    <main id="contenu" className="hv-main" tabIndex={-1}>
      <section className={paused ? "hv-hero is-paused" : "hv-hero"} aria-labelledby="landing-title" data-hero="">
        <div className="hv-slides" aria-hidden="true">
          {SLIDES.map((slide, i) => <div key={slide.cls} className={`hv-slide ${slide.cls}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slide.src} srcSet={"set" in slide ? slide.set : undefined} sizes={"set" in slide ? HERO_SIZES : undefined} alt="" decoding="async" fetchPriority={i === 0 ? "high" : undefined} />
          </div>)}
        </div>
        <div className="hv-hero-in">
          <div className="hv-copy">
            <BrandLockup className="hv-lockup" alt="U*TTU Studio" />
            <p className="hv-kicker hv-mono" data-landing-kicker="">{t("accueil.kicker")}</p>
            <h1 id="landing-title">{rich("accueil.h1")}</h1>
            <p className="hv-lead"><span>{t("accueil.sub")}</span><span>{t("accueil.sub2")}</span></p>
            <div className="hv-ctas">
              <a className="hv-btn hv-gold" href={STUDIO_HREF} data-enter-studio="">{t("landing.enter")} <Arrow /></a>
              <a className="hv-btn hv-glass" href={UTTU_HREF} data-try-free="">{t("landing.tryFree")}</a>
              <PoweredBy className="hv-badge" />
            </div>
          </div>
          <div className="hv-side">
            <div className="hv-caps" aria-hidden="true">{list("accueil.caps", 5).map(cap => <span key={cap}>{cap}</span>)}</div>
            <div className="hv-track" aria-hidden="true">{SLIDES.map(slide => <i key={slide.cls}><b /></i>)}</div>
            <button className="hv-pp" type="button" aria-label={paused ? t("accueil.play") : t("accueil.pause")} aria-pressed={userPaused} onClick={() => setUserPaused(value => !value)}><PauseIcon paused={paused} /></button>
          </div>
        </div>
      </section>

      <section className="hv-show hv-wrap" aria-labelledby="hv-show-title">
        <p className="hv-eyebrow hv-mono hv-rv">{t("accueil.showEyebrow")}</p>
        <div className="hv-head"><h2 id="hv-show-title" className="hv-rv">{rich("accueil.showTitle")}</h2><p className="hv-rv d1">{t("accueil.showLead")}</p></div>
        <div className="hv-gal">
          <figure className="hv-shot g1 hv-rv">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG("uttu-portrait-1280.webp")} srcSet={srcset("uttu-portrait")} sizes="(max-width: 900px) 100vw, 58vw" alt={t("accueil.g1Alt")} loading="lazy" decoding="async" />
            <figcaption><p className="hv-tag hv-mono">{t("accueil.g1Tag")}</p><b>{t("accueil.g1")}</b></figcaption>
          </figure>
          <figure className="hv-shot g2 hv-rv d1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG("gare.webp")} alt={t("accueil.g2Alt")} loading="lazy" decoding="async" />
            <figcaption><p className="hv-tag hv-mono">{t("accueil.g2Tag")}</p><b>{t("accueil.g2")}</b></figcaption>
          </figure>
          <figure className="hv-shot g3 hv-rv d2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG("village.webp")} alt={t("accueil.g3Alt")} loading="lazy" decoding="async" />
            <figcaption><p className="hv-tag hv-mono">{t("accueil.g3Tag")}</p><b>{t("accueil.g3")}</b></figcaption>
          </figure>
        </div>
        <p className="hv-fine hv-rv">{t("accueil.fine")}</p>
      </section>

      <section className="hv-flow hv-wrap" aria-labelledby="hv-flow-title">
        <p className="hv-eyebrow hv-mono hv-rv" id="hv-flow-title">{t("accueil.flowTitle")}</p>
        <ol className="hv-steps hv-rv d1">
          {FLOW.map(step => <li key={step}><b>{t(`accueil.flow.${step}.name`)}</b><span>{t(`accueil.flow.${step}.body`)}</span></li>)}
        </ol>
      </section>

      <section className="hv-tools hv-wrap" aria-labelledby="hv-tools-title">
        <div className="hv-head"><h2 id="hv-tools-title" className="hv-rv">{rich("accueil.toolsTitle")}</h2><p className="hv-rv d1">{t("accueil.toolsLead")}</p></div>
        <div className="hv-bento">
          <article className="hv-tile big t-map hv-rv">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG("village-clair.webp")} alt={t("accueil.mapAlt")} loading="lazy" decoding="async" />
            <figure className="hv-inset">
              <video muted loop playsInline preload="none" poster={MEDIA("loop-map-poster.webp")} data-lazy="" aria-hidden="true">
                <source src={MEDIA("loop-map.webm")} type="video/webm" /><source src={MEDIA("loop-map.mp4")} type="video/mp4" />
              </video>
              <figcaption>{t("accueil.inStudio")}</figcaption>
            </figure>
            <div className="hv-txt"><p className="hv-tag hv-mono">{t("accueil.mapTag")}</p><h3>{t("accueil.mapTitle")}</h3><p>{t("accueil.mapBody")}</p><p className="hv-specs">{list("accueil.mapSpecs", 3).map(spec => <span key={spec}>{spec}</span>)}</p></div>
          </article>
          <article className="hv-tile big t-stage hv-rv d1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG("uttu-quai-1280.webp")} srcSet={srcset("uttu-quai")} sizes="(max-width: 900px) 100vw, 50vw" alt={t("accueil.stageAlt")} loading="lazy" decoding="async" />
            <figure className="hv-inset">
              <video muted loop playsInline preload="none" poster={MEDIA("loop-stage-poster.webp")} data-lazy="" aria-hidden="true">
                <source src={MEDIA("loop-stage.webm")} type="video/webm" /><source src={MEDIA("loop-stage.mp4")} type="video/mp4" />
              </video>
              <figcaption>{t("accueil.inStudio")}</figcaption>
            </figure>
            <div className="hv-txt"><p className="hv-tag hv-mono">{t("accueil.stageTag")}</p><h3>{t("accueil.stageTitle")}</h3><p>{t("accueil.stageBody")}</p><p className="hv-specs">{list("accueil.stageSpecs", 3).map(spec => <span key={spec}>{spec}</span>)}</p></div>
          </article>
          <article className="hv-tile small t-ltx hv-rv">
            <div className="hv-txt"><p className="hv-big5">5 s</p><p className="hv-tag hv-mono">{t("accueil.ltxTag")}</p><h3>{t("accueil.ltxTitle")}</h3><p>{t("accueil.ltxBody")}</p></div>
          </article>
          <article className="hv-tile small t-cap hv-rv d1">
            <figure className="hv-cap" role="img" aria-label={t("accueil.capAlt")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG("capture-cadrage.webp")} alt="" loading="lazy" decoding="async" />
              <figcaption aria-hidden="true">{list("accueil.capParts", 3).map(part => <span key={part}>{part}</span>)}</figcaption>
            </figure>
            <div className="hv-txt"><p className="hv-tag hv-mono">{t("accueil.capTag")}</p><h3>{t("accueil.capTitle")}</h3><p>{t("accueil.capBody")}</p></div>
          </article>
        </div>
      </section>

      <section className="hv-also hv-wrap" aria-labelledby="hv-also-title">
        <p className="hv-eyebrow hv-mono hv-rv" id="hv-also-title">{t("accueil.alsoTitle")}</p>
        <ul className="hv-rv d1">
          {ALSO.map(item => <li key={item}><b>{t(`accueil.also.${item}.name`)}</b><span>{t(`accueil.also.${item}.body`)}</span></li>)}
        </ul>
      </section>

      <section className="hv-end" aria-labelledby="hv-end-title">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hv-end-bg" src={IMG("hero-gare.webp")} alt="" loading="lazy" decoding="async" />
        <div className="hv-wrap">
          <BrandLockup className="hv-end-logo hv-rv" alt="U*TTU Studio" />
          <h2 id="hv-end-title" className="hv-rv d1">{rich("accueil.endTitle")}</h2>
          <div className="hv-ctas hv-rv d2">
            <a className="hv-btn hv-gold" href={STUDIO_HREF}>{t("landing.enter")} <Arrow /></a>
            <a className="hv-btn hv-glass" href={UTTU_HREF}>{t("landing.tryFree")}</a>
          </div>
          <ul className="hv-trust hv-rv d3">{list("accueil.trust", 3).map(line => <li key={line}>{line}</li>)}</ul>
          <PoweredBy className="hv-badge hv-rv d3" />
        </div>
      </section>
    </main>
    <footer className="hv-foot">
      <div className="hv-wrap">
        <span>{t("accueil.foot")}</span>
        <a href={`mailto:${contactEmail}`}>{t("landing.contact")}</a>
        <a href={sourceRepo} target="_blank" rel="noopener noreferrer" data-source-code="">{t("landing.code")}</a>
        <span>{t("accueil.attrib")}</span>
      </div>
    </footer>
  </div>;
}
