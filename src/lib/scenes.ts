// Sphère sheets for scenes/. The page keeps them on this device.
// The .md is a file the person drops into the vault. The site does not open it.

import { ANGLES } from "./gate/vocabulary.ts";
import { SPHERE_PRESETS } from "./studio-modes.ts";

export const SCENE_STORAGE_KEY = "u-ttu-scenes";
export const SCENE_TEXT_MAX = 80;

export const SCENE_DEVICE_NOTE = "Noté sur cet appareil. L’export se pose dans scenes/. Le coffre n’est pas lu.";
export const SCENE_VAULT_POINTER = "Les fiches Sphère remplissent scenes/. L’export .md se pose dans le dossier, à la main. Aucune sync.";
export const SCENE_FILE_NOTE = "À poser dans `scenes/`. Le site ne lit pas le coffre. Rien n’est envoyé.";
export const SCENE_EXPORT = "Exporter .md";
export const SCENE_EXPORTED = "Téléchargé. À poser dans scenes/.";
export const SCENE_READ = "Fiche lue. Elle reste ici.";
export const SCENE_UNREADABLE = "Fiche illisible.";
export const SCENE_OTHER = "Ce fichier n’est pas cette fiche.";
export const SCENE_PASTE = "Coller un .md";
export const SCENE_OPEN = "Ouvrir un fichier";
export const SCENE_IMPORT = "Lire";

export type SceneId = (typeof SPHERE_PRESETS)[number]["id"];
export type SceneAngles = [string, string, string, string];

export interface SceneSheet {
  lieu: string;
  left: string;
  right: string;
  angles: SceneAngles;
}

export type SceneBook = Record<SceneId, SceneSheet>;

export type SceneParse = { ok: true; id: SceneId; sheet: SceneSheet } | { ok: false };

const ANGLE_LABELS = ANGLES.map(angle => angle.label);

export function sceneFileName(id: SceneId): string {
  return `${id}.md`;
}

export function scenePath(id: SceneId): string {
  return `scenes/${sceneFileName(id)}`;
}

export function emptySheet(): SceneSheet {
  return { lieu: "", left: "", right: "", angles: ["", "", "", ""] };
}

export function emptyBook(): SceneBook {
  return { avant: emptySheet(), apres: emptySheet(), entre: emptySheet() };
}

function isSceneId(value: string): value is SceneId {
  return SPHERE_PRESETS.some(preset => preset.id === value);
}

export function clipSceneText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/[ \t]+/g, " ").trim().replace(/^#+\s*/, "").slice(0, SCENE_TEXT_MAX);
}

function four(values: readonly string[]): SceneAngles {
  return [
    clipSceneText(values[0] ?? ""),
    clipSceneText(values[1] ?? ""),
    clipSceneText(values[2] ?? ""),
    clipSceneText(values[3] ?? ""),
  ];
}

function cleanSheet(sheet: SceneSheet): SceneSheet {
  return {
    lieu: clipSceneText(sheet.lieu),
    left: clipSceneText(sheet.left),
    right: clipSceneText(sheet.right),
    angles: four(sheet.angles),
  };
}

export function sceneMarkdown(id: SceneId, sheet: SceneSheet): string {
  const preset = SPHERE_PRESETS.find(item => item.id === id);
  if (!preset) return "";
  const clean = cleanSheet(sheet);
  const angles = ANGLE_LABELS.map((label, index) => {
    const note = clean.angles[index] ?? "";
    return note ? `- ${label} : ${note}` : `- ${label}`;
  });
  return [
    `# ${preset.title}`,
    "",
    `\`${scenePath(id)}\``,
    "",
    SCENE_FILE_NOTE,
    "",
    "## Lieu",
    "",
    clean.lieu,
    "",
    "## Quatre angles",
    "",
    ...angles,
    "",
    "## Espace",
    "",
    `- À gauche : ${clean.left}`,
    `- À droite : ${clean.right}`,
    "",
  ].join("\n");
}

function section(text: string, title: string): string | null {
  const match = new RegExp(`(?:^|\\n)##\\s+${title}\\s*(?:\\n|$)`, "i").exec(text);
  if (!match) return null;
  const rest = text.slice(match.index + match[0].length);
  const next = rest.search(/\n##\s+/);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

function idsIn(head: string, fileName?: string): SceneId[] {
  const found = new Set<SceneId>();
  const path = /scenes\/(avant|apres|entre)\.md/i.exec(head);
  if (path?.[1] && isSceneId(path[1].toLowerCase())) found.add(path[1].toLowerCase() as SceneId);
  const heading = /^#\s+([^\n]+)$/m.exec(head);
  if (heading) {
    const title = heading[1]?.trim() ?? "";
    const preset = SPHERE_PRESETS.find(item => item.title === title);
    if (preset) found.add(preset.id);
  }
  if (fileName) {
    const base = fileName.split(/[/\\]/).pop() ?? "";
    const named = /^(avant|apres|entre)\.md$/i.exec(base);
    if (named?.[1] && isSceneId(named[1].toLowerCase())) found.add(named[1].toLowerCase() as SceneId);
  }
  return [...found];
}

function angleNotes(body: string | null): SceneAngles {
  const notes: SceneAngles = ["", "", "", ""];
  if (!body) return notes;
  for (const line of body.split("\n")) {
    const bullet = /^[-*]\s+(.+)$/.exec(line.trim());
    if (!bullet?.[1]) continue;
    const text = bullet[1].trim();
    for (let index = 0; index < ANGLE_LABELS.length; index += 1) {
      const label = ANGLE_LABELS[index] ?? "";
      if (text === label) {
        notes[index] = "";
        break;
      }
      if (!text.startsWith(label)) continue;
      const rest = text.slice(label.length);
      const split = /^\s*[:：—–-]\s*(.*)$/.exec(rest);
      if (!split) continue;
      notes[index] = clipSceneText(split[1] ?? "");
      break;
    }
  }
  return notes;
}

function side(body: string | null, word: "gauche" | "droite"): string {
  if (!body) return "";
  for (const line of body.split("\n")) {
    const match = new RegExp(`^[-*]\\s+.*\\b${word}\\b\\s*[:：]\\s*(.*)$`, "i").exec(line.trim());
    if (match) return clipSceneText(match[1] ?? "");
  }
  return "";
}

export function parseSceneMarkdown(raw: string, fileName?: string): SceneParse {
  if (typeof raw !== "string") return { ok: false };
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").slice(0, 8000);
  const head = text.split(/\n##\s+/)[0] ?? "";
  const ids = idsIn(head, fileName);
  if (ids.length !== 1) return { ok: false };
  const id = ids[0];
  if (!id) return { ok: false };
  const lieuBody = section(text, "Lieu");
  const angleBody = section(text, "Quatre angles");
  const spaceBody = section(text, "Espace");
  if (lieuBody === null && angleBody === null && spaceBody === null) return { ok: false };
  const lieu = clipSceneText((lieuBody ?? "").split("\n").map(line => line.trim()).filter(Boolean).join(" "));
  return {
    ok: true,
    id,
    sheet: { lieu, left: side(spaceBody, "gauche"), right: side(spaceBody, "droite"), angles: angleNotes(angleBody) },
  };
}

function sheetFrom(value: unknown): SceneSheet {
  if (!value || typeof value !== "object") return emptySheet();
  const row = value as Record<string, unknown>;
  const angles = Array.isArray(row.angles) ? row.angles : [];
  return cleanSheet({
    lieu: typeof row.lieu === "string" ? row.lieu : "",
    left: typeof row.left === "string" ? row.left : "",
    right: typeof row.right === "string" ? row.right : "",
    angles: four(angles.map(item => typeof item === "string" ? item : "")),
  });
}

export function parseBook(raw: string | null | undefined): SceneBook {
  const book = emptyBook();
  if (!raw) return book;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return book;
  }
  if (!data || typeof data !== "object") return book;
  const row = data as Record<string, unknown>;
  for (const preset of SPHERE_PRESETS) book[preset.id] = sheetFrom(row[preset.id]);
  return book;
}

export function serializeBook(book: SceneBook): string {
  const out: Record<SceneId, { lieu: string; left: string; right: string; angles: SceneAngles }> = {
    avant: cleanSheet(book.avant),
    apres: cleanSheet(book.apres),
    entre: cleanSheet(book.entre),
  };
  return JSON.stringify(out);
}

export function readBook(storage: { getItem(key: string): string | null } | null): SceneBook {
  if (!storage) return emptyBook();
  try {
    return parseBook(storage.getItem(SCENE_STORAGE_KEY));
  } catch {
    return emptyBook();
  }
}

export function saveBook(storage: { setItem(key: string, value: string): void } | null, book: SceneBook): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SCENE_STORAGE_KEY, serializeBook(book));
    return true;
  } catch {
    return false;
  }
}
