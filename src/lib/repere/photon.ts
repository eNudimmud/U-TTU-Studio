// Public Photon search. The browser calls it directly. One result, no autocomplete.

import type { LieuTrouve } from "./lieu.ts";

export const PHOTON = "https://photon.komoot.io/api/";

export function photonUrl(query: string): string {
  const url = new URL(PHOTON);
  url.searchParams.set("q", query.trim().slice(0, 120));
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", "fr");
  return url.toString();
}

export function parsePhoton(payload: unknown): LieuTrouve | null {
  const features = payload && typeof payload === "object" && Array.isArray((payload as { features?: unknown }).features)
    ? (payload as { features: unknown[] }).features
    : [];
  const feature = features[0];
  if (!feature || typeof feature !== "object") return null;
  const row = feature as { properties?: { name?: unknown }; geometry?: { coordinates?: unknown } };
  const coordinates = row.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lon = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  const name = typeof row.properties?.name === "string" ? row.properties.name.trim() : "";
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { name: name.slice(0, 80), lat, lon };
}
