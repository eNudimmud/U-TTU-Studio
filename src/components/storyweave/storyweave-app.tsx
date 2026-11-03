"use client";

// Mounted by the storyboard route on ?storyboard=sw (StoryWeaveSlot).
// The closed gate never wraps this module.

import { StoryboardApp } from "@/components/storyboard/storyboard-app";

export function StoryWeaveApp({ id = null, print = false }: { id?: string | null; print?: boolean }) {
  return <StoryboardApp id={id ?? null} print={print} sw />;
}
