// Plans, the camera path, and the volumes of a place. The .blend bytes live in
// place-blend.ts and load only when a path is filmed. This module does not
// run Blender and it does not paint a frame.

export const PREVIZ_PLANS = ["piece", "quai", "rue"] as const;
export type PrevizPlan = (typeof PREVIZ_PLANS)[number];

export const PREVIZ_LABELS: Record<PrevizPlan, string> = {
  piece: "Pièce",
  quai: "Quai",
  rue: "Rue",
};

export const PREVIZ_WIDTH = 768;
export const PREVIZ_HEIGHT = 1024;

export const LENSES = [24, 35, 50, 85] as const;
export type Lens = (typeof LENSES)[number];

/** How many Cycles frames the camera path renders. Frame 1 is the start, the last frame is the end. */
export const PATH_FRAMES = 5;

export type PathPoint = "start" | "end";

/** Camera path in the studio's Y-up space. Reopening the place restores both ends and the lens. */
export interface PlaceCamera {
  x: number;
  y: number;
  z: number;
  aimX: number;
  aimY: number;
  aimZ: number;
  endX: number;
  endY: number;
  endZ: number;
  endAimX: number;
  endAimY: number;
  endAimZ: number;
  lens: Lens;
}

type Vec3 = [number, number, number];
type Box = { translation: Vec3; scale: Vec3 };

const BOXES: Record<PrevizPlan, readonly Box[]> = {
  piece: [
    { translation: [0, 0.05, 0], scale: [6, 0.1, 6] },
    { translation: [0, 1.5, -3], scale: [6, 3, 0.12] },
    { translation: [-3, 1.5, 0], scale: [0.12, 3, 6] },
    { translation: [3, 1.5, 0], scale: [0.12, 3, 6] },
    { translation: [0, 0.9, 0.4], scale: [0.4, 1.7, 0.28] },
  ],
  quai: [
    { translation: [0, 0.1, 0], scale: [8, 0.2, 2.4] },
    { translation: [0, -0.35, -2.2], scale: [8, 0.08, 3.2] },
    { translation: [2, 0.45, 0.2], scale: [0.8, 0.5, 0.6] },
    { translation: [-1.2, 1, 0], scale: [0.35, 1.7, 0.28] },
  ],
  rue: [
    { translation: [0, 0.05, 0], scale: [5, 0.1, 10] },
    { translation: [-2.2, 2, -1], scale: [1.6, 4, 3] },
    { translation: [2.2, 1.4, 1], scale: [1.8, 2.8, 2.4] },
    { translation: [0, 0.9, 2], scale: [0.4, 1.7, 0.28] },
  ],
};

const VOLUME_COUNT = 5;

/** Y-up studio axes become Blender Z-up: (x, y, z) → (x, z, y). */
export function toBlender([x, y, z]: Vec3): Vec3 {
  return [x, z, y];
}

const round = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number) => Math.min(12, Math.max(-12, round(value)));

export function defaultCamera(plan: PrevizPlan): PlaceCamera {
  if (plan === "quai") {
    return {
      x: 0, y: 1.55, z: 3.6, aimX: 0, aimY: 0.85, aimZ: -0.4,
      endX: -1.2, endY: 1.55, endZ: 2.8, endAimX: 0, endAimY: 0.85, endAimZ: -0.8,
      lens: 35,
    };
  }
  if (plan === "rue") {
    return {
      x: 0.2, y: 1.7, z: 6.4, aimX: 0, aimY: 1.2, aimZ: 0.6,
      endX: 0.2, endY: 1.7, endZ: 4.4, endAimX: 0, endAimY: 1.2, endAimZ: 0,
      lens: 24,
    };
  }
  return {
    x: 0, y: 1.6, z: 4.8, aimX: 0, aimY: 1.15, aimZ: 0,
    endX: 1.2, endY: 1.6, endZ: 3.6, endAimX: 0.2, endAimY: 1.15, endAimZ: 0,
    lens: 35,
  };
}

export function isLens(value: number): value is Lens {
  return (LENSES as readonly number[]).includes(value);
}

export function pathPoint(camera: PlaceCamera, point: PathPoint): { x: number; y: number; z: number; aimX: number; aimY: number; aimZ: number } {
  if (point === "end") return { x: camera.endX, y: camera.endY, z: camera.endZ, aimX: camera.endAimX, aimY: camera.endAimY, aimZ: camera.endAimZ };
  return { x: camera.x, y: camera.y, z: camera.z, aimX: camera.aimX, aimY: camera.aimY, aimZ: camera.aimZ };
}

export function moveCamera(camera: PlaceCamera, point: PathPoint, target: "stand" | "aim", axis: "x" | "y" | "z", direction: -1 | 1): PlaceCamera {
  const stand = point === "end"
    ? (axis === "x" ? "endX" : axis === "y" ? "endY" : "endZ")
    : axis;
  const aim = point === "end"
    ? (axis === "x" ? "endAimX" : axis === "y" ? "endAimY" : "endAimZ")
    : (`aim${axis.toUpperCase()}` as "aimX" | "aimY" | "aimZ");
  const key = target === "stand" ? stand : aim;
  return { ...camera, [key]: clamp(camera[key] + direction * 0.4) };
}

export function placeVolumes(plan: PrevizPlan): number {
  return BOXES[plan].length;
}

export interface BlenderPose {
  volumes: { location: Vec3; scale: Vec3 }[];
  camera: { location: Vec3; quaternion: [number, number, number, number]; lens: number };
}

export interface BlenderPath {
  volumes: BlenderPose["volumes"];
  start: BlenderPose["camera"];
  end: BlenderPose["camera"];
}

function poseAt(x: number, y: number, z: number, aimX: number, aimY: number, aimZ: number, lens: number): BlenderPose["camera"] {
  const location = toBlender([x, y, z]);
  const aim = toBlender([aimX, aimY, aimZ]);
  return { location, quaternion: lookQuaternion(location, aim), lens };
}

/** Volumes, plus the camera at the first frame and at the last. Blender interpolates the frames between. */
export function blenderPath(plan: PrevizPlan, camera: PlaceCamera): BlenderPath {
  const boxes = BOXES[plan];
  const volumes = Array.from({ length: VOLUME_COUNT }, (_, index) => {
    const box = boxes[index];
    if (!box) return { location: [0, 0, -4] as Vec3, scale: [0.001, 0.001, 0.001] as Vec3 };
    return { location: toBlender(box.translation), scale: toBlender(box.scale) };
  });
  return {
    volumes,
    start: poseAt(camera.x, camera.y, camera.z, camera.aimX, camera.aimY, camera.aimZ, camera.lens),
    end: poseAt(camera.endX, camera.endY, camera.endZ, camera.endAimX, camera.endAimY, camera.endAimZ, camera.lens),
  };
}

/** Frame 1 of the path: volumes and the camera where the movement starts. */
export function blenderPose(plan: PrevizPlan, camera: PlaceCamera): BlenderPose {
  const path = blenderPath(plan, camera);
  return { volumes: path.volumes, camera: path.start };
}

/** Blender camera looks down its local −Z. Quaternion order is (w, x, y, z). */
export function lookQuaternion(position: Vec3, aim: Vec3): [number, number, number, number] {
  const dx = aim[0] - position[0];
  const dy = aim[1] - position[1];
  const dz = aim[2] - position[2];
  const length = Math.hypot(dx, dy, dz) || 1;
  const zx = -dx / length;
  const zy = -dy / length;
  const zz = -dz / length;
  let xx = -zy;
  let xy = zx;
  let xz = 0;
  let span = Math.hypot(xx, xy, xz);
  if (span < 1e-6) {
    xx = 1;
    xy = 0;
    xz = 0;
    span = 1;
  }
  xx /= span;
  xy /= span;
  xz /= span;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return quaternionFromBasis(xx, yx, zx, xy, yy, zy, xz, yz, zz);
}

function quaternionFromBasis(
  m00: number, m10: number, m20: number,
  m01: number, m11: number, m21: number,
  m02: number, m12: number, m22: number,
): [number, number, number, number] {
  const trace = m00 + m11 + m22;
  let w: number;
  let x: number;
  let y: number;
  let z: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = 0.25 * s;
    x = (m21 - m12) / s;
    y = (m02 - m20) / s;
    z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }
  const norm = Math.hypot(w, x, y, z) || 1;
  return [w / norm, x / norm, y / norm, z / norm];
}

