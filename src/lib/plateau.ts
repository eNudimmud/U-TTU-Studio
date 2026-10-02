// A world on this device: a named place, previz stills, plate sequences, notes.
// Images themselves stay for the page session. Names and notes are what we keep.
// Nothing here calls a renderer or opens a .blend.

export const PLATEAU_STORAGE_KEY = "u-ttu-plateau";
export const TAKE_STORAGE_KEY = "u-ttu-take";

export const PLATEAU_SCENE_MAX = 8;
export const PLATEAU_STILL_MAX = 8;
export const PLATEAU_SEQUENCE_MAX = 4;
export const PLATEAU_FRAME_MAX = 48;
export const PLATEAU_NAME_MAX = 60;
export const PLATEAU_NOTE_MAX = 280;
export const TAKE_LINE_MAX = 180;

export interface PlateauStill {
  id: string;
  name: string;
  note: string;
}

export interface PlateauSequence {
  id: string;
  name: string;
  note: string;
  frames: string[];
}

export interface PlateauScene {
  id: string;
  name: string;
  note: string;
  angles: [string, string, string, string];
  stills: PlateauStill[];
  sequences: PlateauSequence[];
}

export interface PlateauBook {
  scenes: PlateauScene[];
}

export interface TakeNote {
  sceneId: string;
  line: string;
}

export function emptyPlateau(): PlateauBook {
  return { scenes: [] };
}

export function emptyTakeNote(): TakeNote {
  return { sceneId: "", line: "" };
}

export function clipPlateauText(value: string, max: number): string {
  return value.replace(/[\r\n]+/g, " ").replace(/[ \t]+/g, " ").trim().slice(0, max);
}

export function clipPlateauNote(value: string): string {
  return value.replace(/\r\n/g, "\n").trim().slice(0, PLATEAU_NOTE_MAX);
}

function clipId(value: string): string {
  return value.replace(/\s+/g, "").slice(0, 40);
}

function four(values: readonly string[]): PlateauScene["angles"] {
  return [
    clipPlateauText(values[0] ?? "", PLATEAU_NOTE_MAX),
    clipPlateauText(values[1] ?? "", PLATEAU_NOTE_MAX),
    clipPlateauText(values[2] ?? "", PLATEAU_NOTE_MAX),
    clipPlateauText(values[3] ?? "", PLATEAU_NOTE_MAX),
  ];
}

function cleanStill(value: unknown): PlateauStill | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? clipId(row.id) : "";
  const name = typeof row.name === "string" ? clipPlateauText(row.name, PLATEAU_NAME_MAX) : "";
  if (!id || !name) return null;
  const note = typeof row.note === "string" ? clipPlateauText(row.note, PLATEAU_NOTE_MAX) : "";
  return { id, name, note };
}

function cleanSequence(value: unknown): PlateauSequence | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? clipId(row.id) : "";
  if (!id) return null;
  const note = typeof row.note === "string" ? clipPlateauText(row.note, PLATEAU_NOTE_MAX) : "";
  const frames = Array.isArray(row.frames) ? row.frames : [];
  const names = frames
    .filter((item): item is string => typeof item === "string")
    .map(item => clipPlateauText(item, PLATEAU_NAME_MAX))
    .filter(Boolean)
    .slice(0, PLATEAU_FRAME_MAX);
  if (names.length === 0) return null;
  const name = typeof row.name === "string" ? clipPlateauText(row.name, PLATEAU_NAME_MAX) : "";
  return { id, name: name || "Suite", note, frames: names };
}

function cleanScene(value: unknown): PlateauScene | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? clipId(row.id) : "";
  if (!id) return null;
  const name = typeof row.name === "string" ? clipPlateauText(row.name, PLATEAU_NAME_MAX) : "";
  const note = typeof row.note === "string" ? clipPlateauNote(row.note) : "";
  const angles = Array.isArray(row.angles) ? row.angles.map(item => typeof item === "string" ? item : "") : [];
  const stills = Array.isArray(row.stills) ? row.stills.flatMap(item => {
    const still = cleanStill(item);
    return still ? [still] : [];
  }).slice(0, PLATEAU_STILL_MAX) : [];
  const sequences = Array.isArray(row.sequences) ? row.sequences.flatMap(item => {
    const sequence = cleanSequence(item);
    return sequence ? [sequence] : [];
  }).slice(0, PLATEAU_SEQUENCE_MAX) : [];
  return { id, name, note, angles: four(angles), stills, sequences };
}

export function cleanBook(book: PlateauBook): PlateauBook {
  const scenes: PlateauScene[] = [];
  const seen = new Set<string>();
  for (const scene of book.scenes) {
    const clean = cleanScene(scene);
    if (!clean || seen.has(clean.id)) continue;
    seen.add(clean.id);
    scenes.push(clean);
    if (scenes.length >= PLATEAU_SCENE_MAX) break;
  }
  return { scenes };
}

export function sceneHasPreviz(scene: PlateauScene): boolean {
  return scene.note.trim().length > 0
    || scene.angles.some(angle => angle.trim().length > 0)
    || scene.stills.length > 0
    || scene.sequences.length > 0;
}

function namedWorld(scene: PlateauScene): boolean {
  return scene.name.trim().length > 0 && sceneHasPreviz(scene);
}

/** A world is ready when it has a name and something brought from the desk: image, sequence, or note. */
export function worldReady(book: PlateauBook): boolean {
  return cleanBook(book).scenes.some(namedWorld);
}

export function readyWorlds(book: PlateauBook): PlateauScene[] {
  return cleanBook(book).scenes.filter(namedWorld);
}

export function createPlateauScene(name: string, id: string): PlateauScene | null {
  const clean = clipPlateauText(name, PLATEAU_NAME_MAX);
  if (!clean) return null;
  return cleanScene({ id, name: clean, note: "", angles: ["", "", "", ""], stills: [], sequences: [] });
}

export function parsePlateau(raw: string | null | undefined): PlateauBook {
  if (!raw) return emptyPlateau();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyPlateau();
  }
  if (!data || typeof data !== "object") return emptyPlateau();
  const scenes = Array.isArray((data as { scenes?: unknown }).scenes) ? (data as { scenes: unknown[] }).scenes : [];
  return cleanBook({ scenes: scenes as PlateauScene[] });
}

export function serializePlateau(book: PlateauBook): string {
  return JSON.stringify(cleanBook(book));
}

export function readPlateau(storage: { getItem(key: string): string | null } | null): PlateauBook {
  if (!storage) return emptyPlateau();
  try {
    return parsePlateau(storage.getItem(PLATEAU_STORAGE_KEY));
  } catch {
    return emptyPlateau();
  }
}

export function savePlateau(storage: { setItem(key: string, value: string): void } | null, book: PlateauBook): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PLATEAU_STORAGE_KEY, serializePlateau(book));
    return true;
  } catch {
    return false;
  }
}

export function parseTakeNote(raw: string | null | undefined): TakeNote {
  if (!raw) return emptyTakeNote();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyTakeNote();
  }
  if (!data || typeof data !== "object") return emptyTakeNote();
  const row = data as Record<string, unknown>;
  return {
    sceneId: typeof row.sceneId === "string" ? clipId(row.sceneId) : "",
    line: typeof row.line === "string" ? clipPlateauText(row.line, TAKE_LINE_MAX) : "",
  };
}

export function readTakeNote(storage: { getItem(key: string): string | null } | null): TakeNote {
  if (!storage) return emptyTakeNote();
  try {
    return parseTakeNote(storage.getItem(TAKE_STORAGE_KEY));
  } catch {
    return emptyTakeNote();
  }
}

export function saveTakeNote(storage: { setItem(key: string, value: string): void } | null, note: TakeNote): boolean {
  if (!storage) return false;
  try {
    storage.setItem(TAKE_STORAGE_KEY, JSON.stringify(parseTakeNote(JSON.stringify(note))));
    return true;
  } catch {
    return false;
  }
}
