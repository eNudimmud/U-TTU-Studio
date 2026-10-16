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
