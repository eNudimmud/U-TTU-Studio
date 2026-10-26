"use client";

// « Repérer un lieu » as a tool of its own, opened from the rail and the 3D row.
// The same sheet as DÉCOR, in three steps: Lieu, Cadre (free, kept in Mes créations › Lieux),
// Décor (the kept frame + one to three photos, one Klein edit, quoted before anything runs).

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { cadreQuote } from "@/lib/creation/decor-cadre";
import { lieuNote } from "@/lib/repere/lieu";
import { assetPath } from "@/lib/site";
import { REPERAGE_ID } from "@/lib/outils/vignettes";
import { useStudio } from "../studio-session";
import { ExempleSaintFrancois } from "./exemple-sf";

const Sheet = dynamic(() => import("./reperage-3d").then(module => module.Reperage3DSheet), { ssr: false, loading: () => <div className="u-rep3d is-boot" role="status" /> });

/** Same page when the studio is open (the hash switches the tab), otherwise the studio page. */
function goStudio(hash: "prise" | "scene") {
  const target = assetPath(`/studio#${hash}`);
  if (window.location.pathname === assetPath("/studio") || window.location.pathname === assetPath("/studio/")) window.location.hash = hash;
  else window.location.assign(target);
}

export function ReperageTool({ onBack }: { onBack(): void }) {
  const { t } = useI18n();
  const { saveLieuCapture, saveLieuPhoto } = useStudio();
  const [open, setOpen] = useState(false);
  const [kept, setKept] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const low = cadreQuote(0)!;
  return <div className="u-outils-work u-scout" data-outils-tool={REPERAGE_ID} data-reperage-tool="">
    <button type="button" className="u-secondary u-outils-back" data-outils-back="" onClick={onBack}>← {t("outils.back")}</button>
    <section className="u-scout-card" aria-labelledby="u-title">
      <ExempleSaintFrancois />
      <div className="u-scout-copy">
        <p className="eyebrow">{t("outils.fam.3d")}</p>
        <h1 id="u-title" className="u-display" tabIndex={-1}>{t(`outils.t.${REPERAGE_ID}.title`)}</h1>
        <p className="u-lead">{t(`outils.t.${REPERAGE_ID}.line`)}</p>
        <ol className="u-scout-steps">
          <li>{t("rep3d.stepPick")}</li>
          <li>{t("rep3d.stepLook")}</li>
          <li>{t("rep3d.stepKeep")}</li>
        </ol>
        <button type="button" className="u-primary" data-rep3d-open="" onClick={() => setOpen(true)}>{t("rep3d.open")}</button>
      </div>
    </section>
    <section className="u-scout-next" aria-label={t("nav.scene")}>
      <p className="u-small" data-reperage-kept={kept}>{kept > 0 ? t("rep3d.kept", { n: String(kept) }) : t("rep3d.keptNone")}</p>
      <p className="u-small" data-reperage-decor="">{t("rep3d.toolQuote")} <span className="u-cost-est">{t("rep3d.quote", { credits: formatCredits(low.credits) })}</span></p>
    </section>
    {open && <Sheet
      onClose={close}
      onCapture={input => saveLieuCapture(input)}
      onCaptured={() => setKept(value => value + 1)}
      onStreetPhoto={async (place, photo) => Boolean(await saveLieuPhoto({ name: place.name, note: lieuNote(place, "debout", false), photo }))}
      onPrise={() => { setOpen(false); goStudio("prise"); }}
      onDecor={() => { setOpen(false); goStudio("scene"); }}
    />}
  </div>;
}
