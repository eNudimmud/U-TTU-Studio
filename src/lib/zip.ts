export interface ZipEntry { name: string; data: Uint8Array }

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    day: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

// Stored (uncompressed) entries: JPEGs are already compressed, and this keeps the writer dependency-free.
export function createZip(entries: ZipEntry[], date = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(date);
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x0800, true);
    l.setUint16(8, 0, true);
    l.setUint16(10, time, true);
    l.setUint16(12, day, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, size, true);
    l.setUint32(22, size, true);
    l.setUint16(26, name.length, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, time, true);
    c.setUint16(14, day, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, size, true);
    c.setUint32(24, size, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.set(name, 46);

    parts.push(local, entry.data);
    directory.push(central);
    offset += local.length + size;
  }

  const directorySize = directory.reduce((total, item) => total + item.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, directorySize, true);
  e.setUint32(16, offset, true);

  const archive = new Uint8Array(offset + directorySize + end.length);
  let cursor = 0;
  for (const part of [...parts, ...directory, end]) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  return archive;
}

export interface ReadZipOptions {
  inflateRaw?: (data: Uint8Array) => Uint8Array;
  // A JS CRC over ~10 MB of JPEG overruns the 10 ms CPU budget of a free Cloudflare Worker.
  verifyCrc?: boolean;
}

// Reads what createZip writes (stored entries). Deflated entries need an inflater (zlib in Node). No ZIP64, no encryption.
// Stored entries are views on `archive`, not copies.
export function readZip(archive: Uint8Array, { inflateRaw, verifyCrc = true }: ReadZipOptions = {}): ZipEntry[] {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  let end = -1;
  for (let i = archive.length - 22; i >= Math.max(0, archive.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("ZIP illisible : fin d’archive introuvable.");
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let cursor = view.getUint32(end + 16, true);
  for (let n = view.getUint16(end + 10, true); n > 0; n--) {
    if (cursor + 46 > archive.length || view.getUint32(cursor, true) !== 0x02014b50) throw new Error("ZIP illisible : répertoire central abîmé.");
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const packed = view.getUint32(cursor + 20, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const local = view.getUint32(cursor + 42, true);
    const name = decoder.decode(archive.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
    if (flags & 1) throw new Error(`ZIP chiffré : ${name}.`);
    if (local + 30 > archive.length || view.getUint32(local, true) !== 0x04034b50) throw new Error(`ZIP illisible : en-tête de ${name} introuvable.`);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = archive.subarray(start, start + packed);
    if (raw.length !== packed) throw new Error(`ZIP tronqué : ${name}.`);
    let data: Uint8Array;
    if (method === 0) data = raw;
    else if (method === 8 && inflateRaw) data = inflateRaw(raw);
    else throw new Error(`${name} : compression non prise en charge (méthode ${method}).`);
    if (data.length !== size || (verifyCrc && crc32(data) !== crc)) throw new Error(`${name} : contenu abîmé (CRC).`);
    entries.push({ name, data });
  }
  return entries;
}
