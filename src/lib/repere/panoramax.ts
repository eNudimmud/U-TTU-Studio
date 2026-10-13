// Open street pictures. Panoramax needs no token. The thumbnail host stays on an allowlist.

export const PANORAMAX = "https://api.panoramax.xyz/api";

export interface PhotoRue {
  id: string;
  author: string;
  thumb: string;
  source: "panoramax" | "mapillary";
  license: string;
  tour: boolean;
}

export function panoramaxSearchUrl(lat: number, lon: number, radius: number, limit: number): string {
  const dLat = radius / 110_540;
  const dLon = radius / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map(value => value.toFixed(6)).join(",");
  const capped = Math.min(8, Math.max(1, Math.round(limit)));
  return `${PANORAMAX}/search?bbox=${bbox}&limit=${capped}`;
}

export function panoramaxByIdUrl(id: string): string {
  return `${PANORAMAX}/search?ids=${encodeURIComponent(id)}&limit=1`;
}

export function panoramaxThumbAllowed(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (host === "panoramax.xyz" || host.endsWith(".panoramax.xyz")) return true;
  if (host === "panoramax.ign.fr" || host.endsWith(".panoramax.ign.fr")) return true;
  if (host === "panoramax.openstreetmap.fr") return true;
  return false;
}

export function parsePanoramax(payload: unknown): PhotoRue[] {
  const features = payload && typeof payload === "object" && Array.isArray((payload as { features?: unknown }).features)
    ? (payload as { features: unknown[] }).features
    : [];
  const photos: PhotoRue[] = [];
  for (const row of features) {
    if (!row || typeof row !== "object") continue;
    const feature = row as {
      id?: unknown;
      properties?: {
        license?: unknown;
        "geovisio:producer"?: unknown;
        providers?: { name?: unknown }[];
        "pers:interior_orientation"?: { field_of_view?: unknown };
      };
      assets?: { thumb?: { href?: unknown } };
    };
    const id = typeof feature.id === "string" ? feature.id : "";
    if (!/^[0-9a-f-]{16,80}$/i.test(id)) continue;
    const thumb = typeof feature.assets?.thumb?.href === "string" ? feature.assets.thumb.href : "";
    if (!panoramaxThumbAllowed(thumb)) continue;
    const producer = feature.properties?.["geovisio:producer"];
    const provider = feature.properties?.providers?.find(item => typeof item?.name === "string")?.name;
    const author = (typeof producer === "string" && producer.trim()) || (typeof provider === "string" && provider.trim()) || "Panoramax";
    const raw = typeof feature.properties?.license === "string" ? feature.properties.license.trim() : "";
    const fov = Number(feature.properties?.["pers:interior_orientation"]?.field_of_view);
    photos.push({
      id,
      author: author.slice(0, 80),
      thumb,
      source: "panoramax",
      license: (raw || "etalab-2.0").slice(0, 40),
      tour: Number.isFinite(fov) && fov >= 300,
    });
  }
  photos.sort((a, b) => Number(b.tour) - Number(a.tour));
  return photos.slice(0, 8);
}
