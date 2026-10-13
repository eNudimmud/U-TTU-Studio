import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateRawSync, deflateSync } from "node:zlib";
import { describe, it } from "node:test";
import { parseFichier } from "../src/lib/repere/fichier.ts";
import { fixtureQuartier } from "../src/lib/repere/fixture.ts";
import { LIEUX_EXEMPLE } from "../src/lib/repere/lieu.ts";
import { hostAllowed, isShortHost } from "../src/lib/repere/lien.ts";
import { decodePngRgba } from "../src/lib/repere/png.ts";
import { parseOverpass, parseQuartier, plafondBatiments, rayonFor, standsInStreet, terrariumMeters } from "../src/lib/repere/quartier.ts";
import { parseGeoJson, parseKml, parseSaisie } from "../src/lib/repere/saisie.ts";

describe("saisie d'un lieu", () => {
  it("reads a map link, an Earth heading, and a short link", () => {
    const maps = parseSaisie("https://www.google.com/maps/@48.8867,2.3431,17z");
    assert.equal(maps?.kind, "point");
    if (maps?.kind === "point") {
      assert.equal(maps.lat, 48.8867);
      assert.equal(maps.lon, 2.3431);
    }
    const pin = parseSaisie("https://www.google.com/maps/place/Montmartre/@48.88,2.34,17z/data=!3d48.8867!4d2.3431");
    assert.equal(pin?.kind, "point");
    if (pin?.kind === "point") {
      assert.equal(pin.lat, 48.8867);
      assert.equal(pin.lon, 2.3431);
      assert.equal(pin.name, "Montmartre");
    }
    const earth = parseSaisie("https://earth.google.com/web/@48.8867,2.3431,35a,500d,35y,90h,60t,0r");
    assert.equal(earth?.kind, "point");
    if (earth?.kind === "point") {
      assert.equal(earth.heading, 90);
      assert.equal(earth.tilt, 60);
    }
    const short = parseSaisie("https://maps.app.goo.gl/abc123");
    assert.equal(short?.kind, "short");
    assert.equal(isShortHost("maps.app.goo.gl"), true);
    assert.equal(hostAllowed("earth.google.com"), true);
    assert.equal(hostAllowed("evil.example"), false);
    assert.equal(hostAllowed("maps.google.com.evil.example"), false);
  });

  it("reads decimal pairs and degrees", () => {
    const pair = parseSaisie("48.8867, 2.3431");
    assert.equal(pair?.kind, "point");
    if (pair?.kind === "point") {
      assert.ok(Math.abs(pair.lat - 48.8867) < 0.0001);
      assert.ok(Math.abs(pair.lon - 2.3431) < 0.0001);
    }
    const dms = parseSaisie(`48°53'12.1"N 2°20'35.2"E`);
    assert.equal(dms?.kind, "point");
    if (dms?.kind === "point") {
      assert.ok(Math.abs(dms.lat - 48.8867) < 0.0002);
      assert.ok(Math.abs(dms.lon - 2.3431) < 0.0002);
    }
  });

  it("reads KML, GeoJSON and a KMZ", async () => {
    const kml = `<kml><Placemark><name>Montmartre</name><Point><coordinates>2.3431,48.8867,0</coordinates></Point></Placemark></kml>`;
    const fromKml = parseKml(kml);
    assert.equal(fromKml?.name, "Montmartre");
    assert.equal(fromKml?.lat, 48.8867);
    assert.equal(fromKml?.lon, 2.3431);
    const fromJson = parseGeoJson(JSON.stringify({ type: "Feature", properties: { name: "Shibuya" }, geometry: { type: "Point", coordinates: [139.7005, 35.6595] } }));
    assert.equal(fromJson?.name, "Shibuya");
    assert.equal(fromJson?.lon, 139.7005);
    const stored = await parseFichier("lieu.kmz", zip([{ name: "doc.kml", data: new TextEncoder().encode(kml), method: 0 }]));
    assert.equal(stored?.name, "Montmartre");
    const packed = await parseFichier("lieu.kmz", zip([{ name: "doc.kml", data: new TextEncoder().encode(kml), method: 8 }]));
    assert.equal(packed?.lat, 48.8867);
  });
});

describe("quartier", () => {
  it("keeps a smaller block on a phone and reads Overpass", () => {
    assert.ok(rayonFor(true, false) < rayonFor(false, false));
    assert.ok(rayonFor(true, true) < rayonFor(false, true));
    assert.ok(plafondBatiments(true) < plafondBatiments(false));
    assert.equal(terrariumMeters(128, 0, 0), 0);
    const block = parseOverpass({
      elements: [
        { type: "node", id: 1, lat: 48.8867, lon: 2.3431 },
        { type: "node", id: 2, lat: 48.8868, lon: 2.3431 },
        { type: "node", id: 3, lat: 48.8868, lon: 2.3433 },
        { type: "node", id: 4, lat: 48.8867, lon: 2.3433 },
        { type: "way", id: 10, nodes: [1, 2, 3, 4, 1], tags: { building: "yes", height: "12" } },
        { type: "node", id: 5, lat: 48.8867, lon: 2.3425 },
        { type: "node", id: 6, lat: 48.8867, lon: 2.3438 },
        { type: "way", id: 11, nodes: [5, 6], tags: { highway: "residential" } },
        { type: "relation", id: 99, tags: { building: "yes" } },
      ],
    }, 48.8867, 2.3431, 130, 120);
    assert.equal(block.buildings.length, 1);
    assert.equal(block.buildings[0]?.height, 12);
    assert.equal(block.streets.length, 1);
  });

  it("stands in the fixture street and round-trips the file", () => {
    const place = LIEUX_EXEMPLE[0];
    const block = fixtureQuartier(place, 90, 10);
    assert.equal(standsInStreet(block), true);
    assert.equal(block.buildings.length, 6);
    assert.ok(block.relief);
    const again = parseQuartier(JSON.stringify(block));
    assert.equal(again?.name, "Montmartre");
    assert.equal(again?.heading, 90);
    assert.equal(again?.buildings.length, 6);
    const png = tinyPng(128, 0, 0);
    const decoded = decodePngRgba(png);
    assert.equal(decoded?.width, 1);
    assert.equal(decoded?.rgba[0], 128);
  });

  it("keeps Overpass and Terrarium on the server, with a clear failure", () => {
    const route = readFileSync(new URL("../src/app/api/repere/route.ts", import.meta.url), "utf8");
    const hosts = readFileSync(new URL("../src/lib/repere/quartier.ts", import.meta.url), "utf8");
    assert.match(route, /OVERPASS/);
    assert.match(route, /TERRARIUM/);
    assert.match(hosts, /overpass-api\.de/);
    assert.match(hosts, /elevation-tiles-prod/);
    assert.match(route, /User-Agent/);
    assert.match(route, /429/);
    assert.match(route, /hostAllowed/);
    const client = readFileSync(new URL("../src/components/app/repere-carte.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(client, /overpass-api\.de|node:zlib|googleapis/);
    assert.match(client, /data-garder-lieu/);
    assert.match(client, /fixtureQuartier/);
  });
});

function tinyPng(red: number, green: number, blue: number): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, 1);
  view.setUint32(4, 1);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = deflateSync(Buffer.from([0, red, green, blue]));
  return concat([
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", new Uint8Array()),
  ]);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  new DataView(out.buffer).setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function zip(files: { name: string; data: Uint8Array; method: 0 | 8 }[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const stored = file.method === 8 ? new Uint8Array(deflateRawSync(file.data)) : file.data;
    const local = new Uint8Array(30 + name.length + stored.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(8, file.method, true);
    view.setUint32(18, stored.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(stored, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(10, file.method, true);
    centralView.setUint32(20, stored.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const end = new DataView(eocd.buffer);
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return concat([...locals, ...centrals, eocd]);
}
