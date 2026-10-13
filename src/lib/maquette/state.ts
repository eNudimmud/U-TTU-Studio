// The free maquette. Positions stay in the browser. Nothing here is a Comfy graph.
// One figure at the start. The visitor adds the others. Bodies stay upright.

import { tuileById, tuileNeedsPair, type TuileId } from "../cinema/tuiles.ts";

export const MAX_FIGURES = 12;
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
  /** Yaw around the vertical axis. The body never pitches or rolls. */
  yaw: number;
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

/** Distinct on the brown floor. The second used to be grey and disappeared. */
const PALETTE = [
  "#d4af37",
  "#3d8bfd",
  "#e07a4a",
  "#3dba7a",
  "#d07adf",
  "#f4f0e6",
  "#e85d8c",
  "#5ec8e6",
  "#f0c14a",
  "#8fd18a",
  "#c4a574",
  "#9aa7ff",
];
const LINE_GAP = 1.85;

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

/** Standing rotation. X and Z stay 0 so the capsule cannot tip over. */
export function uprightRotation(yaw: number): { x: 0; y: number; z: 0 } {
  return { x: 0, y: yaw, z: 0 };
}

/** Side by side on the floor line, facing the camera. Nobody stands behind another. */
export function linePositions(count: number): { x: number; z: number }[] {
  if (count <= 0) return [];
  const gap = count <= 1 ? 0 : Math.min(LINE_GAP, 8 / (count - 1));
  const origin = ((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: clamp(index * gap - origin, -FLOOR, FLOOR),
    z: 0,
  }));
}

function alongLine(figures: Figure[]): Figure[] {
  const spots = linePositions(figures.length);
  return figures.map((item, index) => ({ ...item, x: spots[index].x, z: spots[index].z }));
}

function freshColor(figures: readonly Figure[]): string {
  const used = new Set(figures.map(item => item.color.toLowerCase()));
  return PALETTE.find(color => !used.has(color.toLowerCase())) ?? PALETTE[figures.length % PALETTE.length];
}

function makeFigure(person: CastBody, index: number): Figure {
  const place = linePositions(index + 1)[index] ?? { x: 0, z: 0 };
  return {
    id: person.id,
    name: person.name.trim() || "Uttu",
    color: PALETTE[index % PALETTE.length],
    x: place.x,
    z: place.z,
    yaw: 0,
    pose: 0,
  };
}

/** The scene opens on one person: the lead of the cast, or Uttu. */
export function figuresFor(people: readonly CastBody[]): Figure[] {
  return [makeFigure(people[0] ?? EXEMPLE_CAST[0], 0)];
}

export function initialMaquette(people: readonly CastBody[] = []): MaquetteState {
  const preset = tuileById("regard");
  return {
    figures: figuresFor(people),
    orbit: { theta: preset.theta, phi: preset.phi, radius: preset.radius },
    tuile: "regard",
    lockPose: false,
    lockCam: false,
    past: [],
  };
}

/** Replace the untouched starter once the cast has loaded. Later additions stay. */
export function seedLead(state: MaquetteState, person: CastBody): MaquetteState {
  if (state.figures.length !== 1 || state.past.length > 0) return state;
  const current = state.figures[0];
  if (!current || current.x !== 0 || current.z !== 0 || current.pose !== 0 || current.yaw !== 0) return state;
  if (current.id === person.id && current.name === (person.name.trim() || current.name)) return state;
  return { ...state, figures: [makeFigure(person, 0)] };
}

export function canAddFigure(state: MaquetteState): boolean {
  return state.figures.length < MAX_FIGURES;
}

export function addFigure(state: MaquetteState, person: CastBody): MaquetteState {
  const name = person.name.trim();
  if (!person.id || !name || !canAddFigure(state) || state.figures.some(item => item.id === person.id)) return state;
  const next = remember(state);
  const born = { ...makeFigure({ id: person.id, name }, state.figures.length), color: freshColor(state.figures) };
  return { ...next, figures: alongLine([...state.figures, born]) };
}

export function addNeutral(state: MaquetteState, name = "Personnage"): MaquetteState {
  let n = 1;
  while (state.figures.some(item => item.id === `neutre-${n}`)) n += 1;
  const label = n === 1 ? name : `${name} ${n}`;
  return addFigure(state, { id: `neutre-${n}`, name: label });
}

export function removeFigure(state: MaquetteState, id: string): MaquetteState {
  if (state.lockPose || !state.figures.some(item => item.id === id)) return state;
  const next = remember(state);
  const figures = state.figures.filter(item => item.id !== id);
  let tuile = state.tuile;
  let orbit = state.orbit;
  if (figures.length < 2 && tuileNeedsPair(tuile)) {
    const preset = tuileById("regard");
    tuile = "regard";
    if (!state.lockCam) orbit = { theta: preset.theta, phi: preset.phi, radius: preset.radius };
  }
  return { ...next, figures, tuile, orbit };
}

export function yawFigure(state: MaquetteState, id: string, delta: number): MaquetteState {
  if (state.lockPose) return state;
  let moved = false;
  const figures = state.figures.map(item => {
    if (item.id !== id) return item;
    moved = true;
    return { ...item, yaw: item.yaw + delta };
  });
  return moved ? { ...state, figures } : state;
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
  if (tuileNeedsPair(id) && state.figures.length < 2) return state;
  const preset = tuileById(id);
  const orbit = state.lockCam ? state.orbit : { theta: preset.theta, phi: preset.phi, radius: preset.radius };
  return remember({ ...state, tuile: id, orbit });
}

export function autreEssai(state: MaquetteState, random: () => number = Math.random): MaquetteState {
  const next = remember(state);
  const figures = state.lockPose ? state.figures : state.figures.map((item, index) => ({
    ...item,
    x: clamp((index - (state.figures.length - 1) / 2) * (0.7 + random() * 1.4), -FLOOR, FLOOR),
    z: clamp(random() * 2 - 1, -FLOOR, FLOOR),
    yaw: item.yaw + (random() - 0.5) * 1.2,
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

/** The action line, in the visitor's language. `link` is « et », « and », « und » or « y ». */
export function scenePhrase(names: readonly string[], shot: string, link = "et"): string {
  const clean = names.map(name => name.trim()).filter(Boolean);
  const raw = shot.trim();
  const body = raw ? raw.charAt(0).toLowerCase() + raw.slice(1) : "";
  const end = !body || /[.!?]$/.test(body) ? body : `${body}.`;
  if (clean.length === 0) return end;
  if (clean.length === 1) return `${clean[0]}, ${end}`.trim();
  if (clean.length === 2) return `${clean[0]} ${link} ${clean[1]}, ${end}`.trim();
  return `${clean.slice(0, -1).join(", ")} ${link} ${clean[clean.length - 1]}, ${end}`.trim();
}

/** Cinema words for the request. No coordinates, no focal length, no matrix. */
export function captureLine(state: MaquetteState, label: string): string {
  const names = state.figures.map(figure => figure.name);
  const lead = names[0];
  const height = state.orbit.phi > 1.15 ? "eye level" : "slightly above";
  let who = "An empty set";
  if (lead && names.length === 1) {
    const side = lead && state.figures[0].x < -0.35 ? "on the left" : state.figures[0].x > 0.35 ? "on the right" : "near the middle";
    who = `${lead} alone ${side}`;
  } else if (lead && names.length === 2) {
    const side = state.figures[0].x < -0.35 ? `${lead} on the left` : state.figures[0].x > 0.35 ? `${lead} on the right` : `${lead} near the middle`;
    who = `${side}, facing ${names[1]}`;
  } else if (lead) {
    who = `${lead} with ${names.slice(1).join(" and ")}`;
  }
  return `${who}. ${label}. Camera at ${height}.`.replace(/\s+/g, " ").trim();
}
