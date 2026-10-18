// One sentence on the studio entry → the tool that matches, or the film flow.
// Text alone is a still. Animation and video go to a video tool. A film (character, place, shot) opens CAST.

import { fold } from "../intention/words.ts";

export type PromptRoute = { kind: "outil"; id: string } | { kind: "film" };

const FILM = /\b(court metrage|court film|kurzfilm|cortometraje|short film)\b/;
const CAST_AND_SHOT = /\b(personnage|character|figur|personaje|decor|lieu|ort|lugar|montage|schnitt|montaje)\b/;
const SHOT = /\b(film|video|plan|sequence|clip|einstellung|toma)\b/;
const ANIM = /\b(anim\w*|prend vie|prendre vie|come alive|lebendig|cobra vida)\b/;
const VIDEO = /\b(video|videos|clip|clips)\b/;

/** Routes a free prompt. Empty text is not a route: the caller keeps the visitor on the entry. */
export function routePrompt(text: string): PromptRoute {
  const words = fold(text);
  if (FILM.test(words) || (CAST_AND_SHOT.test(words) && SHOT.test(words))) return { kind: "film" };
  if (ANIM.test(words)) return { kind: "outil", id: "vid-wan" };
  if (VIDEO.test(words)) return { kind: "outil", id: "vid-texte" };
  return { kind: "outil", id: "img-klein" };
}
