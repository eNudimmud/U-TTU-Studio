// CE1 · Pixel preparation before the pure selection (CONTRACTS « Références et snapshot »).
// Each picture is read once, hashed, and classified as a clean view or a multi-panel sheet, with a
// cache by SHA-256. A picture that cannot be read is « unreadable », never « clean ». The same
// preparation feeds the quote, the prompt and the graph; a changed hash changes the digest, which
// voids a quote made before it.

import { isSheet, SHEET_SCAN_SIDE } from "../creation/sheet.ts";
import { digestOf } from "./digest.ts";
import type { CinemaDiagnostic, ReferenceBinding } from "./types.ts";

export type PictureKind = "clean" | "sheet" | "unreadable" | "missing";
export interface PreparedPicture { assetId: string; sha256: string | null; kind: PictureKind }

export interface ReferencePreparation {
  pictures: Record<string, PreparedPicture>;
  /** Usable pictures per binding, in the card's order: clean views, else its sheets. */
  usable: Map<string, string[]>;
  diagnostics: CinemaDiagnostic[];
  /** Hashes and kinds of every picture: part of the shot snapshot. */
  digest: string;
}

export interface PreparationPorts {
  /** The picture bytes from the vault. Null: no such file. Throws: could not be read. */
  read(assetId: string): Promise<Blob | null>;
  /** Clean view or sheet. Throws when the pixels cannot be decoded. */
  classify(blob: Blob): Promise<"clean" | "sheet">;
}

/** Kinds by picture hash: the same bytes are classified once per session. */
export type PreparationCache = Map<string, "clean" | "sheet">;

async function sha256(blob: Blob): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function preparePicture(assetId: string, ports: PreparationPorts, cache: PreparationCache): Promise<PreparedPicture> {
  let blob: Blob | null;
  try { blob = await ports.read(assetId); } catch { return { assetId, sha256: null, kind: "unreadable" }; }
  if (!blob) return { assetId, sha256: null, kind: "missing" };
  const hash = await sha256(blob);
  const known = cache.get(hash);
  if (known) return { assetId, sha256: hash, kind: known };
  try {
    const kind = await ports.classify(blob);
    cache.set(hash, kind);
    return { assetId, sha256: hash, kind };
  } catch {
    return { assetId, sha256: hash, kind: "unreadable" };
  }
}

export async function prepareReferences(bindings: readonly ReferenceBinding[], ports: PreparationPorts, cache: PreparationCache = new Map()): Promise<ReferencePreparation> {
  const pictures: Record<string, PreparedPicture> = {};
  for (const binding of bindings) {
    for (const image of binding.images) {
      if (!pictures[image.assetId]) pictures[image.assetId] = await preparePicture(image.assetId, ports, cache);
    }
  }
  const diagnostics: CinemaDiagnostic[] = [];
  const usable = new Map<string, string[]>();
  for (const binding of bindings) {
    const prepared = binding.images.map(image => pictures[image.assetId]!);
    for (const [index, picture] of prepared.entries()) {
      if (picture.kind === "unreadable") diagnostics.push({ code: "IMAGE_UNREADABLE", bindingId: binding.bindingId, detail: picture.assetId });
      if (picture.kind === "missing") diagnostics.push({ code: "IMAGE_MISSING", bindingId: binding.bindingId, detail: picture.assetId });
      const declared = binding.images[index]!.sha256;
      if (picture.sha256 && declared && declared !== picture.sha256) diagnostics.push({ code: "IMAGE_CHANGED", bindingId: binding.bindingId, detail: picture.assetId });
    }
    const clean = prepared.filter(picture => picture.kind === "clean").map(picture => picture.assetId);
    const sheets = prepared.filter(picture => picture.kind === "sheet").map(picture => picture.assetId);
    if (!clean.length && sheets.length) diagnostics.push({ code: "SHEET_ONLY", bindingId: binding.bindingId, detail: "no clean view: the sheet is sent" });
    const list = clean.length ? clean : sheets;
    if (!list.length) diagnostics.push({ code: "REFERENCE_MISSING", bindingId: binding.bindingId, detail: "no picture could be read" });
    usable.set(binding.bindingId, list);
  }
  const digest = await digestOf(Object.values(pictures).sort((a, b) => a.assetId.localeCompare(b.assetId)));
  return { pictures, usable, diagnostics, digest };
}

/** Bindings with the hashes actually read (an unread picture keeps its declared hash). */
export function withPreparedHashes(bindings: readonly ReferenceBinding[], preparation: ReferencePreparation): ReferenceBinding[] {
  return bindings.map(binding => ({ ...binding, images: binding.images.map(image => ({ assetId: image.assetId, sha256: preparation.pictures[image.assetId]?.sha256 ?? image.sha256 })) }));
}

/**
 * Browser port: decodes the picture and looks for panel seams (sheet.ts). Unlike `pictureIsSheet`,
 * a decode failure throws, so the picture is reported unreadable instead of passing as clean.
 */
export async function classifyPicture(file: Blob): Promise<"clean" | "sheet"> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") throw new Error("no decoder");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, SHEET_SCAN_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) { bitmap.close(); throw new Error("no canvas"); }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000;
  return isSheet(gray, w, h) ? "sheet" : "clean";
}
