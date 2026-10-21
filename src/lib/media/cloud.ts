import type { RenderAuth } from '../render/client.ts';
import { UUID, parseRemoteAsset, type RemoteAsset } from './catalog.ts';
type MediaErrorCode = 'auth' | 'missing' | 'network' | 'unsupported' | 'size' | 'invalid';
export class MediaError extends Error { readonly code: MediaErrorCode; constructor(code: MediaErrorCode) { super(`media.${code}`); this.code = code; } }
export interface MediaClient {
  list(offset: number): Promise<{ assets: RemoteAsset[]; hasMore: boolean; nextOffset: number }>;
  detail(id: string): Promise<RemoteAsset>;
  content(id: string, maxBytes?: number): Promise<Blob>;
}
export function createMediaClient(auth: RenderAuth, doFetch: typeof fetch = fetch): MediaClient {
  const valid = (id: string) => { if (!UUID.test(id)) throw new MediaError('invalid'); return id; };
  async function get(path: string): Promise<Response> {
    const headers = new Headers();
    if (auth.kind === 'key') headers.set('x-api-key', auth.key);
    else { const token = await auth.token(); if (!token) throw new MediaError('auth'); headers.set('authorization', `Bearer ${token}`); }
    let response: Response;
    try { response = await doFetch(path, { headers, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60_000) }); }
    catch { throw new MediaError('network'); }
    if ([401,403].includes(response.status)) throw new MediaError('auth');
    if ([404,410].includes(response.status)) throw new MediaError('missing');
    if ([405,501].includes(response.status)) throw new MediaError('unsupported');
    if (!response.ok) throw new MediaError('network');
    return response;
  }
  return {
    async list(offset) {
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100_000) throw new MediaError('invalid');
      const r = await get(`/api/assets?limit=50&offset=${offset}&sort=created_at&order=desc`);
      const data = await r.json();
      if (!Array.isArray(data.assets) || data.assets.length > 50 || typeof data.has_more !== 'boolean' || (data.has_more && !data.assets.length)) throw new MediaError('invalid');
      return { assets: data.assets.map(parseRemoteAsset), hasMore: data.has_more, nextOffset: offset + data.assets.length };
    },
    async detail(id) {
      const base = parseRemoteAsset(await (await get(`/api/assets/${valid(id)}`)).json());
      // v1 inventory does not promise an expiry field. v2 may expose one; a missing
      // v2 surface does not invalidate an asset whose v1 metadata was just read.
      try {
        const extra = parseRemoteAsset(await (await get(`/api/v2/assets/${valid(id)}`)).json());
        if (extra.id !== base.id) throw new MediaError('invalid');
        return { ...base, expiresAt: extra.expiresAt, hash: extra.hash ?? base.hash, jobId: extra.jobId ?? base.jobId };
      } catch (error) { if (error instanceof MediaError && ['missing','unsupported'].includes(error.code)) return base; throw error; }
    },
    async content(id, maxBytes = 200 * 1024 * 1024) {
      const r = await get(`/api/v2/assets/${valid(id)}/content`);
      const type = (r.headers.get('content-type') ?? '').split(';')[0];
      if (!/^(image|video|audio|model)\//.test(type) && type !== 'application/octet-stream') throw new MediaError('invalid');
      if (Number(r.headers.get('content-length')) > maxBytes) { await r.body?.cancel(); throw new MediaError('size'); }
      const reader = r.body?.getReader(); if (!reader) throw new MediaError('network');
      const chunks: ArrayBuffer[] = []; let size = 0;
      try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > maxBytes) { await reader.cancel(); throw new MediaError('size'); } chunks.push(part.value.slice().buffer); } }
      finally { reader.releaseLock(); }
      return new Blob(chunks, { type });
    },
  };
}
