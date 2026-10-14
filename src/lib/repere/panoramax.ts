// Open street pictures. Panoramax needs no token. Picture hosts stay on an allowlist.

export const PANORAMAX = "https://api.panoramax.xyz/api";
export const RUE_RAYON = 300;
export const RUE_RAYON_MAX = 3000;

export interface PhotoRue {
  id: string;
  author: string;
  thumb: string;
  view: string;
  source: "panoramax" | "mapillary";
  license: string;
  tour: boolean;
  lat: number;
  lon: number;
  heading: number;
  fov: number | null;
  next: string | null;
  prev: string | null;
  sourceUrl?: string;
  licenseUrl?: string;
}

export function panoramaxSearchUrl(lat: number, lon: number, radius = RUE_RAYON, limit = 20): string {
  const capped = Math.min(20, Math.max(1, Math.round(limit)));
  const rayon = Math.min(RUE_RAYON_MAX, Math.max(1, Math.round(radius)));
  const params = new URLSearchParams({
    place_position: `${lon.toFixed(6)},${lat.toFixed(6)}`,
    place_distance: `0-${rayon}`,
    limit: String(capped),
  });
  return `${PANORAMAX}/search?${params}`;
}

export function panoramaxByIdUrl(id: string): string {
  return `${PANORAMAX}/search?ids=${encodeURIComponent(id)}&limit=1`;
}

export function panoramaxThumbAllowed(url: string, federatedHosts: ReadonlySet<string> = new Set()): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return false;
  const host = parsed.hostname.toLowerCase();
  if (host === "panoramax.xyz" || host.endsWith(".panoramax.xyz")) return true;
  if (host === "panoramax.ign.fr" || host.endsWith(".panoramax.ign.fr")) return true;
  if (host === "panoramax.openstreetmap.fr") return true;
  return federatedHosts.has(host);
}

export function licenseLabel(raw: string): string {
  const text = raw.trim();
  return (text || "Licence non précisée").slice(0, 80);
}

/** Only explicitly identified open licences may be copied into a project. */
export function reusablePhoto(photo: Pick<PhotoRue, "license" | "author">): boolean {
  return /^(?:CC-BY(?:-SA)?-(?:2\.0|2\.5|3\.0|4\.0)|CC0-1\.0|etalab-2\.0)$/i.test(photo.license)
    && Boolean(photo.author.trim()) && !/^(Panoramax|Mapillary)$/.test(photo.author);
}

export function photoSourceUrl(photo: Pick<PhotoRue, "source" | "id">): string {
  return photo.source === "panoramax"
    ? `https://api.panoramax.xyz/#pic=${encodeURIComponent(photo.id)}`
    : `https://www.mapillary.com/app/?pKey=${encodeURIComponent(photo.id)}&focus=photo`;
}

export function photoLicenseUrl(license: string): string {
  const cc = /^CC-(BY(?:-SA)?)-(2\.0|2\.5|3\.0|4\.0)$/i.exec(license);
  if (cc) return `https://creativecommons.org/licenses/${cc[1].toLowerCase()}/${cc[2]}/`;
  if (/^CC0-1\.0$/i.test(license)) return "https://creativecommons.org/publicdomain/zero/1.0/";
  if (/^etalab-2\.0$/i.test(license)) return "https://www.etalab.gouv.fr/licence-ouverte-open-licence/";
  return "";
}

/** Origins come only from the federated catalogue, never from a pasted URL. */
export function parseInstanceHosts(payload: unknown): string[] {
  const rows = (payload as { instances?: { url?: unknown }[] } | null)?.instances;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap(row => {
    try {
      const url = new URL(String(row?.url));
      return url.protocol === "https:" && !url.username && !url.password && !url.port
        && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) && !/\.(local|localhost|internal)$/i.test(url.hostname)
        ? [url.hostname.toLowerCase()] : [];
    } catch { return []; }
  });
}

export function distanceMeters(lat: number, lon: number, otherLat: number, otherLon: number): number {
  const x = (otherLon - lon) * Math.cos((lat * Math.PI) / 180) * 111_320;
  const z = (otherLat - lat) * 110_540;
  return Math.hypot(x, z);
}

export interface CadrePano {
  fullWidth: number;
  fullHeight: number;
  croppedWidth: number;
  croppedHeight: number;
  croppedX: number;
  croppedY: number;
}

/** A full sphere when the picture is 360° or already 2:1. Otherwise a window of the given field of view. */
export function cadrePano(photo: { tour: boolean; fov: number | null }, width: number, height: number): CadrePano {
  const ratio = width / Math.max(1, height);
  if (photo.tour || (ratio > 1.85 && ratio < 2.15)) {
    return { fullWidth: width, fullHeight: height, croppedWidth: width, croppedHeight: height, croppedX: 0, croppedY: 0 };
  }
  const fov = photo.fov && photo.fov > 8 && photo.fov < 220 ? photo.fov : 75;
  const fullWidth = Math.max(width + 2, Math.round(width * (360 / fov)));
  const fullHeight = Math.round(fullWidth / 2);
  return {
    fullWidth,
    fullHeight,
    croppedWidth: width,
    croppedHeight: height,
    croppedX: Math.round((fullWidth - width) / 2),
    croppedY: Math.max(0, Math.round((fullHeight - height) / 2)),
  };
}

function linkId(links: { rel?: unknown; href?: unknown }[] | undefined, rel: string): string | null {
  const href = links?.find(item => item?.rel === rel)?.href;
  if (typeof href !== "string") return null;
  const id = href.split("?")[0]?.split("/").pop() ?? "";
  return /^[0-9a-f-]{16,80}$/i.test(id) ? id : null;
}

export function parsePanoramax(payload: unknown, federatedHosts: ReadonlySet<string> = new Set()): PhotoRue[] {
  const features = payload && typeof payload === "object" && Array.isArray((payload as { features?: unknown }).features)
    ? (payload as { features: unknown[] }).features
    : [];
  const photos: PhotoRue[] = [];
  for (const row of features) {
    if (!row || typeof row !== "object") continue;
    const feature = row as {
      id?: unknown;
      geometry?: { coordinates?: unknown };
      links?: { rel?: unknown; href?: unknown }[];
      providers?: { name?: unknown }[];
      properties?: {
        license?: unknown;
        "geovisio:producer"?: unknown;
        "view:azimuth"?: unknown;
        providers?: { name?: unknown }[];
        "pers:interior_orientation"?: { field_of_view?: unknown };
      };
      assets?: { hd?: { href?: unknown }; sd?: { href?: unknown }; thumb?: { href?: unknown } };
    };
    const id = typeof feature.id === "string" ? feature.id : "";
    if (!/^[0-9a-f-]{16,80}$/i.test(id)) continue;
    const thumb = typeof feature.assets?.thumb?.href === "string" ? feature.assets.thumb.href : "";
    const sd = typeof feature.assets?.sd?.href === "string" ? feature.assets.sd.href : "";
    const hd = typeof feature.assets?.hd?.href === "string" ? feature.assets.hd.href : "";
    const view = [sd, hd, thumb].find(url => panoramaxThumbAllowed(url, federatedHosts)) ?? "";
    if (!view) continue;
    const producer = feature.properties?.["geovisio:producer"];
    const provider = (feature.providers ?? feature.properties?.providers)?.find(item => typeof item?.name === "string")?.name;
    const author = (typeof producer === "string" && producer.trim()) || (typeof provider === "string" && provider.trim()) || "Panoramax";
    const raw = typeof feature.properties?.license === "string" ? feature.properties.license.trim() : "";
    const fov = Number(feature.properties?.["pers:interior_orientation"]?.field_of_view);
    const knownFov = Number.isFinite(fov) && fov > 0 ? fov : null;
    const coords = feature.geometry?.coordinates;
    const lon = Array.isArray(coords) ? Number(coords[0]) : Number.NaN;
    const lat = Array.isArray(coords) ? Number(coords[1]) : Number.NaN;
    const heading = Number(feature.properties?.["view:azimuth"]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    photos.push({
      id,
      author: author.slice(0, 80),
      thumb: panoramaxThumbAllowed(thumb, federatedHosts) ? thumb : view,
      view,
      source: "panoramax",
      license: licenseLabel(raw),
      licenseUrl: photoLicenseUrl(raw),
      sourceUrl: photoSourceUrl({ source: "panoramax", id }),
      tour: knownFov !== null && knownFov >= 300,
      lat: Number.isFinite(lat) ? lat : 0,
      lon: Number.isFinite(lon) ? lon : 0,
      heading: Number.isFinite(heading) ? heading : 0,
      fov: knownFov,
      next: linkId(feature.links, "next"),
      prev: linkId(feature.links, "prev"),
    });
  }
  return photos.slice(0, 20);
}

/** Order the pictures of one sequence and start on the closest to the chosen point. */
export function chaineRue(photos: PhotoRue[], lat: number, lon: number): { photos: PhotoRue[]; start: number } {
  if (photos.length === 0) return { photos: [], start: 0 };
  const byId = new Map(photos.map(photo => [photo.id, photo]));
  const closest = [...photos].sort((a, b) => distanceMeters(lat, lon, a.lat, a.lon) - distanceMeters(lat, lon, b.lat, b.lon))[0];
  const seen = new Set<string>([closest.id]);
  const back: PhotoRue[] = [];
  let cursor = closest;
  for (let step = 0; step < 40 && cursor.prev && byId.has(cursor.prev) && !seen.has(cursor.prev); step += 1) {
    cursor = byId.get(cursor.prev)!;
    seen.add(cursor.id);
    back.push(cursor);
  }
  back.reverse();
  const forward: PhotoRue[] = [];
  cursor = closest;
  for (let step = 0; step < 40 && cursor.next && byId.has(cursor.next) && !seen.has(cursor.next); step += 1) {
    cursor = byId.get(cursor.next)!;
    seen.add(cursor.id);
    forward.push(cursor);
  }
  // Keep nearby independent sequences too: an unlinked closest photo is not the whole coverage.
  const remaining = photos.filter(photo => !seen.has(photo.id))
    .sort((a, b) => distanceMeters(lat, lon, a.lat, a.lon) - distanceMeters(lat, lon, b.lat, b.lon));
  return { photos: [...back, closest, ...forward, ...remaining], start: back.length };
}
