// Browser MP4. Mediabunny writes the file in this tab. Nothing is uploaded.

import { editDuration, mixInto, mixSpans, type Edit } from "./edit.ts";
import { EXPORT_FPS, EXPORT_HEIGHT, EXPORT_WIDTH } from "./export-plan.ts";

const SAMPLE_RATE = 48_000;

export interface ExportInput {
  edit: Edit;
  urlOf(source: string): string;
  onProgress(done: number, total: number): void;
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

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return null;
  const image = new Image();
  image.decoding = "async";
  const done = new Promise<boolean>(resolve => {
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
  });
  image.src = url;
  return (await done) ? image : null;
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.04) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => {
      video.removeEventListener("seeked", finish);
      resolve();
    };
    video.addEventListener("seeked", finish);
    video.currentTime = time;
  });
}

async function mixAudio(edit: Edit, urlOf: (source: string) => string, seconds: number): Promise<AudioBuffer> {
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    const length = Math.max(1, Math.ceil(seconds * SAMPLE_RATE));
    const mixed = ctx.createBuffer(2, length, SAMPLE_RATE);
    for (const span of mixSpans(edit)) {
      const url = urlOf(span.source);
      if (!url) continue;
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const decoded = await ctx.decodeAudioData((await response.arrayBuffer()).slice(0));
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
          });
        }
      } catch {
        // A still, or a video without an audio track, adds silence.
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
  const width = EXPORT_WIDTH;
  const height = EXPORT_HEIGHT;
  const videoCodec = await mediabunny.getFirstEncodableVideoCodec(["avc"], { width, height, quality: mediabunny.QUALITY_LOW });
  const audioCodec = await mediabunny.getFirstEncodableAudioCodec(["aac"], { numberOfChannels: 2, sampleRate: SAMPLE_RATE, quality: mediabunny.QUALITY_LOW });
  if (!videoCodec || !audioCodec) throw new Error("unsupported");

  const frames = Math.max(1, Math.round(seconds * EXPORT_FPS));
  const frameDuration = 1 / EXPORT_FPS;
  const images = new Map<string, HTMLImageElement>();
  for (const clip of input.edit.video) {
    if (clip.kind !== "image" || !clip.source || images.has(clip.source)) continue;
    const image = await loadImage(input.urlOf(clip.source));
    if (image) images.set(clip.source, image);
  }
  const mixed = await mixAudio(input.edit, input.urlOf, seconds);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  let videoSourceUrl = "";

  const target = new mediabunny.BufferTarget();
  const output = new mediabunny.Output({ format: new mediabunny.Mp4OutputFormat(), target });
  const picture = new mediabunny.CanvasSource(canvas, { codec: videoCodec, quality: mediabunny.QUALITY_LOW });
  const sound = new mediabunny.AudioBufferSource({ codec: audioCodec, quality: mediabunny.QUALITY_LOW });
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
      for (const clip of input.edit.video) {
        const length = Math.max(0, clip.end - clip.start);
        if (time < cursor + length) {
          const local = time - cursor;
          if (clip.kind === "image" && clip.source) {
            const image = images.get(clip.source);
            if (image) contain(ctx, canvas, image, image.naturalWidth, image.naturalHeight);
          } else if (clip.kind === "video" && clip.source) {
            const url = input.urlOf(clip.source);
            if (url && videoSourceUrl !== url) {
              video.src = url;
              videoSourceUrl = url;
              await new Promise<void>(resolve => {
                video.onloadeddata = () => resolve();
                video.onerror = () => resolve();
              });
            }
            if (video.readyState >= 2) {
              await seekTo(video, clip.start + local);
              contain(ctx, canvas, video, video.videoWidth, video.videoHeight);
            }
          } else {
            ctx.fillStyle = "#c9a46a";
            ctx.font = "600 42px sans-serif";
            ctx.fillText(clip.label || "", 48, height / 2);
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
    video.removeAttribute("src");
    video.load();
  }
  const buffer = target.buffer;
  if (!buffer) throw new Error("empty");
  return new Blob([buffer], { type: "video/mp4" });
}
