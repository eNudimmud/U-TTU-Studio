// What the H3 trainer learns from: short video clips of the adherent, with the
// look's photos as each clip's reference images. fal refuses image-only and
// mixed archives, so photos ride along as `clipNN.ref_N.jpg` sidecars.

export const CLIPS_MIN = 10;
export const CLIPS_MAX = 30;
export const CLIP_SECONDS_MIN = 3;
/** Longer clips are split into scenes by the trainer, which then drops their reference images. */
export const CLIP_SECONDS_MAX = 30;
export const CLIP_BYTES_MAX = 300 * 1024 * 1024;
export const DATASET_BYTES_MAX = 2 * 1024 * 1024 * 1024;
export const REFS_PER_CLIP_MAX = 4;

const VIDEO_TYPES: Record<string, ClipFormat> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "video/x-msvideo": "avi",
  "video/avi": "avi",
};

export type ClipFormat = "mp4" | "mov" | "mkv" | "avi";
export type TrainingAspect = "9:16" | "16:9" | "1:1";

export interface Clip {
  path: string;
  format: ClipFormat;
  bytes: number;
  seconds: number;
  width: number;
  height: number;
}

/** The trainer reads .mp4, .mov, .avi and .mkv. WebM and the rest are refused before any upload. */
export function clipFormat(name: string, type: string): ClipFormat | null {
  const byType = VIDEO_TYPES[type.toLowerCase().split(";")[0].trim()];
  if (byType) return byType;
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return extension === "mp4" || extension === "mov" || extension === "mkv" || extension === "avi" ? extension : null;
}

export function clipProblem(clip: Pick<Clip, "bytes" | "seconds" | "width" | "height">): string | null {
  if (!(clip.seconds > 0) || !clip.width || !clip.height) return "Clip illisible sur cet appareil.";
  if (clip.seconds < CLIP_SECONDS_MIN) return `Clip trop court : ${CLIP_SECONDS_MIN} s au moins.`;
  if (clip.seconds > CLIP_SECONDS_MAX) return `Clip trop long : ${CLIP_SECONDS_MAX} s au plus.`;
  if (clip.bytes > CLIP_BYTES_MAX) return "Clip trop lourd : 300 Mo au plus.";
  return null;
}

export function clipAspect(clip: Pick<Clip, "width" | "height">): TrainingAspect {
  const ratio = clip.width / clip.height;
  return ratio < 0.8 ? "9:16" : ratio > 1.25 ? "16:9" : "1:1";
}

export interface DatasetCheck {
  ready: boolean;
  clips: number;
  bytes: number;
  aspect: TrainingAspect;
  problems: string[];
}

export function datasetCheck(clips: readonly Clip[], lookPhotos: number): DatasetCheck {
  const problems: string[] = [];
  const bytes = clips.reduce((total, clip) => total + clip.bytes, 0);
  if (lookPhotos < 2) problems.push("Le look doit tenir : deux photos au moins servent de références.");
  if (clips.length < CLIPS_MIN) problems.push(`${CLIPS_MIN - clips.length} clip${CLIPS_MIN - clips.length > 1 ? "s" : ""} de plus : ${CLIPS_MIN} au moins.`);
  if (clips.length > CLIPS_MAX) problems.push(`${CLIPS_MAX} clips au plus.`);
  if (bytes > DATASET_BYTES_MAX) problems.push("Les clips pèsent plus de 2 Go : retire les plus longs.");
  const counts: Record<TrainingAspect, number> = { "9:16": 0, "16:9": 0, "1:1": 0 };
  for (const clip of clips) counts[clipAspect(clip)]++;
  const aspect = (Object.entries(counts) as [TrainingAspect, number][]).sort((a, b) => b[1] - a[1])[0][0];
  return { ready: problems.length === 0, clips: clips.length, bytes, aspect, problems };
}

/** A word the model has never seen, said in every prompt that wants this person. */
export function triggerPhrase(name: string): string {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  return `${base || "look"}_uttu`;
}

export interface DatasetFile {
  name: string;
  blob: Blob;
}

/** clip01.mp4, clip01.ref_1.jpg … in the order the trainer matches them. */
export function datasetLayout(clips: readonly { blob: Blob; format: ClipFormat }[], refs: readonly Blob[]): DatasetFile[] {
  const files: DatasetFile[] = [];
  clips.forEach((clip, index) => {
    const base = `clip${String(index + 1).padStart(2, "0")}`;
    files.push({ name: `${base}.${clip.format}`, blob: clip.blob });
    refs.slice(0, REFS_PER_CLIP_MAX).forEach((ref, refIndex) => files.push({ name: `${base}.ref_${refIndex + 1}.jpg`, blob: ref }));
  });
  return files;
}
