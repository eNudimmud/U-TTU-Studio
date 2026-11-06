// Distance and angle the visitor named, in the four studio languages.
// The move itself stays in camera-words.ts. This only reads how far.

export const TRAVEL_MIN_M = 1;
export const TRAVEL_MAX_M = 20;
export const TURN_MIN_DEG = 1;
export const TURN_MAX_DEG = 180;

export interface CameraTravel {
  meters: number | null;
  degrees: number | null;
  /** True when the written number was cut to the range the studio can show. */
  clamped: boolean;
}

function clamp(value: number, min: number, max: number): { value: number; clamped: boolean } {
  if (value < min) return { value: min, clamped: true };
  if (value > max) return { value: max, clamped: true };
  return { value, clamped: false };
}

/** « travelling arrière de 5 m », « dolly out 5 meters », « orbit 90 degrees ». Null fields when unnamed. */
export function cameraTravel(text: string): CameraTravel {
  const source = text || "";
  const metres = /(?:de|of|um|von)?\s*(\d{1,3}(?:[.,]\d)?)\s*(?:m\b|mètres?|meters?|metros?)/i.exec(source);
  const degrees = /(\d{1,3})\s*(?:°|deg(?:rees)?|grad(?:os)?)/i.exec(source);
  let clamped = false;
  let meters: number | null = null;
  let turn: number | null = null;
  if (metres) {
    const raw = Number(metres[1].replace(",", "."));
    if (Number.isFinite(raw)) {
      const next = clamp(raw, TRAVEL_MIN_M, TRAVEL_MAX_M);
      meters = next.value;
      clamped = next.clamped;
    }
  }
  if (degrees) {
    const raw = Number(degrees[1]);
    if (Number.isFinite(raw)) {
      const next = clamp(raw, TURN_MIN_DEG, TURN_MAX_DEG);
      turn = next.value;
      clamped = clamped || next.clamped;
    }
  }
  return { meters, degrees: turn, clamped };
}
