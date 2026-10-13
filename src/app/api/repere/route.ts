// One search at a time. Nominatim, Overpass and Terrarium stay on the server, where a User-Agent can be set.
// Map links are parsed. No Google key, and no fetch outside the short-link allowlist.

import { nominatimUrl, parseNominatim } from "@/lib/repere/lieu";
import { hostAllowed, isShortHost } from "@/lib/repere/lien";
import { decodePngRgba } from "@/lib/repere/png";
import {
  OVERPASS, TERRARIUM, overpassQuery, parseOverpass, plafondBatiments, reliefFromRgba, streetStand, tileOf,
  type Quartier, type Relief,
} from "@/lib/repere/quartier";
import { parseSaisie } from "@/lib/repere/saisie";

export const dynamic = "force-dynamic";

const UA = "UTTU-Studio/1.0 (reperage; https://u-ttu-studio.vercel.app)";
const REFERER = "https://u-ttu-studio.vercel.app";
const TTL = 10 * 60 * 1000;
const last = { at: 0 };
const cache = new Map<string, { at: number; body: Quartier }>();

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawUrl = params.get("url")?.trim() ?? "";
  if (rawUrl) return resolveLink(rawUrl);

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

async function buildQuartier(params: URLSearchParams, lat: number, lon: number, name: string): Promise<{ status: number; body: Quartier | { error: string } }> {
  const mobile = params.get("mobile") === "1";
  const rayon = clampRayon(Number(params.get("rayon")), mobile);
  const heading = finite(Number(params.get("heading")));
  const tilt = finite(Number(params.get("tilt")));
  let upstream: Response;
  try {
    upstream = await fetch(OVERPASS, {
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
  } catch {
    return { status: 502, body: { error: "quartier" } };
  }
  if (upstream.status === 429) return { status: 429, body: { error: "rate" } };
  if (!upstream.ok) return { status: 502, body: { error: "quartier" } };
  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return { status: 502, body: { error: "quartier" } };
  }
  const parsed = parseOverpass(payload, lat, lon, rayon, plafondBatiments(mobile));
  const relief = await loadRelief(lat, lon, rayon, mobile);
  const body: Quartier = {
    name,
    lat,
    lon,
    heading,
    tilt,
    stand: streetStand(parsed.streets),
    buildings: parsed.buildings,
    streets: parsed.streets,
    relief,
  };
  return { status: 200, body };
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

function takeSlot(): boolean {
  const now = Date.now();
  if (now - last.at < 1000) return false;
  last.at = now;
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
