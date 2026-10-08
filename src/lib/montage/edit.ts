// Timeline moves for one sequence. Pure: no browser, no Comfy graph.
// Snap distance and the sample mix follow OpenCut classic (MIT):
// apps/web/src/timeline/snapping/resolve.ts and apps/web/src/media/audio.ts.
// See docs/CREDITS.md.

export const MIN_CLIP = 0.1;
/** OpenCut `DEFAULT_TIMELINE_SNAP_THRESHOLD_PX`. */
export const SNAP_THRESHOLD_PX = 10;
export const MIN_PX_PER_SECOND = 24;
export const MAX_PX_PER_SECOND = 220;
export const HISTORY_LIMIT = 50;

export type MediaKind = "video" | "image" | "slate";
export type AudioTrackId = "voix" | "effets" | "musique";

export interface VideoClip {
  id: string;
  kind: MediaKind;
  source: string | null;
  label: string;
  /** Full media length, in seconds. An image holds this long. */
  media: number;
  /** Trim in, inside the media. */
  start: number;
  /** Trim out, inside the media. */
  end: number;
  takeId: string | null;
  /** Playback rate. 2 plays the same trim in half the timeline length. */
  speed?: number;
  /** Seconds of dissolve into the next shot. */
  fadeOut?: number;
  /** Short title drawn on the picture. */
  title?: string;
}

export interface AudioClip {
  id: string;
  track: AudioTrackId;
  source: string;
  label: string;
  media: number;
  start: number;
  end: number;
  /** Position on the timeline, in seconds. */
  at: number;
  /** Linear gain, 0 to 1. */
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export interface Edit {
  id: string;
  name: string;
  video: VideoClip[];
  audio: AudioClip[];
}

export interface SnapPoint {
  time: number;
  kind: "start" | "end" | "playhead";
  clipId?: string;
}

export function span(clip: { start: number; end: number }): number {
  return Math.max(0, clip.end - clip.start);
}

/** Seconds the clip occupies on the timeline. Speed 2 halves that length. The trim stays in media time. */
export function playSpan(clip: { start: number; end: number; speed?: number }): number {
  const rate = clip.speed === undefined ? 1 : clipSpeed({ speed: clip.speed });
  return span(clip) / rate;
}

export function videoDuration(edit: Pick<Edit, "video">): number {
  return edit.video.reduce((sum, clip) => sum + playSpan(clip), 0);
}

export function audioEnd(clip: AudioClip): number {
  return clip.at + span(clip);
}

/** The longer of the picture and the last sound. */
export function editDuration(edit: Edit): number {
  const sound = edit.audio.reduce((max, clip) => Math.max(max, audioEnd(clip)), 0);
  return Math.max(videoDuration(edit), sound);
}

export function videoAt(edit: Pick<Edit, "video">, time: number): { clip: VideoClip; offset: number; index: number } | null {
  if (!(time >= 0)) return null;
  let cursor = 0;
  for (let index = 0; index < edit.video.length; index += 1) {
    const clip = edit.video[index];
    const length = playSpan(clip);
    if (time < cursor + length) return { clip, offset: time - cursor, index };
    cursor += length;
  }
  return null;
}

export function clipOrigin(edit: Pick<Edit, "video">, id: string): number | null {
  let cursor = 0;
  for (const clip of edit.video) {
    if (clip.id === id) return cursor;
    cursor += playSpan(clip);
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

export function reorderVideo(edit: Edit, from: number, to: number): Edit {
  if (from === to || from < 0 || to < 0 || from >= edit.video.length || to >= edit.video.length) return edit;
  const video = edit.video.slice();
  const [item] = video.splice(from, 1);
  video.splice(to, 0, item);
  return { ...edit, video };
}

/** Trim a packed video clip. Later clips ripple. The left edge stays put when the in-point moves. */
export function trimVideo(edit: Edit, id: string, edge: "start" | "end", timelineTime: number): Edit {
  const origin = clipOrigin(edit, id);
  if (origin === null || !Number.isFinite(timelineTime)) return edit;
  const video = edit.video.map(clip => {
    if (clip.id !== id) return clip;
    const rate = clipSpeed(clip);
    if (edge === "start") {
      const start = clamp(clip.start + (timelineTime - origin) * rate, 0, clip.end - MIN_CLIP);
      return start === clip.start ? clip : { ...clip, start };
    }
    const end = clamp(clip.start + (timelineTime - origin) * rate, clip.start + MIN_CLIP, clip.media);
    return end === clip.end ? clip : { ...clip, end };
  });
  if (video.every((clip, index) => clip === edit.video[index])) return edit;
  return { ...edit, video };
}

/** Split the video clip under the playhead. Both sides keep at least MIN_CLIP. */
export function splitVideo(edit: Edit, playhead: number, id: string): Edit {
  if (!id || edit.video.some(clip => clip.id === id)) return edit;
  let cursor = 0;
  for (let index = 0; index < edit.video.length; index += 1) {
    const clip = edit.video[index];
    const length = playSpan(clip);
    const local = playhead - cursor;
    if (local > MIN_CLIP && length - local > MIN_CLIP) {
      const cut = clip.start + local * clipSpeed(clip);
      const video = edit.video.slice();
      video.splice(index, 1, { ...clip, end: cut }, { ...clip, id, start: cut });
      return { ...edit, video };
    }
    cursor += length;
  }
  return edit;
}

export function canSplit(edit: Edit, playhead: number): boolean {
  return splitVideo(edit, playhead, "probe") !== edit;
}

export function deleteClip(edit: Edit, id: string): Edit {
  const video = edit.video.filter(clip => clip.id !== id);
  const audio = edit.audio.filter(clip => clip.id !== id);
  if (video.length === edit.video.length && audio.length === edit.audio.length) return edit;
  return { ...edit, video, audio };
}

export function moveAudio(edit: Edit, id: string, at: number): Edit {
  if (!Number.isFinite(at)) return edit;
  let changed = false;
  const audio = edit.audio.map(clip => {
    if (clip.id !== id) return clip;
    const next = Math.max(0, at);
    if (next === clip.at) return clip;
    changed = true;
    return { ...clip, at: next };
  });
  return changed ? { ...edit, audio } : edit;
}

/** Audio trims do not ripple. The left handle moves the clip’s start along the timeline. */
export function trimAudio(edit: Edit, id: string, edge: "start" | "end", timelineTime: number): Edit {
  if (!Number.isFinite(timelineTime)) return edit;
  let changed = false;
  const audio = edit.audio.map(clip => {
    if (clip.id !== id) return clip;
    if (edge === "start") {
      const at = Math.max(0, timelineTime);
      const start = clamp(clip.start + (at - clip.at), 0, clip.end - MIN_CLIP);
      const applied = start - clip.start;
      const nextAt = clip.at + applied;
      if (start === clip.start && nextAt === clip.at) return clip;
      changed = true;
      return { ...clip, start, at: nextAt };
    }
    const end = clamp(clip.start + (timelineTime - clip.at), clip.start + MIN_CLIP, clip.media);
    if (end === clip.end) return clip;
    changed = true;
    return { ...clip, end };
  });
  return changed ? { ...edit, audio } : edit;
}

export function setAudioLevels(edit: Edit, id: string, levels: { volume?: number; fadeIn?: number; fadeOut?: number }): Edit {
  let changed = false;
  const audio = edit.audio.map(clip => {
    if (clip.id !== id) return clip;
    const length = span(clip);
    const volume = levels.volume === undefined ? clip.volume : clamp(levels.volume, 0, 1);
    const fadeIn = levels.fadeIn === undefined ? clip.fadeIn : clamp(levels.fadeIn, 0, length);
    const fadeOut = levels.fadeOut === undefined ? clip.fadeOut : clamp(levels.fadeOut, 0, length);
    if (volume === clip.volume && fadeIn === clip.fadeIn && fadeOut === clip.fadeOut) return clip;
    changed = true;
    return { ...clip, volume, fadeIn, fadeOut };
  });
  return changed ? { ...edit, audio } : edit;
}

export function appendVideo(edit: Edit, clip: VideoClip): Edit {
  if (edit.video.some(item => item.id === clip.id)) return edit;
  if (clip.takeId && edit.video.some(item => item.takeId === clip.takeId)) return edit;
  return { ...edit, video: [...edit.video, clip] };
}

export function addAudio(edit: Edit, clip: AudioClip): Edit {
  if (edit.audio.some(item => item.id === clip.id)) return edit;
  return { ...edit, audio: [...edit.audio, clip] };
}

/** Seconds that match SNAP_THRESHOLD_PX at the current zoom. Same ratio as OpenCut’s tick threshold. */
export function snapThreshold(pxPerSecond: number): number {
  if (!(pxPerSecond > 0)) return 0;
  return SNAP_THRESHOLD_PX / pxPerSecond;
}

export function collectSnapPoints(edit: Edit, playhead: number, ignoreId?: string): SnapPoint[] {
  const points: SnapPoint[] = [{ time: playhead, kind: "playhead" }];
  let cursor = 0;
  for (const clip of edit.video) {
    const length = playSpan(clip);
    if (clip.id !== ignoreId) {
      points.push({ time: cursor, kind: "start", clipId: clip.id });
      points.push({ time: cursor + length, kind: "end", clipId: clip.id });
    }
    cursor += length;
  }
  for (const clip of edit.audio) {
    if (clip.id === ignoreId) continue;
    points.push({ time: clip.at, kind: "start", clipId: clip.id });
    points.push({ time: audioEnd(clip), kind: "end", clipId: clip.id });
  }
  return points;
}

/** Closest point inside the threshold. A tie keeps the first point, as OpenCut does. */
export function resolveSnap(time: number, points: readonly SnapPoint[], threshold: number): number {
  if (!(threshold >= 0) || !Number.isFinite(time)) return time;
  let best = time;
  let closest = Infinity;
  for (const point of points) {
    const distance = Math.abs(time - point.time);
    if (distance <= threshold && distance < closest) {
      closest = distance;
      best = point.time;
    }
  }
  return best;
}

export function nextZoom(current: number, factor: number): number {
  if (!(factor > 0)) return current;
  return clamp(current * factor, MIN_PX_PER_SECOND, MAX_PX_PER_SECOND);
}

export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const whole = Math.floor(safe + 1e-6);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/** Linear gain, with fades. OpenCut applies one gain per sample; the fades are ours. */
export function clipGain(levels: { volume: number; fadeIn: number; fadeOut: number }, local: number, duration: number): number {
  let gain = clamp(levels.volume, 0, 1);
  if (levels.fadeIn > 0 && local < levels.fadeIn) gain *= Math.max(0, local) / levels.fadeIn;
  const tail = duration - local;
  if (levels.fadeOut > 0 && tail < levels.fadeOut) gain *= Math.max(0, tail) / levels.fadeOut;
  return Math.max(0, gain);
}

export interface MixSpan {
  source: string;
  at: number;
  trim: number;
  duration: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  /** Playback rate. 1 reads the media as stored. */
  rate?: number;
}

/** Video files keep their own sound. Stills stay silent. The three tracks sit on top. */
export function mixSpans(edit: Edit): MixSpan[] {
  const spans: MixSpan[] = [];
  let cursor = 0;
  for (const clip of edit.video) {
    const duration = playSpan(clip);
    if (clip.kind === "video" && clip.source) {
      spans.push({ source: clip.source, at: cursor, trim: clip.start, duration, volume: 1, fadeIn: 0, fadeOut: 0, rate: clipSpeed(clip) });
    }
    cursor += duration;
  }
  for (const clip of edit.audio) {
    if (!clip.source) continue;
    spans.push({
      source: clip.source,
      at: clip.at,
      trim: clip.start,
      duration: span(clip),
      volume: clip.volume,
      fadeIn: clip.fadeIn,
      fadeOut: clip.fadeOut,
    });
  }
  return spans;
}

/**
 * Add one clip into an output channel.
 * Sample walk adapted from OpenCut `mixAudioChannels` (linear interpolation, gain per sample).
 */
export function mixInto(output: Float32Array, source: Float32Array, options: {
  at: number;
  trim: number;
  duration: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  sampleRate: number;
  sourceRate: number;
  rate?: number;
}): void {
  const { at, trim, duration, volume, fadeIn, fadeOut, sampleRate, sourceRate } = options;
  const rate = options.rate && options.rate > 0 ? options.rate : 1;
  if (!(sampleRate > 0) || !(sourceRate > 0) || !(duration > 0) || source.length === 0) return;
  const start = Math.floor(at * sampleRate);
  const count = Math.ceil(duration * sampleRate);
  for (let i = 0; i < count; i += 1) {
    const index = start + i;
    if (index < 0 || index >= output.length) continue;
    const local = i / sampleRate;
    const sourceIndex = (trim + local * rate) * sourceRate;
    if (sourceIndex >= source.length) break;
    const lower = Math.floor(sourceIndex);
    const upper = Math.min(source.length - 1, lower + 1);
    const fraction = sourceIndex - lower;
    const sample = (source[lower] ?? 0) * (1 - fraction) + (source[upper] ?? 0) * fraction;
    output[index] += sample * clipGain({ volume, fadeIn, fadeOut }, local, duration);
  }
}

/** Peak per bucket. Same reduction as OpenCut `computePeakBuckets`. */
export function peakBars(channel: Float32Array, count: number): number[] {
  const bars = Math.max(1, Math.floor(count));
  if (channel.length === 0) return Array.from({ length: bars }, () => 0);
  const peaks = Array.from({ length: bars }, () => 0);
  for (let bar = 0; bar < bars; bar += 1) {
    const from = Math.floor((bar * channel.length) / bars);
    const to = Math.max(from + 1, Math.floor(((bar + 1) * channel.length) / bars));
    let peak = 0;
    for (let index = from; index < to && index < channel.length; index += 1) {
      const value = Math.abs(channel[index] ?? 0);
      if (value > peak) peak = value;
    }
    peaks[bar] = peak;
  }
  return peaks;
}

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function historyOf<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

export function commit<T>(history: History<T>, next: T): History<T> {
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history;
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: [] };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo<T>(history: History<T>): History<T> {
  const next = history.future[0];
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future: history.future.slice(1) };
}

export function emptyEdit(id: string, name: string): Edit {
  return { id, name, video: [], audio: [] };
}

export function clipSpeed(clip: Pick<VideoClip, "speed">): number {
  const speed = clip.speed ?? 1;
  return speed >= 0.25 && speed <= 4 ? speed : 1;
}

/** Media time for a timeline offset inside the clip. Offset is in timeline seconds. */
export function mediaTime(clip: VideoClip, offset: number): number {
  const local = Math.max(0, offset) * clipSpeed(clip);
  return Math.min(clip.end, clip.start + local);
}

export function duplicateVideo(edit: Edit, id: string, nextId: string): Edit {
  if (!nextId || edit.video.some(clip => clip.id === nextId) || edit.audio.some(clip => clip.id === nextId)) return edit;
  const index = edit.video.findIndex(clip => clip.id === id);
  if (index < 0) return edit;
  const video = edit.video.slice();
  video.splice(index + 1, 0, { ...edit.video[index], id: nextId, takeId: null });
  return { ...edit, video };
}

export function duplicateAudio(edit: Edit, id: string, nextId: string): Edit {
  if (!nextId || edit.video.some(clip => clip.id === nextId) || edit.audio.some(clip => clip.id === nextId)) return edit;
  const index = edit.audio.findIndex(clip => clip.id === id);
  if (index < 0) return edit;
  const audio = edit.audio.slice();
  audio.splice(index + 1, 0, { ...edit.audio[index], id: nextId, at: audioEnd(edit.audio[index]) });
  return { ...edit, audio };
}

export function setVideoSpeed(edit: Edit, id: string, speed: number): Edit {
  if (!Number.isFinite(speed)) return edit;
  const next = Math.min(4, Math.max(0.25, speed));
  let changed = false;
  const video = edit.video.map(clip => {
    if (clip.id !== id || clipSpeed(clip) === next) return clip;
    changed = true;
    return { ...clip, speed: next };
  });
  return changed ? { ...edit, video } : edit;
}

export function setVideoFade(edit: Edit, id: string, fadeOut: number): Edit {
  if (!Number.isFinite(fadeOut)) return edit;
  let changed = false;
  const video = edit.video.map(clip => {
    if (clip.id !== id) return clip;
    const next = clamp(fadeOut, 0, span(clip));
    if ((clip.fadeOut ?? 0) === next) return clip;
    changed = true;
    return { ...clip, fadeOut: next };
  });
  return changed ? { ...edit, video } : edit;
}

export function setVideoTitle(edit: Edit, id: string, title: string): Edit {
  const next = title.replace(/\s+/g, " ").trim().slice(0, 80);
  let changed = false;
  const video = edit.video.map(clip => {
    if (clip.id !== id || (clip.title ?? "") === next) return clip;
    changed = true;
    return { ...clip, title: next };
  });
  return changed ? { ...edit, video } : edit;
}

/** How far the next shot has faded in, at the end of a clip that asked for a dissolve. */
export function fadeMix(edit: Edit, time: number): { index: number; mix: number } | null {
  const hit = videoAt(edit, time);
  if (!hit) return null;
  const fade = hit.clip.fadeOut ?? 0;
  if (!(fade > 0) || hit.index + 1 >= edit.video.length) return null;
  const left = playSpan(hit.clip) - hit.offset;
  if (left >= fade) return null;
  return { index: hit.index, mix: Math.min(1, Math.max(0, 1 - left / fade)) };
}
