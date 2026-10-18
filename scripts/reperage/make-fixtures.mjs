// Synthetic, licence-free fixtures for the 3D repérage tests (no OSM data inside).
// node scripts/reperage/make-fixtures.mjs → e2e/fixtures/reperage-tile.pbf, reperage-terrain.png
import { PbfWriter } from "pbf";
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const EXTENT = 4096;
const zig = n => (n << 1) ^ (n >> 31);

function geometry(rings, close) {
  const out = [];
  let cx = 0, cy = 0;
  for (const ring of rings) {
    const pts = close ? ring.slice(0, -1) : ring;
    out.push((1 & 7) | (1 << 3), zig(pts[0][0] - cx), zig(pts[0][1] - cy));
    cx = pts[0][0]; cy = pts[0][1];
    out.push((2 & 7) | ((pts.length - 1) << 3));
    for (const [x, y] of pts.slice(1)) { out.push(zig(x - cx), zig(y - cy)); cx = x; cy = y; }
    if (close) out.push(15);
  }
  return out;
}

function layer(name, features) {
  const keys = [];
  const values = [];
  const key = k => { let i = keys.indexOf(k); if (i < 0) { keys.push(k); i = keys.length - 1; } return i; };
  const value = v => { let i = values.findIndex(x => x === v); if (i < 0) { values.push(v); i = values.length - 1; } return i; };
  const encoded = features.map(f => ({ ...f, tags: Object.entries(f.props).flatMap(([k, v]) => [key(k), value(v)]) }));
  return (_, pbf) => {
    pbf.writeVarintField(15, 2);
    pbf.writeStringField(1, name);
    for (const f of encoded) pbf.writeMessage(2, (feature, p) => {
      p.writePackedVarint(2, feature.tags);
      p.writeVarintField(3, feature.type);
      p.writePackedVarint(4, feature.geom);
    }, f);
    for (const k of keys) pbf.writeStringField(3, k);
    for (const v of values) pbf.writeMessage(4, (val, p) => typeof val === "string" ? p.writeStringField(1, val) : p.writeDoubleField(3, val), v);
    pbf.writeVarintField(5, EXTENT);
  };
}

// Clockwise in tile space (y down) is the MVT outer ring: positive signed area as computed by the decoder.
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
const buildings = [];
for (let i = 0; i < 6; i += 1) for (let j = 0; j < 6; j += 1) {
  if (i === 2 || j === 3) continue; // streets
  buildings.push({ type: 3, props: { render_height: 8 + ((i * 7 + j * 5) % 6) * 6, render_min_height: 0 }, geom: geometry([rect(1500 + i * 190, 1500 + j * 190, 150, 150)], true) });
}
// One building cut by the tile edge, to exercise clipping.
buildings.push({ type: 3, props: { render_height: 12, render_min_height: 0 }, geom: geometry([rect(4000, 2000, 300, 200)], true) });
const roads = [
  { type: 2, props: { class: "primary" }, geom: geometry([[[0, 2135], [4096, 2135]]], false) },
  { type: 2, props: { class: "minor" }, geom: geometry([[[2075, 0], [2075, 4096]]], false) },
  { type: 2, props: { class: "path" }, geom: geometry([[[1400, 1400], [2700, 2700]]], false) },
];
const park = [{ type: 3, props: { class: "park" }, geom: geometry([rect(2700, 2700, 500, 400)], true) }];

const pbf = new PbfWriter();
for (const [name, list] of [["building", buildings], ["transportation", roads], ["park", park]]) pbf.writeMessage(3, layer(name, list), null);
writeFileSync("e2e/fixtures/reperage-tile.pbf", pbf.finish());

// Flat Terrarium PNG at 420 m: v = h + 32768 → R = v >> 8, G = v & 255, B = 0.
function png(width, height, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) raw.set(rgb, y * (width * 3 + 1) + 1 + x * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const v = 420 + 32768;
writeFileSync("e2e/fixtures/reperage-terrain.png", png(256, 256, [v >> 8, v & 255, 0]));
console.log("fixtures written");
