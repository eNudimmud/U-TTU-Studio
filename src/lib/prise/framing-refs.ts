// « Référence de cadrage »: the DÉCOR viewpoints come first, the plan's own set at the top,
// then the cast, then any other image in the project. Pure, so the order is testable.

export type FramingGroup = "decor" | "cast" | "autres";
export type FramingKind = "rendu" | "vue" | "image";

export interface FramingItem { path: string; name: string; kind: FramingKind; n: number }

interface SceneLike { id: string; name: string; render?: string | null; stills: readonly string[]; views: readonly string[]; frames: readonly string[] }
interface CastLike { name: string; sheet?: string | null; photos: readonly string[] }

const IMAGE = /\.(png|jpe?g|webp)$/i;

export function framingGroups(paths: readonly string[], scenes: readonly SceneLike[], cast: readonly CastLike[], decorId: string | null): { group: FramingGroup; items: FramingItem[] }[] {
  const available = new Set(paths.filter(path => IMAGE.test(path)));
  const used = new Set<string>();
  const take = (path: string | null | undefined): boolean => {
    if (!path || !available.has(path) || used.has(path)) return false;
    used.add(path);
    return true;
  };
  const ordered = [...scenes].sort((a, b) => Number(b.id === decorId) - Number(a.id === decorId));
  const decor: FramingItem[] = [];
  for (const scene of ordered) {
    let n = 0;
    if (take(scene.render)) decor.push({ path: scene.render!, name: scene.name, kind: "rendu", n: 0 });
    for (const path of [...scene.views, ...scene.stills, ...scene.frames]) if (take(path)) decor.push({ path, name: scene.name, kind: "vue", n: ++n });
  }
  const people: FramingItem[] = [];
  for (const card of cast) {
    let n = 0;
    for (const path of [card.sheet, ...card.photos]) if (take(path)) people.push({ path: path!, name: card.name, kind: "image", n: ++n });
  }
  const autres: FramingItem[] = [...available].filter(path => !used.has(path)).map(path => ({ path, name: path.split("/").pop() ?? path, kind: "image", n: 0 }));
  return ([["decor", decor], ["cast", people], ["autres", autres]] as const).filter(([, items]) => items.length > 0).map(([group, items]) => ({ group, items: [...items] }));
}
