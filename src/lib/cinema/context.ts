// CE3: what the intent model sees. Built by the application from the storyboard, the cinema sidecar
// (revisions, archived shots) and the reference catalogue. Every id is opaque and comes from here;
// names are labels, never identity keys. A reference without an id is not listed (no identity).
//
// Bounded to what CE0 sends (INTENT_CONTEXT_MAX_CHARS of canonical JSON). When too long, the
// non-essentials shrink first (narrative, then texts of other shots, then unlocked references), each
// step reported; the selection (with its values), shot ids/revisions and locked references are never dropped.
// References bound to the selected shot are kept like locked ones.
import { canonicalJson } from "./digest.ts";
import { INTENT_CONTEXT_MAX_CHARS } from "./intent-workflow.ts";
import type { CinemaMeta } from "./journal.ts";
import type { Storyboard } from "../storyboard/storyboard.ts";
import { tousLesPlans } from "../storyboard/storyboard.ts";
import { shotDraftOf } from "./snapshot.ts";
import type { CinemaDiagnostic, EditableShotField, IntentContext } from "./types.ts";

export interface CatalogueReference {
  referenceId: string;
  category: IntentContext["references"][number]["category"];
  name: string;
  locked: boolean;
}

export interface ContextInput {
  scope: IntentContext["scope"];
  locale: IntentContext["locale"];
  storyboard: Storyboard;
  meta: CinemaMeta;
  selectedShotId: string | null;
  /** Locked fields per shot (CE4 lock toggles). */
  locks: Record<string, EditableShotField[]>;
  references: CatalogueReference[];
  capabilities: IntentContext["capabilities"];
  maxChars?: number;
}

export interface BuiltContext {
  ok: boolean;
  context: IntentContext;
  diagnostics: CinemaDiagnostic[];
}

/** Revision of the storyboard as a whole (create, reorder, archive, duplicate bump it). */
export const storyboardRevisionOf = (meta: CinemaMeta) => (typeof meta.storyboardRevision === "number" ? meta.storyboardRevision : 0);
export const shotRevisionOf = (meta: CinemaMeta, shotId: string) => meta.revisions[shotId] ?? 0;

export function buildIntentContext(input: ContextInput): BuiltContext {
  const max = input.maxChars ?? INTENT_CONTEXT_MAX_CHARS;
  const diagnostics: CinemaDiagnostic[] = [];
  const plans = tousLesPlans(input.storyboard);
  const selected = input.selectedShotId && plans.some(plan => plan.id === input.selectedShotId) ? input.selectedShotId : null;
  if (input.selectedShotId && !selected) diagnostics.push({ code: "SELECTION_STALE", detail: input.selectedShotId });

  const seen = new Set<string>();
  const references = input.references.filter(ref => {
    if (!ref.referenceId || seen.has(ref.referenceId)) return false;
    seen.add(ref.referenceId);
    return true;
  }).map(ref => ({ referenceId: ref.referenceId, category: ref.category, name: ref.name.slice(0, 80), locked: ref.locked }));

  let context: IntentContext = {
    scope: { ...input.scope },
    locale: input.locale,
    selectedShotId: selected,
    storyboardRevision: storyboardRevisionOf(input.meta),
    shots: plans.map((plan, index) => ({
      shotId: plan.id, revision: shotRevisionOf(input.meta, plan.id), index, titre: plan.titre, action: plan.action,
      archived: input.meta.archived.includes(plan.id), lockedFields: [...(input.locks[plan.id] ?? [])],
    })),
    references,
    capabilities: input.capabilities.filter(cap => cap.qualification === "validated" || cap.qualification === "demo"),
    narrative: [input.storyboard.logline, input.storyboard.scenario].filter(Boolean).join("\n").slice(0, 1200),
  };
  // CE5: « this shot » is the selected shot id, never a « shot N » prefix added to the visitor's words.
  // Its values travel whole (refs with their ids) so a patch can be written without guessing them.
  const selectedPlan = selected ? plans.find(plan => plan.id === selected) : undefined;
  if (selectedPlan && !input.meta.archived.includes(selectedPlan.id)) {
    context = { ...context, selected: { shotId: selectedPlan.id, revision: shotRevisionOf(input.meta, selectedPlan.id), fields: shotDraftOf(selectedPlan) } };
  }
  const size = () => canonicalJson(context).length;

  if (size() > max && context.narrative) {
    context = { ...context, narrative: context.narrative.slice(0, Math.max(0, context.narrative.length - (size() - max))) };
    diagnostics.push({ code: "CONTEXT_REDUCED", field: "narrative" });
  }
  if (size() > max) {
    context = { ...context, shots: context.shots.map(shot => shot.shotId === selected ? shot : { ...shot, titre: shot.titre.slice(0, 24), action: shot.action.slice(0, 40) }) };
    diagnostics.push({ code: "CONTEXT_REDUCED", field: "shots" });
  }
  if (size() > max) {
    const bound = new Set((context.selected?.fields.refs ?? []).map(ref => ref.referenceId).filter(Boolean));
    const kept = (ref: IntentContext["references"][number]) => ref.locked || bound.has(ref.referenceId);
    const dropped = context.references.filter(ref => !kept(ref)).map(ref => ref.referenceId);
    const keep = context.references.filter(kept);
    // Drop unlocked references from the end until it fits; locked and selected-shot ones always stay.
    let unlocked = context.references.filter(ref => !kept(ref));
    while (unlocked.length && size() > max) {
      unlocked = unlocked.slice(0, -1);
      context = { ...context, references: [...keep, ...unlocked] };
    }
    const gone = dropped.filter(id => !unlocked.some(ref => ref.referenceId === id));
    if (gone.length) diagnostics.push({ code: "CONTEXT_REDUCED", field: "references", detail: gone.join(",") });
  }
  const ok = size() <= max;
  if (!ok) diagnostics.push({ code: "CONTEXT_TOO_LONG", detail: `${size()} > ${max}: nothing is sent` });
  return { ok, context, diagnostics };
}
