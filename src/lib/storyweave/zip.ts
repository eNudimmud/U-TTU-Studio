// A stored (uncompressed) zip, so a group of vault files can be saved together
// without a third-party packer. Names are relative and contain no directories
// the browser would treat as absolute.

export interface ZipFile { name: string; data: Uint8Array }

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function safeName(name: string, index: number): string {
  const cleaned = name.replace(/\\/g, "/").split("/").pop()?.replace(/[^\w.\- ]+/g, "").trim() || `file-${index + 1}`;
  return cleaned.slice(0, 80);
}

/** One zip archive. Duplicate names get a numeric prefix. Empty input is an empty archive. */
export function zipStore(files: readonly ZipFile[]): Uint8Array {
  const used = new Set<string>();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  files.forEach((file, index) => {
    let name = safeName(file.name, index);
    if (used.has(name)) name = `${index + 1}-${name}`;
    used.add(name);
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + nameBytes.length + file.data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, file.data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(file.data, 30 + nameBytes.length);
    locals.push(local);
    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.data.length, true);
    centralView.setUint32(24, file.data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  });
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, cursor); cursor += part.length; }
  return out;
}

/** Names stored in a zip this module wrote. Used by tests. */
export function zipNames(archive: Uint8Array): string[] {
  const names: string[] = [];
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  let cursor = 0;
  while (cursor + 30 <= archive.length) {
    const sig = view.getUint32(cursor, true);
    if (sig !== 0x04034b50) break;
    const nameLen = view.getUint16(cursor + 26, true);
    const extra = view.getUint16(cursor + 28, true);
    const size = view.getUint32(cursor + 18, true);
    names.push(new TextDecoder().decode(archive.subarray(cursor + 30, cursor + 30 + nameLen)));
    cursor += 30 + nameLen + extra + size;
  }
  return names;
}
