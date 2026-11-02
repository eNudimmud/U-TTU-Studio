"use client";

// CE5 · the native agent on the board, behind JD's qualification flag only. A request the board's own
// reading does not understand is prepared (context, graph, quote: no POST), shown in the existing
// confirmation surface with « ≈ X crédits estimés », and sent only on « Start » with one approval. The
// board changes only when the answer is read back (resumeIntent → journaled command → re-read).

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import type { ControllerCode, PreparedIntent } from "@/lib/cinema/controller";
import { formatCredits } from "@/lib/credits";
import { referencesDuCatalogue } from "@/lib/storyboard/identites";
import type { Storyboard } from "@/lib/storyboard/storyboard";
import { useStudio } from "../app/studio-session";
import type { Bulle } from "./storyboard-uttu";
import type { Storyboards } from "./use-storyboards";

/** The ceiling one approval holds when the quote is not calibrated (CE5: ≈ 1–3 credits per intent). */
const UNCALIBRATED_CEILING = 3;
const TRANCHE = "ce5-agent";
const WAITING = new Set<string>(["INTENT_WAITING", "INTENT_SUBMITTED"]);

export function ceilingOf(prepared: PreparedIntent): number {
  const quote = prepared.preparation.quote;
  return quote.estimatedCredits !== null && quote.basis !== "unavailable" ? Math.ceil(quote.estimatedCredits + (quote.uncertaintyCredits ?? 0)) : UNCALIBRATED_CEILING;
}

export function useNativeAgent(sb: Storyboard | null, selectedShotId: string | null, data: Storyboards, dire: (id: string, bulle: Bulle) => void) {
  const studio = useStudio();
  const { t } = useI18n();
  const { locale } = useLocaleSwitch();
  const [pending, setPending] = useState<PreparedIntent | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const project = studio.studio.project;
  // The codes with a sentence in the catalogue get it; any other one gets the plain « could not ».
  const say = useCallback((boardId: string, code: ControllerCode) => {
    const key = `storyboard.cinema.errors.${code}`;
    dire(boardId, { qui: "uttu", texte: t.has(key) ? t(key) : t("storyboard.cinema.agent.failed") });
  }, [dire, t]);

  // GET only: reads the answer of a sent request until it is applied, refused or failed.
  const follow = useCallback((boardId: string | null) => {
    if (timer.current) clearTimeout(timer.current);
    const tick = async () => {
      const out = await studio.cinema.resumeIntent({ locks: {} });
      const where = out.target.storyboardId || boardId;
      if (WAITING.has(out.code)) { timer.current = setTimeout(tick, Math.max(2000, out.data?.retryAfterMs ?? 4000)); return; }
      if (out.code === "NOTHING_TO_RESUME") return;
      // The answer was undone on purpose (rolled back journal): the board is re-read, nothing to say.
      if (out.code === "UNDONE") { studio.cinemaChanged(); return; }
      if (out.code === "INTENT_APPLIED") { studio.cinemaChanged(); if (where) dire(where, { qui: "uttu", texte: t("storyboard.cinema.agent.applied") }); return; }
      if (where) say(where, out.code);
    };
    void tick().catch(() => undefined);
  }, [studio, dire, say, t]);
  useEffect(() => { if (studio.cinemaAgent && studio.connected) follow(null); }, [studio.cinemaAgent, studio.connected]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /** True when the agent took the request (hidden outside qualification: the caller keeps its reply). */
  const ask = useCallback(async (texte: string): Promise<boolean> => {
    if (!studio.cinemaAgent || !sb || !project) return false;
    setBusy(true);
    try {
      // Arbitrage 8: a refused save stops here; nothing is prepared on a board that is not on disk.
      if (await data.sauver(sb, { now: true }) === false) { say(sb.id, "STORAGE_UNAVAILABLE"); return true; }
      // CE5-L: every CAST card and CAST reference (with or without pictures), one per ID; homonyms stay two
      // entries so the model has to ask, never merge.
      const references = referencesDuCatalogue(studio.studio.cast, studio.studio.scenes, studio.references);
      const out = await studio.cinema.prepareIntent({ scope: { projectId: project, storyboardId: sb.id }, locale, selectedShotId, userText: texte, locks: {}, references, capabilities: [] });
      if (!out.ok || !out.data) say(sb.id, out.code);
      else setPending(out.data);
    } finally { setBusy(false); }
    return true;
  }, [studio, sb, project, data, locale, selectedShotId, say]);

  const start = useCallback(async () => {
    const prepared = pending;
    setPending(null);
    if (!prepared) return;
    const boardId = prepared.context.scope.storyboardId;
    const { userApproval } = await import("@/lib/cinema/intent-job");
    const approval = userApproval(prepared.preparation, ceilingOf(prepared), { id: crypto.randomUUID(), trancheId: TRANCHE }, new Date());
    const sent = await studio.cinema.submitIntent(prepared, approval);
    if (!sent.ok) { say(boardId, sent.code); return; }
    dire(boardId, { qui: "uttu", texte: t("storyboard.cinema.agent.sent") });
    follow(boardId);
  }, [pending, studio, say, dire, t, follow]);

  const confirm = pending ? <AgentConfirm prepared={pending} onStart={() => void start()} onClose={() => setPending(null)} /> : null;
  return { ask, busy, confirm };
}

/** Same surface and words as the board's film confirmation: nothing is sent before « Start ». */
function AgentConfirm({ prepared, onStart, onClose }: { prepared: PreparedIntent; onStart(): void; onClose(): void }) {
  const { t } = useI18n();
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => { button.current?.focus(); }, []);
  const quote = prepared.preparation.quote;
  const known = quote.estimatedCredits !== null && quote.basis !== "unavailable";
  return <div className="sb-confirm-back" onClick={onClose}>
    <div className="sb-confirm" role="dialog" aria-modal="true" aria-labelledby="sb-agent-title" data-sb-agent-confirm="" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") onClose(); }}>
      <h2 id="sb-agent-title" className="sb-serif">{t("storyboard.cinema.agent.title")}</h2>
      <p className="sb-small sb-muted">{t("storyboard.cinema.agent.lead")}</p>
      <p className="sb-mono" data-sb-agent-quote="">{known
        ? t("storyboard.cinema.agent.cost", { n: formatCredits(Math.ceil(quote.estimatedCredits! + (quote.uncertaintyCredits ?? 0))) })
        : t("storyboard.cinema.agent.costUnknown", { n: formatCredits(ceilingOf(prepared)) })}</p>
      <button ref={button} type="button" className="sb-gold" data-sb-agent-start="" onClick={onStart}>{t("storyboard.cinema.agent.start")}</button>
      <div className="sb-row"><button type="button" className="sb-out" data-sb-agent-cancel="" onClick={onClose}>{t("storyboard.cinema.agent.cancel")}</button></div>
    </div>
  </div>;
}
