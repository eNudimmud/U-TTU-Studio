// One field, every way in. Links are read, never sent to a Google API.

export interface PointSaisie {
  kind: "point";
  lat: number;
  lon: number;
  name: string;
  heading: number;
  tilt: number;
}

export interface NameSaisie {
  kind: "name";
  query: string;
}

export interface ShortSaisie {
  kind: "short";
  url: string;
}

export type Saisie = PointSaisie | NameSaisie | ShortSaisie;

const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "maps.app"]);

export function parseSaisie(raw: string): Saisie | null {
  const text = raw.trim();
  if (text.length < 2 || text.length > 600) return null;
  const url = readUrl(text);
  if (url) {
    if (SHORT_HOSTS.has(url.hostname)) return { kind: "short", url: url.toString() };
    const point = pointFromUrl(url);
    if (point) return point;
    const query = url.searchParams.get("q") || url.searchParams.get("query");
    if (query && !looksLikePair(query)) return { kind: "name", query: query.trim().slice(0, 120) };
  }
  const dms = pointFromDms(text);
  if (dms) return dms;
  const pair = pointFromPair(text);
  if (pair) return pair;
  return { kind: "name", query: text.slice(0, 120) };
}

export function parseKml(xml: string): PointSaisie | null {
  const coordinates = /<coordinates>\s*([-\d.,\s]+)\s*<\/coordinates>/i.exec(xml);
  const pair = coordinates ? pairFromKml(coordinates[1]) : null;
  if (!pair) return null;
  const name = /<name>\s*([^<]+?)\s*<\/name>/i.exec(xml)?.[1]?.trim() || "Lieu";
  const heading = numberTag(xml, "heading");
  const tilt = numberTag(xml, "tilt");
  return { kind: "point", ...pair, name: cleanName(name), heading, tilt };
}

export function parseGeoJson(raw: string): PointSaisie | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const found = firstPoint(data);
  if (!found) return null;
  return { kind: "point", lat: found.lat, lon: found.lon, name: cleanName(found.name || "Lieu"), heading: 0, tilt: 0 };
}

function readUrl(text: string): URL | null {
  const match = /https?:\/\/\S+/i.exec(text);
  if (!match) return null;
  try {
    return new URL(match[0].replace(/[),.;]+$/, ""));
  } catch {
    return null;
  }
}

function pointFromUrl(url: URL): PointSaisie | null {
  const host = url.hostname.replace(/^www\./, "");
  const earth = host === "earth.google.com";
  const maps = host === "google.com" || host === "maps.google.com" || host.endsWith(".google.com");
  if (!earth && !maps) return null;
  const at = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(-?\d+(?:\.\d+)?)a)?(?:,(-?\d+(?:\.\d+)?)d)?(?:,(-?\d+(?:\.\d+)?)y)?(?:,(-?\d+(?:\.\d+)?)h)?(?:,(-?\d+(?:\.\d+)?)t)?/.exec(`${url.pathname}${url.search}`);
  const heading = at?.[6] ? Number(at[6]) : 0;
  const tilt = at?.[7] ? Number(at[7]) : 0;
  const data = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url.href);
  if (data && finitePair(Number(data[1]), Number(data[2]))) {
    return { kind: "point", lat: Number(data[1]), lon: Number(data[2]), name: placeName(url) || "Lieu", heading, tilt };
  }
  if (at && finitePair(Number(at[1]), Number(at[2]))) {
    return { kind: "point", lat: Number(at[1]), lon: Number(at[2]), name: placeName(url) || "Lieu", heading, tilt };
  }
  const query = url.searchParams.get("q") || url.searchParams.get("ll") || url.searchParams.get("query") || "";
  const pair = pointFromPair(query);
  if (!pair) return null;
  return { ...pair, name: pair.name === "Lieu" ? placeName(url) || "Lieu" : pair.name, heading, tilt };
}

function placeName(url: URL): string {
  const place = /\/place\/([^/@?]+)/.exec(url.pathname);
  if (!place) return "";
  try {
    return decodeURIComponent(place[1]).replace(/\+/g, " ");
  } catch {
    return "";
  }
}

function pointFromDms(text: string): PointSaisie | null {
  const pattern = /([+-]?\d+(?:[.,]\d+)?)\s*[°º]\s*(\d+(?:[.,]\d+)?)?\s*['′’]?\s*(\d+(?:[.,]\d+)?)?\s*(?:["″”])?\s*([NSEW])/gi;
  const found = [...text.matchAll(pattern)];
  if (found.length < 2) return null;
  const lat = found.find(item => /[NS]/i.test(item[4]));
  const lon = found.find(item => /[EW]/i.test(item[4]));
  if (!lat || !lon) return null;
  const latN = dmsToDecimal(lat[1], lat[2], lat[3], /S/i.test(lat[4]));
  const lonN = dmsToDecimal(lon[1], lon[2], lon[3], /W/i.test(lon[4]));
  if (!finitePair(latN, lonN)) return null;
  return { kind: "point", lat: latN, lon: lonN, name: "Lieu", heading: 0, tilt: 0 };
}

function dmsToDecimal(deg: string, min: string | undefined, sec: string | undefined, negative: boolean): number {
  const value = num(deg) + num(min) / 60 + num(sec) / 3600;
  return negative ? -Math.abs(value) : value;
}

function pointFromPair(text: string): PointSaisie | null {
  const match = /([+-]?\d+(?:\.\d+)?)\s*[, ]\s*([+-]?\d+(?:\.\d+)?)/.exec(text.trim());
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  if (!finitePair(lat, lon)) return null;
  return { kind: "point", lat, lon, name: "Lieu", heading: 0, tilt: 0 };
}

function pairFromKml(raw: string): { lat: number; lon: number } | null {
  const first = raw.trim().split(/\s+/)[0] ?? "";
  const [lon, lat] = first.split(",").map(Number);
  if (!finitePair(lat, lon)) return null;
  return { lat, lon };
}

function firstPoint(value: unknown, name = ""): { lat: number; lon: number; name: string } | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { type?: unknown; coordinates?: unknown; geometry?: unknown; features?: unknown; geometries?: unknown; properties?: { name?: unknown } };
  const nextName = typeof row.properties?.name === "string" ? row.properties.name : name;
  if (row.type === "Point" && Array.isArray(row.coordinates)) {
    const lon = Number(row.coordinates[0]);
    const lat = Number(row.coordinates[1]);
    return finitePair(lat, lon) ? { lat, lon, name: nextName } : null;
  }
  if (Array.isArray(row.coordinates)) {
    const nested = dig(row.coordinates);
    if (nested) return { ...nested, name: nextName };
  }
  if (row.geometry) return firstPoint(row.geometry, nextName);
  const list = Array.isArray(row.features) ? row.features : Array.isArray(row.geometries) ? row.geometries : null;
  if (!list) return null;
  for (const item of list) {
    const found = firstPoint(item, nextName);
    if (found) return found;
  }
  return null;
}

function dig(value: unknown): { lat: number; lon: number } | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    return finitePair(value[1], value[0]) ? { lat: value[1], lon: value[0] } : null;
  }
  for (const item of value) {
    const found = dig(item);
    if (found) return found;
  }
  return null;
}

function numberTag(xml: string, tag: string): number {
  const match = new RegExp(`<${tag}>\\s*(-?\\d+(?:\\.\\d+)?)\\s*</${tag}>`, "i").exec(xml);
  const value = match ? Number(match[1]) : 0;
  return Number.isFinite(value) ? value : 0;
}

function looksLikePair(text: string): boolean {
  return pointFromPair(text) !== null || pointFromDms(text) !== null;
}

function num(value: string | undefined): number {
  const parsed = Number((value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function finitePair(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").slice(0, 80) || "Lieu";
}
