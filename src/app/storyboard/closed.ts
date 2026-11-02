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
