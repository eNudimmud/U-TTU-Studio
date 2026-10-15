// Browser MP4. Mediabunny writes the file in this tab. Nothing is uploaded.

import { editDuration, fadeMix, mediaTime, mixInto, mixSpans, playSpan, type Edit } from "./edit.ts";
import { EXPORT_FPS, EXPORT_HEIGHT, EXPORT_WIDTH } from "./export-plan.ts";

const SAMPLE_RATE = 48_000;

export interface ExportInput {
  edit: Edit;
  vertical?: boolean;
  urlOf(source: string): string;
  onProgress(done: number, total: number): void;
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

async function mixAudio(edit: Edit, urlOf: (source: string) => string, seconds: number): Promise<AudioBuffer> {
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
        if (explicitSound) throw new Error("Une piste son est illisible. Corrigez-la avant l’export.");
        const mb = await import("mediabunny");
        const input = new mb.Input({ source: new mb.BlobSource(new Blob([bytes])), formats: mb.ALL_FORMATS });
        try { if (await input.getPrimaryAudioTrack()) throw new Error("Le son de cette vidéo ne peut pas être décodé dans ce navigateur."); }
        finally { input.dispose(); }
      }
    }
    return mixed;
  } finally {
    await ctx.close();
  }
}

/** Throws when this browser cannot encode H.264 and AAC. */
export async function exportMp4(input: ExportInput): Promise<Blob> {
  const seconds = editDuration(input.edit);
  if (!(seconds > 0)) throw new Error("empty");
  const mediabunny = await import("mediabunny");
  const width = input.size?.width ?? (input.vertical ? EXPORT_HEIGHT : EXPORT_WIDTH);
  const height = input.size?.height ?? (input.vertical ? EXPORT_WIDTH : EXPORT_HEIGHT);
  const fps = input.size?.fps ?? EXPORT_FPS;
  const format = new mediabunny.Mp4OutputFormat();
  const quality = input.size?.quality === "high" ? mediabunny.QUALITY_HIGH : mediabunny.QUALITY_LOW;
  // Require broadly interoperable MP4 codecs; never silently change the output contract.
  const videoCodec = await mediabunny.getFirstEncodableVideoCodec(["avc"], { width, height, quality });
  const audioCodec = await mediabunny.getFirstEncodableAudioCodec(["aac"], { numberOfChannels: 2, sampleRate: SAMPLE_RATE, quality });
  if (!videoCodec || !audioCodec) throw new Error("Ce navigateur ne peut pas encoder le MP4 H.264/AAC. Essayez Chrome récent sur ordinateur.");

  const frames = Math.max(1, Math.round(seconds * fps));
  const frameDuration = 1 / fps;
  const images = new Map<string, HTMLImageElement>();
  for (const clip of input.edit.video) {
    if (clip.kind !== "image" || !clip.source || images.has(clip.source)) continue;
    const image = await loadImage(input.urlOf(clip.source));
    images.set(clip.source, image);
  }
  const mixed = await mixAudio(input.edit, input.urlOf, seconds);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const videos = new Map<string, HTMLVideoElement>();
  async function drawClip(clip: Edit["video"][number], local: number) {
    if (clip.kind === "slate") {
      ctx!.fillStyle = "#c9a46a";
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

  const target = new mediabunny.BufferTarget();
  const output = new mediabunny.Output({ format, target });
  const picture = new mediabunny.CanvasSource(canvas, { codec: videoCodec, quality });
  const sound = new mediabunny.AudioBufferSource({ codec: audioCodec, quality });
  output.addVideoTrack(picture);
  output.addAudioTrack(sound);
  await output.start();

  try {
    for (let frame = 0; frame < frames; frame += 1) {
      const time = Math.min(seconds - 0.001, frame * frameDuration);
      ctx.fillStyle = "#0b0a09";
      ctx.fillRect(0, 0, width, height);
      let cursor = 0;
      let drawn = false;
      for (let index = 0; index < input.edit.video.length; index += 1) {
        const clip = input.edit.video[index];
        const length = playSpan(clip);
        if (time < cursor + length) {
          const local = time - cursor;
          await drawClip(clip, local);
          if (clip.title) {
            ctx.fillStyle = "rgba(0,0,0,.55)";
            ctx.fillRect(0, height - 72, width, 72);
            ctx.fillStyle = "#f4efe6";
            ctx.font = "600 28px sans-serif";
            ctx.fillText(clip.title, 24, height - 28);
          }
          const mix = fadeMix(input.edit, time);
          if (mix && mix.index === index) {
            const next = input.edit.video[index + 1];
            ctx.save();
            ctx.globalAlpha = mix.mix;
            if (next) await drawClip(next, 0);
            ctx.restore();
          }
          drawn = true;
          break;
        }
        cursor += length;
      }
      if (!drawn) ctx.fillRect(0, 0, width, height);
      await picture.add(frame * frameDuration, frameDuration);
      input.onProgress(frame + 1, frames);
    }
    await sound.add(mixed);
    await output.finalize();
  } finally {
    for (const video of videos.values()) { video.removeAttribute("src"); video.load(); }
  }
  const buffer = target.buffer;
  if (!buffer) throw new Error("empty");
  return new Blob([buffer], { type: "video/mp4" });
}
