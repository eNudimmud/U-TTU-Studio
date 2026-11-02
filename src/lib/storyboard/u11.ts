// U1.1 · the simplified storyboard, behind ?storyboard=u11. The choice is kept for this tab only
// (sessionStorage), the same way ?cinema=qualification is. The default page is unchanged.
// `?storyboard=0` and `?storyboard=1` stay the on/off hatch and leave this preview.

import type { FileTournage } from "./film.ts";

export const U11_SESSION = "u-ttu-storyboard-ui";

/** True when this address or this tab asked for the simplified storyboard. */
export function storyboardU11Actif(search: string, session: string | null | undefined): boolean {
  const asked = new URLSearchParams(search).get("storyboard");
  if (asked === "u11") return true;
  if (asked === "0" || asked === "1") return false;
  return session === "u11";
}

/** Client only: remembers an explicit `?storyboard=u11` for the rest of the tab. */
export function persistStoryboardU11(search: string): boolean {
  const asked = new URLSearchParams(search).get("storyboard");
  try {
    if (asked === "u11") sessionStorage.setItem(U11_SESSION, "u11");
    else if (asked === "0" || asked === "1") sessionStorage.removeItem(U11_SESSION);
    return storyboardU11Actif(search, sessionStorage.getItem(U11_SESSION));
  } catch {
    return asked === "u11";
  }
}

/**
 * Stop the queue after the shot that is already filming. The running job is left alone:
 * only the shots still waiting are dropped.
 */
export function arreterEntreLesPlans(file: FileTournage): FileTournage {
  return { ...file, restants: [] };
}
