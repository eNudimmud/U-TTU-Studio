// Copier un mouvement: the pose clip is re-encoded in the browser before upload.
// One 81-frame window at 16 fps, sized to the box the graph crops to, no sound:
// a phone clip of 8–20 MB becomes about 1 MB, under the relay's 4 MB ceiling,
// and the render is one window, the one the quote was measured on.

import { POSE_VIDEO_FAILED, poseVideoTarget, uploadTooHeavy } from "../render/upload-limit.ts";

export async function preparePoseVideo(file: File): Promise<File> {
  try {
    const mb = await import("mediabunny");
    const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("no video track");
    const seconds = await input.computeDuration().catch(() => null);
    const target = poseVideoTarget({ width: track.displayWidth, height: track.displayHeight, seconds });
    const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target: new mb.BufferTarget() });
    const conversion = await mb.Conversion.init({
      input,
      output,
      showWarnings: false,
      trim: { start: 0, end: target.end },
      video: { width: target.width, height: target.height, fit: "fill", frameRate: target.frameRate, bitrate: 1_500_000, forceTranscode: true },
      audio: { discard: true },
    });
    if (!conversion.isValid) throw new Error("conversion invalid");
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer || !buffer.byteLength) throw new Error("empty");
    const name = `${file.name.replace(/\.[a-z0-9]+$/i, "") || "mouvement"}.mp4`;
    return new File([buffer], name, { type: "video/mp4" });
  } catch {
    // Older browser without an encoder: a light clip still goes as it is.
    if (!uploadTooHeavy(file.size)) return file;
    throw new Error(POSE_VIDEO_FAILED);
  }
}

/** A phone photo above the upload ceiling is re-encoded (2048 px, JPEG) instead of being refused. */
export async function fitImageForUpload(file: File): Promise<File> {
  if (!uploadTooHeavy(file.size) || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob || uploadTooHeavy(blob.size)) return file;
    return new File([blob], `${file.name.replace(/\.[a-z0-9]+$/i, "") || "photo"}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
