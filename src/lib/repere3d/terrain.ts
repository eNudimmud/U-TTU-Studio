// Terrain Tiles (Terrarium PNG, AWS Open Data) to a height sampler in local metres.

import { tileOrigin, tileSize, terrariumHeight, type LocalFrame, type TileId } from "./geo.ts";

export const TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export function terrariumUrl(tile: TileId): string {
  return TERRARIUM.replace("{z}", String(tile.z)).replace("{x}", String(tile.x)).replace("{y}", String(tile.y));
}

export interface HeightTile { tile: TileId; size: number; heights: Float32Array }

export function decodeTerrarium(tile: TileId, rgba: Uint8ClampedArray | Uint8Array, size: number): HeightTile {
  const heights = new Float32Array(size * size);
  for (let i = 0; i < size * size; i += 1) heights[i] = terrariumHeight(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
  return { tile, size, heights };
}

/** Bilinear height in metres at a local point. Unknown ground is the fallback. */
export function makeSampler(tiles: HeightTile[], frame: LocalFrame, fallback = 0): (x: number, z: number) => number {
  if (tiles.length === 0) return () => fallback;
  const z0 = tiles[0].tile.z;
  const size = tileSize(z0);
  const index = new Map(tiles.map(item => [`${item.tile.x}/${item.tile.y}`, item]));
  const mx0 = tileOrigin({ z: 0, x: 0, y: 0 }).x;
  const my0 = tileOrigin({ z: 0, x: 0, y: 0 }).y;
  return (x, z) => {
    const ll = frame.toLonLat(x, z);
    const mx = ll.lon * Math.PI / 180 * 6378137;
    const my = Math.log(Math.tan(Math.PI / 4 + ll.lat * Math.PI / 360)) * 6378137;
    const fx = (mx - mx0) / size;
    const fy = (my0 - my) / size;
    const tx = Math.floor(fx);
    const ty = Math.floor(fy);
    const hit = index.get(`${tx}/${ty}`);
    if (!hit) return fallback;
    const px = (fx - tx) * hit.size - .5;
    const py = (fy - ty) * hit.size - .5;
    const x0 = Math.max(0, Math.min(hit.size - 1, Math.floor(px)));
    const y0 = Math.max(0, Math.min(hit.size - 1, Math.floor(py)));
    const x1 = Math.min(hit.size - 1, x0 + 1);
    const y1 = Math.min(hit.size - 1, y0 + 1);
    const ax = Math.max(0, Math.min(1, px - x0));
    const ay = Math.max(0, Math.min(1, py - y0));
    const h = (xx: number, yy: number) => hit.heights[yy * hit.size + xx];
    const top = h(x0, y0) * (1 - ax) + h(x1, y0) * ax;
    const bottom = h(x0, y1) * (1 - ax) + h(x1, y1) * ax;
    const value = top * (1 - ay) + bottom * ay;
    return Number.isFinite(value) && value > -1000 ? value : fallback;
  };
}
