import assert from 'node:assert/strict';
import { it } from 'node:test';
import { bindPendingJob, PENDING_RENDER_KEY, type PendingRender } from '../src/lib/render/recovery.ts';
import { submitTake, takeGraphFor } from '../src/lib/render/run.ts';
import type { RenderClient } from '../src/lib/render/client.ts';
import { DEFAULT_TAKE } from '../src/lib/render/take-graph.ts';
import { studioTarget } from '../src/lib/coffre/target.ts';
import { chooseEdit } from '../src/lib/montage/from-takes.ts';
import { emptyEdit } from '../src/lib/montage/edit.ts';

const pending: PendingRender = { version: 1, kind: 'take', project: 'film', id: 'plan-a', name: 'Plan A', prompt: 'A', at: '2026-10-16', account: 'fingerprint', refs: [], template: 'h3', quote: 4, balanceBefore: 100, jobId: null,
  flight: { project: 'film', at: '2026-10-16', sceneId: null, sceneName: '', line: 'A', prompt: 'A', settings: { ...DEFAULT_TAKE, engine: 'h3' }, balanceBefore: 100 } };
function store() {
  let value = JSON.stringify(pending);
  return { getItem: (_: string) => value, setItem: (_: string, next: string) => { value = next; }, removeItem: (_: string) => { value = ''; } };
}
it('binds a manually verified existing job with unknown cost, without a submit capability', async () => {
  const disk = store(); const checked: string[] = [];
  const receipt = await bindPendingJob(disk, { status: async id => { checked.push(id); return 'success'; } }, 'fingerprint', 'existing-job-123', true);
  assert.deepEqual(checked, ['existing-job-123']);
  assert.equal(receipt.flight?.manualRecovery, true);
  assert.equal(JSON.parse(disk.getItem(PENDING_RENDER_KEY)).jobId, 'existing-job-123');
  assert.equal(receipt.project, pending.project);
});
it('preserves the ambiguous receipt on wrong account, missing confirmation, network error or concurrent update', async () => {
  for (const [account, confirmed] of [['wrong', true], ['fingerprint', false]] as const) {
    const disk = store();
    await assert.rejects(bindPendingJob(disk, { status: async () => { assert.fail('must not reach the network'); } }, account, 'existing-job-123', confirmed));
    assert.deepEqual(JSON.parse(disk.getItem(PENDING_RENDER_KEY)), pending);
  }
  const disk = store();
  await assert.rejects(bindPendingJob(disk, { status: async () => { throw Error('offline'); } }, 'fingerprint', 'existing-job-123', true), /offline/);
  assert.deepEqual(JSON.parse(disk.getItem(PENDING_RENDER_KEY)), pending);
  const newer = { ...pending, jobId: 'different-job-456' };
  await assert.rejects(bindPendingJob(disk, { status: async () => { disk.setItem(PENDING_RENDER_KEY, JSON.stringify(newer)); return 'success'; } }, 'fingerprint', 'existing-job-123', true), /changed/);
  assert.deepEqual(JSON.parse(disk.getItem(PENDING_RENDER_KEY)), newer);
});
it('rejects excess references before uploads and submission instead of losing the selected decor', async () => {
  const client = { upload: async () => { assert.fail('no upload'); }, submit: async () => { assert.fail('no submit'); } } as unknown as RenderClient;
  for (const [engine, count] of [['ltx', 5], ['h3', 10]] as const) {
    const settings = { ...DEFAULT_TAKE, engine };
    const pictures = Array.from({ length: count }, (_, i) => ({ blob: new Blob(['image']), name: `ref-${i}.jpg` }));
    await assert.rejects(submitTake(client, { settings, pictures, prompt: 'action', seed: 1, clientId: 'test' }, () => {}), /référence/);
    assert.throws(() => takeGraphFor(settings, 'action', pictures.map(p => p.name), 1), /référence/);
  }
});
it('targets the requested project and montage, including an empty saved edit', () => {
  assert.equal(studioTarget('prise', 'take-a', 'film'), '/studio?project=film&take=take-a#prise');
  assert.equal(studioTarget('plan', 'plan-a', 'film'), '/studio?project=film&plan=plan-a#prise');
  const one = emptyEdit('one', 'One'), two = emptyEdit('two', 'Two');
  const input = { saved: [one, two], sequences: [], shots: [], takes: [] };
  assert.equal(chooseEdit({ ...input, requestedId: 'two' }).edit, two);
  assert.throws(() => chooseEdit({ ...input, requestedId: 'missing' }), /sequence-missing/);
});
