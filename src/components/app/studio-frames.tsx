"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { quoteSentence } from "@/lib/render/billed-quote";
import { Close } from "./glyphs";
import { useStudio } from "./studio-session";

function Frame({ title, onClose, children }: { title: string; onClose(): void; children: React.ReactNode }) {
  const { t } = useI18n();
  return <div className="u-overlay">
    <div className="u-sheet" role="dialog" aria-modal="true" aria-labelledby="u-sheet-title">
      <header className="u-sheet-head">
        <h2 id="u-sheet-title">{title}</h2>
        <button type="button" className="u-icon" onClick={onClose} aria-label={t("verb.close")}><Close /></button>
      </header>
      {children}
    </div>
  </div>;
}

export function CreditSheet() {
  const { t, say } = useI18n();
  const { setSheet, connected, balance, balanceNote, refreshBalance, disconnect, takeQuote } = useStudio();
  return <Frame title={t("sheet.walletTitle")} onClose={() => setSheet(null)}>
    <p>{t("sheet.walletLead")}</p>
    <p className="u-cost" data-state={connected ? "on" : "off"}>{connected && balance ? t("sheet.credits", { amount: formatCredits(balance.credits) }) : connected ? say(balanceNote) : t("sheet.notLinked")}</p>
    <p className="u-small">{quoteSentence(takeQuote)}</p>
    <div className="u-card-actions">
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
      <input value={key} autoComplete="off" spellCheck={false} onChange={event => setKey(event.target.value)} />
    </label>
    <button type="button" className="u-secondary" onClick={() => void connectKey(key).then(error => { if (error) setNotice(error); })}>{t("verb.relier")}</button>
  </Frame>;
}

export function ConfirmTake() {
  const { t } = useI18n();
  const { setSheet, gate, outgoing, confirmRun } = useStudio();
  const text = outgoing();
  const canConfirm = gate.allowed && gate.line.trim().length > 0 && text.trim().length > 0;
  return <Frame title={t("sheet.confirmTitle")} onClose={() => setSheet(null)}>
    <p className="u-cost" id="u-confirm-cost">{gate.line}</p>
    <p className="u-small" id="u-confirm-sent">{text}</p>
    <button type="button" className="u-primary" data-confirm-gold="" disabled={!canConfirm} aria-describedby="u-confirm-cost u-confirm-sent" onClick={() => void confirmRun()}>{t("stage.generate")}</button>
    <button type="button" className="u-link" onClick={() => setSheet(null)}>{t("verb.cancel")}</button>
  </Frame>;
}
