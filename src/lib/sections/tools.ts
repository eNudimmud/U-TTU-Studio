import type { Step } from "./registry.ts";
import {
  outilEtat,
  outilParId,
  outilPartenaire,
  type Entree,
} from "../outils/catalogue.ts";
import { outilGraph, outilQuote } from "../outils/graphs.ts";
import { noeudSortie } from "../render/sortie.ts";
import type { OutilAspect, OutilCamera } from "../outils/generique.ts";

// The two sections share these qualified tools. Generation and finishing have their own bindings.
const inventory: Partial<Record<Step, readonly [string, string][]>> = {
  cast: [
    ["ret-angles-perso", "Planche de vues"],
    ["ret-eclairer-ouvert", "Changer la lumière"],
    ["ret-detourer", "Détourer"],
    ["3d-ouvert", "Créer un volume"],
  ],
  set: [
    ["img-croquis", "Depuis un croquis"],
    ["img-360", "Panorama 360°"],
    ["ret-angles-decor", "Angles et heures"],
    ["3d-ouvert", "Créer un volume"],
  ],
  shoot: [
    ["vid-h3-refs", "Prise avec références"],
    ["vid-fasth3", "Brouillon rapide"],
    ["vid-multi", "Plusieurs images clés"],
    ["vid-texte", "Vidéo depuis un texte"],
    ["vid-raccord", "Raccorder deux cadres"],
    ["vid-transition-style", "Transition de style"],
    ["vid-mouvement", "Copier un mouvement"],
    ["vid-effacer", "Effacer dans un plan"],
    ["vid-prolonger", "Prolonger une prise"],
  ],
  edit: [
    ["ret-modifier", "Modifier une image"],
    ["ret-elargir", "Élargir une image"],
    ["vid-parler", "Faire parler"],
    ["son-voix-ouverte", "Voix"],
    ["son-musique-ouverte", "Musique"],
    ["son-bruitage-ouvert", "Bruitages"],
    ["son-separer", "Séparer les pistes"],
  ],
};
export interface ToolSettings {
  id: string;
  step: Step;
  inputs: Partial<Record<Entree, string>>;
  aspect: OutilAspect;
  camera?: OutilCamera;
  stem?: "voix" | "musique";
  seconds?: number;
  voiceConsent?: boolean;
}
export function sectionTools(step: Step) {
  return (inventory[step] || []).flatMap(([id, title]) => {
    const tool = outilParId(id);
    if (
      !tool ||
      outilPartenaire(tool) ||
      outilEtat(tool, { openWeightsOnly: true }).kind !== "pret"
    )
      return [];
    return [{ tool, title }];
  });
}
export function qualifiedTool(settings: ToolSettings) {
  const found = sectionTools(settings.step).find(
    (entry) => entry.tool.id === settings.id,
  );
  if (!found)
    throw new Error("Cet outil n’est pas disponible dans cette étape.");
  if (
    found.tool.consentement &&
    settings.inputs.audio &&
    !settings.voiceConsent
  )
    throw new Error("Confirme que tu peux utiliser cette voix.");
  return found.tool;
}
export function buildTool(
  settings: ToolSettings,
  uploaded: Partial<Record<Entree, string>>,
  prompt: string,
  seed: number,
) {
  const tool = qualifiedTool(settings);
  const quote = outilQuote(tool, { seconds: settings.seconds, mesh: "objet" });
  if (!quote) throw new Error("Le devis de cet outil n’est pas disponible.");
  const graph = outilGraph(tool, {
    files: {
      images: [uploaded.image, uploaded.image2].filter(
        (value): value is string => Boolean(value),
      ),
      video: uploaded.video,
      audio: uploaded.audio,
    },
    prompt,
    seed,
    seconds: settings.seconds,
    aspect: settings.aspect,
    camera: settings.camera,
    mesh: "objet",
    piste: settings.stem,
    elargir: settings.aspect === "vertical" ? "9:16" : "16:9",
  });
  const outputNode = noeudSortie(graph, tool.template);
  if (!outputNode)
    throw new Error("L’outil n’a pas de sortie finale identifiable.");
  return {
    graph,
    template: tool.template,
    outputNode,
    media: tool.sortie,
    quote,
    lot: tool.lot || 1,
  };
}
