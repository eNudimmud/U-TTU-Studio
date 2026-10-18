"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_NOTES, DEMO_SEQUENCES } from "@/lib/creation/demo";
import { memoryFilled } from "@/lib/coffre/memory";
import { assetPath } from "@/lib/site";
import { useI18n } from "@/components/i18n/provider";
import { ProjectGallery } from "./project-gallery";
import { StorageStatus } from "./storage-status";
import { studioTarget, type StudioTargetKind } from "@/lib/coffre/target";
import { ConnectSheet, CreditSheet } from "./studio-frames";
import { StudioProvider, useStudio } from "./studio-session";
import "./app.css";
import { StudioSplash } from "./splash";
import { CREATION_TYPES, TopBar, type CreationType } from "./top-bar";
import { AssistantPanel } from "./assistant-panel";

type Tab = "tout" | CreationType | "notes";

/** Project pages that are not files: sequences, shots and notes. */
interface Note {
  id: string;
  kind: "sequence" | "note";
  name: string;
  text: string;
  href: string | null;
}

const TABS: Tab[] = ["tout", ...CREATION_TYPES, "notes"];
const DENSITY = "u-ttu-creations-densite";

export function AtelierPage() {
  return <StudioProvider><AtelierFrame /></StudioProvider>;
}

function AtelierFrame() {
  const { t, say } = useI18n();
  const session = useStudio();
  const {
    ready, demo, studio, cast, notice, setNotice, sheet,
    folderMode, folderName,
    exportCoffre, importCoffre, importFiles, linkFolder, allowLinkedFolder,
  } = session;
  const [filter, setFilter] = useState<Tab>("tout");
  const [dense, setDense] = useState(false);
  const [sort, setSort] = useState<"recent" | "nom">("recent");
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      const type = params.get("type");
      setFilter(type && (TABS as string[]).includes(type) ? type as Tab : "tout");
    };
    read();
    try { setDense(window.localStorage.getItem(DENSITY) === "dense"); } catch { /* default */ }
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  function pickTab(next: Tab) {
    setFilter(next);
    const url = new URL(window.location.href);
    if (next === "tout") url.searchParams.delete("type"); else url.searchParams.set("type", next);
    url.searchParams.delete("item");
    window.history.replaceState(null, "", url);
  }

  function pickDensity(next: boolean) {
    setDense(next);
    try { window.localStorage.setItem(DENSITY, next ? "dense" : "large"); } catch { /* memory only */ }
  }

  useEffect(() => {
    if (window.location.hash !== "#coffre") return;
    setSettings(true);
    document.getElementById("coffre")?.scrollIntoView({ block: "start" });
  }, [ready]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  const showDemo = demo && cast.some(card => card.id.startsWith("demo-"));

  const notes = useMemo(() => {
    const studioHref = (demo: boolean, kind: StudioTargetKind, id: string) => assetPath(studioTarget(kind, id, studio.project, demo));
    const list: Note[] = [];
    const sequences = studio.sequences.length > 0 ? studio.sequences.map(item => ({ id: item.id, name: item.name })) : (showDemo ? DEMO_SEQUENCES : []);
    for (const item of sequences) list.push({ id: item.id, kind: "sequence", name: item.name, text: t("atelier.sequences"), href: studioHref(showDemo, "sequence", item.id) });
    for (const shot of studio.shots) list.push({ id: shot.id, kind: "sequence", name: shot.name, text: shot.note, href: studioHref(false, "plan", shot.id) });
    const memory = memoryFilled(studio.memory)
      ? [
          ...(["bible", "style", "lexique", "prompts"] as const).filter(kind => studio.memory[kind].trim()).map(kind => ({ id: kind, name: t(`memory.${kind}`), text: studio.memory[kind] })),
          ...studio.memory.notes.filter(note => note.text.trim()).map(note => ({ id: note.file, name: note.file, text: note.text })),
        ]
      : (showDemo ? DEMO_NOTES.map(note => ({ id: note.id, name: note.label, text: note.text })) : []);
    for (const note of memory) list.push({ id: note.id, kind: "note", name: note.name, text: note.text, href: null });
    return list;
  }, [showDemo, studio.project, studio.memory, studio.sequences, studio.shots, t]);
  const shownNotes = filter === "notes" || filter === "tout" ? notes : filter === "prises" ? notes.filter(note => note.kind === "sequence") : [];

  const linkable = folderMode !== "unsupported";

  return <div className="u-app">
    <TopBar place="creations" />
    <main id="contenu" className="u-main" tabIndex={-1}>
      <section className="u-stage u-library" aria-labelledby="u-title">
        <header className="u-head">
          <h1 id="u-title" tabIndex={-1}>{t("creations.title")}</h1>
        </header>
        <nav className="u-lib-tabs" aria-label={t("creations.types")}>
          {TABS.map(id => <button key={id} type="button" className="u-lib-tab" aria-pressed={filter === id} data-creations-tab={id} onClick={() => pickTab(id)}>
            {id === "notes" ? t("atelier.notes") : t(`creations.type.${id}`)}
          </button>)}
        </nav>
        <div className="u-lib-tools">
          <div className="u-choice-row" role="group" aria-label={t("creations.sort")}>
            {(["recent", "nom"] as const).map(id => <button key={id} type="button" className="u-chip" aria-pressed={sort === id} data-creations-sort={id} onClick={() => setSort(id)}>{t(`creations.sorts.${id}`)}</button>)}
          </div>
          <div className="u-choice-row" role="group" aria-label={t("creations.density")}>
            <button type="button" className="u-chip" aria-pressed={!dense} data-creations-density="large" onClick={() => pickDensity(false)}>{t("creations.large")}</button>
            <button type="button" className="u-chip" aria-pressed={dense} data-creations-density="dense" onClick={() => pickDensity(true)}>{t("creations.dense")}</button>
          </div>
        </div>
        <div id="galerie">
          {!ready ? <StudioSplash /> : <>
            {filter !== "notes" && <ProjectGallery type={filter} dense={dense} sort={sort} title={filter === "tout" ? t("creations.title") : t(`creations.type.${filter}`)} />}
            {shownNotes.length > 0 && <section className="u-lib-notes" aria-label={t("atelier.notes")}>
              <h2 className="u-label">{filter === "prises" ? t("atelier.sequences") : `${t("atelier.sequences")} · ${t("atelier.notes")}`}</h2>
              {shownNotes.map(note => <article key={`${note.kind}:${note.id}`} className="u-lib-note" data-note={note.id}>
                <strong>{note.name}</strong>
                {note.text && <small className="u-small">{note.text.length > 160 ? `${note.text.slice(0, 160)}…` : note.text}</small>}
                {note.href && <a href={note.href}>{t("atelier.reuse")}</a>}
              </article>)}
            </section>}
            {filter === "notes" && shownNotes.length === 0 && <p className="u-small" data-creations-empty="">{t("creations.empty")}</p>}
          </>}
        </div>
        <section className="u-lien u-fold" id="coffre" aria-labelledby="u-coffre-title">
          <h2 id="u-coffre-title" className="sr-only">{t("creations.settings")}</h2>
          <button type="button" className="u-fold-head" data-library-settings="" aria-expanded={settings} aria-controls="u-coffre-body" onClick={() => setSettings(value => !value)}>{t("creations.settings")}</button>
          <div id="u-coffre-body" className="u-avance-body" hidden={!settings}>
            <p>{t("atelier.linkExplain")}</p>
            <p id="u-why-lien">{t("atelier.linkMissing")}</p>
            <p className="u-small">{t("atelier.stays")}</p>
            <StorageStatus />
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
          </div>
        </section>
      </section>
    </main>
    {notice && <p className="u-toast" role="status">{say(notice)}</p>}
    <AssistantPanel />
    {sheet === "credits" && <CreditSheet />}
    {sheet === "connect" && <ConnectSheet />}
  </div>;
}

