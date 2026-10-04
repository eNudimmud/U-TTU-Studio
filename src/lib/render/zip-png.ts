// The first PNG inside a ZIP. Farpy returns the Cycles still in a ZIP.
// Stored and deflate entries are read from the central directory, so a
// data descriptor after the bytes does not shift the next file.

/** PNG bytes, or null when the archive holds none. A bare PNG is returned as itself. */
export async function pngFromZip(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return bytes.subarray(0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocd(bytes, view);
  if (eocd === null) return null;
  let cursor = view.getUint32(eocd + 16, true);
  const count = view.getUint16(eocd + 10, true);
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) return null;
    const method = view.getUint16(cursor + 10, true);
    const size = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const local = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!name.toLowerCase().endsWith(".png")) continue;
    if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) return null;
    const data = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (data + size > bytes.length) return null;
    const compressed = bytes.subarray(data, data + size);
    if (method === 0) return compressed;
    if (method === 8) return inflate(compressed);
    return null;
  }
  return null;
}

function findEocd(bytes: Uint8Array, view: DataView): number | null {
  const start = Math.max(0, bytes.length - 22 - 65535);
  for (let offset = bytes.length - 22; offset >= start; offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return null;
}

async function inflate(compressed: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(compressed)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
