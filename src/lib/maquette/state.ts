// The free maquette. Positions stay in the browser. Nothing here is a Comfy graph.
// Two figures at most: old phones keep a light scene.

import { tuileById, type TuileId } from "../cinema/tuiles.ts";

export const MAX_FIGURES = 2;
export const MAX_PIXEL_RATIO = 2;
export const FLOOR = 5;
export const RADIUS_MIN = 2.5;
export const RADIUS_MAX = 14;

export interface Figure {
  id: string;
  name: string;
  color: string;
  x: number;
  z: number;
  /** Arm lift, used by « Autre essai ». Not a skeleton. */
  pose: number;
}

export interface Orbit {
  theta: number;
  phi: number;
  radius: number;
}

export interface Frame {
  figures: Figure[];
  orbit: Orbit;
  tuile: TuileId;
}

export interface MaquetteState extends Frame {
  lockPose: boolean;
  lockCam: boolean;
  past: Frame[];
}

export interface CastBody {
  id: string;
  name: string;
}

const GOLD = "#d4af37";
const GREY = "#8a8f99";
const COLORS = [GOLD, GREY, "#c4b49a", "#8d7348"];

export const EXEMPLE_CAST: readonly CastBody[] = [
  { id: "uttu", name: "Uttu" },
  { id: "kael", name: "Kael" },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function frameOf(state: MaquetteState): Frame {
  return {
    figures: state.figures.map(item => ({ ...item })),
    orbit: { ...state.orbit },
    tuile: state.tuile,
  };
}

function remember(state: MaquetteState): MaquetteState {
  return { ...state, past: [...state.past, frameOf(state)].slice(-30) };
}

export function figuresFor(people: readonly CastBody[]): Figure[] {
  const source = people.length > 0 ? people : EXEMPLE_CAST;
  return source.slice(0, MAX_FIGURES).map((person, index) => ({
    id: person.id,
    name: person.name.trim() || (index === 0 ? "Uttu" : "Kael"),
    color: COLORS[index % COLORS.length],
    x: index === 0 ? -0.8 : 0.8,
    z: 0,
    pose: 0,
  }));
}

export function initialMaquette(people: readonly CastBody[] = []): MaquetteState {
  const preset = tuileById("taille");
  return {
    figures: figuresFor(people),
    orbit: { theta: preset.theta, phi: preset.phi, radius: preset.radius },
    tuile: "taille",
    lockPose: false,
    lockCam: false,
    past: [],
  };
}

/** Keep a figure the visitor already placed when the cast list changes. */
export function withPeople(state: MaquetteState, people: readonly CastBody[]): MaquetteState {
  const next = figuresFor(people);
  const figures = next.map(person => {
    const kept = state.figures.find(item => item.id === person.id);
    return kept ? { ...person, x: kept.x, z: kept.z, pose: kept.pose, color: person.color } : person;
  });
  const same = figures.length === state.figures.length && figures.every((item, index) => item.id === state.figures[index]?.id && item.x === state.figures[index]?.x);
  return same ? state : { ...state, figures };
}

export function moveFigure(state: MaquetteState, id: string, x: number, z: number): MaquetteState {
  if (state.lockPose) return state;
  const figures = state.figures.map(item => item.id === id
    ? { ...item, x: clamp(x, -FLOOR, FLOOR), z: clamp(z, -FLOOR, FLOOR) }
    : item);
  return { ...state, figures };
}

export function orbitDrag(state: MaquetteState, dx: number, dy: number): MaquetteState {
  if (state.lockCam) return state;
  return {
    ...state,
    orbit: {
      theta: state.orbit.theta - dx * 0.008,
      phi: clamp(state.orbit.phi - dy * 0.006, 0.4, 1.55),
      radius: state.orbit.radius,
    },
  };
}

export function nextRadius(radius: number, previousDistance: number, distance: number): number {
  if (!(distance > 0) || !(previousDistance > 0)) return radius;
  return clamp(radius * previousDistance / distance, RADIUS_MIN, RADIUS_MAX);
}

export function pinch(state: MaquetteState, previousDistance: number, distance: number): MaquetteState {
  if (state.lockCam) return state;
  return { ...state, orbit: { ...state.orbit, radius: nextRadius(state.orbit.radius, previousDistance, distance) } };
}

export function applyTuile(state: MaquetteState, id: TuileId): MaquetteState {
  const preset = tuileById(id);
  const orbit = state.lockCam ? state.orbit : { theta: preset.theta, phi: preset.phi, radius: preset.radius };
  return remember({ ...state, tuile: id, orbit });
}

export function autreEssai(state: MaquetteState, random: () => number = Math.random): MaquetteState {
  const next = remember(state);
  const figures = state.lockPose ? state.figures : state.figures.map((item, index) => ({
    ...item,
    x: clamp((index === 0 ? -1 : 1) * (0.4 + random() * 2.2), -FLOOR, FLOOR),
    z: clamp(random() * 3 - 1.5, -FLOOR, FLOOR),
    pose: (random() - 0.5) * 1.4,
  }));
  const orbit = state.lockCam ? state.orbit : {
    theta: state.orbit.theta + (random() - 0.5),
    phi: clamp(1.1 + random() * 0.4, 0.4, 1.55),
    radius: state.orbit.radius,
  };
  return { ...next, figures, orbit };
}

export function undoMaquette(state: MaquetteState): MaquetteState {
  const past = state.past.slice();
  const frame = past.pop();
  if (!frame) return state;
  return { ...state, ...frame, figures: frame.figures.map(item => ({ ...item })), orbit: { ...frame.orbit }, past };
}

export function toggleLock(state: MaquetteState, which: "pose" | "cam"): MaquetteState {
  return which === "pose" ? { ...state, lockPose: !state.lockPose } : { ...state, lockCam: !state.lockCam };
}

export type AstuceId = "bord" | "loin" | "tient";

export function astuce(state: MaquetteState): { id: AstuceId; name: string } {
  const [first, second] = state.figures;
  const name = first?.name || "Uttu";
  if (second) {
    const far = Math.hypot(first.x - second.x, first.z - second.z) > 4;
    if (far && state.tuile !== "large") return { id: "loin", name };
  }
  if (state.orbit.radius <= 3.2) return { id: "bord", name };
  return { id: "tient", name };
}

/** Cinema words for the request. No coordinates, no focal length, no matrix. */
export function captureLine(state: MaquetteState, label: string): string {
  const [first, second] = state.figures;
  const lead = first?.name || "Uttu";
  const side = !first ? "" : first.x < -0.35 ? `${lead} on the left` : first.x > 0.35 ? `${lead} on the right` : `${lead} near the middle`;
  const pair = second ? `${side}, facing ${second.name}` : side;
  const height = state.orbit.phi > 1.15 ? "eye level" : "slightly above";
  return `${pair}. ${label}. Camera at ${height}.`.replace(/\s+/g, " ").trim();
}
