"use client";

import type { ProjectLook } from "@/lib/look/model";
import { useStudio } from "@/components/app/studio-session";

/**
 * The active project's look. A project with no file stays without one. Opening the page does not
 * create a project. This reads and writes through `useStudio()` so every place that renders
 * (Cast, Décor, Finish) sees the same look the instant it changes, in the same tab.
 */
export function useProjectLook() {
  const { ready, studio, animeLook, confirmLook } = useStudio();
  return {
    ready,
    slug: studio.project ?? null,
    name: studio.project ?? "",
    doc: { look: animeLook },
    confirm: (next: ProjectLook | null) => confirmLook(next),
  };
}
