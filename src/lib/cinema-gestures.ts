// Three cinema gestures as fiches. A gesture is live only when a named Comfy
// Cloud template exists and its schema was read (F16, 7 October 2026).
// This module records that read. It does not estimate, dry-run, or submit.

export const CINEMA_CATALOG = {
  refreshedAt: "2026-10-07T17:15:59.583Z",
  nodeCount: 3772,
  credits: 0,
} as const;

/** `camera_pose` options read from WanCameraEmbedding. Static is not a move. */
export const CAMERA_POSE_OPTIONS = [
  "Static",
  "Pan Up",
  "Pan Down",
  "Pan Left",
  "Pan Right",
  "Zoom In",
  "Zoom Out",
  "Anti Clockwise (ACW)",
  "ClockWise (CW)",
] as const;

export type CameraPose = (typeof CAMERA_POSE_OPTIONS)[number];

export const CAMERA_MOVES = [
  "Pan Up",
  "Pan Down",
  "Pan Left",
  "Pan Right",
  "Zoom In",
  "Zoom Out",
  "Anti Clockwise (ACW)",
  "ClockWise (CW)",
] as const;

export type CameraMove = (typeof CAMERA_MOVES)[number];

export type CinemaGestureId = "raccord" | "camera" | "effet";

export const CINEMA_GESTURE_IDS = ["raccord", "camera", "effet"] as const satisfies readonly CinemaGestureId[];

/** Facts from get_template (summary node_count) and get_template_schema. */
export const CINEMA_GESTURES = {
  raccord: {
    id: "raccord",
    templateId: "video_ltx2_5_flf2v",
    schemaRead: true,
    nodes: 7,
    subgraphNodes: 46,
  },
  camera: {
    id: "camera",
    templateId: "video_wan2_2_14B_fun_camera",
    schemaRead: true,
    nodes: 37,
    schemaNodes: 16,
  },
  effet: {
    id: "effet",
    templateId: "templates_shane_video_restyle",
    schemaRead: true,
    nodes: 25,
    schemaNodes: 24,
  },
} as const;

export type GestureBlock = "partage" | "besoin" | "devis";

export interface GestureGate {
  enabled: boolean;
  block: GestureBlock | null;
}

/** Partage missing, then missing pictures, then a quote that is not a number. */
export function cinemaGestureGate(input: {
  schemaRead: boolean;
  inputsReady: boolean;
  quoteMeasured: boolean;
}): GestureGate {
  if (!input.schemaRead) return { enabled: false, block: "partage" };
  if (!input.inputsReady) return { enabled: false, block: "besoin" };
  if (!input.quoteMeasured) return { enabled: false, block: "devis" };
  return { enabled: true, block: null };
}

export function isCameraMove(pose: string | null): pose is CameraMove {
  return (CAMERA_MOVES as readonly string[]).includes(pose ?? "");
}

export interface GestureSources {
  images: readonly string[];
  videos: readonly string[];
  pose: string | null;
}

export function distinctPaths(paths: readonly string[]): string[] {
  return [...new Set(paths.filter(path => path.trim().length > 0))];
}

export function gestureInputsReady(id: CinemaGestureId, sources: GestureSources): boolean {
  const images = distinctPaths(sources.images);
  const videos = distinctPaths(sources.videos);
  if (id === "raccord") return images.length >= 2;
  if (id === "camera") return images.length >= 1 && isCameraMove(sources.pose);
  return videos.length >= 1 && images.length >= 1;
}

export function gestureReasonKey(id: CinemaGestureId, block: GestureBlock, sources: GestureSources): string {
  if (block === "partage") return "cinema.partage";
  if (block === "devis") return "cinema.devis";
  if (id === "raccord") return "cinema.raccord.need";
  if (id === "effet") return "cinema.effet.need";
  if (distinctPaths(sources.images).length < 1) return "cinema.camera.needStill";
  return "cinema.camera.needMove";
}

const SAFE_ID = /^[a-z0-9-]+$/;
const SECTION_STEMS = new Set([
  "prise", "prises", "shot", "shots", "plan", "plans", "sequence", "sequences",
  "asset", "assets", "fichier", "fichiers", "raccord", "mouvement", "effet", "camera",
  "modele", "moteur", "template", "note", "notes",
]);

/**
 * Where a finished gesture would land, the same way a take does.
 * The clip note and its video sit in Prises/. The plan that holds it stays in Shots/.
 * Assets is not a second copy: weights and training clips already live there.
 * A bare section name is refused, so the file is never « Prise · Prise ».
 */
export function gestureLanding(slug: string, takeId: string, shotId: string | null): {
  prise: string;
  video: string;
  poster: string;
  shot: string | null;
} {
  const ok = (id: string) => SAFE_ID.test(id) && !SECTION_STEMS.has(id);
  if (!ok(slug) || !ok(takeId) || (shotId !== null && !ok(shotId))) {
    throw new Error("bad id");
  }
  return {
    prise: `Projets/${slug}/Prises/${takeId}.md`,
    video: `Projets/${slug}/Prises/${takeId}.mp4`,
    poster: `Projets/${slug}/Prises/${takeId}.jpg`,
    shot: shotId ? `Projets/${slug}/Shots/${shotId}.md` : null,
  };
}
