"use client";

// The one creation page: « Qu’est-ce qu’on tourne ? », the compact bar (Image · Vidéo · Agent, references,
// settings on demand), the door into the film (CAST → DÉCOR → PRISE → MONTAGE), every ready tool in one
// row per family (the same list as the rail and search).

import { STUDIO_HERO, THUMB_SIZES } from "@/lib/studio-hero";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { FAMILLES, cherche, familleVitrine, intentDe, outilRow, outilsPublics, type Famille, type Outil } from "@/lib/outils/catalogue";
import { MAQUETTE_HASH, MAQUETTE_ID, REPERAGE_ID, vignette, vignette2x, vignetteAnimee } from "@/lib/outils/vignettes";
import { assetPath } from "@/lib/site";
import { FamilyIcon, scrollToFamily } from "./studio-nav";
import { useStudio } from "./studio-session";
import { CreationBar } from "./creation-bar";
import { BarreFil, useFil } from "./barre-fil";


const noSubscribe = () => () => {};

export function openStudioTool(id: string | null, { replace = false }: { replace?: boolean } = {}) {
  const hash = id ? `#outils/${id}` : "#outils";
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  if (window.location.hash !== hash) {
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}


/** Opens PRISE with its maquette unfolded (free until the take is filmed). */
export function openMaquette() {
  if (window.location.hash !== MAQUETTE_HASH) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${MAQUETTE_HASH}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function goFilm() {
  const hash = "#personnage";
  if (window.location.hash !== hash) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function titre(t: (key: string) => string, id: string) {
  return t(`outils.t.${intentDe(id)}.title`);
}
function ligne(t: (key: string) => string, id: string) {
  return t(`outils.t.${intentDe(id)}.line`);
}

/** The title with its one gold key word (« créer »), the rest white. */
export function KeyTitle({ text, word }: { text: string; word: string }) {
  const at = word ? text.toLocaleLowerCase().indexOf(word.toLocaleLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return <>{text.slice(0, at)}<em className="u-key">{text.slice(at, at + word.length)}</em>{text.slice(at + word.length)}</>;
}


/** The one creation page (« Qu’est-ce qu’on tourne ? »), below the bar: the film door, then every
 * ready tool in one row per family. */
function CreationTools() {
  const { t } = useI18n();
  const { prefs } = useStudio();
  const [query, setQuery] = useState("");
  const searchId = useId();
  const cards = useMemo(() => outilsPublics(prefs), [prefs]);
  const needle = query.trim();
  const shown = cards.filter(item => !needle || cherche(`${titre(t, item.id)} ${ligne(t, item.id)} ${t(`outils.fam.${familleVitrine(item)}`)}`, query));
  const scout = !needle || cherche(`${t(`outils.t.${REPERAGE_ID}.title`)} ${t(`outils.t.${REPERAGE_ID}.line`)} ${t("outils.fam.3d")}`, query);
  const maquette = !needle || cherche(`${t(`outils.t.${MAQUETTE_ID}.title`)} ${t(`outils.t.${MAQUETTE_ID}.line`)} ${t("outils.fam.3d")}`, query);
  const total = shown.length + (scout ? 1 : 0) + (maquette ? 1 : 0);
  return <>
    <button type="button" className="u-entry-film" data-entry-film="" onClick={goFilm}>
      <img src={STUDIO_HERO.src} srcSet={STUDIO_HERO.srcSet} sizes={STUDIO_HERO.sizes} alt="" width={1600} height={900} loading="eager" fetchPriority="high" decoding="async" data-entry-hero="" />
      <span className="u-entry-film-copy">
        <strong>{t("entry.film")}</strong>
        <span>{t("entry.filmLine")}</span>
      </span>
      <span className="u-entry-film-go" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
    </button>
    <div className="u-outils-tools" data-outils-tools="" tabIndex={-1}>
      <p className="eyebrow">{t("outils.entryLead", { n: String(cards.length + 2) })}</p>
      <label className="u-field u-outils-search" htmlFor={searchId}>
        <span className="sr-only">{t("outils.search")}</span>
        <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("outils.search")} data-outils-search="" />
      </label>
      <p className="eyebrow" aria-live="polite" data-outils-count={shown.length}>{total ? t("outils.count", { n: String(total) }) : t("outils.none")}</p>
    </div>
    {FAMILLES.map(fam => <Family key={fam} fam={fam} items={shown.filter(item => familleVitrine(item) === fam)} scout={fam === "3d" && scout} maquette={fam === "3d" && maquette} />)}
  </>;
}

/** « Tous les outils » (#outils/tous) is the same page, scrolled to the tools. */
export function StudioHome() {
  return <BarreHome tous />;
}

/** The home: title, the creation bar and its thread, then the film door and every ready tool. */
export function BarreHome({ tous = false, early = false }: { tous?: boolean; early?: boolean } = {}) {
  const { t } = useI18n();
  const { connected, setSheet } = useStudio();
  // F14 · The home is in the server HTML, where no saved link is known: the server and the hydrating
  // client both show « Relier mon compte », then the client's answer. A linked visitor never sees it
  // flash: the boot script's data-u-linked hides it until then (app.css).
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const askLink = hydrated ? !connected : true;
  const runner = useFil();
  const threaded = runner.fil.messages.length > 0;
  useEffect(() => {
    if (!tous) { requestAnimationFrame(() => scrollToFamily()); return; }
    requestAnimationFrame(() => { const node = document.querySelector<HTMLElement>("[data-outils-tools]"); node?.scrollIntoView({ block: "start", behavior: "instant" }); node?.focus({ preventScroll: true }); });
  }, [tous]);

  return <section
    className="u-entry u-barre-home"
    data-studio-entry=""
    data-barre-home=""
    data-barre-v2=""
    data-outils-hub=""
    data-tous={tous ? "" : undefined}
    data-threaded={threaded ? "" : undefined}
    data-early={early ? "" : undefined}
    inert={early}
    aria-busy={early || undefined}
    aria-labelledby="u-title"
  >
    {askLink && <p className="u-entry-link" data-entry-link="">
      <img src={assetPath("/exemples/comfy-logomark-yellow.svg")} alt="" width={18} height={18} />
      <span>{t("entry.linkTitle")}</span>
      <button type="button" className="u-secondary" onClick={() => setSheet("connect")}>{t("entry.link")}</button>
    </p>}
    <h1 id="u-title" className="u-display u-barre-title" tabIndex={-1}><KeyTitle text={t("barre.title")} word={t("barre.titleKey")} /></h1>
    <BarreFil runner={runner} />
    <CreationBar onSend={input => runner.send(input)} preview={runner.preview} />
    <CreationTools />
  </section>;
}

function Family({ fam, items, scout, maquette }: { fam: Famille; items: Outil[]; scout: boolean; maquette: boolean }) {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  const rowId = useId();
  const count = items.length + (scout ? 1 : 0) + (maquette ? 1 : 0);
  if (count === 0) return null;
  return <section className="u-outils-family" data-outils-section={fam} aria-labelledby={`${rowId}-h`}>
    <div className="u-family-head">
      <h2 id={`${rowId}-h`} tabIndex={-1}>{t(`outils.fam.${fam}`)} <span className="u-family-n">{count}</span></h2>
      {count > 2 && <button type="button" className="u-family-all" aria-expanded={all} aria-controls={rowId} data-family-all={fam} onClick={() => setAll(value => !value)}>{all ? t("outils.rowLess") : t("outils.rowAll")}</button>}
    </div>
    <div id={rowId} className="u-outils-row" data-all={all ? "" : undefined}>
      {items.map(item => <ToolCard key={item.id} outil={item} />)}
      {maquette && <MaquetteCard />}
      {scout && <ScoutCard />}
    </div>
  </section>;
}

/** The thumbnail of a card: a real house render, or a quiet wave for sound. */
// One observer for every animated card: a loop plays only while its card is on screen.
let loopObserver: IntersectionObserver | null = null;
function observeLoop(video: HTMLVideoElement): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  loopObserver ??= new IntersectionObserver(entries => {
    for (const e of entries) {
      const v = e.target as HTMLVideoElement;
      if (e.isIntersecting) { if (v.preload !== "auto") v.preload = "auto"; v.play().catch(() => {}); }
      else v.pause();
    }
  }, { rootMargin: "120px 0px", threshold: 0.25 });
  loopObserver.observe(video);
  return () => { loopObserver?.unobserve(video); video.pause(); };
}

/** True unless the visitor asked for reduced motion (then the still poster stays). */
function useMotionOk(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setOk(!mq.matches);
    sync(); mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return ok;
}

function CardLoop({ webm, mp4, poster }: { webm: string; mp4: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => (ref.current ? observeLoop(ref.current) : undefined), []);
  return <video ref={ref} className="u-outil-loop" data-on={on ? "" : undefined} muted loop playsInline preload="none"
    poster={poster} width={640} height={400} disablePictureInPicture onPlaying={() => setOn(true)}>
    <source src={webm} type="video/webm" />
    <source src={mp4} type="video/mp4" />
  </video>;
}

export function CardThumb({ id, fam }: { id: string; fam: Famille | "reperage" | "maquette" }) {
  const key = intentDe(id);
  const src = vignette(key), src2x = vignette2x(key), loop = vignetteAnimee(key);
  const motion = useMotionOk();
  return <span className="u-outil-thumb" aria-hidden="true">
    {src ? <img src={assetPath(src)} srcSet={src2x ? `${assetPath(src)} 640w, ${assetPath(src2x)} 1280w` : undefined} sizes={src2x ? THUMB_SIZES : undefined} alt="" width={640} height={400} loading="lazy" decoding="async" /> : <span className="u-outil-glyph"><FamilyIcon fam={fam === "maquette" ? "3d" : fam} /></span>}
    {src && loop && motion ? <CardLoop webm={assetPath(loop.webm)} mp4={assetPath(loop.mp4)} poster={assetPath(src)} /> : null}
  </span>;
}

function ToolCard({ outil }: { outil: Outil }) {
  const { t } = useI18n();
  return <button type="button" className="u-outil-card" data-outil={outil.id} data-etat="pret" onClick={() => openStudioTool(outil.id)}>
    <CardThumb id={outil.id} fam={familleVitrine(outil)} />
    <span className="u-outil-name">{titre(t, outil.id)}</span>
    <span className="u-outil-line">{ligne(t, outil.id)}</span>
    <ToolCost outil={outil} />
  </button>;
}

function ToolCost({ outil }: { outil: Outil }) {
  const { t } = useI18n();
  const credits = outilRow(outil)?.credits ?? null;
  return credits === null ? null : <span className="u-outil-cost u-cost-est">{t("outils.costEst", { credits: formatCredits(credits) })}</span>;
}

function ScoutCard() {
  const { t } = useI18n();
  return <button type="button" className="u-outil-card" data-outil-reperage="" data-etat="pret" onClick={() => openStudioTool(REPERAGE_ID)}>
    <CardThumb id={REPERAGE_ID} fam="reperage" />
    <span className="u-outil-name">{t(`outils.t.${REPERAGE_ID}.title`)}</span>
    <span className="u-outil-line">{t(`outils.t.${REPERAGE_ID}.line`)}</span>
    <span className="u-outil-cost u-cost-est">{t("rep3d.cardCost")}</span>
  </button>;
}

function MaquetteCard() {
  const { t } = useI18n();
  return <button type="button" className="u-outil-card" data-outil-maquette="" data-etat="pret" onClick={openMaquette}>
    <CardThumb id={MAQUETTE_ID} fam="maquette" />
    <span className="u-outil-name">{t(`outils.t.${MAQUETTE_ID}.title`)}</span>
    <span className="u-outil-line">{t(`outils.t.${MAQUETTE_ID}.line`)}</span>
  </button>;
}
