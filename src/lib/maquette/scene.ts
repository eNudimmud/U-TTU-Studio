// What the previs adds to the maquette: props (primitives or an imported GLB),
// a camera path of keyframes with their time, and the mesh budget for phones.
// Pure functions. Positions stay in the browser.

import { FLOOR, RADIUS_MAX, RADIUS_MIN, type MaquetteState, type Orbit } from "./state.ts";

export const PROP_KINDS = ["caisse", "mur", "voiture", "arbre", "lampadaire", "table", "glb"] as const;
export type PropKind = (typeof PROP_KINDS)[number];
export const MAX_PROPS = 16;
export const MAX_KEYS = 8;
/** Seconds of previs: LTX IC-LoRA follows 5 s. */
export const PATH_SECONDS = 5;

export interface Prop {
  id: string;
  kind: PropKind;
  /** Shown in the list. For a GLB, the file name. */
  name: string;
  x: number;
  z: number;
  yaw: number;
  /** Object URL of an imported GLB. Never uploaded. */
  url?: string;
}

export interface Keyframe {
  /** Seconds from the start of the previs, 0 to PATH_SECONDS. */
  t: number;
  orbit: Orbit;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function addProp(state: MaquetteState, kind: PropKind, extra: { name?: string; url?: string; x?: number; z?: number; yaw?: number } = {}): MaquetteState {
  const props = state.props ?? [];
  if (props.length >= MAX_PROPS) return state;
  let n = 1;
  while (props.some(item => item.id === `${kind}-${n}`)) n += 1;
  const prop: Prop = {
    id: `${kind}-${n}`,
    kind,
    name: extra.name ?? kind,
    x: clamp(extra.x ?? ((n % 3) - 1) * 1.6, -FLOOR, FLOOR),
    z: clamp(extra.z ?? -1.5, -FLOOR, FLOOR),
    yaw: extra.yaw ?? 0,
    ...(extra.url ? { url: extra.url } : {}),
  };
  return { ...state, props: [...props, prop] };
}

export function moveProp(state: MaquetteState, id: string, x: number, z: number): MaquetteState {
  if (state.lockPose) return state;
  return { ...state, props: (state.props ?? []).map(item => item.id === id ? { ...item, x: clamp(x, -FLOOR, FLOOR), z: clamp(z, -FLOOR, FLOOR) } : item) };
}

export function removeProp(state: MaquetteState, id: string): MaquetteState {
  return { ...state, props: (state.props ?? []).filter(item => item.id !== id) };
}

/** Records the current camera at `t` seconds. Same time replaces; the list stays sorted. */
export function addKeyframe(state: MaquetteState, t: number): MaquetteState {
  const time = Math.round(clamp(t, 0, PATH_SECONDS) * 10) / 10;
  const kept = (state.path ?? []).filter(item => Math.abs(item.t - time) > 0.05);
  if (kept.length >= MAX_KEYS) return state;
  return { ...state, path: [...kept, { t: time, orbit: { ...state.orbit } }].sort((a, b) => a.t - b.t) };
}

export function removeKeyframe(state: MaquetteState, t: number): MaquetteState {
  return { ...state, path: (state.path ?? []).filter(item => Math.abs(item.t - t) > 0.05) };
}

export function clearPath(state: MaquetteState): MaquetteState {
  return { ...state, path: [] };
}

/** The next free time for a new key: after the last one, one second later. */
export function nextKeyTime(path: readonly Keyframe[] = []): number {
  if (path.length === 0) return 0;
  return Math.min(PATH_SECONDS, Math.round((path[path.length - 1].t + 1) * 10) / 10);
}

const ease = (u: number) => u * u * (3 - 2 * u);

/** Camera at `t` seconds: eased between keys, held before the first and after the last. */
export function orbitAt(path: readonly Keyframe[], t: number, fallback: Orbit): Orbit {
  if (path.length === 0) return fallback;
  if (t <= path[0].t) return { ...path[0].orbit };
  const last = path[path.length - 1];
  if (t >= last.t) return { ...last.orbit };
  const index = path.findIndex(item => item.t > t);
  const a = path[index - 1];
  const b = path[index];
  const u = ease((t - a.t) / Math.max(0.001, b.t - a.t));
  return {
    theta: a.orbit.theta + (b.orbit.theta - a.orbit.theta) * u,
    phi: a.orbit.phi + (b.orbit.phi - a.orbit.phi) * u,
    radius: clamp(a.orbit.radius + (b.orbit.radius - a.orbit.radius) * u, RADIUS_MIN, RADIUS_MAX),
  };
}

/** Triangles a phone keeps per imported model. */
export const PHONE_TRIANGLES = 20_000;
export const DESK_TRIANGLES = 80_000;

/**
 * How many vertices to remove so the model fits the budget, or 0 when it already fits.
 * Approximation: a closed mesh has about two triangles per vertex.
 */
export function decimation(triangles: number, vertices: number, mobile: boolean): number {
  const budget = mobile ? PHONE_TRIANGLES : DESK_TRIANGLES;
  if (!(triangles > budget) || !(vertices > 0)) return 0;
  const keep = budget / triangles;
  return Math.max(0, Math.floor(vertices * (1 - keep)));
}
