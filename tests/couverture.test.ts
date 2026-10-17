import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyCouverture, couverture, PANORAMAX_TILES } from '../src/lib/repere/couverture.ts';

function fakeMap() {
  const sources = new Map<string, object>();
  const layers = new Map<string, object>();
  return {
    sources, layers,
    getSource: (id: string) => sources.get(id),
    getLayer: (id: string) => layers.get(id),
    addSource: (id: string, spec: object) => { if (sources.has(id)) throw new Error('dup'); sources.set(id, spec); },
    addLayer: (layer: { id: string; source: string }) => { if (!sources.has(layer.source)) throw new Error('no source'); layers.set(layer.id, layer); },
    removeLayer: (id: string) => { layers.delete(id); },
    removeSource: (id: string) => { for (const layer of layers.values() as Iterable<{ source: string }>) if (layer.source === id) throw new Error('in use'); sources.delete(id); },
  };
}

describe('photo coverage overlay', () => {
  it('uses only free Panoramax tiles without a Mapillary token', () => {
    const overlay = couverture('');
    assert.equal(overlay.mapillary, false);
    assert.deepEqual(overlay.sources.map(source => source.spec.tiles[0]), [PANORAMAX_TILES]);
    assert.ok(overlay.layers.every(layer => !JSON.stringify(layer).includes('mapillary')));
    assert.match(overlay.credits.join(' '), /Panoramax/);
  });

  it('adds Mapillary with its credit when a public token exists', () => {
    const overlay = couverture(' MLY|123 ');
    assert.equal(overlay.mapillary, true);
    assert.match(overlay.sources[1].spec.tiles[0], /access_token=MLY%7C123$/);
    assert.match(overlay.credits.join(' '), /Mapillary/);
  });

  it('toggles idempotently and removes layers before sources', () => {
    const map = fakeMap();
    const overlay = couverture('tok');
    applyCouverture(map, true, overlay);
    applyCouverture(map, true, overlay);
    assert.equal(map.layers.size, 4);
    applyCouverture(map, false, overlay);
    assert.equal(map.layers.size, 0);
    assert.equal(map.sources.size, 0);
  });

  it('stays in the black and gold palette', () => {
    for (const layer of couverture('tok').layers) {
      const color = String(layer.paint['line-color'] ?? layer.paint['circle-color']);
      assert.match(color, /^#(d4af37|f3e3a1)$/);
    }
  });
});
