// Free street-photo coverage, described for the current 3D scout.
// The deleted 2D map (repere-carte.tsx) is not restored. These layers are credits
// and tile addresses only: nothing here fetches a tile or a photo.

export const PANORAMAX_TILES = "https://api.panoramax.xyz/api/map/{z}/{x}/{y}.mvt";
export const MAPILLARY_TILES = "https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}";
export const PANORAMAX_CREDIT = "Panoramax (CC BY-SA / licences des auteurs)";
export const MAPILLARY_CREDIT = "© Mapillary";

export interface CoverageLayer {
  id: string;
  credit: string;
  tiles: string;
}

/** Panoramax always. Mapillary only when a public client token is configured. */
export function coverageLayers(token: string): CoverageLayer[] {
  const layers: CoverageLayer[] = [{ id: "panoramax", credit: PANORAMAX_CREDIT, tiles: PANORAMAX_TILES }];
  const key = token.trim();
  if (key) layers.push({ id: "mapillary", credit: MAPILLARY_CREDIT, tiles: `${MAPILLARY_TILES}?access_token=${encodeURIComponent(key)}` });
  return layers;
}

/** One line for the scout credit card. The token itself is never written. */
export function coverageCredits(token: string): string {
  return coverageLayers(token).map(layer => layer.credit).join(" · ");
}
