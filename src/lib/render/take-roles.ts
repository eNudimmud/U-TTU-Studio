// CE1 slot lines for an LTX take that has two or more characters. The tags follow the picture
// order the take actually sends (clean views, then the place). One character keeps the historical
// text. Nothing here knows a name: the cards bring their own.

import { slotPrompt } from "../cinema/references.ts";
import type { CompiledReferences, ReferenceBinding } from "../cinema/types.ts";

export interface RoleMember {
  id: string;
  name: string;
  description?: string;
  pictures: number;
}

/**
 * The role text for `takeGraphFor(..., roles)`, or undefined when fewer than two characters have
 * a picture. Tags are `<ref_image_i>`, 0-based, in the same order as the pictures.
 */
export function rolesLtx(cast: readonly RoleMember[], place: { id: string; name: string; pictures: number } | null): string | undefined {
  const members = cast.filter(member => member.id && member.pictures > 0);
  if (members.length < 2) return undefined;
  const bindings: ReferenceBinding[] = [];
  const slots: CompiledReferences["slots"] = [];
  const labels = new Map<string, { name: string; description?: string }>();
  const ordered: string[] = [];
  const push = (binding: ReferenceBinding, pictures: number, label: { name: string; description?: string }) => {
    const imageIndices: number[] = [];
    for (let index = 0; index < pictures; index += 1) {
      imageIndices.push(ordered.length);
      ordered.push(`${binding.bindingId}:${index}`);
    }
    bindings.push(binding);
    slots.push({ bindingId: binding.bindingId, role: binding.role, imageIndices });
    labels.set(binding.bindingId, label);
  };
  for (const member of members) {
    push({
      bindingId: `cast:${member.id}`,
      projectId: "shot",
      entityId: member.id,
      referenceId: member.id,
      category: "cast",
      role: "identity",
      images: [],
      required: true,
      locked: false,
    }, member.pictures, { name: member.name, ...(member.description ? { description: member.description } : {}) });
  }
  if (place && place.id && place.pictures > 0) {
    push({
      bindingId: `decor:${place.id}`,
      projectId: "shot",
      entityId: place.id,
      referenceId: place.id,
      category: "decor",
      role: "environment",
      images: [],
      required: true,
      locked: false,
    }, place.pictures, { name: place.name });
  }
  const text = slotPrompt({ orderedAssetIds: ordered, slots, diagnostics: [] }, bindings, labels, index => `<ref_image_${index}>`).trim();
  return text || undefined;
}
