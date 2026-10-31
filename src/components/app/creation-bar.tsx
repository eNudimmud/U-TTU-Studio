"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/components/i18n/provider';
import { formatCredits } from '@/lib/credits';
import { DEMO_CAST, DEMO_DECOR } from '@/lib/creation/demo';
import { BUBBLE_DEFAULTS, bubblePictureCount, bubbleQuote, chipReference, bubbleResolutionLabel, bubbleSize, bubbleTool, validBubbleSettings, type BubbleSettings } from '@/lib/creation/bubble';
import { CREATION_REFERENCES_MAX, type NamedReference } from '@/lib/creation/named-references';
import { assetPath } from '@/lib/site';
import { AGENT_HANDOFF_EVENT, AGENT_HANDOFF_KEY, DEFAULT_SETTINGS, writeHandoff, type BarreMode, type BarreRef } from '@/lib/barre/model';
import type { FilRef } from '@/lib/barre/thread';
import { openBand, placeMenu } from '@/lib/mobile-band';
import { Close, Plus } from './glyphs';
import { toggleAssistant } from './assistant-panel';
import { FamilyIcon } from './studio-nav';
import { ReferenceLibrary } from './reference-library';
import { useStudio } from './studio-session';
import type { FilSend } from './barre-fil';

export const ALL_TOOLS_ID = 'tous';
type Attachment = { id: string; name: string; src: string; path?: string };
const ICON = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true };
export function useReferences(): BarreRef[] {
  const { t } = useI18n(); const { references, media } = useStudio();
  return useMemo(() => [
    ...references.map(r => ({ kind: r.category, id: r.id, name: r.name, description: r.description, images: r.images, src: media[r.preview] ?? '', path: r.preview })),
    ...DEMO_CAST.map(c => ({ kind: 'cast' as const, id: c.id, name: t(`demoNames.${c.id}`), src: c.preview ? assetPath(c.preview) : '' })),
    ...DEMO_DECOR.map(c => ({ kind: 'decor' as const, id: c.id, name: t(`demoNames.${c.id}`), src: c.preview ? assetPath(c.preview) : '' })),
  ], [references, media, t]);
}

/** One native creation bubble. Local drafts and reference photos belong to the active project. */
export function CreationBar({ onSend, preview }: { onSend?(input: FilSend): void; preview?(input: FilSend): { route: string; where: string; quote: number | null } } = {}) {
  const { t } = useI18n(); const { ready, studio, media, storeCreationInput } = useStudio(); const all = useReferences();
  const [mode, setMode] = useState<'image' | 'video'>('image'), [text, setText] = useState('');
  const [refs, setRefs] = useState<BarreRef[]>([]), [photos, setPhotos] = useState<Attachment[]>([]), [audio, setAudio] = useState<Attachment | null>(null);
  const [settings, setSettings] = useState<BubbleSettings>(BUBBLE_DEFAULTS);
  const [menu, setMenu] = useState(false), [settingsOpen, setSettingsOpen] = useState(false), [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [loadedFor, setLoadedFor] = useState<string | null>(null);
  const inputId = useId(), menuId = useId(), routeId = useId(), attachmentsId = useId();
  const fileRef = useRef<HTMLInputElement>(null), audioRef = useRef<HTMLInputElement>(null), menuRef = useRef<HTMLDivElement>(null), settingsRef = useRef<HTMLDivElement>(null);
  const scope = `u-ttu-creation-draft:${studio.project ?? 'nouveau'}`;
  // F14 · The bar is in the server HTML before the studio opens: nothing typed is lost to the draft load.
  const drafted = loadedFor === scope;
  useEffect(() => {
    if (!ready) return;
    let d: Record<string, unknown> = {}; try {
      if (loadedFor === 'u-ttu-creation-draft:nouveau' && scope !== loadedFor && !localStorage.getItem(scope)) {
        const previous = localStorage.getItem(loadedFor); if (previous) localStorage.setItem(scope, previous);
      }
      d = JSON.parse(localStorage.getItem(scope) ?? '{}');
    } catch { /* empty */ }
    setText(typeof d.text === 'string' ? d.text.slice(0, 800) : ''); setMode(d.mode === 'video' ? 'video' : 'image');
    setSettings(validBubbleSettings(d.settings) ? d.settings : BUBBLE_DEFAULTS);
    setRefs(Array.isArray(d.refs) ? d.refs.filter((r): r is BarreRef => Boolean(r && typeof r === 'object' && typeof r.id === 'string' && typeof r.kind === 'string')).slice(0, CREATION_REFERENCES_MAX) : []);
    setPhotos(Array.isArray(d.photos) ? d.photos.filter((p): p is Attachment => Boolean(p && typeof p === 'object' && typeof p.path === 'string' && typeof p.name === 'string')) : []);
    setAudio(d.audio && typeof d.audio === 'object' && 'path' in d.audio ? d.audio as Attachment : null); setLoadedFor(scope);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, scope]);
  const selected = refs.flatMap(r => { const fresh = all.find(x => x.kind === r.kind && x.id === r.id); return fresh ? [fresh] : []; });
  const attached: FilRef[] = [...selected.map(r => ({ kind: r.kind, id: r.id, name: r.name, description: r.description, src: r.src, path: r.path, vault: Boolean(r.path), ...('images' in r && r.images?.length ? { images: [...r.images] } : {}) })), ...photos.map(p => ({ kind: 'photo' as const, id: p.id, name: p.name, src: media[p.path ?? ''] ?? p.src, path: p.path, vault: Boolean(p.path) }))];
  const currentAudio = mode === 'video' && audio ? { name: audio.name, src: media[audio.path ?? ''] ?? audio.src, path: audio.path } : undefined;
  const input: FilSend = { mode, text, refs: attached, settings: DEFAULT_SETTINGS, creation: { settings }, audio: currentAudio };
  const here = preview?.(input), quote = bubbleQuote(mode, bubblePictureCount(mode, attached.map(r => chipReference(r, p => Boolean(media[p])))), settings, Boolean(currentAudio));
  const credits = here ? here.quote : quote?.credits ?? null;
  const cost = credits !== null ? t('barre.cost', { credits: formatCredits(credits) }) : null;
  const full = attached.length >= CREATION_REFERENCES_MAX;
  const size = bubbleSize(settings, mode);
  useEffect(() => {
    if (!ready || loadedFor !== scope) return;
    try { localStorage.setItem(scope, JSON.stringify({ mode, text, settings, refs: refs.map(r => ({ ...r, src: '' })), photos: photos.map(p => ({ ...p, src: '' })), audio: audio ? { ...audio, src: '' } : null })); }
    catch { setError(t('bubble.draftFailed')); }
  }, [ready, loadedFor, scope, mode, text, settings, refs, photos, audio, t]);
  useEffect(() => {
    const fill = (e: Event) => {
      const d = (e as CustomEvent<{ mode: BarreMode; text: string; refs?: string[]; resolved?: BarreRef[] }>).detail; if (!d) return;
      if (d.mode === 'agent') { writeHandoff(sessionStorage, AGENT_HANDOFF_KEY, d.text); toggleAssistant(true); requestAnimationFrame(() => window.dispatchEvent(new Event(AGENT_HANDOFF_EVENT))); return; }
      setMode(d.mode); setText(d.text); setPhotos([]); setRefs((d.resolved ?? all.filter(r => d.refs?.includes(r.id))).slice(0, CREATION_REFERENCES_MAX));
      requestAnimationFrame(() => document.getElementById(inputId)?.focus());
    }; window.addEventListener('u-ttu-barre-fill', fill); return () => window.removeEventListener('u-ttu-barre-fill', fill);
  }, [all, inputId]);
  useEffect(() => {
    if (!menu && !settingsOpen) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key === 'Escape') { setMenu(false); setSettingsOpen(false); }
      if (e instanceof PointerEvent) { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); if (!settingsRef.current?.contains(e.target as Node)) setSettingsOpen(false); }
    }; document.addEventListener('pointerdown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [menu, settingsOpen]);
  useLayoutEffect(() => {
    const wrap = menu ? menuRef.current : settingsOpen ? settingsRef.current : null;
    const panel = wrap?.querySelector<HTMLElement>(menu ? '[data-barre-menu]' : '[data-barre-settings-row]'), btn = wrap?.querySelector<HTMLElement>('button'); if (!panel || !btn) return;
    const place = () => {
      const bars = [...document.querySelectorAll<HTMLElement>('.u-top, .u-tabs, .u-chain')].filter(b => ['fixed','sticky'].includes(getComputedStyle(b).position)).map(b => b.getBoundingClientRect());
      const v = window.visualViewport, band = openBand(bars, v?.offsetTop ?? 0, v ? v.offsetTop + v.height : innerHeight, 44);
      panel.style.maxHeight = 'none'; panel.style.width = ''; const a = btn.getBoundingClientRect();
      const box = placeMenu({ anchor: { top: a.top, bottom: a.bottom, left: a.left, width: a.width }, size: { width: Math.max(panel.offsetWidth, 280), height: panel.offsetHeight }, band, viewportWidth: innerWidth });
      Object.assign(panel.style, { top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px`, maxHeight: `${box.maxHeight}px` }); panel.dataset.place = box.place;
    }; place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true); window.visualViewport?.addEventListener('resize', place);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.visualViewport?.removeEventListener('resize', place); };
  }, [menu, settingsOpen, mode]);
  async function addFiles(files: FileList | null, kind: 'photo' | 'audio') {
    if (!files?.length || busy) return; setBusy(true); setError('');
    try {
      const picked = [...files].filter(f => f.type.startsWith(kind === 'photo' ? 'image/' : 'audio/')).slice(0, kind === 'audio' ? 1 : CREATION_REFERENCES_MAX - attached.length), saved: Attachment[] = [];
      for (const file of picked) { const p = await storeCreationInput(file); saved.push({ id: crypto.randomUUID(), name: file.name, src: p.url, path: p.path }); }
      if (kind === 'audio') setAudio(saved[0] ?? null); else setPhotos(p => [...p, ...saved]);
    } catch { setError(t('namedRefs.failed')); } finally { setBusy(false); }
  }
  function send() {
    if (busy || !text.trim()) { document.getElementById(inputId)?.focus(); return; }
    setMenu(false); setSettingsOpen(false); onSend?.({ ...input, text: text.trim() });
    if (onSend) { setText(''); setRefs([]); setPhotos([]); setAudio(null); }
  }
  function pickReference(r: NamedReference) {
    const ref = all.find(a => a.id === r.id && a.kind === r.category) ?? { id: r.id, kind: r.category, name: r.name, src: media[r.preview] ?? '', path: r.preview, description: r.description };
    if (!full && !selected.some(a => a.id === ref.id && a.kind === ref.kind)) setRefs(a => [...a, ref]); setSheet(false);
  }
  return <>
    <form className="u-barre u-creation-bubble" data-barre="" data-mode={mode} onSubmit={e => { e.preventDefault(); send(); }}>
      {attached.length > 0 && <ul className="u-barre-chips" data-barre-chips="" aria-label={t('barre.attached')}>{attached.map(r => <li key={`${r.kind}-${r.id}`} className="u-barre-chip" data-barre-chip={r.kind}>{r.src && <img src={r.src} alt="" width={64} height={64} />}<span className="u-barre-chip-name">{r.name}</span><button type="button" className="u-barre-chip-x" aria-label={t('barre.remove', { name: r.name })} onClick={() => r.kind === 'photo' ? setPhotos(p => p.filter(a => a.id !== r.id)) : setRefs(a => a.filter(x => x.id !== r.id || x.kind !== r.kind))}><Close /></button></li>)}{!full && <li><button type="button" className="u-barre-chip-add" aria-label={t('barre.attach.reference')} onClick={() => setSheet(true)}><Plus /></button></li>}</ul>}
      {currentAudio && <div className="u-bubble-audio" data-bubble-audio=""><FamilyIcon fam="son" /><span>{currentAudio.name}</span><button type="button" className="u-icon" aria-label={t('bubble.removeAudio')} onClick={() => setAudio(null)}><Close /></button></div>}
      <label className="u-barre-field" htmlFor={inputId}><span className="sr-only">{t(`barre.ph.${mode}`)}</span><textarea id={inputId} rows={2} value={text} readOnly={!drafted} maxLength={800} placeholder={t(`barre.ph.${mode}`)} data-barre-input="" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} /></label>
      <div className="u-barre-foot">
        <div className="u-barre-plus-wrap" ref={menuRef}>
          <button type="button" className="u-barre-round" aria-label={t('barre.plus')} aria-haspopup="menu" aria-expanded={menu} aria-controls={menuId} data-barre-plus="" onClick={() => { setMenu(v => !v); setSettingsOpen(false); }}><Plus /></button>
          {menu && <div id={menuId} className="u-barre-menu" role="menu" data-barre-menu="">
            <button type="button" role="menuitem" data-barre-attach="photo" disabled={full || busy} aria-describedby={attachmentsId} onClick={() => { setMenu(false); fileRef.current?.click(); }}><FamilyIcon fam="creer" /><span><strong>{t('barre.attach.photo')}</strong><small>{t('barre.attach.photoLine')}</small></span></button>
            <button type="button" role="menuitem" data-barre-attach="son" disabled={busy} aria-describedby={attachmentsId} onClick={() => { setMenu(false); setMode('video'); audioRef.current?.click(); }}><FamilyIcon fam="son" /><span><strong>{t('bubble.audio')}</strong><small>{t('bubble.audioHelp')}</small></span></button>
            <button type="button" role="menuitem" data-barre-attach="reference" onClick={() => { setMenu(false); setSheet(true); }}><Plus /><span><strong>{t('barre.attach.reference')}</strong><small>{t('namedRefs.menuHelp')}</small></span></button>
          </div>}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden data-barre-photo="" onChange={e => { void addFiles(e.target.files, 'photo'); e.target.value = ''; }} />
          <input ref={audioRef} type="file" accept="audio/*" hidden data-barre-audio="" onChange={e => { void addFiles(e.target.files, 'audio'); e.target.value = ''; }} />
        </div>
        <div className="u-barre-modes" role="radiogroup" aria-label={t('barre.modes')}>{(['image','video'] as const).map(m => <button key={m} type="button" role="radio" aria-checked={mode === m} aria-label={t(`barre.mode.${m}`)} data-barre-mode={m} onClick={() => setMode(m)}><FamilyIcon fam={m === 'image' ? 'creer' : 'video'} /><span>{t(`barre.mode.${m}`)}</span></button>)}</div>
        <div className="u-barre-settings-wrap" ref={settingsRef}>
          <button type="button" className="u-barre-settings-pill" aria-label={t('barre.settings')} aria-expanded={settingsOpen} data-barre-settings="" onClick={() => { setSettingsOpen(v => !v); setMenu(false); }}><svg {...ICON}><path d="M4 7h16M4 17h16M9 3v8M16 13v8" /></svg><span data-barre-settings-summary="">{settings.format} · {bubbleResolutionLabel(mode, settings.resolution)}{mode === 'video' ? ` · ${settings.duration} s` : ''}</span></button>
          {settingsOpen && <div className="u-barre-settings" data-barre-settings-row="">
            <div className="u-barre-seg" role="group" aria-label={t('barre.format')}>{(['16:9','9:16','1:1'] as const).map(f => <button key={f} type="button" aria-pressed={settings.format === f} data-barre-format={f} onClick={() => setSettings(s => ({ ...s, format: f }))}>{f}</button>)}</div>
            <div className="u-barre-seg" role="group" aria-label={t('bubble.resolution')}>{(['480p','720p'] as const).map(r => <button key={r} type="button" aria-pressed={settings.resolution === r} data-barre-resolution={r} onClick={() => setSettings(s => ({ ...s, resolution: r }))}>{bubbleResolutionLabel(mode, r)}</button>)}</div>
            {mode === 'video' && <><div className="u-barre-seg" role="group" aria-label={t('barre.duree')}>{([5,10] as const).map(d => <button key={d} type="button" aria-pressed={settings.duration === d} data-barre-duree={d} onClick={() => setSettings(s => ({ ...s, duration: d }))}>{d} s</button>)}</div><button type="button" className="u-secondary" aria-pressed={settings.sound} data-barre-sound="" onClick={() => setSettings(s => ({ ...s, sound: !s.sound }))}>{t(settings.sound ? 'bubble.soundOn' : 'bubble.soundOff')}</button></>}
          </div>}
        </div>
        <button type="submit" className="u-barre-send" disabled={busy || !drafted} data-barre-send="" data-ready={text.trim() ? '' : undefined} aria-label={cost ? `${t('barre.send')} · ${cost}` : t('barre.send')} aria-describedby={routeId}><svg {...ICON}><path d="M12 19V5M6 11l6-6 6 6" /></svg></button>
      </div>
      <p className="u-bubble-limit" id={attachmentsId}>{busy ? t('namedRefs.saving') : t('bubble.referenceCount', { n: attached.length, max: CREATION_REFERENCES_MAX })} · {settings.format} · ≈ {bubbleResolutionLabel(mode, settings.resolution)} ({size.width}×{size.height})</p>
    </form>
    <p className="u-barre-route" id={routeId} data-barre-route={here?.route ?? bubbleTool(mode, attached.length, Boolean(currentAudio))}>{cost && <strong data-barre-cost="">{cost} · </strong>}{t(mode === 'image' ? 'bubble.imageEngine' : attached.length || currentAudio ? 'bubble.referenceVideoEngine' : 'bubble.textVideoEngine')}</p>
    <button type="button" className="u-text-button u-bubble-agent" data-barre-mode="agent" onClick={() => toggleAssistant(true)}>{t('bubble.askUttu')}</button>
    {error && <p role="alert">{error}</p>}
    {sheet && <ReferenceLibrary onClose={() => setSheet(false)} onPick={pickReference} onUnpick={r => setRefs(a => a.filter(x => x.id !== r.id || x.kind !== r.category))} atLimit={full} selected={selected.map(r => `${r.kind}:${r.id}`)} />}
  </>;
}
export function fillBarre(mode: BarreMode, text: string, refs?: string[], resolved?: BarreRef[]) {
  window.dispatchEvent(new CustomEvent('u-ttu-barre-fill', { detail: { mode, text, refs, resolved } }));
}
