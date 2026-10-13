// Overture building footprints. One public PMTiles tile, then the rings become local meters.
// OpenStreetMap stays the fallback when this tile is empty or refuses.

import { toLocal, type Batiment } from "./quartier.ts";

export const OVERTURE_BUILDINGS = "https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/2026-09-23.1/buildings.pmtiles";
export const OVERTURE_ZOOM = 14;

export interface OvertureShape {
  ring: { x: number; y: number }[];
  height: number;
  floors: number;
}

export function buildingHeight(height: number, floors: number): number {
  const meters = Number.isFinite(height) && height > 2 ? height : Number.isFinite(floors) && floors > 0 ? floors * 3 : 9;
  return Math.max(3, Math.min(80, Math.round(meters)));
}

export function pointOf(tileX: number, tileY: number, zoom: number, px: number, py: number, extent: number): [number, number] {
  const world = 2 ** zoom;
  const lon = ((tileX + px / extent) / world) * 360 - 180;
  const y = (tileY + py / extent) / world;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
  return [lat, lon];
}

export function buildingsFromShapes(
  shapes: readonly OvertureShape[],
  tile: { x: number; y: number; z: number },
  extent: number,
  originLat: number,
  originLon: number,
  rayon: number,
  cap: number,
): Batiment[] {
  const ranked: { building: Batiment; distance: number }[] = [];
  for (const shape of shapes) {
    if (shape.ring.length < 4) continue;
    const ring = shape.ring.map(point => {
      const [lat, lon] = pointOf(tile.x, tile.y, tile.z, point.x, point.y, extent);
      return toLocal(lat, lon, originLat, originLon);
    });
    const cx = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
    const cz = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
    const distance = Math.hypot(cx, cz);
    if (distance > rayon) continue;
    ranked.push({
      distance,
      building: { ring, height: buildingHeight(shape.height, shape.floors) },
    });
  }
  ranked.sort((a, b) => a.distance - b.distance);
  return ranked.slice(0, Math.max(0, cap)).map(item => item.building);
}
