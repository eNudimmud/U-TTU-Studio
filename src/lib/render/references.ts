import { TAKE_PICTURES_MAX } from "./take-graph.ts";

/** Picture order for a take: the look, the place stills, then the rendered previz. */
export function referencePaths(
  photos: readonly string[],
  scene: { stills?: readonly string[]; render?: string | null } | null,
): string[] {
  const paths = [...photos, ...(scene?.stills ?? [])];
  if (scene?.render) paths.push(scene.render);
  return paths.filter(path => path.length > 0).slice(0, TAKE_PICTURES_MAX);
}
