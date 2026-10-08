"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PROJECT_NAME } from "@/lib/coffre/project";
import { folderLinkSupported } from "@/lib/coffre/link";
import { isPlaceLora } from "@/lib/coffre/model";
import { formatCredits } from "@/lib/credits";
import { quoteSentence } from "@/lib/render/billed-quote";
import { TAKE_STEPS, takeProfile } from "@/lib/render/take-graph";
import { quotedCredits } from "@/lib/stage";
import { assetPath } from "@/lib/site";
import { LanguageSwitcher, useI18n } from "@/components/i18n/provider";
import { CinemaGestures } from "./cinema-gestures";
import { FichesScreen } from "./fiches-screen";
import { Why } from "./guide-bubble";
import { Close } from "./glyphs";
import { LoraScreen } from "./lora-screen";
import { ProjectMemory } from "./project-memory";
import { SceneScreen } from "./scene-screen";
import { Segments } from "./slots";
import { useStudio } from "./studio-context";
import type { WorkflowFiche } from "@/lib/workflow-fiches";
import type { Tab } from "@/lib/studio-route";

export function StudioDrawer({
  focus,
  onClose,
  onGo,
}: {
  focus: "fiches" | "fichier" | "trajet" | null;
  onClose(): void;
  onGo(next: Tab, opts?: { file?: boolean; scene?: "vues" | "image" | null }): void;
}) {
  const { t, say } = useI18n();
  const studioApi = useStudio();
  const { studio, exportCoffre, importCoffre, linkFolder, folder, createNamedProject, selectNamedProject, setSheet, settings, setSettings, takeQuote, setEngine } = studioApi;
  const [draft, setDraft] = useState(studio.projects.length === 0 ? DEFAULT_PROJECT_NAME : "");
  const [importing, setImporting] = useState(false);
  const [linkable, setLinkable] = useState(false);
  const people = studio.loras.filter(lora => !isPlaceLora(lora));
  const credits = quotedCredits(takeQuote);
  const profile = takeProfile(settings);

  useEffect(() => {
    setLinkable(folderLinkSupported());
    const close = document.getElementById("u-drawer-close");
    close?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return <div className="u-drawer" role="presentation">
    <button type="button" className="u-drawer-back" aria-label={t("stage.closeDrawer")} onClick={onClose} />
    <aside className="u-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="u-drawer-title">
      <header className="u-sheet-head">
        <h2 id="u-drawer-title">{t("nav.studio")}</h2>
        <button type="button" id="u-drawer-close" className="u-icon" aria-label={t("stage.closeDrawer")} onClick={onClose}><Close /></button>
      </header>
      <div className="u-drawer-body">
        <div className="u-drawer-lang"><LanguageSwitcher /></div>
        <section className="u-stack">
          <p className="u-small">{t("stage.drawerProject")}</p>
          <div role="radiogroup" aria-label={t("sheet.currentProject")} className="u-project-list">
            {studio.projects.map(item => <label key={item.slug}>
              <input type="radio" name="projet-tiroir" checked={studio.project === item.slug} onChange={() => void selectNamedProject(item.slug)} />
              <span>{item.name}</span>
            </label>)}
          </div>
          <label className="u-field">{t("sheet.projectName")}
            <input value={draft} maxLength={40} aria-label={t("sheet.projectName")} autoComplete="off" onChange={event => setDraft(event.target.value)} />
          </label>
          <button type="button" className="u-secondary" disabled={!draft.trim()} aria-describedby={!draft.trim() ? "u-why-drawer-name" : undefined} onClick={() => { const name = draft.trim(); setDraft(""); void createNamedProject(name); }}>{t("sheet.createProject")}</button>
          <Why on={!draft.trim()} id="u-why-drawer-name" text={t("why.needName")} />
          <button type="button" className="u-secondary" onClick={() => void exportCoffre()}>{t("sheet.export")}</button>
          <label className="u-secondary u-file">
            {importing ? t("sheet.importing") : t("sheet.import")}
            <input type="file" accept=".zip,application/zip" aria-label={t("sheet.importLabel")} disabled={importing} onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setImporting(true);
              void importCoffre(file).finally(() => setImporting(false));
            }} />
          </label>
          {linkable && <button type="button" className="u-secondary" onClick={() => void linkFolder()}>{folder ? t("sheet.linkedFolder", { name: folder }) : t("sheet.linkObsidian")}</button>}
          <p className="u-small">{t("sheet.keysOut")}</p>
        </section>

        <section className="u-stack">
          <h3 className="u-label">{t("stage.drawerNotes")}</h3>
          <ProjectMemory heading={false} />
        </section>

        <section className="u-stack">
          <h3 className="u-label">{t("stage.drawerLists")}</h3>
          <p className="u-label">{t("nav.character")}</p>
          <ul className="u-ledger">
            <li><span>{studio.look.name.trim() || t("look.defaultName")}</span><span>{t("stage.photoCount", { count: studio.look.photos.length })}</span></li>
            {people.map(person => <li key={person.id}><span>{person.name || t("common.character")}</span><span>{t("stage.fileCharacter")}</span></li>)}
          </ul>
          <p className="u-label">{t("nav.scene")}</p>
          {studio.scenes.length === 0 ? <p className="u-small">{t("stage.missingDecor")}</p> : <ul className="u-ledger">
            {studio.scenes.map(item => <li key={item.id}><span>{item.name || t("common.unnamed")}</span></li>)}
          </ul>}
          <p className="u-label">{t("nav.take")}</p>
          {studio.takes.length === 0 ? <p className="u-small">{t("sphere.empty")}</p> : <ul className="u-ledger">
            {studio.takes.map(take => <li key={take.id}>
              <button type="button" className="u-link" onClick={() => setSheet({ take: take.id })}>{take.line || take.id}</button>
            </li>)}
          </ul>}
          <button type="button" className="u-secondary" onClick={() => setSheet("shots")}>{t("shot.title")}</button>
          <button type="button" className="u-secondary" onClick={() => setSheet("sequences")}>{t("sequence.title")}</button>
        </section>

        <section className="u-stack" id="u-drawer-cost">
          <h3 className="u-label">{t("stage.drawerCost")}</h3>
          <p>{t("stage.drawerProfile", { profile })}</p>
          <p className="u-cost">{credits !== null ? t("stage.aboutCredits", { amount: formatCredits(credits) }) : t("stage.noQuote")}</p>
          <p className="u-small">{say(quoteSentence(takeQuote))}</p>
          <Segments label={t("take.format")} value={settings.aspect} onChange={aspect => setSettings({ aspect })} options={[{ value: "vertical", label: "9:16" }, { value: "horizontal", label: "16:9" }, { value: "carre", label: "1:1" }]} />
          <Segments label={t("take.duration")} value={settings.seconds} onChange={seconds => setSettings({ seconds })} options={[{ value: 5, label: "5 s" }, { value: 8, label: "8 s" }]} />
          <Segments label={t("take.render")} value={settings.quality} onChange={quality => setSettings({ quality })} options={[{ value: "rapide", label: t("take.fast", { steps: TAKE_STEPS.rapide }) }, { value: "fine", label: t("take.fine", { steps: TAKE_STEPS.fine }) }]} />
        </section>

        <details className="u-fold" open={focus === "fiches"}>
          <summary>{t("nav.sheets")}</summary>
          <FichesScreen onLaunch={(fiche: WorkflowFiche) => {
            if (fiche.engine) setEngine(fiche.engine);
            onClose();
            onGo(fiche.dest, { file: fiche.focus === "file", scene: fiche.focus === "vues" || fiche.focus === "image" ? fiche.focus : null });
          }} />
        </details>

        <details className="u-fold" open={focus === "fichier"}>
          <summary>{t("stage.trainFile")}</summary>
          <LoraScreen onTake={() => { onClose(); onGo("prise"); }} onScene={() => { onClose(); onGo("scene"); }} onPhotos={() => { onClose(); onGo("lora"); }} choice={1} startFile onFile={() => {}} />
        </details>

        <details className="u-fold" open={focus === "trajet"}>
          <summary>{t("stage.cameraPath")}</summary>
          <SceneScreen onNext={() => { onClose(); onGo("prise"); }} onRole={() => { onClose(); onGo("lora"); }} />
        </details>

        <details className="u-fold">
          <summary>{t("stage.cinema")}</summary>
          <CinemaGestures />
        </details>

        <a className="u-link" href={assetPath("/compte")}>{t("sheet.optionalAccount")}</a>
      </div>
    </aside>
  </div>;
}
