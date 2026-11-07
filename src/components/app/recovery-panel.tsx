"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { readPending, type PendingRender } from "@/lib/render/recovery";
import { useStudio } from "./studio-session";

export function RecoveryPanel() {
  const { t, say } = useI18n();
  const { connected, creating, resumeRun, identifyPendingJob, archiveUnresolvedPending } = useStudio();
  const [receipt, setReceipt] = useState<PendingRender | null>(null);
  const [error, setError] = useState("");
  const [job, setJob] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [archiveConfirmed, setArchiveConfirmed] = useState(false);
  useEffect(() => {
    const read = () => {
      try { setReceipt(readPending(localStorage)); }
      catch { setError(t("recovery.corrupt")); }
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [creating, t]);
  function exportReceipt() {
    if (!receipt) return;
    const { account: _privateAccount, ...copy } = receipt;
    const url = URL.createObjectURL(new Blob([JSON.stringify(copy, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = `uttu-recu-${receipt.id}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <>
  <section aria-labelledby="recovery-title" data-recovery={receipt ? receipt.jobId ? "known" : "ambiguous" : "empty"}>
    <h3 id="recovery-title">{t("recovery.title")}</h3>
    {receipt && <>
      <p>{receipt.name} · {receipt.project}</p>
      <p className="u-small"><time dateTime={receipt.at}>{receipt.at}</time>{receipt.jobId && <> · {receipt.jobId}</>}</p>
      <button type="button" className="u-link" onClick={exportReceipt}>{t("recovery.export")}</button>
    </>}
    {receipt && !receipt.jobId ? <>
      <p>{t("recovery.ambiguous")}</p>
      <a className="u-link" href="https://cloud.comfy.org/" target="_blank" rel="noopener noreferrer">{t("recovery.history")}</a>
      <label className="u-field"><span>{t("recovery.id")}</span><input value={job} autoComplete="off" spellCheck={false} onChange={event => { setJob(event.target.value); setConfirmed(false); }} /></label>
      <label className="u-toggle"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>{t("recovery.confirm")}</span></label>
      <p id="recovery-identify-why" className="u-small">{t("recovery.invalid")}</p>
      <button type="button" className="u-secondary" disabled={!connected || creating || !confirmed || !/^[a-zA-Z0-9-]{8,64}$/.test(job.trim())} aria-describedby="recovery-identify-why u-recovery-why" onClick={() => {
        setError("");
        void identifyPendingJob(job, confirmed).then(problem => {
          if (problem) setError(problem);
          else { setReceipt(readPending(localStorage)); resumeRun(); }
        });
      }}>{t("recovery.identify")}</button>
    </> : <button type="button" className="u-secondary" disabled={!connected || creating} aria-describedby="u-recovery-why" onClick={resumeRun}>{t("recovery.resume")}</button>}
    <p className="u-small" id="u-recovery-why">{t(!connected ? "recovery.connect" : creating ? "recovery.busy" : "recovery.noSpend")}</p>
    {error && <p role="alert">{say(error)}</p>}
  </section>
  {receipt && !receipt.jobId && <section aria-labelledby="recovery-archive-title" data-recovery-archive="">
    <h3 id="recovery-archive-title">Débloquer les outils sans identifiant</h3>
    <p id="recovery-archive-why" className="u-small">Après vérification de ton historique Comfy, tu peux archiver ce reçu incertain et reprendre les générations. Le reçu reste conservé sur cet appareil ; cette action n'annule aucun rendu ni aucune facturation Comfy.</p>
    <label className="u-toggle"><input type="checkbox" checked={archiveConfirmed} onChange={event => setArchiveConfirmed(event.target.checked)} /><span>J'ai vérifié mon historique Comfy et j'accepte le risque d'une génération déjà facturée.</span></label>
    <button type="button" className="u-secondary" disabled={creating || !archiveConfirmed} aria-describedby="recovery-archive-why" onClick={() => {
      setError("");
      void archiveUnresolvedPending(archiveConfirmed).then(problem => {
        if (problem) setError(problem);
        else { setReceipt(readPending(localStorage)); setArchiveConfirmed(false); }
      });
    }}>Archiver ce reçu et débloquer les outils</button>
  </section>}</>;
}
