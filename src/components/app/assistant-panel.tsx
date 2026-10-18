"use client";

// « Assistant du studio »: a panel docked on the right of every studio page. Its open state lives in
// localStorage, so it stays open across navigation. It reads the project (what is missing next) and
// matches what the visitor types against the tool list to open the right tool. Local only: no model call, no spend.

import { useEffect, useState } from "react";
import { assetPath } from "@/lib/site";
import { OUTILS, cherche, outilEtat } from "@/lib/outils/catalogue";
import { useI18n } from "@/components/i18n/provider";
import { useStudio } from "./studio-session";

const KEY = "u-ttu-assistant";
const EVENT = "u-ttu-assistant";

export function toggleAssistant(force?: boolean) {
  const next = force ?? window.localStorage.getItem(KEY) !== "1";
  try { window.localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* memory only */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

export function useAssistantOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(window.localStorage.getItem(KEY) === "1");
    const sync = (event: Event) => setOpen(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return open;
}

/** Everyday words that point at a tool (FR/EN/DE/ES); the localised names and lines are searched too. */
const HINTS: { words: string[]; tool: string }[] = [
  { words: ["parler", "parle", "talk", "speak", "sprechen", "hablar", "lipsync"], tool: "vid-parler" },
  { words: ["animer", "anime", "bouger", "animate", "animieren", "animar"], tool: "vid-animer" },
  { words: ["detour", "fond", "background", "hintergrund", "fondo"], tool: "ret-detourer" },
  { words: ["musique", "music", "musik", "musica"], tool: "son-musique-ouverte" },
  { words: ["voix", "voice", "stimme", "voz"], tool: "son-voix-ouverte" },
  { words: ["3d", "volume", "objet", "modele"], tool: "3d-ouvert" },
  { words: ["net", "nettete", "upscale", "ameliorer", "sharpen", "scharf", "nitidez"], tool: "ret-finaliser" },
  { words: ["agrandir", "elargir", "extend", "erweitern", "ampliar"], tool: "ret-elargir" },
  { words: ["prolonger", "suite", "continue", "verlangern", "continuar"], tool: "vid-prolonger" },
];

export function AssistantPanel() {
  const { t } = useI18n();
  const open = useAssistantOpen();
  const { cast, decor, studio, prefs } = useStudio();
  const [query, setQuery] = useState("");
  useEffect(() => {
    document.documentElement.toggleAttribute("data-assistant", open);
    return () => document.documentElement.removeAttribute("data-assistant");
  }, [open]);
  if (!open) return null;

  const needle = query.trim();
  const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const hinted = needle ? HINTS.filter(hint => hint.words.some(word => fold(needle).includes(word))).map(hint => hint.tool) : [];
  const ready = OUTILS.filter(item => outilEtat(item, prefs).kind === "pret");
  const found = needle ? [
    ...ready.filter(item => hinted.includes(item.id)),
    ...ready.filter(item => !hinted.includes(item.id) && cherche(`${t(`outils.t.${item.id}.title`)} ${t(`outils.t.${item.id}.line`)}`, needle)),
  ].slice(0, 5) : [];

  const next = cast.length === 0 ? { key: "assistant.next.cast", href: "/studio#personnage" }
    : decor.length === 0 ? { key: "assistant.next.decor", href: "/studio#scene" }
    : studio.takes.length === 0 ? { key: "assistant.next.prise", href: "/studio#prise" }
    : { key: "assistant.next.montage", href: "/studio#montage" };

  return <aside className="u-assistant" data-assistant-panel="" aria-labelledby="u-assistant-title">
    <header className="u-assistant-head">
      <h2 id="u-assistant-title">{t("assistant.title")}</h2>
      <button type="button" className="u-top-icon" aria-label={t("assistant.close")} onClick={() => toggleAssistant(false)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
    </header>
    <section className="u-assistant-next">
      <p className="u-label">{t("assistant.nextTitle")}</p>
      <p>{t(next.key)}</p>
      <a className="u-secondary" href={assetPath(next.href)} data-assistant-next="">{t("assistant.go")}</a>
    </section>
    <label className="u-field">
      <span className="u-label">{t("assistant.ask")}</span>
      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("assistant.placeholder")} data-assistant-input="" />
    </label>
    {needle && (found.length === 0 ? <p className="u-small">{t("assistant.none")}</p> : <ul role="list" className="u-assistant-list">
      {found.map(item => <li key={item.id}><a href={assetPath(`/studio#outils/${item.id}`)} data-assistant-outil={item.id}><strong>{t(`outils.t.${item.id}.title`)}</strong><span>{t(`outils.t.${item.id}.line`)}</span></a></li>)}
    </ul>)}
    <p className="u-small">{t("assistant.local")}</p>
  </aside>;
}
