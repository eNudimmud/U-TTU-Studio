// Manual StoryWeave edits that the cinema journal can store. There is no cancel.

import type { EditableShotField, EditableShotPatch, Operation, Scope } from "../cinema/types.ts";
import { EDITABLE_SHOT_FIELDS } from "../cinema/types.ts";

export function reorderOperation(scope: Scope, expectedRevision: number, shotIds: readonly string[]): Operation {
  return { kind: "storyboard.reorder", scope, expectedRevision, shotIds: [...shotIds] };
}

export function archiveOperation(scope: Scope, shotId: string, expectedRevision: number): Operation {
  return { kind: "shot.archive", target: { ...scope, shotId, expectedRevision } };
}

export function duplicateOperation(scope: Scope, shotId: string, expectedRevision: number): Operation {
  return { kind: "shot.duplicate", target: { ...scope, shotId, expectedRevision } };
}

export function patchOperation(scope: Scope, shotId: string, expectedRevision: number, patch: EditableShotPatch): Operation {
  return { kind: "shot.patch", target: { ...scope, shotId, expectedRevision }, patch };
}

export function finishOperation(scope: Scope, shotId: string, expectedRevision: number, sourceTakeId: string): Operation {
  return { kind: "take.finish.prepare", target: { ...scope, shotId, expectedRevision }, sourceTakeId, recipeId: "suite-finaliser-video" };
}

/** A locked shot refuses every editable field. An open shot locks nothing. */
export function lockFields(on: boolean): EditableShotField[] {
  return on ? [...EDITABLE_SHOT_FIELDS] : [];
}

export function parseLocks(raw: string | null | undefined): Record<string, EditableShotField[]> {
  if (!raw) return {};
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return {}; }
  if (!data || typeof data !== "object") return {};
  const out: Record<string, EditableShotField[]> = {};
  for (const [shotId, fields] of Object.entries(data)) {
    if (!Array.isArray(fields)) continue;
    const kept = fields.filter((field): field is EditableShotField => EDITABLE_SHOT_FIELDS.includes(field as EditableShotField));
    if (kept.length) out[shotId] = kept;
  }
  return out;
}
