// Tile maths and a local metric frame. Pure functions, no network.
// Web Mercator in metres, scaled by cos(latitude) at the centre so one unit is about one metre.

export const EARTH_R = 6378137;
export const BUILDING_Z = 14;
export const DEM_Z = 13;
export const SWISS_Z = 16;

export interface TileId { z: number; x: number; y: number }

export function mercX(lon: number): number {
  return EARTH_R * lon * Math.PI / 180;
}

export function mercY(lat: number): number {
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  return EARTH_R * Math.log(Math.tan(Math.PI / 4 + clamped * Math.PI / 360));
}

export function lonOf(x: number): number {
  return x / EARTH_R * 180 / Math.PI;
}

export function latOf(y: number): number {
  return (2 * Math.atan(Math.exp(y / EARTH_R)) - Math.PI / 2) * 180 / Math.PI;
}

const WORLD = 2 * Math.PI * EARTH_R;

/** Fractional tile coordinates of a point. */
export function tileXY(lon: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  return { x: (mercX(lon) + WORLD / 2) / WORLD * n, y: (WORLD / 2 - mercY(lat)) / WORLD * n };
}

/** Mercator metres of a tile corner (top-left). */
export function tileOrigin(tile: TileId): { x: number; y: number } {
  const size = WORLD / 2 ** tile.z;
  return { x: tile.x * size - WORLD / 2, y: WORLD / 2 - tile.y * size };
}

export function tileSize(z: number): number {
  return WORLD / 2 ** z;
}

/** Every tile at zoom z that touches a square of radius metres around the point. */
export function tilesAround(lon: number, lat: number, radius: number, z: number, max = 9): TileId[] {
  const k = Math.cos(lat * Math.PI / 180) || 1;
  const merc = radius / k;
  const size = tileSize(z);
  const cx = mercX(lon) + WORLD / 2;
  const cy = WORLD / 2 - mercY(lat);
  const n = 2 ** z;
  const x0 = Math.floor((cx - merc) / size);
  const x1 = Math.floor((cx + merc) / size);
  const y0 = Math.max(0, Math.floor((cy - merc) / size));
  const y1 = Math.min(n - 1, Math.floor((cy + merc) / size));
  const out: TileId[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) out.push({ z, x: ((x % n) + n) % n, y });
  }
  const centre = tileXY(lon, lat, z);
  out.sort((a, b) => Math.hypot(a.x + .5 - centre.x, a.y + .5 - centre.y) - Math.hypot(b.x + .5 - centre.x, b.y + .5 - centre.y));
  return out.slice(0, max);
}

/** A local frame centred on a place. x east, z south (three.js), metres. */
export class LocalFrame {
  readonly lat: number;
  readonly lon: number;
  readonly k: number;
  private readonly mx: number;
  private readonly my: number;
  constructor(lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
    this.k = Math.cos(lat * Math.PI / 180);
    this.mx = mercX(lon);
    this.my = mercY(lat);
  }
  fromMerc(x: number, y: number): { x: number; z: number } {
    return { x: (x - this.mx) * this.k, z: -(y - this.my) * this.k };
  }
  fromLonLat(lon: number, lat: number): { x: number; z: number } {
    return this.fromMerc(mercX(lon), mercY(lat));
  }
  toLonLat(x: number, z: number): { lon: number; lat: number } {
    return { lon: lonOf(this.mx + x / this.k), lat: latOf(this.my - z / this.k) };
  }
  /** Tile pixel (vector tile extent units) to local metres. */
  fromTile(tile: TileId, px: number, py: number, extent: number): { x: number; z: number } {
    const origin = tileOrigin(tile);
    const size = tileSize(tile.z);
    return this.fromMerc(origin.x + px / extent * size, origin.y - py / extent * size);
  }
}

/** Heading in degrees (0 north, 90 east) of a direction in the local frame. */
export function headingOf(dx: number, dz: number): number {
  const deg = Math.atan2(dx, -dz) * 180 / Math.PI;
  return Math.round(((deg % 360) + 360) % 360 * 10) / 10;
}

/** Terrarium PNG pixel to metres. */
export function terrariumHeight(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/** Rough Swiss bounding test, then a coarse outline so Lyon or Milan stay out. */
export function inSwitzerland(lat: number, lon: number): boolean {
  if (lat < 45.81 || lat > 47.81 || lon < 5.95 || lon > 10.5) return false;
  let inside = false;
  for (let i = 0, j = SWISS.length - 1; i < SWISS.length; j = i, i += 1) {
    const [yi, xi] = SWISS[i];
    const [yj, xj] = SWISS[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// lat, lon. A coarse hull of the Swiss border, enough to pick a data source, not for law.
const SWISS: readonly [number, number][] = [
  [46.13, 5.95], [46.45, 6.08], [46.6, 6.12], [46.9, 6.44], [47.06, 6.7], [47.28, 7.0], [47.47, 6.94],
  [47.5, 7.2], [47.43, 7.55], [47.6, 7.59], [47.58, 8.0], [47.55, 8.4], [47.81, 8.55], [47.7, 8.9],
  [47.65, 9.18], [47.53, 9.56], [47.26, 9.6], [47.06, 9.48], [46.98, 9.88], [46.87, 10.15], [46.88, 10.47],
  [46.55, 10.47], [46.6, 10.1], [46.3, 10.16], [46.4, 9.9], [46.29, 9.47], [46.05, 9.28], [45.82, 9.03],
  [45.95, 8.8], [46.1, 8.6], [46.3, 8.45], [46.0, 8.13], [45.91, 7.88], [45.92, 7.55], [45.86, 7.05],
  [46.05, 6.8], [46.4, 6.78], [46.37, 6.25], [46.24, 6.29], [46.18, 6.2], [46.13, 6.07],
];
