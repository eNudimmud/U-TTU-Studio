// Anime 2.5D is a project look, not a silo. Absent on every project until someone chooses it.
// Choosing it writes `.uttu/look.json`. Clearing it restores the previous document. Media stay put.

export const LOOK_SCHEMA = 1;
export const LOOK_KIND = "anime25d" as const;

export const ANIME_PRESETS = ["theatrical", "neon", "daylight", "darkfantasy"] as const;
export type AnimePresetId = (typeof ANIME_PRESETS)[number];
/** `retro` is the 90s sentence. `own` is one or two pictures the visitor brought. */
export type AnimePreset = AnimePresetId | "retro" | "own";

export interface AnimeLocks {
  line: boolean;
  shading: boolean;
  palette: boolean;
  depth: boolean;
}

export interface ProjectLook {
  kind: typeof LOOK_KIND;
  preset: AnimePreset;
  /** Vault path of the style frame, once a render has been kept. Null until then. */
  styleFrameRef: string | null;
  /** One or two visitor pictures when `preset` is `own`. Names only: nothing is uploaded here. */
  ownRefs: string[];
  locks: AnimeLocks;
  onTwos: boolean;
}

export interface LookJournalEntry {
  id: string;
  at: string;
  before: ProjectLook | null;
  after: ProjectLook | null;
}

export interface LookDocument {
  schemaVersion: typeof LOOK_SCHEMA;
  revision: number;
  look: ProjectLook | null;
  journal: LookJournalEntry[];
}

export const LOCKS_ON: AnimeLocks = { line: true, shading: true, palette: true, depth: true };

const PRESETS = new Set<string>([...ANIME_PRESETS, "retro", "own"]);
const PATH = /^[A-Za-z0-9][A-Za-z0-9._ /-]{0,180}$/;

export function lookAnime(preset: AnimePreset = "theatrical", patch: Partial<Omit<ProjectLook, "kind" | "preset">> = {}): ProjectLook {
  return {
    kind: LOOK_KIND,
    preset,
    styleFrameRef: patch.styleFrameRef ?? null,
    ownRefs: (patch.ownRefs ?? []).slice(0, 2),
    locks: { ...LOCKS_ON, ...patch.locks },
    onTwos: patch.onTwos ?? true,
  };
}

export function documentVide(): LookDocument {
  return { schemaVersion: LOOK_SCHEMA, revision: 0, look: null, journal: [] };
}

function cleanPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > 180 || !PATH.test(text) || text.includes("..")) return null;
  return text;
}

function cleanLook(value: unknown): ProjectLook | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<ProjectLook>;
  if (row.kind !== LOOK_KIND || typeof row.preset !== "string" || !PRESETS.has(row.preset)) return null;
  const locks: Partial<AnimeLocks> = row.locks ?? {};
  const own = Array.isArray(row.ownRefs) ? row.ownRefs.map(cleanPath).filter((item): item is string => Boolean(item)).slice(0, 2) : [];
  return {
    kind: LOOK_KIND,
    preset: row.preset as AnimePreset,
    styleFrameRef: cleanPath(row.styleFrameRef),
    ownRefs: row.preset === "own" ? own : own,
    locks: {
      line: locks.line !== false,
      shading: locks.shading !== false,
      palette: locks.palette !== false,
      depth: locks.depth !== false,
    },
    onTwos: row.onTwos !== false,
  };
}

/** A missing or broken file is no look. An existing project stays on its current pipeline. */
export function lireLook(raw: string | null | undefined): LookDocument {
  if (!raw) return documentVide();
  let data: Partial<LookDocument>;
  try { data = JSON.parse(raw) as Partial<LookDocument>; } catch { return documentVide(); }
  if (!data || typeof data !== "object" || data.schemaVersion !== LOOK_SCHEMA) return documentVide();
  const journal = Array.isArray(data.journal) ? data.journal.flatMap(entry => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Partial<LookJournalEntry>;
    if (typeof row.id !== "string" || typeof row.at !== "string") return [];
    return [{ id: row.id, at: row.at, before: cleanLook(row.before), after: cleanLook(row.after) }];
  }).slice(-40) : [];
  return {
    schemaVersion: LOOK_SCHEMA,
    revision: Number.isInteger(data.revision) && (data.revision as number) >= 0 ? data.revision as number : journal.length,
    look: cleanLook(data.look),
    journal,
  };
}

export function lookJson(doc: LookDocument): string {
  return JSON.stringify(doc, null, 2);
}

export interface LookChange {
  document: LookDocument;
  before: ProjectLook | null;
  after: ProjectLook | null;
  /** Pictures already in the vault are not part of this write. */
  mediaUntouched: true;
}

/** A new revision. The previous look stays in the journal so the change can be undone. */
export function appliquerLook(doc: LookDocument | null, next: ProjectLook | null, at: string, id: string): LookChange {
  const current = doc ?? documentVide();
  const before = current.look;
  const entry: LookJournalEntry = { id, at, before, after: next };
  return {
    document: {
      schemaVersion: LOOK_SCHEMA,
      revision: current.revision + 1,
      look: next,
      journal: [...current.journal, entry].slice(-40),
    },
    before,
    after: next,
    mediaUntouched: true,
  };
}

/** Restores the look from before the last change. Returns the same document when there is nothing to undo. */
export function annulerLook(doc: LookDocument, at: string, id: string): LookChange {
  const last = doc.journal.at(-1);
  if (!last) return { document: doc, before: doc.look, after: doc.look, mediaUntouched: true };
  const restored = appliquerLook({ ...doc, look: last.before, journal: doc.journal.slice(0, -1) }, last.before, at, id);
  return { ...restored, before: last.after, after: last.before, mediaUntouched: true };
}

/** The guide is never redrawn as a cast sheet. Story names are left untouched. */
export function estGuide(name: string): boolean {
  return /^u\*?ttu$/i.test(name.trim());
}

export function sansGuide<T extends { name: string }>(people: readonly T[]): T[] {
  return people.filter(person => !estGuide(person.name));
}
