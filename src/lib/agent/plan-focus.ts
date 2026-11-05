/**
 * « Passer au plan de production » fills the plan field and, two frames later, moves the caret
 * there. If the visitor is already typing in another field, that move swallows the next keys.
 */

const TYPING = "textarea, input, select, [contenteditable='true']";

/** True when the caret may move to the plan field. A field the visitor is typing in wins. */
export function mayFocusPlanField(active: { matches?: (selector: string) => boolean } | null, plan: object | null): boolean {
  if (!plan) return false;
  if (active === plan) return true;
  if (typeof active?.matches === "function" && active.matches(TYPING)) return false;
  return true;
}
