"use client";

import { useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { DEPARTS, type Etape } from "@/lib/creation/depart";
import { assetPath } from "@/lib/site";

/** A real house result on an empty step. Tapping it fills the step exactly like « Partir de cet exemple ». */
export function ExempleDepart({ etape, image, titre, compact, onStart }: { etape: Etape; image?: string; titre?: string; compact?: boolean; onStart(): void }) {
  const { t } = useI18n();
  const { locale } = useLocaleSwitch();
  const item = DEPARTS[etape];
  // House titles are written in French; other languages get the translated title of the step.
  const title = locale === "fr" ? (titre || item.titre) : t(`depart.titles.${etape}`);
  return <figure className="u-depart" data-depart={etape} data-compact={compact || undefined}>
    <button type="button" className="u-depart-hit" onClick={onStart} aria-label={t("depart.aria", { title })}>
      <img src={image || assetPath(item.image)} alt="" />
      <span className="u-depart-badge">{t("depart.label")}</span>
    </button>
    <figcaption>
      <strong>{title}</strong>
      {!compact && <span>{t(`depart.${etape}`)}</span>}
      <button type="button" className="u-link" data-partir-exemple={etape} onClick={onStart}>{t("gestes.startExample")}</button>
    </figcaption>
  </figure>;
}
