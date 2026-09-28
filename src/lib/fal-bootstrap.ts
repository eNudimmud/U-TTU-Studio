import { DATASET_SIZE } from "./comfy-stack.ts";
import { FAL_VARY } from "./fal-stack.ts";
import { buildCaption } from "./gate/captions.ts";
import { ANGLES, FRAMINGS, type Angle, type Framing } from "./gate/vocabulary.ts";

// Fifteen shots aimed at the gate's framing target (G20): 4 close-ups, 7 half-length, 4 full-length,
// with front, three-quarter and profile all present and none above 60 %. The variables are the scene
// only — identity stays in the reference photos and in the trigger, never in these lines.
const SHOTS: readonly { angle: Angle; framing: Framing; variables: string }[] = [
  { angle: "face", framing: "gros-plan", variables: "quiet smile, grey hoodie, warm plaster wall, north window" },
  { angle: "face", framing: "gros-plan", variables: "glance aside, black coat, blurred cafe, morning haze" },
  { angle: "trois-quarts", framing: "gros-plan", variables: "neutral mouth, white shirt, studio sweep, softbox" },
  { angle: "profil", framing: "gros-plan", variables: "calm profile, navy scarf, dusk curb, sodium lamp" },
  { angle: "face", framing: "buste", variables: "arms crossed, denim jacket, brick lane, overcast sky" },
  { angle: "face", framing: "buste", variables: "hands in pockets, linen shirt, park path, open shade" },
  { angle: "trois-quarts", framing: "buste", variables: "seated on a stool, wool sweater, wooden chair, table lamp" },
  { angle: "trois-quarts", framing: "buste", variables: "weight on one hip, leather jacket, concrete stairs, noon sun" },
  { angle: "profil", framing: "buste", variables: "mid stride, trench coat, rainy sidewalk, wet asphalt" },
  { angle: "trois-quarts", framing: "buste", variables: "leaning on a counter, olive shirt, tiled kitchen, warm bulb" },
  { angle: "face", framing: "buste", variables: "laughing, red scarf, snowy footpath, flat winter sky" },
  { angle: "face", framing: "pied", variables: "feet apart, long coat, empty plaza, late sun" },
  { angle: "trois-quarts", framing: "pied", variables: "one boot forward, jeans and boots, narrow alley, cool shade" },
  { angle: "profil", framing: "pied", variables: "paused, summer dress, garden path, dappled leaves" },
  { angle: "trois-quarts", framing: "pied", variables: "turned halfway, tailored suit, hotel lobby, ceiling spots" },
];

export interface BootstrapSlot {
  index: number;
  angle: Angle;
  framing: Framing;
  variables: string;
  /** Which uploaded ref a single-image fallback would use. The multi endpoint receives every ref. */
  refIndex: number;
  seed: number;
}

export function bootstrapPlan(): BootstrapSlot[] {
  if (SHOTS.length !== DATASET_SIZE) throw new Error(`Le plan bootstrap doit compter ${DATASET_SIZE} images.`);
  return SHOTS.map((shot, i) => ({
    index: i + 1,
    angle: shot.angle,
    framing: shot.framing,
    variables: shot.variables,
    refIndex: i % FAL_VARY.maxRefs,
    seed: FAL_VARY.seedBase + i + 1,
  }));
}

export const bootstrapCaption = (trigger: string, slot: BootstrapSlot) =>
  buildCaption(trigger, slot.angle, slot.framing, slot.variables);

// Edit instruction for Kontext: the trigger is absent on purpose (Flux does not know it yet).
export function varyPrompt(slot: BootstrapSlot): string {
  const angle = ANGLES.find(item => item.id === slot.angle)?.caption ?? slot.angle;
  const framing = FRAMINGS.find(item => item.id === slot.framing)?.caption ?? slot.framing;
  return `Keep the same person as the reference photos. Change only the camera and the scene: ${angle}, ${framing}, ${slot.variables}. One person in frame, face unobstructed, no text, no logo, no watermark.`;
}

export function falVaryInput(imageUrls: string[], slot: BootstrapSlot) {
  return {
    prompt: varyPrompt(slot),
    image_urls: imageUrls,
    guidance_scale: FAL_VARY.guidanceScale,
    num_images: FAL_VARY.numImages,
    output_format: FAL_VARY.outputFormat,
    aspect_ratio: FAL_VARY.aspectRatio,
    enhance_prompt: FAL_VARY.enhancePrompt,
    safety_tolerance: FAL_VARY.safetyTolerance,
    seed: slot.seed,
  };
}

export type ImageKind = "image/jpeg" | "image/png" | "image/webp";

export function sniffImage(data: Uint8Array): ImageKind | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "image/png";
  if (
    data.length >= 12
    && data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46
    && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  ) return "image/webp";
  return null;
}

export const imageExtension = (kind: ImageKind) => (kind === "image/png" ? "png" : kind === "image/webp" ? "webp" : "jpg");
