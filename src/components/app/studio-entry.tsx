"use client";

// Studio entry: one question with Uttu beside it, three examples, one door into the film, and every
// ready tool in one row per family (thumbnail, name, one line). The rows are the same list as
// « Créer », the rail and search. One gold surface: « Continuer ». No cost on the cards; the
// estimate sits under the prompt, for the tool the sentence goes to.

import { useEffect, useId, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { FAMILLES, cherche, familleVitrine, intentDe, outilParId, outilRow, outilsPublics, type Famille, type Outil } from "@/lib/outils/catalogue";
import { routePrompt } from "@/lib/outils/route";
import { MAQUETTE_HASH, MAQUETTE_ID, REPERAGE_ID, UTTU_PORTRAIT, UTTU_PORTRAIT_WIDE, vignette } from "@/lib/outils/vignettes";
import { assetPath } from "@/lib/site";
import { FamilyIcon, scrollToFamily } from "./studio-nav";
import { useStudio } from "./studio-session";

const CHIPS = ["portrait", "anim", "film"] as const;

export function openStudioTool(id: string | null) {
  const hash = id ? `#outils/${id}` : "#outils";
  if (window.location.hash !== hash) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function rememberPrompt(text: string) {
  try { sessionStorage.setItem("u-ttu-consigne", text); } catch { /* the tool still opens */ }
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

/** « ≈ X cr. estimés » for the tool a sentence goes to. */
function routeQuote(t: (key: string, values?: Record<string, string>) => string, text: string) {
  const route = routePrompt(text.trim() || "image");
  if (route.kind === "film") return { name: t("entry.film"), cost: null };
  const outil = outilParId(route.id);
  const credits = outil ? outilRow(outil)?.credits ?? null : null;
  return { name: titre(t, route.id), cost: credits === null ? null : t("outils.costEst", { credits: formatCredits(credits) }) };
}

export function StudioHome() {
  const { t } = useI18n();
  const { connected, setSheet, prefs } = useStudio();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const promptId = useId();
  const searchId = useId();
  const routeId = useId();
  const cards = useMemo(() => outilsPublics(prefs), [prefs]);

  useEffect(() => { requestAnimationFrame(() => scrollToFamily()); }, []);

  function launch(raw: string) {
    const value = raw.trim();
    if (!value) return;
    const route = routePrompt(value);
    if (route.kind === "film") {
      goFilm();
      return;
    }
    rememberPrompt(value);
    openStudioTool(route.id);
  }

  const needle = query.trim();
  const shown = cards.filter(item => !needle || cherche(`${titre(t, item.id)} ${ligne(t, item.id)} ${t(`outils.fam.${familleVitrine(item)}`)}`, query));
  const scout = !needle || cherche(`${t(`outils.t.${REPERAGE_ID}.title`)} ${t(`outils.t.${REPERAGE_ID}.line`)} ${t("outils.fam.3d")}`, query);
  const maquette = !needle || cherche(`${t(`outils.t.${MAQUETTE_ID}.title`)} ${t(`outils.t.${MAQUETTE_ID}.line`)} ${t("outils.fam.3d")}`, query);
  const total = shown.length + (scout ? 1 : 0) + (maquette ? 1 : 0);
  const quote = routeQuote(t, text);

  return <section className="u-entry" data-studio-entry="" data-outils-hub="" aria-labelledby="u-title">
    {!connected && <p className="u-entry-link" data-entry-link="">
      <span>{t("entry.linkTitle")}</span>
      <button type="button" className="u-secondary" onClick={() => setSheet("connect")}>{t("entry.link")}</button>
    </p>}
    <div className="u-hero">
      <header className="u-entry-ask">
        <p className="eyebrow">{t("outils.entryLead", { n: String(cards.length + 1) })}</p>
        <h1 id="u-title" className="u-display" tabIndex={-1}><KeyTitle text={t("outils.entry")} word={t("outils.entryKey")} /></h1>
        <form className="u-entry-form" onSubmit={event => { event.preventDefault(); launch(text); }}>
          <label className="u-field" htmlFor={promptId}>
            <span className="sr-only">{t("entry.promptPh")}</span>
            <textarea id={promptId} rows={3} value={text} maxLength={800} placeholder={t("entry.promptPh")} data-entry-prompt="" aria-describedby={routeId} onChange={event => setText(event.target.value)} />
          </label>
          <div className="u-entry-bar">
            <p className="u-entry-route" id={routeId} data-entry-route=""><strong>{quote.name}</strong>{quote.cost && <> · <span className="u-cost-est">{quote.cost}</span></>}</p>
            <button type="submit" className="u-primary u-entry-go" data-entry-go="">{t("entry.go")}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
          </div>
        </form>
        <div className="u-entry-chips" role="group" aria-label={t("outils.entry")}>
          {CHIPS.map(id => <button key={id} type="button" className="u-chip" data-entry-chip={id} onClick={() => { const sample = t(`entry.chip.${id}`); setText(sample); launch(sample); }}>{t(`entry.chip.${id}`)}</button>)}
        </div>
      </header>
      <figure className="u-hero-uttu" data-entry-uttu="">
        <picture>
          <source media="(max-width: 899px)" srcSet={assetPath(UTTU_PORTRAIT_WIDE)} width={600} height={375} />
          <img src={assetPath(UTTU_PORTRAIT)} alt={t("entry.uttuAlt")} width={600} height={900} decoding="async" fetchPriority="high" />
        </picture>
        <figcaption>Uttu</figcaption>
      </figure>
    </div>
    <button type="button" className="u-entry-film" data-entry-film="" onClick={goFilm}>
      <img src={assetPath("/exemples/decor-quai-nuit.webp")} alt="" width={1600} height={900} loading="lazy" decoding="async" />
      <span className="u-entry-film-copy">
        <strong>{t("entry.film")}</strong>
        <span>{t("entry.filmLine")}</span>
      </span>
      <span className="u-entry-film-go" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
    </button>
    <div className="u-outils-tools">
      <label className="u-field u-outils-search" htmlFor={searchId}>
        <span className="sr-only">{t("outils.search")}</span>
        <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("outils.search")} data-outils-search="" />
      </label>
      <p className="eyebrow" aria-live="polite" data-outils-count={shown.length}>{total ? t("outils.count", { n: String(total) }) : t("outils.none")}</p>
    </div>
    {FAMILLES.map(fam => <Family key={fam} fam={fam} items={shown.filter(item => familleVitrine(item) === fam)} scout={fam === "3d" && scout} maquette={fam === "3d" && maquette} />)}
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
export function CardThumb({ id, fam }: { id: string; fam: Famille | "reperage" | "maquette" }) {
  const src = vignette(intentDe(id));
  return <span className="u-outil-thumb" aria-hidden="true">
    {src ? <img src={assetPath(src)} alt="" width={640} height={400} loading="lazy" decoding="async" /> : <span className="u-outil-glyph"><FamilyIcon fam={fam === "maquette" ? "3d" : fam} /></span>}
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
    <span className="u-outil-cost u-cost-est">{t("rep3d.free")}</span>
  </button>;
}

function MaquetteCard() {
  const { t } = useI18n();
  return <button type="button" className="u-outil-card" data-outil-maquette="" data-etat="pret" onClick={openMaquette}>
    <CardThumb id={MAQUETTE_ID} fam="maquette" />
    <span className="u-outil-name">{t(`outils.t.${MAQUETTE_ID}.title`)}</span>
    <span className="u-outil-line">{t(`outils.t.${MAQUETTE_ID}.line`)}</span>
    <span className="u-outil-cost u-cost-est">{t("rep3d.free")}</span>
  </button>;
}
