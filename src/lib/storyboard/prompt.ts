// « What will be sent » for one shot: the framing in English, then the action with the camera and the
// words said (film2's ligneDuPlan), then the continuity note. The visitor may replace it (promptManuel).

import { ligneDuPlan } from "../film/reglages.ts";
import type { Cadrage, PlanSB } from "./storyboard.ts";

const CADRAGE_EN: Record<Cadrage, string> = {
  large: "Wide shot.",
  moyen: "Medium shot.",
  serre: "Close-up.",
  detail: "Detail shot.",
};

export const RACCORD_EN = "Same characters, same place and same light as the previous shot.";

export function promptCalcule(plan: Pick<PlanSB, "action" | "cadrage" | "camera" | "dialogue" | "raccord">): string {
  const ligne = ligneDuPlan(plan.action, { camera: plan.camera, paroles: plan.dialogue.type, texte: plan.dialogue.texte });
  return [plan.cadrage ? CADRAGE_EN[plan.cadrage] : "", ligne, plan.raccord ? RACCORD_EN : ""].filter(Boolean).join(" ").trim();
}

/** The text sent for the take: the visitor's own when they wrote one. */
export function promptDuPlan(plan: Pick<PlanSB, "action" | "cadrage" | "camera" | "dialogue" | "raccord" | "promptManuel">): string {
  return plan.promptManuel?.trim() ? plan.promptManuel.trim().slice(0, 600) : promptCalcule(plan);
}
