"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { syncClientEnabled } from "@/lib/sync/config";
import { DEVICE_FLAG } from "@/lib/sync/client";

// Clerk is only fetched after the person turns sync on for this device.
const ProjectSyncAccount = dynamic(() => import("./project-sync-account").then(m => m.ProjectSyncAccount), { ssr: false });

/** Optional account sync of project notes. Renders nothing unless the deployment enables it. */
export function ProjectSync() {
  if (!syncClientEnabled()) return null;
  return <ProjectSyncSection />;
}

function ProjectSyncSection() {
  const { t } = useI18n();
  const [on, setOn] = useState(false);
  useEffect(() => { try { setOn(localStorage.getItem(DEVICE_FLAG) === "on"); } catch { /* private mode: stays off */ } }, []);
  const toggle = (next: boolean) => { try { if (next) localStorage.setItem(DEVICE_FLAG, "on"); else localStorage.removeItem(DEVICE_FLAG); } catch { /* ignore */ } setOn(next); };
  return <section className="u-media-library" aria-labelledby="u-sync-title" data-project-sync="">
    <h2 id="u-sync-title">{t("sync.title")}</h2>
    <p className="u-small">{t("sync.help")}</p>
    {on ? <>
      <ProjectSyncAccount />
      <div className="u-agent-actions"><button type="button" className="u-secondary" onClick={() => toggle(false)}>{t("sync.deviceOff")}</button></div>
    </> : <div className="u-agent-actions"><button type="button" className="u-secondary" data-sync-enable="" onClick={() => toggle(true)}>{t("sync.deviceOn")}</button></div>}
  </section>;
}
