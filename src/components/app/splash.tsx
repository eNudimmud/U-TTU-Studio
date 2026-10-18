"use client";

import { BrandLockup } from "@/components/brand";
import { useI18n } from "@/components/i18n/provider";

/** While the studio opens: JD's full logo, never cropped, and one quiet line. */
export function StudioSplash() {
  const { t } = useI18n();
  return <div className="u-splash" role="status" data-splash="">
    <BrandLockup className="u-splash-lockup" alt="U*TTU Studio" />
    <p>{t("nav.opening")}</p>
    <span className="u-splash-bar" aria-hidden="true" />
  </div>;
}
