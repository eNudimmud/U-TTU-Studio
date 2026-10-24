// The looks and the three view heights. The repérage sheet shows one base look only (Volumes);
// the others stay for the PRISE maquette and old captures.

export type Look = "carte" | "volumes" | "trait" | "ombres";
export const LOOKS: readonly Look[] = ["carte", "volumes", "trait", "ombres"];

/** « De haut », « Mi-hauteur », « Au sol ». */
export type Framing = "large" | "moyen" | "sol";
export const FRAMINGS: readonly Framing[] = ["large", "moyen", "sol"];

export interface Settings {
  look: Look;
  fov: number;
  line: number;
  tone: number;
}

export const DEFAULT_SETTINGS: Settings = { look: "volumes", fov: 45, line: 1, tone: .4 };

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
  /** For street poses: eye height in metres above the ground. */
  eye?: number;
  /** For street poses: metres to step back along the street, so the place sits ahead, not a wall. */
  back?: number;
}

export const FRAMING_POSES: Record<Framing, FramingPose> = {
  large: { distance: 520, elevation: 38, street: false, lookUp: 0, fov: 45 },
  moyen: { distance: 170, elevation: 22, street: false, lookUp: 0, fov: 45 },
  // Au sol: a little above head height, stepped back down the street, looking almost level.
  // At 1.7 m looking 24° up the frame was mostly grey walls.
  sol: { distance: 0, elevation: 0, street: true, lookUp: 5, fov: 62, eye: 4.5, back: 28 },
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
