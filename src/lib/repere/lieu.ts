// A real place, looked up once. Tiles are OpenFreeMap. The data stays OpenStreetMap, ODbL.
// One request a second, and only when the visitor asks. No autocomplete.

export const OSM_CREDIT = "© contributeurs OpenStreetMap, ODbL";
export const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/dark";
export const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export interface LieuExemple {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const LIEUX_EXEMPLE: readonly LieuExemple[] = [
  { id: "montmartre", name: "Montmartre", lat: 48.8867, lon: 2.3431 },
  { id: "shibuya", name: "Shibuya", lat: 35.6595, lon: 139.7005 },
  { id: "brooklyn", name: "Brooklyn Bridge", lat: 40.7061, lon: -73.9969 },
  { id: "geneve", name: "Genève", lat: 46.2044, lon: 6.1432 },
];

export interface LieuTrouve {
  name: string;
  lat: number;
  lon: number;
}

export type Regard = "debout" | "dessus";

export function nominatimUrl(query: string): string {
  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query.trim().slice(0, 120));
  return url.toString();
}

export function parseNominatim(payload: unknown): LieuTrouve | null {
  const row = Array.isArray(payload) ? payload[0] as { display_name?: unknown; lat?: unknown; lon?: unknown } | undefined : null;
  if (!row) return null;
  const lat = Number(row.lat);
  const lon = Number(row.lon);
  const name = typeof row.display_name === "string" ? row.display_name.split(",")[0]?.trim() ?? "" : "";
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { name: name.slice(0, 80), lat, lon };
}

export function lieuId(name: string): string {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return base || "lieu";
}

/** What the vault keeps. Plain words, no tile URL and no node. */
export function lieuNote(place: LieuTrouve, regard: Regard, autour: boolean): string {
  const view = regard === "dessus" ? "vue du dessus" : "debout dans la rue";
  const wide = autour ? " Alentours inclus." : "";
  return `${place.name} (${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}). Caméra : ${view}.${wide}`;
}

export function pitchFor(regard: Regard): number {
  return regard === "dessus" ? 0 : 62;
}

export function zoomFor(autour: boolean): number {
  return autour ? 15 : 17;
}
