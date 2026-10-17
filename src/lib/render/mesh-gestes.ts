// « Générer en 3D » in the maquette: one photo becomes a GLB through the official
// open-weights templates. Hunyuan3D 2.1 for a person, TRELLIS.2 for a prop or a
// set piece. Only the visitor's picture, the seed, the face budget and the output
// prefix are patched. The job runs to the end: never cancelled from here.

import { RenderError, jobStage, meshOutput, type RenderClient } from "./client.ts";
import { measuredCost } from "../credits.ts";
import type { ApiGraph } from "./take-graph.ts";
import { MESH_HUNYUAN_BASE, MESH_TRELLIS_BASE } from "./mesh-base.ts";

export const MESH_GESTES = ["prise-volume-perso", "prise-volume-objet"] as const;
export type MeshGesteId = (typeof MESH_GESTES)[number];

export const MESH_PREFIX: Record<MeshGesteId, string> = {
  "prise-volume-perso": "uttu/maquette-perso",
  "prise-volume-objet": "uttu/maquette-objet",
};

/** Faces TRELLIS.2 keeps before it saves. The template keeps 700 000; a phone draws this. */
export const MOBILE_FACES = 40_000;

export function isMeshGeste(id: string): id is MeshGesteId {
  return (MESH_GESTES as readonly string[]).includes(id);
}

export interface MeshGesteInput {
  geste: MeshGesteId;
  /** Uploaded picture name. */
  image: string;
  seed: number;
  faces?: number;
}

export function meshGesteGraph(input: MeshGesteInput): ApiGraph {
  if (!input.image.trim()) throw new Error("Fichier manquant : image_1.");
  const graph: ApiGraph = structuredClone(input.geste === "prise-volume-perso" ? MESH_HUNYUAN_BASE : MESH_TRELLIS_BASE);
  for (const node of Object.values(graph)) {
    if (node.class_type === "LoadImage") node.inputs.image = input.image;
    if (node.class_type === "KSampler") node.inputs.seed = input.seed;
    if (node.class_type === "DecimateMesh") node.inputs.target_face_count = Math.max(1000, Math.round(input.faces ?? MOBILE_FACES));
    if (node.class_type === "SaveGLB" || node.class_type === "Save3DAdvanced") node.inputs.filename_prefix = MESH_PREFIX[input.geste];
  }
  return graph;
}

export interface MeshRunResult {
  jobId: string;
  mesh: Blob;
  balanceBefore: number;
  balanceAfter: number | null;
  costCredits: number | null;
}

export async function runMesh(
  client: RenderClient,
  input: { graph: ApiGraph; clientId: string; balanceBefore: number },
  options: { sleep?: (ms: number) => Promise<void>; now?: () => number; pollMs?: number; timeoutMs?: number; onStage?: (stage: "file" | "calcul" | "retour", seconds?: number) => void } = {},
): Promise<MeshRunResult> {
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const pollMs = options.pollMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;
  const jobId = await client.submit(input.graph, input.clientId);
  const started = now();
  for (;;) {
    if (now() - started > timeoutMs) throw new RenderError("timeout", "Le rendu dépasse la durée permise.");
    const stage = jobStage(await client.status(jobId));
    if (stage === "done") break;
    if (stage === "failed") throw new RenderError("failed", "Le rendu a échoué dans le cloud.");
    if (stage === "cancelled") throw new RenderError("cancelled", "Le rendu a été annulé dans le cloud.");
    options.onStage?.(stage === "render" ? "calcul" : "file", Math.round((now() - started) / 1000));
    await sleep(pollMs);
  }
  options.onStage?.("retour");
  const detail = await client.job(jobId);
  const ref = meshOutput(detail.outputs);
  if (!ref) throw new RenderError("failed", "Le rendu est fini, mais aucun modèle 3D n’est sorti.");
  const mesh = await client.file(ref);
  const balanceAfter = await client.balance().catch(() => null);
  const charged = balanceAfter !== null && balanceAfter !== input.balanceBefore ? balanceAfter : null;
  return { jobId, mesh, balanceBefore: input.balanceBefore, balanceAfter: charged, costCredits: measuredCost(input.balanceBefore, charged) };
}
