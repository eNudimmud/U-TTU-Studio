"use client";

import { GUIDE_LINES, nextMoment, type GuideMoment } from "@/lib/guide";
import { assetPath } from "@/lib/site";
import { useStudio } from "./studio-context";

/** One line from U*TTU, in place. The face is a crop of her canon portrait. */
export function GuideBubble({ moments }: { moments: readonly (GuideMoment | false | null | undefined)[] }) {
  const { guide, dismissGuide, guideOff } = useStudio();
  const moment = nextMoment(moments, guide);
  if (!moment) return null;
  return <aside className="u-guide" role="note" aria-label="U*TTU" data-moment={moment}>
    <span className="u-guide-face" style={{ backgroundImage: `url(${assetPath("/images/uttu-canon-portrait.webp")})` }} aria-hidden="true" />
    <div className="u-guide-body">
      <div className="u-guide-head">
        <p className="u-label">U*TTU</p>
        <div className="u-guide-actions">
          <button type="button" className="u-link" onClick={() => dismissGuide(moment)}>Compris</button>
          <button type="button" className="u-link u-muted" onClick={guideOff}>Ne plus guider</button>
        </div>
      </div>
      <p className="u-guide-line">{GUIDE_LINES[moment]}</p>
    </div>
  </aside>;
}
