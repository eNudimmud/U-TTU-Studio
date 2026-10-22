import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryVault } from '../src/lib/coffre/store.ts';
import { syncClientEnabled, syncServerConfig } from '../src/lib/sync/config.ts';
import { applyManifest, BACKUP_FILE, collectManifest, manifestHash, syncDecision, validateManifest, type ProjectManifest } from '../src/lib/sync/manifest.ts';
import { handleList, handleProject, type ProjectStore, type StoredProject, type SyncDeps } from '../src/lib/sync/server.ts';
import { neonProjectStore, type SqlClient } from '../src/lib/sync/neon-store.ts';
import { resolveConflict, syncProject, writeState, readState, type SyncIo } from '../src/lib/sync/client.ts';

const ORIGIN = 'https://studio.test';
const manifest = (files: Record<string, string>, project = 'film'): ProjectManifest => ({ version: 1, project, files });

function memoryStore(): ProjectStore {
  const rows = new Map<string, StoredProject>();
  return {
    async list(owner) { return [...rows.entries()].filter(([k]) => k.startsWith(`${owner}/`)).map(([, v]) => ({ ...v, manifest: undefined })); },
    async get(owner, project) { return rows.get(`${owner}/${project}`) ?? null; },
    async put(owner, project, base, m, hash) {
      const key = `${owner}/${project}`; const current = rows.get(key) ?? null;
      if ((current?.revision ?? 0) !== base) return { ok: false, conflict: current };
      const next = { project, revision: base + 1, hash, updatedAt: new Date().toISOString(), manifest: m };
      rows.set(key, next); return { ok: true, project: next };
    },
  };
}
function deps(store = memoryStore(), enabled = true): SyncDeps & { calls: number } {
  const d = { enabled, calls: 0, async verify(token: string, origin: string) { d.calls++; assert.equal(origin, ORIGIN); return token.startsWith('token-user_') ? token.slice(6) : null; }, store: () => store };
  return d;
}
const req = (path: string, init: RequestInit & { token?: string } = {}) => new Request(`${ORIGIN}${path}`, { ...init, headers: { ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), ...(init.method && init.method !== 'GET' ? { origin: ORIGIN } : {}), ...(init.headers ?? {}) } });

test('disabled mode: no variables means no sync, no auth call, no store call, and no client UI', async () => {
  assert.equal(syncServerConfig({}), null);
  assert.equal(syncServerConfig({ DATABASE_URL: 'postgresql://u:p@h/db', CLERK_SECRET_KEY: 'sk_test_x' }), null);
  assert.equal(syncServerConfig({ DATABASE_URL: 'not-a-url', CLERK_SECRET_KEY: 'sk', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk' }), null);
  assert.ok(syncServerConfig({ DATABASE_URL: 'postgresql://u:p@h/db', CLERK_SECRET_KEY: 'sk', NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk' }));
  assert.equal(syncClientEnabled({}), false);
  assert.equal(syncClientEnabled({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_x' }), false);
  assert.equal(syncClientEnabled({ NEXT_PUBLIC_STUDIO_SYNC: 'on' }), false);
  assert.equal(syncClientEnabled({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_x', NEXT_PUBLIC_STUDIO_SYNC: 'on' }), true);
  const off = deps(memoryStore(), false); let touched = false; off.store = () => { touched = true; return memoryStore(); };
  for (const response of [
    await handleList(req('/studio-sync/projects', { token: 'token-user_a1234567890123456' }), off),
    await handleProject(req('/studio-sync/projects/film', { token: 'token-user_a1234567890123456' }), 'film', off),
    await handleProject(req('/studio-sync/projects/film', { method: 'PUT', token: 'token-user_a1234567890123456', body: '{}' }), 'film', off),
  ]) { assert.equal(response.status, 404); assert.deepEqual(await response.json(), { error: 'disabled' }); }
  assert.equal(off.calls, 0); assert.equal(touched, false);
});

test('decision: same, push, pull, and a conflict whenever both sides changed since the last sync', () => {
  assert.deepEqual(syncDecision('h1', null, null), { kind: 'push', baseRevision: 0 });
  assert.deepEqual(syncDecision('h1', null, { revision: 3, hash: 'h1' }), { kind: 'same' });
  assert.deepEqual(syncDecision('h1', null, { revision: 3, hash: 'h2' }), { kind: 'conflict', local: 0, remote: 3 });
  assert.deepEqual(syncDecision('h1', null, { revision: 3, hash: 'h2' }, true), { kind: 'pull' }, 'a new device holding nothing new pulls');
  assert.deepEqual(syncDecision('h2', { revision: 3, hash: 'h1' }, { revision: 3, hash: 'h1' }), { kind: 'push', baseRevision: 3 });
  assert.deepEqual(syncDecision('h1', { revision: 3, hash: 'h1' }, { revision: 4, hash: 'h9' }), { kind: 'pull' });
  assert.deepEqual(syncDecision('h2', { revision: 3, hash: 'h1' }, { revision: 4, hash: 'h9' }), { kind: 'conflict', local: 3, remote: 4 });
});

test('server: 409 on a stale revision keeps the stored version; 401/403 without a verified same-origin session', async () => {
  const d = deps(); const token = 'token-user_a1234567890123456';
  const put = (base: number, files: Record<string, string>, extra: RequestInit = {}) => handleProject(req('/studio-sync/projects/film', { method: 'PUT', token, body: JSON.stringify({ baseRevision: base, manifest: manifest(files) }), ...extra }), 'film', d);
  assert.equal((await put(0, { 'Bible.md': 'v1' })).status, 201);
  assert.equal((await put(1, { 'Bible.md': 'v2' })).status, 200);
  const stale = await put(1, { 'Bible.md': 'other device' });
  assert.equal(stale.status, 409);
  const body = await stale.json(); assert.equal(body.error, 'conflict'); assert.equal(body.current.revision, 2);
  const got = await handleProject(req('/studio-sync/projects/film', { token }), 'film', d);
  assert.equal(got.headers.get('etag'), '"2"'); assert.deepEqual((await got.json()).manifest.files, { 'Bible.md': 'v2' });
  assert.equal((await put(0, { 'Bible.md': 'x' })).status, 409, 'create over an existing project is a conflict');
  assert.equal((await handleProject(req('/studio-sync/projects/film'), 'film', d)).status, 401);
  assert.equal((await handleProject(req('/studio-sync/projects/film', { token: 'token-nobody-123456789012345' }), 'film', d)).status, 401);
  const cross = new Request(`${ORIGIN}/studio-sync/projects/film`, { method: 'PUT', headers: { authorization: `Bearer ${token}`, origin: 'https://evil.test' }, body: '{}' });
  assert.equal((await handleProject(cross, 'film', d)).status, 403);
  const other = await handleList(req('/studio-sync/projects', { token: 'token-user_b1234567890123456' }), d);
  assert.deepEqual((await other.json()).projects, [], 'another account sees nothing');
  assert.equal((await handleProject(req('/studio-sync/projects/..', { token }), '..', d)).status, 400);
});

test('only text notes travel: media, keys, signed or blob URLs and device-only files are refused or skipped', async () => {
  assert.equal(validateManifest(manifest({ '../x.md': 'a' })).ok, false);
  assert.deepEqual(validateManifest(manifest({ 'Cast/a.png': 'a' })), { ok: false, error: 'file' });
  assert.deepEqual(validateManifest(manifest({ 'a.md': 'see https://cdn.test/x.png?X-Amz-Signature=abc' })), { ok: false, error: 'secret' });
  assert.deepEqual(validateManifest(manifest({ 'a.md': 'img: blob:https://studio.test/1' })), { ok: false, error: 'secret' });
  assert.deepEqual(validateManifest(manifest({ 'a.md': 'sk_live_abcdefghijkl' })), { ok: false, error: 'secret' });
  assert.deepEqual(validateManifest(manifest({ '.uttu/sync-backup.json': '{}' })), { ok: false, error: 'file' });
  assert.deepEqual(validateManifest(manifest({ 'a.md': 'x'.repeat(1_100_000) })), { ok: false, error: 'size' });
  assert.deepEqual(validateManifest(manifest({ 'a.md': 'x' }), 'autre'), { ok: false, error: 'project' });
  const vault = memoryVault();
  await vault.put({ path: 'Projets/film/Bible.md', text: 'bible', updatedAt: 1 });
  await vault.put({ path: 'Projets/film/.uttu/media-index.json', text: '{"version":1}', updatedAt: 1 });
  await vault.put({ path: 'Projets/film/Cast/uttu-portrait.png', blob: new Blob(['png']), updatedAt: 1 });
  await vault.put({ path: 'Projets/film/Journal.md', text: 'lien https://x.test/a?token=abc', updatedAt: 1 });
  await vault.put({ path: 'Projets/film/.uttu/sync-backup.json', text: '{}', updatedAt: 1 });
  await vault.put({ path: 'Projets/autre/Bible.md', text: 'other', updatedAt: 1 });
  const { manifest: m, skipped } = await collectManifest(vault, 'film');
  assert.deepEqual(Object.keys(m.files).sort(), ['.uttu/media-index.json', 'Bible.md']);
  assert.deepEqual(skipped, ['Journal.md']);
});

test('pull keeps a recovery copy, writes only changed notes and deletes nothing', async () => {
  const vault = memoryVault();
  await vault.put({ path: 'Projets/film/Bible.md', text: 'local', updatedAt: 1 });
  await vault.put({ path: 'Projets/film/Style.md', text: 'only here', updatedAt: 1 });
  await vault.put({ path: 'Projets/film/Cast/uttu-portrait.png', blob: new Blob(['png']), updatedAt: 1 });
  assert.equal(await applyManifest(vault, manifest({ 'Bible.md': 'server', 'Lexique.md': 'new' }), 5), 2);
  assert.equal((await vault.get('Projets/film/Bible.md'))?.text, 'server');
  assert.equal((await vault.get('Projets/film/Style.md'))?.text, 'only here');
  assert.ok((await vault.get('Projets/film/Cast/uttu-portrait.png'))?.blob);
  assert.deepEqual(JSON.parse((await vault.get(`Projets/film/${BACKUP_FILE}`))!.text!).files, { 'Bible.md': 'local' });
});

test('two devices: push, pull, explicit conflict, then each resolution', async () => {
  const d = deps(); const token = 'token-user_a1234567890123456';
  const server: typeof fetch = async (input, init) => {
    const request = new Request(new URL(String(input), ORIGIN), { ...init, headers: { ...(init?.headers as Record<string, string>), ...(init?.method === 'PUT' ? { origin: ORIGIN } : {}) } });
    const id = new URL(request.url).pathname.split('/').pop()!;
    return handleProject(request, id, d);
  };
  const device = () => {
    const vault = memoryVault(); const data = new Map<string, string>();
    const io: SyncIo = { fetch: server, storage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } }, token: async () => token, notes: () => collectManifest(vault, 'film'), apply: m => applyManifest(vault, m) };
    return { vault, io, data };
  };
  const a = device(), b = device();
  await a.vault.put({ path: 'Projets/film/Bible.md', text: 'A1', updatedAt: 1 });
  assert.deepEqual(await syncProject(a.io, 'film'), { kind: 'pushed', revision: 1 });
  assert.deepEqual(await syncProject(b.io, 'film'), { kind: 'pulled', revision: 1 });
  assert.equal((await b.vault.get('Projets/film/Bible.md'))?.text, 'A1');
  assert.deepEqual(await syncProject(b.io, 'film'), { kind: 'same', revision: 1 });
  await a.vault.put({ path: 'Projets/film/Bible.md', text: 'A2', updatedAt: 2 });
  await b.vault.put({ path: 'Projets/film/Bible.md', text: 'B2', updatedAt: 2 });
  assert.deepEqual(await syncProject(a.io, 'film'), { kind: 'pushed', revision: 2 });
  assert.deepEqual(await syncProject(b.io, 'film'), { kind: 'conflict', local: 1, remote: 2 });
  assert.equal((await b.vault.get('Projets/film/Bible.md'))?.text, 'B2', 'conflict writes nothing');
  assert.deepEqual(await resolveConflict(b.io, 'film', 'device'), { kind: 'pushed', revision: 3 });
  await a.vault.put({ path: 'Projets/film/Bible.md', text: 'A3', updatedAt: 3 });
  assert.equal((await syncProject(a.io, 'film')).kind, 'conflict');
  assert.deepEqual(await resolveConflict(a.io, 'film', 'server'), { kind: 'pulled', revision: 3 });
  assert.equal((await a.vault.get('Projets/film/Bible.md'))?.text, 'B2');
  assert.equal(JSON.parse((await a.vault.get(`Projets/film/${BACKUP_FILE}`))!.text!).files['Bible.md'], 'A3');
  writeState(a.io.storage, 'film', { revision: 0, hash: 'x' }); assert.equal(readState(a.io.storage, 'film'), null);
  const signedOut = { ...a.io, token: async () => null };
  await assert.rejects(syncProject(signedOut, 'film'), /sync\.auth/);
});

test('Neon store scopes every query to the verified owner inside one transaction', async () => {
  const seen: { text: string; params: unknown[] }[][] = [];
  const sql: SqlClient = {
    query(text, params = []) { return Object.assign(Promise.resolve([]), { text, params }); },
    async transaction(queries) { seen.push(queries.map(q => q as unknown as { text: string; params: unknown[] })); return [[], []]; },
  };
  const store = neonProjectStore(sql);
  await store.list('user_a1');
  const result = await store.put('user_a1', 'film', 4, manifest({ 'a.md': 'x' }), await manifestHash(manifest({ 'a.md': 'x' })));
  assert.deepEqual(result, { ok: false, conflict: null });
  for (const tx of seen) {
    assert.match(tx[0].text, /set_config\('app\.owner_id', \$1, true\)/);
    assert.deepEqual(tx[0].params, ['user_a1']);
    assert.equal(tx[1].params[0], 'user_a1');
    assert.match(tx[1].text, /owner_id = \$1/);
  }
  assert.match(seen[1][1].text, /revision = \$5/);
});
