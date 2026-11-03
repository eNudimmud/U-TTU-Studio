import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSheet, withoutSheets } from '../src/lib/creation/sheet.ts';

/** A smooth gradient with soft blobs: a photo-like picture with no straight seam. */
function photo(w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = Math.round(90 + 60 * Math.sin(x / 37) * Math.cos(y / 29) + 40 * Math.sin((x + y) / 53));
  return g;
}
/** The same picture cut into a 2×3 board of abutting panels, each shifted in brightness. */
function board(w: number, h: number): Uint8Array {
  const g = photo(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const cell = (y < h / 2 ? 0 : 3) + Math.min(2, Math.floor(x / (w / 3)));
    g[y * w + x] = Math.max(0, Math.min(255, g[y * w + x] + [0, 45, -40, 30, -35, 50][cell]));
  }
  return g;
}

test('a board of abutting panels is a sheet, a seamless picture is not', () => {
  assert.equal(isSheet(board(700, 467), 700, 467), true);
  assert.equal(isSheet(photo(700, 467), 700, 467), false);
  assert.equal(isSheet(photo(467, 700), 467, 700), false);
  assert.equal(isSheet(board(40, 40), 40, 40), false, 'too small to judge: kept');
});

test('a sheet is dropped only when its reference keeps a clean picture', () => {
  const slots = [{ ref: 0, picture: 'a' }, { ref: 1, picture: 'fizz-board' }, { ref: 1, picture: 'fizz' }, { ref: 2, picture: 'ship-board' }, { ref: 2, picture: 'ship' }, { ref: 3, picture: 'only-board' }];
  const sheet = [false, true, false, true, false, true];
  assert.deepEqual(withoutSheets(slots, sheet).map(s => s.picture), ['a', 'fizz', 'ship', 'only-board']);
  assert.deepEqual(withoutSheets(slots, slots.map(() => false)), slots, 'no board: nothing changes');
});
