"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EXEMPLES_CAST, EXEMPLES_DECOR, type ExempleItem } from "@/lib/creation/exemples";
import { DEPARTS, montrerDepart } from "@/lib/creation/depart";
import type { AssetRecord } from "@/lib/creation/assets";
import { creationAllowed, spendAllowed } from "@/lib/creation/quotes";
import { assetPath } from "@/lib/site";
import { casesVisibles, gesteOuvert, gesteParId, gesteVisible, mapReferences, type Geste, type Onglet, type RoleRef } from "@/lib/workflows/registre";
import { protocole } from "@/lib/fiabilite";
import { FiabiliteCard } from "./fiabilite-card";
import { APRES_PAR_GESTE, EXEMPLE_PAR_GESTE } from "@/lib/workflows/tuiles";
import { useI18n } from "@/components/i18n/provider";
import { Arrow } from "./glyphs";
import { ExempleDepart } from "./exemple-depart";
import { GestePicker } from "./geste-picker";
import { ProjectGallery } from "./project-gallery";
import { ReperageEntry } from "./reperage/reperage-entry";
import { lieuNote } from "@/lib/repere/lieu";
import { SlotBoard, type LocalRef } from "./references";
import { useStudio } from "./studio-session";

export { PriseStage } from "./prise-stage";

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

function placePhoto(gesteId: string, refs: LocalRef[], photo: { id: string; credit: string; blob: Blob }): LocalRef[] {
  const row = gesteParId(gesteId);
  if (!row) return refs;
  const cases = casesVisibles(row);
  const target = cases.find(item => !refs.some(ref => ref.caseId === item.id)) ?? cases[0];
  if (!target) return refs;
  const file = new File([photo.blob], `${photo.id}.png`, { type: photo.blob.type || "image/png" });
  return [
    ...refs.filter(ref => ref.caseId !== target.id),
    { id: `ref-${photo.id}-${target.id}`, role: target.role, caseId: target.id, name: photo.credit.slice(0, 40), url: URL.createObjectURL(file), file, assetId: null },
  ];
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

function CreateConfirm({ title, amount, high, row, name, prompt, refs, onCancel, onYes }: { title: string; amount: number; high: number; row: Geste; name: string; prompt: string; refs: number; onCancel(): void; onYes(): void }) {
  const { t } = useI18n();
  const { creating } = useStudio();
  const open = !creating && spendAllowed(amount, true);
  const states = protocole({ prepared: true, checked: true, quoted: true, confirming: !creating, running: creating });
  return <div className="u-card" role="dialog" aria-labelledby="u-create-title">
    <h2 id="u-create-title">{title}</h2>
    <p>{t("create.confirmBody")}</p>
    <FiabiliteCard
      states={states}
      estimate={t("create.estimate", { amount, high })}
      estimateId="u-create-cost"
      sent={[
        { label: t("p0.fiab.sentWhat"), value: name || "—" },
        { label: t("p0.fiab.sentRefs"), value: refs > 0 ? t("p0.fiab.refsCount", { count: refs }) : t("p0.fiab.refsNone") },
        { label: t("p0.fiab.sentPrompt"), value: prompt.trim() || "—" },
      ]}
      technical={[{ label: t("p0.fiab.sentEngine"), value: engineName(t, row.template) }]}
      change={t(row.onglet === "cast" ? "p0.fiab.changeCast" : "p0.fiab.changeDecor")}
      where={t("p0.fiab.whereAsset")}
    />
    <div className="u-sheet-actions">
      <button type="button" className="u-primary" disabled={!open} aria-describedby="u-create-cost" data-create-confirm="" onClick={onYes}>{t("verb.lancer")}</button>
      <button type="button" className="u-link" onClick={onCancel}>{t("verb.cancel")}</button>
    </div>
  </div>;
}

/** Plain engine name for the reliability card. */
function engineName(t: (key: string, values?: Record<string, string | number>) => string, template: string | null | undefined): string {
  const id = template ?? "";
  const open = t("p0.engine.open");
  const partner = t("p0.engine.partner");
  if (/klein/i.test(id)) return `FLUX 3 Klein · ${open}`;
  if (/bfl|flux3/i.test(id)) return `FLUX 3 · ${partner}`;
  if (/nano/i.test(id)) return `Nano Banana · ${partner}`;
  if (/ltx/i.test(id)) return `LTX-2.5 · ${open}`;
  if (/h3|minimax/i.test(id)) return `MiniMax H3 · ${open}`;
  return id || "Comfy";
}

export function CastStage({ onDecor }: { onDecor(): void }) {
  const { t } = useI18n();
  const { ready: vaultReady, media, createCast, connected, balance, creating, importAssets, cast, prefs } = useStudio();
  const [gesteId, setGesteIdState] = useState("cast-photos");
  const [touched, setTouched] = useState(false);
  const setGesteId = (id: string) => { setTouched(true); setGesteIdState(id); };
  useEffect(() => {
    const asked = gesteFromQuery("cast", "");
    if (asked) setGesteIdState(asked);
  }, []);
  /** A description without photos means « depuis un texte »: no tile to find first. */
  function describe(text: string) {
    setPrompt(text);
    const texte = gesteParId("cast-texte");
    if (!touched && refs.length === 0 && text.trim() && texte && gesteOuvert(texte) && gesteVisible(texte, prefs)) setGesteIdState("cast-texte");
  }
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
    gestures={<GestePicker onglet="cast" value={gesteId} onChange={setGesteId} examples={["cast-photos", "cast-planche", "cast-texte"]} onStart={id => void loadExemple(id)} />}
    gallery={<ProjectGallery defaultFilter="personnage" onUseRef={asset => {
      const url = asset.preview ? assetPath(asset.preview) : (asset.media && media[asset.media]) || "";
      setRefs(list => placeAsset(gesteId, list, asset, url));
    }} />}
  >
    <header className="u-head">
      <p className="u-label">01</p>
      <h1 id="u-title" tabIndex={-1}>{t("nav.character")}</h1>
      <p className="u-lead">{t("create.castLead")}</p>
      <label className="u-secondary">{t("p0.importCast")}<input className="sr-only" type="file" accept="image/*" aria-label={t("p0.importCastAria")} disabled={!vaultReady} multiple onChange={event => { void importAssets([...(event.target.files ?? [])], "personnage"); event.target.value = ""; }} /></label>
    </header>
    <div className="u-desk-scroll">
      <SlotBoard geste={row} refs={refs} onChange={setRefs} onGallery={() => setGalleryOpen(true)} />
      <label className="u-field">
        <span className="u-label">{t("create.name")}</span>
        <input value={name} maxLength={40} autoComplete="off" onChange={event => setName(event.target.value)} />
      </label>
      <label className="u-field">
        <span className="u-label">{t("create.prompt")}</span>
        <textarea value={prompt} rows={3} maxLength={800} placeholder={t("create.castPromptPh")} onChange={event => describe(event.target.value)} />
      </label>
      {preview && <div className="u-result-frame" data-ratio="3/4">
        <img src={preview} alt="" />
      </div>}
    </div>
    <div className="u-create-bar">
      {ask && amount !== null && high !== null ? <CreateConfirm title={t("create.confirmTitle")} amount={amount} high={high} row={row} name={name} prompt={prompt} refs={mapped} onCancel={() => setAsk(false)} onYes={() => void confirm()} /> : <>
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
  const { ready: vaultReady, media, createDecor, connected, balance, creating, importAssets, saveLieuPhoto, saveLieuCapture, decor, prefs } = useStudio();
  const [gesteId, setGesteIdState] = useState("decor-photo");
  const [touched, setTouched] = useState(false);
  const setGesteId = (id: string) => { setTouched(true); setGesteIdState(id); };
  useEffect(() => {
    const asked = gesteFromQuery("decor", "");
    if (asked) setGesteIdState(asked);
  }, []);
  function texteRow(): Geste | null {
    const texte = gesteParId("decor-texte");
    return texte && gesteOuvert(texte) && gesteVisible(texte, prefs) ? texte : null;
  }
  function describe(text: string) {
    setPrompt(text);
    if (!touched && refs.length === 0 && text.trim() && texteRow()) setGesteIdState("decor-texte");
  }
  /** One tap on a suggestion fills the décor and opens the single confirmation when it can be paid. */
  function suggest(text: string) {
    const texte = refs.length === 0 ? texteRow() : null;
    setPrompt(text);
    if (!name.trim()) setName(text);
    if (!texte) return;
    setGesteIdState(texte.id);
    const payable = texte.credits !== null && texte.high !== null && creationAllowed(connected, balance?.credits ?? null, texte.high) && !creating;
    if (payable) setAsk(true);
  }
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
  const depart = montrerDepart({ mesAssets: decor.length, rempli: refs.length > 0 || name.trim().length > 0 || prompt.trim().length > 0 });
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
    gestures={<GestePicker onglet="decor" value={gesteId} onChange={setGesteId} examples={["decor-photo", "decor-heure", "decor-texte"]} onStart={id => void loadExemple(id)} />}
    gallery={<ProjectGallery defaultFilter="decor" onUseRef={asset => {
      const url = asset.preview ? assetPath(asset.preview) : (asset.media && media[asset.media]) || "";
      setRefs(list => placeAsset(gesteId, list, asset, url));
    }} />}
  >
    <header className="u-head">
      <p className="u-label">02</p>
      <h1 id="u-title" tabIndex={-1}>{t("nav.scene")}</h1>
      <p className="u-lead">{t("create.decorLead")}</p>
      <label className="u-secondary">{t("p0.importDecor")}<input className="sr-only" type="file" accept="image/*" aria-label={t("p0.importDecorAria")} disabled={!vaultReady} multiple onChange={event => { void importAssets([...(event.target.files ?? [])], "decor"); event.target.value = ""; }} /></label>
    </header>
    <div className="u-desk-scroll">
      {depart && <ExempleDepart etape="decor" image={apres} titre={house.find(entry => entry.id === EXEMPLE_PAR_GESTE[gesteId]?.id)?.title} onStart={() => void loadExemple(EXEMPLE_PAR_GESTE[gesteId] ? gesteId : DEPARTS.decor.geste)} />}
      <ReperageEntry
        quote={{ credits: gesteParId("decor-photo")?.credits ?? null, high: gesteParId("decor-photo")?.high ?? null }}
        onCapture={input => saveLieuCapture(input)}
        onCaptured={saved => {
          // A capture is a place photo: it goes in the first free place slot, ready for the décor quote.
          const target = row.slots.length > 0 ? gesteId : "decor-photo";
          if (target !== gesteId) setGesteIdState(target);
          setRefs(list => placePhoto(target, list, { id: saved.sceneId, credit: saved.name, blob: saved.color }));
          setName(current => current.trim() ? current : saved.name);
        }}
        onStreetPhoto={async (place, photo) => {
          const id = await saveLieuPhoto({ name: place.name, note: lieuNote(place, "debout", false), photo });
          if (!id) return false;
          setRefs(list => placePhoto(gesteId, list, photo));
          return true;
        }}
      />
      <SlotBoard geste={row} refs={refs} onChange={setRefs} onGallery={() => setGalleryOpen(true)} />
      <label className="u-field">
        <span className="u-label">{t("create.name")}</span>
        <input value={name} maxLength={40} autoComplete="off" onChange={event => setName(event.target.value)} />
      </label>
      <p className="u-label">{t("create.suggestions")}</p>
      <div className="u-suggest">
        {SUGGESTIONS.map(key => <button key={key} type="button" data-suggestion={key} onClick={() => suggest(t(key))}>{t(key)}</button>)}
      </div>
      <label className="u-field">
        <span className="u-label">{t("create.prompt")}</span>
        <textarea value={prompt} rows={3} maxLength={800} onChange={event => describe(event.target.value)} />
      </label>
      {!depart && (apres || preview) && <div className="u-result-frame">
        <img src={apres || preview} alt="" />
      </div>}
    </div>
    <div className="u-create-bar">
      {ask && amount !== null && high !== null ? <CreateConfirm title={t("create.confirmTitle")} amount={amount} high={high} row={row} name={name} prompt={prompt} refs={mapped} onCancel={() => setAsk(false)} onYes={() => void confirm()} /> : <>
        <button type="button" className="u-primary" data-decor-gold="" disabled={blocked} aria-describedby={blocked ? "u-why-decor" : undefined} onClick={() => setAsk(true)}>
          {amount !== null ? t("create.decorButton", { amount }) : t("create.decorButtonClosed")} <Arrow />
        </button>
        {ceiling && <p className="u-ceiling">{ceiling}</p>}
        <Why on={blocked} id="u-why-decor" text={why} />
      </>}
    </div>
  </Desk>;
}
