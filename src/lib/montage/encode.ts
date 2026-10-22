// Browser MP4. Mediabunny writes the file in this tab. Nothing is uploaded.

import { editDuration, fadeMix, mediaTime, mixInto, mixSpans, playSpan, type Edit } from "./edit.ts";
import { EXPORT_FPS, EXPORT_HEIGHT, EXPORT_WIDTH } from "./export-plan.ts";

const SAMPLE_RATE = 48_000;
let aacFallback: Promise<void> | null = null;

export interface ExportInput {
  edit: Edit;
  vertical?: boolean;
  urlOf(source: string): string;
  onProgress(done: number, total: number): void;
  /** Something was left out but the file is still written (a sound this browser cannot read). */
  onWarning?(message: string): void;
  /** Taille et cadence du fichier. Par défaut, l'export léger du téléphone. */
  size?: { width: number; height: number; fps: number; quality: "low" | "high" };
}

function contain(
  ctx: CanvasRenderingContext2D,
  box: { width: number; height: number },
  source: CanvasImageSource,
  sw: number,
  sh: number,
) {
  if (sw <= 0 || sh <= 0) return;
  const scale = Math.min(box.width / sw, box.height / sh);
  const width = sw * scale;
  const height = sh * scale;
  ctx.drawImage(source, (box.width - width) / 2, (box.height - height) / 2, width, height);
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  if (!url) throw new Error("Une image du montage manque.");
  const image = new Image();
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("L’image ne répond pas.")), 15000);
    image.onload = () => { clearTimeout(timer); resolve(); };
    image.onerror = () => { clearTimeout(timer); reject(new Error("Une image est illisible.")); };
    image.src = url;
  });
  return image;
}

export function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Math.max(0, Math.min(time, video.duration - 0.001));
  if (Math.abs(video.currentTime - target) < 0.001 && video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); video.removeEventListener("seeked", finish); video.removeEventListener("error", fail); };
    const finish = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error("Une image de la vidéo ne peut pas être lue.")); };
    const timer = window.setTimeout(fail, 15000);
    video.addEventListener("seeked", finish);
    video.addEventListener("error", fail);
    video.currentTime = target;
  });
}

async function loadVideo(url: string): Promise<HTMLVideoElement> {
  if (!url) throw new Error("Une vidéo du montage manque.");
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("La vidéo ne répond pas.")), 15000);
    video.onloadeddata = () => { clearTimeout(timer); resolve(); };
    video.onerror = () => { clearTimeout(timer); reject(new Error("Une vidéo est illisible.")); };
    video.src = url;
  });
  return video;
}

/** A take whose sound this browser cannot decode: the export keeps going without it, and says so. */
export const SOUND_SKIPPED = "Le son d’au moins une prise ne se lit pas dans ce navigateur : la vidéo est exportée sans ce son.";

async function mixAudio(edit: Edit, urlOf: (source: string) => string, seconds: number, skipped?: string[]): Promise<AudioBuffer> {
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    const length = Math.max(1, Math.ceil(seconds * SAMPLE_RATE));
    const mixed = ctx.createBuffer(2, length, SAMPLE_RATE);
    for (const span of mixSpans(edit)) {
      const url = urlOf(span.source);
      if (!url) throw new Error("Un média sonore du montage manque.");
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error("Un média sonore est inaccessible.");
      const bytes = await response.arrayBuffer();
      try {
        const decoded = await ctx.decodeAudioData(bytes.slice(0));
        for (let channel = 0; channel < 2; channel += 1) {
          const sourceChannel = Math.min(channel, decoded.numberOfChannels - 1);
          mixInto(mixed.getChannelData(channel), decoded.getChannelData(sourceChannel), {
            at: span.at,
            trim: span.trim,
            duration: span.duration,
            volume: span.volume,
            fadeIn: span.fadeIn,
            fadeOut: span.fadeOut,
            sampleRate: SAMPLE_RATE,
            sourceRate: decoded.sampleRate,
            rate: span.rate,
          });
        }
      } catch {
        // Distinguish an actually silent video from a broken audio decoder.
        const explicitSound = edit.audio.some(clip => clip.source === span.source);
        if (explicitSound) throw new Error("Une piste son est illisible. Corrige-la avant l’export.");
        const mb = await import("mediabunny");
        const input = new mb.Input({ source: new mb.BlobSource(new Blob([bytes])), formats: mb.ALL_FORMATS });
        let sound = false;
        try { sound = Boolean(await input.getPrimaryAudioTrack()); }
        finally { input.dispose(); }
        if (sound && !skipped) throw new Error("Le son de cette vidéo ne peut pas être décodé dans ce navigateur.");
        if (sound) skipped?.push(span.source);
      }
    }
    return mixed;
  } finally {
    await ctx.close();
  }
}

/** What this browser can write, best first. MP4 H.264 is the target; the others keep phones working. */
export type ExportRoute =
  | { kind: "webcodecs"; video: string; audio: string; container: "mp4" }
  | { kind: "recorder"; mime: string; container: "mp4" | "webm" }
  | { kind: "none" };

/** Video codecs tried in MP4, in order. H.264 plays everywhere; HEVC, VP9 and AV1 cover phones without it. */
export const MP4_VIDEO_CODECS = ["avc", "hevc", "vp9", "av1"] as const;
/** MediaRecorder types, Safari's MP4 first. Used only when WebCodecs cannot encode. */
export const RECORDER_TYPES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"] as const;

/** Pure choice, unit-tested: WebCodecs MP4 first, then real-time recording, never a dead end silently. */
export function chooseExportRoute(caps: { video: string | null; audio: string | null; recorder: readonly string[]; strict?: boolean }): ExportRoute {
  if (caps.video && caps.audio && (!caps.strict || caps.video === "avc")) return { kind: "webcodecs", video: caps.video, audio: caps.audio, container: "mp4" };
  if (caps.strict) return { kind: "none" };
  const mime = RECORDER_TYPES.find(type => caps.recorder.includes(type));
  if (mime) return { kind: "recorder", mime, container: mime.startsWith("video/mp4") ? "mp4" : "webm" };
  return { kind: "none" };
}

/** File extension for an exported blob. */
export function exportExtension(blob: Blob): "mp4" | "webm" {
  return blob.type.includes("webm") ? "webm" : "mp4";
}

export const EXPORT_IMPOSSIBLE = "Ce navigateur ne sait écrire aucune vidéo (ni WebCodecs, ni enregistrement). Mets à jour le navigateur du téléphone (Safari 16.4 ou plus, Chrome Android), puis relance l’export : le montage est gardé.";

function recorderTypes(): string[] {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return [];
  return RECORDER_TYPES.filter(type => { try { return MediaRecorder.isTypeSupported(type); } catch { return false; } });
}

/**
 * Writes the cut in this tab. Route 1: WebCodecs MP4 (H.264, else HEVC/VP9/AV1).
 * Route 2: real-time recording of the canvas (MP4 on Safari, WebM elsewhere).
 * `strict` (Finaliser master) accepts only H.264 MP4.
 */
export async function exportMp4(input: ExportInput & { strict?: boolean }): Promise<Blob> {
  const seconds = editDuration(input.edit);
  if (!(seconds > 0)) throw new Error("empty");
  const mediabunny = await import("mediabunny");
  const width = input.size?.width ?? (input.vertical ? EXPORT_HEIGHT : EXPORT_WIDTH);
  const height = input.size?.height ?? (input.vertical ? EXPORT_WIDTH : EXPORT_HEIGHT);
  const fps = input.size?.fps ?? EXPORT_FPS;
  const format = new mediabunny.Mp4OutputFormat();
  const quality = input.size?.quality === "high" ? mediabunny.QUALITY_HIGH : mediabunny.QUALITY_LOW;
  const hasEncoder = typeof (globalThis as { VideoEncoder?: unknown }).VideoEncoder !== "undefined";
  const videoCodec = hasEncoder
    ? await mediabunny.getFirstEncodableVideoCodec(input.strict ? ["avc"] : [...MP4_VIDEO_CODECS], { width, height, quality }).catch(() => null)
    : null;
  const audioConfig = { numberOfChannels: 2, sampleRate: SAMPLE_RATE, quality };
  // AAC first (plays everywhere), natively or with the local WASM encoder; Opus only if both are missing.
  let audioCodec = videoCodec ? await mediabunny.getFirstEncodableAudioCodec(["aac"], audioConfig).catch(() => null) : null;
  if (videoCodec && !audioCodec) {
    // Some browsers decode AAC but cannot encode it. This optional WASM encoder
    // runs locally and is loaded only for an export that needs it.
    try {
      aacFallback ??= import("@mediabunny/aac-encoder").then(({ registerAacEncoder }) => registerAacEncoder());
      await aacFallback;
      audioCodec = await mediabunny.getFirstEncodableAudioCodec(["aac"], audioConfig);
    } catch { aacFallback = null; }
    if (!audioCodec && !input.strict) audioCodec = await mediabunny.getFirstEncodableAudioCodec(["opus"], audioConfig).catch(() => null);
  }
  const route = chooseExportRoute({ video: videoCodec, audio: audioCodec, recorder: recorderTypes(), strict: input.strict });
  if (route.kind === "none") throw new Error(input.strict ? "Ce navigateur ne peut pas écrire le fichier maître H.264. Exporte d’abord le montage (il marche sur ce téléphone), ou relance Finaliser depuis un navigateur à jour." : EXPORT_IMPOSSIBLE);

  const frames = Math.max(1, Math.round(seconds * fps));
  const frameDuration = 1 / fps;
  const images = new Map<string, HTMLImageElement>();
  for (const clip of input.edit.video) {
    if (clip.kind !== "image" || !clip.source || images.has(clip.source)) continue;
    const image = await loadImage(input.urlOf(clip.source));
    images.set(clip.source, image);
  }
  // The master (strict) refuses to lose a sound; a phone export keeps the pictures and warns.
  const skipped: string[] | undefined = input.strict ? undefined : [];
  const mixed = await mixAudio(input.edit, input.urlOf, seconds, skipped);
  if (skipped?.length) input.onWarning?.(SOUND_SKIPPED);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const videos = new Map<string, HTMLVideoElement>();
  async function drawClip(clip: Edit["video"][number], local: number) {
    if (clip.kind === "slate") {
      ctx!.fillStyle = "#ededf0";
      ctx!.font = "600 42px sans-serif";
      ctx!.fillText(clip.label || "", 48, height / 2);
      return;
    }
    if (!clip.source) throw new Error("Un plan ne contient aucun média.");
    if (clip.kind === "image") {
      const image = images.get(clip.source);
      if (!image) throw new Error("Une image du montage manque.");
      contain(ctx!, canvas, image, image.naturalWidth, image.naturalHeight);
    } else {
      let video = videos.get(clip.source);
      if (!video) { video = await loadVideo(input.urlOf(clip.source)); videos.set(clip.source, video); }
      await seekTo(video, mediaTime(clip, local));
      contain(ctx!, canvas, video, video.videoWidth, video.videoHeight);
    }
  }
  async function drawAt(time: number) {
    ctx!.fillStyle = "#0f0f11";
    ctx!.fillRect(0, 0, width, height);
    let cursor = 0;
    for (let index = 0; index < input.edit.video.length; index += 1) {
      const clip = input.edit.video[index];
      const length = playSpan(clip);
      if (time < cursor + length) {
        await drawClip(clip, time - cursor);
        if (clip.title) {
          ctx!.fillStyle = "rgba(0,0,0,.55)";
          ctx!.fillRect(0, height - 72, width, 72);
          ctx!.fillStyle = "#ededf0";
          ctx!.font = "600 28px sans-serif";
          ctx!.fillText(clip.title, 24, height - 28);
        }
        const mix = fadeMix(input.edit, time);
        if (mix && mix.index === index) {
          const next = input.edit.video[index + 1];
          ctx!.save();
          ctx!.globalAlpha = mix.mix;
          if (next) await drawClip(next, 0);
          ctx!.restore();
        }
        return;
      }
      cursor += length;
    }
  }

  try {
    if (route.kind === "recorder") return await recordRealtime({ canvas, drawAt, mixed, seconds, fps, mime: route.mime, onProgress: input.onProgress });
    const target = new mediabunny.BufferTarget();
    const output = new mediabunny.Output({ format, target });
    const picture = new mediabunny.CanvasSource(canvas, { codec: route.video as Parameters<typeof mediabunny.getFirstEncodableVideoCodec>[0][number], quality });
    const sound = new mediabunny.AudioBufferSource({ codec: route.audio as Parameters<typeof mediabunny.getFirstEncodableAudioCodec>[0][number], quality });
    output.addVideoTrack(picture);
    output.addAudioTrack(sound);
    await output.start();
    for (let frame = 0; frame < frames; frame += 1) {
      await drawAt(Math.min(seconds - 0.001, frame * frameDuration));
      await picture.add(frame * frameDuration, frameDuration);
      input.onProgress(frame + 1, frames);
    }
    await sound.add(mixed);
    await output.finalize();
    const buffer = target.buffer;
    if (!buffer) throw new Error("empty");
    return new Blob([buffer], { type: "video/mp4" });
  } finally {
    for (const video of videos.values()) { video.removeAttribute("src"); video.load(); }
  }
}

/** Route 2: plays the cut once in real time into MediaRecorder. Slower, but it works where WebCodecs cannot encode. */
async function recordRealtime(job: { canvas: HTMLCanvasElement; drawAt(time: number): Promise<void>; mixed: AudioBuffer; seconds: number; fps: number; mime: string; onProgress(done: number, total: number): void }): Promise<Blob> {
  const stream = job.canvas.captureStream(job.fps);
  const audio = new AudioContext({ sampleRate: SAMPLE_RATE });
  const destination = audio.createMediaStreamDestination();
  const source = audio.createBufferSource();
  source.buffer = job.mixed;
  source.connect(destination);
  const recorder = new MediaRecorder(new MediaStream([...stream.getVideoTracks(), ...destination.stream.getAudioTracks()]), { mimeType: job.mime, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  const stopped = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
  const total = Math.max(1, Math.round(job.seconds * job.fps));
  try {
    await job.drawAt(0);
    if (audio.state === "suspended") await audio.resume().catch(() => undefined);
    recorder.start(250);
    source.start();
    const t0 = performance.now();
    // Draw the frame for the real elapsed time, so picture and sound stay together even on a slow phone.
    for (;;) {
      const elapsed = (performance.now() - t0) / 1000;
      if (elapsed >= job.seconds) break;
      await job.drawAt(Math.min(job.seconds - 0.001, elapsed));
      job.onProgress(Math.min(total, Math.round(elapsed * job.fps)), total);
      await new Promise(resolve => setTimeout(resolve, 1000 / job.fps / 2));
    }
    job.onProgress(total, total);
    recorder.stop();
    await stopped;
  } finally {
    try { source.stop(); } catch {}
    for (const track of stream.getTracks()) track.stop();
    await audio.close().catch(() => undefined);
  }
  const type = job.mime.split(";")[0];
  const blob = new Blob(chunks, { type });
  if (!blob.size) throw new Error("L’enregistrement de la vidéo est vide. Relance l’export en gardant cet onglet ouvert.");
  return blob;
}
