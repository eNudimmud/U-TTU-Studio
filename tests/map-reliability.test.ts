import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chaineRue, licenseLabel, panoramaxSearchUrl, panoramaxThumbAllowed, parseInstanceHosts, parsePanoramax, photoLicenseUrl, reusablePhoto, type PhotoRue } from '../src/lib/repere/panoramax.ts';

test('catalogue federation is exact-host allowlisted and rejects arbitrary media origins', () => {
  const hosts = new Set(parseInstanceHosts({ instances: [{ url: 'https://panoramax.bikespaceproject.ca' }, { url: 'http://unsafe.example' }, { url: 'https://localhost:443' }, { url: 'https://user:pass@unsafe.example' }] }));
  assert.equal(hosts.size, 1);
  assert.equal(panoramaxThumbAllowed('https://panoramax.bikespaceproject.ca/pic.jpg', hosts), true);
  assert.equal(panoramaxThumbAllowed('https://attacker.example/pic.jpg', hosts), false);
  assert.equal(panoramaxThumbAllowed('https://evil.panoramax.bikespaceproject.ca/pic.jpg', hosts), false);
});

test('licence is never invented and missing attribution prevents project copies', () => {
  assert.equal(licenseLabel(''), 'Licence non précisée');
  assert.equal(reusablePhoto({ license: '', author: 'Ada' }), false);
  assert.equal(reusablePhoto({ license: 'CC-BY-SA-4.0', author: 'Panoramax' }), false);
  assert.equal(reusablePhoto({ license: 'CC-BY-SA-4.0', author: 'Ada' }), true);
  assert.equal(photoLicenseUrl('CC-BY-SA-4.0'), 'https://creativecommons.org/licenses/by-sa/4.0/');
});

test('wider search is explicit and capped at 3 km', () => {
  assert.equal(new URL(panoramaxSearchUrl(46.52, 6.63, 1000)).searchParams.get('place_distance'), '0-1000');
  assert.equal(new URL(panoramaxSearchUrl(46.52, 6.63, 9000)).searchParams.get('place_distance'), '0-3000');
});

test('disconnected nearby sequences are all retained', () => {
  const photo = (id: string, lon: number): PhotoRue => ({ id, lat: 46.52, lon, thumb: '', view: '', author: 'Ada', license: 'CC-BY-SA-4.0', source: 'panoramax', tour: false, fov: 75, heading: 0, next: null, prev: null });
  const found = chaineRue([photo('first', 6.63), photo('other-sequence', 6.631)], 46.52, 6.63);
  assert.equal(found.photos.length, 2);
  assert.equal(found.photos[found.start].id, 'first');
});

test('federated photos keep author, licence version and geography', () => {
  const photos = parsePanoramax({ type: 'FeatureCollection', features: [{ id: '12345678-1234-1234-1234-123456789abc', geometry: { coordinates: [6.63, 46.52] }, properties: { license: 'CC-BY-3.0', 'geovisio:producer': 'Ada' }, assets: { sd: { href: 'https://pano.example/image.jpg' } } }] }, new Set(['pano.example']));
  assert.equal(photos.length, 1);
  assert.equal(photos[0].license, 'CC-BY-3.0');
  assert.equal(photos[0].lat, 46.52);
});
