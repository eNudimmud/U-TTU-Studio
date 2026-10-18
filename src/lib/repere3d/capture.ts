// What a « Capturer ce cadrage » keeps: three images and one small JSON card.
// The JSON is the camera, the sun, the style and the credits. Pure, testable.

import { attributionFull, attributionLine, type SourceId } from "./sources.ts";
import type { Sun, SunPreset } from "./sun.ts";
import type { Look } from "./styles.ts";

export const CAPTURE_W = 1536;
export const CAPTURE_H = 864;

export interface CaptureCamera {
  lat: number;
  lon: number;
  /** Degrees from north, clockwise. */
  heading: number;
  /** Degrees, 0 horizontal, negative looks down. */
  pitch: number;
  /** Vertical field of view in degrees. */
  fov: number;
  /** Metres above the ground under the camera. */
  height: number;
  /** Equivalent full-frame focal length in mm, for people who speak lenses. */
  focal: number;
}

export interface CaptureMeta {
  version: 1;
  kind: "reperage-3d";
  place: { name: string; lat: number; lon: number };
  camera: CaptureCamera;
  sun: Sun & { preset: SunPreset | "manuel" };
  look: Look;
  size: { width: number; height: number };
  depth: { near: number; far: number; encoding: "linéaire, proche = blanc" };
  files: { color: string; depth: string; lines: string };
  sources: SourceId[];
  attribution: string;
  credit: string;
  at: string;
}

export interface CaptureInput {
  place: { name: string; lat: number; lon: number };
  camera: Omit<CaptureCamera, "focal">;
  sun: Sun;
  preset: SunPreset | "manuel";
  look: Look;
  near: number;
  far: number;
  sources: Iterable<SourceId>;
  files: { color: string; depth: string; lines: string };
  width?: number;
  height?: number;
  at?: Date;
}

/** Vertical FOV to the focal length of a 36×24 mm frame (24 mm tall). */
export function focalFor(fov: number): number {
  return Math.round(12 / Math.tan(fov * Math.PI / 360));
}

export function fovFor(focal: number): number {
  return round(2 * Math.atan(12 / focal) * 180 / Math.PI, 1);
}

function round(value: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function wrap(deg: number): number {
  return round(((deg % 360) + 360) % 360, 1);
}

export function buildCaptureMeta(input: CaptureInput): CaptureMeta {
  const fov = Math.max(10, Math.min(100, input.camera.fov));
  const sources = [...new Set(input.sources)];
  return {
    version: 1,
    kind: "reperage-3d",
    place: { name: input.place.name.slice(0, 80), lat: round(input.place.lat, 6), lon: round(input.place.lon, 6) },
    camera: {
      lat: round(input.camera.lat, 6),
      lon: round(input.camera.lon, 6),
      heading: wrap(input.camera.heading),
      pitch: round(Math.max(-90, Math.min(90, input.camera.pitch)), 1),
      fov: round(fov, 1),
      height: round(Math.max(0, input.camera.height), 1),
      focal: focalFor(fov),
    },
    sun: { azimuth: wrap(input.sun.azimuth), altitude: round(input.sun.altitude, 1), preset: input.preset },
    look: input.look,
    size: { width: input.width ?? CAPTURE_W, height: input.height ?? CAPTURE_H },
    depth: { near: round(input.near, 1), far: round(input.far, 1), encoding: "linéaire, proche = blanc" },
    files: input.files,
    sources: ["osm", ...sources.filter(id => id !== "osm")],
    attribution: attributionFull(sources),
    credit: attributionLine(sources),
    at: (input.at ?? new Date()).toISOString(),
  };
}

/** File names inside the project's Lieux folder. One stamp ties the four together. */
export function captureFiles(sceneId: string, stamp: string): { color: string; depth: string; lines: string; meta: string } {
  const base = `${sceneId}-3d-${stamp.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "cadrage"}`;
  return { color: `${base}.jpg`, depth: `${base}.depth.png`, lines: `${base}.lines.png`, meta: `${base}.json` };
}

/** One readable line for the vault card. Plain words, no tile URL. */
export function captureNote(meta: CaptureMeta): string {
  const c = meta.camera;
  return `${meta.place.name} (${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}). Repérage 3D, cap ${Math.round(c.heading)}°, inclinaison ${Math.round(c.pitch)}°, focale ${c.focal} mm, caméra à ${Math.round(c.height)} m. Soleil ${Math.round(meta.sun.azimuth)}° / ${Math.round(meta.sun.altitude)}°. ${meta.credit}.`;
}
