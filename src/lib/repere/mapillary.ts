// Mapillary is optional. Prefer MAPILLARY_TOKEN on the server (/api/repere/mapillary).
// NEXT_PUBLIC_MAPILLARY_TOKEN remains a fallback. Without either, Mapillary stays off.

export const MAPILLARY = "https://graph.mapillary.com";

export interface RuePhoto {
  id: string;
  author: string;
  thumb: string;
  camera: string;
  view: string;
  lat: number;
  lon: number;
  heading: number;
  sequence?: string;
  pano?: boolean;
}

export function mapillaryImagesUrl(lat: number, lon: number, limit: number, radius = 300): string {
  const capped = Math.min(8, Math.max(1, Math.round(limit)));
  const metres = Math.min(3000, Math.max(1, radius));
  const dy = metres / 110_540;
  const dx = metres / (111_320 * Math.max(0.01, Math.cos(lat * Math.PI / 180)));
  const bbox = [Math.max(-180, lon - dx), Math.max(-90, lat - dy), Math.min(180, lon + dx), Math.min(90, lat + dy)];
  const params = new URLSearchParams({
    fields: "id,thumb_256_url,thumb_1024_url,creator,camera_type,geometry,compass_angle",
    bbox: bbox.join(","),
    limit: String(capped),
  });
  return `${MAPILLARY}/images?${params}`;
}

export const MAPILLARY_FIELDS = "id,thumb_256_url,thumb_1024_url,thumb_2048_url,creator,camera_type,geometry,compass_angle,sequence,is_pano";

/** Pictures inside an area (west, south, east, north). Mapillary caps a bbox request at 2000; the studio asks 100. */
export function mapillaryBboxUrl(bbox: readonly [number, number, number, number], limit = 100): string {
  const params = new URLSearchParams({
    fields: MAPILLARY_FIELDS,
    bbox: bbox.map(n => n.toFixed(6)).join(","),
    limit: String(Math.min(100, Math.max(1, Math.round(limit)))),
  });
  return `${MAPILLARY}/images?${params}`;
}

export const MAPILLARY_ATTRIBUTION = "© Mapillary contributors, CC BY-SA";

/** Optional browser-exposed token. Prefer the server MAPILLARY_TOKEN via /api/repere/mapillary. */
export function mapillaryToken(): string {
  return (process.env.NEXT_PUBLIC_MAPILLARY_TOKEN ?? "").trim();
}

/** Server-only token. Never log or put this in a response body. */
export function mapillaryServerToken(): string {
  return (process.env.MAPILLARY_TOKEN ?? process.env.NEXT_PUBLIC_MAPILLARY_TOKEN ?? "").trim();
}

export function photoCredit(author: string, source: "mapillary" | "panoramax" = "mapillary", license = "CC BY-SA"): string {
  const name = author.trim().slice(0, 80) || (source === "panoramax" ? "Panoramax" : "Mapillary");
  const who = source === "panoramax" ? "Panoramax" : "Mapillary";
  const right = (license || "CC BY-SA").trim().slice(0, 40);
  return `© ${name}, ${who}, ${right}`;
}

export function fixturePhotos(): { id: string; author: string; source: "panoramax"; license: string }[] {
  return [
    { id: "fixture-ada", author: "Ada Rue", source: "panoramax", license: "CC BY-SA" },
    { id: "fixture-nils", author: "Nils Quai", source: "panoramax", license: "CC BY-SA" },
  ];
}

export function thumbAllowed(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (host === "graph.mapillary.com") return false;
  if (host === "mapillary.com" || host.endsWith(".mapillary.com")) return true;
  if (host === "fbcdn.net" || host.endsWith(".fbcdn.net")) return true;
  return false;
}

export function parseMapillary(payload: unknown, max = 8): RuePhoto[] {
  const data = payload && typeof payload === "object" && "data" in payload ? payload.data : null;
  if (!Array.isArray(data)) return [];
  const photos: RuePhoto[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const item = row as { id?: unknown; thumb_256_url?: unknown; thumb_1024_url?: unknown; thumb_2048_url?: unknown; geometry?: { coordinates?: unknown }; compass_angle?: unknown; creator?: { username?: unknown }; camera_type?: unknown; sequence?: unknown; is_pano?: unknown };
    const id = typeof item.id === "string" || typeof item.id === "number" ? String(item.id) : "";
    if (!/^\d{1,30}$/.test(id)) continue;
    const thumb = typeof item.thumb_256_url === "string" ? item.thumb_256_url : "";
    if (!thumbAllowed(thumb)) continue;
    const raw = typeof item.creator?.username === "string" ? item.creator.username.trim() : "";
    const author = raw.slice(0, 80) || "Mapillary";
    const camera = typeof item.camera_type === "string" ? item.camera_type : "";
    const coords = item.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const lon = Number(coords[0]), lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const pano = item.is_pano === true || /equirectangular|spherical/i.test(camera);
    // A sphere needs its widest picture to be turned; a flat shot is fine at 1024.
    const wide = pano && typeof item.thumb_2048_url === "string" && thumbAllowed(item.thumb_2048_url) ? item.thumb_2048_url : "";
    const view = wide || (typeof item.thumb_1024_url === "string" && thumbAllowed(item.thumb_1024_url) ? item.thumb_1024_url : thumb);
    const sequence = typeof item.sequence === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(item.sequence) ? item.sequence : "";
    photos.push({ id, author, thumb, camera, view, lat, lon, heading: Number(item.compass_angle) || 0, ...(sequence ? { sequence } : {}), ...(pano ? { pano } : {}) });
  }
  return photos.slice(0, Math.min(100, max));
}
