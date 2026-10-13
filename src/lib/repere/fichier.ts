// KML, KMZ and GeoJSON stay in the browser. A short unzip, no extra package.

import { parseGeoJson, parseKml, type PointSaisie } from "./saisie.ts";

export async function parseFichier(name: string, bytes: Uint8Array): Promise<PointSaisie | null> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".kmz") || isZip(bytes)) {
    const xml = await unzipKml(bytes);
    return xml ? parseKml(xml) : null;
  }
  const text = new TextDecoder().decode(bytes);
  if (lower.endsWith(".json") || lower.endsWith(".geojson") || text.trim().startsWith("{")) return parseGeoJson(text);
  return parseKml(text);
}

export async function unzipKml(bytes: Uint8Array): Promise<string | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const start = Math.max(0, bytes.length - 66_000);
  for (let index = bytes.length - 22; index >= start; index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  for (let entry = 0; entry < count; entry += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) return null;
    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const local = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!name.toLowerCase().endsWith(".kml")) continue;
    if (local + 30 > bytes.length) return null;
    const localName = view.getUint16(local + 26, true);
    const localExtra = view.getUint16(local + 28, true);
    const dataStart = local + 30 + localName + localExtra;
    const data = bytes.subarray(dataStart, dataStart + compressed);
    const xml = method === 0 ? new TextDecoder().decode(data) : await inflate(data);
    return xml;
  }
  return null;
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

async function inflate(data: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream !== "function") return null;
  try {
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const text = await new Response(stream).text();
    return text;
  } catch {
    return null;
  }
}
