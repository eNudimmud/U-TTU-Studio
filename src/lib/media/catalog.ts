import { cleanPath, type VaultStore } from '../coffre/store.ts';
import { accountFingerprint, type PendingRender } from '../render/recovery.ts';
import type { OutputRef, JobDetail } from '../render/client.ts';

export const INDEX_FILE = '.uttu/media-index.json';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type MediaKind = 'image' | 'video' | 'audio' | 'mesh' | 'other';
export type Availability = 'available' | 'unknown' | 'missing' | 'expired';
export interface RemoteAsset {
  id: string; name: string; kind: MediaKind; mime: string; size: number | null;
  createdAt: string | null; updatedAt: string | null; hash: string | null; jobId: string | null;
  previewId: string | null; expiresAt: string | null;
}
export interface MediaAsset {
  id: string; project: string; name: string; kind: MediaKind; createdAt: string | null;
  localPath: string | null; workflowId: string | null; jobId: string | null;
  remote: { account: string; assetId: string | null; output: OutputRef | null; availability: Availability; checkedAt: string | null; expiresAt: string | null; hash: string | null; previewId: string | null } | null;
  technical: { mime: string; bytes: number | null };
  /** No balance delta is labelled an asset-specific verified charge. */
  cost: { credits: number; source: 'provider-receipt' } | null;
  organization: { character: string; decor: string; sequence: string; take: string; validated: boolean; tags: string[] };
  relations: string[];
}
export interface MediaCatalog { version: 1; project: string; revision: number; assets: MediaAsset[]; sync: Record<string, { offset: number; hasMore: boolean; at: string }> }
const text = (v: unknown, max = 200): string => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, max) : '';
const date = (v: unknown): string | null => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
const id = (v: unknown): string | null => typeof v === 'string' && UUID.test(v) ? v.toLowerCase() : null;
export const mediaKind = (name: string, mime = ''): MediaKind => mime.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(name) ? 'video' : mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|opus)$/i.test(name) ? 'audio' : /\.(glb|gltf)$/i.test(name) ? 'mesh' : mime.startsWith('image/') || /\.(png|jpg|jpeg|webp|avif|gif)$/i.test(name) ? 'image' : 'other';
export function parseRemoteAsset(raw: unknown): RemoteAsset {
  if (!raw || typeof raw !== 'object') throw new Error('media.invalid');
  const r = raw as Record<string, unknown>;
  const assetId = id(r.id);
  if (!assetId) throw new Error('media.invalid');
  const name = text(r.name ?? r.file_path) || assetId;
  const mime = text(r.mime_type ?? r.content_type, 100);
  const size = r.size ?? r.size_bytes;
  return { id: assetId, name, mime, kind: mediaKind(name, mime), size: typeof size === 'number' && Number.isSafeInteger(size) && size >= 0 ? size : null, createdAt: date(r.created_at), updatedAt: date(r.updated_at), hash: typeof (r.asset_hash ?? r.hash) === 'string' && /^blake3:[a-f0-9]{64}$/.test(String(r.asset_hash ?? r.hash)) ? String(r.asset_hash ?? r.hash) : null, jobId: text(r.prompt_id ?? r.job_id, 100) || null, previewId: id(r.preview_id), expiresAt: date(r.expires_at) };
}
export function emptyCatalog(project: string): MediaCatalog {
  if (!/^[a-z0-9-]+$/.test(project)) throw new Error('media.project');
  return { version: 1, project, revision: 0, assets: [], sync: {} };
}
const organization = (): MediaAsset['organization'] => ({ character: '', decor: '', sequence: '', take: '', validated: false, tags: [] });
export function localAsset(project: string, path: string, name = path.split('/').pop() ?? path, createdAt: string | null = null): MediaAsset {
  if (!cleanPath(path) || !path.startsWith(`Projets/${project}/`)) throw new Error('media.path');
  return { id: `local:${path}`, project, name, kind: mediaKind(path), createdAt, localPath: path, workflowId: null, jobId: null, remote: null, technical: { mime: '', bytes: null }, cost: null, organization: organization(), relations: [] };
}
/** Reconstruct an allowlisted shape: no URLs, arbitrary properties or credentials survive imports. */
export function parseCatalog(raw: string | undefined, project: string): MediaCatalog {
  const result = emptyCatalog(project);
  if (!raw) return result;
  if (raw.length > 8_000_000) throw new Error('media.invalid');
  const data = JSON.parse(raw) as MediaCatalog;
  if (data.version !== 1 || data.project !== project || !Array.isArray(data.assets) || data.assets.length > 10_000) throw new Error('media.invalid');
  result.revision = Number.isSafeInteger(data.revision) && data.revision >= 0 ? data.revision : 0;
  for (const a of data.assets) {
    if (!a || typeof a.id !== 'string' || a.id.length > 300 || !/^(local:|cloud:|render:)[A-Za-z0-9/.:_ -]+$/.test(a.id) || a.project !== project || result.assets.some(r => r.id === a.id)) throw new Error('media.invalid');
    const path = a.localPath;
    if (path !== null && (typeof path !== 'string' || !cleanPath(path) || !path.startsWith(`Projets/${project}/`))) throw new Error('media.path');
    const remote = a.remote;
    if (remote && (!/^[a-f0-9]{64}$/.test(remote.account) || (remote.assetId !== null && !id(remote.assetId)))) throw new Error('media.account');
    const output = remote?.output;
    if (output && (typeof output.filename !== 'string' || !output.filename || output.filename.length > 300 || /[\\\u0000]/.test(output.filename) || typeof output.subfolder !== 'string' || typeof output.type !== 'string')) throw new Error('media.invalid');
    const org = a.organization ?? organization();
    result.assets.push({ id: a.id, project, name: text(a.name), kind: ['image','video','audio','mesh','other'].includes(a.kind) ? a.kind : 'other', createdAt: date(a.createdAt), localPath: path, workflowId: text(a.workflowId) || null, jobId: text(a.jobId) || null, remote: remote ? { account: remote.account, assetId: remote.assetId, output: output ? { filename: output.filename, subfolder: text(output.subfolder), type: text(output.type, 20) } : null, availability: ['available','unknown','missing','expired'].includes(remote.availability) ? remote.availability : 'unknown', checkedAt: date(remote.checkedAt), expiresAt: date(remote.expiresAt), hash: typeof remote.hash === 'string' && /^blake3:[a-f0-9]{64}$/.test(remote.hash) ? remote.hash : null, previewId: id(remote.previewId) } : null, technical: { mime: text(a.technical?.mime, 100), bytes: typeof a.technical?.bytes === 'number' && a.technical.bytes >= 0 ? a.technical.bytes : null }, cost: null, organization: { character: text(org.character), decor: text(org.decor), sequence: text(org.sequence, 80), take: text(org.take, 80), validated: org.validated === true, tags: Array.isArray(org.tags) ? org.tags.filter(v => typeof v === 'string').slice(0, 20).map(v => text(v, 80)) : [] }, relations: Array.isArray(a.relations) ? a.relations.filter(v => typeof v === 'string' && v.length <= 300).slice(0, 100) : [] });
  }
  // Pagination is advisory. Invalid imported cursors restart safely from page zero.
  for (const [account, cursor] of Object.entries(data.sync ?? {})) if (/^[a-f0-9]{64}$/.test(account) && Number.isSafeInteger(cursor.offset) && cursor.offset >= 0 && cursor.offset <= 100_000 && date(cursor.at)) result.sync[account] = { offset: cursor.offset, hasMore: cursor.hasMore === true, at: cursor.at };
  return result;
}
export function mergeRemote(catalog: MediaCatalog, account: string, rows: RemoteAsset[], now = new Date().toISOString()): MediaCatalog {
  if (!/^[a-f0-9]{64}$/.test(account)) throw new Error('media.account');
  const assets = [...catalog.assets];
  for (const r of rows) {
    // Only exact remote identity, or job AND exact output name. Never filename alone.
    const prior = assets.find(a => a.remote?.account === account && (a.remote.assetId === r.id || (a.remote.assetId === null && a.jobId && a.jobId === r.jobId && a.remote.output?.filename === r.name)));
    const remote: NonNullable<MediaAsset['remote']> = { account, assetId: r.id, output: prior?.remote?.output ?? null, availability: r.expiresAt && r.expiresAt <= now ? 'expired' : 'available', checkedAt: now, expiresAt: r.expiresAt, hash: r.hash, previewId: r.previewId };
    if (prior) assets[assets.indexOf(prior)] = { ...prior, remote, technical: { mime: r.mime, bytes: r.size }, jobId: prior.jobId ?? r.jobId };
    else assets.push({ id: `cloud:${account}:${r.id}`, project: catalog.project, name: r.name, kind: r.kind, createdAt: r.createdAt, localPath: null, remote, workflowId: null, jobId: r.jobId, technical: { mime: r.mime, bytes: r.size }, cost: null, organization: organization(), relations: [] });
  }
  return { ...catalog, assets };
}
export function remoteState(catalog: MediaCatalog, assetId: string, state: Availability, now = new Date().toISOString()): MediaCatalog {
  return { ...catalog, assets: catalog.assets.map(a => a.id === assetId && a.remote ? { ...a, remote: { ...a.remote, availability: state, checkedAt: now } } : a) };
}
export async function accountScope(user: Record<string, unknown>, credentialScope?: string): Promise<string> {
  const value = user.id ?? user.user_id ?? user.uid;
  if (typeof value !== 'string' || !value || value.length > 200) { if (credentialScope && /^[a-f0-9]{64}$/.test(credentialScope)) return accountFingerprint(`comfy-credential:${credentialScope}`); throw new Error('media.identity'); }
  return accountFingerprint(`comfy-user:${value}`);
}
export function catalogPath(project: string): string { emptyCatalog(project); return `Projets/${project}/${INDEX_FILE}`; }
export async function readCatalog(store: VaultStore, project: string): Promise<MediaCatalog> { return parseCatalog((await store.get(catalogPath(project)))?.text, project); }
const queues = new Map<string, Promise<unknown>>();
/** Read/modify/write serialized in this tab and, where supported, across tabs. */
export async function updateCatalog(store: VaultStore, project: string, change: (c: MediaCatalog) => MediaCatalog): Promise<MediaCatalog> {

  const update = async () => {
    const current = await readCatalog(store, project);
    const next = change(current); next.revision = current.revision + 1;
    const safe = parseCatalog(JSON.stringify(next), project);
    await store.put({ path: catalogPath(project), text: JSON.stringify(safe), updatedAt: Date.now() });
    return safe;
  };
  const locked = async () => typeof navigator !== 'undefined' && navigator.locks ? await navigator.locks.request(`uttu-media-${project}`, update) : await update();
  const pending = (queues.get(project) ?? Promise.resolve()).catch(() => {}).then(locked);
  queues.set(project, pending);
  try { return await pending; } finally { if (queues.get(project) === pending) queues.delete(project); }
}
/** Additive migration: originals and existing organization are never replaced. */
export async function discoverLocal(store: VaultStore, project: string, labels: Record<string, { name: string; character?: string; decor?: string; createdAt?: string; jobId?: string; workflowId?: string; sequence?: string; take?: string }> = {}): Promise<MediaCatalog> {
  const files = (await store.list()).filter(e => e.blob && e.path.startsWith(`Projets/${project}/`) && mediaKind(e.path, e.blob.type) !== 'other');
  return updateCatalog(store, project, c => ({ ...c, assets: [...c.assets.map(a => {
    const label = a.localPath ? labels[a.localPath] : undefined;
    if (!label) return a;
    // Backfill provenance after the original module saves its note; never replace a user's classification.
    return { ...a, jobId: a.jobId ?? label.jobId ?? null, workflowId: a.workflowId ?? label.workflowId ?? null,
      organization: { ...a.organization, character: a.organization.character || label.character || '', decor: a.organization.decor || label.decor || '', sequence: a.organization.sequence || label.sequence || '', take: a.organization.take || label.take || '' } };
  }), ...files.filter(e => !c.assets.some(a => a.localPath === e.path)).map(e => {
    const label = labels[e.path]; const base = localAsset(project, e.path, label?.name, label?.createdAt ?? new Date(e.updatedAt).toISOString());
    return { ...base, jobId: label?.jobId ?? null, workflowId: label?.workflowId ?? null, organization: { ...base.organization, character: label?.character ?? '', decor: label?.decor ?? '', sequence: label?.sequence ?? '', take: label?.take ?? '' }, technical: { mime: e.blob!.type, bytes: e.blob!.size } };
  })] }));
}
export function outputRefs(detail: JobDetail): (OutputRef & { assetId: string | null })[] {
  const refs: (OutputRef & { assetId: string | null })[] = [];
  for (const node of Object.values(detail.outputs ?? {})) if (node && typeof node === 'object') for (const list of Object.values(node)) if (Array.isArray(list)) for (const row of list) if (row && typeof row.filename === 'string' && !/[\\\u0000]/.test(row.filename)) refs.push({ filename: row.filename, subfolder: text(row.subfolder), type: text(row.type) || 'output', assetId: id(row.asset_id ?? row.id) });
  return refs;
}
/** A completed job is a durable reference even if its output has no Asset API UUID. */
export async function registerRender(store: VaultStore, receipt: PendingRender, detail: JobDetail, account: string): Promise<void> {
  const refs = outputRefs(detail);
  const entries = await store.list();
  const candidates = entries.filter(e => e.blob && e.path.startsWith(`Projets/${receipt.project}/`) && e.path.split('/').pop()?.startsWith(`${receipt.id}.`));
  await updateCatalog(store, receipt.project, c => {
    let next = c;
    const parents: string[] = [];
    for (const path of receipt.refs) {
      if (!cleanPath(path) || !path.startsWith(`Projets/${receipt.project}/`)) continue;
      let parent = next.assets.find(a => a.localPath === path);
      if (!parent) {
        const entry = entries.find(e => e.path === path && e.blob);
        if (!entry || mediaKind(path, entry.blob!.type) === 'other') continue;
        parent = { ...localAsset(receipt.project, path), technical: { mime: entry.blob!.type, bytes: entry.blob!.size } };
        next = { ...next, assets: [...next.assets, parent] };
      }
      parents.push(parent.id);
    }
    const linkedKinds = new Set<MediaKind>();
    for (const [i, ref] of refs.entries()) {
      const kind = mediaKind(ref.filename);
      const file = linkedKinds.has(kind) ? undefined : candidates.find(e => mediaKind(e.path, e.blob?.type) === kind);
      if (file) linkedKinds.add(kind);
      const existing = next.assets.find(a => a.remote?.account === account && ((ref.assetId && a.remote.assetId === ref.assetId) || (a.jobId === receipt.jobId && a.remote.output?.filename === ref.filename))) ?? next.assets.find(a => file && a.localPath === file.path && !a.remote);
      const now = new Date().toISOString();
      const remote: NonNullable<MediaAsset['remote']> = { account, assetId: ref.assetId ?? existing?.remote?.assetId ?? null, output: { filename: ref.filename, subfolder: ref.subfolder, type: ref.type }, availability: existing?.remote?.expiresAt && existing.remote.expiresAt <= now ? 'expired' : 'available', checkedAt: now, expiresAt: existing?.remote?.expiresAt ?? null, hash: existing?.remote?.hash ?? null, previewId: existing?.remote?.previewId ?? null };
      const asset: MediaAsset = { ...(existing ?? localAsset(receipt.project, file?.path ?? `Projets/${receipt.project}/Assets/${receipt.id}.${i}`)), id: existing?.id ?? `render:${receipt.jobId}:${i}`, project: receipt.project, name: receipt.name, kind, createdAt: receipt.at, localPath: file?.path ?? existing?.localPath ?? null, workflowId: receipt.template, jobId: receipt.jobId, remote, technical: { mime: file?.blob?.type ?? existing?.technical.mime ?? '', bytes: file?.blob?.size ?? existing?.technical.bytes ?? null }, cost: null, organization: existing?.organization ?? { ...organization(), character: receipt.kind === 'cast' ? receipt.name : '', decor: receipt.kind === 'decor' ? receipt.name : '', take: receipt.kind === 'take' ? receipt.id : '' }, relations: [...new Set([...(existing?.relations ?? []), ...parents])].slice(0,100) };
      next = { ...next, assets: [...next.assets.filter(a => a.id !== asset.id), asset] };
    }
    return next;
  });
}
export function searchMedia(assets: MediaAsset[], query: string, now = new Date()): MediaAsset[] {
  const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const text = fold(query);
  const thisWeek = /cette semaine|this week/.test(text);
  const missing = /indisponible|manquan|expire|supprime|missing|unavailable|ne .*plus disponible/.test(text);
  const validated = /validee?s?|approved|validated/.test(text);
  const video = /prises|videos|takes/.test(text);
  const image = /images|photos/.test(text);
  const week = new Date(now); week.setHours(0, 0, 0, 0); week.setDate(week.getDate() - (week.getDay() + 6) % 7);
  const stop = new Set('retrouve trouve toutes tous les des mes mon projet montre moi image images photo photos prise prises video videos cette semaine derniere dernier validees validee valides valide utilise comme reference quels fichiers ne sont plus sur comfy cloud disponibles indisponibles manquants expires recherche generees generes generee genere generated de du le la l d et dans du a the all my find show week latest validated approved missing unavailable'.split(' '));
  const words = text.split(/[^a-z0-9*]+/).filter(w => w.length > 1 && !stop.has(w));
  return assets.filter(a => (!thisWeek || (a.createdAt && a.createdAt >= week.toISOString())) && (!missing || (a.remote && ['missing','expired'].includes(a.remote.availability))) && (!validated || a.organization.validated) && (!video || a.kind === 'video') && (!image || a.kind === 'image') && words.every(word => fold([a.name, a.organization.character, a.organization.decor, a.organization.sequence, ...a.organization.tags].join(' ')).includes(word))).sort((a,b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}
