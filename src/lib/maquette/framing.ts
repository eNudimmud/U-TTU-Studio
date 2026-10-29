/** A kept framing is an immutable project asset, separate from visual references. */
export interface Framing {
  version: 1;
  source: "3d" | "2d";
  color: string;
  depth: string;
  edges: string;
  width: number;
  height: number;
  camera?: { fov: number; near: number; far: number; world: number[]; projection: number[] };
}

export interface FramingCapture {
  source: Framing["source"];
  color: Blob;
  depth: Blob;
  edges: Blob;
  width: number;
  height: number;
  camera?: Framing["camera"];
}

export type CaptureFraming = (width: number, height: number) => Promise<FramingCapture>;

/** Same PNG dimensions in the preview and both control maps. */
export function framingSize(format: "16:9" | "9:16") {
  return format === "9:16" ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
}

export function readFraming(value: unknown): Framing | undefined {
  if (!value || typeof value !== "object") return;
  const f = value as Partial<Framing>;
  const path = /^Projets\/[a-z0-9-]+\/Assets\/[a-z0-9-]+\.png$/;
  if (f.version !== 1 || (f.source !== "3d" && f.source !== "2d") ||
    ![f.color, f.depth, f.edges].every(p => typeof p === "string" && path.test(p)) ||
    !((f.width === 1280 && f.height === 720) || (f.width === 720 && f.height === 1280))) return;
  if (new Set([f.color, f.depth, f.edges]).size !== 3) return;
  const c = f.camera;
  if (c && (!Number.isFinite(c.fov) || !Number.isFinite(c.near) || !Number.isFinite(c.far) || !Array.isArray(c.world) || !Array.isArray(c.projection) || c.world.length !== 16 || c.projection.length !== 16 || ![...c.world, ...c.projection].every(Number.isFinite))) return;
  return { version: 1, source: f.source, color: f.color!, depth: f.depth!, edges: f.edges!, width: f.width!, height: f.height!, ...(c ? { camera: c } : {}) };
}

/** Sobel contours, white on black. Works on colour captures and native linear depth. */
export function framingEdges(rgba: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  if (rgba.length !== width * height * 4) throw new Error("Image de cadrage incomplète.");
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = .299 * rgba[i * 4] + .587 * rgba[i * 4 + 1] + .114 * rgba[i * 4 + 2];
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 3; i < out.length; i += 4) out[i] = 255;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    const gx = -gray[i - width - 1] + gray[i - width + 1] - 2 * gray[i - 1] + 2 * gray[i + 1] - gray[i + width - 1] + gray[i + width + 1];
    const gy = -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] + gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
    const edge = Math.hypot(gx, gy) > 15 ? 255 : 0;
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = edge;
  }
  return out;
}

export function png(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Export du cadrage impossible.")), "image/png"));
}

export function contourCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const source = canvas.getContext("2d");
  if (!source) throw new Error("Export du cadrage impossible.");
  const out = document.createElement("canvas");
  out.width = canvas.width; out.height = canvas.height;
  const context = out.getContext("2d")!;
  const pixels = context.createImageData(out.width, out.height);
  pixels.data.set(framingEdges(source.getImageData(0, 0, out.width, out.height).data, out.width, out.height));
  context.putImageData(pixels, 0, 0);
  return out;
}
