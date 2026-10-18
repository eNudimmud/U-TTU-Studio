"use client";

// « Repérer un lieu » as a tool of its own, opened from the rail and the 3D row.
// The same sheet as DÉCOR (same 3D engine, geocoding, street photos and capture): exploring and
// capturing are free; a capture is kept in Mes créations (Lieux) and in DÉCOR's references.
// Only the décor made from it costs Comfy credits, shown as an estimate.

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { lieuNote } from "@/lib/repere/lieu";
import { assetPath } from "@/lib/site";
import { gesteParId } from "@/lib/workflows/registre";
import { REPERAGE_ID } from "@/lib/outils/vignettes";
import { useStudio } from "../studio-session";

const Sheet = dynamic(() => import("./reperage-3d").then(module => module.Reperage3DSheet), { ssr: false, loading: () => <div className="u-rep3d is-boot" role="status" /> });

export function ReperageTool({ onBack }: { onBack(): void }) {
  const { t } = useI18n();
  const { saveLieuCapture, saveLieuPhoto } = useStudio();
  const [open, setOpen] = useState(false);
  const [kept, setKept] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const decor = gesteParId("decor-photo");
  const credits = decor?.credits ?? null;
  return <div className="u-outils-work u-scout" data-outils-tool={REPERAGE_ID} data-reperage-tool="">
    <button type="button" className="u-secondary u-outils-back" data-outils-back="" onClick={onBack}>← {t("outils.back")}</button>
    <section className="u-scout-card" aria-labelledby="u-title">
      <img className="u-scout-still" src={assetPath("/exemples/apres-decor-heure.webp")} alt="" width={1376} height={768} decoding="async" />
      <div className="u-scout-copy">
        <p className="eyebrow">{t("outils.fam.3d")} · {t("rep3d.free")}</p>
        <h1 id="u-title" className="u-display" tabIndex={-1}>{t(`outils.t.${REPERAGE_ID}.title`)}</h1>
        <p className="u-lead">{t(`outils.t.${REPERAGE_ID}.line`)}</p>
        <ol className="u-scout-steps">
          <li>{t("rep3d.stepPick")}</li>
          <li>{t("rep3d.stepLook")}</li>
          <li>{t("rep3d.stepKeep")}</li>
        </ol>
        <button type="button" className="u-primary" data-rep3d-open="" onClick={() => setOpen(true)}>{t("rep3d.open")}</button>
        <p className="u-small">{t("rep3d.noGoogle")}</p>
      </div>
    </section>
    <section className="u-scout-next" aria-label={t("nav.scene")}>
      <p className="u-small" data-reperage-kept={kept}>{kept > 0 ? t("rep3d.kept", { n: String(kept) }) : t("rep3d.keptNone")}</p>
      <a className="u-secondary" href={assetPath("/studio#scene")} data-reperage-decor="">
        {t("rep3d.toDecor")}{credits !== null && <span className="u-cost-est"> · {t("outils.costEst", { credits: formatCredits(credits) })}</span>}
      </a>
    </section>
    {open && <Sheet
      onClose={close}
      quote={{ credits, high: decor?.high ?? null }}
      onCapture={input => saveLieuCapture(input)}
      onCaptured={() => setKept(value => value + 1)}
      onStreetPhoto={async (place, photo) => {
        const id = await saveLieuPhoto({ name: place.name, note: lieuNote(place, "debout", false), photo });
        if (id) setKept(value => value + 1);
        return Boolean(id);
      }}
    />}
  </div>;
}
