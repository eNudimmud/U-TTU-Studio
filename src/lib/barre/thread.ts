// The bar's conversation thread (« le fil »). Every send lands here: the visitor's bubble, then
// one card for what it starts (a tool run, a PRISE take, or an Agent reply). Nothing runs from
// this module: it only decides where a send goes and keeps the thread. The runs themselves are
// the tools' own (runOutil) and PRISE's own (requestRun → confirmRun), always after a confirm.

import { buildPrompt } from "../prise/prompt.ts";
import { decide, emptyPlan } from "../prise/decision.ts";
import type { TakeSettings } from "../render/take-graph.ts";
import { MAX_CAST, MAX_REFS_IMAGE, type BarreMode, type BarreSettings } from "./model.ts";

export const FIL_KEY = "u-ttu-barre-fil";
export const FIL_MAX = 40;

/** One picture shown in a bubble and sent with the run. */
export interface FilRef {
  kind: "cast" | "decor" | "photo" | "result";
  id: string;
  name: string;
  src: string;
  /** Vault path, when the picture is in the project. */
  path?: string;
  /** Kept in the vault (not a house example): PRISE can send it. */
  vault?: boolean;
}

export type FilRoute =
  | { kind: "outil"; id: string; images: FilRef[] }
  | { kind: "prise"; cast: FilRef[]; decor: FilRef | null; settings: BarreSettings };

export type FilStatus = "confirm" | "running" | "done" | "error" | "cancelled" | "interrupted";

export interface FilUser { id: string; role: "user"; mode: BarreMode; text: string; refs: FilRef[]; at: number }

export interface FilJob {
  id: string;
  role: "job";
  /** The user bubble it answers. */
  of: string;
  text: string;
  route: FilRoute;
  sortie: "image" | "video";
  status: FilStatus;
  quote: number | null;
  stage?: string;
  seconds?: number;
  url?: string;
  path?: string;
  poster?: string;
  takeId?: string;
  cost?: number | null;
  message?: string;
  aspect: "horizontal" | "vertical";
}

export interface FilLink { label: string; href: string; quote?: string }
export interface FilAgent { id: string; role: "agent"; of: string; text: string; links: FilLink[] }
/** A send that cannot start: what is missing, in plain words (an i18n key). */
export interface FilNote { id: string; role: "note"; of: string; key: string }

export type FilMessage = FilUser | FilJob | FilAgent | FilNote;
export interface Fil { version: 1; messages: FilMessage[] }

export function emptyFil(): Fil { return { version: 1, messages: [] }; }

/** Appends, keeping the newest FIL_MAX messages. */
export function append(fil: Fil, ...messages: FilMessage[]): Fil {
  return { version: 1, messages: [...fil.messages, ...messages].slice(-FIL_MAX) };
}

export function patchJob(fil: Fil, id: string, patch: Partial<Omit<FilJob, "id" | "role">>): Fil {
  return { version: 1, messages: fil.messages.map(m => m.role === "job" && m.id === id ? { ...m, ...patch } : m) };
}

export function findJob(fil: Fil, id: string): FilJob | null {
  const hit = fil.messages.find(m => m.role === "job" && m.id === id);
  return hit && hit.role === "job" ? hit : null;
}

/** The newest finished result, the one « anime-la » points to. */
export function lastResult(fil: Fil): FilJob | null {
  for (let i = fil.messages.length - 1; i >= 0; i -= 1) {
    const m = fil.messages[i];
    if (m.role === "job" && m.status === "done" && (m.url || m.path)) return m;
  }
  return null;
}

/** Is a job waiting for a confirm or running? Only one at a time. */
export function busyJob(fil: Fil): FilJob | null {
  const hit = [...fil.messages].reverse().find(m => m.role === "job" && (m.status === "running" || m.status === "confirm"));
  return hit && hit.role === "job" ? hit : null;
}

const fold = (text: string) => text.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// « anime-la », « modifie-le », « la même en… », « animate it », « anímala », « hazla », « animiere es ».
// Verb + pronoun only, so a new description (« une villa… ») never points back by chance.
const LAST = new RegExp([
  String.raw`\w-(?:la|le|les|lui)\b`, String.raw`\b(?:la meme|le meme|cette image|ce resultat|celle-ci|celui-ci)\b`,
  String.raw`\b(?:animate|edit|change|make|turn|modify|move|upscale|fix)\s+it\b`, String.raw`\b(?:this one|the same one|this image)\b`,
  String.raw`\b(?:anima|modifica|cambia|edita|haz|mueve|convierte|mejora)(?:la|lo)\b`, String.raw`\b(?:la misma|esta imagen)\b`,
  String.raw`\b(?:animiere|bearbeite|andere|mach|bewege|verwandle|verbessere)\s+(?:es|sie|ihn|das)\b`, String.raw`\b(?:dieses bild|das gleiche)\b`,
].join("|"));
const ANIMATE = /\b(?:anime|animer|animate|animiere|animieren|anima|animar|bewege|fais(?:-la)? bouger|make it move)/;

/** Does the sentence point back at the last result? */
export function wantsLast(text: string): boolean {
  const t = fold(text.trim());
  if (!t) return false;
  return LAST.test(t) || (ANIMATE.test(t) && t.split(/\s+/).length <= 4);
}

export function wantsAnimate(text: string): boolean {
  return ANIMATE.test(fold(text));
}

export function asRef(job: FilJob, name: string): FilRef {
  return { kind: "result", id: job.id, name, src: job.url ?? "", path: job.path, vault: Boolean(job.path) };
}

export type Plan =
  | { kind: "run"; route: FilRoute; sortie: "image" | "video"; refs: FilRef[] }
  | { kind: "agent" }
  | { kind: "note"; key: string };

/**
 * Where one send goes, inside the thread.
 * Image: Klein (text only), Modifier (one picture), Références (two). Vidéo: PRISE when every
 * reference is kept in the project; otherwise Animer (Wan) on one picture; text only goes to
 * « Vidéo depuis un texte » (vid-texte). Agent: a reply.
 */
export function planSend(input: { mode: BarreMode; text: string; refs: FilRef[]; last: FilJob | null; lastName: string; settings: BarreSettings }): Plan {
  const { mode, text, settings } = input;
  if (mode === "agent") return { kind: "agent" };
  if (!text.trim()) return { kind: "note", key: "barre.fil.needText" };
  const followUp = input.refs.length === 0 && input.last ? wantsLast(text) || (mode === "video" && wantsAnimate(text) && input.last.sortie === "image") : false;
  const refs = followUp && input.last ? [asRef(input.last, input.lastName)] : input.refs;
  if (mode === "image") {
    const images = refs.filter(ref => ref.src || ref.path).slice(0, MAX_REFS_IMAGE);
    if (images.some(ref => ref.kind === "result") && input.last?.sortie === "video") return { kind: "note", key: "barre.fil.videoAsImage" };
    const id = images.length >= 2 ? "img-refs" : images.length === 1 ? "ret-modifier" : "img-klein";
    return { kind: "run", route: { kind: "outil", id, images }, sortie: "image", refs: images };
  }
  const result = refs.find(ref => ref.kind === "result");
  if (result) {
    if (input.last?.sortie !== "image") return { kind: "note", key: "barre.fil.alreadyVideo" };
    return { kind: "run", route: { kind: "outil", id: "vid-wan", images: [result] }, sortie: "video", refs: [result] };
  }
  const cast = refs.filter(ref => ref.kind === "cast").slice(0, MAX_CAST);
  const decor = refs.find(ref => ref.kind === "decor") ?? null;
  const photos = refs.filter(ref => ref.kind === "photo");
  const pictured = [...cast, ...(decor ? [decor] : [])];
  if (pictured.length > 0 && pictured.every(ref => ref.vault) && photos.length === 0) {
    return { kind: "run", route: { kind: "prise", cast, decor, settings: { ...settings } }, sortie: "video", refs: pictured };
  }
  const first = [...photos, ...pictured].find(ref => ref.src);
  // Keep every chip the visitor attached (P0-2); Animer still runs on the first picture.
  if (first) return { kind: "run", route: { kind: "outil", id: "vid-wan", images: [first] }, sortie: "video", refs: pictured.length > 0 ? pictured : [first] };
  return { kind: "run", route: { kind: "outil", id: "vid-texte", images: [] }, sortie: "video", refs: [] };
}

/** PRISE's own settings and prompt for a take sent from the thread (decision.ts → buildPrompt). */
export function priseSettings(settings: BarreSettings, engine: "ltx" | "h3" = "ltx"): TakeSettings {
  const base: TakeSettings = { seconds: settings.duree, aspect: settings.format === "9:16" ? "vertical" : "horizontal", quality: "rapide", engine };
  return engine === "ltx" && settings.rendu === "apercu" ? { ...base, rendu: "apercu" } : base;
}

export function prisePrompt(text: string, route: Extract<FilRoute, { kind: "prise" }>, planche: boolean[] = []): string {
  const plan = {
    ...emptyPlan(route.settings.format),
    action: text.trim().slice(0, 240),
    castIds: route.cast.map(ref => ref.id),
    castNames: route.cast.map(ref => ref.name),
    castPlanche: route.cast.map((_, i) => Boolean(planche[i])),
    speakerName: route.cast[0]?.name ?? "",
    decorId: route.decor?.id ?? null,
    decorName: route.decor?.name ?? "",
    duree: route.settings.duree,
  };
  return buildPrompt(plan, decide(plan, "essai")).text;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const SAFE_URL = /^(?:https?:|\/|data:image\/)/;

/** What survives a reload: blob URLs die with the page (the vault path brings them back). A run cut by the reload is « interrompu ». */
export function toStored(fil: Fil): Fil {
  return {
    version: 1,
    messages: fil.messages.map(m => {
      if (m.role === "user") return { ...m, refs: m.refs.map(ref => ({ ...ref, src: SAFE_URL.test(ref.src) ? ref.src : "" })) };
      if (m.role !== "job") return m;
      const url = m.url && SAFE_URL.test(m.url) ? m.url : undefined;
      const status: FilStatus = m.status === "running" ? "interrupted" : m.status === "confirm" ? "cancelled" : m.status;
      const route: FilRoute = m.route.kind === "outil" ? { ...m.route, images: m.route.images.map(ref => ({ ...ref, src: SAFE_URL.test(ref.src) ? ref.src : "" })) } : m.route;
      return { ...m, url, poster: m.poster && SAFE_URL.test(m.poster) ? m.poster : undefined, status, route };
    }),
  };
}

export function isFil(value: unknown): value is Fil {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<Fil>;
  return v.version === 1 && Array.isArray(v.messages) && v.messages.every(m => m && typeof m === "object" && typeof (m as FilMessage).id === "string" && ["user", "job", "agent", "note"].includes((m as FilMessage).role));
}

export function saveFil(storage: Store | null, fil: Fil): void {
  try {
    if (fil.messages.length === 0) storage?.removeItem(FIL_KEY);
    else storage?.setItem(FIL_KEY, JSON.stringify(toStored(fil)));
  } catch { /* the thread still works for this page */ }
}

export function loadFil(storage: Store | null): Fil {
  try {
    const raw = storage?.getItem(FIL_KEY);
    if (!raw) return emptyFil();
    const value: unknown = JSON.parse(raw);
    return isFil(value) ? toStored(value) : emptyFil();
  } catch { return emptyFil(); }
}

export function clearFil(storage: Store | null): Fil {
  try { storage?.removeItem(FIL_KEY); } catch { /* nothing kept */ }
  return emptyFil();
}
