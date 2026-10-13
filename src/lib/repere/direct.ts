// Free public servers, called from the browser. One request a second per service, kept for ten minutes.
// OpenFreeMap is the map style. Photon finds a name. Overpass draws the block. Panoramax brings the street.
// Mapillary is asked only when a free client token is present.

import { mapillaryImagesUrl, mapillaryToken, parseMapillary } from "./mapillary.ts";
import { chaineRue, panoramaxByIdUrl, panoramaxSearchUrl, parsePanoramax, RUE_RAYON, type PhotoRue } from "./panoramax.ts";
import { parsePhoton, photonUrl } from "./photon.ts";
import {
  OVERPASS, overpassQuery, parseOverpass, plafondBatiments, streetStand,
  type Quartier,
} from "./quartier.ts";
import type { LieuTrouve } from "./lieu.ts";

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
  const response = await fetch(photonUrl(query), { headers: { Accept: "application/json" } });
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
  const response = await fetch(OVERPASS, {
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
    const response = await fetch(panoramaxByIdUrl(id), { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const photo = parsePanoramax(await response.json())[0] ?? null;
    if (photo) writePublicCache(key, photo);
    return photo;
  } catch {
    return null;
  }
}

export async function chargerPhotos(lat: number, lon: number): Promise<{ photos: PhotoRue[]; start: number; mapillary: "off" | "ok" | "fail" } | "rate"> {
  const token = mapillaryToken();
  const key = `photos:${lat.toFixed(4)},${lon.toFixed(4)},${RUE_RAYON},${token ? "m" : "p"}`;
  const cached = readPublicCache<{ photos: PhotoRue[]; start: number; mapillary: "off" | "ok" | "fail" }>(key);
  if (cached) return cached;
  if (!takePublicSlot("panoramax")) return "rate";
  let panoramax: PhotoRue[] | null = null;
  try {
    const response = await fetch(panoramaxSearchUrl(lat, lon, RUE_RAYON, 20), { headers: { Accept: "application/json" } });
    panoramax = response.ok ? parsePanoramax(await response.json()) : null;
  } catch {
    panoramax = null;
  }
  let mapillary: PhotoRue[] = [];
  let mapillaryState: "off" | "ok" | "fail" = token ? "ok" : "off";
  if (token && (panoramax?.length ?? 0) === 0) {
    if (!takePublicSlot("mapillary")) return "rate";
    try {
      const response = await fetch(mapillaryImagesUrl(lat, lon, 6), {
        headers: { Accept: "application/json", Authorization: `OAuth ${token}` },
      });
      if (!response.ok) mapillaryState = "fail";
      else {
        mapillary = parseMapillary(await response.json()).map(item => ({
          id: item.id,
          author: item.author,
          thumb: item.thumb,
          view: item.thumb,
          source: "mapillary" as const,
          license: "CC BY-SA",
          tour: false,
          lat,
          lon,
          heading: 0,
          fov: null,
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
  if (panoramax === null && photos.length === 0) return { photos: [], start: 0, mapillary: mapillaryState };
  const body = { photos, start, mapillary: mapillaryState };
  writePublicCache(key, body);
  return body;
}
