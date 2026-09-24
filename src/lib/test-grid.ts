export const STRENGTH_SLIDER = { min: 0.5, max: 1.3, step: 0.05 } as const;

export const TEST_GRID = {
  strengths: [0.6, 0.75, 0.9],
  usageBand: { low: 0.7, high: 0.85 },
  images: 1,
  rows: [
    {
      id: "neutre",
      label: "Trigger seul, fond neutre",
      optional: false,
      scene: "plain grey background, soft even light",
      note: "Le socle : le trigger doit suffire à rendre la personne, sans aide du décor.",
    },
    {
      id: "inedit",
      label: "Pose et lumière jamais vues",
      optional: false,
      scene: "crouching, looking back over the shoulder, hard red neon side light at night",
      note: "Exemple à adapter : une pose et une lumière absentes de tes 15 images.",
    },
    {
      id: "style",
      label: "Autre style",
      optional: true,
      scene: "loose watercolor illustration on white paper",
      note: "Si le visage tient hors photo, la LoRA a appris la personne, pas le grain de tes images.",
    },
  ],
} as const;

export const gridPrompt = (trigger: string, scene: string) => [trigger.trim(), scene].filter(Boolean).join(", ");

export const inUsageBand = (strength: number) =>
  strength >= TEST_GRID.usageBand.low - 1e-9 && strength <= TEST_GRID.usageBand.high + 1e-9;

export const decimalFr = (value: number) => value.toFixed(2).replace(".", ",");
