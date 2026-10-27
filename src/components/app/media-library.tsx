"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { searchMedia, type MediaAsset } from '@/lib/media/catalog';
import { useI18n } from '@/components/i18n/provider';
import { useStudio } from './studio-session';
import { toggleAssistant } from './assistant-panel';

export const MEDIA_SELECT_EVENT = 'u-ttu-agent-select';
export function MediaLibrary({ compact = false, initialQuery = '', proposedSequence = '', selectedPaths = [] }: { compact?: boolean; initialQuery?: string; proposedSequence?: string; selectedPaths?: string[] }) {
  const session = useStudio();
  const guidanceId = useId();
  const { t } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [kind, setKind] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sequence, setSequence] = useState('');
  const [character, setCharacter] = useState('');
  const [decor, setDecor] = useState('');
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const urls = useRef<string[]>([]);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => { setSelected([]); setPreviews({}); setError(''); return () => { urls.current.forEach(URL.revokeObjectURL); urls.current = []; }; }, [session.studio.project]);
  const assets = session.catalog?.assets ?? [];
  const selectionKey = selectedPaths.join('|');
  useEffect(() => {
    if (!proposedSequence) return;
    setSequence(proposedSequence);
    setSelected((session.catalog?.assets ?? []).filter(a => a.localPath && selectedPaths.includes(a.localPath)).map(a => a.id));
  }, [proposedSequence, selectionKey, session.catalog]);
  const matches = searchMedia(assets, query).filter(a => kind === 'all' || a.kind === kind);
  const found = /derni[eè]re?|latest/i.test(query) ? matches.slice(0, 1) : matches;
  async function work(fn: () => Promise<unknown>) {
    if (busy) return; setBusy(true); setError('');
    try { await fn(); } catch (e) { const key = e instanceof Error && e.message.startsWith('media.') ? e.message : 'media.failed'; setError(t(key)); }
    finally { setBusy(false); }
  }
  async function selectAsset(a: MediaAsset) {
    const path = a.localPath && session.media[a.localPath] ? a.localPath : await session.cacheMedia(a.id);
    window.dispatchEvent(new CustomEvent(MEDIA_SELECT_EVENT, { detail: { project: session.studio.project, path } }));
    toggleAssistant(true);
  }
  function exportManifest() {
    if (!session.catalog) return;
    const blob = new Blob([JSON.stringify(session.catalog, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${session.studio.project}-media.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className={`u-media-library${compact ? ' is-compact' : ''}`} id={compact ? undefined : 'mediatheque'} aria-label={t('media.title')} data-media-library="">
    {!compact && <h2>{t('media.title')}</h2>}
    <p className="u-small">{t('media.lead')}</p>
    <details className="u-media-help"><summary>{t('media.helpTitle')}</summary><p className="u-small">{t('media.help')}</p><p className="u-small" id={guidanceId}>{t('media.guidance')}</p></details>
    <div className="u-agent-actions">
      <button type="button" className="u-secondary" data-media-sync="" aria-describedby={guidanceId} disabled={busy || !session.studio.project} onClick={() => void work(() => session.syncMedia())}>{t('media.sync')}</button>
      {Object.values(session.catalog?.sync ?? {}).some(c => c.hasMore) && <button type="button" className="u-secondary" aria-describedby={guidanceId} disabled={busy} onClick={() => void work(() => session.syncMedia(true))}>{t('media.more')}</button>}
      <button type="button" className="u-secondary" aria-describedby={guidanceId} disabled={busy || !selected.length} onClick={() => void work(() => session.verifyMedia(selected))}>{t('media.verify')}</button>
    </div>
    <div className="u-agent-actions">
      <input type="search" aria-label={t('media.search')} placeholder={t('media.search')} value={query} onChange={e => setQuery(e.target.value)} data-media-search="" />
      <select aria-label={t('media.kind')} value={kind} onChange={e => setKind(e.target.value)}>{['all','image','video','audio','mesh'].map(k => <option key={k} value={k}>{t(`media.kinds.${k}`)}</option>)}</select>
    </div>
    {busy && <p role="status">{t('media.busy')}</p>}
    {error && <p role="alert">{error}</p>}
    {(() => {
      const localN = found.filter(a => a.localPath).length;
      const remoteN = found.length - localN;
      return <p className="u-small" data-media-count="">{found.length} {t('media.results')} · {localN} {t('media.local')}{remoteN > 0 ? ` · ${remoteN} ${t('media.cloud')}` : ''}</p>;
    })()}
    <ul className="u-media-grid" role="list">
      {found.slice(0, compact ? 20 : 100).map(a => {
        const local = Boolean(a.localPath && session.media[a.localPath]);
        const preview = previews[a.id] || (local && a.kind === 'image' ? session.media[a.localPath!] : '');
        return <li key={a.id} data-media-id={a.id}>
          <label className="u-media-name"><input type="checkbox" checked={selected.includes(a.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, a.id] : ids.filter(id => id !== a.id))} /><strong>{a.name}</strong></label>
          {preview && <img src={preview} alt="" loading="lazy" />}
          <p className="u-small">{t(`media.kinds.${a.kind}`)} · {local ? t('media.local') : t('media.uncached')}{a.remote && ` · ${t(`media.states.${a.remote.availability}`)}`}</p>
          {!local && <p className="u-small">{t('media.backupRecommended')}{a.technical.bytes !== null && ` · ${(a.technical.bytes / 1048576).toFixed(1)} MB`}</p>}
          {a.remote?.expiresAt && <p className="u-small">{t('media.expiration')} {new Date(a.remote.expiresAt).toLocaleDateString()}</p>}
          <p className="u-small">{[a.organization.character, a.organization.decor, a.organization.sequence, a.organization.take].filter(Boolean).join(' · ')}{a.organization.validated && ` ✓ ${t('media.validated')}`}</p>
          <div className="u-agent-actions">
            {!preview && a.remote?.previewId && <button type="button" className="u-secondary" aria-describedby={guidanceId} disabled={busy} onClick={() => void work(async () => { const blob = await session.previewMedia(a.id); const url = URL.createObjectURL(blob); urls.current.push(url); setPreviews(p => ({ ...p, [a.id]: url })); })}>{t('media.preview')}</button>}
            <button type="button" className="u-secondary" aria-describedby={guidanceId} disabled={busy || (!local && !a.remote) || a.kind === 'other'} onClick={() => void work(() => selectAsset(a))}>{local ? t('media.use') : t('media.downloadUse')}</button>
          </div>
        </li>;
      })}
    </ul>
    {selected.length > 0 && <details open={proposedSequence ? true : undefined}><summary>{t('media.classify')} ({selected.length})</summary><div className="u-agent-fields">
      <label>{t('media.character')}<input value={character} maxLength={100} onChange={e => setCharacter(e.target.value)} /></label>
      <label>{t('media.decor')}<input value={decor} maxLength={100} onChange={e => setDecor(e.target.value)} /></label>
      <label>{t('media.sequence')}<input value={sequence} maxLength={80} onChange={e => setSequence(e.target.value)} /></label>
      <button type="button" className="u-secondary" aria-describedby={guidanceId} disabled={busy || ![sequence, character, decor].some(Boolean)} onClick={() => void work(() => session.classifyMedia(selected, { ...(sequence ? { sequence } : {}), ...(character ? { character } : {}), ...(decor ? { decor } : {}) }))}>{t('media.apply')}</button>
      <button type="button" className="u-secondary" aria-describedby={guidanceId} disabled={busy} onClick={() => void work(() => session.classifyMedia(selected, { validated: true }))}>{t('media.validate')}</button>
    </div></details>}
    <details><summary>{t('media.portable')}</summary><p className="u-small">{t('media.manifestHelp')}</p><div className="u-agent-actions">
      <button type="button" className="u-secondary" aria-describedby={guidanceId} disabled={!session.catalog} onClick={exportManifest}>{t('media.manifestExport')}</button>
      <button type="button" className="u-secondary" aria-describedby={guidanceId} disabled={busy} onClick={() => file.current?.click()}>{t('media.manifestImport')}</button>
      <button type="button" className="u-secondary" aria-describedby={guidanceId} disabled={busy} onClick={() => void work(() => session.exportCoffre())}>{t('media.zip')}</button>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void work(async () => { if (f.size > 8_000_000) throw new Error('media.size'); await session.importManifest(await f.text()); }); }} />
    </div></details>
  </section>;
}
