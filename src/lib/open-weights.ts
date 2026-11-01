// Open-weights mode (Comfy « Open Source Higgsfield » contest). One flag, ON by default:
// every tool, engine and price that runs a partner (paid API) node is hidden, never deleted.
// Turn it off for a build with NEXT_PUBLIC_OPEN_WEIGHTS_MODE=off (inlined at build time, so the
// server and the first client paint agree and the tool count never jumps).
//
// Source of the classification: workflows/index.json (`partner`, `partnerNodes`), read from the
// official Comfy templates, and `templatePartenaire` in workflows/registre.ts (api_ prefix plus
// the three templates that hold a partner node without it). tests/open-weights.test.ts checks
// both agree for every template the studio exports.

/** True unless the build says NEXT_PUBLIC_OPEN_WEIGHTS_MODE=off. */
export function modeOpenWeights(value: string | undefined = process.env.NEXT_PUBLIC_OPEN_WEIGHTS_MODE): boolean {
  return (value ?? "").trim().toLowerCase() !== "off";
}

export const OPEN_WEIGHTS_MODE: boolean = modeOpenWeights();

/**
 * MiniMax H3 Community License (license research, PR #219): H3, FastH3 and Pika H3 Flex are
 * eligible open weights. The licence asks to show « MiniMax H3 » wherever the model is used:
 * every label of these templates names it (tests/open-weights.test.ts checks the four locales).
 */
export const MINIMAX_H3_ATTRIBUTION: readonly string[] = [
  "video_minimax_h3_r2v",
  "video_minimax_h3_i2v",
  "video_minimax_h3_multiframe_reference",
  "video_minimax_h3_i2v_continuation",
  "video_minimax_h3_fun_controlnet_union",
  "video_fasth3_ominiref_r2v",
  "video_pika_h3_flex_ref2va",
];

/**
 * Local templates (no partner node, they run on Comfy's GPUs) that stay visible but whose model
 * licence still has to be read before the contest entry. Template id → what to check.
 */
export const LICENCE_A_VERIFIER: Readonly<Record<string, string>> = {
  "3d_hunyuan3d-v2.1": "Tencent Hunyuan 3D community licence excludes the EU, the UK and South Korea.",
};

export function licenceAVerifier(template: string): string | null {
  return LICENCE_A_VERIFIER[template] ?? null;
}
