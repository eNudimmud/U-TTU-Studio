// Place search for the 3D repérage. Photon (komoot, OSM data, ODbL), never as-you-type.
// One request a second at most, results kept ten minutes, the browser sends its own Referer.
// Coordinates and map links never leave the browser.

import { parseSaisie } from "../repere/saisie.ts";

export const PHOTON_API = "https://photon.komoot.io/api/";

export interface Lieu3d {
  name: string;
  detail: string;
  lat: number;
  lon: number;
}

export type GeocodeResult =
  | { kind: "point"; lieu: Lieu3d }
  | { kind: "list"; lieux: Lieu3d[] }
  | { kind: "empty" }
  | { kind: "rate" }
  | { kind: "short" }
  | { kind: "offline" }
  | { kind: "fail" };

/** A minimum gap between calls, with an injectable clock for tests. */
export class Throttle {
  private last = -Infinity;
  private readonly gap: number;
  private readonly now: () => number;
  constructor(gap: number, now: () => number = Date.now) {
    this.gap = gap;
    this.now = now;
  }
  take(): boolean {
    const t = this.now();
    if (t - this.last < this.gap) return false;
    this.last = t;
    return true;
  }
  wait(): number {
    return Math.max(0, this.gap - (this.now() - this.last));
  }
}

export class TtlCache<T> {
  private readonly map = new Map<string, { at: number; value: T }>();
  private readonly ttl: number;
  private readonly now: () => number;
  private readonly max: number;
  constructor(ttl: number, now: () => number = Date.now, max = 50) {
    this.ttl = ttl;
    this.now = now;
    this.max = max;
  }
  get(key: string): T | null {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (this.now() - hit.at >= this.ttl) {
      this.map.delete(key);
      return null;
    }
    return hit.value;
  }
  set(key: string, value: T): void {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value as string);
    this.map.set(key, { at: this.now(), value });
  }
}

export function queryKey(query: string): string {
  return query.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);
}

export function photonSearchUrl(query: string, lang: string): string {
  const url = new URL(PHOTON_API);
  url.searchParams.set("q", query.trim().slice(0, 120));
  url.searchParams.set("limit", "5");
  url.searchParams.set("lang", ["fr", "en", "de"].includes(lang) ? lang : "default");
  return url.toString();
}

export function parsePhotonList(payload: unknown): Lieu3d[] {
  const features = payload && typeof payload === "object" && Array.isArray((payload as { features?: unknown }).features)
    ? (payload as { features: unknown[] }).features
    : [];
  const out: Lieu3d[] = [];
  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue;
    const row = feature as { properties?: Record<string, unknown>; geometry?: { coordinates?: unknown } };
    const c = row.geometry?.coordinates;
    if (!Array.isArray(c) || c.length < 2) continue;
    const lon = Number(c[0]);
    const lat = Number(c[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const p = row.properties ?? {};
    const text = (key: string) => typeof p[key] === "string" ? (p[key] as string).trim() : "";
    const name = text("name") || [text("street"), text("housenumber")].filter(Boolean).join(" ") || text("city");
    if (!name) continue;
    const detail = [text("city") !== name ? text("city") : "", text("state"), text("country")].filter(Boolean).join(", ");
    if (out.some(item => item.name === name && Math.abs(item.lat - lat) < 1e-3 && Math.abs(item.lon - lon) < 1e-3)) continue;
    out.push({ name: name.slice(0, 80), detail: detail.slice(0, 120), lat, lon });
  }
  return out;
}

export interface Geocoder {
  search(raw: string, lang: string): Promise<GeocodeResult>;
}

export function createGeocoder(fetcher: typeof fetch, options: { now?: () => number; gap?: number; online?: () => boolean } = {}): Geocoder {
  const now = options.now ?? Date.now;
  const throttle = new Throttle(options.gap ?? 1000, now);
  const cache = new TtlCache<Lieu3d[]>(10 * 60_000, now);
  const online = options.online ?? (() => typeof navigator === "undefined" || navigator.onLine !== false);
  return {
    async search(raw, lang) {
      const parsed = parseSaisie(raw);
      if (!parsed) return { kind: "empty" };
      if (parsed.kind === "point") return { kind: "point", lieu: { name: parsed.name, detail: "", lat: parsed.lat, lon: parsed.lon } };
      if (parsed.kind === "short") return { kind: "short" };
      const key = `${lang}:${queryKey(parsed.query)}`;
      const hit = cache.get(key);
      if (hit) return hit.length ? { kind: "list", lieux: hit } : { kind: "empty" };
      if (!online()) return { kind: "offline" };
      if (!throttle.take()) return { kind: "rate" };
      try {
        const response = await fetcher(photonSearchUrl(parsed.query, lang), { credentials: "omit", headers: { Accept: "application/json" } });
        if (response.status === 429) return { kind: "rate" };
        if (!response.ok) return { kind: "fail" };
        const lieux = parsePhotonList(await response.json());
        cache.set(key, lieux);
        return lieux.length ? { kind: "list", lieux } : { kind: "empty" };
      } catch {
        return online() ? { kind: "fail" } : { kind: "offline" };
      }
    },
  };
}
