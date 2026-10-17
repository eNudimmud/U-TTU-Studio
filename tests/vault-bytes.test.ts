import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bytesRow, entryFromRow } from '../src/lib/coffre/store.ts';

test('a file refused as Blob is kept as bytes and read back identical', async () => {
  const blob = new Blob([new Uint8Array([82, 73, 70, 70, 1, 2, 3])], { type: 'image/webp' });
  const row = await bytesRow({ path: 'Projets/p/Personnages/a.webp', blob, updatedAt: 1 });
  assert.equal(row.blob, undefined);
  assert.equal(row.type, 'image/webp');
  const entry = entryFromRow(row);
  assert.equal(entry.blob?.type, 'image/webp');
  assert.deepEqual(new Uint8Array(await entry.blob!.arrayBuffer()), new Uint8Array([82, 73, 70, 70, 1, 2, 3]));
  assert.equal('bytes' in entry, false);
});

test('text rows and Blob rows pass through unchanged', async () => {
  assert.deepEqual(await bytesRow({ path: 'MOC.md', text: '# x', updatedAt: 2 }), { path: 'MOC.md', text: '# x', updatedAt: 2 });
  const blob = new Blob(['a']);
  assert.equal(entryFromRow({ path: 'a.bin', blob, updatedAt: 3 }).blob, blob);
});
