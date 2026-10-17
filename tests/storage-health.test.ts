import assert from 'node:assert/strict';
import { it } from 'node:test';
import { storageHealth, protectStorage } from '../src/lib/coffre/storage-health.ts';

it('inspects quota without requesting persistence', async () => {
  let asks = 0;
  assert.deepEqual(await storageHealth({ persisted: async () => false, estimate: async () => ({ usage: 90, quota: 100 }), persist: async () => { asks++; return true; } }), { mode: 'best-effort', usage: 90, quota: 100 });
  assert.equal(asks, 0);
});
it('never reports a refused, failed or unsupported request as protected', async () => {
  assert.equal((await protectStorage({ persist: async () => false, persisted: async () => false })).mode, 'best-effort');
  assert.equal((await protectStorage({ persist: async () => { throw Error('denied'); } })).mode, 'unknown');
  assert.equal((await protectStorage()).mode, 'unsupported');
  assert.equal((await protectStorage({ persist: async () => true })).mode, 'persistent');
});
it('bounds unanswered browser prompts, deduplicates requests and observes a later grant', async () => {
  let asks = 0, accepted = false;
  let grant!: (value: boolean) => void;
  const pending = new Promise<boolean>(resolve => { grant = resolve; });
  const storage = { persist: () => { asks++; return pending; }, persisted: async () => accepted };
  for (let i = 0; i < 2; i++) {
    const health = await protectStorage(storage, 5);
    assert.equal(health.request, 'pending');
    assert.equal(health.mode, 'best-effort');
  }
  assert.equal(asks, 1);
  accepted = true; grant(true);
  assert.equal((await storageHealth(storage)).mode, 'persistent');
});
it('bounds unavailable inspection without claiming protection or inventing quota', async () => {
  const health = await storageHealth({ persisted: () => new Promise(() => {}), estimate: () => new Promise(() => {}) }, 5);
  assert.deepEqual(health, { mode: 'unknown', usage: null, quota: null });
});
