"use client";

// « Rewrite »: the same idea, changed or not, written again in place while nothing is filmed.

import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import type { DureeCible, Format, Storyboard } from "@/lib/storyboard/storyboard";

export function IdeaBoxAgain({ idee: initial, sb, ecriture, onRewrite }: { idee: string; sb: Storyboard; ecriture: boolean; onRewrite(idee: string, cible: DureeCible, format: Format): Promise<void> }) {
  const { t } = useI18n();
  const [idee, setIdee] = useState(initial);
  const [cible, setCible] = useState<DureeCible>(sb.dureeCible);
  return <div className="sb-ask" data-sb-rewrite-box="">
    <label className="sb-label">{t("storyboard.idea.label")}
      <textarea className="sb-field" rows={3} maxLength={240} value={idee} onChange={event => setIdee(event.target.value)} />
    </label>
    <div className="sb-chips" role="group" aria-label={t("storyboard.idea.length")}>
      {([15, 30, 60] as const).map(n => <button key={n} type="button" className="sb-chip" aria-pressed={cible === n} onClick={() => setCible(n)}>{t("storyboard.idea.target", { n: String(n) })}</button>)}
    </div>
    <button type="button" className="sb-out is-gold" aria-describedby="sb-rewrite-why" disabled={ecriture || !idee.trim()} onClick={() => void onRewrite(idee, cible, sb.format)}>{ecriture ? t("storyboard.writer.writing") : t("storyboard.idea.write")}</button>
    {!idee.trim() && <p id="sb-rewrite-why" className="sb-small sb-muted">{t("storyboard.idea.empty")}</p>}
  </div>;
}
