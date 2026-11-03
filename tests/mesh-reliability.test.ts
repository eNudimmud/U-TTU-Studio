import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { importModel, modelExtension } from '../src/lib/maquette/files.ts';

import { memoryVault } from '../src/lib/coffre/store.ts';
import { createProject, loadStudio } from '../src/lib/coffre/model.ts';
import { coffreZip } from '../src/lib/coffre/export.ts';
import { mergeCoffreZip } from '../src/lib/coffre/import.ts';
import { importNotes } from '../src/lib/creation/assets.ts';
import { projectVault, recoverableClient, readPending, type PendingRender } from '../src/lib/render/recovery.ts';
import { runMesh } from '../src/lib/render/mesh-gestes.ts';
import type { RenderClient } from '../src/lib/render/client.ts';

const model = new File([JSON.stringify({ asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0 })], 'model.gltf', { type: 'model/gltf+json' });

describe('modèles 3D : fichiers durables et reprise sans nouvel envoi', () => {
  it('imports twice without overwriting and restores the exact files and notes from ZIP', async () => {
    const vault = memoryVault();
    await createProject(vault, 'Film A');
    const pinned = projectVault(vault, 'film-a');
    await createProject(vault, 'Film B');
    const first = await importModel(pinned, model), second = await importModel(pinned, model);
    assert.notEqual(first, second);
    assert.ok(first.startsWith('Projets/film-a/Assets/'));
    assert.equal((await loadStudio(vault)).project, 'film-b');
    const restored = memoryVault();
    await mergeCoffreZip(restored, await coffreZip(vault));
    for (const path of [first, second]) assert.equal(await (await restored.get(path))?.blob?.text(), await model.text());
    const notes = await importNotes(async path => (await restored.get(path))?.text, (await restored.list()).map(entry => entry.path), 'film-a');
    assert.deepEqual(notes.map(note => note.media).sort(), [first, second].sort());
  });

  it('refuses incomplete models without silently fetching external textures', async () => {
    await assert.rejects(modelExtension(new Blob(['bad']), 'bad.glb'), /invalidModel/);
    await assert.rejects(modelExtension(new Blob([JSON.stringify({ asset: { version: '2.0' }, images: [{ uri: 'https://external.example/texture.png' }] })]), 'bad.gltf'), /externalModel/);
    assert.equal(await modelExtension(model, model.name), 'gltf');
  });

  it('keeps the mesh job receipt after interruption and prevents any second POST', async () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
    const receipt: PendingRender = { version: 1, kind: 'mesh', project: 'film-a', id: 'model-1', name: 'Model', at: '2026-10-17T00:00:00Z', prompt: '', account: 'test', refs: ['input.png'], template: '3d_hunyuan3d-v2.1', quote: 4, balanceBefore: 100, jobId: null };
    let posts = 0;
    const client = { submit: async () => { posts++; return 'mesh-job-123'; }, status: async () => { throw new Error('offline'); } } as unknown as RenderClient;
    await assert.rejects(runMesh(recoverableClient(client, storage, receipt), { graph: {}, clientId: 'test', balanceBefore: 100 }), /offline/);
    assert.equal(readPending(storage)?.kind, 'mesh');
    assert.equal(readPending(storage)?.jobId, 'mesh-job-123');
    await assert.rejects(runMesh(recoverableClient(client, storage, receipt), { graph: {}, clientId: 'test', balanceBefore: 100 }), /attend/);
    assert.equal(posts, 1);
  });
});
