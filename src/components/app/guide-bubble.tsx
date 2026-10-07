"use client";

import { nextMoment, type GuideMoment } from "@/lib/guide";
import { useI18n } from "@/components/i18n/provider";
import { assetPath } from "@/lib/site";
import { useStudio } from "./studio-context";

/** The sentence under a disabled control. A mute button never stands alone. */
export function Why({ on, text }: { on: boolean; text: string }) {
  if (!on || !text) return null;
  return <p className="u-why">{text}</p>;
}

/** One line from U*TTU, in place. The face is a crop of her canon portrait. */
export function GuideBubble({ moments }: { moments: readonly (GuideMoment | false | null | undefined)[] }) {
  const { guide, dismissGuide, guideOff } = useStudio();
  const { t } = useI18n();
  const moment = nextMoment(moments, guide);
  if (!moment) return null;
  return <aside className="u-guide" role="note" aria-label="U*TTU" data-moment={moment}>
    <span className="u-guide-face" style={{ backgroundImage: `url(${assetPath("/images/uttu-canon-portrait.webp")})` }} aria-hidden="true" />
    <div className="u-guide-body">
      <div className="u-guide-head">
        <p className="u-label">U*TTU</p>
        <div className="u-guide-actions">
          <button type="button" className="u-link" onClick={() => dismissGuide(moment)}>{t("guide.understood")}</button>
          <button type="button" className="u-link u-muted" onClick={guideOff}>{t("guide.stop")}</button>
        </div>
      </div>
      <p className="u-guide-line">{t(`guide.${moment}`)}</p>
    </div>
  </aside>;
}
