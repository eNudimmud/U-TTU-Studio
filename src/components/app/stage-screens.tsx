"use client";

import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { formatCredits } from "@/lib/credits";
import { EXEMPLES_CAST, EXEMPLES_DECOR, type ExempleItem } from "@/lib/creation/exemples";
import type { AssetRecord } from "@/lib/creation/assets";
import { creationAllowed, spendAllowed } from "@/lib/creation/quotes";
import { assetPath } from "@/lib/site";
import { quotedCredits, priseNext } from "@/lib/stage";
import { casesVisibles, gesteOuvert, gesteParId, mapReferences, type Onglet, type RoleRef } from "@/lib/workflows/registre";
import { APRES_PAR_GESTE, EXEMPLE_PAR_GESTE } from "@/lib/workflows/tuiles";
import { useI18n } from "@/components/i18n/provider";
import { Arrow, KindMark, type MarkKind } from "./glyphs";
import { GestePicker } from "./geste-picker";
import { ProjectGallery } from "./project-gallery";
import { readDroppedAsset, SlotBoard, type LocalRef } from "./references";
import { TakeCostLines } from "./take-cost";
import { useStudio } from "./studio-session";

function gesteFromQuery(onglet: Onglet, fallback: string): string | null {
  if (typeof window === "undefined") return null;
  const asked = new URLSearchParams(window.location.search).get("geste");
  const row = asked ? gesteParId(asked) : null;
  return row && row.onglet === onglet ? row.id : fallback;
}

function Why({ on, text, id }: { on: boolean; text: string; id?: string }) {
  if (!on || !text) return null;
  return <p className="u-why" id={id} title={text}>{text}</p>;
}

function CardFace({ src, kind }: { src: string; kind: MarkKind }) {
  if (!src) return <KindMark kind={kind} />;
  return <img src={src} alt="" />;
}

function Desk({ section, galleryOpen, onGallery, gestures, children, gallery }: {
  section: string;
  galleryOpen: boolean;
  onGallery(open: boolean): void;
  gestures: ReactNode;
  children: ReactNode;
  gallery: ReactNode;
}) {
  const { t } = useI18n();
  return <section className="u-screen u-stage u-desk" data-section={section} data-gallery={galleryOpen || undefined} aria-labelledby="u-title">
    <aside className="u-desk-gestes">{gestures}</aside>
    <div className="u-desk-work">{children}</div>
    <aside className="u-desk-gallery">{gallery}</aside>
    <div className="u-desk-switch" role="tablist">
      <button type="button" aria-pressed={!galleryOpen} onClick={() => onGallery(false)}>{t("gestes.ask")}</button>
      <button type="button" aria-pressed={galleryOpen} onClick={() => onGallery(true)}>{t("create.gallery")}</button>
    </div>
  </section>;
}

async function filesFor(gesteId: string, refs: LocalRef[]): Promise<File[]> {
  const row = gesteParId(gesteId);
  if (!row) return [];
  const cases = casesVisibles(row);
  const ordered = cases.length
    ? cases.flatMap(item => {
      const ref = refs.find(entry => entry.caseId === item.id);
      return ref ? [ref] : [];
    })
    : refs;
  const files: File[] = [];
  for (const slot of mapReferences(row, ordered)) {
    const ref = ordered.find(item => item.id === slot.refId);
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

function placeAsset(gesteId: string, refs: LocalRef[], asset: AssetRecord, url: string): LocalRef[] {
  const row = gesteParId(gesteId);
  if (!row) return refs;
  const cases = casesVisibles(row);
  const target = cases.find(item => !refs.some(ref => ref.caseId === item.id)) ?? cases[0];
  if (!target) return refs;
  return [
    ...refs.filter(ref => ref.caseId !== target.id),
    { id: `ref-${asset.id}-${target.id}`, role: target.role, caseId: target.id, name: asset.name, url, file: null, assetId: asset.preview ? null : asset.id },
  ];
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
  const { media, createCast, connected, balance, creating } = useStudio();
  const [gesteId, setGesteId] = useState("cast-photos");
  useEffect(() => {
    const asked = gesteFromQuery("cast", "");
    if (asked) setGesteId(asked);
  }, []);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [refs, setRefs] = useState<LocalRef[]>([]);
  const [ask, setAsk] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const house = EXEMPLES_CAST;
  const row = gesteParId(gesteId) ?? gesteParId("cast-photos")!;
  const opened = gesteOuvert(row);
  const amount = row.credits;
  const high = row.high;
  const mapped = mapReferences(row, refs).length;
  const textOnly = row.still === "texte-cast";
  const ready = name.trim().length > 0 && mapped >= row.minRefs && (!textOnly || prompt.trim().length > 0);
  const covered = opened && amount !== null && high !== null && creationAllowed(connected, balance?.credits ?? null, high);
  const blocked = !covered || !ready || creating;
  const missingTenue = casesVisibles(row).some(item => item.role === "tenue" && !refs.some(ref => ref.caseId === item.id));
  const why = !opened ? t(row.raison ?? "gestes.unwired") : !connected ? t("create.needLink") : !covered ? t("create.needCeiling") : creating ? t("create.running") : missingTenue ? t("gestes.needOutfit") : row.minRefs > mapped ? t("gestes.needRefs") : t("why.needName");
  const preview = refs.find(ref => ref.url)?.url ?? "";
  const apres = APRES_PAR_GESTE[gesteId] ? assetPath(APRES_PAR_GESTE[gesteId]) : "";
  const ceiling = amount !== null && high !== null
    ? t(row.nature === "mesure" ? "create.ceilingMeasured" : "create.ceilingHyp", { high })
    : "";

  async function loadExemple(geste: string) {
    const pair = EXEMPLE_PAR_GESTE[geste];
    if (geste === "cast-texte") {
      const item = house.find(entry => entry.id === "cast-vieil-homme") ?? house[0];
      if (!item) return;
      setGesteId(geste);
      setName(item.title);
      setPrompt(item.prompt);
      setRefs([]);
      return;
    }
    const item = house.find(entry => entry.id === pair?.id);
    if (!pair || !item) return;
    await applyHouse(item, geste, pair.role);
  }

  async function applyHouse(item: ExempleItem, geste: string, role: RoleRef) {
    const response = await fetch(assetPath(item.file));
    const blob = await response.blob();
    const file = new File([blob], `${item.id}.webp`, { type: blob.type || "image/webp" });
    const target = gesteParId(geste);
    const first = target ? casesVisibles(target)[0] : null;
    setGesteId(geste);
    setName(item.title);
    setPrompt(item.prompt);
    setRefs(first ? [{ id: `ref-${item.id}`, role, caseId: first.id, name: item.title, url: assetPath(item.file), file, assetId: null }] : []);
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

  return <Desk
    section="cast"
    galleryOpen={galleryOpen}
    onGallery={setGalleryOpen}
    gestures={<GestePicker onglet="cast" value={gesteId} onChange={setGesteId} examples={["cast-photos", "cast-planche", "cast-texte"]} onExample={id => void loadExemple(id)} />}
    gallery={<ProjectGallery defaultFilter="personnage" onUseRef={asset => {
      const url = asset.preview ? assetPath(asset.preview) : (asset.media && media[asset.media]) || "";
      setRefs(list => placeAsset(gesteId, list, asset, url));
    }} />}
  >
    <header className="u-head">
      <p className="u-label">01</p>
      <h1 id="u-title" tabIndex={-1}>{t("nav.character")}</h1>
      <p className="u-lead">{t("create.castLead")}</p>
    </header>
    <div className="u-desk-scroll">
      <SlotBoard geste={row} refs={refs} onChange={setRefs} onGallery={() => setGalleryOpen(true)} />
      <label className="u-field">
        <span className="u-label">{t("create.name")}</span>
        <input value={name} maxLength={40} autoComplete="off" onChange={event => setName(event.target.value)} />
      </label>
      <label className="u-field">
        <span className="u-label">{t("create.prompt")}</span>
        <textarea value={prompt} rows={3} maxLength={800} placeholder={t("create.castPromptPh")} onChange={event => setPrompt(event.target.value)} />
      </label>
      {(apres || preview) && <div className="u-result-frame" data-ratio="3/4">
        <img src={apres || preview} alt="" />
      </div>}
    </div>
    <div className="u-create-bar">
      {ask && amount !== null && high !== null ? <CreateConfirm title={t("create.confirmTitle")} amount={amount} high={high} onCancel={() => setAsk(false)} onYes={() => void confirm()} /> : <>
        <button type="button" className="u-primary" data-cast-gold="" disabled={blocked} aria-describedby={blocked ? "u-why-cast" : undefined} onClick={() => setAsk(true)}>
          {amount !== null ? t("create.castButton", { amount }) : t("create.castButtonClosed")} <Arrow />
        </button>
        {ceiling && <p className="u-ceiling">{ceiling}</p>}
        <Why on={blocked} id="u-why-cast" text={why} />
      </>}
    </div>
  </Desk>;
}

const SUGGESTIONS = ["create.suggestQuai", "create.suggestPluie", "create.suggestToit"] as const;

export function DecorStage({ onPrise }: { onPrise(): void }) {
  const { t } = useI18n();
  const { media, createDecor, connected, balance, creating } = useStudio();
  const [gesteId, setGesteId] = useState("decor-photo");
  useEffect(() => {
    const asked = gesteFromQuery("decor", "");
    if (asked) setGesteId(asked);
  }, []);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [refs, setRefs] = useState<LocalRef[]>([]);
  const [ask, setAsk] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const house = EXEMPLES_DECOR;
  const row = gesteParId(gesteId) ?? gesteParId("decor-photo")!;
  const opened = gesteOuvert(row);
  const amount = row.credits;
  const high = row.high;
  const mapped = mapReferences(row, refs).length;
  const textOnly = row.still === "texte-decor";
  const ready = name.trim().length > 0 && mapped >= row.minRefs && (!textOnly || prompt.trim().length > 0);
  const covered = opened && amount !== null && high !== null && creationAllowed(connected, balance?.credits ?? null, high);
  const blocked = !covered || !ready || creating;
  const why = !opened ? t(row.raison ?? "gestes.unwired") : !connected ? t("create.needLink") : !covered ? t("create.needCeiling") : creating ? t("create.running") : row.minRefs > mapped ? t("gestes.needRefs") : t("stage.chooseDecor");
  const preview = refs.find(ref => ref.url)?.url ?? "";
  const apres = APRES_PAR_GESTE[gesteId] ? assetPath(APRES_PAR_GESTE[gesteId]) : "";
  const ceiling = amount !== null && high !== null ? t("create.ceilingHyp", { high }) : "";

  async function loadExemple(geste: string) {
    const pair = EXEMPLE_PAR_GESTE[geste];
    const item = house.find(entry => entry.id === pair?.id);
    if (!pair || !item) return;
    const response = await fetch(assetPath(item.file));
    const blob = await response.blob();
    const file = new File([blob], `${item.id}.webp`, { type: blob.type || "image/webp" });
    const target = gesteParId(geste);
    const first = target ? casesVisibles(target)[0] : null;
    setGesteId(geste);
    setName(item.title);
    setPrompt(geste === "decor-texte" ? item.prompt : "");
    setRefs(first && geste !== "decor-texte" ? [{ id: `ref-${item.id}`, role: pair.role, caseId: first.id, name: item.title, url: assetPath(item.file), file, assetId: null }] : []);
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

  return <Desk
    section="decor"
    galleryOpen={galleryOpen}
    onGallery={setGalleryOpen}
    gestures={<GestePicker onglet="decor" value={gesteId} onChange={setGesteId} examples={["decor-photo", "decor-heure", "decor-texte"]} onExample={id => void loadExemple(id)} />}
    gallery={<ProjectGallery defaultFilter="decor" onUseRef={asset => {
      const url = asset.preview ? assetPath(asset.preview) : (asset.media && media[asset.media]) || "";
      setRefs(list => placeAsset(gesteId, list, asset, url));
    }} />}
  >
    <header className="u-head">
      <p className="u-label">02</p>
      <h1 id="u-title" tabIndex={-1}>{t("nav.scene")}</h1>
      <p className="u-lead">{t("create.decorLead")}</p>
    </header>
    <div className="u-desk-scroll">
      <SlotBoard geste={row} refs={refs} onChange={setRefs} onGallery={() => setGalleryOpen(true)} />
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
      {(apres || preview) && <div className="u-result-frame">
        <img src={apres || preview} alt="" />
      </div>}
    </div>
    <div className="u-create-bar">
      {ask && amount !== null && high !== null ? <CreateConfirm title={t("create.confirmTitle")} amount={amount} high={high} onCancel={() => setAsk(false)} onYes={() => void confirm()} /> : <>
        <button type="button" className="u-primary" data-decor-gold="" disabled={blocked} aria-describedby={blocked ? "u-why-decor" : undefined} onClick={() => setAsk(true)}>
          {amount !== null ? t("create.decorButton", { amount }) : t("create.decorButtonClosed")} <Arrow />
        </button>
        {ceiling && <p className="u-ceiling">{ceiling}</p>}
        <Why on={blocked} id="u-why-decor" text={why} />
      </>}
    </div>
  </Desk>;
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
  const [priseRefs, setPriseRefs] = useState<LocalRef[]>([]);
  useEffect(() => {
    const asked = gesteFromQuery("prise", "");
    if (asked) setGesteId(asked);
  }, []);
  useEffect(() => { setPriseRefs([]); }, [gesteId]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const missing = step === "cast" ? t("stage.missingPhotos") : step === "decor" ? t("stage.missingDecor") : step === "action" ? t("stage.missingAction") : step === "connect" ? t("stage.missingConnect") : step === "hold" ? (price ? t("stage.hold") : t("stage.noQuote")) : "";
  const who = cast.find(card => card.id === pickedCast);
  const where = decor.find(card => card.id === pickedDecor);
  const whoSrc = who ? (who.preview ? assetPath(who.preview) : who.sheet && media[who.sheet] ? media[who.sheet] : "") : "";
  const whereSrc = where ? (where.preview ? assetPath(where.preview) : where.sheet && media[where.sheet] ? media[where.sheet] : "") : "";
  const row = gesteParId(gesteId);

  function press() {
    if (step === "cast") goCast();
    else if (step === "decor") goDecor();
    else if (step === "connect") setSheet("connect");
    else if (step === "generate") void requestRun();
  }

  function dropOn(kind: "personnage" | "decor", event: DragEvent) {
    event.preventDefault();
    const asset = readDroppedAsset(event.dataTransfer);
    if (!asset) return;
    if (kind === "decor" || asset.kind === "decor") void pickDecor(asset.id);
    else void pickCast(asset.id);
  }

  return <Desk
    section="prise"
    galleryOpen={galleryOpen}
    onGallery={setGalleryOpen}
    gestures={<GestePicker onglet="prise" value={gesteId} onChange={setGesteId} />}
    gallery={<ProjectGallery defaultFilter="plan" onUseRef={asset => {
      if (asset.kind === "decor") void pickDecor(asset.id);
      else if (asset.kind === "personnage") void pickCast(asset.id);
    }} />}
  >
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
    <div className="u-desk-scroll">
    {gesteId !== "prise-plan" && row && <SlotBoard geste={row} refs={priseRefs} onChange={setPriseRefs} onGallery={() => setGalleryOpen(true)} />}
    {gesteId === "prise-plan" && <div className="u-prise-board">
      <div className="u-slot" data-slot="visage" onDragOver={event => event.preventDefault()} onDrop={event => dropOn("personnage", event)}>
        <p className="u-label">{t("refs.visage")}</p>
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
      <div className="u-slot" data-slot="lieu" onDragOver={event => event.preventDefault()} onDrop={event => dropOn("decor", event)}>
        <p className="u-label">{t("refs.lieu")}</p>
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
      {(whoSrc || whereSrc) && <div className="u-result-frame">
        {whoSrc ? <img src={whoSrc} alt="" /> : null}
        {whereSrc ? <img src={whereSrc} alt="" /> : null}
      </div>}
      <label className="u-field u-prise-action">
        <span className="u-label">{t("stage.action")}</span>
        <textarea id="u-prise-phrase" value={line} rows={2} maxLength={240} placeholder={t("take.defaultLine")} onChange={event => setLine(event.target.value)} />
      </label>
    </div>}
    </div>
    {gesteId !== "prise-plan" && row && <div className="u-create-bar">
      <button type="button" className="u-secondary" disabled aria-describedby="u-why-geste">{t("stage.generate")}</button>
      {row.credits !== null && row.high !== null && <p className="u-ceiling">{t("create.ceilingHyp", { high: row.high })}</p>}
      <Why on id="u-why-geste" text={t(row.raison ?? "gestes.unwired")} />
    </div>}
    {gesteId === "prise-plan" && <div className="u-create-bar">
      <button type="button" className="u-primary" data-prise-gold="" disabled={step !== "generate"} aria-describedby={step !== "generate" ? "u-why-prise" : undefined} onClick={press}>{price ? t("stage.generatePriced", { price }) : t("stage.generate")} <Arrow /></button>
      {takeQuote.source === "billed" && <p className="u-ceiling">{t("create.ceilingMeasured", { high: takeQuote.measure.creditsHigh })}</p>}
      <Why on={step !== "generate"} id="u-why-prise" text={missing} />
      {step === "connect" && <button type="button" className="u-link" onClick={() => setSheet("connect")}>{t("stage.connectComfy")}</button>}
    </div>}
    </>}
  </Desk>;
}
