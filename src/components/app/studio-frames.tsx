"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { quoteSentence, type TakeQuote } from "@/lib/render/billed-quote";
import { protocole } from "@/lib/fiabilite";
import { FiabiliteCard } from "./fiabilite-card";
import { Close } from "./glyphs";
import { useStudio } from "./studio-session";
import { RecoveryPanel } from "./recovery-panel";
import { toggleAssistant } from "./assistant-panel";

function Frame({ title, onClose, children }: { title: string; onClose(): void; children: React.ReactNode }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="u-overlay">
    <dialog ref={dialog} className="u-sheet u-native-sheet" aria-labelledby="u-sheet-title" onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
      if (event.key !== "Tab") return;
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
        .filter(node => node.tabIndex >= 0 && !node.matches(':disabled, [hidden]') && node.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }}>
      <header className="u-sheet-head">
        <h2 id="u-sheet-title">{title}</h2>
        <button type="button" className="u-icon" onClick={onClose} aria-label={t("verb.close")}><Close /></button>
      </header>
      {children}
    </dialog>
  </div>;
}

export function CreditSheet() {
  const { t, say } = useI18n();
  const { setSheet, connected, balance, balanceNote, refreshBalance, disconnect, takeQuote } = useStudio();
  return <Frame title={t("sheet.walletTitle")} onClose={() => setSheet(null)}>
    <p>{t("sheet.walletLead")}</p>
    <p className="u-cost" data-state={connected ? "on" : "off"}>{connected && balance ? t("sheet.credits", { amount: formatCredits(balance.credits) }) : connected ? say(balanceNote) : t("sheet.notLinked")}</p>
    <p className="u-small">{quoteSentence(takeQuote)}</p>
    <RecoveryPanel />
    <div className="u-card-actions">
      <button type="button" className="u-link" data-sheet-assistant="" onClick={() => { setSheet(null); toggleAssistant(true); }}>{t("assistant.title")}</button>
      <button type="button" className="u-link" onClick={() => void refreshBalance()}>{t("sheet.reread")}</button>
      {connected ? <button type="button" className="u-link" onClick={() => void disconnect()}>{t("sheet.unlinkRender")}</button> : <button type="button" className="u-secondary" onClick={() => setSheet("connect")}>{t("stage.connectComfy")}</button>}
    </div>
  </Frame>;
}

export function ConnectSheet() {
  const { t } = useI18n();
  const { setSheet, connectKey, sessionLinked, setNotice } = useStudio();
  const [key, setKey] = useState("");
  return <Frame title={t("stage.connectComfy")} onClose={() => setSheet(null)}>
    <p>{t("sheet.connectLead")}</p>
    <button type="button" className="u-primary" onClick={() => void sessionLinked().then(ok => { if (!ok) setNotice(t("create.sessionMissing")); })}>{t("sheet.session")}</button>
    <label className="u-field">
      <span className="u-label">{t("sheet.keyLabel")}</span>
      <input type="password" value={key} autoComplete="off" spellCheck={false} onChange={event => setKey(event.target.value)} />
    </label>
    <button type="button" className="u-secondary" onClick={() => void connectKey(key).then(error => { if (error) setNotice(error); })}>{t("verb.relier")}</button>
  </Frame>;
}

export function ConfirmTake() {
  const { t } = useI18n();
  const { setSheet, gate, outgoing, confirmRun, creating, pendingTake, takeQuote, balance } = useStudio();
  const text = outgoing();
  const canConfirm = !creating && gate.allowed && gate.line.trim().length > 0 && text.trim().length > 0;
  const settings = pendingTake?.settings;
  const engine = settings ? t(settings.engine === "h3" ? "stage.engine.h3" : "stage.engine.ltx") : "";
  const format = settings ? `${settings.seconds} s · ${settings.aspect === "vertical" ? "9:16" : "16:9"}` : "";
  const states = protocole({ prepared: true, checked: true, quoted: takeQuote.source !== "unmeasured", confirming: !creating, running: creating });
  const blockReason = gate.allowed ? "" : gateReason(t, takeQuote, balance?.credits ?? null);
  return <Frame title={t("sheet.confirmTitle")} onClose={() => setSheet(null)}>
    {pendingTake && <p>{format} · {t("p0.fiab.castCount", { count: pendingTake.castIds.length })}</p>}
    <FiabiliteCard
      states={states}
      estimate={quoteWords(t, takeQuote)}
      estimateId="u-confirm-cost"
      failure={blockReason || undefined}
      sent={pendingTake?.resume ?? []}
      technical={[{ label: t("p0.fiab.sentEngine"), value: `${engine} · ${format}` }, { label: t("p0.fiab.sentRaw"), value: text }]}
      change={pendingTake?.change || t("p0.fiab.changePrise")}
      where={t("p0.fiab.whereTakeNext")}
      open
    />
    <p className="sr-only" id="u-confirm-sent">{text}</p>
    <div className="u-sheet-actions">
      <button type="button" className="u-primary" data-confirm-gold="" disabled={!canConfirm} aria-describedby="u-confirm-cost u-confirm-sent" onClick={() => void confirmRun()}>{t("p0.confirmGo")}</button>
      <button type="button" className="u-link" onClick={() => setSheet(null)}>{t("verb.cancel")}</button>
    </div>
  </Frame>;
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The single estimate, in the user's language, always labelled estimé or mesuré. */
export function quoteWords(t: Translate, quote: TakeQuote): string {
  if (quote.source === "estimated") return t("p0.quote.estimated", { low: formatCredits(quote.estimate.credits), high: formatCredits(quote.estimate.creditsHigh) });
  if (quote.source === "billed") return t("p0.quote.measured", { credits: formatCredits(quote.measure.credits), high: formatCredits(quote.measure.creditsHigh) });
  if (quote.source === "balance") return t("p0.quote.measuredBalance", { credits: formatCredits(quote.credits) });
  return t("p0.quote.none");
}

/** Why the gate is closed, in plain words. */
export function gateReason(t: Translate, quote: TakeQuote, credits: number | null): string {
  if (quote.source === "unmeasured") return t("p0.quote.none");
  const high = quote.source === "estimated" ? quote.estimate.creditsHigh : quote.source === "billed" ? quote.measure.creditsHigh : quote.credits;
  if (credits === null) return t("p0.gate.noBalance");
  if (credits < high) return t("p0.gate.low", { credits: formatCredits(credits), high: formatCredits(high) });
  return "";
}
