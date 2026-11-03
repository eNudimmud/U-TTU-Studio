/**
 * Defensive validation for still images returned by Comfy Cloud.
 * This is deliberately independent of billing: a completed GPU job can still
 * be billed by Comfy even when the Studio rejects its output.
 */
export type StillValidation = { ok: true; width: number; height: number } | { ok: false; reason: string };

function signature(bytes: Uint8Array): "png" | "jpeg" | "webp" | null {
  if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return "png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

/**
 * Checks magic bytes, browser decoding and sampled visual content.
 * A nearly white picture is suspicious only when almost all sampled pixels
 * are white and a narrow strip contains virtually all visible detail.
 * Canvas-unavailable environments fail closed (no unverified persistence).
 */
export async function validateStill(blob: Blob): Promise<StillValidation> {
  if (blob.size < 1024) return { ok: false, reason: "Fichier image vide ou trop petit." };
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (!signature(bytes)) return { ok: false, reason: "Le fichier Comfy n'est pas une image PNG, JPEG ou WebP." };
  if (typeof createImageBitmap !== "function") return { ok: false, reason: "Décodage de l'image indisponible." };
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(blob); }
  catch { return { ok: false, reason: "Image Comfy illisible ou corrompue." }; }
  try {
    const { width, height } = bitmap;
    if (width < 64 || height < 64 || width > 16384 || height > 16384) return { ok: false, reason: "Dimensions d'image invalides." };
    const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(64, 64) : null;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { ok: false, reason: "Analyse de l'image indisponible." };
    ctx.drawImage(bitmap, 0, 0, 64, 64);
    const pixels = ctx.getImageData(0, 0, 64, 64).data;
    let white = 0, nonwhite = 0;
    const columns = new Uint16Array(64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      if (r > 248 && g > 248 && b > 248) white++;
      else { nonwhite++; columns[x]++; }
    }
    // A narrow vertical artifact on an otherwise blank white image.
    const concentration = [...columns].sort((a, b) => b - a).slice(0, 6).reduce((a, b) => a + b, 0);
    if (white / 4096 > 0.93 && nonwhite > 0 && concentration / nonwhite > 0.88)
      return { ok: false, reason: "Image quasi blanche avec artefact vertical détecté." };
    return { ok: true, width, height };
  } finally { bitmap.close(); }
}
