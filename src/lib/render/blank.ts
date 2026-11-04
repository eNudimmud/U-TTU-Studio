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
export function pixelsVides(data: ArrayLike<number>, width = SIDE): boolean {
  const count = Math.floor(data.length / 4);
  if (!count) return true;
  let black = 0;
  let low = 255;
  let high = 0;
  let white = 0;
  const columns = new Array(Math.min(width, count)).fill(0);
  const height = Math.ceil(count / columns.length);
  for (let index = 0; index < count; index++) {
    const value = luma(data, index * 4);
    if (value <= 3) black++;
    if (value >= 250) white++;
    else columns[index % columns.length]++;
    if (value < low) low = value;
    if (value > high) high = value;
  }
  // P0 CAST: a clipped white frame with a narrow noisy vertical band. Require almost
  // entirely blank columns; a high-key portrait or ink drawing has distributed detail.
  const blankColumns = columns.filter(nonWhite => nonWhite <= height * 0.02).length;
  const whiteStripe = white / count >= 0.90 && blankColumns / columns.length >= 0.90;
  return black / count >= 0.998 || high - low <= 2 || whiteStripe;
}

/** Fail closed: undecodable bytes and unavailable validation must never become project media. */
export async function imageVide(blob: Blob): Promise<boolean> {
  if (!blob.size) return true;
  let bitmap: ImageBitmap | null = null;
  try {
    if (typeof createImageBitmap !== "function") return true;
    bitmap = await createImageBitmap(blob);
    if (!bitmap.width || !bitmap.height) return true;
    const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(SIDE, SIDE) : Object.assign(document.createElement("canvas"), { width: SIDE, height: SIDE });
    const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) return true;
    context.drawImage(bitmap, 0, 0, SIDE, SIDE);
    return pixelsVides(context.getImageData(0, 0, SIDE, SIDE).data);
  } catch {
    return true;
  } finally {
    bitmap?.close();
  }
}
