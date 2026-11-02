// The four StoryWeave tracks, derived from the storyboard. Manual trims and
// frozen audio positions live in SwEdit. Reorder, delete and a quotable trim
// are cinema operations (journal.ts); this module only describes the picture.

import type { PlanSB, Storyboard } from "../storyboard/storyboard.ts";
import { tousLesPlans } from "../storyboard/storyboard.ts";

export const TRACKS = ["video", "voice", "music", "text"] as const;
export type TrackId = (typeof TRACKS)[number];

export interface SwText {
  id: string;
  at: number;
  duration: number;
  label: string;
}

export interface SwEdit {
  /** Timeline length of a shot, when it is not the storyboard duration. */
  trim: Record<string, number>;
  /** Frozen voice start. Absent means the voice follows its shot. */
  voiceAt: Record<string, number>;
  /** null follows the whole cut; false removes the music clip. */
  music: { at: number; duration: number } | false | null;
  texts: SwText[];
  hidden: string[];
}

export interface SwClip {
  id: string;
  track: TrackId;
  shotId: string | null;
  label: string;
  start: number;
  duration: number;
  filmed: boolean;
  kind: "shot" | "narration" | "dialogue" | "music" | "title" | "line" | "text";
}

export interface SwDrift {
  id: string;
  shotId: string | null;
  label: string;
  from: number;
  to: number;
}

const MIN_TRIM = 0.5;
const MAX_TRIM = 60;

export function emptySwEdit(): SwEdit {
  return { trim: {}, voiceAt: {}, music: null, texts: [], hidden: [] };
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseSwEdit(raw: string | null | undefined): SwEdit {
  if (!raw) return emptySwEdit();
  let data: Partial<SwEdit>;
  try { data = JSON.parse(raw) as Partial<SwEdit>; } catch { return emptySwEdit(); }
  const trim: Record<string, number> = {};
  if (data.trim && typeof data.trim === "object") {
    for (const [key, value] of Object.entries(data.trim)) {
      const n = num(value);
      if (n !== null) trim[key] = n;
    }
  }
  const voiceAt: Record<string, number> = {};
  if (data.voiceAt && typeof data.voiceAt === "object") {
    for (const [key, value] of Object.entries(data.voiceAt)) {
      const n = num(value);
      if (n !== null) voiceAt[key] = n;
    }
  }
  let music: SwEdit["music"] = null;
  if (data.music === false) music = false;
  else if (data.music && typeof data.music === "object") {
    const at = num(data.music.at);
    const duration = num(data.music.duration);
    if (at !== null && duration !== null) music = { at, duration };
  }
  const texts = (Array.isArray(data.texts) ? data.texts : []).flatMap(item => {
    if (!item || typeof item.id !== "string") return [];
    const at = num(item.at);
    const duration = num(item.duration);
    if (at === null || duration === null) return [];
    return [{ id: item.id.slice(0, 40), at, duration, label: String(item.label ?? "").slice(0, 80) }];
  });
  const hidden = (Array.isArray(data.hidden) ? data.hidden : []).filter((item): item is string => typeof item === "string").slice(0, 200);
  return { trim, voiceAt, music, texts, hidden };
}

export function swEditJson(edit: SwEdit): string {
  return `${JSON.stringify(edit)}\n`;
}

export function editPath(boardId: string): string {
  return `.uttu/sw-edit-${boardId}.json`;
}

export function locksPath(boardId: string): string {
  return `.uttu/sw-locks-${boardId}.json`;
}

export function shotSpan(plan: Pick<PlanSB, "id" | "duree">, edit: SwEdit): number {
  const raw = edit.trim[plan.id];
  if (typeof raw !== "number" || !Number.isFinite(raw)) return plan.duree;
  return Math.round(Math.min(MAX_TRIM, Math.max(MIN_TRIM, raw)) * 10) / 10;
}

export function shotRows(sb: Storyboard, edit: SwEdit): { plan: PlanSB; start: number; duration: number; index: number }[] {
  const rows: { plan: PlanSB; start: number; duration: number; index: number }[] = [];
  let cursor = 0;
  tousLesPlans(sb).forEach((plan, index) => {
    const duration = shotSpan(plan, edit);
    rows.push({ plan, start: round1(cursor), duration, index });
    cursor += duration;
  });
  return rows;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function voiceSeconds(text: string, room: number): number {
  return round1(Math.max(1.5, Math.min(room, Math.max(1.5, text.trim().length / 14))));
}

/** One clip list. The four tracks exist even when a track has no clip. */
export function buildTimeline(sb: Storyboard, edit: SwEdit, filmed: ReadonlySet<string>): SwClip[] {
  const rows = shotRows(sb, edit);
  const total = round1(rows.reduce((sum, row) => sum + row.duration, 0));
  const hidden = new Set(edit.hidden);
  const clips: SwClip[] = [];
  for (const row of rows) {
    clips.push({
      id: `video:${row.plan.id}`, track: "video", shotId: row.plan.id, label: row.plan.titre || row.plan.action,
      start: row.start, duration: row.duration, filmed: filmed.has(row.plan.id), kind: "shot",
    });
    const line = row.plan.dialogue.texte.trim();
    const spoken = row.plan.dialogue.type === "voixoff" || row.plan.dialogue.type === "replique";
    const voiceId = `voice:${row.plan.id}`;
    if (line && spoken && !hidden.has(voiceId)) {
      const frozen = edit.voiceAt[row.plan.id];
      clips.push({
        id: voiceId, track: "voice", shotId: row.plan.id,
        label: row.plan.dialogue.type === "voixoff" ? line : (row.plan.dialogue.qui?.trim() || line),
        start: typeof frozen === "number" ? Math.max(0, round1(frozen)) : row.start,
        duration: voiceSeconds(line, row.duration), filmed: false,
        kind: row.plan.dialogue.type === "voixoff" ? "narration" : "dialogue",
      });
    }
    const lineId = `line:${row.plan.id}`;
    if (line && !hidden.has(lineId)) {
      clips.push({
        id: lineId, track: "text", shotId: row.plan.id, label: line, start: row.start,
        duration: Math.min(row.duration, voiceSeconds(line, row.duration)), filmed: false, kind: "line",
      });
    }
  }
  if (sb.titre.trim() && !hidden.has("title") && total > 0) {
    clips.push({
      id: "title", track: "text", shotId: rows[0]?.plan.id ?? null, label: sb.titre, start: 0,
      duration: Math.min(8, rows[0]?.duration ?? 4), filmed: false, kind: "title",
    });
  }
  for (const text of edit.texts) {
    if (hidden.has(text.id) || text.duration <= 0) continue;
    clips.push({ id: text.id, track: "text", shotId: null, label: text.label, start: Math.max(0, text.at), duration: text.duration, filmed: false, kind: "text" });
  }
  if (edit.music !== false && (sb.musique.trim() || edit.music)) {
    const span = edit.music && typeof edit.music === "object" ? edit.music : { at: 0, duration: total };
    if (span.duration > 0) {
      clips.push({
        id: "music", track: "music", shotId: null, label: sb.musique.trim(),
        start: Math.max(0, span.at), duration: span.duration, filmed: false, kind: "music",
      });
    }
  }
  return clips;
}

export function timelineDuration(clips: readonly SwClip[]): number {
  return round1(clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0));
}

/** Remember where sound sits now, so a later picture move can be seen as a drift. */
export function freezeAudio(sb: Storyboard, edit: SwEdit, filmed: ReadonlySet<string>): SwEdit {
  const clips = buildTimeline(sb, edit, filmed);
  const voiceAt = { ...edit.voiceAt };
  for (const clip of clips) {
    if (clip.track === "voice" && clip.shotId && voiceAt[clip.shotId] === undefined) voiceAt[clip.shotId] = clip.start;
  }
  let music = edit.music;
  if (music === null) {
    const clip = clips.find(item => item.id === "music");
    music = clip ? { at: clip.start, duration: clip.duration } : null;
  }
  return { ...edit, voiceAt, music };
}

/** Voices (and a frozen music bed) whose start no longer matches the picture. */
export function audioDrift(sb: Storyboard, edit: SwEdit, filmed: ReadonlySet<string>): SwDrift[] {
  const rows = shotRows(sb, edit);
  const byShot = new Map(rows.map(row => [row.plan.id, row]));
  const hidden = new Set(edit.hidden);
  const drifts: SwDrift[] = [];
  for (const [shotId, at] of Object.entries(edit.voiceAt)) {
    if (hidden.has(`voice:${shotId}`)) continue;
    const row = byShot.get(shotId);
    if (!row || !row.plan.dialogue.texte.trim()) continue;
    if (Math.abs(at - row.start) < 0.05) continue;
    drifts.push({
      id: `voice:${shotId}`, shotId,
      label: row.plan.dialogue.type === "voixoff" ? row.plan.titre || shotId : (row.plan.dialogue.qui?.trim() || row.plan.titre || shotId),
      from: at, to: row.start,
    });
  }
  if (edit.music && typeof edit.music === "object") {
    const total = round1(rows.reduce((sum, row) => sum + row.duration, 0));
    if (Math.abs(edit.music.at) > 0.05 || Math.abs(edit.music.at + edit.music.duration - total) > 0.05) {
      drifts.push({ id: "music", shotId: null, label: sb.musique.trim(), from: edit.music.at, to: 0 });
    }
  }
  return drifts;
}

/** Drop frozen positions so sound follows the picture again. A removed bed stays removed. */
export function acceptResync(edit: SwEdit): SwEdit {
  return { ...edit, voiceAt: {}, music: edit.music === false ? false : null };
}

export function trimShot(edit: SwEdit, shotId: string, duration: number): SwEdit {
  const next = Math.round(Math.min(MAX_TRIM, Math.max(MIN_TRIM, duration)) * 10) / 10;
  return { ...edit, trim: { ...edit.trim, [shotId]: next } };
}

/** 5, 8 or 10 when the trim lands on a length the storyboard can store. */
export function quotableDuration(seconds: number): 5 | 8 | 10 | null {
  return ([5, 8, 10] as const).find(item => Math.abs(item - seconds) < 0.26) ?? null;
}

export function hideClip(edit: SwEdit, id: string): SwEdit {
  if (id === "music") return { ...edit, music: false };
  const hidden = edit.hidden.includes(id) ? edit.hidden : [...edit.hidden, id];
  if (id.startsWith("voice:")) {
    const voiceAt = { ...edit.voiceAt };
    delete voiceAt[id.slice("voice:".length)];
    return { ...edit, hidden, voiceAt };
  }
  return { ...edit, hidden, texts: edit.texts.filter(item => item.id !== id) };
}

export function addText(edit: SwEdit, at: number, label: string, id: string): SwEdit {
  return { ...edit, texts: [...edit.texts, { id, at: Math.max(0, round1(at)), duration: 3, label: label.slice(0, 80) }] };
}

export function moveClip(edit: SwEdit, clip: SwClip, at: number): SwEdit {
  const start = Math.max(0, round1(at));
  if (clip.track === "voice" && clip.shotId) return { ...edit, voiceAt: { ...edit.voiceAt, [clip.shotId]: start } };
  if (clip.id === "music" && edit.music && typeof edit.music === "object") return { ...edit, music: { ...edit.music, at: start } };
  if (clip.track === "text" && clip.kind === "text") {
    return { ...edit, texts: edit.texts.map(item => item.id === clip.id ? { ...item, at: start } : item) };
  }
  return edit;
}
