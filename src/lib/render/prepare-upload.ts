// The one place a user file is made ready for Comfy Cloud. Every upload goes
// through client.upload(), which calls prepareUpload() first: the relay
// (src/proxy.ts on Vercel) refuses any body above ~4 MB with 413, and a phone
// photo (6–12 MB) or clip (10–40 MB) is well above that.
//
// planUpload() is pure and unit-tested: it decides, from what the workflow
// really consumes, whether a file goes as it is, is re-encoded, or is refused
// with a clear line. runPlan() does the browser work (canvas, WebCodecs).

import { POSE_FPS, POSE_FRAMES, UPLOAD_HEAVY, UPLOAD_MAX_BYTES, poseVideoTarget, uploadTooHeavy } from "./upload-limit.ts";

/** French source lines; phrase.ts maps them per locale (runtime.*). */
export const PREPARE_FAILED = "Ce navigateur n’a pas pu préparer ce fichier pour l’envoi. Essaie une photo en jpg ou une vidéo mp4 plus courte.";
export const VIDEO_TOO_LONG = "Vidéo trop longue pour l’envoi : une minute au plus. Raccourcis le clip.";
export const AUDIO_TOO_LONG = "Son trop long pour l’envoi : six minutes au plus. Raccourcis le fichier.";
export const FINAL_TOO_HEAVY = "Finaliser garde la qualité de la source : au-delà de 3,8 Mo, elle ne peut pas encore partir sans être dégradée. Raccourcis la vidéo ou finalise-la en plusieurs morceaux.";
export const FINAL_IMAGE_TOO_HEAVY = "Finaliser garde la qualité de la source : cette image dépasse 3,8 Mo même en jpg de haute qualité. Prends une image plus petite.";

/** What the workflow consumes from this file. */
export type UploadNeed =
  | { kind: "image"; maxSide?: number; keepQuality?: boolean }
  | { kind: "video"; maxSide?: number; maxFps?: number; maxSeconds?: number; keepFps?: boolean; keepQuality?: boolean; pose?: boolean }
  | { kind: "audio"; maxSeconds?: number };

/** Measured facts about a file, read in the browser. */
export interface MediaFacts { bytes: number; type: string; width?: number; height?: number; seconds?: number | null; fps?: number | null; hasAudio?: boolean }

export type UploadPlan =
  | { action: "keep" }
  | { action: "refuse"; message: string }
  | { action: "image"; attempts: { maxSide: number; quality: number }[] }
  | { action: "video"; width: number; height: number; frameRate?: number; end?: number; videoBitrate: number; audio: boolean; audioBitrate: number }
  | { action: "audio"; end?: number; bitrate: number };

const IMAGE_SIDE = 2048; // every still template here works at 1–2 MP
const VIDEO_SIDE = 1280; // takes and tools work at 480p–720p
const VIDEO_FPS = 30;
const VIDEO_MIN_BITRATE = 400_000;
const VIDEO_MAX_BITRATE = 4_000_000;
const AUDIO_IN_VIDEO = 96_000;
const AUDIO_MIN_BITRATE = 64_000;
const AUDIO_MAX_BITRATE = 128_000;
/** Bits we let the re-encoded file use: 8 % below the ceiling, for container overhead. */
const BUDGET_BITS = UPLOAD_MAX_BYTES * 8 * 0.92;

/** Need per Comfy template; anything else is read from the file type. */
export function needForTemplate(template: string | undefined, kind: UploadNeed["kind"]): UploadNeed {
  if (kind === "video") {
    if (template === "video_wan_animate2") return { kind, pose: true };
    if (template === "utility_seedvr2_3b_int8_upscale_video" || template === "RTXVideoSuperResolution") return { kind, keepQuality: true };
    if (template === "utility_video_frame_interpolation") return { kind, keepFps: true };
    return { kind };
  }
  if (kind === "image") return template === "utility_seedvr2_3b_int8_upscale_image" ? { kind, keepQuality: true } : { kind };
  return { kind };
}

export function kindOf(type: string): UploadNeed["kind"] {
  return type.startsWith("video/") ? "video" : type.startsWith("audio/") ? "audio" : "image";
}

const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);

/** Decides what to do with a file. Pure. */
export function planUpload(facts: MediaFacts, need: UploadNeed): UploadPlan {
  const heavy = uploadTooHeavy(facts.bytes);
  if (need.kind === "image") {
    if (!heavy) return { action: "keep" };
    if (need.keepQuality) {
      const side = Math.max(facts.width ?? 0, facts.height ?? 0) || 8192;
      return { action: "image", attempts: [{ maxSide: side, quality: 0.95 }, { maxSide: side, quality: 0.92 }] };
    }
    const side = need.maxSide ?? IMAGE_SIDE;
    return { action: "image", attempts: [{ maxSide: side, quality: 0.9 }, { maxSide: side, quality: 0.82 }, { maxSide: Math.round(side * 0.75), quality: 0.82 }] };
  }
  if (need.kind === "audio") {
    if (!heavy) return { action: "keep" };
    const seconds = facts.seconds && facts.seconds > 0 ? Math.min(facts.seconds, need.maxSeconds ?? Infinity) : null;
    if (!seconds) return { action: "audio", bitrate: AUDIO_MIN_BITRATE, end: need.maxSeconds };
    const bitrate = Math.min(AUDIO_MAX_BITRATE, Math.floor(BUDGET_BITS / seconds / 1000) * 1000);
    if (bitrate < AUDIO_MIN_BITRATE) return { action: "refuse", message: AUDIO_TOO_LONG };
    return { action: "audio", bitrate, end: need.maxSeconds && facts.seconds && facts.seconds > need.maxSeconds ? need.maxSeconds : undefined };
  }
  // Video.
  const width = facts.width || 0;
  const height = facts.height || 0;
  if (need.pose) {
    const target = poseVideoTarget({ width, height, seconds: facts.seconds ?? null });
    return { action: "video", width: target.width, height: target.height, frameRate: target.frameRate, end: target.end, videoBitrate: 1_500_000, audio: false, audioBitrate: 0 };
  }
  if (!heavy) return { action: "keep" };
  if (need.keepQuality) return { action: "refuse", message: FINAL_TOO_HEAVY };
  const full = facts.seconds && facts.seconds > 0 ? facts.seconds : null;
  const seconds = full && need.maxSeconds ? Math.min(full, need.maxSeconds) : full;
  const end = full && need.maxSeconds && full > need.maxSeconds ? need.maxSeconds : undefined;
  if (!seconds) return { action: "refuse", message: PREPARE_FAILED };
  const audio = Boolean(facts.hasAudio);
  const videoBits = BUDGET_BITS / seconds - (audio ? AUDIO_IN_VIDEO : 0);
  if (videoBits < VIDEO_MIN_BITRATE) return { action: "refuse", message: VIDEO_TOO_LONG };
  const side = need.maxSide ?? VIDEO_SIDE;
  const scale = width && height ? Math.min(1, side / Math.max(width, height)) : 1;
  const fps = need.keepFps ? undefined : facts.fps && facts.fps > (need.maxFps ?? VIDEO_FPS) ? need.maxFps ?? VIDEO_FPS : undefined;
  return {
    action: "video",
    width: even((width || side) * scale),
    height: even((height || Math.round(side * 9 / 16)) * scale),
    frameRate: fps,
    end,
    videoBitrate: Math.min(VIDEO_MAX_BITRATE, Math.floor(videoBits / 1000) * 1000),
    audio,
    audioBitrate: audio ? AUDIO_IN_VIDEO : 0,
  };
}

const baseName = (name: string, fallback: string) => name.replace(/\.[a-z0-9]+$/i, "") || fallback;

async function probe(file: Blob, kind: UploadNeed["kind"]): Promise<MediaFacts> {
  const facts: MediaFacts = { bytes: file.size, type: file.type };
  if (kind === "image") {
    if (typeof createImageBitmap !== "function") return facts;
    try {
      const bitmap = await createImageBitmap(file);
      facts.width = bitmap.width;
      facts.height = bitmap.height;
      bitmap.close();
    } catch {}
    return facts;
  }
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    facts.seconds = await input.computeDuration().catch(() => null);
    const video = await input.getPrimaryVideoTrack().catch(() => null);
    if (video) {
      facts.width = video.displayWidth;
      facts.height = video.displayHeight;
      const stats = await video.computePacketStats(120).catch(() => null);
      facts.fps = stats?.averagePacketRate ?? null;
    }
    facts.hasAudio = Boolean(await input.getPrimaryAudioTrack().catch(() => null));
  } finally {
    input.dispose?.();
  }
  return facts;
}

async function encodeImage(file: Blob, name: string, attempts: { maxSide: number; quality: number }[]): Promise<File | null> {
  const bitmap = await createImageBitmap(file);
  try {
    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", attempt.quality));
      if (blob && !uploadTooHeavy(blob.size)) return new File([blob], `${baseName(name, "photo")}.jpg`, { type: "image/jpeg" });
    }
    return null;
  } finally {
    bitmap.close();
  }
}

async function convert(file: Blob, name: string, plan: Extract<UploadPlan, { action: "video" | "audio" }>): Promise<File> {
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target: new mb.BufferTarget() });
  const end = plan.end;
  // AAC where the browser has it (Safari, Chrome), else Opus; both load in Comfy (PyAV).
  const codec = (await mb.getFirstEncodableAudioCodec(["aac", "opus"]).catch(() => null)) ?? "aac";
  const conversion = await mb.Conversion.init({
    input,
    output,
    showWarnings: false,
    ...(end ? { trim: { start: 0, end } } : {}),
    video: plan.action === "video"
      ? { width: plan.width, height: plan.height, fit: "fill", ...(plan.frameRate ? { frameRate: plan.frameRate } : {}), bitrate: plan.videoBitrate, forceTranscode: true }
      : { discard: true },
    audio: plan.action === "audio"
      ? { codec, bitrate: plan.bitrate, forceTranscode: true }
      : plan.audio ? { codec, bitrate: plan.audioBitrate, forceTranscode: true } : { discard: true },
  });
  if (!conversion.isValid) {
    // An audio track the browser cannot encode: drop it rather than fail.
    if (plan.action === "video" && plan.audio) return convert(file, name, { ...plan, audio: false, audioBitrate: 0 });
    throw new Error("conversion invalid");
  }
  await conversion.execute();
  const buffer = output.target.buffer;
  if (!buffer || !buffer.byteLength) throw new Error("empty");
  return plan.action === "audio"
    ? new File([buffer], `${baseName(name, "son")}.m4a`, { type: "audio/mp4" })
    : new File([buffer], `${baseName(name, "video")}.mp4`, { type: "video/mp4" });
}

/**
 * Makes a file ready for the relay: as it is when it fits and the workflow
 * takes it whole, re-encoded to what the workflow consumes otherwise, or
 * refused with a clear line. The returned File carries the right type and name.
 */
export async function prepareUpload(file: Blob, name: string, need?: UploadNeed): Promise<File> {
  const kind = need?.kind ?? kindOf(file.type);
  const wanted: UploadNeed = need ?? ({ kind } as UploadNeed);
  const asFile = file instanceof File && file.name === name ? file : new File([file], name, { type: file.type });
  // Light files that the workflow takes whole skip probing entirely.
  if (!uploadTooHeavy(file.size) && !(wanted.kind === "video" && wanted.pose)) return asFile;
  // Finaliser never re-encodes its video: refuse before any decoding.
  if (wanted.kind === "video" && wanted.keepQuality) throw new Error(FINAL_TOO_HEAVY);
  let plan: UploadPlan;
  try {
    plan = planUpload(await probe(file, kind), wanted);
  } catch {
    plan = uploadTooHeavy(file.size) ? { action: "refuse", message: PREPARE_FAILED } : { action: "keep" };
  }
  if (plan.action === "keep") return asFile;
  if (plan.action === "refuse") throw new Error(plan.message);
  try {
    const out = plan.action === "image" ? await encodeImage(file, name, plan.attempts) : await convert(file, name, plan);
    if (out && !uploadTooHeavy(out.size)) return out;
    if (!out && wanted.kind === "image" && wanted.keepQuality) throw new Error(FINAL_IMAGE_TOO_HEAVY);
    throw new Error(UPLOAD_HEAVY);
  } catch (error) {
    if (error instanceof Error && [FINAL_IMAGE_TOO_HEAVY, UPLOAD_HEAVY].includes(error.message)) throw error;
    // Older browser without an encoder: a light file still goes as it is.
    if (!uploadTooHeavy(file.size)) return asFile;
    throw new Error(PREPARE_FAILED);
  }
}

export { POSE_FPS, POSE_FRAMES };
