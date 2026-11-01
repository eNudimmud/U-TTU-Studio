// CE1 · The immutable picture of one shot at quote time (CONTRACTS ShotSnapshot). It is built from that
// shot only: changing shot 2 leaves the snapshots of shots 1 and 3 byte-identical. The digest covers
// the creative fields, the bindings with their picture hashes, the locks and the generation settings
// (seed, length, size, prompt, model); keys, headers and signed URLs never enter it.

import type { PlanSB } from "../storyboard/storyboard.ts";
import { digestOf } from "./digest.ts";
import { CinemaError, type CompiledReferences, type ReferenceBinding, type Scope, type ShotDraft, type ShotSnapshot } from "./types.ts";

/** Generation settings that change the result. Part of the digest, not of the creative fields. */
export interface GenerationSettings {
  workflowId: string;
  workflowDigest: string;
  seed: number;
  seconds: number;
  aspect: string;
  resolution: string;
  /** The exact text sent (after `slotPrompt`). */
  prompt: string;
  /** Picture order actually sent; the slots map it to roles. */
  orderedAssetIds: readonly string[];
  slots: CompiledReferences["slots"];
}

/** The editable fields of a historical shot, copied (no id, take, state or film link). */
export function shotDraftOf(plan: PlanSB): ShotDraft {
  return structuredClone({
    titre: plan.titre,
    action: plan.action,
    refs: plan.refs.map(ref => ({ role: ref.role, referenceId: ref.id, name: ref.nom })),
    cadrage: plan.cadrage,
    camera: plan.camera,
    duree: plan.duree,
    format: plan.format,
    rendu: plan.rendu,
    dialogue: { type: plan.dialogue.type, qui: plan.dialogue.qui, texte: plan.dialogue.texte },
    son: plan.son,
    raccord: plan.raccord,
    promptManuel: plan.promptManuel,
  });
}

export interface ShotSnapshotInput {
  scope: Scope;
  plan: PlanSB;
  revision: number;
  planFilmId: string;
  bindings: readonly ReferenceBinding[];
  generation: GenerationSettings;
  sourceTakeId?: string;
  approvedKeyframeAssetId?: string;
}

export async function shotSnapshot(input: ShotSnapshotInput): Promise<ShotSnapshot> {
  const base: Omit<ShotSnapshot, "digest"> = {
    schemaVersion: 1,
    scope: { projectId: input.scope.projectId, storyboardId: input.scope.storyboardId },
    shotId: input.plan.id,
    revision: input.revision,
    planFilmId: input.planFilmId,
    creative: shotDraftOf(input.plan),
    bindings: structuredClone([...input.bindings]),
    ...(input.sourceTakeId ? { sourceTakeId: input.sourceTakeId } : {}),
    ...(input.approvedKeyframeAssetId ? { approvedKeyframeAssetId: input.approvedKeyframeAssetId } : {}),
  };
  const digest = await snapshotDigest(base, input.generation);
  return Object.freeze({ ...base, digest });
}

export function snapshotDigest(snapshot: Omit<ShotSnapshot, "digest">, generation: GenerationSettings): Promise<string> {
  return digestOf({ snapshot, generation });
}

/** A quote (or approval) made for another digest is void: the references or the settings changed since. */
export function assertSnapshotCurrent(quotedDigest: string, snapshot: Pick<ShotSnapshot, "digest">): void {
  if (quotedDigest !== snapshot.digest) throw new CinemaError("APPROVAL_REQUIRED", "The shot changed since its quote: quote it again.");
}

/**
 * An approved keyframe is a picture the visitor accepted as the shot's first frame. A raw CAST or
 * DÉCOR photo is not one, even if it looks like a frame: it stays a reference.
 */
export function isApprovedKeyframe(assetId: string | undefined, bindings: readonly ReferenceBinding[], approved: ReadonlySet<string>): boolean {
  if (!assetId || !approved.has(assetId)) return false;
  return !bindings.some(binding => binding.images.some(image => image.assetId === assetId));
}

/**
 * P0 video path (recommended): the approved keyframe alone, LTX image-to-video with one picture and
 * no hidden composition. Without an approved keyframe there is no video input.
 */
export function keyframeVideoPictures(snapshot: Pick<ShotSnapshot, "approvedKeyframeAssetId" | "bindings">, approved: ReadonlySet<string>): string[] {
  const id = snapshot.approvedKeyframeAssetId;
  if (!isApprovedKeyframe(id, snapshot.bindings, approved)) throw new CinemaError("REFERENCE_MISSING", "Approve a keyframe for this shot first.");
  return [id!];
}

/** State of the workspace's « Prepare keyframe » button (CE4 `[data-sb-keyframe]`). */
export type KeyframeReadiness =
  | { enabled: true }
  | { enabled: false; reason: "WORKFLOW_UNQUALIFIED" | "REFERENCE_MISSING" | "REFERENCE_AMBIGUOUS" | "REFERENCE_CAPACITY" | "LOCK_CONFLICT"; detail?: string };

export function keyframeReadiness(input: { workflowRunnable: boolean; diagnostics: readonly { code: string; detail?: string }[] }): KeyframeReadiness {
  if (!input.workflowRunnable) return { enabled: false, reason: "WORKFLOW_UNQUALIFIED" };
  for (const code of ["REFERENCE_MISSING", "REFERENCE_AMBIGUOUS", "REFERENCE_CAPACITY"] as const) {
    const found = input.diagnostics.find(item => item.code === code);
    if (found) return { enabled: false, reason: code, ...(found.detail ? { detail: found.detail } : {}) };
  }
  return { enabled: true };
}
