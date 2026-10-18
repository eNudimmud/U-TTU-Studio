// The four looks and the three framings. Defaults mean a novice never opens « Réglages ».

export type Look = "carte" | "volumes" | "trait" | "ombres";
export const LOOKS: readonly Look[] = ["carte", "volumes", "trait", "ombres"];

export type Framing = "large" | "moyen" | "contre";
export const FRAMINGS: readonly Framing[] = ["large", "moyen", "contre"];

export interface Settings {
  look: Look;
  fov: number;
  line: number;
  tone: number;
}

export const DEFAULT_SETTINGS: Settings = { look: "trait", fov: 45, line: 1, tone: .4 };

export interface FramingPose {
  /** Metres from the target. */
  distance: number;
  /** Degrees above the horizon, seen from the target. */
  elevation: number;
  /** Camera at eye height looking up when true. */
  street: boolean;
  /** For street poses: degrees the camera looks up. */
  lookUp: number;
  fov: number;
}

export const FRAMING_POSES: Record<Framing, FramingPose> = {
  large: { distance: 520, elevation: 38, street: false, lookUp: 0, fov: 45 },
  moyen: { distance: 170, elevation: 22, street: false, lookUp: 0, fov: 45 },
  contre: { distance: 0, elevation: 0, street: true, lookUp: 24, fov: 62 },
};

export const LIMITS = {
  fov: { min: 15, max: 90 },
  line: { min: 0, max: 3 },
  tone: { min: 0, max: 1 },
  azimuth: { min: 0, max: 359 },
  altitude: { min: 5, max: 85 },
} as const;

export function clampSetting(key: keyof typeof LIMITS, value: number): number {
  const { min, max } = LIMITS[key];
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** Radius of OSM data to load around a place. Phones get less. */
export function loadRadius(mobile: boolean): number {
  return mobile ? 650 : 900;
}

export function pixelRatioCap(mobile: boolean, devicePixelRatio: number): number {
  return Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
}
