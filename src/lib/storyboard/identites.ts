// CE5-L · the project's identities as the writer and the native agent read them (data only, no layout).
//
// Every CAST card takes part, with or without a picture, and so does every reference classed CAST: that an
// identity exists and that its pictures are ready are two different states. Entries are merged by ID only;
// two different IDs with the same name are never merged: the name is ambiguous and asks for clarification,
// it is neither linked nor created again. CAST and DÉCOR stay two separate lists.

import type { KnownName } from "../intention/resolve.ts";

export interface CardLike { id: string; name: string; sheet?: string | null; photos?: readonly string[] }
export interface SceneLike { id: string; name: string }
export interface ReferenceLike { id: string; name: string; category: string; images?: readonly string[] }

export interface Identities {
  /** Univocal names, by ID. */
  known: KnownName[];
  /** IDs whose pictures are usable for a render (a card without picture still exists). */
  ready: string[];
  /** Folded names held by two or more IDs: clarification, never a guess, never a new identity. */
  ambiguous: string[];
}

export interface Catalogue { cast: Identities; decor: Identities }

export const foldName = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

function identities(entries: readonly { id: string; name: string; ready: boolean }[]): Identities {
  const byId = new Map<string, { id: string; name: string; ready: boolean }>();
  for (const entry of entries) {
    const name = entry.name.replace(/\s+/g, " ").trim();
    if (!entry.id || !name) continue;
    const seen = byId.get(entry.id);
    byId.set(entry.id, seen ? { ...seen, ready: seen.ready || entry.ready } : { id: entry.id, name, ready: entry.ready });
  }
  const byName = new Map<string, string[]>();
  for (const entry of byId.values()) byName.set(foldName(entry.name), [...(byName.get(foldName(entry.name)) ?? []), entry.id]);
  const ambiguous = [...byName].filter(([, ids]) => ids.length > 1).map(([name]) => name).sort();
  const all = [...byId.values()];
  return {
    known: all.filter(entry => !ambiguous.includes(foldName(entry.name))).map(entry => ({ id: entry.id, name: entry.name })),
    ready: all.filter(entry => entry.ready).map(entry => entry.id),
    ambiguous,
  };
}

/** CAST cards (all of them) + references classed CAST; DÉCOR cards + references classed DÉCOR. */
export function catalogue(cards: readonly CardLike[], scenes: readonly SceneLike[], references: readonly ReferenceLike[]): Catalogue {
  return {
    cast: identities([
      ...cards.map(card => ({ id: card.id, name: card.name, ready: Boolean(card.sheet) || (card.photos?.length ?? 0) > 0 })),
      ...references.filter(ref => ref.category === "cast").map(ref => ({ id: ref.id, name: ref.name, ready: (ref.images?.length ?? 0) > 0 })),
    ]),
    decor: identities([
      ...scenes.map(scene => ({ id: scene.id, name: scene.name, ready: true })),
      ...references.filter(ref => ref.category === "decor").map(ref => ({ id: ref.id, name: ref.name, ready: (ref.images?.length ?? 0) > 0 })),
    ]),
  };
}

/** The writer's context: univocal names only; ambiguous ones are listed so nothing is created for them. */
export function contexteDuCatalogue(cat: Catalogue): { cast: KnownName[]; decor: KnownName[]; ambigus: string[] } {
  return { cast: cat.cast.known, decor: cat.decor.known, ambigus: [...cat.cast.ambiguous, ...cat.decor.ambiguous] };
}

/** The native agent's references: one per ID, category kept, homonyms included so the model must clarify. */
export function referencesDuCatalogue(cards: readonly CardLike[], scenes: readonly SceneLike[], references: readonly ReferenceLike[]) {
  const out = new Map<string, { referenceId: string; category: "cast" | "decor"; name: string; locked: boolean }>();
  const add = (id: string, category: "cast" | "decor", name: string) => {
    const key = `${category}:${id}`;
    if (id && name.trim() && !out.has(key)) out.set(key, { referenceId: id, category, name: name.trim(), locked: false });
  };
  for (const card of cards) add(card.id, "cast", card.name);
  for (const ref of references) if (ref.category === "cast") add(ref.id, "cast", ref.name);
  for (const scene of scenes) add(scene.id, "decor", scene.name);
  for (const ref of references) if (ref.category === "decor") add(ref.id, "decor", ref.name);
  return [...out.values()];
}
