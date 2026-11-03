// CE1 · References bound by project/category/id up to the graph (CONTRACTS « Références et snapshot »).
// Three pure steps: resolve the shot's refs to catalogue entries, compile them into an ordered image
// list with one slot per binding, and name each slot in the prompt by its role. The physical order of
// the pictures never decides a role: the slots do. Generic: nothing here knows a character's name.

import type { RefPlan } from "../storyboard/storyboard.ts";
import { LEGACY_ROLE, type CinemaDiagnostic, type CompiledReferences, type ReferenceBinding, type ReferenceRole, type ShotDraftRef } from "./types.ts";

/** A named reference holds three pictures at most (REFERENCE_PHOTOS_MAX of the catalogue). */
export const REFERENCE_IMAGES_MAX = 3;
/** Views per character when several share a shot (#212: 1–2, balanced). Raising it is the visitor's call, never silent. */
export const IDENTITY_VIEWS_DEFAULT = 2;

export const CATEGORY_OF_ROLE = { qui: "cast", ou: "decor", objet: "objet", style: "style" } as const satisfies Record<ShotDraftRef["role"], ReferenceBinding["category"]>;

/** Order of the slots in the image list. A reading order only: the prompt names every slot by its role. */
const ROLE_ORDER: readonly ReferenceRole[] = ["identity", "appearance", "costume", "pose", "environment", "object", "style", "framing"];
const IDENTITY_ROLES: ReadonlySet<ReferenceRole> = new Set(["identity", "appearance", "costume", "pose"]);

/** Diagnostics that stop the shot: nothing is quoted or sent while one is present. */
export const BLOCKING_CODES: ReadonlySet<string> = new Set(["REFERENCE_MISSING", "REFERENCE_AMBIGUOUS", "REFERENCE_CAPACITY"]);
export const isBlocked = (diagnostics: readonly CinemaDiagnostic[]) => diagnostics.some(item => BLOCKING_CODES.has(item.code));

export interface CatalogueImage { assetId: string; sha256: string }
/** One card of the project catalogue (CAST, DÉCOR, Refs/objet, Refs/style), as the vault reads it. */
export interface CatalogueEntry {
  projectId: string;
  category: ReferenceBinding["category"];
  referenceId: string;
  /** A label. Two cards may share it; it never identifies anything on its own. */
  name: string;
  images: readonly CatalogueImage[];
  /** Explicit identity link (a collection of several cards for one character). Absent: the card is its own entity. */
  entityId?: string;
  locked?: boolean;
  description?: string;
}

/** The stable composite key of a legacy card: project, category and id; renaming never changes it. */
export function legacyEntityId(projectId: string, category: ReferenceBinding["category"], referenceId: string): string {
  return `${projectId}:${category}:${referenceId}`;
}
export function bindingIdOf(projectId: string, category: ReferenceBinding["category"], referenceId: string, role: ReferenceRole): string {
  return `${legacyEntityId(projectId, category, referenceId)}:${role}`;
}

export interface ShotRefInput { role: ShotDraftRef["role"]; referenceId: string | null; name: string }
export const fromRefPlan = (ref: Pick<RefPlan, "role" | "id" | "nom">): ShotRefInput => ({ role: ref.role, referenceId: ref.id, name: ref.nom });

const key = (text: string) => text.normalize("NFC").trim().toLocaleLowerCase();

export interface ResolvedReferences {
  bindings: ReferenceBinding[];
  diagnostics: CinemaDiagnostic[];
  blocked: boolean;
}

/**
 * The shot's refs → bindings. By id inside the project and category first; a ref without id is matched
 * by name in the same project and category only, and two cards with that name are ambiguous. An unknown
 * ref, or a card without pixels, blocks the shot: no identity is created here.
 */
export function resolveReferences(input: {
  projectId: string;
  refs: readonly ShotRefInput[];
  catalogue: readonly CatalogueEntry[];
  lockedReferenceIds?: ReadonlySet<string>;
}): ResolvedReferences {
  const bindings: ReferenceBinding[] = [];
  const diagnostics: CinemaDiagnostic[] = [];
  const own = input.catalogue.filter(entry => entry.projectId === input.projectId);
  for (const ref of input.refs) {
    const category = CATEGORY_OF_ROLE[ref.role];
    const role = LEGACY_ROLE[ref.role];
    const field = `refs.${ref.role}`;
    const sameCategory = own.filter(entry => entry.category === category);
    let entry: CatalogueEntry | undefined;
    if (ref.referenceId) {
      entry = sameCategory.find(item => item.referenceId === ref.referenceId);
      if (!entry) { diagnostics.push({ code: "REFERENCE_MISSING", field, detail: `${category}:${ref.referenceId} is not in project ${input.projectId}` }); continue; }
    } else {
      const named = sameCategory.filter(item => key(item.name) === key(ref.name) && key(ref.name) !== "");
      if (named.length > 1) { diagnostics.push({ code: "REFERENCE_AMBIGUOUS", field, detail: `${named.length} ${category} cards are named « ${ref.name.trim()} »` }); continue; }
      entry = named[0];
      if (!entry) { diagnostics.push({ code: "REFERENCE_MISSING", field, detail: `no ${category} card named « ${ref.name.trim()} » in this project` }); continue; }
    }
    const bindingId = bindingIdOf(input.projectId, category, entry.referenceId, role);
    if (bindings.some(binding => binding.bindingId === bindingId)) continue;
    const images = dedupeImages(entry.images);
    if (images.length > REFERENCE_IMAGES_MAX) diagnostics.push({ code: "REFERENCE_IMAGES_CAPPED", bindingId, detail: `${images.length} pictures, the first ${REFERENCE_IMAGES_MAX} are used` });
    const binding: ReferenceBinding = {
      bindingId,
      projectId: input.projectId,
      entityId: entry.entityId ?? legacyEntityId(input.projectId, category, entry.referenceId),
      referenceId: entry.referenceId,
      category,
      role,
      images: images.slice(0, REFERENCE_IMAGES_MAX),
      required: true,
      locked: Boolean(entry.locked || input.lockedReferenceIds?.has(entry.referenceId)),
    };
    if (!binding.images.length) diagnostics.push({ code: "REFERENCE_MISSING", bindingId, detail: "the card has no picture" });
    bindings.push(binding);
  }
  return { bindings, diagnostics, blocked: isBlocked(diagnostics) };
}

function dedupeImages(images: readonly CatalogueImage[]): CatalogueImage[] {
  const seen = new Set<string>();
  return images.filter(image => image.assetId && !seen.has(image.assetId) && (seen.add(image.assetId), true)).map(image => ({ assetId: image.assetId, sha256: image.sha256 }));
}

/** What the target workflow accepts (WorkflowManifest.capabilities). */
export interface ReferenceCapacity { roles: readonly ReferenceRole[]; maxImages: number; maxBindings: number }

export interface CompileOptions {
  /** Views per character when several share the shot. Lowering it is an explicit choice of the visitor. */
  identityViews?: number;
  /**
   * Usable pictures per binding after pixel preparation (reference-preparation.ts): clean views first,
   * a sheet only when the card has no clean view. Absent: the binding's own pictures, in order.
   */
  usable?: ReadonlyMap<string, readonly string[]>;
}

/**
 * Bindings → ordered asset ids and one slot per binding. Every required binding gets at least one
 * picture, or the shot is refused: a reference is never dropped to fit (the place is never the one
 * lost after four CAST views). Two cards sharing a file point at the same index; nobody gets zero.
 */
/** CompiledReferences with the diagnostics' detail kept (a superset of the contract shape). */
export interface Compiled extends CompiledReferences { diagnostics: CinemaDiagnostic[] }

export function compileReferences(bindings: readonly ReferenceBinding[], capacity: ReferenceCapacity, options: CompileOptions = {}): Compiled {
  const diagnostics: CinemaDiagnostic[] = [];
  const ordered = [...bindings].map((binding, index) => ({ binding, index }))
    .sort((a, b) => ROLE_ORDER.indexOf(a.binding.role) - ROLE_ORDER.indexOf(b.binding.role) || a.index - b.index)
    .map(item => item.binding);
  for (const binding of ordered) {
    if (!capacity.roles.includes(binding.role)) diagnostics.push({ code: "REFERENCE_CAPACITY", bindingId: binding.bindingId, detail: `the workflow does not take the role ${binding.role}` });
  }
  if (ordered.length > capacity.maxBindings) diagnostics.push({ code: "REFERENCE_CAPACITY", detail: `${ordered.length} references, the workflow takes ${capacity.maxBindings}` });

  const usable = new Map(ordered.map(binding => [binding.bindingId, [...(options.usable?.get(binding.bindingId) ?? binding.images.map(image => image.assetId))]]));
  for (const binding of ordered) {
    if (!usable.get(binding.bindingId)!.length && !diagnostics.some(item => item.bindingId === binding.bindingId && item.code === "REFERENCE_MISSING")) {
      diagnostics.push({ code: "REFERENCE_MISSING", bindingId: binding.bindingId, detail: "no usable picture" });
    }
  }
  const identities = ordered.filter(binding => IDENTITY_ROLES.has(binding.role) && usable.get(binding.bindingId)!.length);
  const scarcest = Math.min(...identities.map(binding => usable.get(binding.bindingId)!.length));
  const views = identities.length <= 1 ? 1 : Math.max(1, Math.min(Math.floor(options.identityViews ?? IDENTITY_VIEWS_DEFAULT), scarcest));

  const orderedAssetIds: string[] = [];
  const slots: CompiledReferences["slots"] = [];
  const owners = new Map<string, string>();
  for (const binding of ordered) {
    const take = IDENTITY_ROLES.has(binding.role) ? views : 1;
    const picked = usable.get(binding.bindingId)!.slice(0, take);
    const imageIndices = picked.map(assetId => {
      let at = orderedAssetIds.indexOf(assetId);
      if (at < 0) { at = orderedAssetIds.length; orderedAssetIds.push(assetId); owners.set(assetId, binding.bindingId); }
      else diagnostics.push({ code: "REFERENCE_SHARED_ASSET", bindingId: binding.bindingId, detail: `shares its picture with ${owners.get(assetId)}` });
      return at;
    });
    slots.push({ bindingId: binding.bindingId, role: binding.role, imageIndices });
  }
  if (orderedAssetIds.length > capacity.maxImages) {
    diagnostics.push({ code: "REFERENCE_CAPACITY", detail: `${orderedAssetIds.length} pictures needed (${views} per character), the workflow takes ${capacity.maxImages}` });
  }
  return { orderedAssetIds, slots, diagnostics };
}

export interface SlotLabel { name: string; description?: string }

/**
 * The prompt lines that name every picture by role. Several identities are told apart and never
 * called the same person; the place, objects and style give no features to anyone.
 * `tag(i)` prints picture i (0-based): « Image 3 », « picture 3 » or « <ref_image_2> ».
 */
export function slotPrompt(compiled: CompiledReferences, bindings: readonly ReferenceBinding[], labels: ReadonlyMap<string, SlotLabel>, tag: (index: number) => string): string {
  const byId = new Map(bindings.map(binding => [binding.bindingId, binding]));
  const range = (indices: readonly number[]) => {
    const names = indices.map(tag);
    return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  };
  const verb = (indices: readonly number[]) => indices.length > 1 ? "show" : "shows";
  const label = (slot: CompiledReferences["slots"][number]) => {
    const item = labels.get(slot.bindingId);
    const name = item?.name.trim() || byId.get(slot.bindingId)?.referenceId || "reference";
    const description = item?.description?.trim();
    return description ? `${name} (${description})` : name;
  };
  const lines: string[] = [];
  const identitySlots = compiled.slots.filter(slot => IDENTITY_ROLES.has(slot.role) && slot.imageIndices.length);
  const entities = new Set(identitySlots.map(slot => byId.get(slot.bindingId)?.entityId ?? slot.bindingId));
  for (const slot of compiled.slots) {
    if (!slot.imageIndices.length) continue;
    const at = range(slot.imageIndices);
    switch (slot.role) {
      case "identity": lines.push(entities.size > 1 ? `${at} ${verb(slot.imageIndices)} only ${label(slot)}.` : `${at} ${verb(slot.imageIndices)} ${label(slot)}.`); break;
      case "appearance": lines.push(`${at} ${verb(slot.imageIndices)} the look of ${label(slot)}.`); break;
      case "costume": lines.push(`${at} ${verb(slot.imageIndices)} the costume, ${label(slot)}, not a person.`); break;
      case "pose": lines.push(`${at} ${verb(slot.imageIndices)} a pose only.`); break;
      case "environment": lines.push(`${at} ${verb(slot.imageIndices)} the place, ${label(slot)}. It gives no features to anyone.`); break;
      case "object": lines.push(`${at} ${verb(slot.imageIndices)} the object, ${label(slot)}.`); break;
      case "style": lines.push(`${at} ${slot.imageIndices.length > 1 ? "give" : "gives"} the visual style only (light, colour, texture), not people or places.`); break;
      case "framing": lines.push(`${at} ${slot.imageIndices.length > 1 ? "guide" : "guides"} the composition only.`); break;
    }
  }
  if (entities.size > 1) lines.push(`These are ${entities.size} different characters: never blend, swap or copy features between them.`);
  return lines.join(" ");
}

/**
 * A collection ties several cards of three pictures to one identity (one character with seven
 * official references). It must be complete before any generation: a missing card refuses the shot,
 * it is never filled by another picture. The list comes from the project, never from code.
 */
export interface IdentityCollection { entityId: string; referenceIds: readonly string[] }

export function checkCollections(bindings: readonly ReferenceBinding[], collections: readonly IdentityCollection[]): CinemaDiagnostic[] {
  const diagnostics: CinemaDiagnostic[] = [];
  for (const collection of collections) {
    const bound = bindings.filter(binding => binding.entityId === collection.entityId);
    if (!bound.length) continue;
    for (const referenceId of collection.referenceIds) {
      const binding = bound.find(item => item.referenceId === referenceId);
      if (!binding || !binding.images.length) diagnostics.push({ code: "REFERENCE_MISSING", field: "collection", detail: `${collection.entityId}: ${referenceId} missing (${collection.referenceIds.length} required)` });
    }
  }
  return diagnostics;
}
