"use client";

// The creation bar: one sentence, three modes (Image · Vidéo · Agent), references attached on
// demand as thumbnail chips, and the video settings only when asked for. Nothing runs from the
// bar: Send opens the real tool, already filled, with its estimate on the button. The tools,
// their families and the old entry stay one tap away under « Tous les outils ».

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { DEMO_CAST, DEMO_DECOR } from "@/lib/creation/demo";
import type { ExempleRefSpec } from "@/lib/creation/exemple-galerie";
import { outilParId, outilRow } from "@/lib/outils/catalogue";
import { REPERAGE_ID } from "@/lib/outils/vignettes";
import { quoteCredits } from "@/lib/prise/rendu";
import { resolveTakeQuote } from "@/lib/render/billed-quote";
import { quotesToRecords } from "@/lib/render/measured-quote";
import { takeProfile } from "@/lib/render/take-graph";
import { assetPath } from "@/lib/site";
import {
  AGENT_HANDOFF_EVENT, AGENT_HANDOFF_KEY, BARRE_MODES, DEFAULT_SETTINGS, MAX_REFS_IMAGE, PRISE_HANDOFF_KEY, REFS_HANDOFF_KEY,
  attachFor, barreTarget, priseHandoff, settingsFor, toggleRef, writeHandoff,
  type AttachKind, type BarreMode, type BarrePhoto, type BarreRef, type BarreSettings, type RefKind,
} from "@/lib/barre/model";
import { openBand, placeMenu } from "@/lib/mobile-band";
import { Check, Close, Plus } from "./glyphs";
import { UndoToast } from "./tool-shell";
import { toggleAssistant } from "./assistant-panel";
import { FamilyIcon, openFamily } from "./studio-nav";
import { useStudio } from "./studio-session";
import type { FilSend } from "./barre-fil";
import type { FilRef } from "@/lib/barre/thread";

/** The hash of the old entry: every tool, by family. */
export const ALL_TOOLS_ID = "tous";

function go(hash: string) {
  if (window.location.hash !== hash) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

const ICON = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function ModeIcon({ mode }: { mode: BarreMode }) {
  if (mode === "image") return <FamilyIcon fam="creer" />;
  if (mode === "video") return <FamilyIcon fam="video" />;
  return <svg {...ICON}><path d="M12 3l1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8z" /><path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></svg>;
}
function AttachIcon({ kind }: { kind: AttachKind }) {
  if (kind === "photo") return <svg {...ICON}><rect x="3.5" y="6" width="17" height="13" rx="2" /><path d="M8.5 6l1.5-2h4l1.5 2" /><circle cx="12" cy="12.5" r="3.2" /></svg>;
  if (kind === "reference") return <svg {...ICON}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><path d="M17 14v6M14 17h6" /></svg>;
  if (kind === "lieu") return <FamilyIcon fam="reperage" />;
  return <FamilyIcon fam="son" />;
}
function SettingsIcon() {
  return <svg {...ICON}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>;
}

/** Every reference the sheet can show: the vault's Cast/ and Lieux/, or the house examples when empty. */
export function useReferences(): BarreRef[] {
  const { t } = useI18n();
  const { cast, decor, media } = useStudio();
  return useMemo(() => {
    const people: BarreRef[] = (cast.length > 0 ? cast : DEMO_CAST).map(card => {
      const path = card.sheet ?? card.photos[0] ?? undefined;
      const src = card.preview ? assetPath(card.preview) : path && media[path] ? media[path] : "";
      return { kind: "cast" as const, id: card.id, name: card.id.startsWith("demo-") ? t(`demoNames.${card.id}`) : card.name, src, path };
    });
    const mine = decor.map(card => ({
      kind: "decor" as const, id: card.id, name: card.name,
      src: card.preview ? assetPath(card.preview) : card.sheet && media[card.sheet] ? media[card.sheet] : "",
      path: card.sheet ?? undefined, repere: card.geste === "repere",
    })).filter(place => place.src || place.repere);
    const places: BarreRef[] = mine.length > 0 ? mine : DEMO_DECOR.map(card => ({ kind: "decor" as const, id: card.id, name: t(`demoNames.${card.id}`), src: card.preview ? assetPath(card.preview) : "" }));
    return [...people, ...places];
  }, [cast, decor, media, t]);
}

export function CreationBar({ onSend, preview }: { onSend?(input: FilSend): void; preview?(input: FilSend): { route: string; where: string; quote: number | null } } = {}) {
  const { t } = useI18n();
  const { studio, promoteExempleRefs } = useStudio();
  const all = useReferences();
  const [mode, setMode] = useState<BarreMode>("image");
  const [text, setText] = useState("");
  const [refs, setRefs] = useState<BarreRef[]>([]);
  const [photos, setPhotos] = useState<BarrePhoto[]>([]);
  const [menu, setMenu] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<BarreSettings>(DEFAULT_SETTINGS);
  const [sheet, setSheet] = useState(false);
  const [undoChip, setUndoChip] = useState<{ kind: "photo" | "ref"; item: BarrePhoto | BarreRef; name: string; src: string } | null>(null);
  const inputId = useId();
  const menuId = useId();
  const routeId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Ideas (and links from elsewhere) fill the bar through one event.
  useEffect(() => {
    const fill = (event: Event) => {
      const d = (event as CustomEvent<{ mode: BarreMode; text: string; refs?: string[]; resolved?: BarreRef[] }>).detail;
      if (!d) return;
      setMode(d.mode);
      setText(d.text);
      if (d.resolved) setRefs(d.resolved);
      else if (d.refs) setRefs(d.refs.flatMap(id => all.filter(ref => ref.id === id)));
      requestAnimationFrame(() => document.getElementById(inputId)?.focus());
    };
    window.addEventListener("u-ttu-barre-fill", fill);
    return () => window.removeEventListener("u-ttu-barre-fill", fill);
  }, [all, inputId]);

  useEffect(() => {
    if (!menu && !settingsOpen) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") { setMenu(false); setSettingsOpen(false); return; }
      if (!(event instanceof PointerEvent)) return;
      const node = event.target as Node;
      if (menu && !menuRef.current?.contains(node)) setMenu(false);
      if (settingsOpen && !settingsRef.current?.contains(node)) setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [menu, settingsOpen]);

  // Keep the + menu inside the visible band between the sticky header and the tab bar.
  useLayoutEffect(() => {
    if (!menu) return;
    const wrap = menuRef.current;
    const panel = wrap?.querySelector<HTMLElement>("[data-barre-menu]");
    const btn = wrap?.querySelector<HTMLElement>("[data-barre-plus]");
    if (!panel || !btn) return;
    const place = () => {
      const bars = [...document.querySelectorAll<HTMLElement>(".u-top, .u-tabs, .u-chain")]
        .filter(bar => ["fixed", "sticky"].includes(getComputedStyle(bar).position))
        .map(bar => {
          const box = bar.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom };
        });
      const viewport = window.visualViewport;
      const visibleTop = viewport ? viewport.offsetTop : 0;
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const band = openBand(bars, visibleTop, visibleBottom, 48);
      panel.style.maxHeight = "none";
      panel.style.width = "";
      const size = { width: panel.offsetWidth, height: panel.offsetHeight };
      const anchor = btn.getBoundingClientRect();
      const box = placeMenu({
        anchor: { top: anchor.top, bottom: anchor.bottom, left: anchor.left, width: anchor.width },
        size,
        band,
        viewportWidth: window.innerWidth,
      });
      panel.style.top = `${box.top}px`;
      panel.style.left = `${box.left}px`;
      panel.style.width = `${box.width}px`;
      panel.style.maxHeight = `${box.maxHeight}px`;
      panel.dataset.place = box.place;
    };
    place();
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [menu, mode]);

  useLayoutEffect(() => {
    if (!settingsOpen) return;
    const wrap = settingsRef.current;
    const panel = wrap?.querySelector<HTMLElement>("[data-barre-settings-row]");
    const btn = wrap?.querySelector<HTMLElement>("[data-barre-settings]");
    if (!panel || !btn) return;
    const place = () => {
      const bars = [...document.querySelectorAll<HTMLElement>(".u-top, .u-tabs, .u-chain")]
        .filter(bar => ["fixed", "sticky"].includes(getComputedStyle(bar).position))
        .map(bar => {
          const box = bar.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom };
        });
      const viewport = window.visualViewport;
      const visibleTop = viewport ? viewport.offsetTop : 0;
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const band = openBand(bars, visibleTop, visibleBottom, 48);
      panel.style.maxHeight = "none";
      panel.style.width = "";
      const size = { width: Math.max(panel.offsetWidth, 260), height: panel.offsetHeight };
      const anchorBox = btn.getBoundingClientRect();
      const box = placeMenu({
        anchor: { top: anchorBox.top, bottom: anchorBox.bottom, left: anchorBox.left, width: anchorBox.width },
        size,
        band,
        viewportWidth: window.innerWidth,
      });
      panel.style.top = `${box.top}px`;
      panel.style.left = `${box.left}px`;
      panel.style.width = `${box.width}px`;
      panel.style.maxHeight = `${box.maxHeight}px`;
      panel.dataset.place = box.place;
    };
    place();
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [settingsOpen, settings.rendu, settings.duree, settings.format]);


  const attached: FilRef[] = mode === "agent" ? [] : [
    ...(mode === "image" ? photos.map(photo => ({ kind: "photo" as const, id: photo.id, name: photo.name, src: photo.url })) : []),
    ...refs.map(ref => ({ kind: ref.kind, id: ref.id, name: ref.name, src: ref.src, path: ref.path, vault: Boolean(ref.path) && !ref.id.startsWith("demo-") })),
  ];
  const here = preview?.({ mode, text, refs: attached, settings }) ?? null;
  const target = barreTarget(mode, text, mode === "image" ? refs : [], mode === "image" ? photos : []);
  const quote = useMemo(() => {
    if (target.kind === "outil") {
      const outil = outilParId(target.id);
      return outil ? outilRow(outil)?.credits ?? null : null;
    }
    if (target.kind === "prise") {
      const profile = takeProfile({ seconds: settings.duree, aspect: settings.format === "9:16" ? "vertical" : "horizontal", quality: "rapide", engine: "ltx", rendu: settings.rendu });
      return quoteCredits(resolveTakeQuote(profile, quotesToRecords(studio.quotes)));
    }
    return null;
  }, [target.kind, target.kind === "outil" ? target.id : "", settings, studio.quotes]);
  const where = target.kind === "outil" ? t(`outils.t.${target.id}.title`)
    : target.kind === "prise" ? t("nav.take")
    : target.kind === "agent" ? t("barre.where.agent")
    : t("entry.film");
  const chips = mode === "agent" ? [] : mode === "video" ? refs : [...refs, ...photos.map(photo => ({ kind: "photo" as const, id: photo.id, name: photo.name, src: photo.url }))];
  const imageFull = mode === "image" && refs.length + photos.length >= MAX_REFS_IMAGE;
  const attach = attachFor(mode);
  const shown = settingsFor(mode);

  function switchMode(next: BarreMode) {
    setMode(next);
    setMenu(false);
    if (next !== "video") setSettingsOpen(false);
  }

  function pick(kind: AttachKind) {
    setMenu(false);
    if (kind === "photo") fileRef.current?.click();
    else if (kind === "reference") setSheet(true);
    else if (kind === "lieu") go(`#outils/${REPERAGE_ID}`);
    else openFamily("son");
  }

  const shownQuote = here ? here.quote : quote;
  const cost = shownQuote !== null ? t("barre.cost", { credits: formatCredits(shownQuote) }) : null;

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MAX_REFS_IMAGE - refs.length - photos.length;
    const next = [...files].filter(file => file.type.startsWith("image/")).slice(0, Math.max(0, room)).map((file, index) => ({ id: `photo-${Date.now()}-${index}`, name: file.name, url: URL.createObjectURL(file) }));
    setPhotos(list => [...list, ...next]);
  }

  function remove(kind: RefKind | "photo", id: string) {
    if (kind === "photo") {
      const item = photos.find(photo => photo.id === id);
      if (item) setUndoChip({ kind: "photo", item, name: item.name, src: item.url });
      setPhotos(list => list.filter(photo => photo.id !== id));
      return;
    }
    const item = refs.find(ref => ref.kind === kind && ref.id === id);
    if (item) setUndoChip({ kind: "ref", item, name: item.name, src: item.src });
    setRefs(list => list.filter(ref => !(ref.kind === kind && ref.id === id)));
  }

  function send() {
    setMenu(false);
    setSettingsOpen(false);
    const value = text.trim();
    if (!value) { document.getElementById(inputId)?.focus(); return; }
    if (onSend) {
      // In the thread: the bubble, then the confirm and the run, without leaving the home.
      onSend({ mode, text: value, refs: attached, settings });
      setText(""); setRefs([]); setPhotos([]); setMenu(false); setSettingsOpen(false);
      return;
    }
    if (target.kind === "agent") {
      writeHandoff(window.sessionStorage, AGENT_HANDOFF_KEY, value);
      toggleAssistant(true);
      requestAnimationFrame(() => window.dispatchEvent(new Event(AGENT_HANDOFF_EVENT)));
      return;
    }
    if (target.kind === "prise") {
      writeHandoff(window.sessionStorage, PRISE_HANDOFF_KEY, priseHandoff(value, refs, settings));
      go("#prise");
      return;
    }
    if (target.kind === "film") { go("#personnage"); return; }
    try { sessionStorage.setItem("u-ttu-consigne", value); } catch { /* the tool still opens */ }
    if (target.images.length) writeHandoff(window.sessionStorage, REFS_HANDOFF_KEY, { tool: target.id, images: target.images });
    go(`#outils/${target.id}`);
  }

  return <>
    <form className="u-barre" data-barre="" data-mode={mode} onSubmit={event => { event.preventDefault(); send(); }}>
      {chips.length > 0 && <ul className="u-barre-chips" role="list" aria-label={t("barre.attached")} data-barre-chips="">
        {chips.map(chip => <li key={`${chip.kind}-${chip.id}`} className="u-barre-chip" data-barre-chip={chip.kind}>
          {chip.src ? <img src={chip.src} alt="" width={64} height={64} /> : <span className="u-barre-chip-glyph"><FamilyIcon fam="reperage" /></span>}
          <span className="u-barre-chip-name">{chip.name}</span>
          <button type="button" className="u-barre-chip-x" aria-label={t("barre.remove", { name: chip.name })} onClick={() => remove(chip.kind, chip.id)}><Close /></button>
        </li>)}
        {!imageFull && <li><button type="button" className="u-barre-chip-add" aria-label={t("barre.attach.reference")} onClick={() => setSheet(true)}><Plus /></button></li>}
      </ul>}
      <label className="u-barre-field" htmlFor={inputId}>
        <span className="sr-only">{t(`barre.ph.${mode}`)}</span>
        <textarea id={inputId} rows={2} value={text} maxLength={800} placeholder={t(`barre.ph.${mode}`)} data-barre-input="" aria-describedby={routeId}
          onChange={event => setText(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
      </label>
      <div className="u-barre-foot">
        {attach.length > 0 && <div className="u-barre-plus-wrap" ref={menuRef}>
          <button type="button" className="u-barre-round" aria-label={t("barre.plus")} aria-haspopup="menu" aria-expanded={menu} aria-controls={menuId} data-barre-plus="" onClick={() => setMenu(value => !value)}><Plus /></button>
          {menu && <div id={menuId} className="u-barre-menu" role="menu" data-barre-menu="">
            {attach.map(kind => <button key={kind} type="button" role="menuitem" data-barre-attach={kind} disabled={kind === "photo" && imageFull} onClick={() => pick(kind)}>
              <AttachIcon kind={kind} />
              <span><strong>{t(`barre.attach.${kind}`)}</strong><small>{t(`barre.attach.${kind}Line`)}</small></span>
            </button>)}
          </div>}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden data-barre-photo="" onChange={event => { addPhotos(event.target.files); event.target.value = ""; }} />
        </div>}
        <div className="u-barre-modes" role="radiogroup" aria-label={t("barre.modes")}>
          {BARRE_MODES.map(item => <button key={item} type="button" role="radio" aria-checked={mode === item} aria-label={t(`barre.mode.${item}`)} title={t(`barre.mode.${item}`)} data-barre-mode={item} onClick={() => switchMode(item)}>
            <ModeIcon mode={item} /><span className="u-barre-mode-name">{t(`barre.mode.${item}`)}</span>
          </button>)}
        </div>
        {shown.length > 0 && <div className="u-barre-settings-wrap" ref={settingsRef}>
          <button type="button" className="u-barre-settings-pill" aria-label={t("barre.settings")} aria-expanded={settingsOpen} aria-controls={settingsOpen ? "u-barre-settings-panel" : undefined} data-barre-settings="" onClick={() => setSettingsOpen(value => !value)}>
            <SettingsIcon />
            <span data-barre-settings-summary="">{t(`barre.rendu.${settings.rendu}`)} · {t("barre.seconds", { n: String(settings.duree) })} · {settings.format}</span>
          </button>
          {settingsOpen && <div id="u-barre-settings-panel" className="u-barre-settings" role="group" data-barre-settings-row="">
            <div className="u-barre-seg" role="group" aria-label={t("barre.rendu.label")}>
              {(["apercu", "finale"] as const).map(item => <button key={item} type="button" aria-pressed={settings.rendu === item} data-barre-rendu={item} onClick={() => { setSettings(s => ({ ...s, rendu: item })); }}>{t(`barre.rendu.${item}`)}</button>)}
            </div>
            <div className="u-barre-seg" role="group" aria-label={t("barre.duree")}>
              {([5, 8] as const).map(item => <button key={item} type="button" aria-pressed={settings.duree === item} data-barre-duree={item} onClick={() => { setSettings(s => ({ ...s, duree: item })); }}>{t("barre.seconds", { n: String(item) })}</button>)}
            </div>
            <div className="u-barre-seg" role="group" aria-label={t("barre.format")}>
              {(["16:9", "9:16"] as const).map(item => <button key={item} type="button" aria-pressed={settings.format === item} data-barre-format={item} onClick={() => { setSettings(s => ({ ...s, format: item })); setSettingsOpen(false); }}>{item}</button>)}
            </div>
          </div>}
        </div>}
        <button type="submit" className="u-barre-send" data-barre-send="" data-ready={text.trim() ? "" : undefined} aria-label={cost ? `${t("barre.send")} · ${cost}` : t("barre.send")} aria-describedby={routeId}>
          <svg {...ICON} className="u-barre-send-arrow"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
          {cost && <span className="u-barre-send-cost" data-barre-cost="">{cost}</span>}
        </button>
      </div>
    </form>
    <p className="u-barre-route" id={routeId} data-barre-route={here ? here.route : target.kind === "outil" ? target.id : target.kind}>{cost && <span className="u-barre-route-cost" aria-hidden="true">{cost} · </span>}{here ? t(here.route === "agent" ? "barre.routeAgent" : here.route === "note" ? "barre.routeNote" : "barre.routeHere", { where: here.where }) : t("barre.route", { where })}</p>
    {undoChip && <UndoToast message={t("shell.removeSlot", { name: undoChip.name })} thumb={undoChip.src || undefined} onUndo={() => {
      if (undoChip.kind === "photo") setPhotos(list => [...list, undoChip.item as BarrePhoto]);
      else setRefs(list => [...list, undoChip.item as BarreRef]);
      setUndoChip(null);
    }} onGone={() => setUndoChip(null)} />}
    {sheet && <ReferencesSheet all={all} picked={refs} max={mode === "image" ? MAX_REFS_IMAGE - photos.length : null} onClose={() => setSheet(false)} onJoin={async next => {
      const demos = next.filter(ref => ref.id.startsWith("demo-") || (!ref.path && ref.src.includes("/exemples/")));
      if (demos.length === 0) { setRefs(next); setSheet(false); return; }
      const specs: ExempleRefSpec[] = demos.map(ref => ({
        kind: ref.kind === "decor" ? "decor" : "cast",
        demoId: ref.id.startsWith("demo-") ? ref.id : `demo-${ref.id}`,
        name: ref.name,
        preview: ref.src.replace(/^https?:\/\/[^/]+/, "") || ref.src,
        thumb: ref.src,
      }));
      // Prefer known demo previews (absolute /exemples paths).
      for (const spec of specs) {
        const known = [...DEMO_CAST, ...DEMO_DECOR].find(card => card.id === spec.demoId);
        if (known?.preview) { spec.preview = known.preview; spec.thumb = known.preview; }
      }
      try {
        const promoted = await promoteExempleRefs(specs);
        const byDemo = new Map(demos.map((d, i) => [d.id, promoted[i]!]));
        const merged = next.map(ref => {
          const p = byDemo.get(ref.id);
          return p ? { kind: p.kind, id: p.id, name: p.name, src: p.src, path: p.path } : ref;
        });
        setRefs(merged);
      } catch {
        setRefs(next);
      }
      setSheet(false);
    }} />}
  </>;
}

type Filter = "tout" | RefKind;

export function ReferencesSheet({ all, picked, max, onClose, onJoin }: { all: BarreRef[]; picked: BarreRef[]; max: number | null; onClose(): void; onJoin(next: BarreRef[]): void }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("tout");
  const [chosen, setChosen] = useState<BarreRef[]>(picked);
  const [adding, setAdding] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const list = all.filter(ref => filter === "tout" || ref.kind === filter);
  const isOn = (ref: BarreRef) => chosen.some(item => item.kind === ref.kind && item.id === ref.id);
  function flip(ref: BarreRef) {
    setChosen(current => {
      if (!isOn(ref) && max !== null && current.length >= max) return current;
      return max === null ? toggleRef(current, ref) : current.some(item => item.kind === ref.kind && item.id === ref.id) ? current.filter(item => !(item.kind === ref.kind && item.id === ref.id)) : [...current, ref];
    });
  }
  return <div className="u-overlay">
    <dialog ref={dialog} className="u-sheet u-native-sheet is-tall u-refs-sheet" aria-labelledby={titleId} data-refs-sheet="" onCancel={event => { event.preventDefault(); onClose(); }}>
      <header className="u-refs-head">
        <button type="button" className="u-icon" onClick={onClose} aria-label={t("verb.close")}><Close /></button>
        <h2 id={titleId}>{t("barre.refs.title")}</h2>
        <button type="button" className="u-icon" aria-label={t("barre.refs.new")} aria-expanded={adding} data-refs-new="" onClick={() => setAdding(value => !value)}><Plus /></button>
      </header>
      {adding && <div className="u-refs-new" data-refs-new-menu="">
        <button type="button" className="u-secondary" onClick={() => go("#personnage")}>{t("barre.refs.newCast")}</button>
        <button type="button" className="u-secondary" onClick={() => go("#scene")}>{t("barre.refs.newDecor")}</button>
        <button type="button" className="u-secondary" onClick={() => go(`#outils/${REPERAGE_ID}`)}>{t("barre.attach.lieu")}</button>
      </div>}
      <div className="u-refs-filters" role="group" aria-label={t("barre.refs.filter")}>
        {(["tout", "cast", "decor"] as const).map(item => <button key={item} type="button" aria-pressed={filter === item} data-refs-filter={item} onClick={() => setFilter(item)}>{t(`barre.refs.${item}`)}</button>)}
      </div>
      <ul className="u-refs-grid" role="list">
        {list.map(ref => <li key={`${ref.kind}-${ref.id}`}>
          <button type="button" className="u-refs-card" aria-pressed={isOn(ref)} data-ref={ref.id} data-ref-kind={ref.kind} onClick={() => flip(ref)}>
            <span className="u-refs-thumb">
              {ref.src ? <img src={ref.src} alt="" width={320} height={320} loading="lazy" decoding="async" /> : <span className="u-barre-chip-glyph"><FamilyIcon fam="reperage" /></span>}
              {isOn(ref) && <span className="u-refs-check" aria-hidden="true"><Check /></span>}
            </span>
            <strong>{ref.name}</strong>
            <small>{t(`barre.refs.${ref.kind}`)}{ref.repere ? ` · ${t("barre.refs.lieuReel")}` : ref.id.startsWith("demo-") ? ` · ${t("barre.refs.example")}` : ""}</small>
          </button>
        </li>)}
      </ul>
      <footer className="u-refs-foot">
        <button type="button" className="u-primary" data-refs-join="" onClick={() => onJoin(chosen)}>
          {chosen.length === 0 ? t("barre.refs.joinNone") : chosen.length === 1 ? t("barre.refs.joinOne") : t("barre.refs.join", { n: String(chosen.length) })}
        </button>
      </footer>
    </dialog>
  </div>;
}

/** Fills the bar from an idea / gallery card. Pass `resolved` after promoting demos (P0-2). */
export function fillBarre(mode: BarreMode, text: string, refs?: string[], resolved?: BarreRef[]) {
  window.dispatchEvent(new CustomEvent("u-ttu-barre-fill", { detail: { mode, text, refs, resolved } }));
}
