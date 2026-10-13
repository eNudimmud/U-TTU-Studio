// Terrarium tiles are ordinary PNG files. Read on the server, where the browser cannot set a User-Agent.

import { inflateSync } from "node:zlib";

export function decodePngRgba(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 8 || signature.some((value, index) => bytes[index] !== value)) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let color = 0;
  let interlace = 0;
  const parts: Uint8Array[] = [];
  while (offset + 12 <= bytes.length) {
    const length = readU32(bytes, offset);
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    if (offset + 12 + length > bytes.length) return null;
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = readU32(data, 0);
      height = readU32(data, 4);
      depth = data[8] ?? 0;
      color = data[9] ?? 0;
      interlace = data[12] ?? 1;
    } else if (type === "IDAT") parts.push(data);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (depth !== 8 || interlace !== 0 || (color !== 2 && color !== 6) || width < 1 || height < 1 || width > 2048 || height > 2048) return null;
  const channels = color === 2 ? 3 : 4;
  const raw = inflateSync(Buffer.concat(parts.map(part => Buffer.from(part))));
  const stride = width * channels;
  const rgba = new Uint8Array(width * height * 4);
  let src = 0;
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[src] ?? 255;
    src += 1;
    if (src + stride > raw.length || filter > 4) return null;
    const row = raw.subarray(src, src + stride);
    src += stride;
    const out = new Uint8Array(stride);
    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? out[index - channels] : 0;
      const up = prev[index] ?? 0;
      const upperLeft = index >= channels ? prev[index - channels] ?? 0 : 0;
      const value = row[index] ?? 0;
      if (filter === 0) out[index] = value;
      else if (filter === 1) out[index] = (value + left) & 255;
      else if (filter === 2) out[index] = (value + up) & 255;
      else if (filter === 3) out[index] = (value + Math.floor((left + up) / 2)) & 255;
      else out[index] = (value + paeth(left, up, upperLeft)) & 255;
    }
    prev = out;
    for (let x = 0; x < width; x += 1) {
      const i = x * channels;
      const o = (y * width + x) * 4;
      rgba[o] = out[i] ?? 0;
      rgba[o + 1] = out[i + 1] ?? 0;
      rgba[o + 2] = out[i + 2] ?? 0;
      rgba[o + 3] = channels === 4 ? out[i + 3] ?? 255 : 255;
    }
  }
  return { width, height, rgba };
}

function readU32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 24) | ((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
}

function paeth(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const dl = Math.abs(estimate - left);
  const du = Math.abs(estimate - up);
  const dc = Math.abs(estimate - upperLeft);
  if (dl <= du && dl <= dc) return left;
  if (du <= dc) return up;
  return upperLeft;
}
