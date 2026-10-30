"use client";

import { BrandLockup } from "@/components/brand";
import { useI18n } from "@/components/i18n/provider";
import { PoweredBy } from "@/components/powered-by";
import { assetPath } from "@/lib/site";
import { useStudioHref } from "@/components/use-studio-href";

/**
 * 404, error and empty-route screens: graphite, JD's full logo (never cropped), one sentence,
 * one way back. The web appears only in the logo.
 */
export function StatusPage({ kind, onRetry }: { kind: "introuvable" | "erreur"; onRetry?(): void }) {
  const { t } = useI18n();
  const studioHref = useStudioHref(assetPath("/studio"));
  return <div className="status-page" data-status={kind}>
    <main id="contenu" className="status-main" tabIndex={-1}>
      <BrandLockup className="status-lockup" alt="U*TTU Studio" />
      <p className="status-code" aria-hidden="true">{kind === "introuvable" ? "404" : "—"}</p>
      <h1>{t(`status.${kind}.title`)}</h1>
      <p className="status-lead">{t(`status.${kind}.lead`)}</p>
      <div className="status-actions">
        {onRetry && <button type="button" className="button button-primary" onClick={onRetry}>{t("status.retry")}</button>}
        <a className={onRetry ? "button button-outline" : "button button-primary"} href={studioHref}>{t("status.studio")}</a>
        <a className="button button-outline" href={assetPath("/")}>{t("status.home")}</a>
      </div>
    </main>
    <footer className="status-footer"><span>U*TTU Studio</span><PoweredBy /></footer>
  </div>;
}
