// Gallery cards for CAST and DÉCOR. Pure moves: rename, copy, drop, pick for PRISE.

export const VIEW_NAMES = ["face", "trois-quarts", "profil", "pied"] as const;
export type ViewName = (typeof VIEW_NAMES)[number];

export interface CastCard {
  id: string;
  name: string;
  at: string;
  prompt: string;
  source: "texte" | "photos";
  photos: string[];
  /** The view sheet, when a picture is already on the device. */
  sheet: string | null;
  /** Public example, only for the preview gallery. Not a vault file. */
  preview: string | null;
  status: "pret";
  template: string;
  quote: number;
  cost: number | null;
  engine: "comfy";
  /** Studio gesture id, when the card was made from one. */
  geste?: string;
}

export interface DecorCard {
  id: string;
  name: string;
  prompt: string;
  sheet: string | null;
  preview: string | null;
  status: "pret";
  geste?: string;
}

const NAME_MAX = 40;

export function cleanCardName(value: string): string {
  return value.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

export function renameById<T extends { id: string; name: string }>(cards: readonly T[], id: string, name: string): T[] {
  const next = cleanCardName(name);
  if (!next) return [...cards];
  return cards.map(card => (card.id === id ? { ...card, name: next } : card));
}

export function dropById<T extends { id: string }>(cards: readonly T[], id: string): T[] {
  return cards.filter(card => card.id !== id);
}

export function decorFromScene(scene: {
  id: string;
  name: string;
  note?: string;
  prompt?: string;
  render?: string | null;
  stills?: readonly string[];
  geste?: string;
}): DecorCard {
  return {
    id: scene.id,
    name: scene.name,
    prompt: scene.prompt || scene.note || "",
    sheet: scene.render || scene.stills?.[0] || null,
    preview: null,
    status: "pret",
    geste: scene.geste,
  };
}

export function copyDecor(card: DecorCard, id: string): DecorCard {
  const name = cleanCardName(`${card.name} copie`) || "Copie";
  return { ...card, id, name };
}

export function copyCast(card: CastCard, id: string, at: string): CastCard {
  const name = cleanCardName(`${card.name} copie`) || "Copie";
  return { ...card, id, name, at, cost: null, photos: [...card.photos] };
}

export interface PrisePick {
  who: CastCard | null;
  where: DecorCard | null;
  ready: boolean;
}

/** PRISE reads the galleries. A card that is not there cannot be chosen. */
export function prisePick(input: {
  castId: string | null;
  decorId: string | null;
  cast: readonly CastCard[];
  decor: readonly DecorCard[];
}): PrisePick {
  const who = input.castId ? input.cast.find(card => card.id === input.castId) ?? null : null;
  const where = input.decorId ? input.decor.find(card => card.id === input.decorId) ?? null : null;
  return { who, where, ready: Boolean(who && where) };
}

export function castAsDecorReady(card: CastCard): boolean {
  return card.status === "pret" && card.name.trim().length > 0;
}
