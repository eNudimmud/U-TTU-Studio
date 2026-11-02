// U1.1 · the simplified storyboard. It is the default on /storyboard (JD, 2026-11-02: « Oui remplace l'ancienne »).
// `?storyboard=u11` still opens it. `?storyboard=legacy` is the paper page, kept for this tab (sessionStorage)
// so a reload stays there. `?storyboard=0` and `?storyboard=1` stay the on/off hatch and do not pick a layout.

import type { FileTournage } from "./film.ts";

export const U11_SESSION = "u-ttu-storyboard-ui";

/** True unless this address, or this tab, asked for the paper page. */
export function storyboardU11Actif(search: string, session: string | null | undefined): boolean {
  const asked = new URLSearchParams(search).get("storyboard");
  if (asked === "legacy") return false;
  if (asked === "u11") return true;
  return session !== "legacy";
}

/** Client only: remembers an explicit `?storyboard=legacy` for the rest of the tab, and forgets it on `?storyboard=u11`. */
export function persistStoryboardU11(search: string): boolean {
  const asked = new URLSearchParams(search).get("storyboard");
  try {
    const stored = sessionStorage.getItem(U11_SESSION);
    if (asked === "legacy") sessionStorage.setItem(U11_SESSION, "legacy");
    else if (asked === "u11" || stored === "u11") sessionStorage.removeItem(U11_SESSION);
    return storyboardU11Actif(search, sessionStorage.getItem(U11_SESSION));
  } catch {
    return asked !== "legacy";
  }
}

/** Query to keep on in-page links: an explicit flag, or the tab's paper choice. Empty on the default page. */
export function storyboardLayoutQuery(): string {
  if (typeof window === "undefined") return "";
  const asked = new URLSearchParams(window.location.search).get("storyboard");
  if (asked === "legacy" || asked === "u11" || asked === "sw") return `?storyboard=${encodeURIComponent(asked)}`;
  try {
    if (sessionStorage.getItem(U11_SESSION) === "legacy") return "?storyboard=legacy";
  } catch { /* storage off */ }
  return "";
}

/**
 * Stop the queue after the shot that is already filming. The running job is left alone:
 * only the shots still waiting are dropped.
 */
export function arreterEntreLesPlans(file: FileTournage): FileTournage {
  return { ...file, restants: [] };
}
