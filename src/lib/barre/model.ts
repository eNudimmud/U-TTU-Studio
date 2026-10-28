// The creation bar (« barre unique »): one sentence, a mode (Image · Vidéo · Agent), references
// attached on demand, and settings only when asked. The bar runs nothing: Send opens the real tool,
// already filled, the way « Et ensuite ? » does. This module is the pure part: where a send goes,
// what it hands over, and the one estimate shown on the button.

import { routePrompt } from "../outils/route.ts";

export type BarreMode = "image" | "video" | "agent";
export const BARRE_MODES: readonly BarreMode[] = ["image", "video", "agent"];

export type RefKind = "cast" | "decor" | "objet" | "style";

/** One reference chip: a character from Cast/ or a place from Lieux/ (or a house example). */
export interface BarreRef {
  kind: RefKind;
  id: string;
  name: string;
  /** What the browser shows: a site URL or a hydrated vault URL. */
  src: string;
  /** Vault path of the picture, when it comes from the vault. */
  path?: string;
  /** A place kept from repérage (a real address). */
  repere?: boolean;
  description?: string;
  images?: string[];
}

/** A photo picked from the device, kept in memory for this page only. */
export interface BarrePhoto {
  id: string;
  name: string;
  url: string;
  path?: string;
}

export type Rendu = "apercu" | "finale";
export type Duree = 5 | 8;
export type Format = "16:9" | "9:16";

export interface BarreSettings {
  rendu: Rendu;
  duree: Duree;
  format: Format;
}

export const DEFAULT_SETTINGS: BarreSettings = { rendu: "finale", duree: 5, format: "16:9" };

export const MAX_CAST = 3;
export const MAX_REFS_IMAGE = 2;

export type BarreTarget =
  | { kind: "outil"; id: string; images: { name: string; url: string; path?: string }[] }
  | { kind: "prise" }
  | { kind: "agent" }
  | { kind: "film" };

/** Adds or removes one reference. Video takes up to three characters and one place. */
export function toggleRef(list: readonly BarreRef[], ref: BarreRef): BarreRef[] {
  if (list.some(item => item.kind === ref.kind && item.id === ref.id)) return list.filter(item => !(item.kind === ref.kind && item.id === ref.id));
  if (ref.kind === "decor") return [...list.filter(item => item.kind !== "decor"), ref];
  const cast = list.filter(item => item.kind === "cast");
  if (cast.length >= MAX_CAST) return list.slice();
  return [...list, ref];
}

/** Where one send goes. Image: a still tool (by reference when there is one). Vidéo: PRISE. Agent: the assistant. */
export function barreTarget(mode: BarreMode, text: string, refs: readonly BarreRef[], photos: readonly BarrePhoto[]): BarreTarget {
  if (mode === "agent") return { kind: "agent" };
  if (mode === "video") return { kind: "prise" };
  const images = [
    ...photos.map(photo => ({ name: photo.name, url: photo.url })),
    ...refs.filter(ref => ref.src).map(ref => ({ name: ref.name, url: ref.src, path: ref.path })),
  ].slice(0, MAX_REFS_IMAGE);
  if (images.length >= 2) return { kind: "outil", id: "img-refs", images };
  if (images.length === 1) return { kind: "outil", id: "ret-modifier", images };
  // Text only: a still, unless the sentence clearly asks for a short film.
  const route = routePrompt(text.trim() || "image");
  if (route.kind === "film") return { kind: "film" };
  return { kind: "outil", id: "img-klein", images: [] };
}

/** What PRISE reads once when it opens from the bar. */
export interface PriseHandoff {
  action: string;
  castIds: string[];
  castNames: string[];
  decorId: string | null;
  decorName: string;
  settings: BarreSettings;
}

export const PRISE_HANDOFF_KEY = "u-ttu-barre-prise";
export const REFS_HANDOFF_KEY = "u-ttu-barre-refs";
export const AGENT_HANDOFF_EVENT = "u-ttu-barre-agent";
export const AGENT_HANDOFF_KEY = "u-ttu-barre-agent-text";

export function isAgentHandoff(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
export const ACTION_LIMIT = 240;

export function priseHandoff(text: string, refs: readonly BarreRef[], settings: BarreSettings): PriseHandoff {
  const cast = refs.filter(ref => ref.kind === "cast").slice(0, MAX_CAST);
  const decor = refs.find(ref => ref.kind === "decor") ?? null;
  return {
    action: text.trim().slice(0, ACTION_LIMIT),
    castIds: cast.map(ref => ref.id),
    castNames: cast.map(ref => ref.name),
    decorId: decor?.id ?? null,
    decorName: decor?.name ?? "",
    settings: { ...settings },
  };
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function writeHandoff<T>(storage: Store | null, key: string, value: T): void {
  try { storage?.setItem(key, JSON.stringify(value)); } catch { /* the tool still opens, empty */ }
}

/** Reads a handoff once: it is removed as it is read, so a reload never refills. */
export function takeHandoff<T>(storage: Store | null, key: string, valid: (value: unknown) => value is T): T | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    storage?.removeItem(key);
    const value: unknown = JSON.parse(raw);
    return valid(value) ? value : null;
  } catch { return null; }
}

export function isPriseHandoff(value: unknown): value is PriseHandoff {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<PriseHandoff>;
  const s = v.settings as Partial<BarreSettings> | undefined;
  return typeof v.action === "string"
    && Array.isArray(v.castIds) && v.castIds.every(id => typeof id === "string")
    && Array.isArray(v.castNames) && v.castNames.every(id => typeof id === "string")
    && (v.decorId === null || typeof v.decorId === "string")
    && typeof v.decorName === "string"
    && Boolean(s) && (s!.rendu === "apercu" || s!.rendu === "finale") && (s!.duree === 5 || s!.duree === 8) && (s!.format === "16:9" || s!.format === "9:16");
}

export interface RefsHandoff { tool: string; images: { name: string; url: string; path?: string }[] }

export function isRefsHandoff(value: unknown): value is RefsHandoff {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<RefsHandoff>;
  return typeof v.tool === "string" && Array.isArray(v.images) && v.images.every(item => item && typeof item.name === "string" && typeof item.url === "string");
}

/** Which settings the mode shows once the visitor asks for them. Image and Agent have none in the bar. */
export function settingsFor(mode: BarreMode): (keyof BarreSettings)[] {
  return mode === "video" ? ["rendu", "duree", "format"] : [];
}

/** Which « + » entries the mode offers. */
export type AttachKind = "photo" | "reference" | "lieu" | "son";
export function attachFor(mode: BarreMode): AttachKind[] {
  if (mode === "image") return ["photo", "reference", "lieu"];
  if (mode === "video") return ["reference", "lieu", "son"];
  return [];
}
