"use client";

import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@/components/i18n/provider';
import { REFERENCE_CATEGORIES, REFERENCE_PHOTOS_MAX, type NamedReference, type ReferenceCategory } from '@/lib/creation/named-references';
import { Close, Plus } from './glyphs';
import { useStudio } from './studio-session';

export function ReferenceLibrary({ onClose, onPick, initialImage }: {
  onClose(): void; onPick?(ref: NamedReference): void;
  initialImage?: { src: string; name: string; path?: string };
}) {
  const { t } = useI18n();
  const { references, media, deleteReference } = useStudio();
  const [editing, setEditing] = useState<NamedReference | 'new' | null>(initialImage ? 'new' : null);
  const [filter, setFilter] = useState<ReferenceCategory | 'tout'>('tout');
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<NamedReference | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId(), statusId = useId();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = dialog.current; el?.showModal();
    return () => { el?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const shown = references.filter(r => (filter === 'tout' || r.category === filter) && `${r.name} ${r.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div className="u-overlay"><dialog ref={dialog} className="u-sheet u-native-sheet is-tall u-refs-sheet u-named-refs" aria-labelledby={title} data-refs-sheet="" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header className="u-refs-head">
      <button type="button" className="u-icon" aria-label={t('verb.close')} disabled={busy} aria-describedby={statusId} onClick={onClose}><Close /></button>
      <h2 id={title}>{t(editing ? editing === 'new' ? 'namedRefs.new' : 'namedRefs.edit' : 'namedRefs.title')}</h2>
      {!editing && <button type="button" className="u-icon" aria-label={t('namedRefs.new')} data-refs-new="" onClick={() => setEditing('new')}><Plus /></button>}
    </header>
    <p className="u-small" id={statusId} hidden={!busy}>{t('namedRefs.saving')}</p>
    {error && <p role="alert">{error}</p>}
    {deleting ? <div className="u-named-delete" role="alertdialog" aria-label={t('namedRefs.deleteTitle')}>
      <h3>{t('namedRefs.deleteTitle')}</h3><p>{t('namedRefs.deleteQuestion', { name: deleting.name })}</p>
      <div className="u-fil-actions"><button className="u-secondary" disabled={busy} aria-describedby={statusId} autoFocus onClick={() => setDeleting(null)}>{t('verb.cancel')}</button><button className="u-primary" data-ref-delete-confirm="" disabled={busy} aria-describedby={statusId} onClick={async () => { setBusy(true); setError(''); try { await deleteReference(deleting); setDeleting(null); } catch { setError(t('namedRefs.failed')); } finally { setBusy(false); } }}>{t('namedRefs.delete')}</button></div>
    </div> : editing ? <ReferenceEditor key={editing === 'new' ? 'new' : editing.note} original={editing === 'new' ? undefined : editing} initialImage={initialImage} onBack={() => setEditing(null)} onSaved={() => setEditing(null)} onBusy={setBusy} /> : <>
      <p className="u-small">{t(onPick ? 'namedRefs.shared' : 'namedRefs.manageHelp')}</p>
      <label className="u-field"><span className="sr-only">{t('namedRefs.search')}</span><input type="search" placeholder={t('namedRefs.search')} value={query} onChange={e => setQuery(e.target.value)} data-ref-search="" /></label>
      <div className="u-refs-filters" role="group" aria-label={t('barre.refs.filter')}>
        {(['tout', ...REFERENCE_CATEGORIES] as const).map(c => <button key={c} type="button" data-refs-filter={c} aria-pressed={filter === c} onClick={() => setFilter(c)}>{t(c === 'tout' ? 'barre.refs.tout' : `namedRefs.category.${c}`)}</button>)}
      </div>
      {shown.length === 0 && <p className="u-small" data-refs-empty="">{t('namedRefs.empty')}</p>}
      <ul className="u-refs-grid" role="list">
        {shown.map(ref => <li key={ref.note}>
          <button type="button" className="u-refs-card" data-ref={ref.id} data-ref-kind={ref.category} disabled={Boolean(onPick) && !ref.preview} aria-describedby={!ref.preview ? `${statusId}-${ref.id}` : undefined} onClick={() => onPick ? onPick(ref) : setEditing(ref)}>
            <span className="u-refs-thumb">{media[ref.preview] && <img src={media[ref.preview]} alt="" width={320} height={320} loading="lazy" />}</span>
            <strong>{ref.name}</strong><small>{t(`namedRefs.category.${ref.category}`)} · {t('namedRefs.photoCount', { n: ref.images.length })}</small>{!ref.preview && <small id={`${statusId}-${ref.id}`}>{t('namedRefs.missing')}</small>}
          </button>
          <div className="u-named-card-actions"><button type="button" data-ref-edit={ref.id} aria-label={t('namedRefs.editName', { name: ref.name })} onClick={() => setEditing(ref)}>{t('namedRefs.edit')}</button><button type="button" data-ref-delete={ref.id} aria-label={t('namedRefs.deleteName', { name: ref.name })} onClick={() => setDeleting(ref)}>{t('namedRefs.delete')}</button></div>
        </li>)}
      </ul>
      <button type="button" className="u-secondary" data-ref-create="" onClick={() => setEditing('new')}><Plus />{t('namedRefs.new')}</button>
    </>}
  </dialog></div>;
}

type Photo = { file?: File; path?: string; src: string; name: string };
function ReferenceEditor({ original, initialImage, onBack, onSaved, onBusy }: { original?: NamedReference; initialImage?: { src: string; name: string; path?: string }; onBack(): void; onSaved(): void; onBusy(busy: boolean): void }) {
  const { t } = useI18n();
  const { saveReference, media } = useStudio();
  const [name, setName] = useState(original?.name ?? '');
  const [description, setDescription] = useState(original?.description ?? '');
  const [category, setCategory] = useState<ReferenceCategory>(original?.category ?? 'cast');
  const [photos, setPhotos] = useState<Photo[]>(original?.images.map(path => ({ path, src: media[path] ?? '', name: original.name })) ?? []);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const statusId = useId();
  useEffect(() => () => urls.current.forEach(src => URL.revokeObjectURL(src)), []);
  useEffect(() => {
    if (!initialImage || original) return;
    if (initialImage.path) { setPhotos([{ ...initialImage }]); return; }
    let live = true;
    fetch(initialImage.src).then(r => { if (!r.ok) throw new Error(); return r.blob(); }).then(b => {
      if (!live) return;
      const file = new File([b], 'reference.png', { type: b.type || 'image/png' });
      setPhotos([{ file, src: initialImage.src, name: initialImage.name }]);
    }).catch(() => { if (live) setError(t('namedRefs.missing')); });
    return () => { live = false; };
  }, [initialImage, original, t]);
  return <form className="u-named-editor" data-ref-editor="" onSubmit={async e => {
    e.preventDefault(); if (!name.trim() || !photos.length || busy) return;
    setBusy(true); onBusy(true); setError('');
    try { await saveReference({ original, name, description, category, images: photos.map(({ file, path }) => ({ file, path })) }); onSaved(); }
    catch (e) { setError(t(e instanceof Error && e.message.startsWith('namedRefs.') ? e.message : 'namedRefs.failed')); }
    finally { setBusy(false); onBusy(false); }
  }}>
    <label className="u-field"><span>{t('namedRefs.name')}</span><input autoFocus required maxLength={40} value={name} data-ref-name="" onChange={e => setName(e.target.value)} /></label>
    <label className="u-field"><span>{t('namedRefs.description')}</span><textarea rows={2} maxLength={2000} value={description} data-ref-description="" onChange={e => setDescription(e.target.value)} /></label>
    <label className="u-field"><span>{t('namedRefs.categoryLabel')}</span><select value={category} data-ref-category="" onChange={e => setCategory(e.target.value as ReferenceCategory)}>{REFERENCE_CATEGORIES.map(c => <option key={c} value={c}>{t(`namedRefs.category.${c}`)}</option>)}</select></label>
    <p className="u-small" id={statusId}>{t(busy ? 'namedRefs.saving' : 'namedRefs.requiredHelp')} {t('namedRefs.photosHelp')}</p>
    <div className="u-named-photos">{photos.map((p, i) => <div key={`${p.path ?? p.src}-${i}`}><img src={p.src} alt={p.name} /><button type="button" className="u-icon" data-ref-photo-remove={i} aria-label={t('namedRefs.removePhoto', { n: i + 1 })} disabled={busy} aria-describedby={statusId} onClick={() => setPhotos(a => a.filter((_, j) => j !== i))}><Close /></button></div>)}</div>
    <input type="file" accept="image/*" multiple hidden ref={picker} data-ref-photos="" onChange={e => {
      const files = [...(e.target.files ?? [])].filter(f => f.type.startsWith('image/'));
      const room = REFERENCE_PHOTOS_MAX - photos.length;
      setError(files.length > room ? t('namedRefs.photosLimit') : '');
      setPhotos(a => [...a, ...files.slice(0, room).map(file => { const src = URL.createObjectURL(file); urls.current.push(src); return { file, src, name: file.name }; })]);
      e.target.value = '';
    }} />
    <button type="button" className="u-secondary" data-ref-add-photos="" disabled={busy || photos.length >= REFERENCE_PHOTOS_MAX} aria-describedby={statusId} onClick={() => picker.current?.click()}>{t('namedRefs.addPhotos')}</button>
    {error && <p role="alert">{error}</p>}
    <div className="u-named-editor-foot"><button type="button" className="u-secondary" disabled={busy} aria-describedby={statusId} onClick={onBack}>{t('verb.cancel')}</button><button type="submit" className="u-primary" data-ref-save="" disabled={busy || !name.trim() || photos.length === 0} aria-describedby={statusId}>{t(busy ? 'namedRefs.saving' : original ? 'namedRefs.save' : 'namedRefs.create')}</button></div>
  </form>;
}
