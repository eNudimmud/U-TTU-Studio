"use client";

// « Un vrai lieu en décor », mockup v4: one question and one main action per screen.
// 1 Où ? (search) → 2 Choisis ta vue (drag the 3D, three heights, free) → 3 Crée ton décor (the kept
// Volumes view is image 1 of one Klein edit, up to three nearby street photos are images 2–4, picked
// for you) → 4 the result, saved in the décor gallery and picked for a shot.
// Open data only (OpenStreetMap, Terrain Tiles, swisstopo in Switzerland). Steps 1 and 2 spend nothing.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { BrandMark, BrandName } from "@/components/brand";
import { PoweredBy } from "@/components/powered-by";
import { useStudio } from "../studio-session";
import { assetPath } from "@/lib/site";
import { creationAllowed } from "@/lib/creation/quotes";
import { CADRE_AMBIANCES, CADRE_PHOTOS_MAX, cadrePrompt, cadreQuote, type CadreAmbiance } from "@/lib/creation/decor-cadre";
import { buildCaptureMeta, captureNote, type CaptureMeta } from "@/lib/repere3d/capture";
import { createGeocoder, type GeocodeResult, type Lieu3d } from "@/lib/repere3d/geocode";
import { attributionLine, type SourceId } from "@/lib/repere3d/sources";
import { DEFAULT_SETTINGS, FRAMINGS, loadRadius, pixelRatioCap, type Framing } from "@/lib/repere3d/styles";
import { sunPreset } from "@/lib/repere3d/sun";
import { chargerPhotos } from "@/lib/repere/direct";
import { parseFichier } from "@/lib/repere/fichier";
import { RUE_RAYON, distanceMeters, photoLicenseUrl, photoSourceUrl, reusablePhoto, type PhotoRue } from "@/lib/repere/panoramax";
import type { CaptureResult, LoadState, Reperage3D as Engine, RoofState, ViewInfo } from "./engine";

export interface CaptureSaved {
  sceneId: string;
  name: string;
  color: Blob;
  credit: string;
}

export interface StreetPhotoFile {
  id: string;
  author: string;
  credit: string;
  blob: Blob;
}

interface Props {
  onClose(): void;
  onCapture(input: CaptureInput): Promise<{ sceneId: string } | null>;
  onCaptured(saved: CaptureSaved): void;
  onStreetPhoto(place: { name: string; lat: number; lon: number }, photo: StreetPhotoFile): Promise<boolean>;
  /** The décor is filed: go to PRISE with it picked. */
  onPrise(): void;
  /** Show the DÉCOR gallery. */
  onDecor(): void;
}

export interface CaptureInput {
  name: string;
  note: string;
  color: Blob;
  depth: Blob;
  lines: Blob;
  /** The block around the view, for PRISE's maquette (JSON, Quartier format). */
  quartier?: string;
  meta(files: { color: string; depth: string; lines: string }): { json: string; note: string };
}

export const EXEMPLES_3D: readonly Lieu3d[] = [
  { name: "Lausanne", detail: "Vaud, Suisse", lat: 46.5206, lon: 6.6326 },
  { name: "Shibuya", detail: "Tokyo, Japon", lat: 35.6595, lon: 139.7005 },
  { name: "Times Square", detail: "New York, États-Unis", lat: 40.758, lon: -73.9855 },
  { name: "Romainmôtier", detail: "Vaud, Suisse", lat: 46.6934, lon: 6.4612 },
];

type Step = 1 | 2 | 3 | 4;
type Phase = "search" | "loading" | LoadState | "nogl";
type RueState = "idle" | "load" | "ready" | "none" | "rate" | "fail" | "demo";
type Modal = "picker" | "credits" | "ask" | null;

/** One photo that can go with the view: a street photo (fetched when the décor is made), or an image. */
interface PoolItem {
  key: string;
  kind: "rue" | "mes" | "import";
  name: string;
  thumb: string;
  photo?: PhotoRue;
  blob?: Blob;
  /** Own image: where to fetch it. */
  src?: string;
}

/** Street photos offered (closest first), and how many are picked without asking. */
const RUE_POOL = 9;
/** Pose per view height (fov sent with the frame). */
const FOVS: Record<Framing, number> = { large: 45, moyen: 45, sol: 62 };

export function Reperage3DSheet({ onClose, onCapture, onCaptured, onStreetPhoto, onPrise }: Props) {
  const { t } = useI18n();
  const { locale } = useLocaleSwitch();
  const { demo, decor, media, connected, balance, creating, createDecor, setSheet } = useStudio();
  const stage = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const geocoder = useMemo(() => createGeocoder((url, init) => fetch(url, init)), []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Lieu3d[]>([]);
  const [searchNote, setSearchNote] = useState("");
  const [searching, setSearching] = useState(false);
  const [fileNote, setFileNote] = useState("");
  const [place, setPlace] = useState<Lieu3d | null>(null);
  const [phase, setPhase] = useState<Phase>("search");
  const [sources, setSources] = useState<SourceId[]>(["osm"]);
  const [framing, setFraming] = useState<Framing>("moyen");
  const [street, setStreet] = useState(false);
  const [view, setView] = useState<ViewInfo | null>(null);
  const [roofs, setRoofs] = useState<RoofState>("off");
  const [hintSeen, setHintSeen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureFail, setCaptureFail] = useState("");
  const [captured, setCaptured] = useState<{ sceneId: string; name: string; frame: Blob; url: string; block: number } | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [rue, setRue] = useState<{ state: RueState; photos: PhotoRue[] }>({ state: "idle", photos: [] });
  const [extra, setExtra] = useState<PoolItem[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [pickNote, setPickNote] = useState("");
  const [ambiance, setAmbiance] = useState<CadreAmbiance>("photos");
  const [decorName, setDecorName] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [made, setMade] = useState<{ id: string; name: string; url: string } | null>(null);
  const [makeNote, setMakeNote] = useState("");
  const [busy, setBusy] = useState(false);
  const loadSeq = useRef(0);

  // Escape: the open card first, then the sheet.
  const modalRef = useRef<Modal>(null);
  useEffect(() => { modalRef.current = modal; }, [modal]);
  useEffect(() => {
    setTimeout(() => input.current?.focus(), 0);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (modalRef.current) { setModal(null); return; }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      engine.current?.dispose();
      engine.current = null;
    };
  }, [onClose]);

  // Each new screen: the question takes focus (the search field on screen 1).
  useEffect(() => {
    if (step === 1) input.current?.focus();
    else heading.current?.focus();
  }, [step]);

  useEffect(() => () => { if (captured) URL.revokeObjectURL(captured.url); }, [captured]);
  useEffect(() => () => { if (made) URL.revokeObjectURL(made.url); }, [made]);
  const extraUrls = useRef<string[]>([]);
  useEffect(() => { extraUrls.current = extra.filter(item => item.kind === "import").map(item => item.thumb); }, [extra]);
  useEffect(() => () => { for (const url of extraUrls.current) URL.revokeObjectURL(url); }, []);

  const ensureEngine = useCallback(async (): Promise<Engine | null> => {
    if (engine.current) return engine.current;
    const host = stage.current;
    if (!host) return null;
    const module = await import("./engine");
    if (!module.webglAvailable()) return null;
    const mobile = window.matchMedia("(max-width: 799px)").matches;
    try {
      engine.current = new module.Reperage3D(host, {
        mobile,
        pixelRatio: pixelRatioCap(mobile, window.devicePixelRatio),
        events: {
          onView: next => { setView(next); if (engine.current) setSources(engine.current.usedSources()); },
          onRoofs: state => {
            setRoofs(state);
            if (engine.current) setSources(engine.current.usedSources());
          },
        },
      });
    } catch {
      return null;
    }
    return engine.current;
  }, []);

  const findRue = useCallback(async (next: Lieu3d) => {
    // The demo never calls the street photo servers.
    if (demo) { setRue({ state: "demo", photos: [] }); return; }
    setRue({ state: "load", photos: [] });
    try {
      const found = await chargerPhotos(next.lat, next.lon, RUE_RAYON);
      if (found === "rate") { setRue({ state: "rate", photos: [] }); return; }
      const usable = found.photos
        .filter(photo => reusablePhoto(photo) && (photo.view || photo.thumb))
        .sort((a, b) => distanceMeters(next.lat, next.lon, a.lat, a.lon) - distanceMeters(next.lat, next.lon, b.lat, b.lon))
        .slice(0, RUE_POOL);
      setRue({ state: usable.length ? "ready" : found.panoramax === "fail" ? "fail" : "none", photos: usable });
    } catch {
      setRue({ state: "fail", photos: [] });
    }
  }, [demo]);

  const open = useCallback(async (next: Lieu3d) => {
    const seq = ++loadSeq.current;
    setPlace(next);
    setResults([]);
    setSearchNote("");
    setCaptured(null);
    setMade(null);
    setModal(null);
    setStep(2);
    setPhase("loading");
    setStreet(false);
    setFraming("moyen");
    setRoofs("off");
    setCaptureFail("");
    setChosen([]);
    setTouched(false);
    setDecorName(next.name.slice(0, 40));
    void findRue(next);
    const e = await ensureEngine();
    if (seq !== loadSeq.current) return;
    if (!e) { setPhase("nogl"); return; }
    // One base look only: Volumes (shaded masses), the best image 1 for Klein. Midday light.
    e.setLook("volumes");
    e.setSun(sunPreset("midi", next.lat));
    e.setLine(DEFAULT_SETTINGS.line);
    e.setTone(DEFAULT_SETTINGS.tone);
    const mobile = window.matchMedia("(max-width: 799px)").matches;
    const result = await e.load(next, loadRadius(mobile));
    if (seq !== loadSeq.current) return;
    e.setFov(FOVS.moyen);
    setSources(e.usedSources());
    setPhase(result.state === "idle" ? "loading" : result.state);
    setView(e.view());
  }, [ensureEngine, findRue]);

  // Screen 3 picks the three closest street photos by itself, until the visitor changes them.
  useEffect(() => {
    if (touched || rue.state !== "ready") return;
    setChosen(rue.photos.slice(0, CADRE_PHOTOS_MAX).map(photo => `rue-${photo.id}`));
  }, [rue, touched]);

  async function openFile(file: File | null) {
    if (!file) return;
    setFileNote("");
    try {
      const point = await parseFichier(file.name, new Uint8Array(await file.arrayBuffer()));
      if (!point) { setFileNote(t("rep3d.file.off")); return; }
      setQuery(point.name);
      void open({ name: point.name.slice(0, 80), detail: file.name.slice(0, 60), lat: point.lat, lon: point.lon });
    } catch {
      setFileNote(t("rep3d.file.off"));
    }
  }

  async function search() {
    if (searching || query.trim().length < 2) return;
    setSearching(true);
    setSearchNote("");
    try {
      const found: GeocodeResult = await geocoder.search(query, locale);
      if (found.kind === "point") { void open(found.lieu); return; }
      if (found.kind === "list") {
        if (found.lieux.length === 1) void open(found.lieux[0]);
        else setResults(found.lieux);
        return;
      }
      setResults([]);
      setSearchNote(t(`rep3d.search.${found.kind}`));
    } finally {
      setSearching(false);
    }
  }

  function pickFraming(next: Framing) {
    setFraming(next);
    setHintSeen(true);
    const e = engine.current;
    if (!e) return;
    e.frameShot(next);
    e.setFov(FOVS[next]);
    setStreet(e.isStreet());
  }

  async function capture() {
    const e = engine.current;
    if (!e || !place || capturing) return;
    setCapturing(true);
    setCaptureFail("");
    try {
      const shot: CaptureResult = await e.capture();
      const name = `${place.name} · ${t("rep3d.cadre")}`.slice(0, 40);
      let metaOut: CaptureMeta | null = null;
      const block = e.quartier(place.name);
      const saved = await onCapture({
        name,
        note: "",
        quartier: block && block.buildings.length + block.streets.length > 0 ? JSON.stringify(block) : undefined,
        color: shot.color,
        depth: shot.depth,
        lines: shot.lines,
        meta: files => {
          metaOut = buildCaptureMeta({
            place,
            camera: { lat: shot.view.lat, lon: shot.view.lon, heading: shot.view.heading, pitch: shot.view.pitch, fov: shot.fov, height: shot.view.height },
            sun: sunPreset("midi", place.lat),
            preset: "midi",
            look: "volumes",
            near: shot.near,
            far: shot.far,
            sources: shot.sources,
            files,
          });
          return { json: JSON.stringify(metaOut, null, 2), note: captureNote(metaOut) };
        },
      });
      const meta = metaOut as CaptureMeta | null;
      if (!saved || !meta) { setCaptureFail(t("rep3d.captureFail")); return; }
      setCaptured({ sceneId: saved.sceneId, name, frame: shot.color, url: URL.createObjectURL(shot.color), block: block ? block.buildings.length + block.streets.length : 0 });
      setStep(3);
      onCaptured({ sceneId: saved.sceneId, name, color: shot.color, credit: meta.credit });
    } catch {
      setCaptureFail(t("rep3d.captureFail"));
    } finally {
      setCapturing(false);
    }
  }

  const mine: PoolItem[] = decor
    .filter(card => card.id !== captured?.sceneId)
    .map(card => ({ id: card.id, name: card.name, url: card.preview ? assetPath(card.preview) : (card.sheet && media[card.sheet]) || "" }))
    .filter(card => card.url)
    .slice(0, 6)
    .map(card => ({ key: `mes-${card.id}`, kind: "mes" as const, name: card.name, thumb: card.url, src: card.url }));
  const pool: PoolItem[] = [
    ...rue.photos.map(photo => ({ key: `rue-${photo.id}`, kind: "rue" as const, name: rueCredit(photo), thumb: photo.thumb || photo.view, photo })),
    ...extra,
    ...mine.filter(item => !extra.some(other => other.key === item.key)),
  ];
  const picked = chosen.map(key => pool.find(item => item.key === key)).filter((item): item is PoolItem => Boolean(item));

  function toggle(key: string) {
    setTouched(true);
    setPickNote("");
    setChosen(list => list.includes(key) ? list.filter(item => item !== key) : list.length >= CADRE_PHOTOS_MAX ? list : [...list, key]);
  }

  function importPhotos(files: File[]) {
    const images = files.filter(file => file.type.startsWith("image/")).slice(0, CADRE_PHOTOS_MAX);
    if (!images.length) { setPickNote(t("rep3d.pk.fail")); return; }
    const items = images.map((file, index) => ({ key: `import-${Date.now()}-${index}`, kind: "import" as const, name: file.name.slice(0, 40), thumb: URL.createObjectURL(file), blob: file as Blob }));
    setExtra(list => [...items, ...list]);
    setTouched(true);
    setChosen(list => [...list, ...items.map(item => item.key)].slice(-CADRE_PHOTOS_MAX));
  }

  /** The bytes for one picked photo. Street photos keep author and licence in Mes créations › Lieux. */
  async function bytesFor(item: PoolItem): Promise<Blob> {
    if (item.blob) return item.blob;
    const url = item.photo ? item.photo.view || item.photo.thumb : item.src ?? "";
    const response = await fetch(url, item.photo ? { credentials: "omit" } : undefined);
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || (item.photo && !type.startsWith("image/"))) throw new Error("photo");
    const blob = await response.blob();
    if (blob.size < 32) throw new Error("photo");
    if (item.photo && place) {
      const photo = item.photo;
      const credit = `${rueCredit(photo)}. ${photo.sourceUrl || photoSourceUrl(photo)} — ${photo.licenseUrl || photoLicenseUrl(photo.license)}`;
      await onStreetPhoto(place, { id: photo.id, author: photo.author, credit, blob }).catch(() => false);
    }
    return blob;
  }

  async function make() {
    const quoted = cadreQuote(picked.length);
    if (!captured || !quoted || creating || busy) return;
    setMakeNote("");
    setBusy(true);
    setModal(null);
    try {
      const blobs = await Promise.all(picked.map(bytesFor));
      const frame = new File([captured.frame], "cadre-3d.png", { type: captured.frame.type || "image/png" });
      const files = [frame, ...blobs.map((blob, index) => new File([blob], `photo-${index + 1}.${blob.type.includes("png") ? "png" : "jpg"}`, { type: blob.type || "image/jpeg" }))];
      let filed: { id: string; name: string; image: Blob } | null = null;
      const ok = await createDecor({
        name: decorName.trim() || (place?.name ?? "").slice(0, 40),
        prompt: cadrePrompt({ photos: blobs.length, ambiance, detail: "" }),
        source: "photo",
        file: frame,
        files,
        confirmed: true,
        geste: "decor-photo",
        cadre: { photos: blobs.length },
        onFiled: value => { filed = value; },
      });
      const done = filed as { id: string; name: string; image: Blob } | null;
      if (!ok || !done) { setMakeNote(t("rep3d.make.fail")); return; }
      setMade({ id: done.id, name: done.name, url: URL.createObjectURL(done.image) });
      setStep(4);
    } catch {
      setMakeNote(t("rep3d.make.fail"));
    } finally {
      setBusy(false);
    }
  }

  function back() {
    setModal(null);
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
    else onClose();
  }

  function rueCredit(photo: PhotoRue): string {
    return `© ${photo.author}, ${photo.source === "panoramax" ? "Panoramax" : "Mapillary"}, ${photo.license}`;
  }

  const ready = phase === "ready" || phase === "empty";
  const problem = phase === "offline" || phase === "rate" || phase === "fail" || phase === "nogl";
  const quoted = cadreQuote(picked.length);
  const covered = quoted !== null && creationAllowed(connected, balance?.credits ?? null, quoted.high);
  const making = busy || creating;
  const shownStep = step === 4 ? 3 : step;
  const rueCredits = [...new Set(picked.filter(item => item.photo).map(item => rueCredit(item.photo!)))];
  const leadIsBack = step === 2 || step === 3;

  const card = (id: string, title: string, body: ReactNode, foot: ReactNode, data: Record<string, string>) => <div className="u-rv-modal" onClick={event => { if (event.target === event.currentTarget) setModal(null); }}>
    <div className="u-rv-card" role="dialog" aria-modal="true" aria-labelledby={id} {...data}>
      <h2 id={id}>{title}</h2>
      {body}
      <div className="u-rv-card-foot">{foot}</div>
    </div>
  </div>;

  return <div className="u-rep3d u-rv" role="dialog" aria-modal="true" aria-label={t("rep3d.title")} data-rep3d-state={phase} data-rep3d-roofs={roofs} data-look="volumes" data-street={street ? "1" : "0"} data-rep3d-step={step} data-rep3d-heading={view ? Math.round(view.heading) : ""} data-rep3d-pitch={view ? Math.round(view.pitch) : ""} data-rep3d-height={view ? Math.round(view.height) : ""}>
    <header className="u-rv-top">
      <button type="button" className="u-rv-icon" data-rep3d-lead={leadIsBack ? "back" : "close"} aria-label={leadIsBack ? t("rep3d.back") : t("rep3d.close")} onClick={leadIsBack ? back : onClose}><span aria-hidden="true">{leadIsBack ? "←" : "×"}</span></button>
      <span className="u-rv-brand" aria-label="U*TTU Studio" role="img"><BrandMark /><BrandName /></span>
      <ol className="u-rv-dots" aria-label={t("rep3d.steps.label", { n: shownStep })}>
        {(["ou", "vue", "creer"] as const).map((key, index) => <li key={key} className={index + 1 === shownStep ? "is-now" : index + 1 < shownStep || step === 4 ? "is-done" : ""} aria-current={index + 1 === shownStep ? "step" : undefined}>
          <i aria-hidden="true">{index + 1}</i><span>{t(`rep3d.steps.${key}`)}</span>
        </li>)}
      </ol>
      <PoweredBy className="u-rv-comfy" />
    </header>

    <main className="u-rv-body">
      {step === 1 && <section className="u-rv-screen u-rv-s1" data-rv-screen="1">
        <h1 className="u-rv-display">{t("rep3d.s1.title")} <em>{t("rep3d.s1.titleEm")}</em></h1>
        <figure className="u-rv-eq" data-rep3d-example="">
          <div className="u-rv-eq-tile"><img src={assetPath("/exemples/reperage/sf-vue3d.webp")} alt="" width={960} height={540} decoding="async" /><span>{t("rep3d.eq.view")}</span></div>
          <b className="u-rv-eq-op" aria-hidden="true">+</b>
          <div className="u-rv-eq-tile"><img src={assetPath("/exemples/reperage/sf-rue.webp")} alt="" width={960} height={540} decoding="async" /><span>{t("rep3d.eq.photos")}</span></div>
          <b className="u-rv-eq-op" aria-hidden="true">=</b>
          <div className="u-rv-eq-tile is-out"><img src={assetPath("/exemples/reperage/sf-exemple.webp")} alt="" width={960} height={540} decoding="async" /><span>{t("rep3d.eq.decor")}</span></div>
          <figcaption className="u-rv-eg" data-rep3d-example-note="">{t("rep3d.eq.note")}</figcaption>
        </figure>
        <form className="u-rv-where" role="search" onSubmit={event => { event.preventDefault(); void search(); }}>
          <label htmlFor="u-rv-q" className="u-rv-q">{t("rep3d.s1.q")}</label>
          <div className="u-rv-q-row">
            <input id="u-rv-q" ref={input} type="search" enterKeyHint="search" autoComplete="off" value={query} maxLength={200} aria-label={t("rep3d.searchLabel")} placeholder={t("rep3d.searchLabel")} aria-describedby={query.trim().length < 2 ? "u-rv-why" : undefined} onChange={event => setQuery(event.target.value)} />
            <button type="submit" className="u-rv-primary" disabled={searching || query.trim().length < 2}>{searching ? t("rep3d.searching") : t("rep3d.search.go")}</button>
          </div>
          {query.trim().length < 2 && <p className="sr-only" id="u-rv-why">{t("rep3d.searchWhy")}</p>}
        </form>
        {(results.length > 0 || searchNote) && <div className="u-rv-results" role="region" aria-label={t("rep3d.results")}>
          {searchNote && <p className="u-rv-note" role="status" data-rep3d-search-note="">{searchNote}</p>}
          {searchNote && <FilePick label={t("rep3d.file.open")} onFile={file => void openFile(file)} />}
          {fileNote && <p className="u-rv-note" role="status">{fileNote}</p>}
          {results.length > 0 && <ul>
            {results.map(item => <li key={`${item.name}-${item.lat}-${item.lon}`}>
              <button type="button" onClick={() => void open(item)}><b>{item.name}</b>{item.detail && <span>{item.detail}</span>}</button>
            </li>)}
          </ul>}
        </div>}
      </section>}

      <section className={step === 2 ? "u-rv-screen u-rv-s2" : "u-rv-screen u-rv-s2 is-parked"} data-rv-screen="2" aria-hidden={step !== 2 || undefined}>
        <div className="u-rv-head">
          {step === 2 && <h1 className="u-rv-display is-sm" ref={heading} tabIndex={-1}>{t("rep3d.s2.title")}</h1>}
          {place && <p className="u-rv-place" data-rep3d-place="">{place.name}{place.detail ? `, ${place.detail}` : ""}</p>}
        </div>
        <div className="u-rep3d-stage u-rv-stage" ref={stage} data-rep3d-stage="" onPointerDown={() => setHintSeen(true)} onWheel={() => setHintSeen(true)}>
          {ready && !hintSeen && <button type="button" className="u-rv-hint" data-rep3d-hint="" onClick={() => setHintSeen(true)}>
            <span className="u-rv-hand" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M8 24h32M8 24l6-6M8 24l6 6M40 24l-6-6M40 24l-6 6" /></svg></span>
            <span>{t("rep3d.s2.hint")}</span>
          </button>}
          {(phase === "loading" || capturing) && <p className="u-rv-over" role="status" id="u-rv-stage-why">{capturing ? t("rep3d.capturing") : t("rep3d.loading")}</p>}
          {problem && <div className="u-rv-over is-problem" role="alert" id="u-rv-stage-why">
            <p>{t(`rep3d.state.${phase}`)}</p>
            {phase !== "nogl" && place && <button type="button" className="u-rv-secondary" onClick={() => void open(place)}>{t("rep3d.retry")}</button>}
          </div>}
          {phase === "empty" && <p className="u-rv-flag" role="status">{t("rep3d.state.empty")}</p>}
          {place && <button type="button" className="u-rv-copy" data-rep3d-credits="" aria-label={t("rep3d.creditsBtn")} onClick={() => setModal("credits")}><span aria-hidden="true">©</span></button>}
        </div>
        <div className="u-rv-presets" role="group" aria-label={t("rep3d.s2.presets")}>
          {FRAMINGS.map(item => <button key={item} type="button" data-framing={item} aria-pressed={framing === item} disabled={!ready} aria-describedby={!ready ? "u-rv-stage-why" : undefined} onClick={() => pickFraming(item)}>
            <PresetIcon framing={item} /><span>{t(`rep3d.p.${item}`)}</span>
          </button>)}
        </div>
        {captureFail && <p className="u-rv-note" role="alert">{captureFail}</p>}
      </section>

      {step === 3 && captured && <section className="u-rv-screen u-rv-s3" data-rv-screen="3" data-rep3d-decor="">
        <div className="u-rv-head"><h1 className="u-rv-display is-sm" ref={heading} tabIndex={-1}>{t("rep3d.s3.title")}</h1></div>
        <div className="u-rv-mix">
          <figure className="u-rv-mix-view" data-capture-done="" data-rep3d-block={captured.block}><img src={captured.url} alt="" /><figcaption>{t("rep3d.s3.view")}</figcaption></figure>
          <div className="u-rv-mix-photos" data-rep3d-refs={picked.length}>
            {rue.state === "load" && !touched && picked.length === 0
              ? <p className="u-rv-note" role="status">{t("rep3d.s3.loadPhotos")}</p>
              : picked.length === 0
                ? <p className="u-rv-mix-line" data-rep3d-none="">{t("rep3d.s3.none")}</p>
                : <p className="u-rv-mix-line"><b aria-hidden="true">+</b> {picked.every(item => item.kind === "rue")
                  ? picked.length === 1 ? t("rep3d.s3.rue1") : t("rep3d.s3.rue", { n: picked.length })
                  : picked.length === 1 ? t("rep3d.s3.mix1") : t("rep3d.s3.mix", { n: picked.length })}</p>}
            {picked.length > 0 && <ul className="u-rv-thumbs">
              {picked.map((item, index) => <li key={item.key} data-rep3d-photo={item.kind}><img src={item.thumb} alt={t("rep3d.refs.alt", { n: index + 1, name: item.name })} referrerPolicy="no-referrer" /></li>)}
            </ul>}
            <div className="u-rv-row">
              <button type="button" className="u-rv-link" data-rep3d-change-photos="" onClick={() => setModal("picker")}>{picked.length ? t("rep3d.s3.change") : t("rep3d.s3.add")}</button>
              {rueCredits.length > 0 && <button type="button" className="u-rv-copy is-inline" aria-label={t("rep3d.creditsBtn")} onClick={() => setModal("credits")}><span aria-hidden="true">©</span></button>}
            </div>
            <details className="u-rv-opts" data-rep3d-more="">
              <summary>{t("rep3d.s3.options")}</summary>
              <div className="u-rv-opts-in">
                <p className="u-rv-label" id="u-rv-mood">{t("rep3d.s3.mood")}</p>
                <div className="u-rv-chips" role="group" aria-labelledby="u-rv-mood">
                  {CADRE_AMBIANCES.map(item => <button key={item} type="button" aria-pressed={ambiance === item} data-ambiance={item} onClick={() => setAmbiance(item)}>{t(`rep3d.ambiance.${item}`)}</button>)}
                </div>
                <label className="u-rv-label" htmlFor="u-rv-name">{t("rep3d.s3.name")}</label>
                <input id="u-rv-name" value={decorName} maxLength={40} autoComplete="off" data-rep3d-name="" onChange={event => setDecorName(event.target.value)} />
                <div className="u-rv-chips">
                  <button type="button" disabled data-strict="strict" aria-describedby="u-rv-strict">{t("rep3d.strict.label")}</button>
                  <span className="u-rv-note" id="u-rv-strict">{t("rep3d.strict.soon")}</span>
                </div>
              </div>
            </details>
          </div>
        </div>
        {makeNote && <p className="u-rv-note" role="alert">{makeNote}</p>}
      </section>}

      {step === 4 && made && <section className="u-rv-screen u-rv-s4" data-rv-screen="4" data-rep3d-made={made.id}>
        <div className="u-rv-head">
          <h1 className="u-rv-display is-sm" ref={heading} tabIndex={-1}>{t("rep3d.s4.title")}</h1>
          <p className="u-rv-place" data-rep3d-saved="">{t("rep3d.s4.saved")}</p>
        </div>
        <figure className="u-rv-result"><img src={made.url} alt={made.name} /></figure>
      </section>}
    </main>

    {step !== 1 && <footer className="u-rv-foot">
      {step === 2 && <button type="button" className="u-rv-primary" data-rep3d-capture="" disabled={!ready || capturing} aria-describedby={!ready || capturing ? "u-rv-stage-why" : undefined} onClick={() => void capture()}>{capturing ? t("rep3d.capturing") : t("rep3d.s2.go")}</button>}
      {step === 3 && <button type="button" className="u-rv-primary" data-rep3d-create="" data-rep3d-credits={quoted?.credits ?? ""} disabled={!quoted || making} aria-describedby={!quoted ? "u-rv-none" : undefined} onClick={() => setModal("ask")}>
        {t("rep3d.s3.go")}{quoted ? ` · ${t("rep3d.quote", { credits: quoted.credits })}` : ""}
      </button>}
      {step === 3 && !quoted && <p className="sr-only" id="u-rv-none">{t("rep3d.s3.none")}</p>}
      {step === 4 && <>
        <button type="button" className="u-rv-secondary" data-rep3d-again="" onClick={() => { setMade(null); setStep(3); }}>{t("rep3d.s4.again")}</button>
        <button type="button" className="u-rv-primary" data-rep3d-to-prise="" onClick={onPrise}>{t("rep3d.s4.go")}</button>
      </>}
    </footer>}

    {modal === "picker" && card("u-rv-pk", t("rep3d.pk.title", { max: CADRE_PHOTOS_MAX }), <>
      {rue.state !== "ready" && rue.state !== "load" && <p className="u-rv-note">{t("rep3d.pk.none")}</p>}
      <ul className="u-rv-pk">
        {pool.map(item => <li key={item.key}><button type="button" aria-pressed={chosen.includes(item.key)} data-rep3d-pool={item.kind} aria-label={item.photo ? t("rep3d.pk.alt", { author: item.photo.author }) : item.name} disabled={!chosen.includes(item.key) && chosen.length >= CADRE_PHOTOS_MAX} aria-describedby={!chosen.includes(item.key) && chosen.length >= CADRE_PHOTOS_MAX ? "u-rv-pk" : undefined} onClick={() => toggle(item.key)}>
          <img src={item.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" /><i aria-hidden="true">✓</i>
        </button></li>)}
        <li><label className="u-rv-pk-import" data-rep3d-pick="import"><input type="file" accept="image/*" multiple onChange={event => { importPhotos([...(event.target.files ?? [])]); event.target.value = ""; }} /><span aria-hidden="true">＋</span><span>{t("rep3d.pk.import")}</span></label></li>
      </ul>
      {pickNote && <p className="u-rv-note" role="alert">{pickNote}</p>}
    </>, <button type="button" className="u-rv-primary" data-rep3d-pick-ok="" onClick={() => setModal(null)}>{t("rep3d.pk.ok")}</button>, { "data-rep3d-picker": "" })}

    {modal === "credits" && card("u-rv-cr", t("rep3d.cr.title"), <ul className="u-rv-cr">
      <li data-rep3d-credit="">{t("rep3d.cr.map")} {attributionLine(sources)}</li>
      {rueCredits.length > 0 && <li data-rep3d-rue-credit="">{t("rep3d.cr.photos")} {rueCredits.join(" · ")}</li>}
      <li>{t("rep3d.cr.noGoogle")}</li>
    </ul>, <button type="button" className="u-rv-secondary" onClick={() => setModal(null)}>{t("rep3d.cr.close")}</button>, { "data-rep3d-credits-card": "" })}

    {modal === "ask" && quoted && card("u-rv-ask", t("rep3d.ask.title"), !connected
      ? <p data-rep3d-ask-why="connect">{t("rep3d.ask.connect")}</p>
      : !covered
        ? <p data-rep3d-ask-why="low">{t("rep3d.ask.low", { high: quoted.high })}</p>
        : <p data-rep3d-quote="">{t("rep3d.ask.line", { credits: quoted.credits, high: quoted.high })}</p>,
    <>
      <button type="button" className="u-rv-secondary" onClick={() => setModal(null)}>{t("rep3d.ask.cancel")}</button>
      {!connected
        ? <button type="button" className="u-rv-primary" data-connect-link="" onClick={() => { onClose(); setSheet("connect"); }}>{t("outils.link")}</button>
        : covered && <button type="button" className="u-rv-primary" data-rep3d-yes="" onClick={() => void make()}>{t("rep3d.ask.yes")}</button>}
    </>, { "data-rep3d-ask": "" })}

    {making && captured && <div className="u-rv-making" data-rep3d-making=""><img src={captured.url} alt="" /><p role="status">{t("rep3d.making")}</p></div>}
  </div>;
}

function PresetIcon({ framing }: { framing: Framing }) {
  return <svg viewBox="0 0 40 28" aria-hidden="true">
    {framing === "large" && <><path d="M4 24h32M20 4v6M14 10h12" /><path d="M8 24l5-8h14l5 8" /></>}
    {framing === "moyen" && <><path d="M4 24h32M28 8l-6 4" /><path d="M8 24v-9h8v9M20 24v-6h10v6" /></>}
    {framing === "sol" && <><path d="M4 24h32M8 24V8h9v16M23 24V12h9v12" /><circle cx="20" cy="22" r="1.6" /></>}
  </svg>;
}

function FilePick({ label, onFile }: { label: string; onFile(file: File | null): void }) {
  return <label className="u-rv-link u-rv-file" data-rep3d-file="">
    {label}
    <input className="sr-only" type="file" accept=".kml,.kmz,.geojson,.json,application/geo+json,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" onChange={event => { onFile(event.target.files?.[0] ?? null); event.target.value = ""; }} />
  </label>;
}
