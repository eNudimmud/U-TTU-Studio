"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useI18n, useStudioDates } from "@/components/i18n/provider";
import { costLabel, dropTakeLink, isPlaceLora, shotsOf } from "@/lib/coffre/model";
import { MONTAGE_SLATE_SECONDS, montageCues } from "@/lib/coffre/montage";
import { memoryKindOf, type MemoryKind } from "@/lib/coffre/memory";
import { DEFAULT_PROJECT_NAME, treeFileLabel } from "@/lib/coffre/project";
import { CREDITS_PER_USD, costClaim, formatCredits } from "@/lib/credits";
import { quoteSentence } from "@/lib/render/billed-quote";
import { profileParts, quotesToRecords } from "@/lib/render/measured-quote";
import { formatUsd } from "@/lib/fal/prices";
import { folderLinkSupported } from "@/lib/coffre/link";
import { takeProfile } from "@/lib/render/take-graph";
import { nextNumberedName } from "@/lib/ergonomie";
import { assetPath } from "@/lib/site";
import { Close, Refresh, Trash } from "./glyphs";
import { PublishActions } from "./publish";
import { sheetDismissAllowed } from "@/lib/link-epoch";
import { CinemaGestures } from "./cinema-gestures";
import { ProjectMemory } from "./project-memory";
import { Why } from "./guide-bubble";
import { priseOutgoingText } from "@/lib/render/outgoing-text";
import { OutgoingFilm, OutgoingLieu, OutgoingPersonnage, OutgoingTake } from "./outgoing-text";
import { TakeCostLines } from "./take-cost";
import { useStudio } from "./studio-context";

function SheetFrame({ title, label, onClose, children, tall = false }: { title: string; label: string; onClose(): void; children: ReactNode; tall?: boolean }) {
  const { t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const openedAt = useRef(0);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    openedAt.current = Date.now();
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return <div className="u-overlay" onPointerDown={event => {
    if (event.target !== event.currentTarget) return;
    if (!sheetDismissAllowed(openedAt.current, Date.now())) return;
    onClose();
  }}>
    <div ref={panel} tabIndex={-1} className={`u-sheet${tall ? " is-tall" : ""}`} role="dialog" aria-modal="true" aria-labelledby="u-sheet-title">
      <header className="u-sheet-head">
        <div>
          <p className="u-label">{label}</p>
          <h2 id="u-sheet-title">{title}</h2>
        </div>
        <button type="button" className="u-icon" onClick={onClose} aria-label={t("verb.close")}><Close /></button>
      </header>
      {children}
    </div>
  </div>;
}

export function ConnectSheet({ framed = true }: { framed?: boolean } = {}) {
  const { t, say } = useI18n();
  const { setSheet, connected, link, connectKey, sessionLinked, disconnect, setNotice } = useStudio();
  const [mode, setMode] = useState<"session" | "key">("session");
  const [signing, setSigning] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => setSheet(null);

  useEffect(() => {
    if (!signing) return;
    const timer = window.setInterval(() => {
      void sessionLinked().then(ok => {
        if (!ok) return;
        setSigning(false);
        setNotice("Compte de rendu relié.");
        setSheet(null);
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [signing, sessionLinked, setNotice, setSheet]);

  async function linkKey() {
    setBusy(true);
    setError("");
    const problem = await connectKey(key);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    setNotice("Compte de rendu relié par clé.");
    setSheet(null);
  }

  const body = <div className="u-stack">
    {connected
      ? <div className="u-stack">
        <p>{t("sheet.linkedBody", { how: link.mode === "key" ? t("sheet.linkedKey") : t("sheet.linkedSession") })}</p>
        <button type="button" className="u-secondary" onClick={() => void disconnect()}>{t("sheet.unlink")}</button>
      </div>
      : <div className="u-stack">
        <p>{t("sheet.renderIntro")}</p>
        <div className="u-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "session"} onClick={() => setMode("session")}>{t("sheet.signInHere")}</button>
          <button type="button" role="tab" aria-selected={mode === "key"} onClick={() => setMode("key")}>{t("sheet.haveKey")}</button>
        </div>
        {mode === "session" && (signing
          ? <>
            <iframe className="u-signin" src={assetPath("/login")} title={t("sheet.frameTitle")} allow="clipboard-write" />
            <p className="u-small">{t("sheet.frameHint")}</p>
          </>
          : <>
            <p className="u-small">{t("sheet.trackers")}</p>
            <button type="button" className="u-primary" onClick={() => setSigning(true)}>{t("sheet.openSignIn")}</button>
          </>)}
        {mode === "key" && <>
          <label className="u-field">
            <span className="u-label">{t("sheet.keyLabel")}</span>
            <input type="password" value={key} autoComplete="off" spellCheck={false} placeholder="comfyui-…" onChange={event => setKey(event.target.value)} />
          </label>
          <p className="u-small">{t("sheet.keyHint")}</p>
          {error && <p className="u-small is-error" role="alert">{say(error)}</p>}
          <button type="button" className="u-primary" disabled={busy || !key.trim()} onClick={() => void linkKey()}>{busy ? t("sheet.checking") : framed ? t("verb.relier") : t("sheet.linkRender")}</button>
          <Why on={!busy && !key.trim()} text={t("why.needKey")} />
        </>}
      </div>}
  </div>;
  if (!framed) return body;
  return <SheetFrame title={t("sheet.renderTitle")} label={t("verb.relier")} onClose={close} tall={signing}>{body}</SheetFrame>;
}

export function CreditSheet() {
  const { t, say } = useI18n();
  const { time, date } = useStudioDates();
  const { setSheet, connected, balance, balanceNote, refreshBalance, takeQuote, clearMeasuredQuote, settings, studio, engine, falLinked, falBalance, falBalanceNote, refreshFal, trainQuote, disconnect, disconnectFal, blenderLinked, disconnectBlender } = useStudio();
  const quoteRows = [...new Set(studio.quotes.map(quote => quote.profile))].flatMap(profile => {
    const row = costClaim(profile, quotesToRecords(studio.quotes));
    if (row.state !== "measured") return [];
    return [{ profile, credits: row.credits, parts: profileParts(profile) }];
  });
  const measured = studio.takes.filter(take => take.costCredits !== null || take.costUsd !== null).slice(0, 5);
  const renderState = !connected ? "off" : balance ? "read" : balanceNote ? "error" : "unread";
  const falState = !falLinked ? "off" : falBalance ? "read" : falBalanceNote ? "error" : "unread";
  const renderLine = renderState === "off"
    ? t("sheet.notLinked")
    : renderState === "read" && balance
      ? t("sheet.readAt", { time: time.format(balance.readAt) })
      : renderState === "error"
        ? say(balanceNote)
        : t("sheet.balanceUnread");
  const falLine = falState === "off"
    ? t("sheet.notLinked")
    : falState === "read" && falBalance
      ? t("sheet.readAtFal", { time: time.format(falBalance.readAt) })
      : falState === "error"
        ? say(falBalanceNote)
        : t("sheet.balanceUnread");
  return <SheetFrame title={t("sheet.walletTitle")} label={t("nav.studio")} onClose={() => setSheet(null)}>
    <div className="u-stack">
      <p>{t("sheet.walletLead")}</p>
      <div className="u-wallets">
        <section className="u-wallet" data-state={renderState} aria-label={t("sheet.renderAccount")}>
          <p className="u-label">{t("sheet.renderAccount")}</p>
          {renderState === "read" && balance && <strong>{formatCredits(balance.credits)}</strong>}
          <p className={renderState === "error" ? "u-small is-error" : "u-small"} role={renderState === "error" ? "alert" : undefined}>{renderLine}</p>
          <p className="u-small">{t("sheet.referencesRun", { engine: t("engine.comfy.label"), rate: CREDITS_PER_USD })}</p>
          <p className="u-label">{t("sheet.quote")}</p>
          {engine === "comfy" && <p className="u-small">{t("sheet.thisSetting", { profile: takeProfile(settings) })}</p>}
          <p>{engine === "comfy" ? say(quoteSentence(takeQuote)) : t("sheet.uncalibratedClaim")}</p>
          {quoteRows.length > 0 && <>
            <p className="u-small">{t("sheet.measuredLead")}</p>
            <ul className="u-ledger" aria-label={t("sheet.measuredQuotes")}>
              {quoteRows.map(row => <li key={row.profile}>
                <span>{row.parts ? t("sheet.measuredSetting", { steps: row.parts.steps, seconds: row.parts.seconds, aspect: row.parts.aspect }) : row.profile}</span>
                <span>{t("sheet.measuredMark", { amount: formatCredits(row.credits) })}</span>
                <button type="button" className="u-link" onClick={() => void clearMeasuredQuote(row.profile)}>{t("sheet.clearQuote")}</button>
              </li>)}
            </ul>
          </>}
          {connected && <button type="button" className="u-icon" onClick={() => void refreshBalance()} aria-label={t("sheet.rereadRender")}><Refresh /></button>}
          {connected
            ? <>
              <p className="u-small">{t("sheet.forgetLink")}</p>
              <button type="button" className="u-secondary" onClick={() => void disconnect()}>{t("sheet.unlinkRender")}</button>
            </>
            : <button type="button" className="u-secondary" onClick={() => setSheet("connect")}>{t("verb.relier")}</button>}
        </section>
        <section className="u-wallet" data-state={falState} aria-label={t("sheet.falAccount")}>
          <p className="u-label">{t("sheet.falAccount")}</p>
          {falState === "read" && falBalance && <strong>{formatUsd(falBalance.usd)}</strong>}
          <p className={falState === "error" ? "u-small is-error" : "u-small"} role={falState === "error" ? "alert" : undefined}>{falLine}</p>
          <p className="u-small">{t("sheet.falPays", { engine: t("engine.lora.label") })}</p>
          <p className="u-label">{t("sheet.quote")}</p>
          <p>{trainQuote !== null ? formatUsd(trainQuote) : t("sheet.quotePending")}</p>
          {falLinked && <button type="button" className="u-icon" onClick={() => void refreshFal()} aria-label={t("sheet.rereadFal")}><Refresh /></button>}
          {falLinked
            ? <>
              <p className="u-small">{t("sheet.forgetFal")}</p>
              <button type="button" className="u-secondary" onClick={disconnectFal}>{t("sheet.unlinkFal")}</button>
            </>
            : <button type="button" className="u-secondary" onClick={() => setSheet("fal")}>{t("verb.relier")}</button>}
        </section>
      </div>
      <p className="u-label">Blender</p>
      <p className="u-small">{blenderLinked ? t("sheet.blenderOn") : t("sheet.blenderOff")}</p>
      {blenderLinked && <button type="button" className="u-secondary" onClick={() => { disconnectBlender(); setSheet(null); }}>{t("sheet.unlinkBlender")}</button>}
      {measured.length > 0 && <ul className="u-ledger" aria-label={t("sheet.measured")}>
        {measured.map(take => <li key={take.id}><span>{date.format(new Date(take.at))}</span><span>{take.sceneName || t("common.take")}</span><span>{costLabel(take) ? say(costLabel(take) ?? "") : t("common.pending")}</span></li>)}
      </ul>}
      <p className="u-small">{t("sheet.topUp")}</p>
    </div>
  </SheetFrame>;
}

export function CoffreSheet() {
  const { t, say } = useI18n();
  const { setSheet, studio, exportCoffre, importCoffre, linkFolder, folder, guide, guideOff, createNamedProject, selectNamedProject } = useStudio();
  const [bytes, setBytes] = useState<number | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [linkable, setLinkable] = useState(false);
  const [importing, setImporting] = useState(false);
  const [draft, setDraft] = useState(studio.projects.length === 0 ? DEFAULT_PROJECT_NAME : "");

  useEffect(() => {
    setLinkable(folderLinkSupported());
    void navigator.storage?.estimate?.().then(estimate => {
      if (estimate.usage !== undefined) setBytes(estimate.usage);
    });
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  const usage = bytes === null ? "" : t("sheet.usageOnDevice", { amount: (bytes / 1048576).toFixed(1) });

  return <SheetFrame title={t("nav.studio")} label={t("sheet.memory")} onClose={() => setSheet(null)}>
    <div className="u-stack">
      <p>{t("sheet.studioIntro")}</p>
      <div role="radiogroup" aria-label={t("sheet.currentProject")} className="u-project-list">
        {studio.projects.map(item => <label key={item.slug}>
          <input type="radio" name="projet" checked={studio.project === item.slug} onChange={() => void selectNamedProject(item.slug)} />
          <span>{item.name}</span>
        </label>)}
      </div>
      <label className="u-field">{t("sheet.projectName")}
        <input value={draft} maxLength={40} aria-label={t("sheet.projectName")} autoComplete="off" onChange={event => setDraft(event.target.value)} />
      </label>
      <button type="button" className={studio.projects.length === 0 ? "u-primary" : "u-secondary"} disabled={!draft.trim()} onClick={() => { const name = draft.trim(); setDraft(""); void createNamedProject(name); }}>{t("sheet.createProject")}</button>
      <Why on={!draft.trim()} text={t("why.needName")} />
      <button type="button" className="u-secondary" onClick={() => setSheet("shots")}>{t("shot.title")}</button>
      <button type="button" className="u-secondary" onClick={() => setSheet("sequences")}>{t("sequence.title")}</button>
      {studio.project && <button type="button" className="u-secondary" onClick={() => setSheet({ memory: "bible" })}>{t("memory.open")}</button>}
      <p className="u-small">{t("sheet.exportLead")}</p>
      <button type="button" className={studio.projects.length === 0 ? "u-secondary" : "u-primary"} onClick={() => void exportCoffre()}>{t("sheet.export")}</button>
      <label className="u-secondary u-file">
        {importing ? t("sheet.importing") : t("sheet.import")}
        <input type="file" accept=".zip,application/zip" aria-label={t("sheet.importLabel")} disabled={importing} onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setImporting(true);
          void importCoffre(file).finally(() => setImporting(false));
        }} />
      </label>
      {linkable && <button type="button" className="u-secondary" onClick={() => void linkFolder()}>{folder ? t("sheet.linkedFolder", { name: folder }) : t("sheet.linkObsidian")}</button>}
      {!linkable && <p className="u-small">{t("sheet.phoneZip")}</p>}
      <p className="u-small">{t("sheet.keysOut")}</p>
      <ul className="u-ledger">
        <li><span>{t("sheet.referencePhotos")}</span><span>{studio.look.photos.length}</span></li>
        <li><span>{t("tree.places")}</span><span>{studio.scenes.length}</span></li>
        <li><span>{t("sheet.clips")}</span><span>{studio.clips.length}</span></li>
        <li><span>{t("sheet.doubles")}</span><span>{studio.loras.length}</span></li>
        <li><span>{t("tree.takes")}</span><span>{studio.takes.length}</span></li>
      </ul>
      <p className="u-small">{usage}{persisted === false ? t("sheet.usageVolatile") : persisted ? t("sheet.usageHeld") : ""}</p>
      <p className="u-small">{t("sheet.obsidian")}</p>
      {studio.tree.length > 0 && <ul className="u-tree" aria-label={t("sheet.folders")}>
        {studio.tree.map(group => <li key={group.label}><strong>{say(group.label)}</strong>{group.files.map(file => {
          const rawStem = group.label === "Séquences" && file !== "index.md" && file.endsWith(".md") ? file.slice(0, -3) : "";
          const fromMontage = rawStem.endsWith("-montage") ? rawStem.slice(0, -"-montage".length) : "";
          const sequenceId = fromMontage || rawStem;
          const shotId = group.label === "Plans" && file !== "index.md" && file.endsWith(".md") ? file.slice(0, -3) : "";
          const sequenceName = fromMontage ? (studio.sequences.find(item => item.id === sequenceId)?.name || sequenceId) : "";
          const label = fromMontage ? t("sequence.listFile", { name: sequenceName }) : say(treeFileLabel(group.label, file));
          const memory = memoryKindOf(group.label, file);
          if (sequenceId) return <button key={file} type="button" className="u-link" onClick={() => setSheet({ sequence: sequenceId })}>{label}</button>;
          if (shotId) return <button key={file} type="button" className="u-link" onClick={() => setSheet({ shot: shotId })}>{label}</button>;
          if (memory) return <button key={file} type="button" className="u-link" onClick={() => setSheet({ memory })}>{memory === "prompts" && file !== "index.md" ? file : t(`memory.${memory}`)}</button>;
          return <span key={file}>{label}</span>;
        })}</li>)}
      </ul>}
      <div className="u-row">
        <a className="u-link u-muted" href={assetPath("/compte")}>{t("sheet.optionalAccount")}</a>
        {!guide.off && <button type="button" className="u-link u-muted" onClick={guideOff}>{t("sheet.guideOff")}</button>}
      </div>
    </div>
  </SheetFrame>;
}

export function ConfirmSheet() {
  const { t, say } = useI18n();
  const { setSheet, settings, balance, gate, confirmRun, scene, line, engine, chosenLora, loraResolution, falBalance, falBalanceOptional, studio } = useStudio();
  const format = settings.aspect === "vertical" ? "9:16" : settings.aspect === "horizontal" ? "16:9" : "1:1";
  const place = scene ? { name: scene.name, note: scene.note, stills: scene.stills, render: scene.render } : null;
  const outgoing = priseOutgoingText({
    traits: studio.look.traits,
    photos: studio.look.photos,
    place,
    line,
    engine: engine === "lora" ? "lora" : "comfy",
    subject: chosenLora?.trigger,
  });
  const canConfirm = gate.allowed && gate.line.trim().length > 0 && outgoing.trim().length > 0;
  const shoot = useRef(confirmRun);
  shoot.current = confirmRun;
  useEffect(() => {
    if (!canConfirm) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
      event.preventDefault();
      void shoot.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [canConfirm]);
  return <SheetFrame title={t("sheet.confirmShoot")} label={t("sheet.confirm")} onClose={() => setSheet(null)}>
    <div className="u-stack">
      <ul className="u-ledger">
        <li><span>{t("sheet.place")}</span><span>{scene?.name ?? "—"}</span></li>
        <li><span>{t("take.action")}</span><span>{line.trim() || t("sheet.noLine")}</span></li>
        {engine === "lora"
          ? <>
            <li><span>{t("nav.character")}</span><span>{chosenLora?.name || t("common.character")}</span></li>
            <li><span>{t("sheet.setting")}</span><span>{format} · {settings.seconds} s · {loraResolution === "480P" ? "480p" : "768p"}</span></li>
            <li><span>{t("sheet.yourBalance")}</span><span>{falBalance ? formatUsd(falBalance.usd) : falBalanceOptional ? t("sheet.unread") : t("sheet.unreadable")}</span></li>
          </>
          : <>
            <li><span>{t("sheet.setting")}</span><span>{format} · {settings.seconds} s · {settings.quality === "rapide" ? t("sheet.fast") : t("sheet.fine")}</span></li>
            <li><span>{t("sheet.yourBalance")}</span><span>{balance ? t("sheet.credits", { amount: formatCredits(balance.credits) }) : t("sheet.unreadable")}</span></li>
          </>}
      </ul>
      <p className={`u-cost is-${gate.tone}`}>{say(gate.line)}</p>
      <OutgoingTake />
      <button type="button" className="u-primary" disabled={!canConfirm} onClick={() => void confirmRun()}>{engine === "lora" ? t("sheet.shootFal") : t("sheet.shootRender")}</button>
      <Why on={!canConfirm} text={t("why.hold")} />
      <p className="u-small">{t("sheet.nothing")}</p>
    </div>
  </SheetFrame>;
}

export function FalSheet({ framed = true }: { framed?: boolean } = {}) {
  const { t, say } = useI18n();
  const { setSheet, falLinked, falUsername, falBalanceNote, connectFal, disconnectFal, setNotice } = useStudio();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function linkKey() {
    setBusy(true);
    setError("");
    const problem = await connectFal(key);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    setNotice("Compte fal relié.");
    setSheet(null);
  }

  const body = <div className="u-stack">
    {falLinked
      ? <div className="u-stack">
        <p>{t("sheet.falLinkedBody", { name: falUsername ? t("sheet.falTo", { name: falUsername }) : "", engine: t("engine.lora.label") })}</p>
        <button type="button" className="u-secondary" onClick={disconnectFal}>{t("sheet.unlink")}</button>
      </div>
      : <div className="u-stack">
        <p>{t("sheet.falIntro")}</p>
        <p className="u-small">{t("sheet.falScope")}</p>
        <a className="u-link" href="https://fal.ai/dashboard/keys" target="_blank" rel="noreferrer">{t("sheet.createFalKey")}</a>
        <label className="u-field">
          <span className="u-label">{t("sheet.falKey")}</span>
          <input id="u-fal-key" type="password" value={key} autoComplete="off" spellCheck={false} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:…" onChange={event => setKey(event.target.value)} />
        </label>
        <p className="u-small">{t("sheet.falKeyHint")}</p>
        {(error || falBalanceNote) && <p className="u-small is-error" role="alert">{say(error || falBalanceNote)}</p>}
        <button type="button" className="u-primary" disabled={busy || !key.trim()} onClick={() => void linkKey()}>{busy ? t("sheet.checking") : framed ? t("verb.relier") : t("sheet.linkFal")}</button>
        <Why on={!busy && !key.trim()} text={t("why.needKey")} />
      </div>}
  </div>;
  if (!framed) return body;
  return <SheetFrame title={t("sheet.falTitle")} label={t("verb.relier")} onClose={() => setSheet(null)}>{body}</SheetFrame>;
}

export function RelierSheet() {
  const { t } = useI18n();
  const { setSheet } = useStudio();
  return <SheetFrame title={t("sheet.relierTitle")} label={t("sheet.accountsTitle")} onClose={() => setSheet(null)} tall>
    <section className="u-payer">
      <p className="u-label">{t("sheet.falAccount")}</p>
      <p>{t("sheet.falPaysTrain", { engine: t("engine.lora.label") })}</p>
      <FalSheet framed={false} />
    </section>
    <section className="u-payer">
      <p className="u-label">{t("sheet.renderAccount")}</p>
      <p>{t("sheet.referencesPays", { engine: t("engine.comfy.label") })}</p>
      <ConnectSheet framed={false} />
    </section>
  </SheetFrame>;
}

export function TrainConfirmSheet() {
  const { t, say } = useI18n();
  const { setSheet, studio, dataset, trainingSteps, falBalance, falBalanceOptional, trainGate, confirmTraining } = useStudio();
  return <SheetFrame title={t("sheet.confirmTrain")} label={t("sheet.confirm")} onClose={() => setSheet(null)}>
    <div className="u-stack">
      <ul className="u-ledger">
        <li><span>{t("nav.character")}</span><span>{studio.role.name || "—"}</span></li>
        <li><span>{t("lora.clips")}</span><span>{dataset.clips}</span></li>
        <li><span>{t("lora.learning")}</span><span>{t("lora.steps", { count: trainingSteps })}</span></li>
        <li><span>{t("take.format")}</span><span>{dataset.aspect}</span></li>
        <li><span>{t("sheet.yourBalance")}</span><span>{falBalance ? formatUsd(falBalance.usd) : falBalanceOptional ? t("sheet.unread") : t("sheet.unreadable")}</span></li>
      </ul>
      <p className={`u-cost is-${trainGate.tone}`}>{say(trainGate.line)}</p>
      <OutgoingPersonnage />
      <button type="button" className="u-primary" disabled={!trainGate.allowed} onClick={() => void confirmTraining()}>{t("sheet.trainDebit")}</button>
      <Why on={!trainGate.allowed} text={t("why.hold")} />
      <p className="u-small">{t("sheet.nothing")}</p>
    </div>
  </SheetFrame>;
}

export function PrevizConfirmSheet() {
  const { t, say } = useI18n();
  const { setSheet, scene, previzGate, confirmPreviz } = useStudio();
  const plan = scene?.previz === "quai" ? "Quai" : scene?.previz === "rue" ? "Rue" : scene?.previz === "piece" ? "Pièce" : "—";
  const lens = scene?.camera?.lens;
  return <SheetFrame title={t("sheet.confirmFilm")} label={t("sheet.confirm")} onClose={() => setSheet(null)}>
    <div className="u-stack">
      <ul className="u-ledger">
        <li><span>{t("sheet.place")}</span><span>{scene?.name || "—"}</span></li>
        <li><span>{t("scene.plan")}</span><span>{plan}</span></li>
        <li><span>{t("scene.lens")}</span><span>{lens ? `${lens} mm` : "—"}</span></li>
      </ul>
      <p className={`u-cost is-${previzGate.tone}`}>{say(previzGate.line)}</p>
      <p className="u-small">{t("sheet.filmBody")}</p>
      <OutgoingFilm />
      <button type="button" className="u-primary" disabled={!previzGate.allowed} onClick={() => void confirmPreviz()}>{t("sheet.filmDebit")}</button>
      <Why on={!previzGate.allowed} text={t("why.hold")} />
      <p className="u-small">{t("sheet.nothing")}</p>
    </div>
  </SheetFrame>;
}

export function BlenderSheet() {
  const { t, say } = useI18n();
  const { setSheet, blenderLinked, connectBlender, disconnectBlender, setNotice } = useStudio();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");

  function linkKey() {
    const problem = connectBlender(key);
    if (problem) {
      setError(problem);
      return;
    }
    setNotice("Clé Blender tenue sur cet appareil.");
    setSheet(null);
  }

  return <SheetFrame title="Blender" label={t("verb.relier")} onClose={() => setSheet(null)}>
    {blenderLinked
      ? <div className="u-stack">
        <p>{t("sheet.blenderLinked")}</p>
        <button type="button" className="u-secondary" onClick={() => { disconnectBlender(); setNotice("Clé Blender retirée de cet appareil."); setSheet(null); }}>{t("sheet.unlinkBlender")}</button>
      </div>
      : <div className="u-stack">
        <p>{t("sheet.blenderIntro")}</p>
        <label className="u-field">
          <span className="u-label">{t("sheet.jobKey")}</span>
          <input type="password" value={key} autoComplete="off" spellCheck={false} placeholder="farpy_agent_…" onChange={event => setKey(event.target.value)} />
        </label>
        <p className="u-small">{t("sheet.keyStays")}</p>
        {error && <p className="u-small is-error" role="alert">{say(error)}</p>}
        <button type="button" className="u-primary" disabled={!key.trim()} onClick={linkKey}>{t("verb.relier")}</button>
        <Why on={!key.trim()} text={t("why.needKey")} />
      </div>}
  </SheetFrame>;
}

export function PlaceTrainSheet() {
  const { t, say } = useI18n();
  const { setSheet, scene, falBalance, falBalanceOptional, placeTrainQuote, placeTrainGate, confirmPlaceTrain } = useStudio();
  return <SheetFrame title={t("sheet.confirmPlace")} label={t("sheet.confirm")} onClose={() => setSheet(null)}>
    <div className="u-stack">
      <ul className="u-ledger">
        <li><span>{t("sheet.place")}</span><span>{scene?.name || "—"}</span></li>
        <li><span>{t("sheet.views")}</span><span>{(scene?.stills.length ?? 0) + (scene?.frames.length ?? 0) + (scene?.views.length ?? 0)}</span></li>
        <li><span>{t("lora.learning")}</span><span>{t("sheet.styleSteps")}</span></li>
        <li><span>{t("sheet.price")}</span><span>{placeTrainQuote !== null ? formatUsd(placeTrainQuote) : t("sheet.unreadable")}</span></li>
        <li><span>{t("sheet.yourBalance")}</span><span>{falBalance ? formatUsd(falBalance.usd) : falBalanceOptional ? t("sheet.unread") : t("sheet.unreadable")}</span></li>
      </ul>
      <p className={`u-cost is-${placeTrainGate.tone}`}>{say(placeTrainGate.line)}</p>
      <p className="u-small">{t("sheet.placeTrainBody")}</p>
      <OutgoingLieu />
      <button type="button" className="u-primary" disabled={!placeTrainGate.allowed} onClick={() => void confirmPlaceTrain()}>{t("sheet.placeTrainDebit")}</button>
      <Why on={!placeTrainGate.allowed} text={t("why.hold")} />
      <p className="u-small">{t("sheet.nothing")}</p>
    </div>
  </SheetFrame>;
}

export function PlaceSceneSheet() {
  const { t, say } = useI18n();
  const { setSheet, scene, falBalance, falBalanceOptional, placeSceneQuote, placeSceneGate, confirmPlaceScene } = useStudio();
  return <SheetFrame title={t("sheet.confirmStill")} label={t("sheet.confirm")} onClose={() => setSheet(null)}>
    <div className="u-stack">
      <ul className="u-ledger">
        <li><span>{t("sheet.place")}</span><span>{scene?.name || "—"}</span></li>
        <li><span>{t("sheet.file")}</span><span>{t("sheet.placeFile")}</span></li>
        <li><span>{t("sheet.price")}</span><span>{placeSceneQuote !== null ? formatUsd(placeSceneQuote) : t("sheet.unreadable")}</span></li>
        <li><span>{t("sheet.yourBalance")}</span><span>{falBalance ? formatUsd(falBalance.usd) : falBalanceOptional ? t("sheet.unread") : t("sheet.unreadable")}</span></li>
      </ul>
      <p className={`u-cost is-${placeSceneGate.tone}`}>{say(placeSceneGate.line)}</p>
      <p className="u-small">{t("sheet.stillBody")}</p>
      <button type="button" className="u-primary" disabled={!placeSceneGate.allowed} onClick={() => void confirmPlaceScene()}>{t("sheet.buildDebit")}</button>
      <Why on={!placeSceneGate.allowed} text={t("why.hold")} />
      <p className="u-small">{t("sheet.nothing")}</p>
    </div>
  </SheetFrame>;
}

export function MemorySheet({ focus }: { focus: MemoryKind }) {
  const { t } = useI18n();
  const { setSheet, studio } = useStudio();
  return <SheetFrame title={t("memory.title")} label={studio.projectName || t("sheet.currentProject")} onClose={() => setSheet(null)} tall>
    <ProjectMemory focus={focus} heading={false} />
  </SheetFrame>;
}

export function PlayerSheet({ id }: { id: string }) {
  const { t, say } = useI18n();
  const { date } = useStudioDates();
  const { setSheet, studio, media, deleteTake } = useStudio();
  const take = studio.takes.find(item => item.id === id);
  if (!take) return <SheetFrame title={t("sequence.missingTake")} label={t("common.take")} onClose={() => setSheet(null)}>
    <p className="u-small">{t("sequence.missingTake")}</p>
    <button type="button" className="u-link" onClick={() => setSheet("sequences")}>{t("sequence.back")}</button>
  </SheetFrame>;
  const priced = costLabel(take);
  return <SheetFrame title={take.line || t("common.take")} label={take.sceneName || t("common.take")} onClose={() => setSheet(null)} tall>
    <div className="u-stack">
      {media[take.video] && <video src={media[take.video]} poster={take.poster ? media[take.poster] : undefined} controls autoPlay muted loop playsInline className={`u-player is-${take.settings.aspect}`} />}
      <ul className="u-ledger">
        <li><span>{t("sheet.shot")}</span><span>{date.format(new Date(take.at))}</span></li>
        <li><span>{t("sheet.setting")}</span><span>{take.profile}</span></li>
        <li><span>{t("sheet.debit")}</span><span>{priced ? say(priced) : t("common.notReadYet")}</span></li>
        {take.gpuSeconds !== null && <li><span>{t("sheet.compute")}</span><span>{take.gpuSeconds} s</span></li>}
      </ul>
      <TakeCostLines take={take} />
      <PublishActions take={take} />
      <ProjectMemory heading />
      {studio.sequences.filter(sequence => sequence.links.some(link => link.takeId === take.id)).map(sequence => <button key={sequence.id} type="button" className="u-link" onClick={() => setSheet({ sequence: sequence.id })}>{t("sequence.inSequence", { name: sequence.name || t("common.unnamed") })}</button>)}
      <button type="button" className="u-link" onClick={() => setSheet("sequences")}>{t("sequence.title")}</button>
      {studio.shots.filter(shot => shot.takeIds.includes(take.id)).map(shot => <button key={shot.id} type="button" className="u-link" onClick={() => setSheet({ shot: shot.id })}>{t("shot.inShot", { name: shot.name || t("common.unnamed") })}</button>)}
      <button type="button" className="u-link" onClick={() => setSheet("shots")}>{t("shot.title")}</button>
      <button type="button" className="u-link" onClick={() => setSheet({ outputs: "prise" })}>{t("job.outputs")}</button>
      <button type="button" className="u-link u-muted" onClick={() => { void deleteTake(take.id); setSheet(null); }}><Trash /> {t("sheet.removeFromStudio")}</button>
    </div>
  </SheetFrame>;
}

function rowIndexAt(list: HTMLOListElement | null, clientY: number): number | null {
  if (!list) return null;
  const items = [...list.querySelectorAll(":scope > li")];
  if (items.length === 0) return null;
  for (let index = 0; index < items.length; index += 1) {
    const rect = items[index].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return index;
  }
  return items.length - 1;
}

function SequencePlayer({ sequenceId }: { sequenceId: string }) {
  const { t } = useI18n();
  const { studio, media } = useStudio();
  const cues = montageCues(studio.shots, studio.takes, sequenceId);
  const cueKey = cues.map(cue => `${cue.ordre}:${cue.shotId}:${cue.takeId ?? "slate"}:${cue.source ?? ""}`).join("|");
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const indexRef = useRef(0);
  const lengthRef = useRef(cues.length);
  indexRef.current = index;
  lengthRef.current = cues.length;
  const advance = useCallback(() => {
    const current = indexRef.current;
    if (current + 1 >= lengthRef.current) setFinished(true);
    else setIndex(current + 1);
  }, []);
  useEffect(() => {
    setIndex(0);
    setFinished(false);
  }, [cueKey]);
  const cue = cues[index];
  const src = cue?.source ? media[cue.source] : undefined;
  const slate = !cue?.source || !src;
  useEffect(() => {
    if (!slate || finished || !cue) return;
    const timer = window.setTimeout(advance, MONTAGE_SLATE_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [advance, cue, finished, index, slate]);
  if (!cue) return null;
  return <div className="u-montage-play" data-montage="on" data-montage-index={index} data-montage-kind={slate ? "slate" : "video"} data-montage-shot={cue.shotId} data-montage-done={finished ? "true" : "false"}>
    <p className="u-label" aria-live="polite">{t("sequence.now")} · {t("sequence.beat", { index: index + 1, count: cues.length })}</p>
    <p>{cue.shotName || t("common.unnamed")}{cue.takeLine ? ` · ${cue.takeLine}` : ""}</p>
    {slate
      ? <div className="u-slate"><strong>{t("sequence.slate")}</strong><span>{t("sequence.slateBody")}</span></div>
      : <video key={`${index}:${cue.source}`} src={src} autoPlay muted playsInline className="u-player" onEnded={advance} onError={advance} />}
    {finished && <p className="u-small">{t("sequence.end")}</p>}
    {finished && <button type="button" className="u-link" onClick={() => { setFinished(false); setIndex(0); }}>{t("sequence.again")}</button>}
  </div>;
}

function PlanOrder({ sequenceId }: { sequenceId: string }) {
  const { t } = useI18n();
  const { setSheet, studio, moveShotInSequence, reorderShots } = useStudio();
  const panels = shotsOf(studio.shots, sequenceId);
  const list = useRef<HTMLOListElement>(null);
  const origin = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (origin.current === null) return;
    setOver(rowIndexAt(list.current, event.clientY));
  };
  const finish = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (origin.current === null) return;
    const start = origin.current;
    origin.current = null;
    setOver(null);
    const target = rowIndexAt(list.current, event.clientY);
    if (target === null || target === start) return;
    const ids = panels.map(shot => shot.id);
    const [item] = ids.splice(start, 1);
    ids.splice(target, 0, item);
    void reorderShots(sequenceId, ids);
  };
  if (panels.length === 0) return <p className="u-small">{t("shot.emptyHere")}</p>;
  return <ol className="u-sequence" ref={list} aria-label={t("shot.title")}>
    {panels.map((shot, index) => {
      const name = shot.name || t("common.unnamed");
      const linked = shot.takeIds.filter(id => studio.takes.some(take => take.id === id && take.video)).length;
      return <li key={shot.id} className={over === index ? "is-drop" : undefined}>
        <button type="button" className="u-link" onClick={() => setSheet({ shot: shot.id })} aria-label={t("shot.open", { name })}>{name}</button>
        <p className="u-small">{linked === 0 ? t("sequence.slate") : linked === 1 ? t("sequence.oneTake") : t("sequence.manyTakes", { count: linked })}</p>
        <div className="u-row">
          <button
            type="button"
            className="u-drag"
            aria-label={t("sequence.drag", { name })}
            onPointerDown={event => {
              if (event.button !== 0) return;
              origin.current = index;
              event.currentTarget.setPointerCapture(event.pointerId);
              setOver(index);
            }}
            onPointerMove={move}
            onPointerUp={finish}
            onPointerCancel={() => { origin.current = null; setOver(null); }}
          >{t("sequence.dragHandle")}</button>
          {index > 0 && <button type="button" className="u-link" onClick={() => void moveShotInSequence(shot.id, -1)}>{t("sequence.up")}</button>}
          {index < panels.length - 1 && <button type="button" className="u-link" onClick={() => void moveShotInSequence(shot.id, 1)}>{t("sequence.down")}</button>}
        </div>
      </li>;
    })}
  </ol>;
}

export function SequenceSheet({ id }: { id?: string }) {
  if (id) return <SequenceEditor id={id} />;
  return <SequenceList />;
}

function SequenceList() {
  const { t } = useI18n();
  const { setSheet, studio, createSequence } = useStudio();
  const [draft, setDraft] = useState(() => nextNumberedName(t("sequence.defaultName"), studio.sequences.map(item => item.name)));
  return <SheetFrame title={t("sequence.title")} label={t("scene.project")} onClose={() => setSheet(null)} tall>
    <div className="u-stack">
      <p className="u-small">{t("sequence.lead")}</p>
      <label className="u-field">{t("sequence.name")}
        <input value={draft} maxLength={40} aria-label={t("sequence.name")} autoComplete="off" onChange={event => setDraft(event.target.value)} />
      </label>
      <button type="button" className="u-secondary" disabled={!draft.trim()} onClick={() => { const name = draft.trim(); setDraft(""); void createSequence(name); }}>{t("sequence.create")}</button>
      <Why on={!draft.trim()} text={t("why.needName")} />
      {studio.sequences.length === 0
        ? <p className="u-small">{t("sequence.empty")}</p>
        : <ul className="u-sequence">
          {studio.sequences.map(sequence => <li key={sequence.id}>
            <button type="button" className="u-link" onClick={() => setSheet({ sequence: sequence.id })} aria-label={t("sequence.open", { name: sequence.name })}>{sequence.name || t("common.unnamed")}</button>
            <p className="u-small">{sequence.links.length === 0 ? t("sequence.noLink") : sequence.links.length === 1 ? t("sequence.oneTake") : t("sequence.manyTakes", { count: sequence.links.length })}</p>
          </li>)}
        </ul>}
    </div>
  </SheetFrame>;
}

function SequenceEditor({ id }: { id: string }) {
  const { t } = useI18n();
  const { setSheet, studio, saveSequence, deleteSequence, setNotice, createShot, refreshMontage, exportCoffre } = useStudio();
  const sequence = studio.sequences.find(item => item.id === id);
  const [name, setName] = useState(sequence?.name ?? "");
  const [pick, setPick] = useState("");
  const [shotName, setShotName] = useState(() => nextNumberedName(t("shot.defaultName"), studio.shots.map(item => item.name)));
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setName(sequence?.name ?? "");
  }, [sequence?.id, sequence?.name]);
  useEffect(() => {
    setPlaying(false);
    void refreshMontage(id);
  }, [id, refreshMontage]);
  if (!sequence) return null;
  const available = studio.takes.filter(take => !sequence.links.some(link => link.takeId === take.id));
  const chosen = available.some(take => take.id === pick) ? pick : available[0]?.id ?? "";
  const blocked = available.length === 0;
  return <SheetFrame title={sequence.name || t("common.unnamed")} label={t("sequence.title")} onClose={() => setSheet(null)} tall>
    <div className="u-stack">
      <p className="u-small">{t("sequence.lead")}</p>
      <button type="button" className="u-link" onClick={() => setSheet("sequences")}>{t("sequence.back")}</button>
      <label className="u-field">{t("sequence.name")}
        <input value={name} maxLength={40} aria-label={t("sequence.name")} autoComplete="off" onChange={event => {
          const next = event.target.value.slice(0, 40);
          setName(next);
          if (next.trim()) void saveSequence(sequence.id, { name: next });
        }} onBlur={() => { if (!name.trim()) setName(sequence.name); }} />
      </label>
      <section className="u-montage" aria-label={t("sequence.play")}>
        <p className="u-label">{t("shot.title")}</p>
        <button type="button" className="u-primary" disabled={shotsOf(studio.shots, sequence.id).length === 0} onClick={() => setPlaying(true)}>{t("sequence.play")}</button>
        <Why on={shotsOf(studio.shots, sequence.id).length === 0} text={t("sequence.playOff")} />
        <p className="u-small">{t("sequence.exportHint")}</p>
        <button type="button" className="u-link" onClick={() => void exportCoffre()}>{t("sheet.export")}</button>
        {playing && <SequencePlayer sequenceId={sequence.id} />}
        {playing && <button type="button" className="u-link" onClick={() => setPlaying(false)}>{t("sequence.stop")}</button>}
        <p className="u-small">{t("sequence.listNote")}</p>
        <PlanOrder sequenceId={sequence.id} />
      </section>
      <label className="u-field">{t("shot.name")}
        <input value={shotName} maxLength={40} aria-label={t("shot.name")} autoComplete="off" onChange={event => setShotName(event.target.value)} />
      </label>
      <button type="button" className="u-secondary" disabled={!shotName.trim()} onClick={() => { const next = shotName.trim(); setShotName(""); void createShot(next, { sequenceId: sequence.id }); }}>{t("shot.create")}</button>
      <Why on={!shotName.trim()} text={t("why.needName")} />
      {sequence.links.length === 0
        ? <p className="u-small">{t("sequence.noLink")}</p>
        : <ol className="u-sequence">
          {sequence.links.map((link, index) => {
            const take = studio.takes.find(item => item.id === link.takeId);
            const label = take?.line.trim() || take?.sceneName || t("sequence.missingTake");
            return <li key={link.takeId}>
              <button type="button" className="u-link" onClick={() => setSheet({ take: link.takeId })} aria-label={t("scene.openTake", { line: label })}>{label}</button>
              {index === 0
                ? <p className="u-small">{t("sequence.first")}</p>
                : <label className="u-field">{t("sequence.raccord")}
                  <textarea value={link.raccord} rows={2} maxLength={240} aria-label={t("sequence.raccord")} placeholder={t("sequence.raccordHint")} onChange={event => {
                    const raccord = event.target.value.slice(0, 240);
                    void saveSequence(sequence.id, { links: sequence.links.map((item, at) => at === index ? { ...item, raccord } : item) });
                  }} />
                </label>}
              <div className="u-row">
                {index > 0 && <button type="button" className="u-link" onClick={() => {
                  const links = [...sequence.links];
                  const [item] = links.splice(index, 1);
                  links.splice(index - 1, 0, item);
                  void saveSequence(sequence.id, { links });
                }}>{t("sequence.up")}</button>}
                {index < sequence.links.length - 1 && <button type="button" className="u-link" onClick={() => {
                  const links = [...sequence.links];
                  const [item] = links.splice(index, 1);
                  links.splice(index + 1, 0, item);
                  void saveSequence(sequence.id, { links });
                }}>{t("sequence.down")}</button>}
                <button type="button" className="u-link u-muted" onClick={() => void saveSequence(sequence.id, { links: dropTakeLink(sequence.links, link.takeId) })}>{t("sequence.removeLink")}</button>
              </div>
            </li>;
          })}
        </ol>}
      {!blocked && <label className="u-field">{t("sequence.pick")}
        <select aria-label={t("sequence.pick")} value={chosen} onChange={event => setPick(event.target.value)}>
          {available.map(take => <option key={take.id} value={take.id}>{take.line.trim() || take.sceneName || t("common.take")}</option>)}
        </select>
      </label>}
      <button type="button" className="u-secondary" disabled={blocked} onClick={() => {
        if (!chosen) return;
        void saveSequence(sequence.id, { links: [...sequence.links, { takeId: chosen, raccord: "" }] });
        setNotice("Prise ajoutée.");
      }}>{t("sequence.add")}</button>
      <Why on={blocked} text={studio.takes.length === 0 ? t("sequence.noTake") : t("sequence.allLinked")} />
      <button type="button" className="u-link u-muted" onClick={() => void deleteSequence(sequence.id)}>{t("sequence.delete")}</button>
    </div>
  </SheetFrame>;
}

export function ShotSheet({ id }: { id?: string }) {
  if (id) return <ShotEditor id={id} />;
  return <ShotList />;
}

function ShotList() {
  const { t } = useI18n();
  const { setSheet, studio, createShot } = useStudio();
  const [draft, setDraft] = useState(() => nextNumberedName(t("shot.defaultName"), studio.shots.map(item => item.name)));
  return <SheetFrame title={t("shot.title")} label={t("scene.project")} onClose={() => setSheet(null)} tall>
    <div className="u-stack">
      <p className="u-small">{t("shot.lead")}</p>
      <label className="u-field">{t("shot.name")}
        <input value={draft} maxLength={40} aria-label={t("shot.name")} autoComplete="off" onChange={event => setDraft(event.target.value)} />
      </label>
      <button type="button" className="u-secondary" disabled={!draft.trim()} onClick={() => { const name = draft.trim(); setDraft(""); void createShot(name); }}>{t("shot.create")}</button>
      <Why on={!draft.trim()} text={t("why.needName")} />
      {studio.shots.length === 0
        ? <p className="u-small">{t("shot.empty")}</p>
        : <ul className="u-sequence">
          {studio.shots.map(shot => <li key={shot.id}>
            <button type="button" className="u-link" onClick={() => setSheet({ shot: shot.id })} aria-label={t("shot.open", { name: shot.name })}>{shot.name || t("common.unnamed")}</button>
            <p className="u-small">{shot.note || (shot.takeIds.length === 0 ? t("shot.noTake") : shot.takeIds.length === 1 ? t("sequence.oneTake") : t("sequence.manyTakes", { count: shot.takeIds.length }))}</p>
          </li>)}
        </ul>}
    </div>
  </SheetFrame>;
}

function ShotEditor({ id }: { id: string }) {
  const { t } = useI18n();
  const { setSheet, studio, saveShot, deleteShot } = useStudio();
  const shot = studio.shots.find(item => item.id === id);
  const [name, setName] = useState(shot?.name ?? "");
  const [pick, setPick] = useState("");
  useEffect(() => {
    setName(shot?.name ?? "");
  }, [shot?.id, shot?.name]);
  if (!shot) return null;
  const available = studio.takes.filter(take => !shot.takeIds.includes(take.id));
  const chosen = available.some(take => take.id === pick) ? pick : available[0]?.id ?? "";
  const blocked = available.length === 0;
  const missingSequence = Boolean(shot.sequenceId && !studio.sequences.some(item => item.id === shot.sequenceId));
  return <SheetFrame title={shot.name || t("common.unnamed")} label={t("shot.title")} onClose={() => setSheet(null)} tall>
    <div className="u-stack">
      <p className="u-small">{t("shot.lead")}</p>
      <button type="button" className="u-link" onClick={() => setSheet("shots")}>{t("shot.back")}</button>
      <label className="u-field">{t("shot.name")}
        <input value={name} maxLength={40} aria-label={t("shot.name")} autoComplete="off" onChange={event => {
          const next = event.target.value.slice(0, 40);
          setName(next);
          if (next.trim()) void saveShot(shot.id, { name: next });
        }} onBlur={() => { if (!name.trim()) setName(shot.name); }} />
      </label>
      <label className="u-field">{t("shot.note")}
        <textarea value={shot.note} rows={2} maxLength={240} aria-label={t("shot.note")} placeholder={t("shot.noteHint")} onChange={event => void saveShot(shot.id, { note: event.target.value.slice(0, 240) })} />
      </label>
      <label className="u-field">{t("shot.sequence")}
        <select aria-label={t("shot.sequence")} value={shot.sequenceId ?? ""} onChange={event => void saveShot(shot.id, { sequenceId: event.target.value || null })}>
          <option value="">{t("shot.noSequence")}</option>
          {missingSequence && shot.sequenceId && <option value={shot.sequenceId}>{t("shot.missingSequence")}</option>}
          {studio.sequences.map(sequence => <option key={sequence.id} value={sequence.id}>{sequence.name || t("common.unnamed")}</option>)}
        </select>
      </label>
      {shot.sequenceId && studio.sequences.some(item => item.id === shot.sequenceId) && <button type="button" className="u-link" onClick={() => setSheet({ sequence: shot.sequenceId ?? "" })}>{t("sequence.inSequence", { name: studio.sequences.find(item => item.id === shot.sequenceId)?.name || t("common.unnamed") })}</button>}
      {shot.takeIds.length === 0
        ? <p className="u-small">{t("shot.noTake")}</p>
        : <ol className="u-sequence">
          {shot.takeIds.map((takeId, index) => {
            const take = studio.takes.find(item => item.id === takeId);
            const label = take?.line.trim() || take?.sceneName || t("sequence.missingTake");
            return <li key={takeId}>
              <button type="button" className="u-link" onClick={() => setSheet({ take: takeId })} aria-label={t("scene.openTake", { line: label })}>{label}</button>
              <div className="u-row">
                {index > 0 && <button type="button" className="u-link" onClick={() => {
                  const takeIds = [...shot.takeIds];
                  const [item] = takeIds.splice(index, 1);
                  takeIds.splice(index - 1, 0, item);
                  void saveShot(shot.id, { takeIds });
                }}>{t("sequence.up")}</button>}
                {index < shot.takeIds.length - 1 && <button type="button" className="u-link" onClick={() => {
                  const takeIds = [...shot.takeIds];
                  const [item] = takeIds.splice(index, 1);
                  takeIds.splice(index + 1, 0, item);
                  void saveShot(shot.id, { takeIds });
                }}>{t("sequence.down")}</button>}
                <button type="button" className="u-link u-muted" onClick={() => void saveShot(shot.id, { takeIds: shot.takeIds.filter(item => item !== takeId) })}>{t("shot.removeLink")}</button>
              </div>
            </li>;
          })}
        </ol>}
      {!blocked && <label className="u-field">{t("shot.pick")}
        <select aria-label={t("shot.pick")} value={chosen} onChange={event => setPick(event.target.value)}>
          {available.map(take => <option key={take.id} value={take.id}>{take.line.trim() || take.sceneName || t("common.take")}</option>)}
        </select>
      </label>}
      <button type="button" className="u-secondary" disabled={blocked} onClick={() => { if (chosen) void saveShot(shot.id, { takeIds: [...shot.takeIds, chosen] }); }}>{t("sequence.add")}</button>
      <Why on={blocked} text={studio.takes.length === 0 ? t("sequence.noTake") : t("shot.allLinked")} />
      <button type="button" className="u-link u-muted" onClick={() => void deleteShot(shot.id)}>{t("shot.delete")}</button>
      <CinemaGestures shotId={shot.id} />
    </div>
  </SheetFrame>;
}

export function OutputsSheet({ kind }: { kind: "prise" | "scene" | "lora" }) {
  const { t, say } = useI18n();
  const { setSheet, studio, media, scene, run, training, previz, placeRun, placeResult } = useStudio();
  const status = kind === "prise" ? run.phase
    : kind === "lora" ? training.phase
      : previz.phase !== "idle" ? previz.phase
        : placeResult.phase !== "idle" ? placeResult.phase
          : placeRun === "running" ? "running" : "idle";
  const reason = kind === "prise" && run.phase === "error" ? run.message
    : kind === "lora" && training.phase === "error" ? training.message
      : kind === "scene" && previz.phase === "error" ? previz.message
        : kind === "scene" && placeResult.phase === "error" ? placeResult.message
          : "";
  const takes = kind === "lora" ? []
    : kind === "scene" && scene ? studio.takes.filter(take => take.sceneId === scene.id || take.id === scene.shot)
      : studio.takes;
  const files = kind === "lora" ? studio.loras.filter(lora => !isPlaceLora(lora))
    : kind === "scene" && scene ? studio.loras.filter(lora => isPlaceLora(lora) && lora.sceneId === scene.id)
      : [];
  const lead = takes.find(take => media[take.video]);
  const still = kind === "scene" && scene?.render ? media[scene.render] : undefined;
  const empty = !lead && !still && files.length === 0;
  return <SheetFrame title={t("job.outputs")} label={t(kind === "lora" ? "nav.character" : kind === "scene" ? "nav.scene" : "nav.take")} onClose={() => setSheet(null)} tall>
    <div className="u-stack">
      <p className="u-small">{t("job.lead")}</p>
      {status === "running" && <p className="u-label">{t("job.running")}</p>}
      {status === "done" && <p className="u-label">{t("job.done")}</p>}
      {status === "error" && <div className="u-card u-soft-error" role="alert">
        <p className="u-crt">{t("take.soft")}</p>
        {reason && <p>{say(reason)}</p>}
      </div>}
      {still && <figure className="u-previz"><img src={still} alt="" /><figcaption>{t("job.latest")}</figcaption></figure>}
      {lead && <video src={media[lead.video]} poster={lead.poster ? media[lead.poster] : undefined} controls muted playsInline className={`u-player is-${lead.settings.aspect}`} />}
      {empty && <p className="u-small">{t("job.empty")}</p>}
      {takes.length > 0 && <ul className="u-sequence">
        {takes.map(take => <li key={take.id}>
          <button type="button" className="u-link" onClick={() => setSheet({ take: take.id })}>{take.line.trim() || take.sceneName || t("common.take")}</button>
        </li>)}
      </ul>}
      {files.length > 0 && <ul className="u-sequence">
        {files.map(lora => <li key={lora.id}>
          <p>{lora.name || t("common.unnamed")}</p>
          <p className="u-small">{t("lora.pass", { steps: lora.steps })}</p>
        </li>)}
      </ul>}
    </div>
  </SheetFrame>;
}
