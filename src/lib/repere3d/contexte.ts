// What the kept frame shows, read from the OpenFreeMap shapes already downloaded for the 3D view.
// No new request: names of parks and water in front of the camera, how tall the buildings are,
// the camera itself and the sun. Feeds the décor prompt and the 2–3 tags on screen 3. Pure, testable.

import { focalFor } from "./capture.ts";
import { headingOf } from "./geo.ts";
import type { AreaKind, Ring } from "./osm-tiles.ts";
import type { Sun } from "./sun.ts";

export type Cote = "gauche" | "face" | "droite" | "autour";
export type Silhouette = "tours" | "immeubles" | "bas" | "aucun";

export interface ContexteInput {
  place: { name: string; detail?: string };
  /** Local metres (x east, z south), the same frame as the shapes. */
  camera: { x: number; z: number; heading: number; pitch: number; fov: number; height: number };
  areas: readonly { outer: Ring; kind: AreaKind; name?: string }[];
  buildings: readonly { outer: Ring; height: number }[];
  sun?: Sun;
  /** Width over height of the frame. */
  aspect?: number;
  /** How far the frame "sees", in metres. */
  reach?: number;
}

export interface ZoneVue { name: string; kind: AreaKind; cote: Cote; distance: number }

export interface Contexte {
  place: string;
  city: string;
  country: string;
  zones: ZoneVue[];
  kinds: AreaKind[];
  tallest: number;
  typical: number;
  silhouette: Silhouette;
  camera: { height: number; heading: number; pitch: number; focal: number };
  sun: Sun | null;
}

const NATURE: readonly AreaKind[] = ["park", "water", "wood", "grass", "sand"];

function wrap180(deg: number): number {
  return ((deg % 360) + 540) % 360 - 180;
}

function insideRing(x: number, z: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

/** Horizontal half field of view in degrees, from the vertical one and the frame aspect. */
export function demiChamp(fov: number, aspect: number): number {
  return Math.atan(Math.tan(fov * Math.PI / 360) * aspect) * 180 / Math.PI;
}

/** City and country from Photon's « city, state, country » line, without repeats. */
export function villePays(name: string, detail = ""): { city: string; country: string } {
  const parts = detail.split(",").map(part => part.trim()).filter(Boolean);
  if (parts.length === 0) return { city: "", country: "" };
  const country = parts.length > 1 ? parts[parts.length - 1] : "";
  const city = parts[0] === name ? (parts.length > 2 ? parts[1] : "") : parts[0];
  return { city: city === country ? "" : city, country };
}

export function lireContexte(input: ContexteInput): Contexte {
  const { camera } = input;
  const half = demiChamp(camera.fov, input.aspect ?? 16 / 9);
  const reach = input.reach ?? 1200;
  const seen = (x: number, z: number, far = reach) => {
    const dx = x - camera.x, dz = z - camera.z;
    const d = Math.hypot(dx, dz);
    if (d > far) return null;
    if (d < 1) return { d, diff: 0 };
    const diff = wrap180(headingOf(dx, dz) - camera.heading);
    return Math.abs(diff) <= half + 4 ? { d, diff } : null;
  };
  const cote = (diff: number): Cote => diff < -half / 3 ? "gauche" : diff > half / 3 ? "droite" : "face";

  const zones = new Map<string, ZoneVue>();
  const kinds = new Set<AreaKind>();
  for (const area of input.areas) {
    if (!NATURE.includes(area.kind) || area.outer.length < 3) continue;
    // Nearest visible point for the distance, the mean bearing of the visible points for the side.
    let best: { d: number; diff: number } | null = null;
    let sum = 0, count = 0;
    const step = Math.max(1, Math.floor(area.outer.length / 48));
    for (let i = 0; i < area.outer.length; i += step) {
      const hit = seen(area.outer[i][0], area.outer[i][1]);
      if (!hit) continue;
      sum += hit.diff;
      count += 1;
      if (!best || hit.d < best.d) best = { d: hit.d, diff: 0 };
    }
    if (best) best.diff = sum / count;
    const around = insideRing(camera.x, camera.z, area.outer);
    if (!best && !around) continue;
    kinds.add(area.kind);
    if (!area.name) continue;
    const zone: ZoneVue = { name: area.name, kind: area.kind, cote: around ? "autour" : cote(best!.diff), distance: around ? 0 : Math.round(best!.d) };
    const held = zones.get(area.name);
    if (!held || zone.distance < held.distance) zones.set(area.name, zone);
  }

  const heights: number[] = [];
  for (const b of input.buildings) {
    if (b.outer.length < 3) continue;
    let cx = 0, cz = 0;
    for (const [x, z] of b.outer) { cx += x; cz += z; }
    if (seen(cx / b.outer.length, cz / b.outer.length, Math.min(reach, 900))) heights.push(b.height);
  }
  heights.sort((a, b) => a - b);
  const tallest = Math.round(heights.at(-1) ?? 0);
  const typical = Math.round(heights[Math.floor(heights.length / 2)] ?? 0);
  const silhouette: Silhouette = heights.length === 0 ? "aucun" : tallest >= 100 ? "tours" : typical >= 15 || tallest >= 35 ? "immeubles" : "bas";
  const { city, country } = villePays(input.place.name, input.place.detail);
  return {
    place: input.place.name.trim().slice(0, 80),
    city,
    country,
    zones: [...zones.values()].sort((a, b) => a.distance - b.distance).slice(0, 3),
    kinds: NATURE.filter(kind => kinds.has(kind)),
    tallest,
    typical,
    silhouette,
    camera: { height: Math.round(Math.max(0, camera.height) * 10) / 10, heading: Math.round(((camera.heading % 360) + 360) % 360), pitch: Math.round(camera.pitch), focal: focalFor(camera.fov) },
    sun: input.sun ?? null,
  };
}

export type TagContexte = { kind: "ville"; text: string } | { kind: "zone"; text: string } | { kind: "nature"; key: AreaKind } | { kind: "silhouette"; key: Silhouette };

/** Two or three short tags for screen 3: the city, a named park or water, the skyline. */
export function tagsContexte(c: Contexte): TagContexte[] {
  const tags: TagContexte[] = [];
  const city = c.city || (c.place && c.place.length <= 28 ? c.place : "");
  if (city) tags.push({ kind: "ville", text: city });
  const zone = c.zones[0];
  if (zone) tags.push({ kind: "zone", text: zone.name });
  else if (c.kinds[0]) tags.push({ kind: "nature", key: c.kinds[0] });
  if (c.silhouette !== "aucun") tags.push({ kind: "silhouette", key: c.silhouette });
  return tags.slice(0, 3);
}

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"] as const;

export function boussole(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

const KIND_EN: Record<AreaKind, string> = { park: "park", water: "water", wood: "woods", grass: "lawn", sand: "sand", built: "built area" };
const SIDE_EN: Record<Cote, string> = { gauche: "on the left", face: "ahead", droite: "on the right", autour: "all around the camera" };
const SKY_EN: Record<Silhouette, string> = { tours: "skyscrapers", immeubles: "mid-rise city blocks", bas: "low-rise buildings", aucun: "few or no buildings" };

/** English lines for the décor prompt. The camera line comes first: keep the eye level. */
export function lignesContexte(c: Contexte): string[] {
  const where = [c.place, c.city, c.country].filter((part, i, all) => part && all.indexOf(part) === i).join(", ");
  const lines: string[] = [];
  if (where) lines.push(`The place is real: ${where}. Make it recognisable as this place.`);
  const eye = c.camera.height <= 3
    ? "The camera stands at street level, at a person's eye height (about 1.7 m above the ground)"
    : `The camera is about ${Math.round(c.camera.height)} m above the ground`;
  lines.push(`${eye}, looking ${boussole(c.camera.heading)}, ${c.camera.focal} mm lens, ${c.camera.pitch === 0 ? "level" : c.camera.pitch < 0 ? `tilted ${-c.camera.pitch}° down` : `tilted ${c.camera.pitch}° up`}. Keep this exact eye level and horizon: never raise, lower or move the camera.`);
  const seen = c.zones.map(zone => `${zone.name} (${KIND_EN[zone.kind]}) ${SIDE_EN[zone.cote]}`);
  const unnamed = c.kinds.filter(kind => !c.zones.some(zone => zone.kind === kind)).map(kind => KIND_EN[kind]);
  const sky = c.silhouette === "aucun" ? "" : `${SKY_EN[c.silhouette]}${c.tallest > 0 ? ` up to about ${c.tallest} m` : ""}`;
  const view = [...seen, ...unnamed, sky].filter(Boolean);
  if (view.length) lines.push(`In view: ${view.join("; ")}.`);
  if (c.sun) lines.push(`Sunlight from the ${boussole(c.sun.azimuth)}, about ${Math.round(c.sun.altitude)}° above the horizon.`);
  return lines;
}
