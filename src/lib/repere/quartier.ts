// A city block in local meters. East is +x, south is +z, up is left to the view.

export interface Batiment {
  ring: [number, number][];
  height: number;
}

export interface Rue {
  points: [number, number][];
  width: number;
}

export interface Relief {
  n: number;
  span: number;
  samples: number[];
}

export interface Quartier {
  name: string;
  lat: number;
  lon: number;
  heading: number;
  tilt: number;
  stand: { x: number; z: number };
  buildings: Batiment[];
  streets: Rue[];
  relief: Relief | null;
  /** Where the footprints came from. Streets stay OpenStreetMap. */
  source: "overture" | "osm";
}

export const OVERPASS = "https://overpass-api.de/api/interpreter";
export const TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";

export function rayonFor(mobile: boolean, autour: boolean): number {
  if (mobile) return autour ? 110 : 70;
  return autour ? 200 : 130;
}

export function plafondBatiments(mobile: boolean): number {
  return mobile ? 36 : 120;
}

export function overpassQuery(lat: number, lon: number, rayon: number): string {
  const radius = Math.round(Math.min(250, Math.max(40, rayon)));
  return `[out:json][timeout:20];(way["building"](around:${radius},${lat},${lon});way["highway"](around:${radius},${lat},${lon}););out body;>;out skel qt;`;
}

export function toLocal(lat: number, lon: number, originLat: number, originLon: number): [number, number] {
  const x = (lon - originLon) * Math.cos((originLat * Math.PI) / 180) * 111_320;
  const z = -(lat - originLat) * 110_540;
  return [Math.round(x * 100) / 100, Math.round(z * 100) / 100];
}

export function terrariumMeters(red: number, green: number, blue: number): number {
  return red * 256 + green + blue / 256 - 32768;
}

interface OsmNode { type?: string; id?: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string> }

export function parseOverpass(payload: unknown, originLat: number, originLon: number, rayon: number, cap: number): { buildings: Batiment[]; streets: Rue[] } {
  const elements = payload && typeof payload === "object" && Array.isArray((payload as { elements?: unknown }).elements)
    ? (payload as { elements: OsmNode[] }).elements
    : [];
  const nodes = new Map<number, [number, number]>();
  for (const item of elements) {
    if (item.type === "node" && typeof item.id === "number" && typeof item.lat === "number" && typeof item.lon === "number") {
      nodes.set(item.id, toLocal(item.lat, item.lon, originLat, originLon));
    }
  }
  const buildings: Batiment[] = [];
  const streets: Rue[] = [];
  for (const item of elements) {
    if (item.type !== "way" || !item.nodes || !item.tags) continue;
    const ring = item.nodes.flatMap(id => {
      const point = nodes.get(id);
      return point ? [point] : [];
    });
    if (ring.length < 2) continue;
    const [cx, cz] = centroid(ring);
    if (Math.hypot(cx, cz) > rayon * 1.15) continue;
    if (item.tags.building) {
      if (ring.length < 4 || buildings.length >= cap) continue;
      buildings.push({ ring: simplify(ring, 28), height: heightOf(item.tags) });
    } else if (item.tags.highway) {
      streets.push({ points: simplify(ring, 40), width: widthOf(item.tags) });
    }
  }
  return { buildings, streets };
}

export function streetStand(streets: readonly Rue[]): { x: number; z: number } {
  let best = 0;
  let stand = { x: 0, z: 0 };
  for (const street of streets) {
    for (let index = 0; index < street.points.length - 1; index += 1) {
      const [ax, az] = street.points[index];
      const [bx, bz] = street.points[index + 1];
      const length = Math.hypot(bx - ax, bz - az);
      if (length > best) {
        best = length;
        stand = { x: (ax + bx) / 2, z: (az + bz) / 2 };
      }
    }
  }
  return { x: Math.round(stand.x * 100) / 100, z: Math.round(stand.z * 100) / 100 };
}

export function snapToStreet(quartier: Quartier, x: number, z: number): { x: number; z: number } {
  let best = quartier.stand;
  let distance = 40;
  for (const street of quartier.streets) {
    for (let index = 0; index < street.points.length - 1; index += 1) {
      const point = closest(street.points[index], street.points[index + 1], x, z);
      const gap = Math.hypot(point.x - x, point.z - z);
      if (gap < distance) {
        distance = gap;
        best = point;
      }
    }
  }
  return { x: Math.round(best.x * 100) / 100, z: Math.round(best.z * 100) / 100 };
}

export function standsInStreet(quartier: Quartier): boolean {
  const snapped = snapToStreet(quartier, quartier.stand.x, quartier.stand.z);
  return Math.hypot(snapped.x - quartier.stand.x, snapped.z - quartier.stand.z) < 1;
}

export function sampleRelief(relief: Relief | null, x: number, z: number): number {
  if (!relief || relief.n < 2 || relief.samples.length < relief.n * relief.n) return 0;
  const n = relief.n;
  const i = Math.max(0, Math.min(n - 1, Math.round((x / relief.span + 0.5) * (n - 1))));
  const j = Math.max(0, Math.min(n - 1, Math.round((z / relief.span + 0.5) * (n - 1))));
  const value = relief.samples[j * n + i];
  return Number.isFinite(value) ? value : 0;
}

export function tileOf(lat: number, lon: number, zoom: number): { x: number; y: number; z: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n);
  return { x, y, z: zoom };
}

export function reliefFromRgba(rgba: Uint8Array, width: number, height: number, lat: number, lon: number, span: number, n: number): Relief | null {
  if (width < 2 || height < 2 || rgba.length < width * height * 4 || n < 2) return null;
  const tile = tileOf(lat, lon, 14);
  const samples: number[] = [];
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const east = (i / (n - 1) - 0.5) * span;
      const south = (j / (n - 1) - 0.5) * span;
      const pointLat = lat - south / 110_540;
      const pointLon = lon + east / (111_320 * Math.cos((lat * Math.PI) / 180));
      const pixel = pixelOf(pointLat, pointLon, tile, width, height);
      const index = (pixel.y * width + pixel.x) * 4;
      samples.push(terrariumMeters(rgba[index] ?? 0, rgba[index + 1] ?? 0, rgba[index + 2] ?? 0));
    }
  }
  const center = samples[Math.floor(n / 2) * n + Math.floor(n / 2)] ?? 0;
  return { n, span, samples: samples.map(value => Math.round((value - center) * 10) / 10) };
}

export function parseQuartier(raw: string): Quartier | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const row = data as Partial<Quartier>;
  if (typeof row.lat !== "number" || typeof row.lon !== "number" || !Array.isArray(row.buildings) || !Array.isArray(row.streets)) return null;
  return {
    name: typeof row.name === "string" ? row.name.slice(0, 80) : "Lieu",
    lat: row.lat,
    lon: row.lon,
    heading: typeof row.heading === "number" ? row.heading : 0,
    tilt: typeof row.tilt === "number" ? row.tilt : 0,
    stand: row.stand && typeof row.stand.x === "number" && typeof row.stand.z === "number" ? row.stand : { x: 0, z: 0 },
    buildings: row.buildings.filter(item => Array.isArray(item?.ring) && typeof item.height === "number").slice(0, 160),
    streets: row.streets.filter(item => Array.isArray(item?.points)).slice(0, 80),
    relief: row.relief && typeof row.relief.n === "number" && Array.isArray(row.relief.samples) ? row.relief : null,
    source: row.source === "overture" ? "overture" : "osm",
  };
}

function pixelOf(lat: number, lon: number, tile: { x: number; y: number; z: number }, width: number, height: number): { x: number; y: number } {
  const n = 2 ** tile.z;
  const gx = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const gy = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n;
  return {
    x: Math.max(0, Math.min(width - 1, Math.round((gx - tile.x) * width))),
    y: Math.max(0, Math.min(height - 1, Math.round((gy - tile.y) * height))),
  };
}

function heightOf(tags: Record<string, string>): number {
  const meters = Number(String(tags.height ?? "").replace(",", ".").replace(/[^\d.]/g, ""));
  const levels = Number(tags["building:levels"]);
  const height = Number.isFinite(meters) && meters > 2 ? meters : Number.isFinite(levels) && levels > 0 ? levels * 3 : 9;
  return Math.max(3, Math.min(80, height));
}

function widthOf(tags: Record<string, string>): number {
  const lanes = Number(tags.lanes);
  return Math.max(3, Math.min(14, Number.isFinite(lanes) && lanes > 0 ? lanes * 3 : 6));
}

function centroid(ring: readonly [number, number][]): [number, number] {
  const x = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
  const z = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
  return [x, z];
}

function simplify(ring: [number, number][], max: number): [number, number][] {
  if (ring.length <= max) return ring;
  const step = Math.ceil(ring.length / max);
  return ring.filter((_, index) => index % step === 0);
}

function closest(a: [number, number], b: [number, number], x: number, z: number): { x: number; z: number } {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = dx * dx + dz * dz;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len));
  return { x: a[0] + dx * t, z: a[1] + dz * t };
}
