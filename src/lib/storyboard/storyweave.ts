// StoryWeave is a shell over the U1.1 storyboard. It opens only on an explicit
// `?storyboard=sw`. The default /storyboard stays U1.1 until JD says otherwise.

/** True when this address asked for the StoryWeave shell. */
export function storyboardSwActif(search: string): boolean {
  return new URLSearchParams(search).get("storyboard") === "sw";
}
