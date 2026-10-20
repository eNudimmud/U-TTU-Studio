/**
 * Pure intent routing shared by the Studio's inline UI.
 * Must stay compatible with the independent Studio Agent planner.
 * No network or execution side effects.
 */
export type StudioIntent = "suite-detourer" | "unrecognized";

export function routeStudioIntent(message: string): StudioIntent {
  const text = message.normalize("NFKC").toLocaleLowerCase("fr").trim();
  const cutout = /(?:d[eé]tour(?:e|er|age)|supprim(?:e|er) (?:le |l['’])?(?:fond|arri[eè]re.plan)|enl[eè]v(?:e|er) (?:le |l['’])?(?:fond|arri[eè]re.plan)|remove (?:the )?background|cut ?out)/u.test(text);
  return cutout ? "suite-detourer" : "unrecognized";
}
