import type { Angle, Framing } from "./vocabulary.ts";

export const EXAMPLE_TRIGGER = "mira_v1";

export interface CaptionExample { angle: Angle; framing: Framing; variables: readonly string[] }

export const CAPTION_EXAMPLES = {
  fail: { angle: "face", framing: "gros-plan", variables: ["young woman", "oval face", "green eyes", "freckles", "long wavy red hair", "full lips"] },
  pass: { angle: "trois-quarts", framing: "buste", variables: ["laughing", "leaning on a pillar", "grey hoodie", "subway platform", "cold fluorescent light"] },
} as const satisfies Record<"fail" | "pass", CaptionExample>;
