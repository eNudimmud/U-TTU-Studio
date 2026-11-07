/** Public studio: Outils and the conversation live here. `/studio/legacy` stays an alias. */
export const STUDIO_PUBLIC = "/studio";

/** True on the public studio and on the legacy alias, never on `/studio/cinema` or `/studio/anime`. */
export function isStudioAppPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  return path.endsWith("/studio/legacy") || /\/studio$/.test(path);
}
