import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { LocalFrame, headingOf, inSwitzerland, terrariumHeight, tileXY, tilesAround } from "../src/lib/repere3d/geo.ts";
import { dayOfYear, sunPosition, sunPreset, sunVector } from "../src/lib/repere3d/sun.ts";
import { buildCaptureMeta, captureFiles, captureNote, focalFor, fovFor } from "../src/lib/repere3d/capture.ts";
import { attributionFull, attributionLine, TERRAIN_FULL } from "../src/lib/repere3d/sources.ts";
import { Throttle, TtlCache, createGeocoder, parsePhotonList, photonSearchUrl, queryKey } from "../src/lib/repere3d/geocode.ts";
import { clipRing, decodeTile, parseTileJson, tileUrl } from "../src/lib/repere3d/osm-tiles.ts";
import { decodeTerrarium, makeSampler } from "../src/lib/repere3d/terrain.ts";
import { DEFAULT_SETTINGS, FRAMING_POSES, clampSetting, loadRadius, pixelRatioCap } from "../src/lib/repere3d/styles.ts";

describe("3D repérage · géométrie", () => {
  it("finds the tile of a place and its neighbours, nearest first", () => {
    const t = tileXY(6.6323, 46.5197, 14);
    assert.equal(Math.floor(t.x), 8493);
    assert.equal(Math.floor(t.y), 5794);
    const tiles = tilesAround(6.6323, 46.5197, 900, 14);
    assert.ok(tiles.length >= 2 && tiles.length <= 9);
    assert.deepEqual([tiles[0].x, tiles[0].y], [8493, 5794]);
    assert.equal(tilesAround(6.6323, 46.5197, 900, 14, 2).length, 2);
  });

  it("keeps a local frame in metres and back", () => {
    const frame = new LocalFrame(46.52, 6.63);
    const p = frame.fromLonLat(6.64, 46.53);
    assert.ok(Math.abs(p.x - 766) < 5, `east ${p.x}`);
    assert.ok(Math.abs(p.z + 1112) < 5, `north ${p.z}`);
    const back = frame.toLonLat(p.x, p.z);
    assert.ok(Math.abs(back.lon - 6.64) < 1e-9 && Math.abs(back.lat - 46.53) < 1e-9);
    assert.equal(headingOf(0, -1), 0);
    assert.equal(headingOf(1, 0), 90);
    assert.equal(headingOf(0, 1), 180);
  });

  it("decodes Terrarium heights and samples them", () => {
    const v = 420 + 32768;
    assert.equal(terrariumHeight(v >> 8, v & 255, 0), 420);
    const rgba = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < 16; i += 1) rgba.set([v >> 8, v & 255, 0, 255], i * 4);
    const frame = new LocalFrame(46.52, 6.63);
    const t = tileXY(6.63, 46.52, 13);
    const tile = decodeTerrarium({ z: 13, x: Math.floor(t.x), y: Math.floor(t.y) }, rgba, 4);
    const sample = makeSampler([tile], frame, -1);
    assert.equal(sample(0, 0), 420);
    assert.equal(sample(50_000, 0), -1);
  });

  it("knows Switzerland from its neighbours", () => {
    for (const [lat, lon] of [[46.5197, 6.6323], [46.6934, 6.4612], [46.2044, 6.1432], [47.3769, 8.5417], [46.0037, 8.9511]]) assert.ok(inSwitzerland(lat, lon), `${lat},${lon}`);
    for (const [lat, lon] of [[45.764, 4.8357], [45.4642, 9.19], [47.9959, 7.8522], [46.36, 6.48], [45.899, 6.129], [48.8867, 2.3431]]) assert.equal(inSwitzerland(lat, lon), false, `${lat},${lon}`);
  });
});

describe("3D repérage · soleil", () => {
  it("places the sun at noon south and high in June over Lausanne", () => {
    const sun = sunPosition(46.52, 172, 12);
    assert.ok(Math.abs(sun.azimuth - 180) < 1);
    assert.ok(sun.altitude > 65 && sun.altitude < 68, String(sun.altitude));
    const morning = sunPosition(46.52, 172, 9);
    assert.ok(morning.azimuth > 90 && morning.azimuth < 180);
    const evening = sunPosition(46.52, 172, 17.5);
    assert.ok(evening.azimuth > 180 && evening.azimuth < 300);
  });

  it("keeps presets above the horizon in winter", () => {
    const sun = sunPreset("soir", 60, new Date(Date.UTC(2026, 11, 21)));
    assert.ok(sun.altitude >= 8);
    assert.equal(dayOfYear(new Date(Date.UTC(2026, 0, 1))), 1);
    const [x, y, z] = sunVector({ azimuth: 180, altitude: 90 });
    assert.ok(Math.abs(x) < 1e-9 && Math.abs(y - 1) < 1e-9 && Math.abs(z) < 1e-9);
  });
});

describe("3D repérage · capture", () => {
  const files = captureFiles("lausanne-trait", "261018-0745");
  const meta = buildCaptureMeta({
    place: { name: "Lausanne", lat: 46.52061234567, lon: 6.63261234567 },
    camera: { lat: 46.5199999, lon: 6.6311111, heading: -30, pitch: -22.345, fov: 45, height: 57.66 },
    sun: { azimuth: 370, altitude: 33.27 },
    preset: "midi",
    look: "ombres",
    near: 51.2,
    far: 408.9,
    sources: ["terrain", "openfreemap", "terrain"],
    files: { color: files.color, depth: files.depth, lines: files.lines },
    at: new Date("2026-10-18T05:45:00Z"),
  });

  it("rounds and wraps the camera and the sun", () => {
    assert.equal(meta.kind, "reperage-3d");
    assert.equal(meta.camera.heading, 330);
    assert.equal(meta.camera.pitch, -22.3);
    assert.equal(meta.camera.height, 57.7);
    assert.equal(meta.camera.focal, focalFor(45));
    assert.equal(meta.camera.focal, 29);
    assert.ok(Math.abs(fovFor(29) - 45) < 1);
    assert.equal(meta.sun.azimuth, 10);
    assert.equal(meta.place.lat, 46.520612);
    assert.equal(meta.size.width, 1536);
    assert.equal(meta.size.height, 864);
    assert.deepEqual(meta.depth, { near: 51.2, far: 408.9, encoding: "linéaire, proche = blanc" });
    assert.equal(meta.at, "2026-10-18T05:45:00.000Z");
  });

  it("credits OpenStreetMap first, once, and never Google", () => {
    assert.deepEqual(meta.sources, ["osm", "terrain", "openfreemap"]);
    assert.match(meta.credit, /^© contributeurs OpenStreetMap · OpenFreeMap · © OpenMapTiles · Relief/);
    assert.match(meta.attribution, /ODbL 1\.0/);
    assert.match(meta.attribution, /tilezen\/joerd/);
    assert.doesNotMatch(meta.attribution + meta.credit, /google/i);
    assert.doesNotMatch(meta.credit, /swisstopo/);
    assert.match(attributionLine(["swisstopo"]), /© swisstopo$/);
    assert.match(attributionFull(["swisstopo"]), /OGD swisstopo/);
    assert.ok(TERRAIN_FULL.some(line => line.includes("EU-DEM")));
  });

  it("names the four files together and writes a plain note", () => {
    assert.deepEqual(files, {
      color: "lausanne-trait-3d-2610180745.jpg",
      depth: "lausanne-trait-3d-2610180745.depth.png",
      lines: "lausanne-trait-3d-2610180745.lines.png",
      meta: "lausanne-trait-3d-2610180745.json",
    });
    const note = captureNote(meta);
    assert.match(note, /^Lausanne \(46\.52000, 6\.63111\)\. Repérage 3D, cap 330°/);
    assert.match(note, /focale 29 mm/);
    assert.match(note, /© contributeurs OpenStreetMap/);
  });
});

describe("3D repérage · recherche", () => {
  it("throttles to one call a second", () => {
    let now = 1000;
    const gate = new Throttle(1000, () => now);
    assert.equal(gate.take(), true);
    now += 400;
    assert.equal(gate.take(), false);
    assert.equal(gate.wait(), 600);
    now += 600;
    assert.equal(gate.take(), true);
  });

  it("expires cached answers", () => {
    let now = 0;
    const cache = new TtlCache<number>(100, () => now, 2);
    cache.set("a", 1);
    assert.equal(cache.get("a"), 1);
    now = 100;
    assert.equal(cache.get("a"), null);
    cache.set("b", 2); cache.set("c", 3); cache.set("d", 4);
    assert.equal(cache.get("b"), null);
    assert.equal(queryKey("  Times   SQUARE "), "times square");
  });

  it("asks Photon once per second, caches, and never sends coordinates", async () => {
    let now = 0;
    const calls: string[] = [];
    const fetcher = (async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ features: [
        { geometry: { coordinates: [6.6326, 46.5206] }, properties: { name: "Lausanne", state: "Vaud", country: "Suisse" } },
        { geometry: { coordinates: [6.6326, 46.5206] }, properties: { name: "Lausanne", state: "Vaud", country: "Suisse" } },
        { geometry: { coordinates: [-79.1, 43.3] }, properties: { name: "Lausanne", city: "Ontario town", country: "Canada" } },
      ] }), { status: 200 });
    }) as unknown as typeof fetch;
    const geocoder = createGeocoder(fetcher, { now: () => now, online: () => true });
    const point = await geocoder.search("46.5206, 6.6326", "fr");
    assert.equal(point.kind, "point");
    assert.equal(calls.length, 0);
    const first = await geocoder.search("Lausanne", "fr");
    assert.equal(first.kind, "list");
    assert.equal(first.kind === "list" ? first.lieux.length : 0, 2);
    assert.equal(first.kind === "list" ? first.lieux[0].detail : "", "Vaud, Suisse");
    assert.match(calls[0], /^https:\/\/photon\.komoot\.io\/api\/\?q=Lausanne&limit=5&lang=fr$/);
    now += 200;
    assert.equal((await geocoder.search("lausanne ", "fr")).kind, "list");
    assert.equal(calls.length, 1, "cache hit");
    assert.equal((await geocoder.search("Shibuya", "fr")).kind, "rate");
    now += 1000;
    assert.equal((await geocoder.search("Shibuya", "es")).kind, "list");
    assert.match(calls[1], /lang=default/);
    assert.equal((await geocoder.search("https://maps.app.goo.gl/abc", "fr")).kind, "short");
    const offline = createGeocoder(fetcher, { online: () => false });
    assert.equal((await offline.search("Genève", "fr")).kind, "offline");
  });

  it("maps a 429 to a calm « rate » state", async () => {
    const geocoder = createGeocoder((async () => new Response("", { status: 429 })) as unknown as typeof fetch, { online: () => true });
    assert.equal((await geocoder.search("Tokyo", "en")).kind, "rate");
    assert.deepEqual(parsePhotonList({ features: [{ geometry: { coordinates: [200, 10] }, properties: { name: "x" } }] }), []);
    assert.equal(photonSearchUrl("a", "de").endsWith("lang=de"), true);
  });
});

describe("3D repérage · tuiles OSM", () => {
  it("accepts only an OpenFreeMap tile template", () => {
    assert.equal(parseTileJson({ tiles: ["https://tiles.openfreemap.org/planet/20261011_080001_pt/{z}/{x}/{y}.pbf"] }), "https://tiles.openfreemap.org/planet/20261011_080001_pt/{z}/{x}/{y}.pbf");
    assert.equal(parseTileJson({ tiles: ["https://evil.example/{z}/{x}/{y}.pbf"] }), null);
    assert.equal(parseTileJson({ tiles: ["http://tiles.openfreemap.org/{z}/{x}/{y}.pbf"] }), null);
    assert.equal(tileUrl("https://t/{z}/{x}/{y}.pbf", { z: 14, x: 1, y: 2 }), "https://t/14/1/2.pbf");
  });

  it("clips rings to the tile and flags cut walls", () => {
    const ring = clipRing([{ x: 4000, y: 10 }, { x: 4300, y: 10 }, { x: 4300, y: 100 }, { x: 4000, y: 100 }, { x: 4000, y: 10 }], 4096);
    assert.ok(ring.every(p => p.x <= 4096));
    assert.deepEqual(ring[0], ring[ring.length - 1]);
    assert.deepEqual(clipRing([{ x: 5000, y: 5000 }, { x: 5100, y: 5000 }, { x: 5100, y: 5100 }, { x: 5000, y: 5000 }], 4096), []);
  });

  it("reads the synthetic fixture tile: buildings with heights, roads, a park", () => {
    const bytes = new Uint8Array(readFileSync("e2e/fixtures/reperage-tile.pbf"));
    const t = tileXY(6.6326, 46.5206, 14);
    const tile = { z: 14, x: Math.floor(t.x), y: Math.floor(t.y) };
    const frame = new LocalFrame(46.5206, 6.6326);
    const shapes = decodeTile(bytes, tile, frame, 5000);
    assert.equal(shapes.buildings.length, 26);
    assert.ok(shapes.buildings.every(b => b.height >= 8 && b.height <= 38 && b.min === 0));
    const cut = shapes.buildings.filter(b => b.cut.some(Boolean));
    assert.equal(cut.length, 1, "the edge building has one cut wall");
    assert.equal(shapes.roads.length, 3);
    assert.deepEqual(new Set(shapes.roads.map(r => r.kind)), new Set(["major", "minor", "path"]));
    assert.equal(shapes.areas.length, 1);
    assert.equal(shapes.areas[0].kind, "park");
  });
});

describe("3D repérage · réglages par défaut", () => {
  it("lets a novice start without any slider", () => {
    assert.equal(DEFAULT_SETTINGS.look, "trait");
    assert.equal(FRAMING_POSES.contre.street, true);
    assert.equal(clampSetting("fov", 500), 90);
    assert.equal(clampSetting("altitude", Number.NaN), 5);
    assert.ok(loadRadius(true) < loadRadius(false));
    assert.equal(pixelRatioCap(true, 3), 1.5);
    assert.equal(pixelRatioCap(false, 3), 2);
  });
});
