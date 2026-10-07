// Project memory on the take: bible, style, lexicon, prompts.
// The four scaffold sentences are the empty guide, not the project's words.

import { readFrontmatter, withFrontmatter } from "./markdown.ts";

export const MEMORY_KINDS = ["bible", "style", "lexique", "prompts"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const MEMORY_FILE: Record<MemoryKind, string> = {
  bible: "Bible.md",
  style: "Style.md",
  lexique: "Lexique.md",
  prompts: "Prompts/index.md",
};

/** Headings written into the vault. The screen translates the label. */
export const MEMORY_TITLE: Record<MemoryKind, string> = {
  bible: "Bible",
  style: "Style",
  lexique: "Lexique",
  prompts: "Prompts",
};

/** Sentences written when a project is created. `statut` stays `brouillon` until someone writes. */
export const MEMORY_SHELL: Record<MemoryKind, string> = {
  bible: "Ce qui ne change pas dans ce projet. Rien n’est copié ailleurs.",
  style: "La lumière, le cadre, ce qu’on évite. À remplir.",
  lexique: "Les mots de ce projet, et ce qu’ils désignent ici.",
  prompts: "Briques de phrase pour ce projet. Rien n’est envoyé d’ici.",
};

export const MEMORY_MAX = 2000;

export interface PromptNote {
  /** File under Prompts/, never index.md. */
  file: string;
  text: string;
}

export interface ProjectMemory {
  bible: string;
  style: string;
  lexique: string;
  prompts: string;
  notes: PromptNote[];
}

export const emptyMemory = (): ProjectMemory => ({ bible: "", style: "", lexique: "", prompts: "", notes: [] });

export function memoryFilled(memory: ProjectMemory): boolean {
  return Boolean(
    memory.bible.trim()
    || memory.style.trim()
    || memory.lexique.trim()
    || memory.prompts.trim()
    || memory.notes.some(note => note.text.trim()),
  );
}

export function cleanMemoryText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f]+/g, " ").trim().slice(0, MEMORY_MAX);
}

function noteBody(source: string | undefined): string {
  if (!source) return "";
  const { body } = readFrontmatter(source);
  return body.replace(/^#[^\n]*\n*/, "").trim();
}

/** User words. The scaffold sentence, while the note is still a draft, is empty. */
export function memoryField(kind: MemoryKind, source: string | undefined): string {
  if (!source) return "";
  const { fields } = readFrontmatter(source);
  const text = cleanMemoryText(noteBody(source));
  if (!text) return "";
  if (text === MEMORY_SHELL[kind] && fields.statut !== "tenu") return "";
  return text;
}

export function memoryMarkdown(slug: string, kind: MemoryKind, body: string): string {
  const clean = cleanMemoryText(body);
  const written = clean || MEMORY_SHELL[kind];
  return withFrontmatter({
    type: kind === "prompts" ? "prompt" : "projet",
    projet: slug,
    statut: clean ? "tenu" : "brouillon",
    updated: new Date().toISOString(),
  }, `# ${MEMORY_TITLE[kind]}\n\n${written}\n`);
}

const NOTE_FILE = /^[a-z0-9][a-z0-9.-]{0,60}\.md$/;

export function promptNoteFile(file: string): boolean {
  return NOTE_FILE.test(file) && file !== "index.md";
}

export function promptNoteMarkdown(slug: string, file: string, body: string): string {
  const clean = cleanMemoryText(body);
  const title = file.replace(/\.md$/, "");
  return withFrontmatter({
    type: "prompt",
    projet: slug,
    statut: clean ? "tenu" : "brouillon",
    updated: new Date().toISOString(),
  }, `# ${title}\n\n${clean}\n`);
}

export function readProjectMemory(slug: string, entries: readonly { path: string; text?: string }[]): ProjectMemory {
  const prefix = `Projets/${slug}/`;
  const byPath = new Map(entries.map(entry => [entry.path, entry.text]));
  const memory = emptyMemory();
  for (const kind of MEMORY_KINDS) memory[kind] = memoryField(kind, byPath.get(`${prefix}${MEMORY_FILE[kind]}`));
  const notes: PromptNote[] = [];
  for (const entry of entries) {
    if (!entry.path.startsWith(`${prefix}Prompts/`) || !entry.path.endsWith(".md")) continue;
    const file = entry.path.slice(`${prefix}Prompts/`.length);
    if (!promptNoteFile(file) || file.includes("/")) continue;
    const text = cleanMemoryText(noteBody(entry.text));
    if (!text) continue;
    notes.push({ file, text });
  }
  notes.sort((a, b) => a.file.localeCompare(b.file, "fr"));
  memory.notes = notes;
  return memory;
}

/** A tree row that opens the same notes the take edits. Folder labels stay the French vault names. */
export function memoryKindOf(folder: string, file: string): MemoryKind | null {
  if (folder === "Notes" && file === "Bible.md") return "bible";
  if (folder === "Notes" && file === "Style.md") return "style";
  if (folder === "Notes" && file === "Lexique.md") return "lexique";
  if (folder === "Prompts" && file.endsWith(".md")) return "prompts";
  return null;
}
