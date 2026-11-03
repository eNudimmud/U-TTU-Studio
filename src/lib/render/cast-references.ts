// Which pictures each CAST card sends to a take, and how the text names them.
// Clean photo views go before any multi-view sheet; a sheet is sent only when
// the card has no clean view (a pasted sheet otherwise gets collaged into the
// shot). With several characters every one gets the same number of pictures,
// so no identity outweighs another. Generic: nothing here knows a name.

export interface CastRefCard {
  name: string;
  prompt?: string;
  photos: readonly string[];
  sheet: string | null;
}

export interface CastGroup {
  name: string;
  pictures: number;
  description: string;
}

export interface CastReferences {
  photos: string[];
  groups: CastGroup[];
}

/** Views per character when several share a take (issue #212: 1–2, balanced). */
export const CAST_VIEWS_MAX = 2;

function cleanViews(card: CastRefCard): string[] {
  const photos = [...new Set(card.photos.filter(path => path.length > 0 && path !== card.sheet))];
  if (photos.length) return photos;
  return card.sheet ? [card.sheet] : [];
}

const BOILERPLATE = /\b(full body|neutral light|plain background|no people)\b[^.]*\.?/gi;

/** One short line from the card's own sheet text: what the character is. */
export function castDescription(card: Pick<CastRefCard, "name" | "prompt">): string {
  let text = (card.prompt ?? "").replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  const name = card.name.trim();
  if (name && text.toLowerCase().startsWith(name.toLowerCase())) text = text.slice(name.length).replace(/^\s*[:,–—-]\s*/, "");
  // A card made from a shot line only carries the shot, not who the character is.
  if (/^the character of this film shot\b/i.test(text)) return "";
  text = text.replace(BOILERPLATE, " ").replace(/\s+/g, " ").trim();
  const first = text.split(/(?<=[.!?])\s/)[0] ?? "";
  return first.replace(/[.!?…]+$/, "").slice(0, 120).trim();
}

export function castReferences(cards: readonly CastRefCard[], perCharacter = CAST_VIEWS_MAX): CastReferences {
  const views = cards.map(cleanViews);
  const available = views.filter(list => list.length > 0).map(list => list.length);
  const cap = cards.length <= 1
    ? 1
    : Math.max(1, Math.min(Math.max(1, Math.floor(perCharacter)), ...(available.length ? available : [1])));
  const photos: string[] = [];
  const groups = cards.map((card, index) => {
    const picked = views[index].filter(path => !photos.includes(path)).slice(0, cap);
    photos.push(...picked);
    return { name: card.name.trim(), pictures: picked.length, description: castDescription(card) };
  });
  return { photos, groups };
}
