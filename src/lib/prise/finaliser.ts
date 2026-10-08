// Finaliser raises resolution and sharpness of what was already made.
// It never regenerates the take or the still.

import { FINAL_IMAGE_SENTENCE, FINAL_SENTENCE, PAS_MESURE, QUATRE_K } from "./copy.ts";
import { capOf, type CoutStatut } from "./decision.ts";

export type FinalMedia = "video" | "image";
export type FinalResolution = "1080p" | "4k";

export interface FinaliserInput {
  media: FinalMedia;
  seconds: number;
  resolution: FinalResolution;
  /** Restoration / enhance. On by default. */
  nettete: boolean;
  /** Frame interpolation. Off by default. Video only. */
  fluidifier: boolean;
}

export interface FinalGraph {
  id: string;
  role: string;
  quote: number | null;
  statut: CoutStatut;
  choisi: boolean;
  note: string;
}

export interface FinaliserPlan {
  sentence: string;
  graphs: FinalGraph[];
  graph: string | null;
  quote: number | null;
  cap: number | null;
  statut: CoutStatut | null;
  enabled: boolean;
  reason: string;
  resolution4k: { enabled: false; reason: string };
}

export const FINAL_GRAPH = {
  vcube: "api_bytedance_vcube_video_enhance",
  wavespeedVideo: "api_wavespeed_flshvsr_video_upscale",
  seedvrVideo: "utility_seedvr2_3b_int8_upscale_video",
  frames: "utility_video_frame_interpolation",
  seedvrImage: "utility_seedvr2_7b_int8_upscale_image",
  wavespeedImage: "api_wavespeed_seedvr2_ai_image_fix",
  magnific: "api_magnific_image_upscale_precise",
} as const;

const MOTS: Record<string, string> = {
  [FINAL_GRAPH.vcube]: "La prise est agrandie en 1080p et rendue plus nette, sans être refaite.",
  [FINAL_GRAPH.wavespeedVideo]: "La prise est agrandie en 1080p, sans être refaite.",
  [FINAL_GRAPH.seedvrVideo]: "La prise est restaurée, sans changer le mouvement.",
  [FINAL_GRAPH.frames]: "Des images intermédiaires rendent le mouvement plus fluide.",
  [FINAL_GRAPH.seedvrImage]: "L'image est restaurée, plus nette, sans être refaite.",
  [FINAL_GRAPH.wavespeedImage]: "L'image est agrandie, sans être refaite.",
  [FINAL_GRAPH.magnific]: "L'image gagne en détails, sans être refaite.",
};

export function finaliserDefaults(media: FinalMedia, seconds = 5): FinaliserInput {
  return { media, seconds, resolution: "1080p", nettete: true, fluidifier: false };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** ≈ 2,08 / s, pinned to 10 for 5 s as in the carte. Hypothèse. */
export function vcubeQuote(seconds: number): number {
  if (seconds === 5) return 10;
  return round2(2.08 * seconds);
}

/** ≈ 3,798 / s, pinned to 19 for 5 s. Hypothèse. */
export function wavespeedVideoQuote(seconds: number): number {
  if (seconds === 5) return 19;
  return round2(3.798 * seconds);
}

function row(id: string, role: string, quote: number | null, statut: CoutStatut, choisi: boolean, note: string): FinalGraph {
  return { id, role, quote, statut, choisi, note };
}

export function chooseFinaliser(input: FinaliserInput): FinaliserPlan {
  const sentence = input.media === "image" ? FINAL_IMAGE_SENTENCE : FINAL_SENTENCE;
  const resolution4k = { enabled: false as const, reason: QUATRE_K };
  if (input.resolution === "4k") {
    return {
      sentence,
      graphs: [],
      graph: null,
      quote: null,
      cap: null,
      statut: null,
      enabled: false,
      reason: QUATRE_K,
      resolution4k,
    };
  }

  const graphs: FinalGraph[] = [];
  if (input.media === "video") {
    const enhance = input.nettete;
    graphs.push(row(
      FINAL_GRAPH.vcube,
      "Résolution et netteté",
      vcubeQuote(input.seconds),
      "hypothese",
      enhance,
      enhance ? MOTS[FINAL_GRAPH.vcube] : "Pas choisi : la netteté est coupée, on n'ajoute pas la passe de restauration.",
    ));
    graphs.push(row(
      FINAL_GRAPH.wavespeedVideo,
      "Résolution seule",
      wavespeedVideoQuote(input.seconds),
      "hypothese",
      !enhance,
      enhance ? "Pas choisi : la netteté est demandée, donc on passe par la prise qui restaure aussi." : MOTS[FINAL_GRAPH.wavespeedVideo],
    ));
    graphs.push(row(
      FINAL_GRAPH.seedvrVideo,
      "Restauration ouverte",
      null,
      "inconnu",
      false,
      "Pas choisi : le temps de calcul n'est pas mesuré. La passe par défaut a un devis.",
    ));
    if (input.fluidifier) {
      graphs.push(row(FINAL_GRAPH.frames, "Fluidifier", null, "inconnu", true, MOTS[FINAL_GRAPH.frames]));
    }
  } else {
    graphs.push(row(
      FINAL_GRAPH.seedvrImage,
      "Restauration",
      null,
      "inconnu",
      input.nettete,
      input.nettete ? MOTS[FINAL_GRAPH.seedvrImage] : "Pas choisi : la netteté est coupée.",
    ));
    graphs.push(row(
      FINAL_GRAPH.wavespeedImage,
      "Agrandissement",
      2.11,
      "hypothese",
      !input.nettete,
      input.nettete ? "Pas choisi : la netteté demande la restauration, pas seulement l'agrandissement." : MOTS[FINAL_GRAPH.wavespeedImage],
    ));
    graphs.push(row(
      FINAL_GRAPH.magnific,
      "Détails",
      35.91,
      "hypothese",
      false,
      "Pas choisi par défaut : réservé au détail fin, environ 35,91. La restauration ouverte passe d'abord.",
    ));
  }

  const chosen = graphs.filter(item => item.choisi);
  const unknown = chosen.some(item => item.statut === "inconnu" || item.quote === null);
  const quote = unknown ? null : chosen.reduce((sum, item) => sum + (item.quote ?? 0), 0);
  const statut: CoutStatut | null = chosen.length === 0 ? null : unknown ? "inconnu" : chosen.every(item => item.statut === "hypothese") ? "hypothese" : "inconnu";
  const graph = chosen[0]?.id ?? null;
  return {
    sentence,
    graphs,
    graph,
    quote,
    cap: quote === null ? null : capOf(quote),
    statut,
    enabled: false,
    reason: PAS_MESURE,
    resolution4k,
  };
}

export function finalMots(id: string | null): string {
  return id ? (MOTS[id] ?? "") : "";
}
