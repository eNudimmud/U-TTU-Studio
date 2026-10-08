"use client";

import { useEffect, useState } from "react";
import { formatCredits } from "@/lib/credits";
import { EXEMPLES_CAST, EXEMPLES_DECOR, type ExempleItem } from "@/lib/creation/exemples";
import { creationAllowed, spendAllowed } from "@/lib/creation/quotes";
import { assetPath } from "@/lib/site";
import { quotedCredits, priseNext } from "@/lib/stage";
import { gesteOuvert, gesteParId, mapReferences, type RoleRef } from "@/lib/workflows/registre";
import { useI18n } from "@/components/i18n/provider";
import { Arrow, KindMark, type MarkKind } from "./glyphs";
import { GestePicker } from "./geste-picker";
import { ProjectGallery } from "./project-gallery";
import { ReferenceZone, type LocalRef } from "./references";
import { TakeCostLines } from "./take-cost";
import { useStudio } from "./studio-session";

function Why({ on, text, id }: { on: boolean; text: string; id?: string }) {
  if (!on || !text) return null;
  return <p className="u-why" id={id}>{text}</p>;
}

function CardFace({ src, kind }: { src: string; kind: MarkKind }) {
  if (!src) return <KindMark kind={kind} />;
  return <img src={src} alt="" />;
}

const PAIRES_CAST: { geste: string; id: string; role: RoleRef }[] = [
  { geste: "cast-photos", id: "cast-mira", role: "visage" },
  { geste: "cast-planche", id: "cast-coursiere", role: "visage" },
];

const PAIRES_DECOR: { geste: string; id: string; role: RoleRef }[] = [
  { geste: "decor-photo", id: "decor-quai-nuit", role: "lieu" },
  { geste: "decor-heure", id: "decor-rue-pluie", role: "lieu" },
];

function ExemplePaires({ items, pairs, onPick }: {
  items: ExempleItem[];
  pairs: { geste: string; id: string; role: RoleRef }[];
  onPick(item: ExempleItem, geste: string, role: RoleRef): void;
}) {
  const { t } = useI18n();
  return <div className="u-examples">
    {pairs.map(pair => {
      const item = items.find(entry => entry.id === pair.id);
      if (!item) return null;
      return <button key={pair.geste} type="button" onClick={() => onPick(item, pair.geste, pair.role)}>
        <span className="u-pair">
          <img src={assetPath(item.file)} alt="" />
          <span className="u-geste-soon">{t("gestes.exampleSoon")}</span>
        </span>
        <span>{item.title}</span>
      </button>;
    })}
  </div>;
}

async function filesFor(gesteId: string, refs: LocalRef[]): Promise<File[]> {
  const row = gesteParId(gesteId);
  if (!row) return [];
  const files: File[] = [];
  for (const slot of mapReferences(row, refs)) {
    const ref = refs.find(item => item.id === slot.refId);
    if (!ref) continue;
    if (ref.file) {
      files.push(ref.file);
      continue;
    }
    if (!ref.url) continue;
    const blob = await (await fetch(ref.url)).blob();
    files.push(new File([blob], `${ref.name || "ref"}.jpg`, { type: blob.type || "image/jpeg" }));
  }
  return files;
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
  const { cast, decor, media, createCast, connected, balance, creating, pendingRef, holdRef } = useStudio();
  const [gesteId, setGesteId] = useState("cast-photos");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [refs, setRefs] = useState<LocalRef[]>([]);
  const [ask, setAsk] = useState(false);
  const row = gesteParId(gesteId) ?? gesteParId("cast-photos")!;
  const opened = gesteOuvert(row);
  const amount = row.credits;
  const high = row.high;
  const mapped = mapReferences(row, refs).length;
  const textOnly = row.still === "texte-cast";
  const ready = name.trim().length > 0 && mapped >= row.minRefs && (!textOnly || prompt.trim().length > 0);
  const covered = opened && amount !== null && high !== null && creationAllowed(connected, balance?.credits ?? null, high);
  const blocked = !covered || !ready || creating;
  const why = !connected ? t("create.needLink") : !opened ? t("gestes.unwired") : !covered ? t("create.needCeiling") : creating ? t("create.running") : row.minRefs > mapped ? t("gestes.needRefs") : t("why.needName");
  const gallery = [
    ...cast.map(card => ({ id: card.id, name: card.name, url: card.preview ? assetPath(card.preview) : (card.sheet && media[card.sheet]) || (card.photos[0] && media[card.photos[0]]) || "", role: "visage" as const })),
    ...decor.map(card => ({ id: card.id, name: card.name, url: card.preview ? assetPath(card.preview) : (card.sheet && media[card.sheet]) || "", role: "lieu" as const })),
  ];

  useEffect(() => {
    if (!pendingRef) return;
    setRefs(list => [...list, { ...pendingRef, file: null }]);
    holdRef(null);
  }, [pendingRef, holdRef]);

  async function loadExemple(item: ExempleItem, geste: string, role: RoleRef) {
    const response = await fetch(assetPath(item.file));
    const blob = await response.blob();
    const file = new File([blob], `${item.id}.webp`, { type: blob.type || "image/webp" });
    setGesteId(geste);
    setName(item.title);
    setPrompt("");
    setRefs([{ id: `ref-${item.id}`, role, name: item.title, url: assetPath(item.file), file, assetId: null }]);
  }

  async function confirm() {
    if (amount === null || high === null) return;
    const files = await filesFor(gesteId, refs);
    const source = textOnly ? "texte" as const : "photos" as const;
    const ok = await createCast({ name, prompt, source, files, confirmed: true, geste: gesteId });
    if (!ok) return;
    setAsk(false);
    setName("");
    setPrompt("");
    setRefs([]);
    onDecor();
  }

  return <section className="u-screen u-stage" data-section="cast" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">01</p>
      <h1 id="u-title" tabIndex={-1}>{t("nav.character")}</h1>
      <p className="u-lead">{t("create.castLead")}</p>
    </header>
    <GestePicker onglet="cast" value={gesteId} onChange={setGesteId} />
    <ReferenceZone refs={refs} onChange={setRefs} gallery={gallery} />
    <label className="u-field">
      <span className="u-label">{t("create.name")}</span>
      <input value={name} maxLength={40} autoComplete="off" onChange={event => setName(event.target.value)} />
    </label>
    <label className="u-field">
      <span className="u-label">{t("create.prompt")}</span>
      <textarea value={prompt} rows={3} maxLength={800} placeholder={t("create.castPromptPh")} onChange={event => setPrompt(event.target.value)} />
    </label>
    <p className="u-label">{t("create.examples")}</p>
    <p className="u-small">{t("create.examplesNote")}</p>
    <ExemplePaires items={EXEMPLES_CAST} pairs={PAIRES_CAST} onPick={(item, geste, role) => void loadExemple(item, geste, role)} />
    {amount !== null && high !== null && <p className="u-cost is-ok">{t("create.estimate", { amount, high })}</p>}
    {ask && amount !== null && high !== null ? <CreateConfirm title={t("create.confirmTitle")} amount={amount} high={high} onCancel={() => setAsk(false)} onYes={() => void confirm()} /> : <>
      <button type="button" className="u-primary" data-cast-gold="" disabled={blocked} aria-describedby={blocked ? "u-why-cast" : undefined} onClick={() => setAsk(true)}>
        {t("create.castButton", { amount: amount ?? "—" })} <Arrow />
      </button>
      <Why on={blocked} id="u-why-cast" text={why} />
    </>}
    <ProjectGallery onUseRef={asset => {
      const role = asset.kind === "decor" ? "lieu" : asset.kind === "personnage" ? "visage" : "style";
      const url = asset.preview ? assetPath(asset.preview) : (asset.media && media[asset.media]) || "";
      setRefs(list => [...list, { id: `ref-${asset.id}-${list.length}`, role, name: asset.name, url, file: null, assetId: asset.preview ? null : asset.id }]);
    }} />
  </section>;
}

const SUGGESTIONS = ["create.suggestQuai", "create.suggestPluie", "create.suggestToit"] as const;

export function DecorStage({ onPrise }: { onPrise(): void }) {
  const { t } = useI18n();
  const { cast, decor, media, createDecor, connected, balance, creating, pendingRef, holdRef } = useStudio();
  const [gesteId, setGesteId] = useState("decor-photo");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [refs, setRefs] = useState<LocalRef[]>([]);
  const [ask, setAsk] = useState(false);
  const row = gesteParId(gesteId) ?? gesteParId("decor-photo")!;
  const opened = gesteOuvert(row);
  const amount = row.credits;
  const high = row.high;
  const mapped = mapReferences(row, refs).length;
  const textOnly = row.still === "texte-decor";
  const ready = name.trim().length > 0 && mapped >= row.minRefs && (!textOnly || prompt.trim().length > 0);
  const covered = opened && amount !== null && high !== null && creationAllowed(connected, balance?.credits ?? null, high);
  const blocked = !covered || !ready || creating;
  const why = !connected ? t("create.needLink") : !opened ? t("gestes.unwired") : !covered ? t("create.needCeiling") : creating ? t("create.running") : row.minRefs > mapped ? t("gestes.needRefs") : t("stage.chooseDecor");
  const gallery = [
    ...decor.map(card => ({ id: card.id, name: card.name, url: card.preview ? assetPath(card.preview) : (card.sheet && media[card.sheet]) || "", role: "lieu" as const })),
    ...cast.map(card => ({ id: card.id, name: card.name, url: card.preview ? assetPath(card.preview) : (card.sheet && media[card.sheet]) || "", role: "style" as const })),
  ];

  useEffect(() => {
    if (!pendingRef || pendingRef.role !== "lieu") return;
    setRefs(list => [...list, { ...pendingRef, file: null }]);
    holdRef(null);
  }, [pendingRef, holdRef]);

  async function loadExemple(item: ExempleItem, geste: string, role: RoleRef) {
    const response = await fetch(assetPath(item.file));
    const blob = await response.blob();
    const file = new File([blob], `${item.id}.webp`, { type: blob.type || "image/webp" });
    setGesteId(geste);
    setName(item.title);
    setPrompt("");
    setRefs([{ id: `ref-${item.id}`, role, name: item.title, url: assetPath(item.file), file, assetId: null }]);
  }

  async function confirm() {
    if (amount === null || high === null) return;
    const files = await filesFor(gesteId, refs);
    const source = textOnly ? "texte" as const : "photo" as const;
    const ok = await createDecor({ name, prompt, source, file: files[0] ?? null, files, confirmed: true, geste: gesteId });
    if (!ok) return;
    setAsk(false);
    onPrise();
  }

  return <section className="u-screen u-stage" data-section="decor" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">02</p>
      <h1 id="u-title" tabIndex={-1}>{t("nav.scene")}</h1>
      <p className="u-lead">{t("create.decorLead")}</p>
    </header>
    <GestePicker onglet="decor" value={gesteId} onChange={setGesteId} />
    <ReferenceZone refs={refs} onChange={setRefs} gallery={gallery} defaultRole="lieu" />
    <label className="u-field">
      <span className="u-label">{t("create.name")}</span>
      <input value={name} maxLength={40} autoComplete="off" onChange={event => setName(event.target.value)} />
    </label>
    <p className="u-label">{t("create.suggestions")}</p>
    <div className="u-suggest">
      {SUGGESTIONS.map(key => <button key={key} type="button" onClick={() => { setPrompt(t(key)); if (!name.trim()) setName(t(key)); }}>{t(key)}</button>)}
    </div>
    <label className="u-field">
      <span className="u-label">{t("create.prompt")}</span>
      <textarea value={prompt} rows={3} maxLength={800} onChange={event => setPrompt(event.target.value)} />
    </label>
    <p className="u-label">{t("create.examples")}</p>
    <p className="u-small">{t("create.examplesNote")}</p>
    <ExemplePaires items={EXEMPLES_DECOR} pairs={PAIRES_DECOR} onPick={(item, geste, role) => void loadExemple(item, geste, role)} />
    {amount !== null && high !== null && <p className="u-cost is-ok">{t("create.estimate", { amount, high })}</p>}
    {ask && amount !== null && high !== null ? <CreateConfirm title={t("create.confirmTitle")} amount={amount} high={high} onCancel={() => setAsk(false)} onYes={() => void confirm()} /> : <>
      <button type="button" className="u-primary" data-decor-gold="" disabled={blocked} aria-describedby={blocked ? "u-why-decor" : undefined} onClick={() => setAsk(true)}>
        {t("create.decorButton", { amount: amount ?? "—" })} <Arrow />
      </button>
      <Why on={blocked} id="u-why-decor" text={why} />
    </>}
    <ProjectGallery defaultFilter="decor" onUseRef={asset => {
      const url = asset.preview ? assetPath(asset.preview) : (asset.media && media[asset.media]) || "";
      setRefs(list => [...list, { id: `ref-${asset.id}-${list.length}`, role: "lieu", name: asset.name, url, file: null, assetId: asset.preview ? null : asset.id }]);
    }} />
  </section>;
}

export function PriseStage({ goCast, goDecor, onMontage }: { goCast(): void; goDecor(): void; onMontage(): void }) {
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
  const [gesteId, setGesteId] = useState("prise-plan");
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
        <button type="button" className="u-primary" data-lire-sequence="" onClick={onMontage}>{t("sequence.play")} <Arrow /></button>
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
    {run.phase === "idle" && <>
    <GestePicker onglet="prise" value={gesteId} onChange={setGesteId} />
    {gesteId !== "prise-plan" && <div className="u-prise-go">
      <button type="button" className="u-secondary" disabled aria-describedby="u-why-geste">{t("stage.generate")}</button>
      <Why on id="u-why-geste" text={!connected ? t("create.needLink") : t("gestes.unwired")} />
    </div>}
    {gesteId === "prise-plan" && <div className="u-prise-board">
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
    </>}
  </section>;
}
