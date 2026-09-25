import { createZip, type ZipEntry } from "../zip.ts";
import { colorStats, dhash, sharpness, toGray } from "./pixels.ts";
import { buildManifest, buildReadme, buildReport, captionsBlock, slot } from "./report.ts";
import type { GateInput, GateResult } from "./rules.ts";

const ANALYSIS_SIDE = 512;
const EXPORT_SIDE = 1536;
const EXPORT_QUALITY = 0.92;

export interface ImageMetrics {
  readable: boolean;
  width: number;
  height: number;
  sharpness: number;
  hash: string;
  mirrorHash: string;
  luma: number;
  saturation: number;
}

function drawScaled(bitmap: ImageBitmap, maxSide: number, background?: string) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D indisponible");
  context.imageSmoothingQuality = "high";
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

export async function analyzeImage(file: File): Promise<ImageMetrics> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const { canvas, context } = drawScaled(bitmap, ANALYSIS_SIDE);
    bitmap.close();
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const gray = toGray(data, canvas.width, canvas.height);
    const { hash, mirror } = dhash(gray, canvas.width, canvas.height);
    return { readable: true, width, height, sharpness: sharpness(gray, canvas.width, canvas.height), hash, mirrorHash: mirror, ...colorStats(data) };
  } catch {
    return { readable: false, width: 0, height: 0, sharpness: 0, hash: "", mirrorHash: "", luma: 0, saturation: 0 };
  }
}

// Re-encoding strips EXIF (GPS included) and caps uploads to Comfy at a sane size.
async function toJpeg(file: File): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  const { canvas } = drawScaled(bitmap, EXPORT_SIDE, "#ffffff");
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", EXPORT_QUALITY));
  if (!blob) throw new Error(`Export JPEG impossible pour ${file.name}`);
  return new Uint8Array(await blob.arrayBuffer());
}

type Progress = (done: number, total: number) => void;

async function trainingEntries(result: GateResult, files: Map<string, File>, onProgress?: Progress): Promise<ZipEntry[]> {
  if (result.verdict !== "PASS") throw new Error("Le gate n’est pas en PASS : export bloqué.");
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < result.kept.length; i++) {
    const file = files.get(result.kept[i].id);
    if (!file) throw new Error(`Fichier introuvable : ${result.kept[i].name}`);
    entries.push({ name: `${slot(i)}.jpg`, data: await toJpeg(file) });
    entries.push({ name: `${slot(i)}.txt`, data: encoder.encode(`${result.captions[i]}\n`) });
    onProgress?.(i + 1, result.kept.length);
  }
  return entries;
}

const zipBlob = (entries: ZipEntry[], date?: Date) => new Blob([createZip(entries, date).buffer as ArrayBuffer], { type: "application/zip" });

export async function buildDatasetZip(input: GateInput, result: GateResult, files: Map<string, File>, steps: number, images: number, onProgress?: Progress): Promise<Blob> {
  const encoder = new TextEncoder();
  const generatedAt = new Date();
  const entries = await trainingEntries(result, files, onProgress);
  entries.push(
    { name: "captions_comfy.txt", data: encoder.encode(captionsBlock(result.captions)) },
    { name: "RAPPORT_GATE.txt", data: encoder.encode(buildReport(input, result, generatedAt)) },
    { name: "gate.json", data: encoder.encode(`${JSON.stringify(buildManifest(input, result, generatedAt), null, 2)}\n`) },
    { name: "LISEZMOI.txt", data: encoder.encode(buildReadme(steps, images)) },
  );
  return zipBlob(entries, generatedAt);
}

// Leaves the device for fal: the same images and captions as the gate ZIP, without the report, gate.json or source file names.
export async function buildFalZip(result: GateResult, files: Map<string, File>, onProgress?: Progress): Promise<Blob> {
  return zipBlob(await trainingEntries(result, files, onProgress));
}
