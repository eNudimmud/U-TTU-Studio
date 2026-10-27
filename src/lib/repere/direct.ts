// Open public servers, called from the browser. One request a second per service, kept for ten minutes.
// OpenFreeMap is the map style. Photon finds a name. Overpass draws the block. Panoramax, Wikimedia
// Commons and KartaView bring the street. Mapillary joins through /api/repere/mapillary (MAPILLARY_TOKEN on the server, never printed).

import { mapillaryImagesUrl, mapillaryToken, parseMapillary, type RuePhoto } from "./mapillary.ts";
import {
  chaineRue, distanceMeters, diversifier, pano360, panoramaxBboxUrl, panoramaxByIdUrl, panoramaxSearchUrl, parsePanoramax, parseInstanceHosts, RUE_RAYON, zoneVue,
  type PhotoRue, type Regard,
} from "./panoramax.ts";
import { parsePhoton, photonUrl } from "./photon.ts";
import { COMMONS_AGENT, COMMONS_RAYON, commonsGeoUrl, commonsInfoUrl, parseCommonsInfo, parseGeosearch, preselection } from "./commons.ts";
import { KARTAVIEW_DELAI, kartaviewUrl, parseKartaview } from "./kartaview.ts";
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

/** Mapillary pictures are CC BY-SA 4.0 (mapillary.com/terms). */
export function mapillaryPhoto(item: RuePhoto): PhotoRue {
  const tour = item.pano === true || /equirectangular|spherical/i.test(item.camera);
  return {
    id: item.id,
    author: item.author,
    thumb: item.thumb,
    view: item.view,
    source: "mapillary",
    license: "CC-BY-SA-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    sourceUrl: `https://www.mapillary.com/app/?pKey=${item.id}&focus=photo`,
    tour,
    lat: item.lat,
    lon: item.lon,
    heading: item.heading,
    fov: tour ? 360 : null,
    next: null,
    prev: null,
    ...(item.sequence ? { serie: `mly:${item.sequence}` } : {}),
  };
}

export interface PhotoSearch { photos: PhotoRue[]; start: number; mapillary: "off" | "ok" | "fail"; panoramax: "ok" | "fail"; radius: number }

export async function chargerPhotos(lat: number, lon: number, radius = RUE_RAYON): Promise<PhotoSearch | "rate"> {
  const token = mapillaryToken();
  const key = `photos-v2:${lat.toFixed(4)},${lon.toFixed(4)},${radius},${token ? "m" : "p"}`;
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
      const response = await publicFetch(mapillaryImagesUrl(lat, lon, 8, radius), {
        headers: { Accept: "application/json", Authorization: `OAuth ${token}` },
      });
      if (!response.ok) mapillaryState = "fail";
      else {
        mapillary = parseMapillary(await response.json()).map(mapillaryPhoto);
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

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Waits for the service's one-a-second slot instead of failing: a zone search asks Panoramax twice. */
async function slot(name: string): Promise<boolean> {
  for (let tries = 0; tries < 4; tries += 1) {
    if (takePublicSlot(name)) return true;
    await pause(GAP + 50);
  }
  return false;
}

export interface ZoneSearch {
  /** Up to 12 different pictures over the visible area, every open source together. */
  photos: PhotoRue[];
  /** The 360° sphere at the camera's spot, if one exists. */
  pano: PhotoRue | null;
  panoramax: "ok" | "fail";
  mapillary: "off" | "ok" | "fail";
  commons?: "ok" | "fail";
  kartaview?: "ok" | "fail";
}

async function getJson(url: string, headers: Record<string, string> = {}, timeout = 12_000): Promise<unknown | null> {
  try {
    const response = await publicFetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(timeout) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

/** Radius of the fallback search when the view itself holds too few photos. */
const WIDE_M = 250;
/** One Commons request may take its time; past this it is dropped. */
const LENT_MS = 6_000;
/** Commons as a whole (three requests in a row): past this the picker shows what the others found. */
const COMMONS_MAX_MS = 9_000;

/** The promise's value, or null once `ms` have passed. */
export function dansLesTemps<T>(promise: Promise<T | null>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), ms); });
  return Promise.race([promise.catch(() => null), late]).finally(() => clearTimeout(timer));
}

/**
 * Commons around the spot: one geosearch, then details for ~100 points spread over the area, in two
 * batches of 50, one request at a time. Null when Commons does not answer.
 */
export async function chargerCommons(lat: number, lon: number, radius = COMMONS_RAYON): Promise<PhotoRue[] | null> {
  const key = `commons-v1:${lat.toFixed(4)},${lon.toFixed(4)},${Math.round(radius)}`;
  const cached = readPublicCache<PhotoRue[]>(key);
  if (cached) return cached;
  const headers = { "Api-User-Agent": COMMONS_AGENT };
  const started = Date.now();
  let geo = await getJson(commonsGeoUrl(lat, lon, radius), headers, LENT_MS);
  // A quick refusal (busy server) gets one more try a moment later; a slow one does not.
  if (!geo && Date.now() - started < 2_000) {
    await pause(1_200);
    geo = await getJson(commonsGeoUrl(lat, lon, radius), headers, LENT_MS);
  }
  if (!geo) return null;
  const points = preselection(parseGeosearch(geo), lat, lon, 100);
  const byId = new Map(points.map(point => [point.pageid, point]));
  const photos: PhotoRue[] = [];
  for (let i = 0; i < points.length; i += 50) {
    const info = await getJson(commonsInfoUrl(points.slice(i, i + 50).map(point => point.pageid)), headers, LENT_MS);
    if (!info) break;
    photos.push(...parseCommonsInfo(info, byId));
  }
  writePublicCache(key, photos);
  return photos;
}

/** KartaView around the spot, given up after ~4 s. Null when it does not answer in time. */
export async function chargerKartaview(lat: number, lon: number, radius = WIDE_M): Promise<PhotoRue[] | null> {
  const key = `kartaview-v1:${lat.toFixed(4)},${lon.toFixed(4)},${Math.round(radius)}`;
  const cached = readPublicCache<PhotoRue[]>(key);
  if (cached) return cached;
  const body = await getJson(kartaviewUrl(lat, lon, radius), {}, KARTAVIEW_DELAI);
  if (!body) return null;
  const photos = parseKartaview(body, lat, lon, radius);
  writePublicCache(key, photos);
  return photos;
}

/** Panoramax over the view, widened to the block when thin, plus 360° spheres at the spot. */
async function chargerPanoramax(view: Regard, centre: Regard, max: number): Promise<PhotoRue[] | null> {
  const hosts = await instanceHosts();
  const bbox = zoneVue(view);
  const spot = zoneVue({ ...centre, fov: 360 }, 80, 80);
  const flat = await slot("panoramax") ? await getJson(panoramaxBboxUrl(bbox, 100)) : null;
  const flatPhotos = flat ? parsePanoramax(flat, hosts, 100) : [];
  // Thin or repetitive coverage in the view (Midtown Manhattan, Saint-François): widen to the whole block around the camera.
  // The diversifier still ranks the photos inside the view first.
  const wide = flat && diversifier(flatPhotos, view, max).length < 6 && await slot("panoramax")
    ? await getJson(panoramaxBboxUrl(zoneVue({ ...centre, fov: 360 }, WIDE_M, WIDE_M), 100))
    : null;
  const spheres = await slot("panoramax") ? await getJson(panoramaxBboxUrl(spot, 20, true)) : null;
  if (flat === null) return null;
  return [
    ...flatPhotos,
    ...(wide ? parsePanoramax(wide, hosts, 100) : []),
    ...(spheres ? parsePanoramax(spheres, hosts, 20) : []),
  ];
}

/**
 * Photos of the visible area, plus the 360° sphere of the spot. The spot is the camera, or the
 * place pin when the camera stands back from it (the default overview camera is ~150 m away).
 * Panoramax, Wikimedia Commons and KartaView are asked at the same time, each with its own limit;
 * a slow or silent source only means fewer photos. Mapillary joins with a client token, never waited on.
 */
async function chargerMapillaryZone(bbox: readonly [number, number, number, number]): Promise<{ state: "off" | "ok" | "fail"; photos: PhotoRue[] }> {
  // Always go through the same-origin proxy so MAPILLARY_TOKEN stays on the server.
  if (!(await slot("mapillary"))) return { state: "fail", photos: [] };
  try {
    const params = new URLSearchParams({ bbox: bbox.map(n => n.toFixed(6)).join(","), limit: "100" });
    const response = await fetch(`/api/repere/mapillary?${params}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(KARTAVIEW_DELAI),
    });
    if (!response.ok) return { state: "fail", photos: [] };
    const body = await response.json() as { state?: string; data?: unknown };
    if (body.state === "off") return { state: "off", photos: [] };
    if (body.state !== "ok" || body.data == null) return { state: "fail", photos: [] };
    return { state: "ok", photos: parseMapillary(body.data, 100).map(mapillaryPhoto) };
  } catch {
    return { state: "fail", photos: [] };
  }
}

export async function chargerZone(view: Regard, max = 12, pin?: { lat: number; lon: number }): Promise<ZoneSearch> {
  const key = `zone-v4:${view.lat.toFixed(4)},${view.lon.toFixed(4)},${Math.round(view.heading / 10)},${Math.round(view.fov)},${pin ? `${pin.lat.toFixed(4)},${pin.lon.toFixed(4)}` : "-"}`;
  const cached = readPublicCache<ZoneSearch>(key);
  if (cached) return cached;
  const near = !pin || distanceMeters(view.lat, view.lon, pin.lat, pin.lon) <= 60;
  const centre = near ? view : { ...view, lat: pin.lat, lon: pin.lon };
  const bbox = zoneVue(view);
  const [fromPanoramax, fromCommons, fromKartaview, mapillary] = await Promise.all([
    chargerPanoramax(view, centre, max).catch(() => null),
    dansLesTemps(chargerCommons(centre.lat, centre.lon), COMMONS_MAX_MS),
    chargerKartaview(centre.lat, centre.lon).catch(() => null),
    chargerMapillaryZone(bbox),
  ]);
  const fromMapillary = mapillary.photos;
  const all = [...(fromPanoramax ?? []), ...(fromKartaview ?? []), ...(fromCommons ?? []), ...fromMapillary];
  // A sphere at the spot first; otherwise any sphere of the block, so a 360° is offered whenever one exists.
  const pano = pano360(all, view.lat, view.lon) ?? (near ? null : pano360(all, centre.lat, centre.lon)) ?? pano360(all, centre.lat, centre.lon, WIDE_M);
  const result: ZoneSearch = {
    photos: diversifier(all.filter(photo => photo.id !== pano?.id && !photo.tour), view, max),
    pano,
    panoramax: fromPanoramax === null ? "fail" : "ok",
    mapillary: mapillary.state,
    commons: fromCommons === null ? "fail" : "ok",
    kartaview: fromKartaview === null ? "fail" : "ok",
  };
  if (fromPanoramax !== null && fromCommons !== null && fromKartaview !== null && mapillary.state !== "fail") writePublicCache(key, result);
  return result;
}
