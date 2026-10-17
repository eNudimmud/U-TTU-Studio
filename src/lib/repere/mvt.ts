// Minimal Mapbox Vector Tile reader: point features of one layer, with their
// properties, in longitude/latitude. Enough for Mapillary's coverage tiles
// (layer "image"); no dependency, no network.

export interface TilePoint {
  id: string;
  lat: number;
  lon: number;
  props: Record<string, string | number | boolean>;
}

class Reader {
  pos = 0;
  readonly buf: Uint8Array;
  readonly end: number;
  constructor(buf: Uint8Array) { this.buf = buf; this.end = buf.length; }
  varint(): number {
    let result = 0;
    let scale = 1;
    for (let i = 0; i < 10; i++) {
      if (this.pos >= this.end) throw new Error("mvt: truncated varint");
      const byte = this.buf[this.pos++];
      result += (byte & 0x7f) * scale;
      if (byte < 0x80) return result;
      scale *= 128;
    }
    throw new Error("mvt: bad varint");
  }
  bytes(): Uint8Array {
    const length = this.varint();
    const start = this.pos;
    this.pos += length;
    if (this.pos > this.end) throw new Error("mvt: truncated field");
    return this.buf.subarray(start, this.pos);
  }
  skip(wire: number): void {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) this.pos += this.varint();
    else if (wire === 5) this.pos += 4;
    else throw new Error(`mvt: wire type ${wire}`);
  }
}

const text = new TextDecoder();
const zigzag = (n: number) => (n % 2 === 0 ? n / 2 : -(n + 1) / 2);

function packed(bytes: Uint8Array): number[] {
  const reader = new Reader(bytes);
  const out: number[] = [];
  while (reader.pos < reader.end) out.push(reader.varint());
  return out;
}

function value(bytes: Uint8Array): string | number | boolean {
  const reader = new Reader(bytes);
  let out: string | number | boolean = "";
  while (reader.pos < reader.end) {
    const tag = reader.varint();
    const field = tag >> 3, wire = tag & 7;
    if (field === 1 && wire === 2) out = text.decode(reader.bytes());
    else if (field === 2 && wire === 5) { out = new DataView(bytes.buffer, bytes.byteOffset + reader.pos, 4).getFloat32(0, true); reader.pos += 4; }
    else if (field === 3 && wire === 1) { out = new DataView(bytes.buffer, bytes.byteOffset + reader.pos, 8).getFloat64(0, true); reader.pos += 8; }
    else if ((field === 4 || field === 5) && wire === 0) out = reader.varint();
    else if (field === 6 && wire === 0) out = zigzag(reader.varint());
    else if (field === 7 && wire === 0) out = reader.varint() !== 0;
    else reader.skip(wire);
  }
  return out;
}

/** Tile x/y (at zoom z) of a point. */
export function tileOf(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
}

function toLonLat(z: number, tx: number, ty: number, px: number, py: number, extent: number): { lat: number; lon: number } {
  const n = 2 ** z;
  const lon = ((tx + px / extent) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + py / extent)) / n))) * 180) / Math.PI;
  return { lat, lon };
}

/** Point features of `layerName` in a decoded (not gzipped) tile. */
export function readTilePoints(buf: Uint8Array, layerName: string, z: number, x: number, y: number): TilePoint[] {
  const tile = new Reader(buf);
  const points: TilePoint[] = [];
  while (tile.pos < tile.end) {
    const tag = tile.varint();
    if (tag >> 3 !== 3 || (tag & 7) !== 2) { tile.skip(tag & 7); continue; }
    const layer = new Reader(tile.bytes());
    let name = "";
    let extent = 4096;
    const keys: string[] = [];
    const values: (string | number | boolean)[] = [];
    const features: Uint8Array[] = [];
    while (layer.pos < layer.end) {
      const ltag = layer.varint();
      const field = ltag >> 3, wire = ltag & 7;
      if (field === 1 && wire === 2) name = text.decode(layer.bytes());
      else if (field === 2 && wire === 2) features.push(layer.bytes());
      else if (field === 3 && wire === 2) keys.push(text.decode(layer.bytes()));
      else if (field === 4 && wire === 2) values.push(value(layer.bytes()));
      else if (field === 5 && wire === 0) extent = layer.varint() || 4096;
      else layer.skip(wire);
    }
    if (name !== layerName) continue;
    for (const bytes of features) {
      const feature = new Reader(bytes);
      let id = "";
      let type = 0;
      let tags: number[] = [];
      let geometry: number[] = [];
      while (feature.pos < feature.end) {
        const ftag = feature.varint();
        const field = ftag >> 3, wire = ftag & 7;
        if (field === 1 && wire === 0) id = String(feature.varint());
        else if (field === 2 && wire === 2) tags = packed(feature.bytes());
        else if (field === 3 && wire === 0) type = feature.varint();
        else if (field === 4 && wire === 2) geometry = packed(feature.bytes());
        else feature.skip(wire);
      }
      // Point, first MoveTo only.
      if (type !== 1 || geometry.length < 3 || (geometry[0] & 7) !== 1) continue;
      const props: Record<string, string | number | boolean> = {};
      for (let i = 0; i + 1 < tags.length; i += 2) {
        const key = keys[tags[i]];
        if (key !== undefined && values[tags[i + 1]] !== undefined) props[key] = values[tags[i + 1]];
      }
      const where = toLonLat(z, x, y, zigzag(geometry[1]), zigzag(geometry[2]), extent);
      points.push({ id: props.id !== undefined ? String(props.id) : id, ...where, props });
    }
  }
  return points;
}

/** Gunzips when the bytes are still gzip (some CDNs skip Content-Encoding). */
export async function maybeGunzip(buf: Uint8Array): Promise<Uint8Array> {
  if (buf.length < 2 || buf[0] !== 0x1f || buf[1] !== 0x8b || typeof DecompressionStream === "undefined") return buf;
  const stream = new Blob([buf as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
