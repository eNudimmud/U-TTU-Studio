import { safeHandoffUrl } from "./source.ts";

export interface SourceHandoff {
  url: string;
  path?: string;
  kind: "image" | "video";
  name: string;
}
/**
 * Resolve a handoff from the Studio's already-hydrated vault media index.
 * Never pass a path string itself as a media URL.
 */
export function resolveStudioHandoff(
  saved: SourceHandoff,
  media: Readonly<Record<string, string>>,
): string | undefined {
  if (saved.path) {
    const hydrated = media[saved.path];
    if (hydrated && (hydrated.startsWith("blob:") || safeHandoffUrl(hydrated))) return hydrated;
  }
  return safeHandoffUrl(saved.url) || undefined;
}
