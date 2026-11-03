"use client";

// One small, isolated piece: the production-section pill in the project chain. Cinema and
// ANIME Studio are built in separate PRs; each only edits its own entry in `sections` below.

import { assetPath } from "@/lib/site";

export type StudioSectionId = "cinema" | "anime";

export interface StudioSectionConfig {
  /** Where the pill sends the visitor: that section's own setup page. */
  href: string;
  /** The section's name, shown as-is (never a jargon word needing explanation). */
  label: string;
}

/**
 * Names the production section this project is in right now, and links to where it is set up.
 * Replaces the old two-tier "Look / Standard / Anime 2.5D" pill with one clear name.
 */
export function SectionSwitch({ active, sections }: { active: StudioSectionId; sections: Record<StudioSectionId, StudioSectionConfig> }) {
  const config = sections[active];
  return <a className="u-step u-step-look" href={assetPath(config.href)} data-chain-section={active}>
    <b>{config.label}</b>
  </a>;
}
