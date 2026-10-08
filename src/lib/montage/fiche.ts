// The cut list Obsidian can read. Frontmatter type is sequence.
// The stem stays *-montage.md so the loader does not open it as a second sequence.

import { readFrontmatter, text, num, list, withFrontmatter } from "../coffre/markdown.ts";
import {
  editDuration, emptyEdit, span,
  type AudioClip, type AudioTrackId, type Edit, type MediaKind, type VideoClip,
} from "./edit.ts";

const TRACKS: readonly AudioTrackId[] = ["voix", "effets", "musique"];
const KINDS: readonly MediaKind[] = ["video", "image", "slate"];

function cleanLabel(value: string): string {
  return value.replace(/[\[\]|\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function seconds(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const shown = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
  return `${shown} s`;
}

function wiki(target: string, label: string): string {
  return `![[${target}|${cleanLabel(label) || target.split("/").pop() || target}]]`;
}

function videoLine(clip: VideoClip): string {
  return JSON.stringify({
    id: clip.id,
    kind: clip.kind,
    source: clip.source,
    label: cleanLabel(clip.label),
    media: clip.media,
    start: clip.start,
    end: clip.end,
    takeId: clip.takeId,
  });
}

function audioLine(clip: AudioClip): string {
  return JSON.stringify({
    id: clip.id,
    track: clip.track,
    source: clip.source,
    label: cleanLabel(clip.label),
    media: clip.media,
    start: clip.start,
    end: clip.end,
    at: clip.at,
    volume: clip.volume,
    fadeIn: clip.fadeIn,
    fadeOut: clip.fadeOut,
  });
}

const TRACK_LABEL: Record<AudioTrackId | "video", string> = {
  video: "Vidéo",
  voix: "Voix",
  effets: "Effets",
  musique: "Musique",
};

function row(ordre: number, track: string, label: string, at: number, duration: number, volume: string, fade: string, source: string): string {
  return `| ${ordre} | ${track} | ${label} | ${seconds(at)} | ${seconds(duration)} | ${volume} | ${fade} | ${source} |`;
}

/** A readable cut list. The lists in the frontmatter are what a reopen reads back. */
export function sequenceFiche(edit: Edit, projet = ""): string {
  const rows: string[] = [];
  let ordre = 1;
  let cursor = 0;
  for (const clip of edit.video) {
    const source = clip.source ? wiki(clip.source, clip.label) : "Plan sans prise";
    rows.push(row(ordre, TRACK_LABEL.video, cleanLabel(clip.label) || clip.id, cursor, span(clip), "—", "—", source));
    cursor += span(clip);
    ordre += 1;
  }
  for (const track of TRACKS) {
    for (const clip of edit.audio.filter(item => item.track === track)) {
      const fade = `${seconds(clip.fadeIn)} / ${seconds(clip.fadeOut)}`;
      const volume = `${Math.round(clip.volume * 100)} %`;
      rows.push(row(ordre, TRACK_LABEL[track], cleanLabel(clip.label) || clip.id, clip.at, span(clip), volume, fade, clip.source ? wiki(clip.source, clip.label) : "—"));
      ordre += 1;
    }
  }
  const table = rows.length > 0
    ? `| Ordre | Piste | Nom | Début | Durée | Volume | Fondu | Source |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${rows.join("\n")}`
    : "Aucun plan pour l’instant.";
  const body = `# ${edit.name}\n\nListe de montage. Les plans se suivent. La voix, les effets et la musique se calent par leur début. Le navigateur peut écrire un MP4 sur cet appareil. Rien n’est envoyé.\n\n${table}\n`;
  return withFrontmatter({
    type: "sequence",
    gesture: "montage",
    projet,
    nom: edit.name,
    duree: Math.round(editDuration(edit) * 1000) / 1000,
    updated: new Date().toISOString(),
    plans: edit.video.map(videoLine),
    voix: edit.audio.filter(clip => clip.track === "voix").map(audioLine),
    effets: edit.audio.filter(clip => clip.track === "effets").map(audioLine),
    musique: edit.audio.filter(clip => clip.track === "musique").map(audioLine),
  }, body);
}

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asVideo(raw: string): VideoClip | null {
  try {
    const value = JSON.parse(raw) as Partial<VideoClip>;
    if (!value || typeof value.id !== "string" || !/^[a-z0-9-]+$/.test(value.id)) return null;
    const kind = KINDS.includes(value.kind as MediaKind) ? value.kind as MediaKind : "slate";
    const media = Math.max(MIN_HOLD, finite(value.media, MIN_HOLD));
    const start = clampNum(finite(value.start, 0), 0, media);
    const end = clampNum(finite(value.end, media), start, media);
    return {
      id: value.id,
      kind,
      source: typeof value.source === "string" && value.source ? value.source : null,
      label: cleanLabel(typeof value.label === "string" ? value.label : value.id),
      media,
      start,
      end: Math.max(start, end),
      takeId: typeof value.takeId === "string" && value.takeId ? value.takeId : null,
    };
  } catch {
    return null;
  }
}

const MIN_HOLD = 0.1;

function clampNum(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asAudio(raw: string, track: AudioTrackId): AudioClip | null {
  try {
    const value = JSON.parse(raw) as Partial<AudioClip>;
    if (!value || typeof value.id !== "string" || !/^[a-z0-9-]+$/.test(value.id)) return null;
    if (typeof value.source !== "string" || !value.source) return null;
    const media = Math.max(MIN_HOLD, finite(value.media, MIN_HOLD));
    const start = clampNum(finite(value.start, 0), 0, media);
    const end = clampNum(finite(value.end, media), Math.min(media, start + MIN_HOLD), media);
    const length = end - start;
    return {
      id: value.id,
      track,
      source: value.source,
      label: cleanLabel(typeof value.label === "string" ? value.label : value.id),
      media,
      start,
      end,
      at: Math.max(0, finite(value.at, 0)),
      volume: clampNum(finite(value.volume, 1), 0, 1),
      fadeIn: clampNum(finite(value.fadeIn, 0), 0, length),
      fadeOut: clampNum(finite(value.fadeOut, 0), 0, length),
    };
  } catch {
    return null;
  }
}

/** Null when the note is not a montage, including an older cut list or a plain sequence. */
export function parseSequenceFiche(id: string, source: string): Edit | null {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const { fields } = readFrontmatter(source);
  if (text(fields.type) !== "sequence") return null;
  if (text(fields.gesture) !== "montage") return null;
  const video = list(fields.plans).map(asVideo).filter((clip): clip is VideoClip => clip !== null);
  const audio = TRACKS.flatMap(track => list(fields[track]).map(line => asAudio(line, track)).filter((clip): clip is AudioClip => clip !== null));
  const name = cleanLabel(text(fields.nom)) || id;
  const edit = emptyEdit(id, name);
  edit.video = video;
  edit.audio = audio;
  if (num(fields.duree) === null && video.length === 0 && audio.length === 0 && !text(fields.nom)) return null;
  return edit;
}
