// « Phrase → scène »: a small rule-based agent. It reads one sentence in French,
// English, German or Spanish and lays out the maquette with the mannequins and
// props it already has. No language model, no network, no credit.

import { addFigure, addNeutral, linePositions, remember, type CastBody, type MaquetteState, type Orbit } from "./state.ts";
import { PATH_SECONDS, addProp, type Keyframe, type PropKind } from "./scene.ts";
import { applyTuile } from "./state.ts";

export type CameraMove = "avant" | "arriere" | "tour" | "pano" | "plongee" | "fixe";

export interface SceneReading {
  people: number | null;
  names: string[];
  props: PropKind[];
  move: CameraMove | null;
  night: boolean;
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
  ["arriere", /(travelling arri[eè]re|recul|pull[- ]?back|dolly[- ]?out|zieht? (sich )?zur[üu]ck|r[üu]ckfahrt|alejamiento|se aleja|retrocede)/],
  ["avant", /(travelling( avant)?|avanc|push[- ]?in|dolly[- ]?in|zoom|approche|move[s]? in|fahrt|n[äa]her|heran|acercamiento|se acerca|avance)/],
  ["tour", /(tourne autour|autour d|orbit|circle|around|um .* herum|kreis|alrededor|circular|360)/],
  ["pano", /(panoramique|pano\b|pan\b|pans\b|panning|schwenk|paneo|barrido)/],
  ["plongee", /(plong[ée]e|vue d'en haut|du dessus|from above|top[- ]?down|bird|von oben|vogel|picado|desde arriba|cenital)/],
  ["fixe", /(plan fixe|\bfixe\b|static|still shot|statisch|feste kamera|fija|est[áa]tica)/],
];

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
  const move = MOVES.find(([, pattern]) => pattern.test(hay))?.[0] ?? null;
  return { people: people === null ? null : Math.max(1, Math.min(6, people)), names, props, move, night: NIGHT.test(hay) };
}

/** Five seconds of camera for a named move, starting from `from`. */
export function pathFor(move: CameraMove | null, from: Orbit): Keyframe[] {
  const end = PATH_SECONDS;
  const at = (t: number, orbit: Partial<Orbit>): Keyframe => ({ t, orbit: { ...from, ...orbit } });
  switch (move) {
    case "avant": return [at(0, { radius: Math.max(from.radius, 9) }), at(end, { radius: 3.4 })];
    case "arriere": return [at(0, { radius: 3.4 }), at(end, { radius: Math.max(from.radius, 10) })];
    case "tour": return [at(0, {}), at(end / 2, { theta: from.theta + Math.PI / 2 }), at(end, { theta: from.theta + Math.PI })];
    case "pano": return [at(0, { theta: from.theta - 0.6 }), at(end, { theta: from.theta + 0.6 })];
    case "plongee": return [at(0, { phi: 0.55, radius: Math.max(from.radius, 8) }), at(end, { phi: 1.2, radius: Math.max(from.radius, 6) })];
    case "fixe": return [at(0, {}), at(end, {})];
    default: return [];
  }
}

/** Lays the maquette out from the sentence. One undo step brings the old scene back. */
export function composeScene(state: MaquetteState, phrase: string, cast: readonly CastBody[] = [], neutralName = "Personnage"): { state: MaquetteState; reading: SceneReading } {
  const reading = readPhrase(phrase, cast);
  let next: MaquetteState = { ...remember(state) };
  const past = next.past;
  if (reading.people !== null || reading.names.length > 0) {
    const want = Math.max(reading.people ?? 0, reading.names.length);
    const lead = state.figures[0];
    const chosen = reading.names.length > 0 ? reading.names : lead ? [lead.id] : [];
    next = { ...next, figures: [] };
    for (const id of chosen.slice(0, want)) {
      const person = cast.find(item => item.id === id) ?? (lead && lead.id === id ? { id, name: lead.name } : null);
      if (person) next = addFigure(next, person);
    }
    while (next.figures.length < want) next = addNeutral(next, neutralName);
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
  const path = pathFor(reading.move, next.orbit);
  if (path.length > 0) next = { ...next, path, orbit: { ...path[0].orbit } };
  return { state: { ...next, past }, reading };
}
