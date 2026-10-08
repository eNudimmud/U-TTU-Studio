// The text the app sends. The visitor reads it only under Détails › Texte envoyé.
// English scaffold, French lines kept in quotes. No negative prompt, no seed, no node.

import { ACTION_EXAMPLES, ACTION_STILL, type Cadrage, type CameraMove } from "./copy.ts";
import { GRAPH, type Decision, type PlanInput } from "./decision.ts";

const CADRAGE_EN: Record<Cadrage, string> = {
  large: "wide shot, full figure",
  moyen: "medium shot, waist up",
  americain: "cowboy shot, mid-thigh up",
  gros: "close-up on the face",
  tgp: "extreme close-up",
  plongee: "high angle shot",
  contre: "low angle shot",
  epaule: "over-the-shoulder shot",
};

const CAMERA_EN: Record<CameraMove, string> = {
  fixe: "static camera, locked-off",
  "travelling-avant": "slow dolly in",
  "travelling-arriere": "slow dolly out",
  panoramique: "slow pan",
  suivi: "tracking shot following the subject",
  orbite: "camera orbits around the subject",
  epaule: "handheld camera, slight shake",
};

const ACTION_EN: Record<string, string> = {
  "marche vers la caméra": "walks toward the camera",
  "se retourne": "turns around",
  "regarde au loin": "looks into the distance",
  "s'arrête": "stops",
  "tend la main": "reaches out a hand",
  "baisse les yeux": "lowers their eyes",
};

export type ReferenceGrammar = "picture" | "words";

/** H3 open templates tag pictures. Other graphs have no verified tag: name them in words. */
export function referenceGrammar(graph: string | null): ReferenceGrammar {
  if (graph && graph.startsWith("video_minimax_h3")) return "picture";
  return "words";
}

function tag(index: number, grammar: ReferenceGrammar): string {
  return grammar === "picture" ? `<Picture ${index}>` : `image ${index}`;
}

function actionEn(action: string): string {
  const key = action.trim().toLowerCase();
  if (!key || key === ACTION_STILL) return "stands still and breathes";
  return ACTION_EN[key] ?? action.trim();
}

export interface BuiltPrompt {
  text: string;
  grammar: ReferenceGrammar;
}

export function buildPrompt(plan: PlanInput, decision: Pick<Decision, "graph" | "son">): BuiltPrompt {
  const grammar = referenceGrammar(decision.graph);
  const refs: string[] = [];
  const names = plan.castNames.slice(0, 3);
  names.forEach((name, index) => {
    const sheet = plan.castPlanche[index] ? " (portrait + planche)" : "";
    refs.push(`${tag(index + 1, grammar)} = ${name}${sheet}`);
  });
  const placeIndex = names.length + 1;
  if (plan.decorName.trim()) refs.push(`${tag(placeIndex, grammar)} = ${plan.decorName.trim()}`);

  const who = names.length > 0 ? tag(1, grammar) : "The subject";
  const place = plan.decorName.trim() ? tag(placeIndex, grammar) : "";
  const setup = plan.duree * 0.4;
  const setupLabel = Number.isInteger(setup) ? String(setup) : String(Math.round(setup * 10) / 10);
  const placeLine = place
    ? `In ${place}${plan.decorNote.trim() ? `, ${plan.decorNote.trim()}` : ""}.`
    : "";
  const lines = [
    `[références]  ${refs.join(", ") || "aucune"}`,
    `[cadrage]     ${CADRAGE_EN[plan.cadrage]}, ${plan.format}.`,
    placeLine ? `[lieu]        ${placeLine}` : "",
    `[caméra]      ${CAMERA_EN[plan.camera]}.`,
    `[timeline]    [0s-${setupLabel}s] ${who} stands still and breathes.`,
    `              [${setupLabel}s-${plan.duree}s] ${who} ${actionEn(plan.action)}.`,
  ];
  if (decision.son && plan.paroles === "replique" && plan.replique.trim()) {
    const said = plan.replique.trim().replace(/"/g, "");
    lines.push(`[réplique]    ${who} says in French: "${said}"`);
  }
  return { text: lines.filter(Boolean).join("\n"), grammar };
}

export function exampleActions(): readonly string[] {
  return ACTION_EXAMPLES;
}

/** Graphs that must keep Picture tags. Used by the tests and the details fold. */
export function usesPictureTags(graph: string | null): boolean {
  return graph === GRAPH.essai || graph === GRAPH.i2v || graph === GRAPH.suite || graph === GRAPH.multi;
}
