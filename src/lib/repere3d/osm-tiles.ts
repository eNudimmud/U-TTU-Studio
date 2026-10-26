// OpenFreeMap vector tiles (OpenMapTiles schema, OSM data) to plain shapes in local metres.
// Buildings keep their render_height. Walls cut by a tile edge are flagged so they are not drawn twice.

import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import type { LocalFrame, TileId } from "./geo.ts";

export type Ring = [number, number][];

export interface Building {
  outer: Ring;
  holes: Ring[];
  height: number;
  min: number;
  /** For each edge of the outer ring (i to i+1), true if it lies on a tile cut. */
  cut: boolean[];
}

export type RoadClass = "major" | "minor" | "path" | "rail";
export interface Road { line: Ring; kind: RoadClass }
export type AreaKind = "water" | "park" | "wood" | "built" | "sand" | "grass";
export interface Area { outer: Ring; holes: Ring[]; kind: AreaKind; /** OSM name when the tile carries one (parks, some water). */ name?: string }

export interface TileShapes { buildings: Building[]; roads: Road[]; areas: Area[] }

export const OPENFREEMAP_TILEJSON = "https://tiles.openfreemap.org/planet";

export function tileUrl(template: string, tile: TileId): string {
  return template.replace("{z}", String(tile.z)).replace("{x}", String(tile.x)).replace("{y}", String(tile.y));
}

export function parseTileJson(payload: unknown): string | null {
  const tiles = payload && typeof payload === "object" ? (payload as { tiles?: unknown }).tiles : null;
  const first = Array.isArray(tiles) ? tiles[0] : null;
  if (typeof first !== "string") return null;
  try {
    const url = new URL(first);
    if (url.protocol !== "https:" || url.hostname !== "tiles.openfreemap.org") return null;
  } catch {
    return null;
  }
  return first.includes("{z}") && first.includes("{x}") && first.includes("{y}") ? first : null;
}

function signedArea(ring: { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) sum += (ring[j].x - ring[i].x) * (ring[i].y + ring[j].y);
  return sum;
}

/** MVT rings to polygons: outer rings have positive area in tile space (y down), holes negative. */
export function classifyRings(rings: { x: number; y: number }[][]): { outer: { x: number; y: number }[]; holes: { x: number; y: number }[][] }[] {
  const polygons: { outer: { x: number; y: number }[]; holes: { x: number; y: number }[][] }[] = [];
  let ccw: boolean | undefined;
  for (const ring of rings) {
    const area = signedArea(ring);
    if (area === 0 || ring.length < 4) continue;
    if (ccw === undefined) ccw = area < 0;
    if (ccw === area < 0) polygons.push({ outer: ring, holes: [] });
    else polygons[polygons.length - 1]?.holes.push(ring);
  }
  return polygons;
}

type P = { x: number; y: number };

/** Sutherland–Hodgman clip of a closed ring to the tile square. Returns a closed ring or []. */
export function clipRing(ring: P[], extent: number): P[] {
  let pts = ring.length > 1 && ring[0].x === ring[ring.length - 1].x && ring[0].y === ring[ring.length - 1].y ? ring.slice(0, -1) : ring.slice();
  const edges: [(p: P) => boolean, (a: P, b: P) => P][] = [
    [p => p.x >= 0, (a, b) => ({ x: 0, y: a.y + (b.y - a.y) * (0 - a.x) / (b.x - a.x) })],
    [p => p.x <= extent, (a, b) => ({ x: extent, y: a.y + (b.y - a.y) * (extent - a.x) / (b.x - a.x) })],
    [p => p.y >= 0, (a, b) => ({ x: a.x + (b.x - a.x) * (0 - a.y) / (b.y - a.y), y: 0 })],
    [p => p.y <= extent, (a, b) => ({ x: a.x + (b.x - a.x) * (extent - a.y) / (b.y - a.y), y: extent })],
  ];
  for (const [keep, cross] of edges) {
    if (pts.length === 0) break;
    const next: P[] = [];
    for (let i = 0; i < pts.length; i += 1) {
      const cur = pts[i];
      const prev = pts[(i + pts.length - 1) % pts.length];
      const inCur = keep(cur);
      const inPrev = keep(prev);
      if (inCur) {
        if (!inPrev) next.push(cross(prev, cur));
        next.push(cur);
      } else if (inPrev) next.push(cross(prev, cur));
    }
    pts = next;
  }
  if (pts.length < 3) return [];
  return [...pts, pts[0]];
}

function onEdge(a: P, b: P, extent: number): boolean {
  const eps = 1;
  const at = (v: number, edge: number) => Math.abs(v - edge) <= eps;
  return (at(a.x, 0) && at(b.x, 0)) || (at(a.x, extent) && at(b.x, extent)) || (at(a.y, 0) && at(b.y, 0)) || (at(a.y, extent) && at(b.y, extent));
}

function roadKind(cls: unknown): RoadClass | null {
  switch (cls) {
    case "motorway": case "trunk": case "primary": case "secondary": return "major";
    case "tertiary": case "minor": case "service": case "busway": case "raceway": return "minor";
    case "path": case "track": case "pier": case "bridge": return "path";
    case "rail": case "transit": return "rail";
    default: return null;
  }
}

function areaKind(layer: string, cls: unknown): AreaKind | null {
  if (layer === "water") return "water";
  if (layer === "park") return "park";
  if (layer === "landcover") {
    if (cls === "wood") return "wood";
    if (cls === "grass" || cls === "farmland") return "grass";
    if (cls === "sand") return "sand";
    return null;
  }
  if (layer === "landuse") {
    if (cls === "residential" || cls === "commercial" || cls === "industrial" || cls === "retail") return "built";
    if (cls === "cemetery" || cls === "pitch" || cls === "playground") return "park";
    return null;
  }
  return null;
}

/** Clamp a tile point a little past the edge so neighbours overlap cleanly. */
function inside(p: { x: number; y: number }, extent: number, pad: number): boolean {
  return p.x >= -pad && p.x <= extent + pad && p.y >= -pad && p.y <= extent + pad;
}

export function decodeTile(bytes: Uint8Array, tile: TileId, frame: LocalFrame, radius: number): TileShapes {
  const vt = new VectorTile(new PbfReader(bytes));
  const out: TileShapes = { buildings: [], roads: [], areas: [] };
  const toLocal = (extent: number) => (p: { x: number; y: number }): [number, number] => {
    const q = frame.fromTile(tile, p.x, p.y, extent);
    return [round2(q.x), round2(q.z)];
  };
  const near = (ring: Ring) => ring.some(([x, z]) => Math.abs(x) < radius * 1.3 && Math.abs(z) < radius * 1.3);

  const building = vt.layers.building;
  if (building) {
    const map = toLocal(building.extent);
    for (let i = 0; i < building.length; i += 1) {
      const feature = building.feature(i);
      if (feature.type !== 3) continue;
      const height = Math.max(2, Math.min(700, Number(feature.properties.render_height) || 6));
      const min = Math.max(0, Math.min(height - 1, Number(feature.properties.render_min_height) || 0));
      for (const polygon of classifyRings(feature.loadGeometry())) {
        const ring = clipRing(polygon.outer, building.extent);
        if (ring.length < 4) continue;
        const outer = ring.map(map);
        if (!near(outer)) continue;
        const cut: boolean[] = [];
        for (let k = 0; k < ring.length - 1; k += 1) cut.push(onEdge(ring[k], ring[k + 1], building.extent));
        const holes = polygon.holes.map(h => clipRing(h, building.extent)).filter(h => h.length >= 4).map(h => h.map(map));
        out.buildings.push({ outer, holes, height, min, cut });
      }
    }
  }
  const transport = vt.layers.transportation;
  if (transport) {
    const map = toLocal(transport.extent);
    for (let i = 0; i < transport.length; i += 1) {
      const feature = transport.feature(i);
      if (feature.type !== 2) continue;
      const kind = roadKind(feature.properties.class);
      if (!kind) continue;
      for (const line of feature.loadGeometry()) {
        const pts = line.filter(p => inside(p, transport.extent, 64)).map(map);
        if (pts.length > 1 && near(pts)) out.roads.push({ line: pts, kind });
      }
    }
  }
  for (const name of ["water", "park", "landcover", "landuse"]) {
    const layer = vt.layers[name];
    if (!layer) continue;
    const map = toLocal(layer.extent);
    for (let i = 0; i < layer.length; i += 1) {
      const feature = layer.feature(i);
      if (feature.type !== 3) continue;
      const kind = areaKind(name, feature.properties.class);
      if (!kind) continue;
      for (const polygon of classifyRings(feature.loadGeometry())) {
        const ring = clipRing(polygon.outer, layer.extent);
        if (ring.length < 4) continue;
        const holes = polygon.holes.map(h => clipRing(h, layer.extent)).filter(h => h.length >= 4).map(h => h.map(map));
        const named = feature.properties["name:latin"] ?? feature.properties.name;
        const label = typeof named === "string" && named.trim() ? named.trim().slice(0, 60) : undefined;
        out.areas.push(label ? { outer: ring.map(map), holes, kind, name: label } : { outer: ring.map(map), holes, kind });
      }
    }
  }
  return out;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
