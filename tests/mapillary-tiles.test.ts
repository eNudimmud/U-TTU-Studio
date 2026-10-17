import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readTilePoints, tileOf } from '../src/lib/repere/mvt.ts';
import { mapillaryImageUrl, mapillaryTileUrl, nearestImageIds, tilesAround } from '../src/lib/repere/mapillary.ts';
import { mapillaryNear } from '../src/lib/repere/direct.ts';

// A tiny MVT encoder, enough to build Mapillary-like tiles.
const varint = (n: number): number[] => { const out: number[] = []; while (n >= 128) { out.push((n % 128) | 128); n = Math.floor(n / 128); } out.push(n); return out; };
const zz = (n: number) => (n >= 0 ? n * 2 : -n * 2 - 1);
const field = (num: number, bytes: number[]) => [...varint((num << 3) | 2), ...varint(bytes.length), ...bytes];
const fint = (num: number, n: number) => [...varint(num << 3), ...varint(n)];
const str = (s: string) => [...new TextEncoder().encode(s)];

function tile(layer: string, points: { id: number; px: number; py: number }[], extent = 4096): Uint8Array {
  const values = points.flatMap(p => field(4, fint(4, p.id)));
  const features = points.flatMap((p, index) => field(2, [
    ...fint(1, index + 1),
    ...field(2, [0, index]),
    ...fint(3, 1),
    ...field(4, [...varint(9), ...varint(zz(p.px)), ...varint(zz(p.py))]),
  ]));
  return new Uint8Array(field(3, [...fint(15, 2), ...field(1, str(layer)), ...features, ...field(3, str('id')), ...values, ...fint(5, extent)]));
}

const EIFFEL = { lat: 48.85837, lon: 2.294481 };
const T = tileOf(EIFFEL.lat, EIFFEL.lon, 14);
// Pixel inside the tile for a lat/lon.
function px(lat: number, lon: number) {
  const n = 2 ** 14;
  const x = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { px: Math.round((x - T.x) * 4096), py: Math.round((y - T.y) * 4096) };
}

describe('Mapillary from coverage tiles', () => {
  it('reads image points and their large ids from a vector tile', () => {
    const near = px(EIFFEL.lat + 0.0005, EIFFEL.lon);
    const bytes = tile('image', [{ id: 4_123_456_789_012_345, ...near }]);
    const [point] = readTilePoints(bytes, 'image', 14, T.x, T.y);
    assert.equal(point.id, '4123456789012345');
    assert.ok(Math.abs(point.lat - (EIFFEL.lat + 0.0005)) < 0.0001);
    assert.ok(Math.abs(point.lon - EIFFEL.lon) < 0.0001);
    assert.deepEqual(readTilePoints(bytes, 'sequence', 14, T.x, T.y), []);
  });

  it('keeps the nearest ids within the radius', () => {
    const points = [
      { id: '3', lat: EIFFEL.lat + 0.002, lon: EIFFEL.lon },
      { id: '1', lat: EIFFEL.lat + 0.0001, lon: EIFFEL.lon },
      { id: '9', lat: EIFFEL.lat + 0.05, lon: EIFFEL.lon },
      { id: 'x', lat: EIFFEL.lat, lon: EIFFEL.lon },
    ];
    assert.deepEqual(nearestImageIds(points, EIFFEL.lat, EIFFEL.lon, 300), ['3', '1'].reverse());
  });

  it('covers the radius with at most four z14 tiles and builds safe urls', () => {
    const tiles = tilesAround(EIFFEL.lat, EIFFEL.lon, 300, tileOf);
    assert.ok(tiles.length >= 1 && tiles.length <= 4);
    assert.ok(tiles.some(t => t.x === T.x && t.y === T.y));
    assert.match(mapillaryTileUrl(14, T.x, T.y, 'MLY|1'), /tiles\.mapillary\.com\/maps\/vtp\/mly1_public\/2\/14\/\d+\/\d+\?access_token=MLY%7C1$/);
    assert.throws(() => mapillaryImageUrl('../me'));
  });

  it('falls back to the tiles when the bbox search answers empty, and reads each image by id', async () => {
    const asked: string[] = [];
    const bytes = tile('image', [{ id: 111, ...px(EIFFEL.lat + 0.0003, EIFFEL.lon) }, { id: 222, ...px(EIFFEL.lat + 0.03, EIFFEL.lon) }]);
    const fetcher = (async (url: string) => {
      asked.push(url);
      if (url.includes('/images?')) return new Response(JSON.stringify({ data: [] }));
      if (url.includes('tiles.mapillary.com')) return url.includes(`/14/${T.x}/${T.y}?`) ? new Response(bytes as unknown as BodyInit) : new Response(new Uint8Array());
      if (url.includes('graph.mapillary.com/111?')) return new Response(JSON.stringify({ id: '111', thumb_256_url: 'https://scontent.fbcdn.net/a.jpg', thumb_1024_url: 'https://scontent.fbcdn.net/b.jpg', creator: { username: 'ada' }, camera_type: 'spherical', geometry: { type: 'Point', coordinates: [EIFFEL.lon, EIFFEL.lat + 0.0003] }, compass_angle: 90 }));
      return new Response('{}', { status: 404 });
    }) as never;
    const photos = await mapillaryNear(EIFFEL.lat, EIFFEL.lon, 300, 'tok', fetcher);
    assert.equal(photos?.length, 1);
    assert.equal(photos![0].id, '111');
    assert.equal(photos![0].view, 'https://scontent.fbcdn.net/b.jpg');
    assert.ok(!asked.some(url => url.includes('/222?')), 'far images are not read');
  });

  it('returns null only when nothing at all could be asked', async () => {
    const fetcher = (async () => new Response('', { status: 500 })) as never;
    assert.equal(await mapillaryNear(EIFFEL.lat, EIFFEL.lon, 300, 'tok', fetcher), null);
  });
});
