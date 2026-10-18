// Production memory, per project, in the vault (`.uttu/memoire.json`, mirrored as Obsidian notes under `Memoire/`).
// Three levels: permanent identity (character + canon), character state (dated from a shot until the next change),
// shot context (what the intention of that shot says). A new take inherits the first two automatically.

import { fold } from "../intention/words.ts";

export const MEMOIRE_FILE = ".uttu/memoire.json";
export const MEMOIRE_VERSION = 1;
export const SEQUENCE_CODES = ["A", "B", "C", "D", "E", "F"] as const;
export type SequenceCode = (typeof SEQUENCE_CODES)[number];

export interface MemCharacter {
  id: string;
  name: string;
  aliases: string[];
  /** Permanent identity in plain words. */
  identity: string;
  /** Validated reference pictures (vault paths or public example paths). */
  refs: string[];
  /** The CAST card this character is bound to, when there is one. */
  castId: string | null;
}

export interface MemState {
  id: string;
  characterId: string;
  label: string;
  /** The shot (PRISE plan id) where this state starts. It runs until the next state of the same character. */
  fromPlan: string;
  fromCode: string;
  at: string;
  refs: string[];
}

export interface MemEnvironment {
  id: string;
  name: string;
  aliases: string[];
  note: string;
  refs: string[];
  decorId: string | null;
}

export interface MemShot {
  code: string;
  planId: string;
  intention: string;
}

export interface MemSequence {
  code: SequenceCode;
  title: string;
  shots: MemShot[];
}

export interface MemEvent {
  at: string;
  kind: "generation" | "correction" | "etat";
  shot: string;
  text: string;
}

export interface ProductionMemory {
  version: number;
  title: string;
  canon: { name: string; text: string };
  characters: MemCharacter[];
  states: MemState[];
  environments: MemEnvironment[];
  sequences: MemSequence[];
  history: MemEvent[];
}

export function emptySequences(): MemSequence[] {
  return SEQUENCE_CODES.map(code => ({ code, title: "", shots: [] }));
}

export function emptyMemory(title = ""): ProductionMemory {
  return { version: MEMOIRE_VERSION, title, canon: { name: "", text: "" }, characters: [], states: [], environments: [], sequences: emptySequences(), history: [] };
}

const text = (value: unknown, max = 2000): string => typeof value === "string" ? value.slice(0, max) : "";
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 24) : [];
const idOf = (value: unknown, fallback: string): string => typeof value === "string" && /^[\w.-]{1,80}$/.test(value) ? value : fallback;

/** Reads a stored memory. Anything malformed is dropped, never thrown. */
export function parseMemory(raw: string | undefined | null): ProductionMemory | null {
  if (!raw) return null;
  let data: Record<string, unknown>;
  try { data = JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
  if (!data || typeof data !== "object") return null;
  const memory = emptyMemory(text(data.title, 120));
  const canon = (data.canon ?? {}) as Record<string, unknown>;
  memory.canon = { name: text(canon.name, 80), text: text(canon.text) };
  memory.characters = (Array.isArray(data.characters) ? data.characters : []).map((item, index) => {
    const row = item as Record<string, unknown>;
    return { id: idOf(row.id, `perso-${index + 1}`), name: text(row.name, 80), aliases: strings(row.aliases), identity: text(row.identity), refs: strings(row.refs), castId: typeof row.castId === "string" ? row.castId : null };
  }).filter(item => item.name);
  memory.states = (Array.isArray(data.states) ? data.states : []).map((item, index) => {
    const row = item as Record<string, unknown>;
    return { id: idOf(row.id, `etat-${index + 1}`), characterId: text(row.characterId, 80), label: text(row.label, 120), fromPlan: text(row.fromPlan, 80), fromCode: text(row.fromCode, 12), at: text(row.at, 40), refs: strings(row.refs) };
  }).filter(item => item.characterId && item.label && item.fromPlan);
  memory.environments = (Array.isArray(data.environments) ? data.environments : []).map((item, index) => {
    const row = item as Record<string, unknown>;
    return { id: idOf(row.id, `lieu-${index + 1}`), name: text(row.name, 80), aliases: strings(row.aliases), note: text(row.note), refs: strings(row.refs), decorId: typeof row.decorId === "string" ? row.decorId : null };
  }).filter(item => item.name);
  const sequences = Array.isArray(data.sequences) ? data.sequences as Record<string, unknown>[] : [];
  memory.sequences = SEQUENCE_CODES.map(code => {
    const row = sequences.find(item => item?.code === code) ?? {};
    const shots = (Array.isArray(row.shots) ? row.shots : []).map(shot => {
      const value = shot as Record<string, unknown>;
      return { code: text(value.code, 12), planId: text(value.planId, 80), intention: text(value.intention, 400) };
    }).filter(shot => shot.code && shot.planId);
    return { code, title: text(row.title, 120), shots };
  });
  memory.history = (Array.isArray(data.history) ? data.history : []).slice(-200).map(item => {
    const row = item as Record<string, unknown>;
    const kind = row.kind === "correction" || row.kind === "etat" ? row.kind : "generation";
    return { at: text(row.at, 40), kind, shot: text(row.shot, 12), text: text(row.text, 400) } as MemEvent;
  });
  return memory;
}

export function memoryJson(memory: ProductionMemory): string {
  return `${JSON.stringify(memory, null, 2)}\n`;
}

function slug(value: string): string {
  return fold(value).replace(/\s+/g, "-").slice(0, 40) || "x";
}

export interface StudioSnapshot {
  title: string;
  cast: readonly { id: string; name: string; sheet?: string | null; photos?: readonly string[] }[];
  decor: readonly { id: string; name: string; stills?: readonly string[] }[];
  plans: readonly { id: string; action: string }[];
}

/** First open of an existing project: its CAST, DÉCOR and plans become the memory. Nothing is invented. */
export function migrateMemory(studio: StudioSnapshot): ProductionMemory {
  const memory = emptyMemory(studio.title);
  memory.characters = studio.cast.filter(card => card.name.trim()).map(card => ({ id: `perso-${slug(card.name)}`, name: card.name.trim(), aliases: [], identity: "", refs: card.sheet ? [card.sheet] : (card.photos ?? []).slice(0, 1), castId: card.id }));
  memory.environments = studio.decor.filter(card => card.name.trim()).map(card => ({ id: `lieu-${slug(card.name)}`, name: card.name.trim(), aliases: [], note: "", refs: (card.stills ?? []).slice(0, 1), decorId: card.id }));
  return syncShots(memory, studio.plans);
}

/** Keeps sequence A's numbered shots in step with the PRISE plan order (A-01, A-02…). Shots already filed elsewhere keep their code. */
export function syncShots(memory: ProductionMemory, plans: readonly { id: string; action: string }[]): ProductionMemory {
  const filed = new Map<string, MemShot>();
  for (const sequence of memory.sequences) for (const shot of sequence.shots) filed.set(shot.planId, shot);
  const sequences = memory.sequences.map(sequence => ({ ...sequence, shots: sequence.code === "A" ? [] as MemShot[] : sequence.shots.filter(shot => plans.some(plan => plan.id === shot.planId)) }));
  const others = new Set(sequences.filter(sequence => sequence.code !== "A").flatMap(sequence => sequence.shots.map(shot => shot.planId)));
  const a = sequences.find(sequence => sequence.code === "A")!;
  plans.filter(plan => !others.has(plan.id)).forEach((plan, index) => {
    a.shots.push({ code: `A-${String(index + 1).padStart(2, "0")}`, planId: plan.id, intention: plan.action.trim().slice(0, 400) || filed.get(plan.id)?.intention || "" });
  });
  return { ...memory, sequences };
}

export function shotCode(memory: ProductionMemory, planId: string): string {
  for (const sequence of memory.sequences) {
    const shot = sequence.shots.find(item => item.planId === planId);
    if (shot) return shot.code;
  }
  return "";
}

/** Storyboard position of a shot: sequence letter first, then its number. Unknown shots sort last. */
function position(memory: ProductionMemory, planId: string, fallbackCode = ""): number {
  const code = shotCode(memory, planId) || fallbackCode;
  const match = /^([A-F])-(\d{1,3})$/.exec(code);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return SEQUENCE_CODES.indexOf(match[1] as SequenceCode) * 1000 + Number(match[2]);
}

export function findCharacter(memory: ProductionMemory, card: { id?: string | null; name: string }): MemCharacter | null {
  const byCast = card.id ? memory.characters.find(item => item.castId === card.id) : undefined;
  if (byCast) return byCast;
  const key = fold(card.name);
  return memory.characters.find(item => [item.name, ...item.aliases].some(name => fold(name) === key)) ?? null;
}

export function findEnvironment(memory: ProductionMemory, card: { id?: string | null; name: string }): MemEnvironment | null {
  const byDecor = card.id ? memory.environments.find(item => item.decorId === card.id) : undefined;
  if (byDecor) return byDecor;
  const key = fold(card.name);
  return memory.environments.find(item => [item.name, ...item.aliases].some(name => fold(name) === key)) ?? null;
}

/** The state a character is in at this shot: the latest state that starts at or before it. */
export function activeState(memory: ProductionMemory, characterId: string, planId: string): MemState | null {
  const here = position(memory, planId);
  let best: MemState | null = null;
  let bestAt = -1;
  for (const state of memory.states) {
    if (state.characterId !== characterId) continue;
    const at = position(memory, state.fromPlan, state.fromCode);
    if (at <= here && at >= bestAt) { best = state; bestAt = at; }
  }
  return best;
}

export interface Inherited {
  characterId: string;
  name: string;
  identity: string;
  refs: string[];
  state: MemState | null;
  /** True when the state starts at this very shot (a change made here). */
  startsHere: boolean;
}

/** What a new take of this shot inherits for each character in it. */
export function inherit(memory: ProductionMemory, planId: string, who: readonly { id?: string | null; name: string }[]): Inherited[] {
  const rows: Inherited[] = [];
  for (const card of who) {
    const character = findCharacter(memory, card);
    if (!character) continue;
    const state = activeState(memory, character.id, planId);
    rows.push({ characterId: character.id, name: character.name, identity: character.identity, refs: character.refs, state, startsHere: Boolean(state && state.fromPlan === planId) });
  }
  return rows;
}

/** A new state from this shot on. A state that already started here is replaced; later shots keep their own changes. */
export function changeState(memory: ProductionMemory, characterId: string, planId: string, label: string, at: string, refs: string[] = []): ProductionMemory {
  const clean = label.replace(/\s+/g, " ").trim().slice(0, 120);
  const code = shotCode(memory, planId);
  const states = memory.states.filter(state => !(state.characterId === characterId && state.fromPlan === planId));
  if (clean) states.push({ id: `etat-${characterId}-${planId}`, characterId, label: clean, fromPlan: planId, fromCode: code, at, refs });
  const name = memory.characters.find(item => item.id === characterId)?.name ?? characterId;
  const history = [...memory.history, { at, kind: "etat" as const, shot: code, text: clean ? `${name} : ${clean}` : `${name} : état retiré` }].slice(-200);
  return { ...memory, states, history };
}

export function recordEvent(memory: ProductionMemory, event: MemEvent): ProductionMemory {
  return { ...memory, history: [...memory.history, event].slice(-200) };
}

/** Binds CAST/DÉCOR cards to memory entries by name, and adds cards the memory does not know yet. */
export function bindCards(memory: ProductionMemory, cast: StudioSnapshot["cast"], decor: StudioSnapshot["decor"]): ProductionMemory {
  const characters = memory.characters.map(item => ({ ...item }));
  for (const card of cast) {
    if (!card.name.trim()) continue;
    const found = characters.find(item => item.castId === card.id) ?? characters.find(item => [item.name, ...item.aliases].some(name => fold(name) === fold(card.name)));
    if (found) { found.castId = card.id; continue; }
    characters.push({ id: `perso-${slug(card.name)}`, name: card.name.trim(), aliases: [], identity: "", refs: card.sheet ? [card.sheet] : (card.photos ?? []).slice(0, 1), castId: card.id });
  }
  const environments = memory.environments.map(item => ({ ...item }));
  for (const card of decor) {
    if (!card.name.trim()) continue;
    const found = environments.find(item => item.decorId === card.id) ?? environments.find(item => [item.name, ...item.aliases].some(name => fold(name) === fold(card.name)));
    if (found) { found.decorId = card.id; continue; }
    environments.push({ id: `lieu-${slug(card.name)}`, name: card.name.trim(), aliases: [], note: "", refs: (card.stills ?? []).slice(0, 1), decorId: card.id });
  }
  return { ...memory, characters, environments };
}

/** The memory as Obsidian notes, next to the JSON. */
export function memoryMarkdown(memory: ProductionMemory, project: string): { file: string; text: string }[] {
  const banner = "";
  const files: { file: string; text: string }[] = [];
  const codeOf = (planId: string, fallback: string) => shotCode(memory, planId) || fallback || "?";
  files.push({ file: "Memoire/Canon.md", text: `---\ntype: canon\nprojet: ${project}\n---\n# ${memory.canon.name || "Canon"}\n\n${banner}${memory.canon.text || "_À écrire._"}\n` });
  for (const character of memory.characters) {
    const states = memory.states.filter(state => state.characterId === character.id).sort((a, b) => position(memory, a.fromPlan, a.fromCode) - position(memory, b.fromPlan, b.fromCode));
    const lines = states.map(state => `- depuis ${codeOf(state.fromPlan, state.fromCode)} : ${state.label}`);
    const refs = character.refs.map(ref => `- ${ref}`);
    files.push({ file: `Memoire/Personnage-${slug(character.name)}.md`, text: `---\ntype: personnage\nprojet: ${project}\nnom: "${character.name}"\nalias: [${character.aliases.map(alias => `"${alias}"`).join(", ")}]\n---\n# ${character.name}\n\n${banner}## Identité permanente\n\n${character.identity || "_À écrire._"}\n\n## Références validées\n\n${refs.join("\n") || "_Aucune._"}\n\n## États\n\n${lines.join("\n") || "_Aucun état daté._"}\n` });
  }
  for (const place of memory.environments) {
    files.push({ file: `Memoire/Lieu-${slug(place.name)}.md`, text: `---\ntype: environnement\nprojet: ${project}\nnom: "${place.name}"\n---\n# ${place.name}\n\n${banner}${place.note || "_À décrire._"}\n\n## Références validées\n\n${place.refs.map(ref => `- ${ref}`).join("\n") || "_Aucune._"}\n` });
  }
  const sequences = memory.sequences.map(sequence => `## Séquence ${sequence.code}${sequence.title ? ` — ${sequence.title}` : ""}\n\n${sequence.shots.map(shot => `- ${shot.code} · ${shot.intention || "_sans intention_"}`).join("\n") || "_Aucun plan._"}`);
  files.push({ file: "Memoire/Sequences.md", text: `---\ntype: storyboard\nprojet: ${project}\n---\n# ${memory.title || "Storyboard"}\n\n${banner}${sequences.join("\n\n")}\n` });
  files.push({ file: "Memoire/Historique.md", text: `---\ntype: historique\nprojet: ${project}\n---\n# Historique\n\n${memory.history.map(event => `- ${event.at.slice(0, 16).replace("T", " ")} · ${event.kind}${event.shot ? ` · ${event.shot}` : ""} · ${event.text}`).join("\n") || "_Vide._"}\n` });
  return files;
}
