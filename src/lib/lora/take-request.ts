// The JSON a LoRA take would send. No account, no upload: the opening script
// can build a shot request without the fal client.

import type { LoraResolution } from "../fal/prices.ts";
import type { TrainingAspect } from "./dataset.ts";

export const LORA_SCALE = 1;
export const LORA_PICTURES_MAX = 9;

export function loraTakeRequest(input: { prompt: string; imageUrls: readonly string[]; loraUrl: string; seconds: number; aspect: TrainingAspect; resolution: LoraResolution; seed: number }): Record<string, unknown> {
  return {
    prompt: input.prompt,
    loras: [{ path: input.loraUrl, scale: LORA_SCALE }],
    reference_image_urls: input.imageUrls.slice(0, LORA_PICTURES_MAX),
    duration: input.seconds,
    aspect_ratio: input.aspect,
    resolution: input.resolution,
    seed: input.seed,
    prompt_expansion_mode: "disabled",
    enable_safety_checker: true,
  };
}
