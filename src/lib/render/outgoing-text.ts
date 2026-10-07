// The text a gesture actually puts in its request.
// Project memory (bible, style, lexicon, prompts) is not an argument:
// F18 keeps those notes on the take, and F21 does not send them.
// The screen shows this string, and only this string, before the gesture.

import { referencePaths } from "./references.ts";
import { SHOT_LINE, shotPrompt } from "./shot.ts";
import { takePrompt } from "./take-prompt.ts";

export interface PriseOutgoingInput {
  traits: readonly string[];
  photos: readonly string[];
  place: { name: string; note: string; stills?: readonly string[]; render?: string | null } | null;
  line: string;
  engine: "comfy" | "lora";
  /** The character file's trigger. Only the fal take uses it. */
  subject?: string;
}

/** Picture paths the take would attach, in the order the prompt names them. */
export function prisePicturePaths(photos: readonly string[], place: PriseOutgoingInput["place"]): string[] {
  return referencePaths(photos, place);
}

/**
 * The prompt field of a take. Same words for the screen and for confirmRun.
 * Empty when no picture path is on the take: nothing is sent in that case.
 */
export function priseOutgoingText(input: PriseOutgoingInput): string {
  const photos = input.photos.filter(path => path.length > 0);
  const paths = prisePicturePaths(photos, input.place);
  if (paths.length === 0) return "";
  const lookCount = Math.min(photos.length, paths.length);
  const placeCount = Math.max(0, paths.length - lookCount);
  return takePrompt({
    traits: input.traits,
    lookPictures: lookCount,
    place: input.place ? { name: input.place.name, note: input.place.note, pictures: placeCount } : null,
    line: input.line,
    tags: input.engine === "lora" ? "image" : "picture",
    subject: input.engine === "lora" ? input.subject : undefined,
  });
}

/** The prompt of a filmed path, once the frame count is the one that will leave. */
export function filmOutgoingText(input: { subject: string; place: string; note: string; frames: number }): string {
  return shotPrompt({
    subject: input.subject,
    place: input.place,
    note: input.note,
    frames: input.frames,
    line: SHOT_LINE,
  });
}
