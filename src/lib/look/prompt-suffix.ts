// Kept apart from resolve.ts on purpose: this has no dependency on graphs.ts (which names
// partner engines, for exclusion checks) so importing it from the client studio never pulls
// those names into the browser bundle.

import type { AnimePreset, ProjectLook } from "./model.ts";

function suffix(look: ProjectLook): string {
  const preset: Record<AnimePreset, string> = {
    theatrical: "theatrical anime, gouache skies, sunbeams, cel shading",
    neon: "neon-night anime, rain, reflections, electric rim light, cel shading",
    daylight: "summer-daylight anime, soft clouds, quiet light, cel shading",
    darkfantasy: "dark-fantasy anime, moonlight, embers, epic scale, cel shading",
    retro: "1990s cel anime, flat shadows, film grain",
    own: "match the style reference exactly",
  };
  const locks = [
    look.locks.line ? "fine ink line, darker on the outline" : "",
    look.locks.shading ? "two-tone cel shading and warm rim light" : "",
    look.locks.palette ? "keep the style-frame palette" : "",
    look.locks.depth ? "painted depth layers for a real 3D camera" : "",
  ].filter(Boolean);
  return [preset[look.preset], ...locks, "No text."].join(". ");
}

/**
 * The project look's style instructions, for a caller that still renders through its own
 * (non-anime-specific) engine. Until the Krea 2 Turbo / Qwen Image 2.1 graphs are wired in
 * (see docs/ANIME_STUDIO.md), this is how Cast and Décor keep the chosen look visible in what
 * they actually render: appended to the prompt, on the same open-weights editor as always.
 * Empty when there is no look, so a caller that always appends it stays a no-op by default.
 */
export function animeLookPromptSuffix(look: ProjectLook | null): string {
  if (!look || look.kind !== "anime25d") return "";
  return suffix(look);
}
