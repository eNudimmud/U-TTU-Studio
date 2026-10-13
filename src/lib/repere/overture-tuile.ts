import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import { buildingsFromShapes, type OvertureShape } from "./overture.ts";
import type { Batiment } from "./quartier.ts";

export function buildingsInTile(
  data: ArrayBuffer,
  tile: { x: number; y: number; z: number },
  originLat: number,
  originLon: number,
  rayon: number,
  cap: number,
): Batiment[] {
  const decoded = new VectorTile(new Pbf(data));
  const layer = decoded.layers.building;
  if (!layer) return [];
  const shapes: OvertureShape[] = [];
  for (let index = 0; index < layer.length; index += 1) {
    const feature = layer.feature(index);
    if (feature.type !== 3 || feature.properties.is_underground === true) continue;
    const outer = feature.loadGeometry()[0];
    if (!outer || outer.length < 4) continue;
    shapes.push({
      ring: outer.map(point => ({ x: point.x, y: point.y })),
      height: Number(feature.properties.height),
      floors: Number(feature.properties.num_floors),
    });
  }
  return buildingsFromShapes(shapes, tile, layer.extent || 4096, originLat, originLon, rayon, cap);
}
