"use client";

import { useEffect, useState } from "react";
import { CONTINUITY_TIP, SCENE_FICHES } from "@/lib/doctrine";
import { processAction, processById, processGap } from "@/lib/processes";
import {
  SCENE_DEVICE_NOTE, SCENE_EXPORT, SCENE_EXPORTED, SCENE_IMPORT, SCENE_OPEN, SCENE_OTHER, SCENE_PASTE, SCENE_READ, SCENE_UNREADABLE,
  emptyBook, emptySheet, parseSceneMarkdown, readBook, saveBook, sceneFileName, sceneMarkdown, scenePath,
  type SceneBook, type SceneId, type SceneSheet,
} from "@/lib/scenes";
import { CopyButton } from "../guide/copy-button";

const FILE_LIMIT = 65_536;

export function SceneFiches({ onOpenEntre }: { onOpenEntre?: () => void }) {
  const [book, setBook] = useState<SceneBook>(emptyBook());
  const [ready, setReady] = useState(false);
  const entre = processById("entre");
  const entreGap = entre ? processGap(entre) : null;

  useEffect(() => {
    setBook(readBook(window.localStorage));
    setReady(true);
  }, []);

  function commit(id: SceneId, sheet: SceneSheet) {
    if (!ready) return;
    const next = { ...book, [id]: sheet };
    setBook(next);
    saveBook(window.localStorage, next);
  }

  return <div className="scene-fiches">
    <aside className="doctrine-note" role="note">
      <p><strong>Continuité.</strong> {CONTINUITY_TIP}</p>
      <p>{SCENE_DEVICE_NOTE}</p>
    </aside>
    <div className="fiche-grid">
      {SCENE_FICHES.map(fiche => <FicheCard
        key={fiche.id}
        fiche={fiche}
        sheet={book[fiche.id] ?? emptySheet()}
        ready={ready}
        entreLabel={fiche.id === "entre" && entre ? processAction(entre).label : "Bientôt"}
        entreLive={fiche.id === "entre" && entre?.state === "live" && Boolean(onOpenEntre)}
        entreGap={fiche.id === "entre" ? entreGap : null}
        onOpenEntre={onOpenEntre}
        onChange={sheet => commit(fiche.id, sheet)}
      />)}
    </div>
  </div>;
}

function FicheCard({
  fiche, sheet, ready, entreLabel, entreLive, entreGap, onOpenEntre, onChange,
}: {
  fiche: (typeof SCENE_FICHES)[number];
  sheet: SceneSheet;
  ready: boolean;
  entreLabel: string;
  entreLive: boolean;
  entreGap: string | null;
  onOpenEntre?: () => void;
  onChange: (sheet: SceneSheet) => void;
}) {
  const [paste, setPaste] = useState("");
  const [message, setMessage] = useState("");
  const markdown = sceneMarkdown(fiche.id, sheet);
  const lieuId = `fiche-${fiche.id}-lieu`;
  const leftId = `fiche-${fiche.id}-gauche`;
  const rightId = `fiche-${fiche.id}-droite`;

  function setAngle(index: 0 | 1 | 2 | 3, value: string) {
    const angles: SceneSheet["angles"] = [sheet.angles[0], sheet.angles[1], sheet.angles[2], sheet.angles[3]];
    angles[index] = value;
    onChange({ ...sheet, angles });
  }

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = sceneFileName(fiche.id);
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`${sceneFileName(fiche.id)} — ${SCENE_EXPORTED}`);
  }

  function apply(text: string, fileName?: string) {
    const parsed = parseSceneMarkdown(text, fileName);
    if (!parsed.ok) {
      setMessage(SCENE_UNREADABLE);
      return;
    }
    if (parsed.id !== fiche.id) {
      setMessage(SCENE_OTHER);
      return;
    }
    onChange(parsed.sheet);
    setPaste("");
    setMessage(SCENE_READ);
  }

  function openFile(file: File | undefined) {
    if (!file) return;
    if (file.size > FILE_LIMIT) {
      setMessage(SCENE_UNREADABLE);
      return;
    }
    void file.text().then(text => apply(text, file.name)).catch(() => setMessage(SCENE_UNREADABLE));
  }

  return <article className="fiche-card" data-fiche={fiche.id} aria-labelledby={`fiche-${fiche.id}`}>
    <p className="eyebrow"><a href="#studio"><code>{scenePath(fiche.id)}</code></a></p>
    <h2 id={`fiche-${fiche.id}`}>{fiche.title}</h2>
    {entreLive
      ? <button type="button" className="button button-primary" onClick={onOpenEntre}>{entreLabel}</button>
      : <p className="soon-mark">{entreLabel}</p>}
    {entreGap && <p>{entreGap}</p>}
    <p>{fiche.video}</p>
    <label htmlFor={lieuId}>Lieu
      <input id={lieuId} value={sheet.lieu} onChange={event => onChange({ ...sheet, lieu: event.target.value })} placeholder="Nom du lieu" maxLength={80} autoComplete="off" spellCheck={false} disabled={!ready} />
    </label>
    <div>
      <p className="fiche-kicker">Quatre angles</p>
      <ul className="fiche-angles" aria-label={`Angles de ${fiche.title}`}>
        {fiche.angles.map((angle, index) => {
          const field = index as 0 | 1 | 2 | 3;
          const angleId = `fiche-${fiche.id}-angle-${field}`;
          return <li key={angle}>
            <label htmlFor={angleId}>{angle}
              <input id={angleId} value={sheet.angles[field]} onChange={event => setAngle(field, event.target.value)} placeholder="Rappel" maxLength={80} autoComplete="off" spellCheck={false} disabled={!ready} />
            </label>
          </li>;
        })}
      </ul>
    </div>
    <p>{fiche.spatial}</p>
    <div className="fiche-spatial">
      <label htmlFor={leftId}>À gauche
        <input id={leftId} value={sheet.left} onChange={event => onChange({ ...sheet, left: event.target.value })} placeholder="Qui" maxLength={80} autoComplete="off" disabled={!ready} />
      </label>
      <label htmlFor={rightId}>À droite
        <input id={rightId} value={sheet.right} onChange={event => onChange({ ...sheet, right: event.target.value })} placeholder="Qui" maxLength={80} autoComplete="off" disabled={!ready} />
      </label>
    </div>
    <p className="fiche-vault">Le .md se pose dans <a href="#studio"><code>{fiche.vault}</code></a>, à la main.</p>
    <div className="fiche-actions">
      <button type="button" className="button button-outline" data-export={fiche.id} onClick={download} disabled={!ready}>{SCENE_EXPORT}</button>
      <CopyButton text={markdown} label="Copier le .md" />
    </div>
    <details className="fiche-import">
      <summary>Importer</summary>
      <label htmlFor={`fiche-${fiche.id}-paste`}>{SCENE_PASTE}
        <textarea id={`fiche-${fiche.id}-paste`} value={paste} onChange={event => setPaste(event.target.value)} spellCheck={false} disabled={!ready} />
      </label>
      <button type="button" className="button button-outline" onClick={() => apply(paste)} disabled={!ready || !paste.trim()}>{SCENE_IMPORT}</button>
      <label className="fiche-file" htmlFor={`fiche-${fiche.id}-file`}>{SCENE_OPEN}
        <input id={`fiche-${fiche.id}-file`} type="file" accept=".md,text/markdown,text/plain" disabled={!ready} onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          openFile(file);
        }} />
      </label>
    </details>
    {message && <p className="fiche-status" role="status">{message}</p>}
  </article>;
}
