import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { importMedia } from '../src/lib/creation/import-media.ts';
import { importNotes } from '../src/lib/creation/assets.ts';
import { coffreZip } from '../src/lib/coffre/export.ts';
import { mergeCoffreZip } from '../src/lib/coffre/import.ts';
import { createProject, loadStudio, writeText, writeBlob, type Shot } from '../src/lib/coffre/model.ts';
import { memoryVault, removeUnreferenced } from '../src/lib/coffre/store.ts';
import { PENDING_RENDER_KEY, readPending, clearPending, clearTerminalPending, reconcilePendingReceipt, pendingState, recoverableClient, projectVault, type PendingRender } from '../src/lib/render/recovery.ts';
import { failView, failKind } from '../src/lib/render/fail.ts';
import { RenderError, type RenderClient } from '../src/lib/render/client.ts';
import { placeLandedTake } from '../src/lib/render/settle-take.ts';
import { initialMaquette, addFigure, seedLead, removeFigure } from '../src/lib/maquette/state.ts';
import { maquetteJson, readMaquette } from '../src/lib/maquette/persistence.ts';
import { chooseEdit } from '../src/lib/montage/from-takes.ts';
import { readFolder } from '../src/lib/coffre/permit.ts';
import type { DirectoryHandle } from '../src/lib/coffre/link.ts';

function storage() {
  const entries = new Map<string, string>();
  return { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); }, removeItem: (key: string) => { entries.delete(key); } };
}
const receipt: PendingRender = { version: 1, kind: 'take', project: 'film-a', id: 'prise-01', name: 'Plan', prompt: 'Elle entre.', at: '2026-10-15T00:00:00Z', account: 'account-hash', refs: [], template: 'h3', quote: 4, balanceBefore: 100, jobId: null };
const graph = {};

describe('parcours de production : données et reprise', () => {
  it('places the imported cast in an untouched empty scene without undoing a deliberate removal', () => {
    const empty = { ...initialMaquette(), figures: [] };
    const placed = seedLead(empty, { id: 'alice', name: 'Alice' });
    assert.deepEqual(placed.figures.map(figure => figure.id), ['alice']);
    const removed = removeFigure(placed, 'alice');
    assert.equal(seedLead(removed, { id: 'alice', name: 'Alice' }), removed);
  });

  it('imports the same filename twice without overwriting bytes, and restores all media from ZIP', async () => {
    const vault = memoryVault();
    await createProject(vault, 'Film A');
    await importMedia(vault, [new File(['portrait-a'], 'portrait.jpg', { type: 'image/jpeg' })], 'personnage');
    await importMedia(vault, [new File(['portrait-b'], 'portrait.jpg', { type: 'image/jpeg' })], 'personnage');
    await importMedia(vault, [new File(['decor'], 'quai.png', { type: 'image/png' })], 'decor');
    await importMedia(vault, [new File(['clip'], 'prise.mp4', { type: 'video/mp4' }), new File(['sound'], 'voix.wav', { type: 'audio/wav' })]);
    const before = await loadStudio(vault);
    assert.equal(before.cast.length, 2);
    assert.equal(before.scenes.length, 1);
    const sheets = before.cast.map(card => card.sheet!);
    assert.equal(new Set(sheets).size, 2);
    assert.deepEqual((await Promise.all(sheets.map(async path => (await vault.get(path))!.blob!.text()))).sort(), ['portrait-a', 'portrait-b']);
    const archive = await coffreZip(vault);
    const restored = memoryVault();
    await mergeCoffreZip(restored, archive);
    const after = await loadStudio(restored);
    assert.deepEqual(after.cast.map(card => card.id), before.cast.map(card => card.id));
    assert.deepEqual(after.scenes.map(scene => scene.id), before.scenes.map(scene => scene.id));
    const entries = await restored.list();
    const notes = await importNotes(async path => (await restored.get(path))?.text, entries.map(entry => entry.path), after.project);
    assert.deepEqual(notes.map(note => note.kind).sort(), ['plan', 'son']);
    for (const entry of (await vault.list()).filter(entry => entry.blob)) {
      assert.deepEqual(await (await restored.get(entry.path))!.blob!.arrayBuffer(), await entry.blob!.arrayBuffer(), entry.path);
    }
  });

  it('prevents a paid POST if the durable receipt cannot be written', async () => {
    let calls = 0;
    const client = { submit: async () => { calls++; return 'job-123456'; } } as unknown as RenderClient;
    const disk = { ...storage(), setItem() { throw new Error('quota'); } };
    await assert.rejects(recoverableClient(client, disk, receipt).submit(graph, 'client-id'), /quota/);
    assert.equal(calls, 0);
  });

  it('keeps an ambiguous submission and refuses a second POST after reload', async () => {
    const disk = storage();
    let calls = 0;
    const client = { submit: async () => { calls++; throw new RenderError('network', 'lost response'); } } as unknown as RenderClient;
    await assert.rejects(recoverableClient(client, disk, receipt).submit(graph, 'client-id'), /lost response/);
    assert.equal(readPending(disk)?.jobId, null);
    await assert.rejects(recoverableClient(client, disk, receipt).submit(graph, 'client-id'), /attend/);
    assert.equal(calls, 1);
  });

  it('keeps the exact job and project until that result has been saved', async () => {
    const disk = storage();
    const client = { submit: async () => 'job-123456' } as unknown as RenderClient;
    await recoverableClient(client, disk, receipt).submit(graph, 'client-id');
    assert.deepEqual(readPending(disk), { ...receipt, jobId: 'job-123456' });
    clearPending(disk, 'another-job');
    assert.ok(readPending(disk));
    clearPending(disk, 'job-123456');
    assert.equal(readPending(disk), null);
    disk.setItem(PENDING_RENDER_KEY, 'corrupt');
    await assert.rejects(recoverableClient(client, disk, receipt).submit(graph, 'client-id'));
  });

  it('allows a new confirmed attempt after an explicit authentication rejection', async () => {
    const disk = storage();
    const client = { submit: async () => { throw new RenderError('auth', 'refused'); } } as unknown as RenderClient;
    await assert.rejects(recoverableClient(client, disk, receipt).submit(graph, 'client-id'), /refused/);
    assert.equal(readPending(disk), null);
  });

  it('clears the blank receipt after an invalid Comfy refusal (nothing was queued)', async () => {
    const disk = storage();
    const client = { submit: async () => { throw new RenderError('invalid', 'bad graph', ['node 1 missing']); } } as unknown as RenderClient;
    await assert.rejects(recoverableClient(client, disk, receipt).submit(graph, 'client-id'), /bad graph/);
    assert.equal(readPending(disk), null);
  });

  it('reconcilePendingReceipt drops a receipt whose Comfy job already failed or was cancelled', async () => {
    const disk = storage();
    disk.setItem(PENDING_RENDER_KEY, JSON.stringify({ ...receipt, jobId: 'dead-job-1' }));
    const failedClient = { status: async () => 'error' } as unknown as Pick<RenderClient, 'status'>;
    assert.equal(await reconcilePendingReceipt(disk, failedClient), 'cleared');
    assert.equal(readPending(disk), null);

    disk.setItem(PENDING_RENDER_KEY, JSON.stringify({ ...receipt, jobId: 'dead-job-2' }));
    const cancelledClient = { status: async () => 'cancelled' } as unknown as Pick<RenderClient, 'status'>;
    assert.equal(await reconcilePendingReceipt(disk, cancelledClient), 'cleared');
    assert.equal(readPending(disk), null);

    disk.setItem(PENDING_RENDER_KEY, JSON.stringify({ ...receipt, jobId: 'live-job' }));
    const liveClient = { status: async () => 'running' } as unknown as Pick<RenderClient, 'status'>;
    assert.equal(await reconcilePendingReceipt(disk, liveClient), 'blocked');
    assert.ok(readPending(disk));
    // F3: the refusal knows the job is still running (status read only).
    assert.equal((await pendingState(disk, liveClient)).stage, 'render');
    assert.equal((await pendingState(disk, { status: async () => 'success' } as unknown as Pick<RenderClient, 'status'>)).stage, 'done');

    clearTerminalPending(disk, 'live-job');
    assert.equal(readPending(disk), null);
    assert.equal(await reconcilePendingReceipt(disk, liveClient), 'none');
  });

  it('failView maps auth, cloud, pending and network to distinct visitor actions', () => {
    const auth = failView(new RenderError('auth', 'gone'));
    assert.equal(auth.kind, 'auth');
    assert.equal(auth.reconnect, true);
    assert.equal(auth.intact, false);
    assert.match(auth.message, /session Comfy|ailleurs/i);

    const cloud = failView(new RenderError('failed', 'boom', ['CUDA OOM']));
    assert.equal(cloud.kind, 'cloud');
    assert.equal(cloud.retry, true);
    assert.equal(cloud.intact, true);
    assert.match(cloud.message, /cloud/i);
    assert.match(cloud.message, /CUDA OOM/);

    assert.equal(failKind(new Error('Un rendu attend sa récupération. Ouvre Crédits puis Récupérer le rendu avant un nouvel envoi.')), 'pending');
    const net = failView(new RenderError('network', 'offline'));
    assert.equal(net.kind, 'network');
    assert.equal(net.retry, true);
  });

  it('failView hides raw ffmpeg / VHS extract lines', () => {
    const vhs = failView(new RenderError('failed', 'boom', ['VHS failed to extract audio']));
    assert.equal(vhs.kind, 'cloud');
    assert.equal(vhs.message.includes('VHS'), false);
    assert.equal(vhs.message.includes('ffmpeg'), false);
    const raw = failView(new Error('ffmpeg: Error while decoding'));
    assert.equal(raw.message.includes('ffmpeg'), false);
  });

  it('saves a background result in the original project without switching the visible project', async () => {
    const vault = memoryVault();
    await createProject(vault, 'Film A');
    const scoped = projectVault(vault, 'film-a');
    await createProject(vault, 'Film B');
    await importMedia(scoped, [new File(['frame'], 'frame.png', { type: 'image/png' })], 'personnage');
    assert.equal((await loadStudio(vault)).project, 'film-b');
    assert.equal((await loadStudio(vault)).cast.length, 0);
    assert.equal((await loadStudio(scoped)).cast.length, 1);
  });

  it('attaches a generated take only to its requested plan and sequence, once', () => {
    const shots: Shot[] = ['one', 'two'].map((id, ordre) => ({ id, name: id, note: '', sequenceId: id, takeIds: [], ordre }));
    const sequences = shots.map(shot => ({ id: shot.id, name: shot.name, links: [] }));
    const once = placeLandedTake('take-1', sequences, shots, 'two');
    assert.deepEqual(once.shots.map(shot => shot.takeIds), [[], ['take-1']]);
    assert.deepEqual(once.sequences.map(sequence => sequence.links.length), [0, 1]);
    assert.deepEqual(placeLandedTake('take-1', once.sequences, once.shots, 'two'), once);
  });

  it('preserves a media file used by another card or montage when its card is removed', async () => {
    const vault = memoryVault();
    const path = 'Projets/film-a/Cast/portrait.jpg';
    await writeBlob(vault, path, new Blob(['portrait']));
    await writeText(vault, 'Projets/film-a/Sequences/cut.json', JSON.stringify({ source: path }));
    await removeUnreferenced(vault, [path]);
    assert.ok((await vault.get(path))?.blob);
    await vault.remove('Projets/film-a/Sequences/cut.json');
    await removeUnreferenced(vault, [path]);
    assert.equal(await vault.get(path), null);
  });

  it('restores the maquette and starts a real project with an empty montage', () => {
    const state = addFigure(initialMaquette(), { id: 'other', name: 'Autre' });
    const restored = readMaquette(maquetteJson(state));
    assert.deepEqual(restored?.figures, state.figures);
    assert.deepEqual(restored?.orbit, state.orbit);
    assert.deepEqual(restored?.past, []);
    assert.equal(readMaquette('{bad'), null);
    const empty = { saved: [], sequences: [], shots: [], takes: [] };
    assert.equal(chooseEdit(empty).edit.video.length, 0);
    assert.ok(chooseEdit({ ...empty, demo: true }).edit.video.length > 0);
  });

  it('stops folder synchronization before overwriting divergent local or external data', async () => {
    const vault = memoryVault();
    await writeText(vault, 'README.md', 'local version');
    const external = new File(['external version'], 'README.md', { type: 'text/plain' });
    const root = { async *entries() { yield ['README.md', { kind: 'file', getFile: async () => external }]; } } as unknown as DirectoryHandle;
    await assert.rejects(readFolder(root, vault), /Deux versions différentes/);
    assert.equal((await vault.get('README.md'))?.text, 'local version');
    assert.equal(await external.text(), 'external version');
  });
});
