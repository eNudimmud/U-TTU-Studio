"use client";

// Studio entry: one question, three examples, the tool grid, and one door into the film.
// The grid is the same list as « Créer » and search — every ready tool, zero extra clicks.

import { useId, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { FAMILLES, cherche, familleVitrine, intentDe, outilsPublics, type Famille, type Outil } from "@/lib/outils/catalogue";
import { routePrompt } from "@/lib/outils/route";
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

export function StudioHome() {
  const { t } = useI18n();
  const { connected, setSheet, prefs } = useStudio();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const promptId = useId();
  const searchId = useId();
  const cards = useMemo(() => outilsPublics(prefs), [prefs]);

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

  const shown = cards.filter(item => !query.trim() || cherche(`${titre(t, item.id)} ${ligne(t, item.id)} ${t(`outils.fam.${familleVitrine(item)}`)}`, query));

  return <section className="u-entry" data-studio-entry="" data-outils-hub="" aria-labelledby="u-title">
    {!connected && <p className="u-entry-link" data-entry-link="">
      <span>{t("entry.linkTitle")}</span>
      <button type="button" className="u-secondary" onClick={() => setSheet("connect")}>{t("entry.link")}</button>
    </p>}
    <header className="u-entry-ask">
      <h1 id="u-title" tabIndex={-1}>{t("outils.entry")}</h1>
      <form className="u-entry-form" onSubmit={event => { event.preventDefault(); launch(text); }}>
        <label className="u-field" htmlFor={promptId}>
          <span className="sr-only">{t("entry.promptPh")}</span>
          <textarea id={promptId} rows={3} value={text} maxLength={800} placeholder={t("entry.promptPh")} data-entry-prompt="" onChange={event => setText(event.target.value)} />
        </label>
        <button type="submit" className="u-primary u-entry-go" data-entry-go="">{t("entry.go")}</button>
      </form>
      <div className="u-entry-chips" role="group" aria-label={t("outils.entry")}>
        {CHIPS.map(id => <button key={id} type="button" className="u-chip" data-entry-chip={id} onClick={() => { const sample = t(`entry.chip.${id}`); setText(sample); launch(sample); }}>{t(`entry.chip.${id}`)}</button>)}
      </div>
    </header>
    <button type="button" className="u-entry-film" data-entry-film="" onClick={goFilm}>
      <strong>{t("entry.film")}</strong>
      <span>{t("entry.filmLine")}</span>
    </button>
    <div className="u-outils-tools">
      <label className="u-field u-outils-search" htmlFor={searchId}>
        <span className="sr-only">{t("outils.search")}</span>
        <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("outils.search")} data-outils-search="" />
      </label>
    </div>
    <p className="u-small" aria-live="polite" data-outils-count={shown.length}>{shown.length ? t("outils.count", { n: String(shown.length) }) : t("outils.none")}</p>
    {FAMILLES.map(fam => <Family key={fam} fam={fam} items={shown.filter(item => familleVitrine(item) === fam)} />)}
  </section>;
}

function Family({ fam, items }: { fam: Famille; items: Outil[] }) {
  const { t } = useI18n();
  if (items.length === 0) return null;
  return <section className="u-outils-family" data-outils-section={fam}>
    <h2>{t(`outils.fam.${fam}`)}</h2>
    <div className="u-outils-grid">{items.map(item => <ToolCard key={item.id} outil={item} />)}</div>
  </section>;
}

function ToolCard({ outil }: { outil: Outil }) {
  const { t } = useI18n();
  return <button type="button" className="u-outil-card" data-outil={outil.id} data-etat="pret" onClick={() => openStudioTool(outil.id)}>
    <span className="u-outil-name">{titre(t, outil.id)}</span>
    <span className="u-outil-line">{ligne(t, outil.id)}</span>
  </button>;
}
