"use client";

import { BrandLockup } from "@/components/brand";
import { useI18n } from "@/components/i18n/provider";

/** While the studio opens: JD's full logo, never cropped, what the studio is, one quiet line and the shape of what comes. */
export function StudioSplash({ early = false }: { early?: boolean }) {
  const { t } = useI18n();
  return <div className="u-splash" role="status" data-splash="" data-splash-early={early ? "" : undefined}>
    <BrandLockup className="u-splash-lockup" alt="U*TTU Studio" />
    <p className="u-splash-kicker">{t("landing.kicker")}</p>
    <p>{t("nav.opening")}</p>
    <span className="u-splash-bar" aria-hidden="true" />
    <div className="u-splash-skel" aria-hidden="true"><span /><span /><span /></div>
  </div>;
}
