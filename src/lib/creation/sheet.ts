/**
 * Design sheets (several panels on one board) are read as the place to paint: Klein and Qwen paste
 * their frames and seams into the scene (JD 31.10.2026, panels of a ship board pasted on its deck).
 * A board is told apart by its seams: straight lines where the picture jumps sharply on one pixel
 * line and not on its neighbours. Measured on JD's refs at 700 px: boards 0.35–0.52 of a line,
 * photos and renders ≤ 0.17. A bubble drops a board when its reference also has a clean picture.
 * Generic: no name, only pixels. A picture that cannot be read is kept.
 */
/** Side the picture is shrunk to before looking for seams (the side the threshold was measured at). */
export const SHEET_SCAN_SIDE = 700;
/** A seam crosses at least this share of the picture. */
const SEAM = 0.25;

/** Share of each line (row when `rows`, else column) that is a sharp one-pixel jump. */
export function seamProfile(gray: ArrayLike<number>, w: number, h: number, rows: boolean): number[] {
  const lines = rows ? h : w, along = rows ? w : h;
  const at = (line: number, i: number) => rows ? gray[line * w + i] : gray[i * w + line];
  const out: number[] = new Array(lines).fill(0);
  for (let l = 2; l < lines - 1; l++) {
    let hits = 0;
    for (let i = 0; i < along; i++) {
      const d = Math.abs(at(l, i) - at(l - 1, i));
      const before = Math.abs(at(l - 1, i) - at(l - 2, i)), after = Math.abs(at(l + 1, i) - at(l, i));
      if (d > 10 && d > 1.8 * Math.max(before, after)) hits++;
    }
    out[l] = hits / along;
  }
  return out;
}

/** Distinct seams (lines closer than 4 px count once), away from the outer 3 %. */
function seams(profile: readonly number[]): number[] {
  const n = profile.length, edge = Math.ceil(n * 0.03);
  const found: number[] = [];
  for (let i = edge; i < n - edge; i++) if (profile[i] >= SEAM && !found.some(f => Math.abs(f - i) < 4)) found.push(i);
  return found;
}

/** Two seams or more, across or down: a board of panels, not one picture. */
export function isSheet(gray: ArrayLike<number>, w: number, h: number): boolean {
  if (w < 64 || h < 64) return false;
  return seams(seamProfile(gray, w, h, true)).length + seams(seamProfile(gray, w, h, false)).length >= 2;
}

export interface SheetSlot { ref: number; picture: string }
/** The slots kept: a board goes when its reference keeps a clean picture, else it stays as it was. */
export function withoutSheets<S extends SheetSlot>(slots: readonly S[], sheet: readonly boolean[]): S[] {
  const clean = new Set(slots.filter((s, i) => !sheet[i]).map(s => s.ref));
  return slots.filter((s, i) => !sheet[i] || !clean.has(s.ref));
}

/** Browser only: reads a picture and says whether it is a board. False when it cannot be read. */
export async function pictureIsSheet(file: Blob): Promise<boolean> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return false;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, SHEET_SCAN_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) { bitmap.close(); return false; }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const rgba = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < gray.length; i++) gray[i] = (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000;
    return isSheet(gray, w, h);
  } catch {
    return false;
  }
}
