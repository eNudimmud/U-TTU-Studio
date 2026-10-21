import { assetNote } from '../creation/assets.ts';
import type { VaultStore } from '../coffre/store.ts';
import { accountFingerprint } from '../render/recovery.ts';
import type { RenderClient } from '../render/client.ts';
import { MediaError, type MediaClient } from './cloud.ts';
import { mergeRemote, readCatalog, remoteState, updateCatalog, type MediaAsset, type MediaCatalog } from './catalog.ts';

export interface SyncScope { project: string; account: string; current(): boolean }
const guard = (scope: SyncScope) => { if (!scope.current()) throw new Error('media.changed'); };
export async function syncPage(store: VaultStore, scope: SyncScope, client: MediaClient, offset = 0): Promise<MediaCatalog> {
  guard(scope);
  const page = await client.list(offset);
  guard(scope);
  return updateCatalog(store, scope.project, c => { guard(scope); const next = mergeRemote(c, scope.account, page.assets); next.sync = { ...next.sync, [scope.account]: { offset: page.nextOffset, hasMore: page.hasMore, at: new Date().toISOString() } }; return next; });
}
export async function verifyMedia(store: VaultStore, scope: SyncScope, client: MediaClient, ids: string[]): Promise<MediaCatalog> {
  const snapshot = await readCatalog(store, scope.project);
  for (const asset of snapshot.assets.filter(a => ids.includes(a.id)).slice(0, 50)) {
    if (asset.remote?.account !== scope.account || !asset.remote.assetId) continue;
    guard(scope);
    try {
      const row = await client.detail(asset.remote.assetId); guard(scope);
      if (row.id !== asset.remote.assetId) throw new MediaError('invalid');
      await updateCatalog(store, scope.project, c => { guard(scope); return mergeRemote(c, scope.account, [row]); });
    } catch (error) {
      guard(scope);
      if (error instanceof MediaError && error.code === 'missing') await updateCatalog(store, scope.project, c => remoteState(c, asset.id, 'missing'));
      else { await updateCatalog(store, scope.project, c => remoteState(c, asset.id, 'unknown')); throw error; }
    }
  }
  return readCatalog(store, scope.project);
}
export async function cacheMedia(store: VaultStore, scope: SyncScope, client: MediaClient, render: Pick<RenderClient, 'file'>, assetId: string): Promise<string> {
  guard(scope);
  const c = await readCatalog(store, scope.project);
  const asset = c.assets.find(a => a.id === assetId);
  if (!asset) throw new Error('media.invalid');
  if (asset.localPath && (await store.get(asset.localPath))?.blob) return asset.localPath;
  if (asset.remote?.account !== scope.account || (!asset.remote.assetId && !asset.remote.output)) throw new Error('media.account');
  if (asset.technical.bytes !== null && asset.technical.bytes > 200 * 1024 * 1024) throw new MediaError('size');
  let blob: Blob;
  try { blob = asset.remote.assetId ? await client.content(asset.remote.assetId) : await render.file(asset.remote.output!); }
  catch (error) { guard(scope); if (error instanceof MediaError && error.code === 'missing') await updateCatalog(store, scope.project, c => remoteState(c, assetId, 'missing')); throw error; }
  guard(scope);
  if (blob.size > 200 * 1024 * 1024) throw new MediaError('size');
  const safeId = asset.remote.assetId ?? `job-${(await accountFingerprint(asset.id)).slice(0,16)}`;
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(safeId)) throw new MediaError('invalid');
  const formats: Record<string, string> = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'image/avif':'avif', 'image/gif':'gif', 'video/mp4':'mp4', 'video/webm':'webm', 'video/quicktime':'mov', 'audio/mpeg':'mp3', 'audio/wav':'wav', 'audio/x-wav':'wav', 'audio/ogg':'ogg', 'audio/mp4':'m4a', 'audio/flac':'flac', 'model/gltf-binary':'glb' };
  const ext = formats[blob.type] ?? (/\.(glb|mp4|webm|png|jpg|webp|wav|mp3|ogg)$/i.exec(asset.name)?.[1]?.toLowerCase());
  if (!ext) throw new MediaError('invalid');
  const path = `Projets/${scope.project}/Assets/cloud-${safeId}.${ext}`;
  // A failed index write can be retried without replacing earlier project media.
  const existing = await store.get(path);
  if (existing) {
    if (!existing.blob || existing.blob.size !== blob.size) throw new Error('media.conflict');
    const digest = async (b: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()))).join(',');
    if (await digest(existing.blob) !== await digest(blob)) throw new Error('media.conflict');
  }
  if (!existing) await store.put({ path, blob, updatedAt: Date.now() });
  guard(scope);
  const note = path.replace(/\.[^.]+$/, '.md');
  if (!await store.get(note)) await store.put({ path: note, text: assetNote({ id: `cloud-${safeId}`, kind: asset.kind === 'video' ? 'plan' : asset.kind === 'audio' ? 'son' : 'importe', name: asset.name, at: asset.createdAt ?? new Date().toISOString(), prompt: '', geste: '', template: '', refs: [], devis: 0, cout: null, media: path, note, preview: null, loose: false }), updatedAt: Date.now() });
  await updateCatalog(store, scope.project, current => { guard(scope); return { ...current, assets: current.assets.map(a => a.id === assetId ? { ...a, localPath: path, technical: { mime: blob.type, bytes: blob.size }, remote: a.remote ? { ...a.remote, availability: 'available', checkedAt: new Date().toISOString() } : null } : a) }; });
  return path;
}
export function classify(c: MediaCatalog, ids: string[], patch: Partial<MediaAsset['organization']>): MediaCatalog {
  return { ...c, assets: c.assets.map(a => ids.includes(a.id) ? { ...a, organization: { ...a.organization, ...patch } } : a) };
}
