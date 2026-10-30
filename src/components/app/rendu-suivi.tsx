"use client";

import { useI18n } from "@/components/i18n/provider";
import { useStudio } from "./studio-session";

/** Visible while the studio follows an earlier render by itself (after a reload, a closed tab or the
 *  page coming back from the background). The button runs the same no-spend recovery as Crédits. */
export function RenduSuivi() {
  const { pendingWatch: watch, resumeRun, creating, connected } = useStudio();
  const { t } = useI18n();
  if (!watch) return null;
  const done = watch.stage === "done";
  const why = !connected ? t("recovery.connect") : creating ? t("recovery.busy") : "";
  return <section className="u-suivi" role="status" aria-live="polite" data-rendu-suivi={watch.stage}>
    <span className="u-suivi-dot" aria-hidden="true" />
    <p><b>{t(done ? "recovery.watchDone" : "recovery.watchRunning", { name: watch.name || watch.project })}</b> <span>{t("recovery.watchAuto")}</span></p>
    <button type="button" className="u-secondary" disabled={Boolean(why)} aria-describedby={why ? "u-why-suivi" : undefined} onClick={resumeRun}>{t("recovery.resume")}</button>
    {why && <p className="u-why" id="u-why-suivi">{why}</p>}
  </section>;
}
