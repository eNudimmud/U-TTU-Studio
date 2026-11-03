// A finished render that is one flat colour (all black, all white, fully transparent) is not a
// result: the engine produced nothing usable. It is detected on a small copy of the picture and
// reported as an explicit error, never shown or filed as the visitor's image.

const SIDE = 64;

/** Luma of each RGBA pixel (transparent pixels count as black). */
function luma(data: ArrayLike<number>, at: number): number {
  const alpha = data[at + 3] / 255;
  return (0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2]) * alpha;
}

/**
 * True when the RGBA pixels carry no picture: nearly every pixel is black, or the whole frame
 * is a single flat tone. A dark night scene still has texture and passes.
 */
export function pixelsVides(data: ArrayLike<number>): boolean {
  const count = Math.floor(data.length / 4);
  if (!count) return true;
  let black = 0;
  let low = 255;
  let high = 0;
  for (let index = 0; index < count; index++) {
    const value = luma(data, index * 4);
    if (value <= 3) black++;
    if (value < low) low = value;
    if (value > high) high = value;
  }
  return black / count >= 0.998 || high - low <= 2;
}

/** Decodes the image in the browser and checks it. Unknown (no decoder, unreadable) is not blank. */
export async function imageVide(blob: Blob): Promise<boolean> {
  if (typeof createImageBitmap !== "function") return false;
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(SIDE, SIDE) : Object.assign(document.createElement("canvas"), { width: SIDE, height: SIDE });
    const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) return false;
    context.drawImage(bitmap, 0, 0, SIDE, SIDE);
    bitmap.close();
    return pixelsVides(context.getImageData(0, 0, SIDE, SIDE).data);
  } catch {
    return false;
  }
}
