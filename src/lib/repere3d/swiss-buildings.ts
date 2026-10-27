// swissBUILDINGS3D (swisstopo, OGD, « © swisstopo ») as plain triangles in the local frame.
// Pure helpers only: tileset walk, b3dm split, ECEF to the local frame, height calage.
// The glTF decoding (Draco) lives in the engine, loaded on demand.

import type { LocalFrame } from "./geo.ts";

/** Public 3D Tiles of swisstopo, the same ones map.geo.admin.ch shows. CORS open, no key. */
export const SWISSBUILDINGS_ROOT = "https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/tileset.json";
const HOST = "3d.geo.admin.ch";

/** Radius of real Swiss buildings around a place. Beyond it, OSM volumes take over. */
export function swissRadius(mobile: boolean): number {
  return mobile ? 360 : 560;
}

/** Most content tiles to fetch (about 12 KB each, Draco). */
export function swissTileCap(mobile: boolean): number {
  return mobile ? 70 : 160;
}

interface TileNode {
  boundingVolume?: { region?: number[] };
  content?: { uri?: string; url?: string };
  children?: TileNode[];
}

export interface SwissContent {
  url: string;
  /** Distance in metres from the place to the tile centre, for nearest-first loading. */
  distance: number;
}

/** A lon/lat box in radians around a place: west, south, east, north. */
export function radianBox(lat: number, lon: number, radius: number): [number, number, number, number] {
  const la = lat * Math.PI / 180;
  const lo = lon * Math.PI / 180;
  const dLat = radius / 6_371_000;
  const dLon = radius / (6_371_000 * Math.max(0.01, Math.cos(la)));
  return [lo - dLon, la - dLat, lo + dLon, la + dLat];
}

export function regionHits(region: readonly number[] | undefined, box: readonly number[]): boolean {
  if (!region || region.length < 4) return true;
  return !(region[2] < box[0] || region[0] > box[2] || region[3] < box[1] || region[1] > box[3]);
}

/** Only swisstopo's own host is followed: a tileset cannot send the browser anywhere else. */
export function safeTileUrl(uri: string, base: string): string | null {
  try {
    const url = new URL(uri, base);
    return url.protocol === "https:" && url.hostname === HOST ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Walks the tileset (and its external tilesets) and lists the content tiles that touch the circle.
 * `getJson` is injected so tests run offline and the engine can cache.
 */
export async function swissContents(lat: number, lon: number, radius: number, getJson: (url: string) => Promise<unknown>, cap = 160, root = SWISSBUILDINGS_ROOT): Promise<SwissContent[]> {
  const box = radianBox(lat, lon, radius);
  const la = lat * Math.PI / 180;
  const lo = lon * Math.PI / 180;
  const found: SwissContent[] = [];
  let budget = 24;
  const walk = async (node: TileNode, base: string): Promise<void> => {
    const region = node.boundingVolume?.region;
    if (!regionHits(region, box)) return;
    const uri = node.content?.uri ?? node.content?.url;
    if (uri) {
      const url = safeTileUrl(uri, base);
      if (url && /\.json(\?|$)/.test(url)) {
        if (budget-- <= 0) return;
        const sub = await getJson(url) as { root?: TileNode } | null;
        if (sub?.root) await walk(sub.root, url);
      } else if (url && /\.(b3dm|glb)(\?|$)/.test(url)) {
        const cLat = region ? (region[1] + region[3]) / 2 : la;
        const cLon = region ? (region[0] + region[2]) / 2 : lo;
        const distance = Math.hypot((cLat - la) * 6_371_000, (cLon - lo) * 6_371_000 * Math.cos(la));
        found.push({ url, distance });
      }
    }
    for (const child of node.children ?? []) await walk(child, base);
  };
  const top = await getJson(root) as { root?: TileNode } | null;
  if (!top?.root) return [];
  await walk(top.root, root);
  found.sort((a, b) => a.distance - b.distance);
  return found.slice(0, cap);
}

export interface B3dmParts {
  glb: ArrayBuffer;
  rtc: [number, number, number];
  batchLength: number;
}

/** Splits a b3dm (3D Tiles 1.0 batched model) into its glTF and its RTC centre. */
export function splitB3dm(bytes: ArrayBuffer): B3dmParts | null {
  if (bytes.byteLength < 28) return null;
  const view = new DataView(bytes);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic === "glTF") return { glb: bytes, rtc: [0, 0, 0], batchLength: 0 };
  if (magic !== "b3dm") return null;
  const total = view.getUint32(8, true);
  const ftJson = view.getUint32(12, true);
  const ftBin = view.getUint32(16, true);
  const btJson = view.getUint32(20, true);
  const btBin = view.getUint32(24, true);
  const start = 28 + ftJson + ftBin + btJson + btBin;
  if (start >= Math.min(total, bytes.byteLength)) return null;
  let rtc: [number, number, number] = [0, 0, 0];
  let batchLength = 0;
  try {
    const text = new TextDecoder().decode(new Uint8Array(bytes, 28, ftJson));
    const table = JSON.parse(text.trim() || "{}") as { RTC_CENTER?: number[]; BATCH_LENGTH?: number };
    if (Array.isArray(table.RTC_CENTER) && table.RTC_CENTER.length === 3) rtc = [table.RTC_CENTER[0], table.RTC_CENTER[1], table.RTC_CENTER[2]];
    batchLength = Number(table.BATCH_LENGTH) || 0;
  } catch { /* keep defaults */ }
  return { glb: bytes.slice(start, Math.min(total, bytes.byteLength)), rtc, batchLength };
}

const A = 6_378_137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const B = A * (1 - F);
const EP2 = (A * A - B * B) / (B * B);

/** WGS84 ECEF to latitude, longitude (degrees) and ellipsoidal height (metres). Bowring, sub-millimetre here. */
export function ecefToGeodetic(x: number, y: number, z: number): { lat: number; lon: number; h: number } {
  const p = Math.hypot(x, y);
  const theta = Math.atan2(z * A, p * B);
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const lat = Math.atan2(z + EP2 * B * st * st * st, p - E2 * A * ct * ct * ct);
  const lon = Math.atan2(y, x);
  const sl = Math.sin(lat);
  const n = A / Math.sqrt(1 - E2 * sl * sl);
  const h = p / Math.cos(lat) - n;
  return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI, h };
}

export function geodeticToEcef(lat: number, lon: number, h: number): [number, number, number] {
  const la = lat * Math.PI / 180;
  const lo = lon * Math.PI / 180;
  const sl = Math.sin(la);
  const n = A / Math.sqrt(1 - E2 * sl * sl);
  return [(n + h) * Math.cos(la) * Math.cos(lo), (n + h) * Math.cos(la) * Math.sin(lo), (n * (1 - E2) + h) * sl];
}

/**
 * glTF in 3D Tiles is Y-up; the tile is Z-up (ECEF). Then the RTC centre is added.
 * Returns the local frame position: x east, y ellipsoidal height, z south.
 */
export function gltfToLocal(px: number, py: number, pz: number, rtc: readonly number[], frame: LocalFrame): [number, number, number] {
  const ex = px + rtc[0];
  const ey = -pz + rtc[1];
  const ez = py + rtc[2];
  const g = ecefToGeodetic(ex, ey, ez);
  const p = frame.fromLonLat(g.lon, g.lat);
  return [p.x, g.h, p.z];
}

/** One building of a tile, after transformation: its triangles, its base and its centre. */
export interface SwissBuilding {
  positions: number[];
  colors: number[];
  minY: number;
  cx: number;
  cz: number;
}

/**
 * Ellipsoidal heights (swisstopo) and the Terrain Tiles relief disagree by the geoid (about 50 m here)
 * and by local error. The median gap between each building base and the relief under it calibrates once.
 */
export function heightOffset(buildings: readonly SwissBuilding[], ground: (x: number, z: number) => number): number | null {
  const gaps = buildings.map(b => b.minY - ground(b.cx, b.cz)).filter(Number.isFinite).sort((a, b) => a - b);
  if (gaps.length === 0) return null;
  const mid = gaps.length >> 1;
  return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}

const toSrgb = (c: number) => c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
const toLinear = (c: number) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

/**
 * Soften swisstopo's colours (linear in, linear out) so the look stays sober: saturated roofs get
 * deeper and closer to brick, light walls stay light, all lean a little toward a warm grey.
 */
/** Keep hue readable for « Au sol » volumes; only tame neon tile colours. */
export function soberColor(r: number, g: number, b: number): [number, number, number] {
  const c = [toSrgb(r), toSrgb(g), toSrgb(b)];
  const max = Math.max(...c);
  const min = Math.min(...c);
  const sat = max > 0 ? (max - min) / max : 0;
  // Soft clamp only — previous 50% desat + grey mix made every façade beige.
  const f = 1 - 0.2 * Math.max(0, sat - 0.55);
  const out = c.map(v => Math.max(0.12, Math.min(0.92, v * f)));
  return [toLinear(out[0]), toLinear(out[1]), toLinear(out[2])];
}

/** Varied OSM massing colours so « Au sol » is not one flat beige canyon. */
const OSM_PALETTE: readonly [number, number, number][] = [
  [0.78, 0.72, 0.62], // limestone
  [0.72, 0.58, 0.48], // brick
  [0.62, 0.64, 0.66], // concrete
  [0.70, 0.66, 0.58], // sandstone
  [0.58, 0.52, 0.46], // brownstone
  [0.76, 0.74, 0.70], // pale render
  [0.66, 0.60, 0.52], // terracotta tone
  [0.54, 0.56, 0.58], // slate grey
];

export function osmMassingColor(height: number, cx: number, cz: number): [number, number, number] {
  const h = Math.max(0, height);
  const n = Math.abs((Math.imul(Math.round(cx * 10), 374761393) ^ Math.imul(Math.round(cz * 10), 668265263) ^ Math.imul(Math.round(h), 982451653)) >>> 0);
  const [r, g, b] = OSM_PALETTE[n % OSM_PALETTE.length]!;
  const cool = Math.min(0.12, h / 400);
  return [toLinear(Math.max(0.1, r - cool)), toLinear(Math.max(0.1, g - cool * 0.6)), toLinear(Math.max(0.1, b + cool * 0.2))];
}

/** Swiss buildings inside the radius, OSM outside: one seam, no double walls. */
export function keepSwiss(b: { cx: number; cz: number }, radius: number): boolean {
  return Math.hypot(b.cx, b.cz) <= radius;
}
