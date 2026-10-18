// Two-finger gestures on the 3D view, one meaning at a time.
// Twist turns the view, a vertical two-finger drag tilts it, a pinch zooms. A dead zone picks the
// first gesture that clearly starts, then keeps it until the fingers lift: no rotate-and-tilt mix.

export type TwoMode = "none" | "rotate" | "tilt" | "zoom";

export interface Finger { x: number; y: number }

export interface TwoStart {
  a: Finger;
  b: Finger;
}

/** Dead zone. Below these, nothing moves; the first one crossed wins. */
export const DEAD_ZONE = {
  /** Degrees of twist between the two fingers. */
  twist: 9,
  /** Pixels both fingers travel up or down together. */
  drag: 16,
  /** Relative change of the distance between the fingers. */
  pinch: 0.08,
} as const;

export interface TwoReading {
  /** Degrees, positive counter-clockwise on screen. */
  twist: number;
  /** Pixels, positive when both fingers move down. */
  drag: number;
  /** Distance ratio, above 1 when the fingers spread. */
  pinch: number;
  /** True when both fingers moved the same vertical way. */
  together: boolean;
}

function angle(a: Finger, b: Finger): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}

function wrap(deg: number): number {
  return ((deg + 540) % 360) - 180;
}

export function readTwo(start: TwoStart, a: Finger, b: Finger): TwoReading {
  const d0 = Math.max(1, Math.hypot(start.b.x - start.a.x, start.b.y - start.a.y));
  const d1 = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  const dyA = a.y - start.a.y;
  const dyB = b.y - start.b.y;
  return {
    twist: -wrap(angle(a, b) - angle(start.a, start.b)),
    drag: (dyA + dyB) / 2,
    pinch: d1 / d0,
    together: Math.sign(dyA) === Math.sign(dyB) && Math.min(Math.abs(dyA), Math.abs(dyB)) > DEAD_ZONE.drag * 0.4,
  };
}

/** Which gesture this is, once it leaves the dead zone. `none` while still inside. */
export function classifyTwo(reading: TwoReading): TwoMode {
  const twist = Math.abs(reading.twist) / DEAD_ZONE.twist;
  const drag = reading.together ? Math.abs(reading.drag) / DEAD_ZONE.drag : 0;
  const pinch = Math.abs(Math.log(reading.pinch)) / Math.log(1 + DEAD_ZONE.pinch);
  const best = Math.max(twist, drag, pinch);
  if (best < 1) return "none";
  if (best === drag) return "tilt";
  if (best === twist) return "rotate";
  return "zoom";
}

/**
 * Degrees of tilt for a vertical two-finger drag, a full view height is about 70°.
 * Up (negative pixels) lowers the camera toward the horizon, down raises it toward a plan view.
 */
export function tiltFor(dragPx: number, height: number): number {
  return dragPx / Math.max(200, height) * 70;
}
