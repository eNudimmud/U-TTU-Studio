"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { type TakeQuote } from "@/lib/render/billed-quote";
import { protocole } from "@/lib/fiabilite";
import { FiabiliteCard } from "./fiabilite-card";
import { Close } from "./glyphs";
import { useStudio } from "./studio-session";
import { RecoveryPanel } from "./recovery-panel";
import { toggleAssistant } from "./assistant-panel";
import { isSessionStorageKey } from "@/lib/render/session";
import { COMFY_KEYS_URL, COMFY_LOGIN_PATH, COMFY_PRICING_URL, COMFY_SIGNUP_URL, SESSION_POLL_MS, clipboardKey, findComfyKey, needsPricing } from "@/lib/render/connect";

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
  const { ready, setSheet, connected, balance, balanceNote, refreshBalance, disconnect, takeQuote, film2, prefs, setPrefs } = useStudio();
  const creditsLoading = !ready || (connected && !balance && !balanceNote);
  return <Frame title={t("sheet.walletTitle")} onClose={() => setSheet(null)}>
    <p>{t("sheet.walletLead")}</p>
    <p className="u-cost" data-state={creditsLoading ? "load" : connected ? "on" : "off"}>{creditsLoading ? t("sheet.balanceLoading") : connected && balance ? t("sheet.credits", { amount: formatCredits(balance.credits) }) : connected ? say(balanceNote) : t("sheet.notLinked")}</p>
    <p className="u-small" data-credit-quote="">{quoteWords(t, takeQuote)}</p>
    <RecoveryPanel />
    {film2 && <fieldset className="u-model-options" data-compte-partenaires="">
      <legend className="u-label">{t("film2.compte.titre")}</legend>
      <label className="u-toggle">
        <input type="checkbox" role="switch" checked={prefs.partenaires} aria-describedby="u-compte-partenaires-sous" onChange={event => setPrefs({ partenaires: event.target.checked })} />
        <span>{t("film2.compte.partenaires")} · {t(prefs.partenaires ? "p0.yes" : "p0.no")}</span>
      </label>
      <p id="u-compte-partenaires-sous" className="u-small">{t("film2.compte.partenairesSous")}</p>
    </fieldset>}
    <div className="u-card-actions">
      <button type="button" className="u-link" data-sheet-assistant="" onClick={() => { setSheet(null); toggleAssistant(true); }}>{t("assistant.title")}</button>
      <button type="button" className="u-link" onClick={() => void refreshBalance()}>{t("sheet.reread")}</button>
      {connected ? <button type="button" className="u-link" onClick={() => void disconnect()}>{t("sheet.unlinkRender")}</button> : <button type="button" className="u-secondary" onClick={() => setSheet("connect")}>{t("stage.connectComfy")}</button>}
    </div>
  </Frame>;
}

export function ConnectSheet() {
  const { t } = useI18n();
  const { setSheet, connectKey, sessionLinked } = useStudio();
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loginTab = useRef<Window | null>(null);
  const polling = useRef(false);
  useEffect(() => { if (error) errorRef.current?.scrollIntoView({ block: "nearest" }); }, [error]);
  const run = async (attempt: () => Promise<string | null>) => {
    setBusy(true); setError("");
    try { const failure = await attempt(); if (failure) setError(failure); }
    finally { setBusy(false); }
  };
  const submit = (value: string) => { setKey(value); void run(() => connectKey(value)); };

  // While Comfy's login tab is open, look for the session it writes on this origin
  // (localStorage, see session.ts). A storage event wakes the check at once; the timer
  // and focus cover browsers that drop it. A tab closed without a session says so.
  useEffect(() => {
    if (!waiting) return;
    let alive = true;
    const started = Date.now();
    const stop = (message: string) => { alive = false; setWaiting(false); loginTab.current = null; setError(message); };
    const check = async () => {
      if (!alive || polling.current) return;
      polling.current = true;
      try {
        const tab = loginTab.current;
        let closed = false;
        try { closed = Boolean(tab?.closed); } catch { closed = false; }
        if (await sessionLinked()) { alive = false; try { tab?.close(); } catch {} return; }
        if (closed) stop(t("sheet.loginClosed"));
        else if (Date.now() - started > 15 * 60_000) stop(t("sheet.loginMissing"));
      } finally { polling.current = false; }
    };
    const timer = window.setInterval(() => void check(), SESSION_POLL_MS);
    const onFocus = () => void check();
    const onStorage = (event: StorageEvent) => { if (isSessionStorageKey(event.key)) void check(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onFocus);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener("focus", onFocus); window.removeEventListener("storage", onStorage); document.removeEventListener("visibilitychange", onFocus); };
  }, [waiting, sessionLinked, t]);

  const openLogin = (event: React.MouseEvent<HTMLAnchorElement>) => {
    setError("");
    const tab = window.open(COMFY_LOGIN_PATH, "uttu-comfy-login", "popup,width=520,height=760");
    loginTab.current = tab;
    if (tab) event.preventDefault();
    setWaiting(true);
  };
  const pasteFromClipboard = async () => {
    setError("");
    let text = "";
    try { text = await navigator.clipboard.readText(); }
    catch { setError(t("sheet.clipboardDenied")); inputRef.current?.focus(); return; }
    const found = clipboardKey(text);
    if (found.kind === "none") { setError(t("sheet.clipboardEmpty")); return; }
    if (found.kind === "comfy") submit(found.key);
    else { setKey(found.key); inputRef.current?.focus(); }
  };
  const errorKey = error ? Object.entries(CONNECT_MESSAGES(t)).find(([, text]) => text === error)?.[0] ?? "" : "";

  return <Frame title={t("stage.connectComfy")} onClose={() => setSheet(null)}>
    <p>{t("sheet.connectLead")}</p>
    <section className="u-connect-block" aria-labelledby="u-connect-login">
      <h3 id="u-connect-login" className="sr-only">{t("sheet.loginButton")}</h3>
      <a className="u-primary u-connect-login" data-connect-login="" href={COMFY_LOGIN_PATH} target="_blank" rel="opener" onClick={openLogin}>{t("sheet.loginButton")}</a>
      <p className="u-small">{t("sheet.loginHint")}</p>
      {waiting && <p className="u-connect-wait" role="status" data-connect-waiting="">{t("sheet.loginWaiting")} <button type="button" className="u-link" onClick={() => setWaiting(false)}>{t("sheet.loginStop")}</button></p>}
    </section>
    <section className="u-connect-block u-connect-key" aria-labelledby="u-connect-key-title">
      <h3 id="u-connect-key-title" className="u-connect-or">{t("sheet.orKey")}</h3>
      <ol className="u-connect-steps">
        <li>{t("sheet.keyStep1")} <a className="u-connect-out" data-connect-keys="" href={COMFY_KEYS_URL} target="_blank" rel="noopener noreferrer">{t("sheet.keyOpen")} ↗</a></li>
        <li>{t("sheet.keyStep2")}</li>
      </ol>
      <form className="u-connect-form" onSubmit={event => { event.preventDefault(); if (!busy) submit(key); }}>
        <label className="u-field">
          <span className="u-label">{t("sheet.keyLabel")}</span>
          <span className="u-connect-input">
            <input ref={inputRef} type={show ? "text" : "password"} value={key} placeholder="comfyui-…" autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go"
              aria-invalid={error ? true : undefined} aria-describedby={error ? "u-connect-error" : undefined}
              onPaste={event => { const found = findComfyKey(event.clipboardData.getData("text")); if (found) { event.preventDefault(); submit(found); } }}
              onChange={event => { setKey(event.target.value); if (error) setError(""); }} />
            <button type="button" className="u-connect-eye" aria-pressed={show} aria-label={t(show ? "sheet.hideKey" : "sheet.showKey")} onClick={() => setShow(value => !value)}>{t(show ? "sheet.hide" : "sheet.show")}</button>
          </span>
        </label>
        <div className="u-connect-actions">
          <button type="button" className="u-secondary" data-connect-paste="" disabled={busy} onClick={() => void pasteFromClipboard()}>{t("sheet.pasteButton")}</button>
          <button type="submit" className="u-secondary" disabled={busy}>{busy ? t("sheet.checking") : t("verb.relier")}</button>
        </div>
      </form>
    </section>
    <div ref={errorRef} id="u-connect-error" className="u-connect-error" role="alert" data-connect-error="" data-connect-code={errorKey || undefined} hidden={!error}>
      <span>{error}</span>
      {errorKey && needsPricing(errorKey) && <> <a href={COMFY_PRICING_URL} target="_blank" rel="noopener noreferrer">{t("sheet.pricingLink")} ↗</a></>}
    </div>
    <ul className="u-connect-links">
      <li><a href={COMFY_SIGNUP_URL} target="_blank" rel="noopener noreferrer">{t("sheet.noAccount")} ↗</a></li>
      <li><a href={COMFY_PRICING_URL} target="_blank" rel="noopener noreferrer" data-connect-pricing="">{t("sheet.subscriptionNote")} ↗</a></li>
      <li><button type="button" className="u-link" onClick={() => busy || void run(async () => (await sessionLinked()) ? null : t("sheet.loginMissing"))}>{t("sheet.session")}</button></li>
    </ul>
  </Frame>;
}

/** Message key for each connect error text, so the sheet can add the right link. */
function CONNECT_MESSAGES(t: (key: string) => string): Record<string, string> {
  return Object.fromEntries(["keyInvalid", "keyRefused", "keySubscription", "keyCredits", "keyNetwork", "keyUnchecked"].map(key => [key, t(`sheet.${key}`)]));
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
  // Centered modal so Tourner confirm stays on-screen (bottom sheet was off-view on tall maquette).
  return <div className="u-confirm-layer" role="presentation" data-confirm-tourner="">
    <div className="u-confirm" role="dialog" aria-modal="true" aria-labelledby="u-confirm-title">
      <h2 id="u-confirm-title">{t("sheet.confirmTitle")}</h2>
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
      <div className="u-confirm-actions">
        <button type="button" className="u-primary" data-confirm-gold="" disabled={!canConfirm} aria-describedby="u-confirm-cost u-confirm-sent" onClick={() => void confirmRun()}>{t("p0.confirmGo")}</button>
        <button type="button" className="u-link" onClick={() => setSheet(null)}>{t("verb.cancel")}</button>
      </div>
    </div>
  </div>;
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

import { quoteWords } from "@/lib/render/quote-words";
export { quoteWords };

/** Why the gate is closed, in plain words. */
export function gateReason(t: Translate, quote: TakeQuote, credits: number | null): string {
  if (quote.source === "unmeasured") return t("p0.quote.none");
  const high = quote.source === "estimated" ? quote.estimate.creditsHigh : quote.source === "billed" ? quote.measure.creditsHigh : quote.credits;
  if (credits === null) return t("p0.gate.noBalance");
  if (credits < high) return t("p0.gate.low", { credits: formatCredits(credits), high: formatCredits(high) });
  return "";
}
