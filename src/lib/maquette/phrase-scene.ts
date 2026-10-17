// « Phrase → scène »: a small rule-based agent. It reads one sentence in French,
// English, German or Spanish and lays out the maquette with the mannequins and
// props it already has. No language model, no network, no credit.

import { RADIUS_MAX, RADIUS_MIN, addFigure, linePositions, remember, type CastBody, type MaquetteState, type Orbit } from "./state.ts";
import { MAX_KEYS, PATH_SECONDS, addProp, type Keyframe, type PropKind } from "./scene.ts";
import { applyTuile } from "./state.ts";

export type CameraMove = "avant" | "arriere" | "tour" | "pano" | "contre" | "plongee" | "fixe";

export interface SceneReading {
  people: number | null;
  names: string[];
  props: PropKind[];
  move: CameraMove | null;
  night: boolean;
  /** « travelling arrière de 5 m »: metres asked for, before the maquette clamps them. */
  meters: number | null;
  /** « tourne de 90° », « demi-tour »: degrees asked for an orbit or a pan. */
  degrees: number | null;
  /** Pan or orbit direction: -1 left, 1 right. */
  side: -1 | 1 | null;
}

/** What the maquette really did with the camera intent, said before any render. */
export interface CameraPlan {
  path: Keyframe[];
  /** Metres or degrees actually laid out, when they differ from the sentence. */
  clamped: boolean;
  meters: number | null;
  degrees: number | null;
}

const NUMBERS: Record<string, number> = {
  un: 1, une: 1, seul: 1, seule: 1, one: 1, alone: 1, ein: 1, eine: 1, allein: 1, uno: 1, una: 1, solo: 1, sola: 1,
  deux: 2, two: 2, zwei: 2, dos: 2, couple: 2, duo: 2, pair: 2, paar: 2, pareja: 2,
  trois: 3, three: 3, drei: 3, tres: 3,
  quatre: 4, four: 4, vier: 4, cuatro: 4,
};

const PEOPLE = /(perso(nnage)?s?|gens|personnes?|people|characters?|persons?|figures?|actors?|acteurs?|leute|personen|figuren|figuras?|personajes?|actores?)/;

const PROP_WORDS: [PropKind, RegExp][] = [
  ["voiture", /\b(voitures?|autos?|cars?|wagen|coches?|taxis?)\b/],
  ["mur", /\b(murs?|murets?|walls?|wände|wand|mauer|paredes?|muros?)\b/],
  ["arbre", /\b(arbres?|trees?|bäume|baum|árbol(es)?|arbol(es)?)\b/],
  ["lampadaire", /\b(lampadaires?|réverbères?|reverberes?|streetlights?|street ?lamps?|lamp ?posts?|laternen?|straßenlaternen?|farolas?)\b/],
  ["table", /\b(tables?|tisch(e)?|mesas?|bureau|desk)\b/],
  ["caisse", /\b(caisses?|cartons?|boxes|box|crates?|kisten?|cajas?|cajón)\b/],
];

const MOVES: [CameraMove, RegExp][] = [
  ["arriere", /(travelling arri[eè]re|recul|pull[- ]?back|pull[s]? out|dolly[- ]?out|track(s|ing)? (back|out)|zieht? (sich )?zur[üu]ck|r[üu]ckfahrt|r[üu]ckw[äa]rts|alejamiento|se aleja|retrocede|travelling (hacia )?atr[áa]s)/],
  ["avant", /(travelling( avant)?|avanc|push[- ]?in|dolly[- ]?in|track(s|ing)? (in|forward)|zoom|approche|move[s]? in|fahrt|n[äa]her|heran|vorw[äa]rts|acercamiento|se acerca|avance)/],
  ["tour", /(tourne autour|tour complet|demi[- ]tour autour|autour d|orbit|circle|around|um .* herum|umkreis|kreis|alrededor|circular|gira en torno|360)/],
  ["pano", /(panoramique|pano\b|pan\b|pans\b|panning|schwenk|paneo|barrido)/],
  ["contre", /(contre[- ]?plong[ée]e|vue d'en bas|low[- ]?angle|from below|worm'?s[- ]?eye|froschperspektive|untersicht|von unten|contrapicado|desde abajo)/],
  ["plongee", /(plong[ée]e|vue d'en haut|du dessus|from above|top[- ]?down|high[- ]?angle|bird|von oben|vogel|aufsicht|picado|desde arriba|cenital)/],
  ["fixe", /(plan fixe|\bfixe\b|static|still shot|statisch|feste kamera|fija|est[áa]tica)/],
];

const METERS = /(\d{1,3}(?:[.,]\d)?)\s?(?:m|m[eè]tres?|meters?|metres?|metros?)\b/;
const DEGREES = /(\d{1,3})\s?(?:°|degr[ée]s?|degrees?|grad|grados?)/;
const HALF = /(demi[- ]tour|half (a )?(turn|circle)|halbe? (drehung|kreis|runde)|media vuelta)/;
const FULL = /(tour complet|full (turn|circle|orbit)|ganze[nr]? (kreis|runde|drehung)|vuelta completa|360)/;
const LEFT = /(gauche|\bleft\b|links|izquierda)/;
const RIGHT = /(droite|\bright\b|rechts|derecha)/;

const NIGHT = /(nuit|night|nacht|noche|soir|evening|abend)/;

function fold(text: string): string {
  return ` ${text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ")} `;
}

export function readPhrase(phrase: string, cast: readonly CastBody[] = []): SceneReading {
  const hay = fold(phrase);
  let people: number | null = null;
  const count = hay.match(new RegExp(`\\b(\\d{1,2}|${Object.keys(NUMBERS).join("|")})\\s+${PEOPLE.source}`));
  if (count) people = /^\d+$/.test(count[1]) ? Number(count[1]) : NUMBERS[count[1]];
  else if (/\b(seule?|alone|allein|sol[oa])\b/.test(hay)) people = 1;
  const names = cast.filter(person => person.name.trim() && hay.includes(` ${person.name.trim().toLowerCase()}`)).map(person => person.id);
  const props: PropKind[] = [];
  for (const [kind, pattern] of PROP_WORDS) {
    const hit = hay.match(pattern);
    if (!hit) continue;
    const before = hay.slice(0, hit.index).trim().split(" ").pop() ?? "";
    const many = /^\d+$/.test(before) ? Number(before) : NUMBERS[before] ?? (/^(des|quelques|plusieurs|some|several|mehrere|einige|unos|unas|varios|varias)$/.test(before) ? 2 : 1);
    const copies = kind === "mur" ? 1 : Math.max(1, Math.min(3, many));
    for (let index = 0; index < copies; index++) props.push(kind);
  }
  // Contre-plongée before plongée: the longer word wins.
  const contre = MOVES.find(([kind]) => kind === "contre")![1].test(hay);
  const move = contre ? "contre" : MOVES.find(([, pattern]) => pattern.test(hay))?.[0] ?? null;
  const meterHit = hay.match(METERS);
  const degreeHit = hay.match(DEGREES);
  const degrees = degreeHit ? Number(degreeHit[1]) : HALF.test(hay) ? 180 : FULL.test(hay) ? 360 : null;
  const side = LEFT.test(hay) ? -1 : RIGHT.test(hay) ? 1 : null;
  return {
    people: people === null ? null : Math.max(1, Math.min(6, people)), names, props, move, night: NIGHT.test(hay),
    meters: meterHit ? Number(meterHit[1].replace(",", ".")) : null,
    degrees: degrees !== null && degrees > 0 ? Math.min(720, degrees) : null,
    side,
  };
}

const clampRadius = (value: number) => Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * The camera intent as a five-second path. Maquette units are metres, the
 * orbit radius stays between RADIUS_MIN and RADIUS_MAX: a longer travelling is
 * clamped and said so.
 */
export function cameraPlan(reading: Pick<SceneReading, "move" | "meters" | "degrees" | "side">, from: Orbit): CameraPlan {
  const end = PATH_SECONDS;
  const at = (t: number, orbit: Partial<Orbit>): Keyframe => ({ t: round1(t), orbit: { ...from, ...orbit } });
  const span = RADIUS_MAX - RADIUS_MIN;
  const none: CameraPlan = { path: [], clamped: false, meters: null, degrees: null };
  switch (reading.move) {
    case "avant":
    case "arriere": {
      const asked = reading.meters;
      if (asked === null) {
        const path = reading.move === "avant"
          ? [at(0, { radius: Math.max(from.radius, 9) }), at(end, { radius: 3.4 })]
          : [at(0, { radius: 3.4 }), at(end, { radius: Math.max(from.radius, 10) })];
        return { path, clamped: false, meters: null, degrees: null };
      }
      const meters = Math.min(asked, span);
      const near = reading.move === "avant" ? clampRadius(Math.max(RADIUS_MIN + 0.9, from.radius - meters)) : clampRadius(Math.min(from.radius, RADIUS_MAX - meters));
      const far = clampRadius(near + meters);
      const laid = round1(far - near);
      const path = reading.move === "avant" ? [at(0, { radius: far }), at(end, { radius: near })] : [at(0, { radius: near }), at(end, { radius: far })];
      return { path, clamped: laid !== round1(asked), meters: laid, degrees: null };
    }
    case "tour": {
      const degrees = reading.degrees ?? 180;
      const turn = (degrees * Math.PI) / 180 * (reading.side === -1 ? -1 : 1);
      const steps = Math.min(MAX_KEYS - 1, Math.max(2, Math.ceil(degrees / 90)));
      const path = Array.from({ length: steps + 1 }, (_, index) => at((end * index) / steps, { theta: from.theta + (turn * index) / steps }));
      return { path, clamped: false, meters: null, degrees: reading.degrees };
    }
    case "pano": {
      const degrees = Math.min(reading.degrees ?? 70, 180);
      const half = (degrees * Math.PI) / 360;
      const dir = reading.side === -1 ? -1 : 1;
      return { path: [at(0, { theta: from.theta - dir * half }), at(end, { theta: from.theta + dir * half })], clamped: reading.degrees !== null && reading.degrees > 180, meters: null, degrees: reading.degrees === null ? null : degrees };
    }
    case "plongee": return { ...none, path: [at(0, { phi: 0.55, radius: Math.max(from.radius, 8) }), at(end, { phi: 1.2, radius: Math.max(from.radius, 6) })] };
    // The maquette camera stays above the floor: a low angle sits at the horizon, close in.
    case "contre": return { ...none, path: [at(0, { phi: 1.45, radius: clampRadius(Math.min(from.radius, 6)) }), at(end, { phi: 1.55, radius: clampRadius(Math.min(from.radius, 4)) })] };
    case "fixe": return { ...none, path: [at(0, {}), at(end, {})] };
    default: return none;
  }
}

/** Five seconds of camera for a named move, starting from `from`. */
export function pathFor(move: CameraMove | null, from: Orbit): Keyframe[] {
  return cameraPlan({ move, meters: null, degrees: null, side: null }, from).path;
}

/**
 * Lays the maquette out from the sentence. One undo step brings the old scene back.
 * Only real CAST members are placed: « deux personnages » takes the named ones,
 * then the cast in order. A missing person is reported, never invented.
 */
export function composeScene(state: MaquetteState, phrase: string, cast: readonly CastBody[] = [], _neutralName = "Personnage"): { state: MaquetteState; reading: SceneReading; camera: CameraPlan; missing: number } {
  const reading = readPhrase(phrase, cast);
  let next: MaquetteState = { ...remember(state) };
  const past = next.past;
  let missing = 0;
  if (reading.people !== null || reading.names.length > 0) {
    const want = Math.max(reading.people ?? 0, reading.names.length);
    const lead = state.figures[0];
    const real = cast.filter(item => item.id && item.name.trim() && !item.id.startsWith("neutre-"));
    const order = [
      ...reading.names,
      ...(lead && !lead.id.startsWith("neutre-") ? [lead.id] : []),
      ...real.map(item => item.id),
    ].filter((id, index, list) => list.indexOf(id) === index);
    next = { ...next, figures: [] };
    for (const id of order) {
      if (next.figures.length >= want) break;
      const person = real.find(item => item.id === id) ?? (lead && lead.id === id ? { id, name: lead.name } : null);
      if (person) next = addFigure(next, person);
    }
    missing = Math.max(0, want - next.figures.length);
    const spots = linePositions(next.figures.length);
    next = { ...next, figures: next.figures.map((item, index) => ({ ...item, ...spots[index], yaw: next.figures.length === 2 ? (index === 0 ? Math.PI / 2.5 : -Math.PI / 2.5) : 0 })) };
  }
  if (reading.props.length > 0) {
    next = { ...next, props: (next.props ?? []).filter(item => item.kind === "glb") };
    reading.props.forEach((kind, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const spot = kind === "mur" ? { x: 0, z: -3.2 } : { x: side * (2.4 + Math.floor(index / 2) * 1.2), z: -1.2 - (index % 3) * 0.8 };
      next = addProp(next, kind, { ...spot, yaw: kind === "voiture" ? Math.PI / 2 : 0 });
    });
  }
  if (next.figures.length >= 2 && reading.move === null && next.tuile === "regard") next = applyTuile(next, "taille");
  const camera = cameraPlan(reading, next.orbit);
  if (camera.path.length > 0) next = { ...next, path: camera.path, orbit: { ...camera.path[0].orbit } };
  return { state: { ...next, past }, reading, camera, missing };
}
