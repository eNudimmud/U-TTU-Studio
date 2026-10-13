// Street photos from the Mapillary Graph API. The client token stays on the server.

export const MAPILLARY = "https://graph.mapillary.com";

export interface RuePhoto {
  id: string;
  author: string;
  thumb: string;
  camera: string;
}

export function mapillaryImagesUrl(lat: number, lon: number, limit: number): string {
  const capped = Math.min(8, Math.max(1, Math.round(limit)));
  const params = new URLSearchParams({
    fields: "id,thumb_256_url,creator,camera_type",
    lat: String(lat),
    lng: String(lon),
    radius: "50",
    limit: String(capped),
  });
  return `${MAPILLARY}/images?${params}`;
}

export function mapillaryImageUrl(id: string): string {
  return `${MAPILLARY}/${id}?fields=id,thumb_1024_url,creator`;
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

export function parseMapillary(payload: unknown): RuePhoto[] {
  const data = payload && typeof payload === "object" && "data" in payload ? payload.data : null;
  if (!Array.isArray(data)) return [];
  const photos: RuePhoto[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const item = row as { id?: unknown; thumb_256_url?: unknown; creator?: { username?: unknown }; camera_type?: unknown };
    const id = typeof item.id === "string" || typeof item.id === "number" ? String(item.id) : "";
    if (!/^\d{1,30}$/.test(id)) continue;
    const thumb = typeof item.thumb_256_url === "string" ? item.thumb_256_url : "";
    if (!thumbAllowed(thumb)) continue;
    const raw = typeof item.creator?.username === "string" ? item.creator.username.trim() : "";
    const author = raw.slice(0, 80) || "Mapillary";
    const camera = typeof item.camera_type === "string" ? item.camera_type : "";
    photos.push({ id, author, thumb, camera });
  }
  const flat = photos.filter(item => !/equirectangular|spherical/i.test(item.camera));
  return (flat.length > 0 ? flat : photos).slice(0, 8);
}
