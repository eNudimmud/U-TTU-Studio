"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCredits } from "@/lib/credits";
import { DEMO_NOTES, DEMO_SEQUENCES, DEMO_TAKES } from "@/lib/creation/demo";
import { memoryFilled } from "@/lib/coffre/memory";
import { assetPath } from "@/lib/site";
import { LanguageSwitcher, useI18n } from "@/components/i18n/provider";
import { Coffre, KindMark } from "./glyphs";
import { ConnectSheet, CreditSheet } from "./studio-frames";
import { StudioProvider, useStudio } from "./studio-session";
import "./app.css";

type Kind = "personnage" | "lieu" | "prise" | "sequence" | "note";
type Filter = "tout" | Kind;

interface Row {
  id: string;
  kind: Kind;
  name: string;
  text: string;
  image: string;
  href: string | null;
}

const FILTERS: { id: Filter; key: "atelier.all" | "atelier.characters" | "atelier.places" | "atelier.takes" | "atelier.sequences" | "atelier.notes" }[] = [
  { id: "tout", key: "atelier.all" },
  { id: "personnage", key: "atelier.characters" },
  { id: "lieu", key: "atelier.places" },
  { id: "prise", key: "atelier.takes" },
  { id: "sequence", key: "atelier.sequences" },
  { id: "note", key: "atelier.notes" },
];

function studioHref(demo: boolean, kind: Kind, id: string): string {
  const params = new URLSearchParams();
  if (demo) params.set("demo", "1");
  if (kind === "personnage") params.set("cast", id);
  if (kind === "lieu") params.set("decor", id);
  const query = params.toString();
  return assetPath(`/studio${query ? `?${query}` : ""}#prise`);
}

export function AtelierPage() {
  return <StudioProvider><AtelierFrame /></StudioProvider>;
}

function AtelierFrame() {
  const { t, say } = useI18n();
  const session = useStudio();
  const {
    ready, demo, studio, media, cast, decor, notice, setNotice, sheet, setSheet,
    connected, balance, balanceNote, folderMode, folderName,
    exportCoffre, importCoffre, importFiles, linkFolder, allowLinkedFolder, selectProject,
  } = session;
  const [filter, setFilter] = useState<Filter>("tout");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.hash !== "#coffre") return;
    document.getElementById("coffre")?.scrollIntoView({ block: "start" });
  }, [ready]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  const renderAria = !connected ? t("sheet.notLinked") : balance ? t("sheet.credits", { amount: formatCredits(balance.credits) }) : (balanceNote ? say(balanceNote) : t("sheet.balanceUnread"));
  const showDemo = demo && cast.some(card => card.id.startsWith("demo-"));
  const projects = studio.projects.length > 0 ? studio.projects : (showDemo ? [{ slug: "atelier", name: "Atelier" }] : []);

  const rows = useMemo(() => {
    const list: Row[] = [];
    for (const card of cast) {
      const image = card.preview ? assetPath(card.preview) : (card.sheet && media[card.sheet]) || (card.photos[0] && media[card.photos[0]]) || "";
      list.push({ id: card.id, kind: "personnage", name: card.name, text: card.prompt, image, href: studioHref(showDemo, "personnage", card.id) });
    }
    for (const card of decor) {
      const image = card.preview ? assetPath(card.preview) : (card.sheet && media[card.sheet]) || "";
      list.push({ id: card.id, kind: "lieu", name: card.name, text: card.prompt, image, href: studioHref(showDemo, "lieu", card.id) });
    }
    const takes = studio.takes.length > 0 ? studio.takes.map(take => ({ id: take.id, name: take.line, image: take.poster ? media[take.poster] ?? "" : "" })) : (showDemo ? DEMO_TAKES.map(take => ({ ...take, image: "" })) : []);
    for (const take of takes) list.push({ id: take.id, kind: "prise", name: take.name, text: "", image: take.image, href: studioHref(showDemo, "prise", take.id) });
    const sequences = studio.sequences.length > 0 ? studio.sequences.map(item => ({ id: item.id, name: item.name })) : (showDemo ? DEMO_SEQUENCES : []);
    for (const item of sequences) list.push({ id: item.id, kind: "sequence", name: item.name, text: "", image: "", href: studioHref(showDemo, "sequence", item.id) });
    for (const shot of studio.shots) list.push({ id: shot.id, kind: "sequence", name: shot.name, text: shot.note, image: "", href: studioHref(false, "sequence", shot.id) });
    const notes = memoryFilled(studio.memory)
      ? [
          ...(["bible", "style", "lexique", "prompts"] as const).filter(kind => studio.memory[kind].trim()).map(kind => ({ id: kind, name: t(`memory.${kind}`), text: studio.memory[kind] })),
          ...studio.memory.notes.filter(note => note.text.trim()).map(note => ({ id: note.file, name: note.file, text: note.text })),
        ]
      : (showDemo ? DEMO_NOTES.map(note => ({ id: note.id, name: note.label, text: note.text })) : []);
    for (const note of notes) list.push({ id: note.id, kind: "note", name: note.name, text: note.text, image: "", href: null });
    return list;
  }, [cast, decor, media, showDemo, studio.memory, studio.sequences, studio.shots, studio.takes, t]);

  const needle = query.trim().toLowerCase();
  const shown = rows.filter(row => (filter === "tout" || row.kind === filter) && (!needle || `${row.name} ${row.text}`.toLowerCase().includes(needle)));
  const current = shown.find(row => `${row.kind}:${row.id}` === open) ?? null;
  const linkable = folderMode !== "unsupported";

  return <div className="u-app">
    <header className="u-top">
      <a className="u-mark" href={assetPath("/studio#personnage")} aria-label="U*TTU Studio">U<em>*</em>TTU</a>
      <div className="u-top-tools">
        <a className="u-coffre" href={assetPath("/mon-studio")} aria-label={t("nav.studio")} aria-current="page"><Coffre /><span className="u-tool-label">{t("nav.studio")}</span></a>
        <button type="button" className="u-credit" onClick={() => setSheet("credits")} aria-label={t("sheet.walletAria", { render: renderAria })}>
          <span className="u-tool-full">{t("sheet.walletTitle")}</span>
          <span className="u-tool-short">{t("stage.creditsShort")}</span>
        </button>
        <LanguageSwitcher />
      </div>
    </header>
    <main id="contenu" className="u-main" tabIndex={-1}>
      <section className="u-stage" aria-labelledby="u-title">
        <header className="u-head">
          <h1 id="u-title" tabIndex={-1}>{t("nav.studio")}</h1>
          <p className="u-lead">{t("atelier.lead")}</p>
        </header>
        <section className="u-lien" id="coffre" aria-labelledby="u-coffre-title">
          <h2 id="u-coffre-title">{t("atelier.linkFolder")}</h2>
          <p>{t("atelier.linkExplain")}</p>
          <p id="u-why-lien">{t("atelier.linkMissing")}</p>
          <p className="u-small">{t("atelier.stays")}</p>
          {folderMode === "on" && folderName && <p>{t("atelier.linked", { name: folderName })} {t("atelier.auto")}</p>}
          {linkable ? <button type="button" className="u-primary" onClick={() => void (folderMode === "ask" || folderMode === "on" ? allowLinkedFolder() : linkFolder())}>{folderMode === "ask" || folderMode === "on" ? t("atelier.askAgain") : t("atelier.linkFolder")}</button> : <button type="button" className="u-primary" disabled aria-describedby="u-why-lien">{t("atelier.linkFolder")}</button>}
          <div className="u-row">
            <button type="button" className="u-secondary" onClick={() => void exportCoffre()}>{t("atelier.export")}</button>
            <label className="u-secondary">{t("atelier.import")}
              <input className="sr-only" type="file" accept=".zip,application/zip" aria-label={t("atelier.import")} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importCoffre(file); }} />
            </label>
            <label className="u-secondary">{t("atelier.importFolder")}
              <input className="sr-only" type="file" multiple aria-label={t("atelier.importFolder")} ref={node => { node?.setAttribute("webkitdirectory", ""); node?.setAttribute("directory", ""); }} onChange={event => { const files = [...(event.target.files ?? [])]; event.target.value = ""; if (files.length) void importFiles(files); }} />
            </label>
          </div>
        </section>
        <div className="u-atelier-grid">
          <aside>
            <p className="u-label">{t("atelier.projects")}</p>
            <div className="u-modes" role="radiogroup" aria-label={t("atelier.projects")}>
              {projects.map(project => <button key={project.slug} type="button" role="radio" aria-checked={studio.project === project.slug || (showDemo && studio.projects.length === 0)} onClick={() => { if (studio.projects.some(item => item.slug === project.slug)) void selectProject(project.slug); }}>{project.name}</button>)}
            </div>
            <div className="u-filter" role="group" aria-label={t("atelier.search")}>
              {FILTERS.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{t(item.key)}</button>)}
            </div>
            <label className="u-field">
              <span className="u-label">{t("atelier.search")}</span>
              <input className="u-search" value={query} onChange={event => setQuery(event.target.value)} />
            </label>
          </aside>
          <div id="galerie">
            {current && <article className="u-detail">
              <h2>{current.name}</h2>
              {current.text && <p>{current.text}</p>}
              <div className="u-card-actions">
                {current.href && <a className="u-link" href={current.href}>{t("atelier.reuse")}</a>}
                <button type="button" className="u-link" onClick={() => setOpen(null)}>{t("atelier.close")}</button>
              </div>
            </article>}
            {!ready ? <p className="u-loading" role="status">{t("nav.opening")}</p> : shown.length === 0 ? <p className="u-small">{t("atelier.empty")}</p> : <div className="u-gallery">
              {shown.map(row => <article key={`${row.kind}:${row.id}`} className="u-card-lg">
                {row.image ? <img src={row.image} alt="" /> : <KindMark kind={row.kind} />}
                <strong>{row.name}</strong>
                <small>{t(FILTERS.find(item => item.id === row.kind)?.key ?? "atelier.all")}</small>
                <div className="u-card-actions">
                  <button type="button" className="u-link" onClick={() => setOpen(`${row.kind}:${row.id}`)}>{t("atelier.open")}</button>
                  {row.href && <a className="u-link" href={row.href}>{t("atelier.reuse")}</a>}
                </div>
              </article>)}
            </div>}
          </div>
        </div>
      </section>
    </main>
    {notice && <p className="u-toast" role="status">{say(notice)}</p>}
    {sheet === "credits" && <CreditSheet />}
    {sheet === "connect" && <ConnectSheet />}
  </div>;
}
