/**
 * Close /storyboard until StoryWeave ships.
 * Flip this one line to false to restore the board.
 * `?storyboard=sw` is never held — it is the only bypass.
 */
export const STORYBOARD_CLOSED = true;

/** True when this address should show the holding page. `sw` is never held. */
export function storyboardHeld(asked: string | null | undefined, closed = STORYBOARD_CLOSED): boolean {
  if (asked === "sw") return false;
  return closed;
}

/**
 * Look-page links that would open the holding page (Storyboard, My boards, Keep my current look).
 * While the board is closed they go to the studio; flipping `STORYBOARD_CLOSED` restores `href`.
 */
export function storyboardDoor(href: string, closed = STORYBOARD_CLOSED): string {
  return closed ? "/studio" : href;
}
