type Pixels = Uint8ClampedArray | Uint8Array;

export function toGray(rgba: Pixels, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  return gray;
}

// Variance of the Laplacian in the sharpest tile: a sharp subject on a soft background still scores high.
export function sharpness(gray: Float32Array, width: number, height: number, grid = 4): number {
  if (width < 3 || height < 3) return 0;
  const cells = grid * grid;
  const sum = new Float64Array(cells);
  const squares = new Float64Array(cells);
  const counts = new Uint32Array(cells);
  for (let y = 1; y < height - 1; y++) {
    const row = Math.min(grid - 1, Math.floor((y * grid) / height));
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const laplacian = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
      const cell = row * grid + Math.min(grid - 1, Math.floor((x * grid) / width));
      sum[cell] += laplacian;
      squares[cell] += laplacian * laplacian;
      counts[cell]++;
    }
  }
  let best = 0;
  for (let c = 0; c < cells; c++) {
    if (!counts[c]) continue;
    const mean = sum[c] / counts[c];
    best = Math.max(best, squares[c] / counts[c] - mean * mean);
  }
  return best;
}

export function colorStats(rgba: Pixels): { luma: number; saturation: number } {
  let luma = 0;
  let saturation = 0;
  const pixels = rgba.length / 4;
  for (let p = 0; p < rgba.length; p += 4) {
    const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
    luma += 0.299 * r + 0.587 * g + 0.114 * b;
    saturation += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  }
  return pixels ? { luma: luma / pixels, saturation: saturation / pixels } : { luma: 0, saturation: 0 };
}

function averageGrid(gray: Float32Array, width: number, height: number, columns: number, rows: number): number[][] {
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor((r * height) / rows), y1 = Math.max(y0 + 1, Math.floor(((r + 1) * height) / rows));
    const line: number[] = [];
    for (let c = 0; c < columns; c++) {
      const x0 = Math.floor((c * width) / columns), x1 = Math.max(x0 + 1, Math.floor(((c + 1) * width) / columns));
      let total = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) total += gray[y * width + x];
      line.push(total / ((y1 - y0) * (x1 - x0)));
    }
    grid.push(line);
  }
  return grid;
}

const bitsToHex = (bits: number[]) => {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) hex += ((bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3]).toString(16);
  return hex;
};

// 64-bit difference hash, plus the hash of the horizontally mirrored image to catch flipped copies.
export function dhash(gray: Float32Array, width: number, height: number): { hash: string; mirror: string } {
  const grid = averageGrid(gray, width, height, 9, 8);
  const direct: number[] = [];
  const mirrored: number[] = [];
  for (const row of grid) {
    for (let c = 0; c < 8; c++) {
      direct.push(row[c] < row[c + 1] ? 1 : 0);
      mirrored.push(row[8 - c] < row[7 - c] ? 1 : 0);
    }
  }
  return { hash: bitsToHex(direct), mirror: bitsToHex(mirrored) };
}

export function hamming(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { distance += x & 1; x >>= 1; }
  }
  return distance;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export const medianAbsoluteDeviation = (values: number[], center = median(values)) => median(values.map(value => Math.abs(value - center)));
