import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { LocalFrame } from "../src/lib/repere3d/geo.ts";
import { DEAD_ZONE, classifyTwo, readTwo, tiltFor } from "../src/lib/repere3d/gesture.ts";
import { attributionLine } from "../src/lib/repere3d/sources.ts";
import {
  SWISSBUILDINGS_ROOT, ecefToGeodetic, geodeticToEcef, gltfToLocal, heightOffset, keepSwiss, radianBox, regionHits,
  safeTileUrl, splitB3dm, swissContents, swissRadius, swissTileCap,
  osmMassingColor, soberColor,
} from "../src/lib/repere3d/swiss-buildings.ts";

describe("swissBUILDINGS3D", () => {
  it("round-trips WGS84 geodetic and ECEF", () => {
    const [x, y, z] = geodeticToEcef(46.5206, 6.6326, 512);
    const g = ecefToGeodetic(x, y, z);
    assert.ok(Math.abs(g.lat - 46.5206) < 1e-8);
    assert.ok(Math.abs(g.lon - 6.6326) < 1e-8);
    assert.ok(Math.abs(g.h - 512) < 1e-3);
  });

  it("puts a glTF (Y-up) vertex at the right place in the local frame", () => {
    const frame = new LocalFrame(46.5206, 6.6326);
    const [ex, ey, ez] = geodeticToEcef(46.5215, 6.6340, 530);
    // glTF Y-up: (x, y, z)gltf = (ex, ez, -ey) relative to the RTC centre.
    const rtc = [ex - 10, ey + 20, ez - 5];
    const p = gltfToLocal(10, 5, 20, rtc, frame);
    const expected = frame.fromLonLat(6.6340, 46.5215);
    assert.ok(Math.abs(p[0] - expected.x) < 0.01, `x ${p[0]} vs ${expected.x}`);
    assert.ok(Math.abs(p[2] - expected.z) < 0.01, `z ${p[2]} vs ${expected.z}`);
    assert.ok(Math.abs(p[1] - 530) < 0.01);
    assert.ok(p[0] > 0 && p[2] < 0, "north-east is +x and -z");
  });

  it("splits a b3dm and reads its RTC centre", () => {
    const ft = JSON.stringify({ BATCH_LENGTH: 2, RTC_CENTER: [1, 2, 3] }).padEnd(48, " ");
    const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 12, 0, 0, 0]);
    const total = 28 + ft.length + glb.length;
    const bytes = new Uint8Array(total);
    const view = new DataView(bytes.buffer);
    bytes.set([0x62, 0x33, 0x64, 0x6d]);
    view.setUint32(4, 1, true);
    view.setUint32(8, total, true);
    view.setUint32(12, ft.length, true);
    bytes.set(new TextEncoder().encode(ft), 28);
    bytes.set(glb, 28 + ft.length);
    const parts = splitB3dm(bytes.buffer);
    assert.ok(parts);
    assert.deepEqual(parts.rtc, [1, 2, 3]);
    assert.equal(parts.batchLength, 2);
    assert.equal(parts.glb.byteLength, glb.length);
    assert.equal(splitB3dm(new ArrayBuffer(8)), null);
  });

  it("walks the tileset to the content tiles around a place, nearest first, swisstopo host only", async () => {
    const [w, s, e, n] = radianBox(46.5206, 6.6326, 2000);
    const near = [6.6326 * Math.PI / 180 - 1e-5, 46.5206 * Math.PI / 180 - 1e-5, 6.6326 * Math.PI / 180 + 1e-5, 46.5206 * Math.PI / 180 + 1e-5, 400, 500];
    const far = [0.15, 0.82, 0.151, 0.821, 400, 500];
    const files: Record<string, unknown> = {
      [SWISSBUILDINGS_ROOT]: { root: { boundingVolume: { region: [w - 1, s - 1, e + 1, n + 1, 0, 1] }, children: [{ boundingVolume: { region: [w, s, e, n, 0, 1] }, content: { uri: "v/tileset.json" } }] } },
      "https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/v/tileset.json": { root: { boundingVolume: { region: [w, s, e, n, 0, 1] }, children: [
        { boundingVolume: { region: far }, content: { uri: "11/1/1.b3dm" } },
        { boundingVolume: { region: near }, content: { uri: "11/2/2.b3dm" } },
        { boundingVolume: { region: near }, content: { uri: "https://evil.example/x.b3dm" } },
      ] } },
    };
    const asked: string[] = [];
    const list = await swissContents(46.5206, 6.6326, 400, async url => { asked.push(url); return files[url] ?? null; });
    assert.deepEqual(list.map(item => item.url), ["https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/v/11/2/2.b3dm"]);
    assert.equal(asked.length, 2);
    assert.equal(regionHits(far, radianBox(46.5206, 6.6326, 400)), false);
    assert.equal(safeTileUrl("../x.json", SWISSBUILDINGS_ROOT), "https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/x.json");
    assert.equal(safeTileUrl("http://3d.geo.admin.ch/x.json", SWISSBUILDINGS_ROOT), null);
  });

  it("calibrates heights on the relief with the median gap, and keeps one seam", () => {
    const b = (minY: number, cx: number) => ({ positions: [], colors: [], minY, cx, cz: 0 });
    const offset = heightOffset([b(52, 0), b(49, 10), b(51, 20), b(300, 30)], () => 0);
    assert.equal(offset, 51.5);
    assert.equal(heightOffset([], () => 0), null);
    assert.equal(keepSwiss({ cx: 100, cz: 100 }, 200), true);
    assert.equal(keepSwiss({ cx: 300, cz: 0 }, 200), false);
    assert.ok(swissRadius(true) < swissRadius(false));
    assert.ok(swissTileCap(true) < swissTileCap(false));
  });

  it("credits swisstopo for the buildings", () => {
    assert.match(attributionLine(["swissbuildings"]), /swissBUILDINGS3D © swisstopo/);
    assert.match(attributionLine(["swissbuildings"]), /^© contributeurs OpenStreetMap/);
  });

  it("ships the Draco decoder with the site, no CDN", () => {
    const engine = readFileSync(new URL("../src/components/app/reperage/engine.ts", import.meta.url), "utf8");
    assert.match(engine, /assetPath\("\/draco\/"\)/);
    assert.doesNotMatch(engine, /gstatic|unpkg|jsdelivr|googleapis/i);
    assert.ok(readFileSync(new URL("../public/draco/draco_decoder.wasm", import.meta.url)).length > 1000);
  });
});

describe("gestes à deux doigts", () => {
  const start = { a: { x: 100, y: 300 }, b: { x: 300, y: 300 } };

  it("stays still inside the dead zone", () => {
    const reading = readTwo(start, { x: 102, y: 303 }, { x: 298, y: 304 });
    assert.equal(classifyTwo(reading), "none");
  });

  it("reads a twist as rotate, not tilt", () => {
    // Rotate the pair by about 20° around its middle.
    const r = 100, c = { x: 200, y: 300 }, a = 20 * Math.PI / 180;
    const reading = readTwo(start, { x: c.x - r * Math.cos(a), y: c.y + r * Math.sin(a) }, { x: c.x + r * Math.cos(a), y: c.y - r * Math.sin(a) });
    assert.equal(classifyTwo(reading), "rotate");
    assert.ok(Math.abs(Math.abs(reading.twist) - 20) < 0.5);
  });

  it("reads both fingers moving up as tilt, not rotate", () => {
    const reading = readTwo(start, { x: 104, y: 260 }, { x: 302, y: 262 });
    assert.equal(classifyTwo(reading), "tilt");
    assert.ok(tiltFor(-40, 600) < 0, "dragging up lowers the camera toward the horizon");
  });

  it("reads a spread as zoom", () => {
    const reading = readTwo(start, { x: 70, y: 300 }, { x: 330, y: 300 });
    assert.equal(classifyTwo(reading), "zoom");
    assert.ok(reading.pinch > 1 + DEAD_ZONE.pinch);
  });

  it("does not take fingers moving apart vertically for a tilt", () => {
    const reading = readTwo(start, { x: 100, y: 330 }, { x: 300, y: 270 });
    assert.notEqual(classifyTwo(reading), "tilt");
  });
});


describe("Au sol massing colours", () => {
  it("gives OSM buildings distinct hues (not one flat beige)", () => {
    const a = osmMassingColor(12, 10, 20);
    const b = osmMassingColor(40, -30, 50);
    assert.notDeepEqual(a, b);
    for (const c of [...a, ...b]) assert.ok(c > 0.05 && c < 0.95);
  });

  it("keeps more saturation than the old grey wash", () => {
    const [r, g, b] = soberColor(0.9, 0.2, 0.2);
    assert.ok(r > g && r > b, "red stays dominant");
  });
});
