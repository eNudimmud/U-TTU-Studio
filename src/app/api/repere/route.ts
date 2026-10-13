// One search at a time. Nominatim, Overpass, Overture, Terrarium and Panoramax stay on the server.
// Map links are parsed. No Google key, no Street View, no Google tiles.
// Street photos: Panoramax first (no token), then Mapillary when MAPILLARY_TOKEN is set.

import { nominatimUrl, parseNominatim } from "@/lib/repere/lieu";
import { hostAllowed, isShortHost } from "@/lib/repere/lien";
import { mapillaryImageUrl, mapillaryImagesUrl, parseMapillary, thumbAllowed } from "@/lib/repere/mapillary";
import { buildingsInTile } from "@/lib/repere/overture-tuile";
import { OVERTURE_BUILDINGS, OVERTURE_ZOOM } from "@/lib/repere/overture";
import { panoramaxByIdUrl, panoramaxSearchUrl, panoramaxThumbAllowed, parsePanoramax, type PhotoRue } from "@/lib/repere/panoramax";
import { decodePngRgba } from "@/lib/repere/png";
import { PMTiles } from "pmtiles";
import {
  OVERPASS, TERRARIUM, overpassQuery, parseOverpass, plafondBatiments, reliefFromRgba, streetStand, tileOf,
  type Batiment, type Quartier, type Relief, type Rue,
} from "@/lib/repere/quartier";
import { parseSaisie } from "@/lib/repere/saisie";

export const dynamic = "force-dynamic";

const UA = "UTTU-Studio/1.0 (reperage; https://u-ttu-studio.vercel.app)";
const REFERER = "https://u-ttu-studio.vercel.app";
const TTL = 10 * 60 * 1000;
const last = { at: 0 };
const photoSlot = { at: 0 };
const cache = new Map<string, { at: number; body: Quartier }>();
const photoLists = new Map<string, { at: number; body: { photos: PhotoRue[]; mapillary: "off" | "ok" | "fail" } }>();
let buildingTiles: PMTiles | null = null;
const photoBytes = new Map<string, { at: number; bytes: ArrayBuffer; type: string }>();

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawUrl = params.get("url")?.trim() ?? "";
  if (rawUrl) return resolveLink(rawUrl);
  if (params.get("photos") === "1") return listPhotos(params);
  const photoId = params.get("photo")?.trim() ?? "";
  if (photoId) return streamPhoto(photoId);

  const lat = numberIn(params.get("lat"), -90, 90);
  const lon = numberIn(params.get("lon"), -180, 180);
  if (lat !== null && lon !== null) return blockAt(params, lat, lon);

  const query = params.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 120) return Response.json({ error: "lieu" }, { status: 400 });
  if (!takeSlot()) return Response.json({ error: "rate" }, { status: 429 });
  const found = await askNominatim(query);
  if (!found) return Response.json({ error: "introuvable" }, { status: 404 });
  if (params.get("bloc") !== "1") return Response.json(found);
  const built = await buildQuartier(params, found.lat, found.lon, found.name);
  if (built.status !== 200) return Response.json({ ...found, quartier: null, error: "quartier" }, { status: 200 });
  return Response.json({ ...found, quartier: built.body });
}

async function resolveLink(raw: string): Promise<Response> {
  let current: URL;
  try {
    current = new URL(raw);
  } catch {
    return Response.json({ error: "lieu" }, { status: 400 });
  }
  if (!isShortHost(current.hostname)) return Response.json({ error: "lieu" }, { status: 400 });
  if (!takeSlot()) return Response.json({ error: "rate" }, { status: 429 });
  for (let hop = 0; hop < 4; hop += 1) {
    if (!hostAllowed(current.hostname)) return Response.json({ error: "introuvable" }, { status: 404 });
    const parsed = parseSaisie(current.toString());
    if (parsed?.kind === "point") return Response.json(parsed);
    let response: Response;
    try {
      response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": UA, Accept: "text/html", Referer: REFERER },
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      return Response.json({ error: "introuvable" }, { status: 502 });
    }
    if (response.status < 300 || response.status >= 400) return Response.json({ error: "introuvable" }, { status: 404 });
    const location = response.headers.get("location");
    if (!location) return Response.json({ error: "introuvable" }, { status: 404 });
    try {
      current = new URL(location, current);
    } catch {
      return Response.json({ error: "introuvable" }, { status: 404 });
    }
  }
  return Response.json({ error: "introuvable" }, { status: 404 });
}

async function blockAt(params: URLSearchParams, lat: number, lon: number): Promise<Response> {
  const mobile = params.get("mobile") === "1";
  const rayon = clampRayon(Number(params.get("rayon")), mobile);
  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${rayon},${mobile ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return Response.json(hit.body);
  if (!takeSlot()) return Response.json({ error: "rate" }, { status: 429 });
  const name = (params.get("name") || "Lieu").slice(0, 80);
  const built = await buildQuartier(params, lat, lon, name);
  if (built.status === 200) cache.set(key, { at: Date.now(), body: built.body as Quartier });
  return Response.json(built.body, { status: built.status });
}

async function askOverpass(lat: number, lon: number, rayon: number, cap: number): Promise<{ buildings: Batiment[]; streets: Rue[] } | "rate" | null> {
  try {
    const upstream = await fetch(OVERPASS, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        Referer: REFERER,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(overpassQuery(lat, lon, rayon))}`,
      cache: "no-store",
      signal: AbortSignal.timeout(22000),
    });
    if (upstream.status === 429) return "rate";
    if (!upstream.ok) return null;
    return parseOverpass(await upstream.json(), lat, lon, rayon, cap);
  } catch {
    return null;
  }
}

async function buildQuartier(params: URLSearchParams, lat: number, lon: number, name: string): Promise<{ status: number; body: Quartier | { error: string } }> {
  const mobile = params.get("mobile") === "1";
  const rayon = clampRayon(Number(params.get("rayon")), mobile);
  const heading = finite(Number(params.get("heading")));
  const tilt = finite(Number(params.get("tilt")));
  const cap = plafondBatiments(mobile);
  const [osm, overture, relief] = await Promise.all([
    askOverpass(lat, lon, rayon, cap),
    loadOverture(lat, lon, rayon, cap),
    loadRelief(lat, lon, rayon, mobile),
  ]);
  if (osm === "rate" && overture.length === 0) return { status: 429, body: { error: "rate" } };
  const streets = osm && osm !== "rate" ? osm.streets : [];
  const osmBuildings = osm && osm !== "rate" ? osm.buildings : [];
  const buildings = overture.length > 0 ? overture : osmBuildings;
  if (buildings.length === 0 && streets.length === 0) return { status: 502, body: { error: "quartier" } };
  const body: Quartier = {
    name,
    lat,
    lon,
    heading,
    tilt,
    stand: streetStand(streets),
    buildings,
    streets,
    relief,
    source: overture.length > 0 ? "overture" : "osm",
  };
  return { status: 200, body };
}

async function loadOverture(lat: number, lon: number, rayon: number, cap: number): Promise<Batiment[]> {
  try {
    buildingTiles ??= new PMTiles(OVERTURE_BUILDINGS);
    const tile = tileOf(lat, lon, OVERTURE_ZOOM);
    const response = await buildingTiles.getZxy(tile.z, tile.x, tile.y, AbortSignal.timeout(12000));
    if (!response?.data?.byteLength) return [];
    return buildingsInTile(response.data, tile, lat, lon, rayon, cap);
  } catch {
    return [];
  }
}

async function loadRelief(lat: number, lon: number, rayon: number, mobile: boolean): Promise<Relief | null> {
  const tile = tileOf(lat, lon, 14);
  const span = Math.min(400, Math.max(80, rayon * 2));
  const n = mobile ? 5 : 9;
  try {
    const response = await fetch(`${TERRARIUM}/${tile.z}/${tile.x}/${tile.y}.png`, {
      headers: { "User-Agent": UA, Accept: "image/png", Referer: REFERER },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return null;
    const png = decodePngRgba(new Uint8Array(await response.arrayBuffer()));
    if (!png) return null;
    return reliefFromRgba(png.rgba, png.width, png.height, lat, lon, span, n);
  } catch {
    return null;
  }
}

async function askNominatim(query: string): Promise<{ name: string; lat: number; lon: number } | null> {
  try {
    const upstream = await fetch(nominatimUrl(query), {
      headers: { Accept: "application/json", "Accept-Language": "fr", "User-Agent": UA, Referer: REFERER },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) return null;
    return parseNominatim(await upstream.json());
  } catch {
    return null;
  }
}

async function listPhotos(params: URLSearchParams): Promise<Response> {
  const lat = numberIn(params.get("lat"), -90, 90);
  const lon = numberIn(params.get("lon"), -180, 180);
  if (lat === null || lon === null) return Response.json({ error: "photos", photos: [], mapillary: "off" }, { status: 400 });
  const limit = params.get("mobile") === "1" ? 4 : 6;
  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${limit}`;
  const hit = photoLists.get(key);
  if (hit && Date.now() - hit.at < TTL) return Response.json(hit.body);
  if (!takePhotoSlot()) return Response.json({ error: "rate", photos: [], mapillary: "off" }, { status: 429 });
  const token = mapillaryToken();
  const radius = params.get("mobile") === "1" ? 50 : 80;
  let panoramax: PhotoRue[] | null = null;
  try {
    const upstream = await fetch(panoramaxSearchUrl(lat, lon, radius, limit), {
      headers: { Accept: "application/json", "User-Agent": UA },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    panoramax = upstream.ok ? parsePanoramax(await upstream.json()) : null;
  } catch {
    panoramax = null;
  }
  let mapillary: PhotoRue[] = [];
  let mapillaryState: "off" | "ok" | "fail" = token ? "ok" : "off";
  if (token && (panoramax?.length ?? 0) < limit) {
    try {
      const upstream = await fetch(mapillaryImagesUrl(lat, lon, limit), {
        headers: { Authorization: `OAuth ${token}`, Accept: "application/json", "User-Agent": UA },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!upstream.ok) mapillaryState = "fail";
      else {
        mapillary = parseMapillary(await upstream.json()).map(item => ({
          id: item.id, author: item.author, thumb: item.thumb, source: "mapillary" as const, license: "CC BY-SA",
        }));
      }
    } catch {
      mapillaryState = "fail";
    }
  }
  const photos = [...(panoramax ?? []), ...mapillary].slice(0, limit);
  if (panoramax === null && photos.length === 0) {
    return Response.json({ error: "photos", photos: [], mapillary: mapillaryState });
  }
  const body = { photos, mapillary: mapillaryState };
  photoLists.set(key, { at: Date.now(), body });
  return Response.json(body);
}

async function streamPanoramax(id: string): Promise<Response> {
  const hit = photoBytes.get(id);
  if (hit && Date.now() - hit.at < TTL) {
    return new Response(hit.bytes, { headers: { "Content-Type": hit.type, "Cache-Control": "private, max-age=600" } });
  }
  if (!takePhotoSlot()) return Response.json({ error: "rate", photos: [] }, { status: 429 });
  try {
    const meta = await fetch(panoramaxByIdUrl(id), {
      headers: { Accept: "application/json", "User-Agent": UA },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!meta.ok) return Response.json({ error: "photos", photos: [] });
    const thumb = parsePanoramax(await meta.json())[0]?.thumb ?? "";
    const image = await fetchThumb(thumb, panoramaxThumbAllowed);
    if (!image) return Response.json({ error: "photos", photos: [] });
    photoBytes.set(id, { at: Date.now(), bytes: image.bytes, type: image.type });
    return new Response(image.bytes, { headers: { "Content-Type": image.type, "Cache-Control": "private, max-age=600" } });
  } catch {
    return Response.json({ error: "photos", photos: [] });
  }
}

async function streamPhoto(id: string): Promise<Response> {
  if (/^[0-9a-f-]{16,80}$/i.test(id) && id.includes("-")) return streamPanoramax(id);
  if (!/^\d{1,30}$/.test(id)) return Response.json({ error: "photos" }, { status: 400 });
  const token = mapillaryToken();
  if (!token) return Response.json({ error: "token", photos: [] });
  const hit = photoBytes.get(id);
  if (hit && Date.now() - hit.at < TTL) {
    return new Response(hit.bytes, { headers: { "Content-Type": hit.type, "Cache-Control": "private, max-age=600" } });
  }
  if (!takePhotoSlot()) return Response.json({ error: "rate", photos: [] }, { status: 429 });
  try {
    const meta = await fetch(mapillaryImageUrl(id), {
      headers: { Authorization: `OAuth ${token}`, Accept: "application/json", "User-Agent": UA },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!meta.ok) return Response.json({ error: "photos", photos: [] });
    const payload = await meta.json() as { thumb_1024_url?: unknown };
    const thumb = typeof payload.thumb_1024_url === "string" ? payload.thumb_1024_url : "";
    const image = await fetchThumb(thumb, thumbAllowed);
    if (!image) return Response.json({ error: "photos", photos: [] });
    photoBytes.set(id, { at: Date.now(), bytes: image.bytes, type: image.type });
    return new Response(image.bytes, { headers: { "Content-Type": image.type, "Cache-Control": "private, max-age=600" } });
  } catch {
    return Response.json({ error: "photos", photos: [] });
  }
}

async function fetchThumb(start: string, allowed: (url: string) => boolean): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  let current = start;
  for (let hop = 0; hop < 2; hop += 1) {
    if (!allowed(current)) return null;
    const response = await fetch(current, {
      redirect: "manual",
      headers: { Accept: "image/*", "User-Agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      try {
        current = new URL(location, current).toString();
      } catch {
        return null;
      }
      continue;
    }
    if (!response.ok) return null;
    const type = (response.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
    if (!type.startsWith("image/")) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 32 || bytes.byteLength > 8_000_000) return null;
    return { bytes, type };
  }
  return null;
}

function mapillaryToken(): string {
  return (process.env.MAPILLARY_TOKEN ?? "").trim();
}

function takeSlot(): boolean {
  const now = Date.now();
  if (now - last.at < 1000) return false;
  last.at = now;
  return true;
}

function takePhotoSlot(): boolean {
  const now = Date.now();
  if (now - photoSlot.at < 1000) return false;
  photoSlot.at = now;
  return true;
}

function clampRayon(value: number, mobile: boolean): number {
  const fallback = mobile ? 70 : 130;
  const rayon = Number.isFinite(value) && value > 0 ? value : fallback;
  return Math.round(Math.min(250, Math.max(40, rayon)));
}

function numberIn(value: string | null, min: number, max: number): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
