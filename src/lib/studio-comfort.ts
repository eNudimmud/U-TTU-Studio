import { isPlaceLora, type Lora, type Scene, type TakeEngine } from "./coffre/model.ts";
import { formatUsd } from "./fal/prices.ts";

/** Engines the take can actually run. Anything else is refused. */
export const WIRED_ENGINES: readonly { id: TakeEngine; label: string }[] = [
  { id: "comfy", label: "Références" },
  { id: "lora", label: "Personnage" },
];

export function pickEngine(value: string): TakeEngine | null {
  return WIRED_ENGINES.some(engine => engine.id === value) ? value as TakeEngine : null;
}

export interface CastMember {
  id: string;
  name: string;
}

export interface DecorEntry {
  id: string;
  name: string;
  /** True when this place reopens with a camera already stored. */
  camera: boolean;
}

/** Named characters only. A place file is a décor, not a cast member. */
export function castShelf(loras: readonly Pick<Lora, "id" | "name" | "kind">[]): CastMember[] {
  return loras.filter(lora => !isPlaceLora(lora)).map(lora => ({
    id: lora.id,
    name: lora.name.trim() || "Personnage",
  }));
}

export interface CharacterPath {
  id: "references" | "fichier";
  title: string;
  body: string;
  action: string;
}

/**
 * The two ways to hold a character. References send photos on each take.
 * The file is trained once on fal. A missing live quote never becomes a number.
 */
export function characterPaths(input: { falLinked: boolean; quote: number | null; steps: number }): readonly [CharacterPath, CharacterPath] {
  const price = !input.falLinked
    ? "Il faut relier le compte fal. Le prix s’affiche alors, avant tout débit."
    : input.quote === null
      ? "Le prix se lit sur le compte fal, avant le geste."
      : `Formation : ${formatUsd(input.quote)} pour ${input.steps} pas, lu sur le compte fal.`;
  return [
    {
      id: "references",
      title: "Références",
      body: "Deux photos, un nom, deux traits. Rien à former. Chaque prise « Références » paie le compte de rendu, au prix lu au moment de tourner.",
      action: "Tenir les photos",
    },
    {
      id: "fichier",
      title: "Fichier",
      body: `Dix clips. On forme un fichier, une fois. ${price} 2000 pas coûtent le double de 1000. Les prises « Personnage » rechargent ce fichier, et se paient à part, sur le compte fal.`,
      action: "Former un fichier",
    },
  ];
}

/** Named places, in vault order. The camera flag is the saved path, not a default. */
export function decorShelf(scenes: readonly Pick<Scene, "id" | "name" | "camera">[]): DecorEntry[] {
  return scenes.map(scene => ({
    id: scene.id,
    name: scene.name.trim() || "Sans nom",
    camera: scene.camera !== null,
  }));
}
