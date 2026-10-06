import { isPlaceLora, type Lora, type Scene, type TakeEngine } from "./coffre/model.ts";

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

/** Named places, in vault order. The camera flag is the saved path, not a default. */
export function decorShelf(scenes: readonly Pick<Scene, "id" | "name" | "camera">[]): DecorEntry[] {
  return scenes.map(scene => ({
    id: scene.id,
    name: scene.name.trim() || "Sans nom",
    camera: scene.camera !== null,
  }));
}
