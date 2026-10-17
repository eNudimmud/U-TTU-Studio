// Free public servers, called from the browser. One request a second per service, kept for ten minutes.
// OpenFreeMap is the map style. Photon finds a name. Overpass draws the block. Panoramax brings the street.
// Mapillary is asked only when a free client token is present.

import { mapillaryImageUrl, mapillaryImagesUrl, mapillaryTileUrl, mapillaryToken, nearestImageIds, parseMapillary, tilesAround, type RuePhoto } from "./mapillary.ts";
import { maybeGunzip, readTilePoints, tileOf } from "./mvt.ts";
import { chaineRue, panoramaxByIdUrl, panoramaxSearchUrl, parsePanoramax, parseInstanceHosts, RUE_RAYON, type PhotoRue } from "./panoramax.ts";
import { parsePhoton, photonUrl } from "./photon.ts";
import {
  OVERPASS, overpassQuery, parseOverpass, plafondBatiments, streetStand,
  type Quartier,
} from "./quartier.ts";
import type { LieuTrouve } from "./lieu.ts";

export function publicFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, credentials: "omit", signal: init.signal ?? AbortSignal.timeout(12_000) });
}

let hostsPending: Promise<Set<string>> | null = null;
async function instanceHosts(): Promise<Set<string>> {
  const cached = readPublicCache<string[]>("panoramax-instances");
  if (cached) return new Set(cached);
  if (hostsPending) return hostsPending;
  hostsPending = (async () => {
    try {
      const response = await publicFetch("https://api.panoramax.xyz/api/instances");
      if (!response.ok) return new Set<string>();
      const hosts = parseInstanceHosts(await response.json());
      writePublicCache("panoramax-instances", hosts);
      return new Set(hosts);
    } catch { return new Set<string>(); }
    finally { hostsPending = null; }
  })();
  return hostsPending;
}

const TTL = 10 * 60 * 1000;
const GAP = 1000;
const lastHit = new Map<string, number>();
const memory = new Map<string, { at: number; value: unknown }>();

export function takePublicSlot(name: string, now = Date.now()): boolean {
  const previous = lastHit.get(name) ?? 0;
  if (now - previous < GAP) return false;
  lastHit.set(name, now);
  return true;
}

export function readPublicCache<T>(key: string, now = Date.now()): T | null {
  const hit = memory.get(key);
  if (hit && now - hit.at < TTL) return hit.value as T;
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`u-public:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: unknown; value?: T };
    if (typeof parsed.at !== "number" || now - parsed.at >= TTL) return null;
    memory.set(key, { at: parsed.at, value: parsed.value });
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export function writePublicCache(key: string, value: unknown, now = Date.now()): void {
  memory.set(key, { at: now, value });
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(`u-public:${key}`, JSON.stringify({ at: now, value }));
  } catch {
    // A full store still leaves the memory copy for this visit.
  }
}

export async function chercherNom(query: string): Promise<LieuTrouve | "rate" | null> {
  const key = `photon:${query.trim().toLowerCase().slice(0, 120)}`;
  const cached = readPublicCache<LieuTrouve>(key);
  if (cached) return cached;
  if (!takePublicSlot("photon")) return "rate";
  const response = await publicFetch(photonUrl(query), { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const found = parsePhoton(await response.json());
  if (found) writePublicCache(key, found);
  return found;
}

export async function chargerQuartier(
  place: LieuTrouve,
  rayon: number,
  mobile: boolean,
  heading = 0,
  tilt = 0,
): Promise<Quartier | "rate" | null> {
  const cap = plafondBatiments(mobile);
  const key = `osm:${place.lat.toFixed(4)},${place.lon.toFixed(4)},${Math.round(rayon)},${cap}`;
  const cached = readPublicCache<Quartier>(key);
  if (cached) return { ...cached, name: place.name, heading, tilt };
  if (!takePublicSlot("overpass")) return "rate";
  const response = await publicFetch(OVERPASS, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(overpassQuery(place.lat, place.lon, rayon))}`,
  });
  if (response.status === 429) return "rate";
  if (!response.ok) return null;
  const parsed = parseOverpass(await response.json(), place.lat, place.lon, rayon, cap);
  if (parsed.buildings.length === 0 && parsed.streets.length === 0) return null;
  const block: Quartier = {
    name: place.name,
    lat: place.lat,
    lon: place.lon,
    heading,
    tilt,
    stand: streetStand(parsed.streets),
    buildings: parsed.buildings,
    streets: parsed.streets,
    relief: null,
    source: "osm",
  };
  writePublicCache(key, block);
  return block;
}

export async function chargerPhoto(id: string): Promise<PhotoRue | "rate" | null> {
  if (!/^[0-9a-f-]{16,80}$/i.test(id)) return null;
  const key = `photo:${id}`;
  const cached = readPublicCache<PhotoRue>(key);
  if (cached) return cached;
  if (!takePublicSlot("panoramax")) return "rate";
  try {
    const response = await publicFetch(panoramaxByIdUrl(id), { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const photo = parsePanoramax(await response.json(), await instanceHosts())[0] ?? null;
    if (photo) writePublicCache(key, photo);
    return photo;
  } catch {
    return null;
  }
}

/**
 * Mapillary images near a point. The bbox search first; when it answers empty
 * (it often does, even in dense places), the coverage tiles give the image ids
 * and each id is read alone. null when nothing could be asked.
 */
export async function mapillaryNear(lat: number, lon: number, radius: number, token: string, fetcher: typeof publicFetch = publicFetch): Promise<RuePhoto[] | null> {
  const headers = { Accept: "application/json", Authorization: `OAuth ${token}` };
  let failed = 0;
  try {
    const response = await fetcher(mapillaryImagesUrl(lat, lon, 8, radius), { headers });
    if (response.ok) {
      const photos = parseMapillary(await response.json());
      if (photos.length > 0) return photos;
    } else failed++;
  } catch { failed++; }
  const points: { id: string; lat: number; lon: number }[] = [];
  let tilesOk = 0;
  for (const tile of tilesAround(lat, lon, radius, tileOf)) {
    try {
      const response = await fetcher(mapillaryTileUrl(tile.z, tile.x, tile.y, token));
      if (!response.ok) continue;
      tilesOk++;
      const bytes = await maybeGunzip(new Uint8Array(await response.arrayBuffer()));
      points.push(...readTilePoints(bytes, "image", tile.z, tile.x, tile.y));
    } catch { /* one bad tile does not hide the others */ }
  }
  if (tilesOk === 0) return failed > 0 ? null : [];
  const ids = nearestImageIds(points, lat, lon, radius, 6);
  const rows = await Promise.all(ids.map(async id => {
    try {
      const response = await fetcher(mapillaryImageUrl(id), { headers });
      return response.ok ? await response.json() : null;
    } catch { return null; }
  }));
  return parseMapillary({ data: rows.filter(Boolean) });
}

export interface PhotoSearch { photos: PhotoRue[]; start: number; mapillary: "off" | "ok" | "fail"; panoramax: "ok" | "fail"; radius: number }

export async function chargerPhotos(lat: number, lon: number, radius = RUE_RAYON): Promise<PhotoSearch | "rate"> {
  const token = mapillaryToken();
  const key = `photos-v3:${lat.toFixed(4)},${lon.toFixed(4)},${radius},${token ? "m" : "p"}`;
  const cached = readPublicCache<PhotoSearch>(key);
  if (cached) return cached;
  if (!takePublicSlot("panoramax")) return "rate";
  let panoramax: PhotoRue[] | null = null;
  try {
    const response = await publicFetch(panoramaxSearchUrl(lat, lon, radius, 20), { headers: { Accept: "application/json" } });
    panoramax = response.ok ? parsePanoramax(await response.json(), await instanceHosts()) : null;
  } catch {
    panoramax = null;
  }
  let mapillary: PhotoRue[] = [];
  let mapillaryState: "off" | "ok" | "fail" = token ? "ok" : "off";
  if (token && (panoramax?.length ?? 0) === 0) {
    if (!takePublicSlot("mapillary")) return "rate";
    try {
      const found = await mapillaryNear(lat, lon, radius, token);
      if (found === null) mapillaryState = "fail";
      else {
        mapillary = found.map(item => ({
          id: item.id,
          author: item.author,
          thumb: item.thumb,
          view: item.view,
          source: "mapillary" as const,
          license: "CC-BY-SA-4.0",
          licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
          sourceUrl: `https://www.mapillary.com/app/?pKey=${item.id}&focus=photo`,
          tour: /equirectangular|spherical/i.test(item.camera),
          lat: item.lat,
          lon: item.lon,
          heading: item.heading,
          fov: /equirectangular|spherical/i.test(item.camera) ? 360 : null,
          next: null,
          prev: null,
        }));
      }
    } catch {
      mapillaryState = "fail";
    }
  }
  const chain = chaineRue(panoramax ?? [], lat, lon);
  const photos = chain.photos.length > 0 ? chain.photos : mapillary;
  const start = chain.photos.length > 0 ? chain.start : 0;
  const body: PhotoSearch = { photos, start, mapillary: mapillaryState, panoramax: panoramax === null ? "fail" : "ok", radius };
  if (panoramax !== null && mapillaryState !== "fail") writePublicCache(key, body);
  return body;
}
