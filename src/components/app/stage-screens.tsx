"use client";

import { useState } from "react";
import { formatCredits } from "@/lib/credits";
import { EXEMPLES_CAST, EXEMPLES_DECOR, type ExempleItem } from "@/lib/creation/exemples";
import { creationAllowed, quoteForCast, quoteForDecor, spendAllowed } from "@/lib/creation/quotes";
import { assetPath } from "@/lib/site";
import { quotedCredits, priseNext } from "@/lib/stage";
import { useI18n } from "@/components/i18n/provider";
import { Arrow, KindMark, type MarkKind } from "./glyphs";
import { TakeCostLines } from "./take-cost";
import { PictureSlot } from "./slots";
import { useStudio } from "./studio-session";

function Why({ on, text, id }: { on: boolean; text: string; id?: string }) {
  if (!on || !text) return null;
  return <p className="u-why" id={id}>{text}</p>;
}

function CardFace({ src, kind }: { src: string; kind: MarkKind }) {
  if (!src) return <KindMark kind={kind} />;
  return <img src={src} alt="" />;
}

function ExampleStrip({ items, cast, onPick }: { items: ExempleItem[]; cast?: boolean; onPick(item: ExempleItem): void }) {
  return <div className={cast ? "u-examples is-cast" : "u-examples"}>
    {items.map(item => <button key={item.id} type="button" onClick={() => onPick(item)}>
      <img src={assetPath(item.file)} alt="" />
      <span>{item.title}</span>
    </button>)}
  </div>;
}

function CreateConfirm({ title, amount, high, onCancel, onYes }: { title: string; amount: number; high: number; onCancel(): void; onYes(): void }) {
  const { t } = useI18n();
  const open = spendAllowed(amount, true);
  return <div className="u-card" role="dialog" aria-labelledby="u-create-title">
    <h2 id="u-create-title">{title}</h2>
    <p>{t("create.confirmBody")}</p>
    <p className="u-cost is-ok" id="u-create-cost">{t("create.estimate", { amount, high })}</p>
    <button type="button" className="u-primary" disabled={!open} aria-describedby="u-create-cost" onClick={onYes}>{t("verb.lancer")}</button>
    <button type="button" className="u-link" onClick={onCancel}>{t("verb.cancel")}</button>
  </div>;
}

export function CastStage({ onDecor }: { onDecor(): void }) {
  const { t } = useI18n();
  const { cast, media, pickedCast, pickCast, createCast, renameCast, duplicateCast, deleteCast, copyCastTo, studio, connected, balance, creating } = useStudio();
  const [mode, setMode] = useState<"texte" | "photos">("texte");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [ask, setAsk] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const quote = quoteForCast(mode);
  const ready = name.trim().length > 0 && (mode === "texte" ? prompt.trim().length > 0 : files.length >= 2 && files.length <= 3);
  const covered = creationAllowed(connected, balance?.credits ?? null, quote.high);
  const blocked = !covered || !ready || creating;
  const why = !connected ? t("create.needLink") : !covered ? t("create.needCeiling") : creating ? t("create.running") : mode === "photos" && files.length < 2 ? t("create.photoRule") : t("why.needName");

  function addFiles(list: File[]) {
    const next = [...files, ...list].slice(0, 3);
    setFiles(next);
    setPreviews(next.map(file => URL.createObjectURL(file)));
  }

  async function confirm() {
    const ok = await createCast({ name, prompt, source: mode, files, confirmed: true });
    if (!ok) return;
    setAsk(false);
    setName("");
    setPrompt("");
    setFiles([]);
    setPreviews([]);
    onDecor();
  }

  return <section className="u-screen u-stage" data-section="cast" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">01</p>
      <h1 id="u-title" tabIndex={-1}>{t("nav.character")}</h1>
      <p className="u-lead">{t("create.castLead")}</p>
    </header>
    <div className="u-modes" role="group" aria-label={t("create.castLead")}>
      <button type="button" aria-pressed={mode === "texte"} onClick={() => setMode("texte")}>{t("create.describe")}</button>
      <button type="button" aria-pressed={mode === "photos"} onClick={() => setMode("photos")}>{t("create.fromPhotos")}</button>
    </div>
    <label className="u-field">
      <span className="u-label">{t("create.name")}</span>
      <input value={name} maxLength={40} autoComplete="off" onChange={event => setName(event.target.value)} />
    </label>
    {mode === "texte" ? <label className="u-field">
      <span className="u-label">{t("create.prompt")}</span>
      <textarea value={prompt} rows={4} maxLength={800} placeholder={t("create.castPromptPh")} onChange={event => setPrompt(event.target.value)} />
      <span className="u-small">{t("create.views")}</span>
    </label> : <div className="u-photos" aria-label={t("create.photoRule")}>
      {Array.from({ length: 3 }, (_, index) => <PictureSlot key={previews[index] ?? `photo-${index}`} index={index} url={previews[index]} label={t("look.photo")} onAdd={addFiles} onRemove={previews[index] ? () => { setFiles(files.filter((_, i) => i !== index)); setPreviews(previews.filter((_, i) => i !== index)); } : undefined} />)}
      <p className="u-small">{t("create.photoRule")}</p>
    </div>}
    <p className="u-label">{t("create.examples")}</p>
    <p className="u-small">{t("create.examplesNote")}</p>
    <ExampleStrip cast items={EXEMPLES_CAST} onPick={item => { setMode("texte"); setPrompt(item.prompt); setName(item.title); }} />
    <p className="u-cost is-ok">{t("create.estimate", { amount: quote.credits, high: quote.high })}</p>
    {ask ? <CreateConfirm title={t("create.confirmTitle")} amount={quote.credits} high={quote.high} onCancel={() => setAsk(false)} onYes={() => void confirm()} /> : <>
      <button type="button" className="u-primary" data-cast-gold="" disabled={blocked} aria-describedby={blocked ? "u-why-cast" : undefined} onClick={() => setAsk(true)}>
        {t("create.castButton", { amount: quote.credits })} <Arrow />
      </button>
      <Why on={blocked} id="u-why-cast" text={why} />
    </>}
    <h2 className="u-label">{t("create.gallery")}</h2>
    {cast.length === 0 ? <p className="u-small">{t("create.emptyGallery")}</p> : <div className="u-gallery">
      {cast.map(card => {
        const src = card.preview ? assetPath(card.preview) : card.sheet && media[card.sheet] ? media[card.sheet] : card.photos[0] && media[card.photos[0]] ? media[card.photos[0]] : "";
        const selected = card.id === pickedCast;
        return <article key={card.id} className="u-card-lg" data-selected={selected || undefined}>
          <button type="button" className="u-pick" aria-pressed={selected} onClick={() => void pickCast(card.id)}>
            <CardFace src={src} kind="personnage" />
            <span>{card.name}</span>
            <small>{t("create.ready")}</small>
          </button>
          <div className="u-card-actions">
            {editing === card.id ? <label className="u-field">
              <span className="sr-only">{t("create.rename")}</span>
              <input defaultValue={card.name} maxLength={40} onBlur={event => { void renameCast(card.id, event.target.value); setEditing(null); }} />
            </label> : <button type="button" className="u-link" onClick={() => setEditing(card.id)}>{t("create.rename")}</button>}
            <button type="button" className="u-link" onClick={() => void duplicateCast(card.id)}>{t("create.duplicate")}</button>
            {armed === card.id ? <button type="button" className="u-link" onClick={() => void deleteCast(card.id)}>{t("create.deleteYes")}</button> : <button type="button" className="u-link" onClick={() => setArmed(card.id)}>{t("create.delete")}</button>}
            {studio.projects.length > 1 && studio.projects.filter(item => item.slug !== studio.project).map(item => <button key={item.slug} type="button" className="u-link" onClick={() => void copyCastTo(card.id, item.slug)}>{t("create.copyProject", { name: item.name })}</button>)}
          </div>
        </article>;
      })}
    </div>}
  </section>;
}

const SUGGESTIONS = ["create.suggestQuai", "create.suggestPluie", "create.suggestToit"] as const;

export function DecorStage({ onPrise }: { onPrise(): void }) {
  const { t } = useI18n();
  const { decor, media, pickedDecor, pickDecor, createDecor, renameDecor, duplicateDecor, deleteDecor, connected, balance, creating } = useStudio();
  const [mode, setMode] = useState<"texte" | "photo">("texte");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [ask, setAsk] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);
  const quote = quoteForDecor(mode);
  const formReady = Boolean(name.trim() && (mode === "texte" ? prompt.trim() : file));
  const covered = creationAllowed(connected, balance?.credits ?? null, quote.high);
  const blocked = !covered || !formReady || creating;
  const why = !connected ? t("create.needLink") : !covered ? t("create.needCeiling") : creating ? t("create.running") : t("stage.chooseDecor");

  async function confirm() {
    const ok = await createDecor({ name, prompt, source: mode, file, confirmed: true });
    if (!ok) return;
    setAsk(false);
    onPrise();
  }

  return <section className="u-screen u-stage" data-section="decor" aria-labelledby="u-title">
    <div className="u-decor-layout">
      <div className="u-decor-form">
        <header className="u-head">
          <p className="u-label">02</p>
          <h1 id="u-title" tabIndex={-1}>{t("nav.scene")}</h1>
          <p className="u-lead">{t("create.decorLead")}</p>
        </header>
        <div className="u-modes" role="group" aria-label={t("create.decorLead")}>
          <button type="button" aria-pressed={mode === "texte"} onClick={() => setMode("texte")}>{t("create.describeDecor")}</button>
          <button type="button" aria-pressed={mode === "photo"} onClick={() => setMode("photo")}>{t("create.fromPhoto")}</button>
        </div>
        <label className="u-field">
          <span className="u-label">{t("create.name")}</span>
          <input value={name} maxLength={40} autoComplete="off" onChange={event => setName(event.target.value)} />
        </label>
        {mode === "texte" ? <>
          <p className="u-label">{t("create.suggestions")}</p>
          <div className="u-suggest">
            {SUGGESTIONS.map(key => <button key={key} type="button" onClick={() => { setPrompt(t(key)); if (!name.trim()) setName(t(key)); }}>{t(key)}</button>)}
          </div>
          <label className="u-field">
            <span className="u-label">{t("create.prompt")}</span>
            <textarea value={prompt} rows={3} maxLength={800} onChange={event => setPrompt(event.target.value)} />
          </label>
        </> : <label className="u-field">
          <span className="u-label">{t("create.fromPhoto")}</span>
          <input type="file" accept="image/*" onChange={event => { const next = event.target.files?.[0] ?? null; setFile(next); setPreview(next ? URL.createObjectURL(next) : ""); }} />
          {preview && <img src={preview} alt="" />}
        </label>}
        <p className="u-cost is-ok">{t("create.estimate", { amount: quote.credits, high: quote.high })}</p>
        {ask ? <CreateConfirm title={t("create.confirmTitle")} amount={quote.credits} high={quote.high} onCancel={() => setAsk(false)} onYes={() => void confirm()} /> : <>
          <button type="button" className="u-primary" data-decor-gold="" disabled={blocked} aria-describedby={blocked ? "u-why-decor" : undefined} onClick={() => setAsk(true)}>
            {t("create.decorButton", { amount: quote.credits })} <Arrow />
          </button>
          <Why on={blocked} id="u-why-decor" text={why} />
        </>}
      </div>
      <aside className="u-decor-examples">
        <p className="u-label">{t("create.examples")}</p>
        <p className="u-small">{t("create.examplesNote")}</p>
        <ExampleStrip items={EXEMPLES_DECOR} onPick={item => { setMode("texte"); setPrompt(item.prompt); setName(item.title); }} />
      </aside>
    </div>
    <h2 className="u-label">{t("create.gallery")}</h2>
    {decor.length === 0 ? <p className="u-small">{t("create.emptyGallery")}</p> : <div className="u-gallery">
      {decor.map(card => {
        const src = card.preview ? assetPath(card.preview) : card.sheet && media[card.sheet] ? media[card.sheet] : "";
        const selected = card.id === pickedDecor;
        return <article key={card.id} className="u-card-lg">
          <button type="button" className="u-pick" aria-pressed={selected} onClick={() => void pickDecor(card.id)}>
            <CardFace src={src} kind="lieu" />
            <span>{card.name}</span>
            <small>{t("create.ready")}</small>
          </button>
          {!card.id.startsWith("demo-") && <div className="u-card-actions">
            <button type="button" className="u-link" onClick={() => { const next = window.prompt(t("create.rename"), card.name); if (next) void renameDecor(card.id, next); }}>{t("create.rename")}</button>
            <button type="button" className="u-link" onClick={() => void duplicateDecor(card.id)}>{t("create.duplicate")}</button>
            {armed === card.id ? <button type="button" className="u-link" onClick={() => void deleteDecor(card.id)}>{t("create.deleteYes")}</button> : <button type="button" className="u-link" onClick={() => setArmed(card.id)}>{t("create.delete")}</button>}
          </div>}
        </article>;
      })}
    </div>}
  </section>;
}

export function PriseStage({ goCast, goDecor }: { goCast(): void; goDecor(): void }) {
  const { t, say } = useI18n();
  const {
    studio, media, cast, decor, pickedCast, pickedDecor, pickCast, pickDecor, line, setLine, setSheet,
    takeQuote, gate, connected, requestRun, run, resetRun, resumeRun, cancelRun, poseTake, exportCoffre,
  } = useStudio();
  const credits = quotedCredits(takeQuote);
  const price = credits !== null ? t("stage.aboutCredits", { amount: formatCredits(credits) }) : null;
  const castOk = Boolean(pickedCast && cast.some(card => card.id === pickedCast));
  const decorOk = Boolean(pickedDecor && decor.some(card => card.id === pickedDecor));
  const canSpend = Boolean(connected && gate.allowed && credits !== null);
  const step = priseNext({ cast: castOk, decor: decorOk, line, connected, canSpend });
  const result = run.phase === "done" ? studio.takes.find(take => take.id === run.takeId) : undefined;
  const filed = result ? studio.sequences.find(item => item.links.some(link => link.takeId === result.id)) : undefined;
  const missing = step === "cast" ? t("stage.missingPhotos") : step === "decor" ? t("stage.missingDecor") : step === "action" ? t("stage.missingAction") : step === "connect" ? t("stage.missingConnect") : step === "hold" ? (price ? t("stage.hold") : t("stage.noQuote")) : "";

  function press() {
    if (step === "cast") goCast();
    else if (step === "decor") goDecor();
    else if (step === "connect") setSheet("connect");
    else if (step === "generate") void requestRun();
  }

  return <section className="u-screen u-stage" data-section="prise" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">03</p>
      <h1 id="u-title" tabIndex={-1}>{t("nav.take")}</h1>
      <p className="u-lead">{t("stage.priseLead")}</p>
    </header>
    {run.phase === "running" && <div className="u-card u-run" role="status">
      <p className="u-run-label">{t("job.running")}</p>
      <button type="button" className="u-link" onClick={cancelRun}>{t("verb.cancel")}</button>
    </div>}
    {run.phase === "done" && result && media[result.video] && <div className="u-card u-result" data-retour-suite="">
      {filed ? <>
        <button type="button" className="u-primary" data-lire-sequence="" onClick={() => document.getElementById("u-prise-video")?.scrollIntoView({ block: "center" })}>{t("sequence.play")} <Arrow /></button>
        <button type="button" className="u-link" onClick={() => void exportCoffre()}>{t("sheet.export")}</button>
        <button type="button" className="u-link" disabled aria-describedby="u-why-filed">{t("take.pose")}</button>
        <Why on id="u-why-filed" text={t("why.alreadyFiled", { name: filed.name || t("common.unnamed") })} />
      </> : <button type="button" className="u-primary" onClick={() => void poseTake(result.id, { sequence: t("sequence.defaultName"), shot: t("shot.defaultName") })}>{t("take.pose")} <Arrow /></button>}
      <video id="u-prise-video" src={media[result.video]} poster={result.poster ? media[result.poster] : undefined} controls muted playsInline />
      <TakeCostLines take={result} gateLine={gate.line} />
      <button type="button" className="u-link" onClick={resetRun}>{t("take.new")}</button>
    </div>}
    {run.phase === "error" && <div className="u-card" role="alert">
      <p>{say(run.message)}</p>
      <button type="button" className="u-primary" onClick={() => { if (run.code === "auth") { resetRun(); setSheet("connect"); } else resumeRun(); }}>{run.code === "auth" ? t("stage.connectComfy") : t("verb.resume")}</button>
    </div>}
    {run.phase === "idle" && <div className="u-prise-board">
      <div>
        <p className="u-label">{t("stage.who")}</p>
        <div className="u-pick-row">
          {cast.length === 0 ? <button type="button" className="u-pick" onClick={goCast}>{t("stage.addCharacter")}</button> : cast.map(card => {
            const src = card.preview ? assetPath(card.preview) : card.sheet && media[card.sheet] ? media[card.sheet] : "";
            const selected = card.id === pickedCast;
            return <button key={card.id} type="button" className="u-pick" aria-pressed={selected} data-selected={selected || undefined} onClick={() => void pickCast(card.id)}>
              <CardFace src={src} kind="personnage" />
              <span>{card.name}</span>
              <small>{t("stage.ready")}</small>
            </button>;
          })}
        </div>
      </div>
      <div>
        <p className="u-label">{t("stage.where")}</p>
        <div className="u-pick-row">
          {decor.length === 0 ? <button type="button" className="u-pick" onClick={goDecor}>{t("stage.addDecor")}</button> : decor.map(card => {
            const src = card.preview ? assetPath(card.preview) : card.sheet && media[card.sheet] ? media[card.sheet] : "";
            const selected = card.id === pickedDecor;
            return <button key={card.id} type="button" className="u-pick" aria-pressed={selected} data-selected={selected || undefined} onClick={() => void pickDecor(card.id)}>
              <CardFace src={src} kind="lieu" />
              <span>{card.name}</span>
            </button>;
          })}
        </div>
      </div>
      <label className="u-field u-prise-action">
        <span className="u-label">{t("stage.action")}</span>
        <textarea id="u-prise-phrase" value={line} rows={2} maxLength={240} placeholder={t("take.defaultLine")} onChange={event => setLine(event.target.value)} />
      </label>
      <div className="u-prise-go">
        <p className={`u-cost is-${price ? "ok" : "block"}`}>{price ?? t("stage.noQuote")}</p>
        <button type="button" className="u-primary" data-prise-gold="" disabled={step !== "generate"} aria-describedby={step !== "generate" ? "u-why-prise" : undefined} onClick={press}>{price ? t("stage.generatePriced", { price }) : t("stage.generate")} <Arrow /></button>
        <Why on={step !== "generate"} id="u-why-prise" text={missing} />
        {step === "connect" && <button type="button" className="u-link" onClick={() => setSheet("connect")}>{t("stage.connectComfy")}</button>}
      </div>
    </div>}
  </section>;
}
