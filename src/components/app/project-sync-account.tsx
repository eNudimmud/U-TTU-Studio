"use client";
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { ClerkScope } from "@/components/account/clerk-scope";
import { useI18n } from "@/components/i18n/provider";
import { ACCOUNT_PATH } from "@/lib/account";
import { assetPath } from "@/lib/site";
import { resolveConflict, syncProject, SyncError, type SyncIo, type SyncOutcome } from "@/lib/sync/client";
import { useStudio } from "./studio-session";

export function ProjectSyncAccount() {
  return <ClerkScope><SyncControls /></ClerkScope>;
}

function SyncControls() {
  const { t } = useI18n();
  const auth = useAuth();
  const session = useStudio();
  const project = session.studio.project ?? "";
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [error, setError] = useState("");

  if (!auth.isLoaded) return <p role="status" className="u-small">{t("sync.loading")}</p>;
  if (!auth.isSignedIn) return <>
    <p className="u-small">{t("sync.signedOut")}</p>
    <div className="u-agent-actions"><a className="u-secondary" href={assetPath(ACCOUNT_PATH)}>{t("sync.signIn")}</a></div>
  </>;

  const io: SyncIo = {
    fetch: (input, init) => fetch(typeof input === "string" ? assetPath(input) : input, init),
    storage: localStorage,
    token: () => auth.getToken(),
    notes: async () => { const notes = await session.projectNotes(); setSkipped(notes.skipped); return notes; },
    apply: manifest => session.applyProjectNotes(manifest),
  };
  async function work(run: () => Promise<SyncOutcome>) {
    if (busy || !project) return;
    setBusy(true); setError("");
    try { setOutcome(await run()); }
    catch (e) { setError(t(e instanceof SyncError || (e instanceof Error && e.message.startsWith("sync.")) ? e.message : "sync.failed")); }
    finally { setBusy(false); }
  }
  return <>
    <p className="u-small" id="u-sync-why">{project ? t("sync.ready") : t("sync.project")}</p>
    <div className="u-agent-actions">
      <button type="button" className="u-secondary" data-sync-run="" aria-describedby="u-sync-why" disabled={busy || !project} onClick={() => void work(() => syncProject(io, project))}>{t("sync.run")}</button>
    </div>
    {busy && <p role="status">{t("sync.busy")}</p>}
    {error && <p role="alert">{error}</p>}
    {outcome && outcome.kind !== "conflict" && <p role="status" className="u-small">{t(`sync.outcome.${outcome.kind}`)} · {t("sync.revision")} {outcome.revision}</p>}
    {outcome?.kind === "conflict" && <div role="group" aria-labelledby="u-sync-conflict">
      <p id="u-sync-conflict">{t("sync.conflict")} ({t("sync.revision")} {outcome.remote})</p>
      <div className="u-agent-actions">
        <button type="button" className="u-secondary" aria-describedby="u-sync-why" disabled={busy} onClick={() => void work(() => resolveConflict(io, project, "server"))}>{t("sync.keepServer")}</button>
        <button type="button" className="u-secondary" aria-describedby="u-sync-why" disabled={busy} onClick={() => void work(() => resolveConflict(io, project, "device"))}>{t("sync.keepDevice")}</button>
      </div>
      <p className="u-small">{t("sync.conflictHelp")}</p>
    </div>}
    {skipped.length > 0 && <p className="u-small">{t("sync.skipped")} {skipped.length}</p>}
  </>;
}
