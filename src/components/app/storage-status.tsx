"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { protectStorage, storageHealth, type StorageHealth } from "@/lib/coffre/storage-health";

export function StorageStatus() {
  const { t } = useI18n();
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    let gone = false;
    const inspect = () => { void storageHealth(navigator.storage).then(value => { if (!gone) setHealth(value); }); };
    inspect();
    window.addEventListener("focus", inspect);
    return () => { gone = true; window.removeEventListener("focus", inspect); };
  }, []);
  const low = health?.quota != null && health.quota > 0 && health.usage != null && health.usage / health.quota > 0.85;
  return <section className="u-card" aria-labelledby="storage-title" data-storage={health?.mode ?? "loading"}>
    <h3 id="storage-title">{t("storage.title")}</h3>
    <p role="status" id="storage-mode">{t(busy ? "storage.asking" : `storage.${health?.mode ?? "loading"}`)}</p>
    {requested && health?.mode === "best-effort" && <p>{t("storage.refused")}</p>}
    {low && <p role="alert">{t("storage.low")}</p>}
    {health && health.mode !== "persistent" && health.mode !== "unsupported" && <button type="button" className="u-secondary" disabled={busy} aria-describedby="storage-mode" onClick={() => {
      setBusy(true);
      void protectStorage(navigator.storage).then(value => { setHealth(value); setRequested(true); }).finally(() => setBusy(false));
    }}>{t(busy ? "storage.asking" : "storage.protect")}</button>}
    <p className="u-small">{t("storage.backup")}</p>
  </section>;
}
