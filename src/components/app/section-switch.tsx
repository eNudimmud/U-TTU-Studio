"use client";

// The studio's one door into its two sections. Small and isolated on purpose: the Cinema PR and
// the Anime PR both read src/lib/studio-sections.ts, so this file rarely needs edits from either
// side. Progressive disclosure, not a nav bar: two quiet cards, not a row of chips.

import { useI18n } from "@/components/i18n/provider";
import { assetPath } from "@/lib/site";
import { STUDIO_SECTIONS, type SectionId } from "@/lib/studio-sections";

const ICON = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

function SectionIcon({ id }: { id: SectionId }) {
  if (id === "cinema") return <svg {...ICON}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M7 5.5v13M17 5.5v13M3 10h4M3 15h4M17 10h4M17 15h4" /><circle cx="12" cy="12" r="2.2" /></svg>;
  return <svg {...ICON}><path d="M9 4.5c1 2 1 4.5-1 6.5 3-.5 5 1 6 3-1 3-4 5-7 4.5" /><path d="M8 3.5c2.5 0 5 1.5 5.5 4" /></svg>;
}

/** The studio home's one additive entry: two doors, Cinema and Anime. */
export function SectionSwitch() {
  const { t } = useI18n();
  return <nav className="u-sections" aria-label={t("doors.label")}>
    {STUDIO_SECTIONS.map(section => <a key={section.id} className="u-section-door" href={assetPath(section.href)} data-section={section.id}>
      <span className="u-section-icon" aria-hidden="true"><SectionIcon id={section.id} /></span>
      <span className="u-section-copy">
        <strong>{t(`doors.${section.i18nKey}.name`)}</strong>
        <span>{t(`doors.${section.i18nKey}.line`)}</span>
      </span>
    </a>)}
  </nav>;
}
