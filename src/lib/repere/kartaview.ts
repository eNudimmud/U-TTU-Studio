// KartaView (ex-OpenStreetCam): street photos from OSM mappers, CC BY-SA 4.0, no key.
// The server is slow at times: one request, given up after ~4 s so the picker never waits for it.
// It answers the nearest photo of each drive. Some cameras shoot 2:1 spheres it files as flat.

import { distanceMeters, type PhotoRue } from "./panoramax.ts";

export const KARTAVIEW_API = "https://api.kartaview.org/2.0/photo/";
export const KARTAVIEW_DELAI = 4_000;

export function kartaviewUrl(lat: number, lon: number, radius = 250, limit = 100): string {
  const params = new URLSearchParams({
    lat: lat.toFixed(6), lng: lon.toFixed(6),
    radius: String(Math.min(500, Math.max(10, Math.round(radius)))),
    itemsPerPage: String(Math.min(100, Math.max(1, Math.round(limit)))),
  });
  return `${KARTAVIEW_API}?${params}`;
}

export function kartaviewThumbAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
    return /^storage\d{1,3}\.openstreetcam\.org$/.test(u.hostname) || u.hostname === "cdn.kartaview.org";
  } catch { return false; }
}

/** 2:1 frames from 360° cameras, or what KartaView itself marks as a sphere. */
export function sphereKartaview(row: { width?: unknown; height?: unknown; projection?: unknown; fieldOfView?: unknown }): boolean {
  const w = Number(row.width) || 0, h = Number(row.height) || 0;
  if (/^(SPHERE|EQUIRECTANGULAR)$/i.test(String(row.projection ?? ""))) return true;
  if (Number(row.fieldOfView) >= 300) return true;
  const ratio = w / Math.max(1, h);
  return w >= 3000 && ratio > 1.98 && ratio < 2.02;
}

/** The answer is a 200 even on errors: only apiCode 600 is a real list. */
export function parseKartaview(payload: unknown, lat: number, lon: number, radius = 250): PhotoRue[] {
  const body = payload as { status?: { apiCode?: unknown }; result?: { data?: unknown } } | null;
  if (Number(body?.status?.apiCode) !== 600 || !Array.isArray(body?.result?.data)) return [];
  const out: PhotoRue[] = [];
  for (const raw of body.result.data) {
    const row = raw as Record<string, unknown>;
    const id = String(row.id ?? "");
    if (!/^\d{1,20}$/.test(id) || row.visibility === "private" || row.status === "deleted") continue;
    const plat = Number(row.lat), plon = Number(row.lng);
    if (!Number.isFinite(plat) || !Number.isFinite(plon) || Math.abs(plat) > 90 || Math.abs(plon) > 180) continue;
    if (distanceMeters(lat, lon, plat, plon) > radius) continue;
    const tour = sphereKartaview(row);
    const small = typeof row.fileurlLTh === "string" ? row.fileurlLTh : "";
    const full = typeof row.fileurlProc === "string" ? row.fileurlProc : "";
    if (!kartaviewThumbAllowed(small)) continue;
    // A sphere is turned in the viewer: it needs the full frame. A flat shot is fine at the large thumbnail.
    const view = tour && kartaviewThumbAllowed(full) ? full : small;
    const seq = String(row.sequenceId ?? "");
    const index = String(row.sequenceIndex ?? "");
    const heading = Number(row.heading);
    out.push({
      id: `kv-${id}`,
      author: "KartaView contributors",
      thumb: small,
      view,
      source: "kartaview",
      license: "CC-BY-SA-4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      sourceUrl: /^\d+$/.test(seq) && /^\d+$/.test(index) ? `https://kartaview.org/details/${seq}/${index}/track-info` : "https://kartaview.org/",
      tour,
      lat: plat,
      lon: plon,
      heading: Number.isFinite(heading) ? heading : 0,
      fov: tour ? 360 : null,
      next: null,
      prev: null,
      ...(/^\d+$/.test(seq) ? { serie: `kv:${seq}` } : {}),
    });
  }
  return out;
}
