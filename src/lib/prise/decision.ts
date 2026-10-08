// Decision table for one shot. First matching row wins.
// One take graph only: Final is an upscale of the kept take, never a second generation.
// Prices: measured 12.5 (image edit) and 4.3 (H3 R2V). Everything else follows the carte:
// hypothèse when a grid or estimator number exists, inconnu when the carte says GPU ? or inconnu.

import {
  ACTION_STILL,
  CADRAGES,
  CAMERAS,
  CHOISIS,
  ESSAI_DABORD,
  GARDE_CADRE,
  IMAGE_DEJA,
  PAS_MESURE,
  type Cadrage,
  type CameraMove,
} from "./copy.ts";

export type CoutStatut = "mesure" | "hypothese" | "inconnu";
export type Intent = "composer" | "essai" | "tourner";
export type ImageCle = "aucune" | "proposee" | "validee";
export type Paroles = "aucune" | "replique" | "voix-off";
export type ProjectFormat = "16:9" | "9:16";

export interface PlanInput {
  castIds: string[];
  castNames: string[];
  /** True when that person already has a view sheet. Same order as castNames. */
  castPlanche: boolean[];
  speakerName: string;
  decorId: string | null;
  decorName: string;
  decorNote: string;
  cadrage: Cadrage;
  action: string;
  camera: CameraMove;
  duree: 5 | 8;
  paroles: Paroles;
  replique: string;
  enchainer: boolean;
  imageFin: boolean;
  imageCle: ImageCle;
  keyframes: number;
  gesteFilme: boolean;
  prolonger: boolean;
  retoucher: boolean;
  previousKept: boolean;
  hasKeptTake: boolean;
  format: ProjectFormat;
}

export interface Decision {
  row: number;
  intent: Intent;
  graph: string | null;
  /** Second graph when lips are fixed after the take. Never a regeneration. */
  suite: string | null;
  titre: string;
  mots: string;
  pourquoi: string;
  quote: number | null;
  cap: number | null;
  statut: CoutStatut | null;
  enabled: boolean;
  reason: string;
  /** The take itself speaks the line. */
  son: boolean;
}

export const CAP_RATIO = 1.5;
export const QUOTE_IMAGE = 12.5;
export const QUOTE_ESSAI = 4.3;

export const GRAPH = {
  image: "api_nano_banana_2_1_image_edit",
  essai: "video_minimax_h3_r2v",
  geste: "video_wan_animate2",
  suite: "video_minimax_h3_i2v_continuation",
  retouche: "api_flux_video_edit",
  levres: "video_ltx2_3_ia2v",
  resync: "api_sync_so_lip_sync_video",
  fin: "video_ltx2_5_flf2v",
  i2v: "video_minimax_h3_i2v",
  multi: "video_minimax_h3_multiframe_reference",
} as const;

const MOTS: Record<string, string> = {
  [GRAPH.image]: "Tes personnages et ton lieu deviennent une image clé.",
  [GRAPH.essai]: "Tes personnages et ton lieu partent directement en vidéo.",
  [GRAPH.geste]: "Ton personnage refait le mouvement de ta vidéo.",
  [GRAPH.suite]: "La suite part de la dernière image de ta prise.",
  [GRAPH.retouche]: "Ta prise est retouchée, sans être retournée.",
  [GRAPH.levres]: "Le visage dit ta phrase, avec la voix du personnage.",
  [GRAPH.resync]: "Les lèvres sont recalées sur la voix, après la prise.",
  [GRAPH.fin]: "Le modèle invente le mouvement entre ton image de début et ton image de fin.",
  [GRAPH.i2v]: "Ton image clé devient la première image du plan. Caméra et action viennent de tes tuiles.",
  [GRAPH.multi]: "Le plan passe par tes images dans l'ordre.",
};

export function capOf(quote: number): number {
  return Math.round(quote * CAP_RATIO * 100) / 100;
}

export function emptyPlan(format: ProjectFormat = "16:9"): PlanInput {
  return {
    castIds: [],
    castNames: [],
    castPlanche: [],
    speakerName: "",
    decorId: null,
    decorName: "",
    decorNote: "",
    cadrage: "moyen",
    action: "",
    camera: "fixe",
    duree: 5,
    paroles: "aucune",
    replique: "",
    enchainer: false,
    imageFin: false,
    imageCle: "aucune",
    keyframes: 0,
    gesteFilme: false,
    prolonger: false,
    retoucher: false,
    previousKept: false,
    hasKeptTake: false,
    format,
  };
}

export function hasAnchor(plan: PlanInput): boolean {
  return plan.castIds.length > 0 || Boolean(plan.decorId);
}

export function actionForte(action: string): boolean {
  const text = action.trim().toLowerCase();
  return text.length > 0 && text !== ACTION_STILL;
}

function closeUp(cadrage: Cadrage): boolean {
  return cadrage === "gros" || cadrage === "moyen" || cadrage === "americain" || cadrage === "tgp";
}

function priced(row: number, intent: Intent, graph: string | null, suite: string | null, titre: string, pourquoi: string, quote: number | null, statut: CoutStatut | null, enabled: boolean, reason: string, son: boolean): Decision {
  return {
    row,
    intent,
    graph,
    suite,
    titre,
    mots: graph ? (MOTS[graph] ?? titre) : "",
    pourquoi,
    quote,
    cap: quote === null ? null : capOf(quote),
    statut,
    enabled,
    reason,
    son,
  };
}

function off(row: number, intent: Intent, pourquoi: string, reason = pourquoi): Decision {
  return priced(row, intent, null, null, "", pourquoi, null, null, false, reason, false);
}

/** Rows 9–12: the picture already exists. Used alone, and under a line that is spoken later. */
export function sceneRow(plan: PlanInput): 9 | 10 | 11 | 12 {
  if (plan.imageCle === "validee" && plan.imageFin) return 9;
  if (plan.enchainer && plan.previousKept) return 10;
  if (plan.keyframes >= 3 && plan.keyframes <= 6) return 11;
  return 12;
}

const SCENE_GRAPH: Record<9 | 10 | 11 | 12, string> = {
  9: GRAPH.fin,
  10: GRAPH.i2v,
  11: GRAPH.multi,
  12: GRAPH.i2v,
};

const SCENE_TITRE: Record<9 | 10 | 11 | 12, string> = {
  9: "Début et fin",
  10: "Enchaîné",
  11: "Images clés",
  12: "Image clé animée",
};

const SCENE_POURQUOI: Record<9 | 10 | 11 | 12, string> = {
  9: "Tu as fixé le début et la fin : le modèle invente le mouvement entre les deux.",
  10: "Ce plan commence exactement là où le précédent s'arrête.",
  11: "Le plan passe par tes images dans l'ordre.",
  12: "Ton image clé devient la première image du plan. Caméra et action viennent de tes tuiles.",
};

function sceneDecision(plan: PlanInput, intent: Intent): Decision {
  const row = sceneRow(plan);
  return priced(row, intent, SCENE_GRAPH[row], null, SCENE_TITRE[row], SCENE_POURQUOI[row], null, "inconnu", false, PAS_MESURE, false);
}

function speaker(plan: PlanInput): string {
  return plan.speakerName.trim() || plan.castNames[0]?.trim() || "";
}

export function pourquoiLevres(name: string): string {
  const who = name.trim();
  return who ? `Le visage de ${who} dit ta phrase avec sa voix.` : "Le visage dit ta phrase avec sa voix.";
}

/** The take row, once an anchor exists. Null when the shot is not ready to turn. */
export function matchTake(plan: PlanInput): number | null {
  if (!hasAnchor(plan)) return null;
  if (plan.gesteFilme) return 3;
  if (plan.prolonger && plan.hasKeptTake) return 4;
  if (plan.retoucher && plan.hasKeptTake) return 5;
  const replique = plan.paroles === "replique";
  if (replique && closeUp(plan.cadrage) && plan.camera === "fixe") return 6;
  if (replique && (plan.camera !== "fixe" || actionForte(plan.action))) return 7;
  if (plan.paroles === "voix-off" || (replique && plan.cadrage === "large")) return 8;
  if (plan.imageCle !== "validee" && !(plan.keyframes >= 3 && plan.keyframes <= 6)) return null;
  return sceneRow(plan);
}

function takeDecision(plan: PlanInput, intent: Intent): Decision {
  const row = matchTake(plan);
  if (row === 3) {
    return priced(3, intent, GRAPH.geste, null, "Geste filmé", MOTS[GRAPH.geste], null, "inconnu", false, PAS_MESURE, false);
  }
  if (row === 4) {
    return priced(4, intent, GRAPH.suite, null, "Prolonger", MOTS[GRAPH.suite], null, "inconnu", false, PAS_MESURE, false);
  }
  if (row === 5) {
    const quote = Math.round(9.05 * plan.duree * 100) / 100;
    return priced(5, intent, GRAPH.retouche, null, "Retouche", MOTS[GRAPH.retouche], quote, "hypothese", false, PAS_MESURE, false);
  }
  if (row === 6) {
    return priced(6, intent, GRAPH.levres, null, "Réplique", pourquoiLevres(speaker(plan)), null, "inconnu", false, PAS_MESURE, true);
  }
  if (row === 7) {
    const scene = sceneRow(plan);
    return priced(
      7,
      intent,
      SCENE_GRAPH[scene],
      GRAPH.resync,
      "Réplique en mouvement",
      "Les lèvres seront recalées après coup. Attention, c'est cher : ≈ 200 pour 5 s.",
      null,
      "inconnu",
      false,
      PAS_MESURE,
      false,
    );
  }
  if (row === 8) {
    const scene = sceneRow(plan);
    return priced(
      8,
      intent,
      SCENE_GRAPH[scene],
      null,
      "Voix au montage",
      "De loin, on ne lit pas les lèvres : la voix est posée au montage.",
      null,
      "inconnu",
      false,
      PAS_MESURE,
      false,
    );
  }
  if (row === null) return off(0, intent, CHOISIS, plan.imageCle === "proposee" ? GARDE_CADRE : ESSAI_DABORD);
  return sceneDecision(plan, intent);
}

export function decide(plan: PlanInput, intent: Intent): Decision {
  if (!hasAnchor(plan)) return off(0, intent, CHOISIS);
  if (intent === "composer") {
    return priced(
      1,
      intent,
      GRAPH.image,
      null,
      "Image clé",
      "On fixe d'abord le cadre sur une image : 12,5 crédits au lieu d'une vidéo ratée.",
      QUOTE_IMAGE,
      "mesure",
      true,
      "",
      false,
    );
  }
  if (intent === "essai") {
    if (plan.imageCle !== "aucune" || plan.keyframes > 0) {
      return priced(2, intent, GRAPH.essai, null, "Essai rapide", "Pas d'image clé : on donne directement tes personnages et ton lieu au modèle. Plus rapide, cadre moins sûr.", QUOTE_ESSAI, "mesure", false, IMAGE_DEJA, true);
    }
    return priced(
      2,
      intent,
      GRAPH.essai,
      null,
      "Essai rapide",
      "Pas d'image clé : on donne directement tes personnages et ton lieu au modèle. Plus rapide, cadre moins sûr.",
      QUOTE_ESSAI,
      "mesure",
      true,
      "",
      true,
    );
  }
  if (plan.imageCle === "proposee") return off(1, intent, "On fixe d'abord le cadre sur une image : 12,5 crédits au lieu d'une vidéo ratée.", GARDE_CADRE);
  if (plan.imageCle !== "validee" && !plan.gesteFilme && !plan.prolonger && !plan.retoucher && plan.paroles === "aucune") {
    return off(1, intent, "On fixe d'abord le cadre sur une image : 12,5 crédits au lieu d'une vidéo ratée.", ESSAI_DABORD);
  }
  return takeDecision(plan, intent);
}

/** What the card explains: the image first, until the frame is kept. */
export function primaryIntent(plan: PlanInput): Intent {
  if (!hasAnchor(plan)) return "composer";
  if (plan.imageCle === "validee" || plan.gesteFilme || plan.prolonger || plan.retoucher || plan.paroles !== "aucune") return "tourner";
  return "composer";
}

export function isCadrage(value: string): value is Cadrage {
  return (CADRAGES as readonly string[]).includes(value);
}

export function isCamera(value: string): value is CameraMove {
  return (CAMERAS as readonly string[]).includes(value);
}
