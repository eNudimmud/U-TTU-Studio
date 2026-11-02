/**
 * Stand-in until src/components/storyweave/storyweave-app.tsx exists.
 * That file is mounted on `?storyboard=sw` when it exports StoryWeaveApp, StoryWeave, or a default component.
 * Set STORYWEAVE_MOUNTED to false on a module that should stay on the holding page.
 */
export const STORYWEAVE_MOUNTED = false;

export default function StoryWeavePending() {
  return null;
}
