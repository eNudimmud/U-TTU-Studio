// The jobs the studio can already run, written as cards. A fiche names the
// gesture, what it needs, and where the price is read. It never describes a
// graph, and it never becomes a charge by itself.

import { COMFY_CLOUD } from "./comfy-stack.ts";
import { CLIPS_MIN } from "./lora/dataset.ts";
import { PLACE_SHOTS_MIN } from "./lora/place.ts";
import { FAL_PUBLISHED, formatUsd, type LoraResolution } from "./fal/prices.ts";

export type FicheId = "references" | "personnage" | "former" | "lieu" | "image";
export type FichePayer = "rendu" | "fal";
export type FicheDest = "prise" | "lora" | "scene";
export type FicheFocus = "file" | "vues" | "image" | null;

export interface WorkflowFiche {
  id: FicheId;
  name: string;
  sentence: string;
  inputs: readonly string[];
  cost: string;
  payer: FichePayer;
  dest: FicheDest;
  /** The take engine Lancer selects. Formation and place images leave it alone. */
  engine: "comfy" | "lora" | null;
  focus: FicheFocus;
}

export interface FicheQuotes {
  /** The live line from the render account, or null before that account is linked. */
  rendu: string | null;
  /** A live amount for the personnage take, already formatted, or null. */
  personnage: string | null;
  /** A live amount for forming a character, already formatted, or null. */
  former: string | null;
  /** A live amount for forming a place, already formatted, or null. */
  lieu: string | null;
  /** A live amount for a new image of a place, already formatted, or null. */
  image: string | null;
}

const unread = "Le prix se lit sur le compte fal, avant le geste. Rien n’est débité ici.";

function liveOrExample(live: string | null, example: string): string {
  return live ? `${live}, lu sur le compte fal.` : example;
}

/** Five wired jobs. Anything else is not a fiche. */
export function workflowFiches(quotes: FicheQuotes, sample: { seconds: number; resolution: LoraResolution; steps: number }): readonly WorkflowFiche[] {
  const rate = String(COMFY_CLOUD.gpuCreditsPerSecond).replace(".", ",");
  const takeExample = FAL_PUBLISHED.takePerSecond[sample.resolution] * sample.seconds;
  const formExample = FAL_PUBLISHED.trainerPerStep * sample.steps;
  return [
    {
      id: "references",
      name: "Prise · Références",
      sentence: "Les photos du coffre deviennent une prise, avec le son.",
      inputs: ["Deux photos, un nom, deux traits", "Un lieu", "Une phrase", "La durée et le format"],
      cost: quotes.rendu ?? `Exemple · ${rate} crédit par seconde de calcul, sur le compte de rendu. Rien n’est débité ici.`,
      payer: "rendu",
      dest: "prise",
      engine: "comfy",
      focus: null,
    },
    {
      id: "personnage",
      name: "Prise · Personnage",
      sentence: "Le fichier du coffre tient le personnage, d’une prise à l’autre.",
      inputs: ["Un fichier de personnage", "Les photos du coffre", "Un lieu", "Une phrase"],
      cost: liveOrExample(
        quotes.personnage,
        `Exemple · ${formatUsd(takeExample)} pour ${sample.seconds} s. Le prix du compte fal le remplace après Relier. Rien n’est débité ici.`,
      ),
      payer: "fal",
      dest: "prise",
      engine: "lora",
      focus: null,
    },
    {
      id: "former",
      name: "Former un personnage",
      sentence: "Des clips deviennent un fichier. Les prises suivantes le rechargent.",
      inputs: ["Un nom", "Deux photos", `${CLIPS_MIN} clips`],
      cost: liveOrExample(
        quotes.former,
        `Exemple · ${formatUsd(formExample)} pour ${sample.steps} pas, tarif publié le ${FAL_PUBLISHED.checkedOn}. Rien n’est débité ici.`,
      ),
      payer: "fal",
      dest: "lora",
      engine: null,
      focus: "file",
    },
    {
      id: "lieu",
      name: "Former un lieu",
      sentence: "Les vues du lieu deviennent un fichier d’images. Ce n’est pas un volume.",
      inputs: ["Un lieu nommé", `${PLACE_SHOTS_MIN} vues`],
      cost: liveOrExample(quotes.lieu, unread),
      payer: "fal",
      dest: "scene",
      engine: null,
      focus: "vues",
    },
    {
      id: "image",
      name: "Image d’un lieu",
      sentence: "Le fichier du lieu bâtit une image neuve. Le modèle 3D reste le fichier Blender.",
      inputs: ["Un lieu déjà formé"],
      cost: liveOrExample(quotes.image, unread),
      payer: "fal",
      dest: "scene",
      engine: null,
      focus: "image",
    },
  ];
}
