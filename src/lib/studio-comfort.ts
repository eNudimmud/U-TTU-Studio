import { COMFY_CLOUD } from "./comfy-stack.ts";
import { isPlaceLora, type Lora, type Scene, type Take, type TakeEngine } from "./coffre/model.ts";
import { FAL_PUBLISHED, formatUsd, type LoraResolution } from "./fal/prices.ts";

export interface WiredEngine {
  id: TakeEngine;
  /** Short name on the picker. */
  label: string;
  /** The model this button actually runs. An unwired name is not listed. */
  model: string;
  detail: string;
  /** What this engine does with sound. There is no separate mute switch. */
  sound: string;
}

/** Engines the take can actually run. Anything else is refused. */
export const WIRED_ENGINES: readonly WiredEngine[] = [
  {
    id: "comfy",
    label: "Références",
    model: "MiniMax H3",
    detail: "Les photos du coffre partent à chaque prise.",
    sound: "Le son est dans la prise.",
  },
  {
    id: "lora",
    label: "Personnage",
    model: "MiniMax H3",
    detail: "Le fichier du coffre tient le personnage.",
    sound: "Le son n’est pas un réglage de ce fichier.",
  },
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

/** The character a Personnage take loads. Never a place file. An empty or stale pick uses the first character. */
export function castFile<T extends Pick<Lora, "id" | "kind">>(loras: readonly T[], pickId: string | null): T | null {
  const people = loras.filter(lora => !isPlaceLora(lora));
  if (pickId) {
    const chosen = people.find(lora => lora.id === pickId);
    if (chosen) return chosen;
  }
  return people[0] ?? null;
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
      body: "Deux photos au moins, trois au plus, un nom, deux traits. Rien à former. Chaque prise « Références » paie le compte de rendu, au prix lu au moment de tourner.",
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

/** A walkthrough the visitor can read before any account exists. The numbers are published tariffs, not a charge. */
export const SAMPLE_TAKE = {
  who: "Mira",
  place: "Le quai, la nuit",
  line: "Elle traverse le quai sous la pluie, sans se retourner.",
  aspect: "9:16",
  seconds: 5,
} as const;

/** A short price on each engine card. A live amount replaces the example only for the engine that was quoted. */
export function engineMark(input: { id: TakeEngine; seconds: number; resolution: LoraResolution; live: string | null }): string {
  if (input.live) return input.live;
  if (input.id === "lora") {
    const usd = FAL_PUBLISHED.takePerSecond[input.resolution] * input.seconds;
    return `Exemple · ${formatUsd(usd)}`;
  }
  const rate = String(COMFY_CLOUD.gpuCreditsPerSecond).replace(".", ",");
  return `Exemple · ${rate} crédit/s`;
}

/** Example price for the open take. A linked account replaces it with the live quote. */
export function exampleTakeQuote(input: { engine: TakeEngine; seconds: number; resolution: LoraResolution }): string {
  if (input.engine === "lora") {
    const usd = FAL_PUBLISHED.takePerSecond[input.resolution] * input.seconds;
    return `Exemple, tarif publié le ${FAL_PUBLISHED.checkedOn} : ${formatUsd(usd)} pour ${input.seconds} s en ${input.resolution}. Le prix de ton compte le remplace après Relier. Rien n’est débité ici.`;
  }
  const rate = String(COMFY_CLOUD.gpuCreditsPerSecond).replace(".", ",");
  return `Exemple pour ${input.seconds} s : ${rate} crédit par seconde de calcul, publié le ${COMFY_CLOUD.checkedOn}. 1 $ = ${COMFY_CLOUD.creditsPerUsd} crédits. Le chiffre de cette prise se lit après Relier. Rien n’est débité ici.`;
}

/** The names chosen on La prise, written in front of the action sentence. */
export function weaveBrief(input: { who: string; place: string; action: string }): string {
  const head = [input.who.trim(), input.place.trim()].filter(Boolean).join(" · ");
  const action = input.action.trim();
  const woven = !head ? action : !action ? `${head}.` : `${head}. ${action}`;
  return woven.length <= 240 ? woven : woven.slice(0, 240).trim();
}

/** The action sentence, once a previous cast and place prefix has been lifted off. */
export function briefAction(line: string, who: string, place: string): string {
  const prefix = weaveBrief({ who, place, action: "" });
  const trimmed = line.trim();
  if (!prefix) return trimmed;
  if (trimmed === prefix) return "";
  if (trimmed.startsWith(`${prefix} `)) return trimmed.slice(prefix.length).trim();
  return trimmed;
}

export interface PriseGap {
  id: "photos" | "scene" | "fichier";
  text: string;
  action: string;
}

/** What is still missing on La prise. Relier is the one gold entry, not another row. */
export function priseGaps(input: { lookReady: boolean; hasScene: boolean; engine: TakeEngine; hasCharacter: boolean }): PriseGap[] {
  const gaps: PriseGap[] = [];
  if (!input.lookReady) gaps.push({ id: "photos", text: "Il manque deux photos, un nom et deux traits.", action: "Tenir les photos" });
  if (!input.hasScene) gaps.push({ id: "scene", text: "Il manque un lieu.", action: "Poser la scène" });
  if (input.engine === "lora" && !input.hasCharacter) gaps.push({ id: "fichier", text: "Le moteur Personnage attend un fichier formé.", action: "Former le personnage" });
  return gaps;
}

export interface PriseAction {
  id: "relier" | "photos" | "scene" | "fichier" | "bloque" | "tourner";
  label: string;
  hint: string;
}

/**
 * The gold button on La prise. Without an account it only opens Relier.
 * A paid turn waits until the photos, the place, and the quote allow it.
 */
export function priseAction(input: {
  engine: TakeEngine;
  falLinked: boolean;
  connected: boolean;
  lookReady: boolean;
  hasScene: boolean;
  hasCharacter: boolean;
  canSpend: boolean;
  price: string | null;
}): PriseAction {
  const priced = input.price ? `Tourner · ${input.price}` : "Tourner";
  const accountMissing = input.engine === "lora" ? !input.falLinked : !input.connected;
  if (accountMissing) return { id: "relier", label: "Relier", hint: "" };
  if (!input.lookReady) return { id: "photos", label: "Tenir les photos", hint: "Il manque deux photos, un nom et deux traits." };
  if (!input.hasScene) return { id: "scene", label: "Poser la scène", hint: "Il manque un lieu." };
  if (input.engine === "lora" && !input.hasCharacter) return { id: "fichier", label: "Former le personnage", hint: "Il manque un fichier de personnage." };
  if (!input.canSpend) return { id: "bloque", label: priced, hint: "Le prix ou le solde ne laisse pas partir la prise." };
  return { id: "tourner", label: priced, hint: "" };
}

export interface ProjetPrise {
  id: string;
  line: string;
}

export interface VueProjet {
  lieu: string;
  personnages: string[];
  prises: ProjetPrise[];
}

type ProjetTake = Pick<Take, "id" | "sceneId" | "line" | "engine" | "loraId">;
type ProjetLora = Pick<Lora, "id" | "name" | "kind">;

/**
 * One open place, with the characters and takes that belong to it.
 * A place file is never a character. Reference takes use the look’s name.
 */
export function vueProjet(input: {
  scene: Pick<Scene, "id" | "name">;
  takes: readonly ProjetTake[];
  loras: readonly ProjetLora[];
  lookName: string;
}): VueProjet {
  const lieu = input.scene.name.trim() || "Sans nom";
  const prises = input.takes.filter(take => take.sceneId === input.scene.id);
  const personnages: string[] = [];
  const seen = new Set<string>();
  const push = (name: string) => {
    const clean = name.trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    personnages.push(clean);
  };
  for (const take of prises) {
    if (take.engine === "lora" && take.loraId) {
      const file = input.loras.find(lora => lora.id === take.loraId);
      if (!file) push("Personnage");
      else if (!isPlaceLora(file)) push(file.name.trim() || "Personnage");
    } else if (take.engine === "comfy") {
      push(input.lookName.trim() || "Références");
    }
  }
  return {
    lieu,
    personnages,
    prises: prises.map(take => ({ id: take.id, line: take.line.trim() || "Prise" })),
  };
}

/** Named places, in vault order. The camera flag is the saved path, not a default. */
export function decorShelf(scenes: readonly Pick<Scene, "id" | "name" | "camera">[]): DecorEntry[] {
  return scenes.map(scene => ({
    id: scene.id,
    name: scene.name.trim() || "Sans nom",
    camera: scene.camera !== null,
  }));
}
