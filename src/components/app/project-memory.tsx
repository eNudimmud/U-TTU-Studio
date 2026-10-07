"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { MEMORY_KINDS, type MemoryKind, type PromptNote } from "@/lib/coffre/memory";
import { useStudio } from "./studio-context";

function Field({
  kind,
  value,
  onSave,
}: {
  kind: MemoryKind;
  value: string;
  onSave(kind: MemoryKind, body: string): Promise<void>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  useEffect(() => {
    if (draft === value) return;
    const timer = window.setTimeout(() => { void onSave(kind, draft); }, 400);
    return () => window.clearTimeout(timer);
  }, [draft, kind, onSave, value]);

  const empty = !draft.trim();
  return <label className="u-field" id={`u-memory-${kind}`}>
    <span className="u-label">{t(`memory.${kind}`)}</span>
    {empty && <p className="u-small u-memory-empty">{t(`memory.empty.${kind}`)}</p>}
    <textarea
      value={draft}
      rows={3}
      maxLength={2000}
      aria-label={t(`memory.${kind}`)}
      onFocus={() => { focused.current = true; }}
      onChange={event => setDraft(event.target.value)}
      onBlur={() => { focused.current = false; if (draft !== value) void onSave(kind, draft); }}
    />
  </label>;
}

function NoteField({ note, onSave }: { note: PromptNote; onSave(file: string, body: string): Promise<void> }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(note.text);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(note.text); }, [note.text]);
  useEffect(() => {
    if (draft === note.text) return;
    const timer = window.setTimeout(() => { void onSave(note.file, draft); }, 400);
    return () => window.clearTimeout(timer);
  }, [draft, note.file, note.text, onSave]);
  const label = note.file.replace(/\.md$/, "");
  return <label className="u-field">
    <span className="u-label">{t("memory.note", { file: label })}</span>
    {!draft.trim() && <p className="u-small u-memory-empty">{t("memory.empty.prompts")}</p>}
    <textarea
      value={draft}
      rows={3}
      maxLength={2000}
      aria-label={t("memory.note", { file: label })}
      onFocus={() => { focused.current = true; }}
      onChange={event => setDraft(event.target.value)}
      onBlur={() => { focused.current = false; if (draft !== note.text) void onSave(note.file, draft); }}
    />
  </label>;
}

/** Bible, style, lexicon and prompts of the open project. Empty stays empty. */
export function ProjectMemory({ focus = null, heading = true }: { focus?: MemoryKind | null; heading?: boolean }) {
  const { t } = useI18n();
  const { studio, setSheet, saveMemory, savePromptNote } = useStudio();
  useEffect(() => {
    if (!focus) return;
    document.getElementById(`u-memory-${focus}`)?.scrollIntoView({ block: "center" });
  }, [focus]);

  if (!studio.project) {
    return <section className="u-memory" aria-label={t("memory.title")}>
      {heading && <h2>{t("memory.title")}</h2>}
      <p className="u-small u-memory-empty">{t("memory.noProject")}</p>
      <button type="button" className="u-link" onClick={() => setSheet("coffre")}>{t("nav.studio")}</button>
    </section>;
  }

  return <section className="u-memory" aria-label={t("memory.title")} key={studio.project}>
    {heading && <h2>{t("memory.title")}</h2>}
    <p className="u-small">{t("memory.lead", { name: studio.projectName || t("common.unnamed") })}</p>
    <div className="u-memory-grid">
      {MEMORY_KINDS.map(kind => <Field key={kind} kind={kind} value={studio.memory[kind]} onSave={saveMemory} />)}
      {studio.memory.notes.map(note => <NoteField key={note.file} note={note} onSave={savePromptNote} />)}
    </div>
  </section>;
}
