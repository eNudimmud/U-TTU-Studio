"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { readPending, type PendingRender } from "@/lib/render/recovery";
import { useStudio } from "./studio-session";

export function RecoveryPanel() {
  const { t, say } = useI18n();
  const { connected, creating, resumeRun, identifyPendingJob } = useStudio();
  const [receipt, setReceipt] = useState<PendingRender | null>(null);
  const [error, setError] = useState("");
  const [job, setJob] = useState("");
  const [confirmed, setConfirmed] = useState(false);
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
  return <section aria-labelledby="recovery-title" data-recovery={receipt ? receipt.jobId ? "known" : "ambiguous" : "empty"}>
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
  </section>;
}
