"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n, useStudioDates } from "@/components/i18n/provider";
import { costLabel } from "@/lib/coffre/model";
import { treeFileLabel } from "@/lib/coffre/project";
import { CREDITS_PER_USD, claimBasis, formatCredits } from "@/lib/credits";
import { formatUsd } from "@/lib/fal/prices";
import { folderLinkSupported } from "@/lib/coffre/link";
import { takeProfile } from "@/lib/render/take-graph";
import { assetPath } from "@/lib/site";
import { Close, Refresh, Trash } from "./glyphs";
import { PublishActions } from "./publish";
import { sheetDismissAllowed } from "@/lib/link-epoch";
import { Why } from "./guide-bubble";
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
  const { setSheet, connected, balance, balanceNote, refreshBalance, claim, settings, studio, engine, falLinked, falBalance, falBalanceNote, refreshFal, trainQuote, disconnect, disconnectFal, blenderLinked, disconnectBlender } = useStudio();
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
          <p>{engine === "comfy" && claim.state === "measured" ? t("sheet.aboutClaim", { amount: formatCredits(claim.credits), basis: say(claimBasis(claim)) }) : t("sheet.uncalibratedClaim")}</p>
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
  const [draft, setDraft] = useState("");

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
      <button type="button" className="u-secondary" disabled={!draft.trim()} onClick={() => { const name = draft.trim(); setDraft(""); void createNamedProject(name); }}>{t("sheet.createProject")}</button>
      <Why on={!draft.trim()} text={t("why.needName")} />
      {studio.tree.length > 0 && <ul className="u-tree" aria-label={t("sheet.folders")}>
        {studio.tree.map(group => <li key={group.label}><strong>{say(group.label)}</strong>{group.files.map(file => <span key={file}>{say(treeFileLabel(group.label, file))}</span>)}</li>)}
      </ul>}
      <p className="u-small">{t("sheet.obsidian")}</p>
      <ul className="u-ledger">
        <li><span>{t("sheet.referencePhotos")}</span><span>{studio.look.photos.length}</span></li>
        <li><span>{t("tree.places")}</span><span>{studio.scenes.length}</span></li>
        <li><span>{t("sheet.clips")}</span><span>{studio.clips.length}</span></li>
        <li><span>{t("sheet.doubles")}</span><span>{studio.loras.length}</span></li>
        <li><span>{t("tree.takes")}</span><span>{studio.takes.length}</span></li>
      </ul>
      <p className="u-small">{usage}{persisted === false ? t("sheet.usageVolatile") : persisted ? t("sheet.usageHeld") : ""}</p>
      <button type="button" className="u-primary" onClick={() => void exportCoffre()}>{t("sheet.export")}</button>
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
      <div className="u-row">
        <a className="u-link u-muted" href={assetPath("/compte")}>{t("sheet.optionalAccount")}</a>
        {!guide.off && <button type="button" className="u-link u-muted" onClick={guideOff}>{t("sheet.guideOff")}</button>}
      </div>
    </div>
  </SheetFrame>;
}

export function ConfirmSheet() {
  const { t, say } = useI18n();
  const { setSheet, settings, balance, gate, confirmRun, scene, line, engine, chosenLora, loraResolution, falBalance, falBalanceOptional } = useStudio();
  const format = settings.aspect === "vertical" ? "9:16" : settings.aspect === "horizontal" ? "16:9" : "1:1";
  return <SheetFrame title={t("sheet.confirmShoot")} label={t("sheet.confirm")} onClose={() => setSheet(null)}>
    <div className="u-stack">
      <ul className="u-ledger">
        <li><span>{t("sheet.place")}</span><span>{scene?.name ?? "—"}</span></li>
        <li><span>{t("scene.plan")}</span><span>{line.trim() || t("sheet.noLine")}</span></li>
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
      <button type="button" className="u-primary" disabled={!gate.allowed} onClick={() => void confirmRun()}>{engine === "lora" ? t("sheet.shootFal") : t("sheet.shootRender")}</button>
      <Why on={!gate.allowed} text={t("why.hold")} />
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

export function PlayerSheet({ id }: { id: string }) {
  const { t, say } = useI18n();
  const { date } = useStudioDates();
  const { setSheet, studio, media, deleteTake } = useStudio();
  const take = studio.takes.find(item => item.id === id);
  if (!take) return null;
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
      <PublishActions take={take} />
      <button type="button" className="u-link u-muted" onClick={() => { void deleteTake(take.id); setSheet(null); }}><Trash /> {t("sheet.removeFromStudio")}</button>
    </div>
  </SheetFrame>;
}
