// « Voir où il y a des photos »: free coverage tiles drawn over the map, so a
// location scout clicks where street photos exist instead of guessing.
// Panoramax tiles are open and need no key. Mapillary only comes in with the
// project's public client token; without it nothing is asked of Mapillary.

export const PANORAMAX_TILES = "https://api.panoramax.xyz/api/map/{z}/{x}/{y}.mvt";
export const MAPILLARY_TILES = "https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}";
export const COUVERTURE_GOLD = "#d4af37";
export const COUVERTURE_CREAM = "#f3e3a1";

export interface CouvertureSource {
  id: string;
  spec: { type: "vector"; tiles: string[]; minzoom: number; maxzoom: number; attribution: string };
}

export interface CouvertureLayer {
  id: string;
  type: "line" | "circle";
  source: string;
  "source-layer": string;
  minzoom?: number;
  layout?: Record<string, unknown>;
  paint: Record<string, unknown>;
}

export interface Couverture {
  sources: CouvertureSource[];
  layers: CouvertureLayer[];
  /** Short credit lines to show next to the map while the layer is on. */
  credits: string[];
  mapillary: boolean;
}

export const PANORAMAX_CREDIT = "Panoramax (CC BY-SA / licences des auteurs)";
export const MAPILLARY_CREDIT = "© Mapillary";

/** Builds the coverage overlay. `token` is the public Mapillary client token, or "" for Panoramax only. */
export function couverture(token: string): Couverture {
  const key = token.trim();
  const sources: CouvertureSource[] = [{
    id: "u-couv-panoramax",
    spec: { type: "vector", tiles: [PANORAMAX_TILES], minzoom: 0, maxzoom: 15, attribution: PANORAMAX_CREDIT },
  }];
  const layers: CouvertureLayer[] = [
    {
      id: "u-couv-panoramax-traces", type: "line", source: "u-couv-panoramax", "source-layer": "sequences",
      layout: { "line-cap": "round" },
      paint: { "line-color": COUVERTURE_GOLD, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1, 14, 4, 18, 6], "line-opacity": 0.85 },
    },
    {
      id: "u-couv-panoramax-photos", type: "circle", source: "u-couv-panoramax", "source-layer": "pictures", minzoom: 15,
      paint: { "circle-color": COUVERTURE_GOLD, "circle-radius": ["interpolate", ["linear"], ["zoom"], 15, 3, 18, 7], "circle-stroke-color": "#000000", "circle-stroke-width": 1 },
    },
  ];
  if (key) {
    const tile = `${MAPILLARY_TILES}?access_token=${encodeURIComponent(key)}`;
    sources.push({ id: "u-couv-mapillary", spec: { type: "vector", tiles: [tile], minzoom: 6, maxzoom: 14, attribution: MAPILLARY_CREDIT } });
    layers.push(
      {
        id: "u-couv-mapillary-traces", type: "line", source: "u-couv-mapillary", "source-layer": "sequence",
        layout: { "line-cap": "round" },
        paint: { "line-color": COUVERTURE_CREAM, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.8, 14, 3, 18, 5], "line-opacity": 0.7, "line-dasharray": [2, 1] },
      },
      {
        id: "u-couv-mapillary-photos", type: "circle", source: "u-couv-mapillary", "source-layer": "image", minzoom: 14,
        paint: { "circle-color": COUVERTURE_CREAM, "circle-radius": 3, "circle-stroke-color": "#000000", "circle-stroke-width": 1 },
      },
    );
  }
  return { sources, layers, credits: key ? [PANORAMAX_CREDIT, MAPILLARY_CREDIT] : [PANORAMAX_CREDIT], mapillary: Boolean(key) };
}

/** The slice of the MapLibre map this overlay needs. */
export interface CouvertureMap {
  getSource(id: string): unknown;
  getLayer(id: string): unknown;
  addSource(id: string, spec: object): void;
  addLayer(layer: object): void;
  removeLayer(id: string): void;
  removeSource(id: string): void;
}

/** Adds or removes the overlay; idempotent, safe to call again after a style reload. */
export function applyCouverture(map: CouvertureMap, on: boolean, overlay: Couverture): void {
  if (on) {
    for (const source of overlay.sources) if (!map.getSource(source.id)) map.addSource(source.id, source.spec);
    for (const layer of overlay.layers) if (!map.getLayer(layer.id)) map.addLayer(layer);
    return;
  }
  for (const layer of [...overlay.layers].reverse()) if (map.getLayer(layer.id)) map.removeLayer(layer.id);
  for (const source of overlay.sources) if (map.getSource(source.id)) map.removeSource(source.id);
}
