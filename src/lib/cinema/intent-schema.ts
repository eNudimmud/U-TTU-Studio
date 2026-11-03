// CE5: the one source of the answer contract the intent model must follow. The parser (intent.ts)
// and the system prompt (intent-workflow.ts) both read these lists, so the prompt names every value
// the parser accepts and nothing else: the model never has to guess an enum.
// No import from intent.ts or intent-workflow.ts (no cycle).

export const CADRAGES = ["large", "moyen", "serre", "detail"] as const;
export const CAMERAS = ["fixe", "suit", "approche", "autour"] as const;
export const DUREES = [5, 8, 10] as const;
export const FORMATS = ["paysage", "portrait"] as const;
export const RENDUS = ["rapide", "fidele"] as const;
export const PAROLES = ["aucune", "replique", "voixoff"] as const;
export const ROLES = ["qui", "ou", "objet", "style"] as const;
export const ROLE_CATEGORY = { qui: "cast", ou: "decor", objet: "objet", style: "style" } as const;
export const PREPARE_OUTPUTS = ["keyframe", "video"] as const;

const list = (values: readonly (string | number)[]) => values.join("|");

/**
 * A complete, valid example (placeholder ids in angle brackets are replaced by ids from CONTEXT).
 * tests/cinema-intent-schema.test.ts parses it with `parseIntent` against a synthetic context.
 */
export const INTENT_EXAMPLE = {
  creativeGoal: "Tighten the selected shot",
  expectedResult: "Shot <shotId> becomes a close shot, camera pushing in",
  operations: [
    {
      kind: "shot.patch",
      target: { projectId: "<projectId>", storyboardId: "<storyboardId>", shotId: "<shotId>", expectedRevision: 0 },
      patch: { cadrage: "serre", camera: "approche", duree: 5 },
    },
  ],
  rationale: "The request names the selected shot only",
  unresolved: [],
} as const;

/** The schema part of the system prompt: every operation, every field, every allowed value. */
export function intentSchemaDescription(): string[] {
  return [
    'Top-level keys, all required: {"creativeGoal": string, "expectedResult": string, "operations": Operation[], "rationale": string, "unresolved": [{"field": string, "reason": string, "candidateIds": string[]}]}. No other key.',
    "Operation kinds (at most 12 operations, at most one storyboard.create): storyboard.create {kind, scope, shots: Shot[1..12]}; shot.patch {kind, target, patch: Shot fields, at least one}; shot.duplicate {kind, target}; shot.archive {kind, target};",
    `storyboard.reorder {kind, scope, expectedRevision, shotIds: every active shotId exactly once}; shot.prepare {kind, target, output: ${list(PREPARE_OUTPUTS)}}; take.finish.prepare {kind, target, sourceTakeId, recipeId}; sequence.export.prepare {kind, scope, takeIds}.`,
    "target = {projectId, storyboardId, shotId, expectedRevision}; scope = {projectId, storyboardId}. Copy ids and revisions from CONTEXT only; never invent one. expectedRevision of a target is the shot's revision; of a reorder, storyboardRevision.",
    `Shot fields (a new shot needs titre or action; missing fields take defaults): titre string<=80; action string<=240; refs [{role: ${list(ROLES)}, referenceId, name}] (at most 7); cadrage ${list(CADRAGES)}|null; camera ${list(CAMERAS)}|null; duree ${list(DUREES)}; format ${list(FORMATS)}; rendu ${list(RENDUS)};`,
    `dialogue {type: ${list(PAROLES)}, qui: string|null, texte: string<=160}; son {musique: string, ambiance: string}; raccord boolean; promptManuel string<=600|null.`,
    `Reference roles map to CONTEXT categories: ${Object.entries(ROLE_CATEGORY).map(([role, category]) => `${role}=${category}`).join(", ")}.`,
    `CONTEXT.selected, when present, is the selected shot with its current values: "this shot" means that shotId. Example of a valid answer: ${JSON.stringify(INTENT_EXAMPLE)}`,
  ];
}
