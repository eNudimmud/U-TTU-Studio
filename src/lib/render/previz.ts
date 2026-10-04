// A blocking previz the studio can hold, and the cloud graph that turns it
// into one still. Blender does not run here: there is no Blender node on
// Comfy Cloud, and the page does not paint a frame. The file is a real GLB.
// Load 3D (Advanced) only hands that file through. Get 3D Components merges
// it into a mesh. Render Mesh ray-casts the still. Save Image is the output
// La prise can load. Nothing in this module calls the cloud.

import type { ApiGraph } from "./take-graph.ts";

export const PREVIZ_PLANS = ["piece", "quai", "rue"] as const;
export type PrevizPlan = (typeof PREVIZ_PLANS)[number];

export const PREVIZ_LABELS: Record<PrevizPlan, string> = {
  piece: "Pièce",
  quai: "Quai",
  rue: "Rue",
};

export const PREVIZ_WIDTH = 768;
export const PREVIZ_HEIGHT = 1024;

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

const UNIT = [
  -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
  -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
];
const FACES = [
  0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1,
  3, 2, 6, 3, 6, 7, 0, 3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2,
];

export function previzBoxes(plan: PrevizPlan): number {
  return BOXES[plan].length;
}

/** Triangles Render Mesh will see once the nodes are merged. */
export function previzFaces(plan: PrevizPlan): number {
  return BOXES[plan].length * (FACES.length / 3);
}

/** A glTF 2 binary: one unit box, one node per volume, transforms on the nodes. */
export function buildPrevizGlb(plan: PrevizPlan): Uint8Array {
  const positions = new Float32Array(UNIT);
  const indices = new Uint16Array(FACES);
  const bin = new Uint8Array(positions.byteLength + indices.byteLength);
  bin.set(new Uint8Array(positions.buffer), 0);
  bin.set(new Uint8Array(indices.buffer), positions.byteLength);
  const boxes = BOXES[plan];
  const json = {
    asset: { version: "2.0", generator: "U-TTU" },
    scene: 0,
    scenes: [{ nodes: boxes.map((_, index) => index) }],
    nodes: boxes.map(box => ({ mesh: 0, translation: box.translation, scale: box.scale })),
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: "VEC3", min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      { bufferView: 1, componentType: 5123, count: FACES.length, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength, target: 34963 },
    ],
    buffers: [{ byteLength: bin.byteLength }],
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const total = 12 + 8 + jsonBytes.length + jsonPad + 8 + bin.length + binPad;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  let offset = 12;
  view.setUint32(offset, jsonBytes.length + jsonPad, true);
  view.setUint32(offset + 4, 0x4e4f534a, true);
  out.set(jsonBytes, offset + 8);
  out.fill(0x20, offset + 8 + jsonBytes.length, offset + 8 + jsonBytes.length + jsonPad);
  offset += 8 + jsonBytes.length + jsonPad;
  view.setUint32(offset, bin.length + binPad, true);
  view.setUint32(offset + 4, 0x004e4942, true);
  out.set(bin, offset + 8);
  return out;
}

/** JSON chunk of a GLB this studio wrote, for tests. Returns null when the file is not a GLB. */
export function readPrevizJson(bytes: Uint8Array): { nodes: number } | null {
  if (bytes.byteLength < 20) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) return null;
  const length = view.getUint32(12, true);
  const json = new TextDecoder().decode(bytes.subarray(20, 20 + length)).trim();
  const parsed = JSON.parse(json) as { nodes?: unknown[] };
  return { nodes: parsed.nodes?.length ?? 0 };
}

export function previzGate(credits: number | null): { allowed: boolean; tone: "ok" | "warn" | "block"; line: string } {
  if (credits === null) return { allowed: false, tone: "block", line: "Solde illisible. Rien ne part sans lire le compte qui paiera." };
  if (credits <= 0) return { allowed: false, tone: "block", line: "Solde vide sur ton compte de rendu." };
  return { allowed: true, tone: "warn", line: "Le montant n’est pas connu d’avance. Le calcul sera débité, puis lu sur ton compte." };
}

/** Headless graph. The viewport is empty on purpose: this node only passes the file. */
export function previzGraph(modelFile: string): ApiGraph {
  const file = modelFile.trim();
  if (!file || file === "none") throw new Error("Le fichier de préviz manque.");
  return {
    load: {
      class_type: "Load3DAdvanced",
      inputs: { model_file: file, viewport_state: {}, width: PREVIZ_WIDTH, height: PREVIZ_HEIGHT },
    },
    parts: { class_type: "Get3DComponents", inputs: { model_3d: ["load", 0] } },
    camera: {
      class_type: "CreateCameraInfo",
      inputs: {
        mode: "orbit",
        "mode.yaw": 35,
        "mode.pitch": 22,
        "mode.distance": 8,
        target_x: 0,
        target_y: 1,
        target_z: 0,
        roll: 0,
        fov: 35,
        zoom: 1,
        camera_type: "perspective",
      },
    },
    view: {
      class_type: "RenderMesh",
      inputs: {
        mesh: ["parts", 0],
        mode: "solid",
        width: PREVIZ_WIDTH,
        height: PREVIZ_HEIGHT,
        background: "#141210",
        camera_info: ["camera", 0],
      },
    },
    save: { class_type: "SaveImage", inputs: { images: ["view", 0], filename_prefix: "uttu/previz" } },
  };
}
