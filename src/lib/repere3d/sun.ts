// Where the sun stands, from latitude, day of the year and local solar hour. No time zones.
// Accurate to about a degree, enough to place hard shadows on a blockout.

export interface Sun { azimuth: number; altitude: number }

export type SunPreset = "matin" | "midi" | "soir";
export const SUN_PRESETS: readonly SunPreset[] = ["matin", "midi", "soir"];
const HOURS: Record<SunPreset, number> = { matin: 9, midi: 12.5, soir: 17.5 };

export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

/** Azimuth from north, clockwise, in degrees. Altitude above the horizon in degrees. */
export function sunPosition(lat: number, day: number, solarHour: number): Sun {
  const rad = Math.PI / 180;
  const decl = -23.44 * Math.cos(2 * Math.PI / 365 * (day + 10)) * rad;
  const hourAngle = (solarHour - 12) * 15 * rad;
  const phi = lat * rad;
  const sinAlt = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hourAngle);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const cosAz = (Math.sin(decl) - Math.sin(altitude) * Math.sin(phi)) / (Math.cos(altitude) * Math.cos(phi) || 1e-9);
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) / rad;
  if (hourAngle > 0) azimuth = 360 - azimuth;
  return { azimuth: round1(azimuth), altitude: round1(altitude / rad) };
}

/** A preset on today's date, kept above the horizon so the scene never goes black. */
export function sunPreset(preset: SunPreset, lat: number, date = new Date()): Sun {
  const sun = sunPosition(lat, dayOfYear(date), HOURS[preset]);
  return { azimuth: sun.azimuth, altitude: Math.max(8, Math.min(85, sun.altitude)) };
}

/** Unit vector toward the sun in the local frame (x east, y up, z south). */
export function sunVector(sun: Sun): [number, number, number] {
  const rad = Math.PI / 180;
  const alt = sun.altitude * rad;
  const az = sun.azimuth * rad;
  return [Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az)];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
