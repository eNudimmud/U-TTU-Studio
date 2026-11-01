// CE3: the model proposes, the application checks. `parseIntent` turns the text of the intent job
// (CE0) into a typed proposal, or refuses it. Nothing here mutates, calls the network or approves a
// spend: an invalid answer means zero mutation and no second paid request.
//
// Ids, UUIDs, scope and revisions come from the application (context.ts). The model may only copy
// them; an id that is not in the context is refused, a name that matches several references or none
// is « unresolved », never created.
import { INTENT_OUTPUT_MAX_CHARS } from "./intent-workflow.ts";
import {
  EDITABLE_SHOT_FIELDS, OPERATION_KINDS, type CinemaDiagnostic, type EditableShotField, type EditableShotPatch, type IntentContext,
  type IntentEnvelope, type IntentParse, type Operation, type Scope, type ShotDraft, type ShotDraftRef, type Target, type Unresolved,
} from "./types.ts";

export const INTENT_LIMITS = {
  text: 400,
  title: 80,
  action: 240,
  line: 160,
  prompt: 600,
  operations: 12,
  createShots: 12,
  unresolved: 12,
} as const;

const CADRAGES = ["large", "moyen", "serre", "detail"] as const;
const CAMERAS = ["fixe", "suit", "approche", "autour"] as const;
const DUREES = [5, 8, 10] as const;
const FORMATS = ["paysage", "portrait"] as const;
const RENDUS = ["rapide", "fidele"] as const;
const PAROLES = ["aucune", "replique", "voixoff"] as const;
const ROLES = ["qui", "ou", "objet", "style"] as const;
const ROLE_CATEGORY = { qui: "cast", ou: "decor", objet: "objet", style: "style" } as const;
const TOP_KEYS = ["creativeGoal", "expectedResult", "operations", "rationale", "unresolved"] as const;

/** « This shot » in the four studio languages. It needs a selection. */
const DEICTIC = /\b(ce plan|cette prise|this shot|this one|diese einstellung|dieser einstellung|este plano|esta toma)\b/i;

export interface ParseAllocation {
  /** UUID allocated by the application. */
  operationId: string;
  source: IntentEnvelope["source"];
  userText: string;
}

export interface ParseOptions {
  /** Takes the visitor may name, by shot (finish/export). */
  takeIds?: Record<string, string[]>;
  /** Qualified finishing recipes. */
  recipeIds?: string[];
}

class Refusal extends Error {
  readonly diagnostic: CinemaDiagnostic;
  constructor(diagnostic: CinemaDiagnostic) { super(diagnostic.detail ?? diagnostic.code); this.diagnostic = diagnostic; }
}
const refuse = (code: string, detail: string, field?: string): never => { throw new Refusal({ code, detail, ...(field ? { field } : {}) }); };

// ---------------------------------------------------------------- one bounded JSON object

/**
 * The text must be exactly one JSON object, optionally inside one Markdown ```json fence. Prose
 * around it, a second object, an array or code is refused; a cut answer fails to parse.
 */
export function extractSingleObject(raw: string): unknown {
  if (typeof raw !== "string" || !raw.trim()) refuse("OUTPUT_INVALID", "empty answer");
  if (raw.length > INTENT_OUTPUT_MAX_CHARS) refuse("OUTPUT_INVALID", "answer too long");
  let body = raw.trim();
  const fence = /^```(?:json)?[ \t]*\n?([\s\S]*?)\n?```$/i.exec(body);
  if (fence) body = fence[1].trim();
  if (body.includes("```")) refuse("OUTPUT_INVALID", "code or several fences");
  if (!body.startsWith("{")) refuse("OUTPUT_INVALID", "text outside the JSON object");
  const end = objectEnd(body);
  if (end < 0) refuse("OUTPUT_INVALID", "truncated JSON");
  if (body.slice(end + 1).trim()) refuse("OUTPUT_INVALID", "several objects or text after the object");
  try { return JSON.parse(body); } catch { return refuse("OUTPUT_INVALID", "malformed JSON"); }
}

/** Index of the brace closing the first object, strings respected; -1 when it never closes. */
function objectEnd(text: string): number {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// ---------------------------------------------------------------- field validators

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Data, bounded; marker look-alikes and control characters removed. Never read as an instruction. */
export function cleanText(value: unknown, max: number, field: string): string {
  if (typeof value !== "string") refuse("OUTPUT_INVALID", "not a string", field);
  // eslint-disable-next-line no-control-regex
  const text = (value as string).replace(/<<<\/?[A-Z]+>>>/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (text.length > max) refuse("OUTPUT_INVALID", `longer than ${max}`, field);
  return text;
}

function oneOf<T extends string | number>(value: unknown, allowed: readonly T[], field: string, nullable = false): T | null {
  if (nullable && value === null) return null;
  if (!allowed.includes(value as T)) refuse("OUTPUT_INVALID", `not one of ${allowed.join("|")}`, field);
  return value as T;
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const extra = Object.keys(value).filter(key => !allowed.includes(key));
  if (extra.length) refuse("OUTPUT_INVALID", `unexpected ${extra.join(", ")}`, field);
}

function refOf(value: unknown, context: IntentContext, field: string, unresolved: Unresolved[]): ShotDraftRef | null {
  if (!isObject(value)) return refuse("OUTPUT_INVALID", "ref is not an object", field);
  onlyKeys(value, ["role", "referenceId", "name"], field);
  const role = oneOf(value.role, ROLES, `${field}.role`)!;
  const name = cleanText(value.name ?? "", INTENT_LIMITS.title, `${field}.name`);
  if (value.referenceId === null || value.referenceId === undefined) {
    // A name without an id is not an identity: it becomes a question, never a new character.
    unresolved.push({ field, reason: "reference without id", candidateIds: candidatesFor(context, role, name) });
    return null;
  }
  const entry = context.references.find(item => item.referenceId === value.referenceId);
  if (!entry) refuse("UNKNOWN_ID", `reference ${String(value.referenceId)} is not in the context`, field);
  if (entry!.category !== ROLE_CATEGORY[role]) refuse("OUTPUT_INVALID", `reference ${entry!.referenceId} is a ${entry!.category}, not ${role}`, field);
  return { role, referenceId: entry!.referenceId, name: name || entry!.name };
}

const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function candidatesFor(context: IntentContext, role: ShotDraftRef["role"], name: string): string[] {
  const wanted = fold(name);
  if (!wanted) return [];
  return context.references.filter(item => item.category === ROLE_CATEGORY[role] && fold(item.name) === wanted).map(item => item.referenceId);
}

/** One editable field. Shared by drafts (create) and patches. */
function fieldValue(key: EditableShotField, value: unknown, context: IntentContext, field: string, unresolved: Unresolved[]): unknown {
  switch (key) {
    case "titre": return cleanText(value, INTENT_LIMITS.title, field);
    case "action": return cleanText(value, INTENT_LIMITS.action, field);
    case "promptManuel": return value === null ? null : cleanText(value, INTENT_LIMITS.prompt, field);
    case "cadrage": return oneOf(value, CADRAGES, field, true);
    case "camera": return oneOf(value, CAMERAS, field, true);
    case "duree": return oneOf(value, DUREES, field);
    case "format": return oneOf(value, FORMATS, field);
    case "rendu": return oneOf(value, RENDUS, field);
    case "raccord": if (typeof value !== "boolean") refuse("OUTPUT_INVALID", "not a boolean", field); return value;
    case "son": {
      if (!isObject(value)) return refuse("OUTPUT_INVALID", "not an object", field);
      onlyKeys(value, ["musique", "ambiance"], field);
      return { musique: cleanText(value.musique ?? "", INTENT_LIMITS.text, `${field}.musique`), ambiance: cleanText(value.ambiance ?? "", INTENT_LIMITS.text, `${field}.ambiance`) };
    }
    case "dialogue": {
      if (!isObject(value)) return refuse("OUTPUT_INVALID", "not an object", field);
      onlyKeys(value, ["type", "qui", "texte"], field);
      return { type: oneOf(value.type, PAROLES, `${field}.type`), qui: value.qui === null || value.qui === undefined ? null : cleanText(value.qui, INTENT_LIMITS.title, `${field}.qui`), texte: cleanText(value.texte ?? "", INTENT_LIMITS.line, `${field}.texte`) };
    }
    case "refs": {
      if (!Array.isArray(value) || value.length > 7) return refuse("OUTPUT_INVALID", "refs must be a list of at most 7", field);
      return value.map((item, i) => refOf(item, context, `${field}[${i}]`, unresolved)).filter((item): item is ShotDraftRef => item !== null);
    }
  }
}

const DRAFT_DEFAULTS: ShotDraft = {
  titre: "", action: "", refs: [], cadrage: null, camera: null, duree: 5, format: "paysage", rendu: "fidele",
  dialogue: { type: "aucune", qui: null, texte: "" } as ShotDraft["dialogue"], son: { musique: "", ambiance: "" }, raccord: false, promptManuel: null,
};

function draftOf(value: unknown, context: IntentContext, field: string, unresolved: Unresolved[]): ShotDraft {
  if (!isObject(value)) return refuse("OUTPUT_INVALID", "shot is not an object", field);
  onlyKeys(value, EDITABLE_SHOT_FIELDS, field);
  const draft = { ...DRAFT_DEFAULTS } as Record<string, unknown>;
  for (const key of EDITABLE_SHOT_FIELDS) if (key in value) draft[key] = fieldValue(key, value[key], context, `${field}.${key}`, unresolved);
  if (!String(draft.action).trim() && !String(draft.titre).trim()) refuse("OUTPUT_INVALID", "a shot needs an action or a title", field);
  return draft as unknown as ShotDraft;
}

function patchOf(value: unknown, context: IntentContext, shot: IntentContext["shots"][number], field: string, unresolved: Unresolved[]): EditableShotPatch {
  if (!isObject(value)) return refuse("OUTPUT_INVALID", "patch is not an object", field);
  onlyKeys(value, EDITABLE_SHOT_FIELDS, field);
  const keys = Object.keys(value) as EditableShotField[];
  if (!keys.length) refuse("OUTPUT_INVALID", "empty patch", field);
  const locked = keys.filter(key => shot.lockedFields.includes(key));
  if (locked.length) refuse("LOCK_CONFLICT", `locked: ${locked.join(", ")}`, field);
  const patch: Record<string, unknown> = {};
  for (const key of keys) patch[key] = fieldValue(key, value[key], context, `${field}.${key}`, unresolved);
  return patch as EditableShotPatch;
}

function scopeOf(value: unknown, context: IntentContext, field: string): Scope {
  if (!isObject(value)) return refuse("OUTPUT_INVALID", "scope is not an object", field);
  onlyKeys(value, ["projectId", "storyboardId"], field);
  if (value.projectId !== context.scope.projectId || value.storyboardId !== context.scope.storyboardId) refuse("SCOPE_MISMATCH", "another project or storyboard", field);
  return { ...context.scope };
}

function targetOf(value: unknown, context: IntentContext, field: string): { target: Target; shot: IntentContext["shots"][number] } {
  if (!isObject(value)) return refuse("OUTPUT_INVALID", "target is not an object", field);
  onlyKeys(value, ["projectId", "storyboardId", "shotId", "expectedRevision"], field);
  scopeOf({ projectId: value.projectId, storyboardId: value.storyboardId }, context, field);
  const shot = context.shots.find(item => item.shotId === value.shotId);
  if (!shot) return refuse("UNKNOWN_ID", `shot ${String(value.shotId)} is not in the context`, field);
  if (shot.archived) refuse("UNKNOWN_ID", `shot ${shot.shotId} is archived`, field);
  if (value.expectedRevision !== shot.revision) refuse("REVISION_CONFLICT", `shot ${shot.shotId} is at revision ${shot.revision}`, field);
  return { target: { ...context.scope, shotId: shot.shotId, expectedRevision: shot.revision }, shot };
}

function operationOf(value: unknown, context: IntentContext, options: ParseOptions, field: string, unresolved: Unresolved[]): Operation {
  if (!isObject(value)) return refuse("OUTPUT_INVALID", "operation is not an object", field);
  const kind = value.kind;
  if (!OPERATION_KINDS.includes(kind as never)) return refuse("OUTPUT_INVALID", `unknown operation ${String(kind)}`, field);
  switch (kind as Operation["kind"]) {
    case "storyboard.create": {
      onlyKeys(value, ["kind", "scope", "shots"], field);
      if (!Array.isArray(value.shots) || !value.shots.length || value.shots.length > INTENT_LIMITS.createShots) return refuse("OUTPUT_INVALID", `1 to ${INTENT_LIMITS.createShots} shots`, field);
      return { kind: "storyboard.create", scope: scopeOf(value.scope, context, `${field}.scope`), shots: value.shots.map((shot, i) => draftOf(shot, context, `${field}.shots[${i}]`, unresolved)) };
    }
    case "shot.patch": {
      onlyKeys(value, ["kind", "target", "patch"], field);
      const { target, shot } = targetOf(value.target, context, `${field}.target`);
      return { kind: "shot.patch", target, patch: patchOf(value.patch, context, shot, `${field}.patch`, unresolved) };
    }
    case "shot.duplicate":
    case "shot.archive": {
      onlyKeys(value, ["kind", "target"], field);
      return { kind: kind as "shot.duplicate" | "shot.archive", target: targetOf(value.target, context, `${field}.target`).target };
    }
    case "storyboard.reorder": {
      onlyKeys(value, ["kind", "scope", "expectedRevision", "shotIds"], field);
      const scope = scopeOf(value.scope, context, `${field}.scope`);
      if (value.expectedRevision !== context.storyboardRevision) refuse("REVISION_CONFLICT", `storyboard is at revision ${context.storyboardRevision}`, field);
      const active = context.shots.filter(shot => !shot.archived).map(shot => shot.shotId);
      const ids = Array.isArray(value.shotIds) ? value.shotIds : [];
      const exact = ids.length === active.length && new Set(ids).size === ids.length && ids.every(id => active.includes(id as string));
      if (!exact) refuse("REORDER_NOT_PERMUTATION", "shotIds must be every active shot exactly once", field);
      return { kind: "storyboard.reorder", scope, expectedRevision: context.storyboardRevision, shotIds: ids as string[] };
    }
    case "shot.prepare": {
      onlyKeys(value, ["kind", "target", "output"], field);
      return { kind: "shot.prepare", target: targetOf(value.target, context, `${field}.target`).target, output: oneOf(value.output, ["keyframe", "video"] as const, `${field}.output`)! };
    }
    case "take.finish.prepare": {
      onlyKeys(value, ["kind", "target", "sourceTakeId", "recipeId"], field);
      const { target } = targetOf(value.target, context, `${field}.target`);
      if (typeof value.sourceTakeId !== "string" || !value.sourceTakeId) return refuse("FINISH_SOURCE_MISSING", "finishing needs a source take", field);
      if (!(options.takeIds?.[target.shotId] ?? []).includes(value.sourceTakeId)) return refuse("UNKNOWN_ID", `take ${value.sourceTakeId} is not a take of this shot`, field);
      if (typeof value.recipeId !== "string" || !(options.recipeIds ?? []).includes(value.recipeId)) return refuse("WORKFLOW_UNQUALIFIED", "no qualified finishing recipe", field);
      return { kind: "take.finish.prepare", target, sourceTakeId: value.sourceTakeId, recipeId: value.recipeId };
    }
    case "sequence.export.prepare": {
      onlyKeys(value, ["kind", "scope", "takeIds"], field);
      const known = Object.values(options.takeIds ?? {}).flat();
      const ids = Array.isArray(value.takeIds) ? value.takeIds : [];
      if (!ids.length || !ids.every(id => known.includes(id as string))) return refuse("UNKNOWN_ID", "unknown take id", field);
      return { kind: "sequence.export.prepare", scope: scopeOf(value.scope, context, `${field}.scope`), takeIds: ids as string[] };
    }
  }
}

function unresolvedOf(value: unknown, context: IntentContext): Unresolved[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > INTENT_LIMITS.unresolved) return refuse("OUTPUT_INVALID", "unresolved must be a short list", "unresolved");
  const known = new Set([...context.references.map(item => item.referenceId), ...context.shots.map(item => item.shotId)]);
  return value.map((item, i) => {
    const field = `unresolved[${i}]`;
    if (!isObject(item)) return refuse("OUTPUT_INVALID", "not an object", field);
    onlyKeys(item, ["field", "reason", "candidateIds"], field);
    const candidateIds = Array.isArray(item.candidateIds) ? item.candidateIds : [];
    const invented = candidateIds.filter(id => !known.has(id as string));
    if (invented.length) refuse("UNKNOWN_ID", `candidate ${String(invented[0])} is not in the context`, field);
    return { field: cleanText(item.field, INTENT_LIMITS.title, `${field}.field`), reason: cleanText(item.reason, INTENT_LIMITS.text, `${field}.reason`), candidateIds: candidateIds as string[] };
  });
}

// ---------------------------------------------------------------- parseIntent

/**
 * `valid` = typed operations ready for `applyOperation`; `needs_clarification` = ask the visitor,
 * apply nothing; `invalid` = diagnostics only. Never throws on model output.
 */
export function parseIntent(raw: string, context: IntentContext, allocation: ParseAllocation, options: ParseOptions = {}): IntentParse {
  try {
    const data = extractSingleObject(raw);
    if (!isObject(data)) return refuse("OUTPUT_INVALID", "not an object");
    // The model never produces an approval, an operation id or a scope of its own.
    onlyKeys(data, TOP_KEYS, "$");
    const unresolved = unresolvedOf(data.unresolved, context);
    if (!Array.isArray(data.operations) || data.operations.length > INTENT_LIMITS.operations) return refuse("OUTPUT_INVALID", `operations must be a list of at most ${INTENT_LIMITS.operations}`, "operations");
    const operations = data.operations.map((op, i) => operationOf(op, context, options, `operations[${i}]`, unresolved));
    const creates = operations.filter(op => op.kind === "storyboard.create").length;
    if (creates > 1) refuse("OUTPUT_INVALID", "one storyboard.create per proposal (it is one indivisible transaction)", "operations");

    if (DEICTIC.test(allocation.userText)) {
      const targeted = operations.flatMap(op => "target" in op ? [op.target.shotId] : []);
      if (context.selectedShotId === null) unresolved.push({ field: "target", reason: "« this shot » without a selected shot", candidateIds: [] });
      else if (targeted.some(id => id !== context.selectedShotId)) refuse("TARGET_NOT_SELECTED", "« this shot » is the selected shot", "operations");
    }
    if (!operations.length && !unresolved.length) refuse("OUTPUT_INVALID", "no operation and nothing unresolved", "operations");

    const envelope: IntentEnvelope = {
      schemaVersion: 1,
      operationId: allocation.operationId,
      source: allocation.source,
      userText: allocation.userText.slice(0, 1200),
      creativeGoal: cleanText(data.creativeGoal ?? "", INTENT_LIMITS.text, "creativeGoal"),
      expectedResult: cleanText(data.expectedResult ?? "", INTENT_LIMITS.text, "expectedResult"),
      operations,
      rationale: cleanText(data.rationale ?? "", INTENT_LIMITS.text, "rationale"),
      unresolved,
    };
    return unresolved.length ? { status: "needs_clarification", envelope, unresolved } : { status: "valid", envelope };
  } catch (error) {
    if (error instanceof Refusal) return { status: "invalid", diagnostics: [error.diagnostic] };
    return { status: "invalid", diagnostics: [{ code: "OUTPUT_INVALID", detail: "unreadable proposal" }] };
  }
}
