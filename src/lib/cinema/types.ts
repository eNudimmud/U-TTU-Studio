// Cinema Engine v1: shared contracts (docs/architecture/CONTRACTS.md, Astra, 1 Nov 2026).
// CE0 owns this file. CE1 (references), CE2 (journal/settlement) and CE3 (intents) import from it
// and never edit it; a change goes through a CE0 commit. Types only plus the constant lists the
// runtime validators need: TypeScript never replaces a validator for model output, vault or import.
//
// The historical French types (PlanSB, PendingRender, PlanFilm…) stay as they are; adapters map them.

import type { Cadrage, Camera, Dialogue, DureePlan, Format, Rendu, Son } from "../storyboard/storyboard.ts";

// ---------------------------------------------------------------- intention → transaction

export interface Scope { projectId: string; storyboardId: string }
export interface Target extends Scope { shotId: string; expectedRevision: number }

/** A reference named in a draft: resolved to a catalogue entry by id, never by a global name. */
export interface ShotDraftRef {
  role: "qui" | "ou" | "objet" | "style";
  /** Catalogue reference id from the context (CE3); null only for « unresolved », never invented. */
  referenceId: string | null;
  /** Display name as the visitor wrote it (`@Name`). A label, not an identity key. */
  name: string;
}

/** The editable fields of `PlanSB`. Nothing else (no id, take, budget or approval) can be patched. */
export interface ShotDraft {
  titre: string;
  action: string;
  refs: ShotDraftRef[];
  cadrage: Cadrage | null;
  camera: Camera | null;
  duree: DureePlan;
  format: Format;
  rendu: Rendu;
  dialogue: Pick<Dialogue, "type" | "qui" | "texte">;
  son: Son;
  raccord: boolean;
  promptManuel: string | null;
}

export const EDITABLE_SHOT_FIELDS = ["titre", "action", "refs", "cadrage", "camera", "duree", "format", "rendu", "dialogue", "son", "raccord", "promptManuel"] as const;
export type EditableShotField = (typeof EDITABLE_SHOT_FIELDS)[number];
export type EditableShotPatch = Partial<ShotDraft>;

export const OPERATION_KINDS = [
  "storyboard.create", "shot.patch", "shot.duplicate", "shot.archive",
  "storyboard.reorder", "shot.prepare", "take.finish.prepare", "sequence.export.prepare",
] as const;
export type OperationKind = (typeof OPERATION_KINDS)[number];

export type Operation =
  | { kind: "storyboard.create"; scope: Scope; shots: ShotDraft[] }
  | { kind: "shot.patch"; target: Target; patch: EditableShotPatch }
  | { kind: "shot.duplicate"; target: Target }
  | { kind: "shot.archive"; target: Target }
  | { kind: "storyboard.reorder"; scope: Scope; expectedRevision: number; shotIds: string[] }
  | { kind: "shot.prepare"; target: Target; output: "keyframe" | "video" }
  | { kind: "take.finish.prepare"; target: Target; sourceTakeId: string; recipeId: string }
  | { kind: "sequence.export.prepare"; scope: Scope; takeIds: string[] };

export interface Unresolved { field: string; reason: string; candidateIds: string[] }

export interface IntentEnvelope {
  schemaVersion: 1;
  /** Allocated by the application (UUID), never taken from the model. */
  operationId: string;
  source: "conversation" | "direct";
  userText: string;
  creativeGoal: string;
  expectedResult: string;
  operations: Operation[];
  rationale: string;
  unresolved: Unresolved[];
}

/** `parseIntent(raw, context)` (CE3). */
export type IntentParse =
  | { status: "valid"; envelope: IntentEnvelope }
  | { status: "needs_clarification"; envelope: IntentEnvelope; unresolved: Unresolved[] }
  | { status: "invalid"; diagnostics: CinemaDiagnostic[] };

/**
 * What the model sees and may name (CE3 builds it, CE0 sends it). Every id is opaque and comes from
 * the application; names are data, never instructions.
 */
export interface IntentContext {
  scope: Scope;
  locale: "en" | "fr" | "de" | "es";
  selectedShotId: string | null;
  storyboardRevision: number;
  shots: { shotId: string; revision: number; index: number; titre: string; action: string; archived: boolean; lockedFields: EditableShotField[] }[];
  references: { referenceId: string; category: ReferenceBinding["category"]; name: string; locked: boolean }[];
  capabilities: { workflowId: string; purpose: WorkflowManifest["purpose"]; qualification: WorkflowManifest["qualification"] }[];
  narrative: string;
  /** CE5: the selected shot's current editable values, its bound references included (never reduced). */
  selected?: { shotId: string; revision: number; fields: ShotDraft };
}

// ---------------------------------------------------------------- references and snapshot

export const REFERENCE_ROLES = ["identity", "appearance", "costume", "pose", "environment", "object", "style", "framing"] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];

/** Historical `RefPlan.role` → binding role. */
export const LEGACY_ROLE: Readonly<Record<ShotDraftRef["role"], ReferenceRole>> = { qui: "identity", ou: "environment", objet: "object", style: "style" };

export interface ReferenceBinding {
  bindingId: string;
  projectId: string;
  entityId: string;
  referenceId: string;
  category: "cast" | "decor" | "objet" | "style";
  role: ReferenceRole;
  images: { assetId: string; sha256: string }[];
  required: boolean;
  locked: boolean;
}

export interface ShotSnapshot {
  schemaVersion: 1;
  scope: Scope;
  shotId: string;
  revision: number;
  planFilmId: string;
  creative: ShotDraft;
  bindings: ReferenceBinding[];
  sourceTakeId?: string;
  approvedKeyframeAssetId?: string;
  /** SHA-256 of the canonical serialization (digest.ts): assets hashes, seed, length, size, prompt, locks, model. */
  digest: string;
}

export interface CompiledReferences {
  orderedAssetIds: string[];
  slots: { bindingId: string; role: ReferenceRole; imageIndices: number[] }[];
  diagnostics: { code: string; bindingId?: string }[];
}

// ---------------------------------------------------------------- workflow, quote, approval

export const QUALIFICATIONS = ["candidate", "validated", "demo", "retired"] as const;
export type Qualification = (typeof QUALIFICATIONS)[number];
export const WORKFLOW_PURPOSES = ["intent", "keyframe", "animation", "finishing"] as const;

export interface WorkflowManifest {
  id: string;
  version: string;
  graphSha256: string;
  compilerVersion: string;
  purpose: (typeof WORKFLOW_PURPOSES)[number];
  provider: "comfy-cloud";
  models: { file: string; source: string; license: string; digest?: string }[];
  nodeTypes: string[];
  capabilities: {
    roles: ReferenceRole[];
    maxImages: number;
    maxBindings: number;
    formats: string[];
    durations: number[];
    outputKinds: string[];
  };
  qualification: Qualification;
  evidence: { commit: string; checkedAt: string; runIds: string[] };
}

export interface Quote {
  id: string;
  snapshotDigest: string;
  workflowDigest: string;
  /** Null = unknown. Never read as zero. */
  estimatedCredits: number | null;
  uncertaintyCredits: number | null;
  basis: "provider" | "measured_similar_job" | "unavailable";
  createdAt: string;
  expiresAt: string;
  /** Media jobs (CE2 R1): digest of the exact payload (snapshot digest + graph + generation + account). */
  payloadDigest?: string;
}

export interface SpendApproval {
  id: string;
  trancheId: string;
  operationId: string;
  quoteId: string;
  snapshotDigest: string;
  workflowDigest: string;
  authorizedCeilingCredits: number;
  /** Media jobs (CE2 R1): the exact payload the person approved; equals the quote's. */
  payloadDigest?: string;
  /** Only a person approves a spend. A model never produces this object. */
  actor: "user";
  approvedAt: string;
  consumedByAttemptId: string | null;
}

// ---------------------------------------------------------------- job and recovery

export const JOB_STATES = [
  "prepared", "awaiting_approval", "authorized", "submitting", "submission_unknown",
  "queued", "running", "succeeded", "failed", "provider_cancelled", "result_pending", "settled",
] as const;
export type JobState = (typeof JOB_STATES)[number];
/** States no stale poll may leave. */
export const TERMINAL_JOB_STATES: readonly JobState[] = ["failed", "provider_cancelled", "settled"];

/** The agent's text job: scope, request, revisions and the context digest. Not a take. */
export interface IntentJobSnapshot {
  schemaVersion: 1;
  kind: "intent";
  scope: Scope;
  selectedShotId: string | null;
  storyboardRevision: number;
  shotRevisions: Record<string, number>;
  /** The visitor's words, bounded. Kept so the proposal can be validated against what was asked. */
  userText: string;
  locale: IntentContext["locale"];
  contextDigest: string;
  workflowId: string;
  workflowDigest: string;
  digest: string;
}

export interface JobOutputRef { assetId: string; kind: string; sha256?: string }

export interface JobReceipt {
  schemaVersion: 2;
  operationId: string;
  attemptId: string;
  /** Opaque account id (e.g. the Comfy user id). Never the key, never a hash of the key. */
  accountScope: string;
  snapshot: ShotSnapshot | IntentJobSnapshot;
  quote: Quote;
  approval: SpendApproval;
  state: JobState;
  providerJobId: string | null;
  submittedAt: string | null;
  updatedAt: string;
  outputs: JobOutputRef[];
  settlement: "none" | "assets_saved" | "take_saved" | "projections_saved" | "abandoned";
  error?: { code: CinemaErrorCode; safeMessage: string };
}

/** A text proposal read from the job history (PreviewAny). Stored and validated; never a media item. */
export interface IntentTextOutput {
  text: string;
  sha256: string;
  /** Cut by the studio's bound, or the model stopped before closing its JSON. */
  truncated: boolean;
  node: string;
}

export interface IntentJobReceipt extends JobReceipt {
  snapshot: IntentJobSnapshot;
  text: IntentTextOutput | null;
}

// ---------------------------------------------------------------- settlement, history, journal (CE2)

/** Observed cost, kept apart from the quote. A balance difference is never a certain invoice. */
export interface ObservedCost {
  credits: number | null;
  provenance: "billing_job" | "gpu_estimate" | "unknown";
  /** Units as validated against the provider schema (no automatic cents/micros guess). */
  unit: "credits";
  readAt: string | null;
}

/** Additive fields on a historical take (`Prise` of film/registre.ts). Absent on older takes. */
export interface TakeProvenance {
  operationId: string;
  attemptId: string;
  shotId: string;
  revision: number;
  workflowDigest: string;
  assetIds: string[];
  sourceTakeId?: string;
  cost: ObservedCost;
  /** The result came back for an older revision than the shot's current one: a variant, never a replacement. */
  fromEarlierRevision: boolean;
}

/** One journal file `.uttu/op-<uuid>.json`: hashes before/after each target, written under the project lock. */
export interface JournalEntry {
  schemaVersion: 1;
  operationId: string;
  scope: Scope;
  state: "prepared" | "applied" | "conflict" | "rolled_back";
  targets: { path: string; before: string | null; after: string }[];
  inverseOf?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------- errors and ports

export const CINEMA_ERROR_CODES = [
  "REFERENCE_MISSING", "REFERENCE_AMBIGUOUS", "REFERENCE_CAPACITY", "REVISION_CONFLICT", "LOCK_CONFLICT",
  "WORKFLOW_UNQUALIFIED", "MODEL_INELIGIBLE", "QUOTE_UNAVAILABLE", "APPROVAL_REQUIRED", "BUDGET_RESERVED",
  "SUBMISSION_UNKNOWN", "PROJECT_UNAVAILABLE", "OUTPUT_INVALID", "STORAGE_UNAVAILABLE",
  // CE0 addition, named in CINEMA_LOTS CE0 « Acceptation »: the model file is missing on Cloud.
  "INTENT_MODEL_UNAVAILABLE",
  // CE0 addition: the provider answered the POST with a refusal (auth, credits, subscription, invalid graph).
  "PROVIDER_REFUSED",
  // CE5 addition (Astra decision 6): `/api/user` gave no stable opaque id — no new cinema submission.
  "ACCOUNT_UNAVAILABLE",
] as const;
export type CinemaErrorCode = (typeof CINEMA_ERROR_CODES)[number];

export interface CinemaDiagnostic { code: CinemaErrorCode | string; field?: string; bindingId?: string; detail?: string }

export class CinemaError extends Error {
  readonly code: CinemaErrorCode;
  readonly detail: string[];
  constructor(code: CinemaErrorCode, message: string, detail: string[] = []) {
    super(message);
    this.name = "CinemaError";
    this.code = code;
    this.detail = detail;
  }
}

/** Synchronous key/value port (localStorage in the browser, a Map in tests). */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
