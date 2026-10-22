"use client";

/**
 * Progressive enhancement for « Et ensuite ? ».
 * The assistant only proposes an existing tool; the Studio tool hub remains
 * responsible for quote, confirmation, execution and asset persistence.
 */
import { useId, useState } from "react";
import { assetPath } from "@/lib/site";
import { studioAgentSnapshot } from "@/lib/agent/capabilities";
import { decideStudioRequest } from "@/lib/agent/decision";
import { agentSourceId } from "@/lib/agent/source";
import { resolveStudioHandoff } from "@/lib/agent/handoff";
import { useStudio } from "./studio-session";
import { useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { agentLocale, toKernelLanguage } from "@/lib/agent/language";
type SuiteSource = { kind: "image" | "video"; url: string; name: string; path?: string; aspect?: "horizontal" | "vertical" };

export function StudioAgentInline({ source, onPrepare }: { source: SuiteSource; onPrepare: () => void }) {
  const { prefs, media } = useStudio();
  const { t } = useI18n();
  const { locale } = useLocaleSwitch();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState("");
  const [submitted, setSubmitted] = useState("");
  const snapshot = studioAgentSnapshot(prefs);
  const sourceId = resolveStudioHandoff(source, media) ? agentSourceId(source) : undefined;
  const decision = decideStudioRequest(toKernelLanguage(submitted, agentLocale(locale)), snapshot.capabilities, source.kind === "image" && sourceId ? { id: sourceId, kind: "image" } : undefined);
  return <div className="u-agent-inline" data-studio-agent="">
    <button type="button" className="u-secondary" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      {t("agent.inline.title")}
    </button>
    {open && <div className="u-agent-inline-body">
      <label htmlFor={inputId}>{t(source.kind === "image" ? "agent.inline.askImage" : "agent.inline.askVideo")}</label>
      <form onSubmit={event => { event.preventDefault(); setSubmitted(request.trim()); }}>
        <input id={inputId} aria-label={t("agent.inline.aria")} value={request}
          onChange={event => setRequest(event.target.value)} maxLength={500}
          placeholder={t("agent.inline.placeholder")} />
        <button type="submit" className="u-secondary">{t("agent.inline.propose")}</button>
      </form>
      {submitted && <div role="status">
        {decision.kind !== "propose" ? <p>{source.kind === "image" && !resolveStudioHandoff(source, media) && decision.kind === "missing_asset" ? t("agent.inline.notAccessible") : t(`agent.inline.decision.${decision.kind}`)}</p> :
          <div>
            <p>{t("agent.inline.ready")}</p>
            <a className="u-secondary" href={assetPath("/studio#outils/ret-detourer")}
              onClick={onPrepare}>
              {t("agent.inline.open")}
            </a>
          </div>}
      </div>}
    </div>}
  </div>;
}
