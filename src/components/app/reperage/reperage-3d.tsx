"use client";

// « Décor depuis un lieu » in three steps: 1 Lieu (search), 2 Cadre (3D city or street photo,
// « Garder ce cadre » is free and filed in Mes créations › Lieux), 3 Décor (the kept frame is the
// fixed base, one to three reference photos give the look; one Klein edit on the visitor's Comfy).
// Open data only (OpenStreetMap, Terrain Tiles, swisstopo in Switzerland). Steps 1 and 2 spend nothing.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { useStudio } from "../studio-session";
import { ConnectLink } from "../connect-link";
import { assetPath } from "@/lib/site";
import { creationAllowed } from "@/lib/creation/quotes";
import { CADRE_AMBIANCES, CADRE_PHOTOS_MAX, cadrePrompt, cadreQuote, type CadreAmbiance } from "@/lib/creation/decor-cadre";
import { ExempleSaintFrancois } from "./exemple-sf";
import { buildCaptureMeta, captureNote, focalFor, type CaptureMeta } from "@/lib/repere3d/capture";
import { createGeocoder, type GeocodeResult, type Lieu3d } from "@/lib/repere3d/geocode";
import { SOURCES, TERRAIN_FULL, attributionLine, type SourceId } from "@/lib/repere3d/sources";
import { DEFAULT_SETTINGS, FRAMINGS, LIMITS, LOOKS, clampSetting, loadRadius, pixelRatioCap, type Framing, type Look } from "@/lib/repere3d/styles";
import { SUN_PRESETS, sunPreset, type Sun, type SunPreset } from "@/lib/repere3d/sun";
import { chargerPhotos } from "@/lib/repere/direct";
import { parseFichier } from "@/lib/repere/fichier";
import { RUE_RAYON, distanceMeters, photoLicenseUrl, photoSourceUrl, reusablePhoto, type PhotoRue } from "@/lib/repere/panoramax";
import dynamic from "next/dynamic";
import type { RueHandle } from "../rue-viewer";
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

/** One reference photo for step 3 (images 2–4 of the Klein edit). */
interface RefPhoto {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  origin: "rue" | "mes" | "import";
}

type Step = 1 | 2 | 3 | 4;

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

const RueViewer = dynamic(() => import("../rue-viewer").then(module => module.RueViewer), { ssr: false, loading: () => <div className="u-rue-stage" role="status" /> });

export const EXEMPLES_3D: readonly Lieu3d[] = [
  { name: "Lausanne", detail: "Vaud, Suisse", lat: 46.5206, lon: 6.6326 },
  { name: "Shibuya", detail: "Tokyo, Japon", lat: 35.6595, lon: 139.7005 },
  { name: "Times Square", detail: "New York, États-Unis", lat: 40.758, lon: -73.9855 },
  { name: "Romainmôtier", detail: "Vaud, Suisse", lat: 46.6934, lon: 6.4612 },
];

type Phase = "search" | "loading" | LoadState | "nogl";
type RueState = "idle" | "load" | "ready" | "none" | "rate" | "fail" | "demo";
const RUE_PLUS_LOIN = 1000;

export function Reperage3DSheet({ onClose, onCapture, onCaptured, onStreetPhoto, onPrise, onDecor }: Props) {
  const { t } = useI18n();
  const { locale } = useLocaleSwitch();
  const { demo, decor, media, connected, balance, creating, createDecor } = useStudio();
  const stage = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const geocoder = useMemo(() => createGeocoder((url, init) => fetch(url, init)), []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Lieu3d[]>([]);
  const [searchNote, setSearchNote] = useState("");
  const [searching, setSearching] = useState(false);
  const [place, setPlace] = useState<Lieu3d | null>(null);
  const [phase, setPhase] = useState<Phase>("search");
  const [count, setCount] = useState(0);
  const [sources, setSources] = useState<SourceId[]>(["osm"]);
  // Volumes by default: shaded masses read well as Klein's image 1 (see frameFor below).
  const [look, setLook] = useState<Look>("volumes");
  const [framing, setFraming] = useState<Framing | null>("moyen");
  const [preset, setPreset] = useState<SunPreset | "manuel">("midi");
  const [sun, setSun] = useState<Sun>({ azimuth: 180, altitude: 45 });
  const [fov, setFov] = useState(DEFAULT_SETTINGS.fov);
  const [line, setLine] = useState(DEFAULT_SETTINGS.line);
  const [tone, setTone] = useState(DEFAULT_SETTINGS.tone);
  const [street, setStreet] = useState(false);
  const [view, setView] = useState<ViewInfo | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<{ meta: CaptureMeta; urls: { color: string; depth: string; lines: string; frame: string }; block: number; sceneId: string; name: string; frame: Blob } | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [src, setSrc] = useState<"3d" | "rue">("3d");
  const [photos, setPhotos] = useState<RefPhoto[]>([]);
  const [picker, setPicker] = useState<"rue" | "mes" | null>(null);
  const [ambiance, setAmbiance] = useState<CadreAmbiance>("photos");
  const [detail, setDetail] = useState("");
  const [decorName, setDecorName] = useState("");
  const [ask, setAsk] = useState(false);
  const [made, setMade] = useState<{ id: string; name: string; url: string; cost: number | null; quote: number } | null>(null);
  const [makeNote, setMakeNote] = useState("");
  const [captureNoteText, setCaptureNoteText] = useState("");
  const [rue, setRue] = useState<{ state: RueState; photos: PhotoRue[]; index: number; radius: number }>({ state: "idle", photos: [], index: 0, radius: RUE_RAYON });
  const [roofs, setRoofs] = useState<{ state: RoofState; count: number }>({ state: "off", count: 0 });
  const [fileNote, setFileNote] = useState("");
  const [around, setAround] = useState(false);
  const [aroundCap, setAroundCap] = useState(0);
  const rueView = useRef<RueHandle>(null);
  const [rueNote, setRueNote] = useState("");
  const [rueSaving, setRueSaving] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const loadSeq = useRef(0);

  useEffect(() => {
    input.current?.focus();
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      engine.current?.dispose();
      engine.current = null;
    };
  }, [onClose]);

  useEffect(() => () => {
    if (captured) for (const url of new Set(Object.values(captured.urls))) URL.revokeObjectURL(url);
  }, [captured]);
  const photoUrls = useRef<string[]>([]);
  useEffect(() => { photoUrls.current = photos.map(item => item.url); }, [photos]);
  useEffect(() => () => { for (const url of photoUrls.current) URL.revokeObjectURL(url); }, []);
  useEffect(() => () => { if (made) URL.revokeObjectURL(made.url); }, [made]);

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
          onRoofs: (state, count) => {
            setRoofs({ state, count });
            if (engine.current) setSources(engine.current.usedSources());
          },
        },
      });
    } catch {
      return null;
    }
    return engine.current;
  }, []);

  const open = useCallback(async (next: Lieu3d) => {
    const seq = ++loadSeq.current;
    setPlace(next);
    setResults([]);
    setSearchNote("");
    setCaptured(null);
    setStep(2);
    setSrc("3d");
    setPicker(null);
    setAsk(false);
    setMade(null);
    setCaptureNoteText("");
    setPhase("loading");
    setStreet(false);
    setFraming("moyen");
    setRoofs({ state: "off", count: 0 });
    setFileNote("");
    const lit = preset === "manuel" ? sun : sunPreset(preset, next.lat);
    setSun(lit);
    const e = await ensureEngine();
    if (seq !== loadSeq.current) return;
    if (!e) {
      setPhase("nogl");
      void findRue(next);
      return;
    }
    e.setLook(look);
    e.setSun(lit);
    e.setLine(line);
    e.setTone(tone);
    const mobile = window.matchMedia("(max-width: 799px)").matches;
    const result = await e.load(next, loadRadius(mobile));
    if (seq !== loadSeq.current) return;
    e.setFov(fov);
    setCount(result.buildings);
    setSources(e.usedSources());
    setPhase(result.state === "idle" ? "loading" : result.state);
    setView(e.view());
    void findRue(next);
    // findRue is stable enough: it only reads the place it is given.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureEngine, fov, line, look, preset, sun, tone]);

  async function findRue(next: Lieu3d, radius = RUE_RAYON) {
    // The demo never calls the street photo servers.
    if (demo) { setRue({ state: "demo", photos: [], index: 0, radius }); return; }
    setRue({ state: "load", photos: [], index: 0, radius });
    setRueNote("");
    setAround(false);
    try {
      const found = await chargerPhotos(next.lat, next.lon, radius);
      if (found === "rate") { setRue({ state: "rate", photos: [], index: 0, radius }); return; }
      const photos = found.photos.slice(0, 24);
      const index = Math.max(0, Math.min(photos.length - 1, found.start));
      setRue({ state: photos.length ? "ready" : found.panoramax === "fail" ? "fail" : "none", photos, index, radius });
    } catch {
      setRue({ state: "fail", photos: [], index: 0, radius });
    }
  }

  function stepRue(dir: -1 | 1) {
    setRueNote("");
    setAround(false);
    setRue(current => ({ ...current, index: Math.max(0, Math.min(current.photos.length - 1, current.index + dir)) }));
  }

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

  function pickLook(next: Look) {
    setLook(next);
    engine.current?.setLook(next);
    if (engine.current) setSources(engine.current.usedSources());
  }

  function pickFraming(next: Framing) {
    setFraming(next);
    const e = engine.current;
    if (!e) return;
    e.frameShot(next);
    setStreet(e.isStreet());
    const pose = { large: 45, moyen: 45, contre: 62 }[next];
    setFov(pose);
  }

  function pickPreset(next: SunPreset) {
    setPreset(next);
    const lit = sunPreset(next, place?.lat ?? 46.5);
    setSun(lit);
    engine.current?.setSun(lit);
  }

  function changeSun(part: "azimuth" | "altitude", value: number) {
    const next = { ...sun, [part]: clampSetting(part, value) };
    setPreset("manuel");
    setSun(next);
    engine.current?.setSun(next);
  }

  function changeFov(value: number) {
    const next = clampSetting("fov", value);
    setFov(next);
    engine.current?.setFov(next);
  }

  function toggleStreet() {
    const e = engine.current;
    if (!e) return;
    const on = !e.isStreet();
    e.setStreet(on);
    setStreet(on);
    setFraming(on ? null : "moyen");
    setFov(on ? 62 : 45);
    e.setFov(on ? 62 : 45);
  }

  async function capture() {
    const e = engine.current;
    if (!e || !place || capturing) return;
    setCapturing(true);
    setCaptureNoteText("");
    try {
      const shot: CaptureResult = await e.capture();
      // Klein's image 1. White line art (Trait, Trait + ombres) carries no light and no surfaces, so the
      // edit tends to keep it as a drawing: the frame sent is a Volumes pass of the same camera. Photo-carte
      // and Volumes are sent as seen.
      let frame = shot.color;
      if (look === "trait" || look === "ombres") {
        e.setLook("volumes");
        try { frame = (await e.capture()).color; } finally { e.setLook(look); }
      }
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
            sun,
            preset,
            look,
            near: shot.near,
            far: shot.far,
            sources: shot.sources,
            files,
          });
          return { json: JSON.stringify(metaOut, null, 2), note: captureNote(metaOut) };
        },
      });
      const meta = metaOut as CaptureMeta | null;
      if (!saved || !meta) {
        setCaptureNoteText(t("rep3d.captureFail"));
        return;
      }
      const color = URL.createObjectURL(shot.color);
      setCaptured({ meta, urls: { color, depth: URL.createObjectURL(shot.depth), lines: URL.createObjectURL(shot.lines), frame: frame === shot.color ? color : URL.createObjectURL(frame) }, block: block ? block.buildings.length + block.streets.length : 0, sceneId: saved.sceneId, name, frame });
      setDecorName(current => current.trim() ? current : place.name.slice(0, 40));
      setStep(3);
      setAsk(false);
      onCaptured({ sceneId: saved.sceneId, name, color: shot.color, credit: meta.credit });
    } catch {
      setCaptureNoteText(t("rep3d.captureFail"));
    } finally {
      setCapturing(false);
    }
  }

  async function addRue() {
    const photo = rue.photos[rue.index] ?? null;
    if (!photo || !place || rueSaving || !reusablePhoto(photo)) return;
    setRueSaving(true);
    setRueNote("");
    try {
      // Looking around in 360°: keep the framed view. Otherwise the whole photo.
      const framed = around ? await rueView.current?.capture() ?? null : null;
      let blob = framed;
      if (!blob) {
        const response = await fetch(photo.view || photo.thumb, { credentials: "omit" });
        const type = response.headers.get("content-type") ?? "";
        if (!response.ok || !type.startsWith("image/")) throw new Error("photo");
        blob = await response.blob();
      }
      const credit = `${rueCredit(photo)}. ${framed ? t("rep3d.rue.framed") : t("rep3d.rue.whole")}. ${photo.sourceUrl || photoSourceUrl(photo)} — ${photo.licenseUrl || photoLicenseUrl(photo.license)}`;
      if (photos.length >= CADRE_PHOTOS_MAX) { setRueNote(t("rep3d.refs.full", { max: CADRE_PHOTOS_MAX })); return; }
      const ok = await onStreetPhoto(place, { id: photo.id, author: photo.author, credit, blob });
      if (ok) addPhoto({ id: `rue-${photo.id}-${photos.length}`, name: rueCredit(photo), blob, origin: "rue" });
      setRueNote(ok ? t("rep3d.rue.added", { n: Math.min(CADRE_PHOTOS_MAX, photos.length + 1), max: CADRE_PHOTOS_MAX }) : t("rep3d.rue.fail"));
      if (ok && step === 3) setPicker(null);
    } catch {
      setRueNote(t("rep3d.rue.fail"));
    } finally {
      setRueSaving(false);
    }
  }

  function addPhoto(item: Omit<RefPhoto, "url">) {
    setPhotos(list => list.length >= CADRE_PHOTOS_MAX ? list : [...list, { ...item, url: URL.createObjectURL(item.blob) }]);
    setAsk(false);
  }

  function removePhoto(id: string) {
    setPhotos(list => {
      const gone = list.find(item => item.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return list.filter(item => item.id !== id);
    });
    setAsk(false);
  }

  function importPhotos(files: File[]) {
    const room = CADRE_PHOTOS_MAX - photos.length;
    files.filter(file => file.type.startsWith("image/")).slice(0, Math.max(0, room)).forEach((file, index) => addPhoto({ id: `import-${Date.now()}-${index}`, name: file.name.slice(0, 40), blob: file, origin: "import" }));
  }

  async function pickMine(card: { id: string; name: string; url: string }) {
    if (photos.length >= CADRE_PHOTOS_MAX) return;
    try {
      const response = await fetch(card.url);
      const blob = await response.blob();
      if (!blob.type.startsWith("image/") || blob.size < 32) throw new Error("image");
      addPhoto({ id: `mes-${card.id}-${photos.length}`, name: card.name, blob, origin: "mes" });
      setPicker(null);
    } catch {
      setMakeNote(t("rep3d.pick.fail"));
    }
  }

  async function make() {
    const quoted = cadreQuote(photos.length);
    if (!captured || !quoted || creating) return;
    setMakeNote("");
    const frame = new File([captured.frame], "cadre-3d.png", { type: captured.frame.type || "image/png" });
    const files = [frame, ...photos.map((item, index) => new File([item.blob], `photo-${index + 1}.${item.blob.type.includes("png") ? "png" : "jpg"}`, { type: item.blob.type || "image/jpeg" }))];
    let filed: { id: string; name: string; cost: number | null; quote: number; image: Blob } | null = null;
    const ok = await createDecor({
      name: decorName,
      prompt: cadrePrompt({ photos: photos.length, ambiance, detail }),
      source: "photo",
      file: frame,
      files,
      confirmed: true,
      geste: "decor-photo",
      cadre: { photos: photos.length },
      onFiled: value => { filed = value; },
    });
    setAsk(false);
    const done = filed as { id: string; name: string; cost: number | null; quote: number; image: Blob } | null;
    if (!ok || !done) { setMakeNote(t("rep3d.make.fail")); return; }
    setMade({ id: done.id, name: done.name, url: URL.createObjectURL(done.image), cost: done.cost, quote: done.quote });
    setStep(4);
  }

  function rueCredit(photo: PhotoRue): string {
    return `© ${photo.author}, ${photo.source === "panoramax" ? "Panoramax" : "Mapillary"}, ${photo.license}`;
  }

  const ready = phase === "ready" || phase === "empty";
  const photo = rue.photos[rue.index] ?? null;
  const loading = phase === "loading";
  const credit = attributionLine(sources);
  const focal = focalFor(fov);
  const hint = street ? t("rep3d.hint.street") : coarse ? t("rep3d.hint.touch") : t("rep3d.hint.mouse");
  const problem = phase === "offline" || phase === "rate" || phase === "fail" || phase === "nogl";
  const quoted = cadreQuote(photos.length);
  const shownQuote = quoted ?? cadreQuote(1)!;
  const covered = quoted !== null && creationAllowed(connected, balance?.credits ?? null, quoted.high);
  const named = decorName.trim().length > 0;
  const makeBlocked = !captured || !quoted || !named || !connected || !covered || creating;
  const makeWhy = !quoted ? t("rep3d.make.needPhoto") : !named ? t("rep3d.make.needName") : !connected ? t("create.needLink") : !covered ? t("create.needCeiling") : creating ? t("create.running") : "";
  const mine = decor
    .filter(card => card.id !== captured?.sceneId)
    .map(card => ({ id: card.id, name: card.name, url: card.preview ? assetPath(card.preview) : (card.sheet && media[card.sheet]) || "", decor: card.geste !== "repere" }))
    .filter(card => card.url)
    .slice(0, 12);
  const stepLabel = (n: Step) => n === 1 ? t("rep3d.steps.lieu") : n === 2 ? t("rep3d.steps.cadre") : t("rep3d.steps.decor");
  const canGo = (n: Step) => n === 1 || (n === 2 && Boolean(place)) || (n === 3 && Boolean(captured));

  const rueCard = rue.state === "ready" && photo && place ? <div className="u-rep3d-rue-card" data-rep3d-rue-index={rue.index} data-rep3d-rue-count={rue.photos.length}>
    {around
      ? <RueViewer ref={rueView} photo={photo} demo={false} cap={aroundCap} onCap={setAroundCap} onFail={() => setRueNote(t("rep3d.rue.fail"))} />
      : photo.thumb ? <img src={photo.view || photo.thumb} alt={t("rep3d.rue.alt", { author: photo.author })} loading="lazy" referrerPolicy="no-referrer" /> : <span className="u-rep3d-rue-blank" />}
    <p className="u-small" data-rep3d-rue-credit="">{rueCredit(photo)} · {Math.round(distanceMeters(place.lat, place.lon, photo.lat, photo.lon))} m · <a href={photo.sourceUrl || photoSourceUrl(photo)} target="_blank" rel="noreferrer noopener">{t("rep3d.rue.source")}</a></p>
    <div className="u-rep3d-rue-bar">
      {rue.photos.length > 1 && <>
        <button type="button" className="u-secondary" data-rep3d-rue-prev="" disabled={rue.index === 0} aria-describedby="u-rep3d-rue-pos" aria-label={t("rep3d.rue.prev")} onClick={() => stepRue(-1)}>‹</button>
        <span className="u-small" id="u-rep3d-rue-pos" aria-live="polite">{t("rep3d.rue.count", { index: rue.index + 1, count: rue.photos.length })}</span>
        <button type="button" className="u-secondary" data-rep3d-rue-next="" disabled={rue.index >= rue.photos.length - 1} aria-describedby="u-rep3d-rue-pos" aria-label={t("rep3d.rue.next")} onClick={() => stepRue(1)}>›</button>
      </>}
      {photo.view && <button type="button" className="u-secondary" data-rep3d-rue-around="" aria-pressed={around} onClick={() => setAround(value => !value)}>{around ? t("rep3d.rue.aroundOff") : photo.tour ? t("rep3d.rue.around360") : t("rep3d.rue.around")}</button>}
      <button type="button" className="u-primary" data-rep3d-rue-add="" disabled={rueSaving || !reusablePhoto(photo) || photos.length >= CADRE_PHOTOS_MAX} aria-describedby={!reusablePhoto(photo) ? "u-rep3d-rue-why" : photos.length >= CADRE_PHOTOS_MAX ? "u-rep3d-rue-full" : undefined} onClick={() => void addRue()}>{t("rep3d.rue.add")}</button>
    </div>
    {!reusablePhoto(photo) && <p className="u-why" id="u-rep3d-rue-why">{t("rep3d.rue.licence")}</p>}
    {reusablePhoto(photo) && photos.length >= CADRE_PHOTOS_MAX && <p className="u-why" id="u-rep3d-rue-full">{t("rep3d.refs.full", { max: CADRE_PHOTOS_MAX })}</p>}
  </div> : null;
  const rueSection = <section className="u-rep3d-rue" aria-label={t("rep3d.rue.title")} data-rep3d-rue={rue.state}>
    <p className="u-label">{t("rep3d.rue.title")}</p>
    {rue.state === "idle" && <p className="u-small">{t("rep3d.rue.idle")}</p>}
    {rue.state === "load" && <p className="u-small" role="status">{t("rep3d.rue.load")}</p>}
    {rue.state === "none" && <p className="u-small">{t("rep3d.rue.none", { radius: rue.radius })}</p>}
    {rue.state === "rate" && <p className="u-small">{t("rep3d.state.rate")}</p>}
    {rue.state === "demo" && <p className="u-small">{t("rep3d.rue.demo")}</p>}
    {rue.state === "fail" && <p className="u-small">{t("rep3d.rue.fail")}</p>}
    {(rue.state === "none" || rue.state === "fail") && place && rue.radius < RUE_PLUS_LOIN && <button type="button" className="u-secondary" data-rep3d-rue-wider="" onClick={() => void findRue(place, RUE_PLUS_LOIN)}>{t("rep3d.rue.wider", { radius: RUE_PLUS_LOIN })}</button>}
    {rueCard}
    {rueNote && <p className="u-small" role="status" data-rep3d-rue-note="">{rueNote}</p>}
  </section>;

  return <div className="u-rep3d" role="dialog" aria-modal="true" aria-labelledby="u-rep3d-title" data-rep3d-state={phase} data-rep3d-roofs={roofs.state} data-look={look} data-street={street ? "1" : "0"} data-rep3d-step={step} data-rep3d-src={src}>
    <header className="u-rep3d-top">
      <button type="button" className="u-rep3d-close" aria-label={t("rep3d.close")} onClick={onClose}>×</button>
      <h2 id="u-rep3d-title" className="u-rep3d-title">{t("rep3d.title")}</h2>
      <ol className="u-rep3d-steps" aria-label={t("rep3d.steps.label")}>
        {([1, 2, 3] as Step[]).map(n => <li key={n}>
          <button type="button" data-rep3d-step-tab={n} aria-current={(step === n || (n === 3 && step === 4)) ? "step" : undefined} disabled={!canGo(n) || creating} aria-describedby={!canGo(n) || creating ? "u-rep3d-steps-why" : undefined} onClick={() => { setStep(n); setPicker(null); setAsk(false); }}>
            <b>{n}</b><span>{stepLabel(n)}</span>
          </button>
        </li>)}
      </ol>
      <p className="sr-only" id="u-rep3d-steps-why">{t("rep3d.steps.why")}</p>
    </header>
    {step === 1 && <form className="u-rep3d-search" role="search" onSubmit={event => { event.preventDefault(); void search(); }}>
      <input ref={input} type="search" enterKeyHint="search" value={query} maxLength={200} aria-label={t("rep3d.searchLabel")} placeholder={t("rep3d.searchPh")} onChange={event => setQuery(event.target.value)} />
      <button type="submit" className="u-primary" disabled={searching || query.trim().length < 2} aria-describedby={query.trim().length < 2 ? "u-rep3d-why" : undefined}>{searching ? t("rep3d.searching") : t("rep3d.search.go")}</button>
    </form>}
    {step === 1 && query.trim().length < 2 && <p className="sr-only" id="u-rep3d-why">{t("rep3d.searchWhy")}</p>}
    {step === 1 && (results.length > 0 || searchNote) && <div className="u-rep3d-results" role="region" aria-label={t("rep3d.results")}>
      {searchNote && <p className="u-small" role="status" data-rep3d-search-note="">{searchNote}</p>}
      {results.length > 0 && <ul>
        {results.map(item => <li key={`${item.name}-${item.lat}-${item.lon}`}>
          <button type="button" onClick={() => void open(item)}><b>{item.name}</b>{item.detail && <span>{item.detail}</span>}</button>
        </li>)}
      </ul>}
    </div>}
    <div className="u-rep3d-body">
      <div className="u-rep3d-view">
        <div className={place && step !== 1 ? "u-rep3d-stage" : "u-rep3d-stage is-empty"} ref={stage} data-rep3d-stage="">
          {(!place || step === 1) && <div className="u-rep3d-empty">
            <p>{t("rep3d.empty")}</p>
            <div className="u-rep3d-chips" aria-label={t("rep3d.tryThese")}>
              {EXEMPLES_3D.map(item => <button key={item.name} type="button" onClick={() => { setQuery(item.name); void open(item); }}>{item.name}<span>{item.detail}</span></button>)}
            </div>
            <FilePick label={t("rep3d.file.open")} onFile={file => void openFile(file)} />
            {fileNote && <p className="u-small" role="status">{fileNote}</p>}
            <p className="u-small">{t("rep3d.noGoogle")}</p>
          </div>}
          {place && ready && step === 2 && <div className="u-rep3d-frame" aria-hidden="true"><span>{t("rep3d.frame")}</span></div>}
          {loading && step === 2 && <p className="u-rep3d-overlay" role="status">{t("rep3d.loading")}</p>}
          {problem && step === 2 && <div className="u-rep3d-overlay is-problem" role="alert">
            <p>{t(`rep3d.state.${phase}`)}</p>
            {phase !== "nogl" && place && <button type="button" className="u-secondary" onClick={() => void open(place)}>{t("rep3d.retry")}</button>}
            {phase === "nogl" && rue.state === "ready" && <button type="button" className="u-secondary" onClick={() => setSrc("rue")}>{t("rep3d.src.rue")}</button>}
          </div>}
          {phase === "empty" && step === 2 && <p className="u-rep3d-flag" role="status">{t("rep3d.state.empty")}</p>}
          {ready && step === 2 && roofs.state === "loading" && <p className="u-rep3d-flag is-soft" role="status" data-rep3d-roofs-loading="">{t("rep3d.roofs.loading")}</p>}
          {place && step !== 1 && <p className="u-rep3d-credit" data-rep3d-credit="">{credit}</p>}
          {step === 2 && src === "rue" && <div className="u-rep3d-rue-over" data-rep3d-rue-over="">{rueSection}</div>}
        </div>
        {step === 2 && place && <div className="u-rep3d-src" role="group" aria-label={t("rep3d.src.label")}>
          <button type="button" aria-pressed={src === "3d"} data-rep3d-src-pick="3d" onClick={() => { setSrc("3d"); setAround(false); }}>{t("rep3d.src.d3")}</button>
          <button type="button" aria-pressed={src === "rue"} data-rep3d-src-pick="rue" onClick={() => setSrc("rue")}>{t("rep3d.src.rue")}{rue.state === "ready" ? ` · ${rue.photos.length}` : ""}</button>
        </div>}
        {ready && step === 2 && src === "3d" && <div className="u-rep3d-pad" data-rep3d-pad="" aria-label={t("rep3d.camera")} role="group">
          <button type="button" aria-label={t("rep3d.btn.left")} onClick={() => engine.current?.nudge(-20, 0)}>↺</button>
          <button type="button" aria-label={t("rep3d.btn.right")} onClick={() => engine.current?.nudge(20, 0)}>↻</button>
          <button type="button" aria-label={t("rep3d.btn.up")} onClick={() => engine.current?.nudge(0, 8)}>▲</button>
          <button type="button" aria-label={t("rep3d.btn.down")} onClick={() => engine.current?.nudge(0, -8)}>▼</button>
          {street
            ? <>
              <button type="button" aria-label={t("rep3d.btn.forward")} onClick={() => engine.current?.walk(12)}>⇡</button>
              <button type="button" aria-label={t("rep3d.btn.back")} onClick={() => engine.current?.walk(-12)}>⇣</button>
            </>
            : <>
              <button type="button" aria-label={t("rep3d.btn.in")} onClick={() => engine.current?.zoom(0.75)}>+</button>
              <button type="button" aria-label={t("rep3d.btn.out")} onClick={() => engine.current?.zoom(1.33)}>−</button>
            </>}
        </div>}
        {ready && step === 2 && src === "3d" && <p className="u-rep3d-hint">{hint}</p>}
      </div>
      {step === 2 && <aside className="u-rep3d-side">
        {place && <p className="u-rep3d-place" data-rep3d-place="">
          <b>{place.name}</b>
          <span>{place.detail ? `${place.detail} · ` : ""}{place.lat.toFixed(4)}, {place.lon.toFixed(4)}{ready ? ` · ${t("rep3d.buildings", { count })}` : ""}</span>
          {ready && roofs.state !== "off" && <span className="u-rep3d-roofs" data-rep3d-roofs={roofs.state}>{t(`rep3d.roofs.${roofs.state}`, { count: roofs.count })}</span>}
          <button type="button" className="u-rep3d-link" data-rep3d-change-place="" onClick={() => setStep(1)}>{t("rep3d.changePlace")}</button>
        </p>}
        {!ready && <p className="u-rep3d-why" id="u-rep3d-why-set">{t("rep3d.why.place")}</p>}
        <fieldset className="u-rep3d-group" disabled={!ready} aria-describedby={ready ? undefined : "u-rep3d-why-set"}>
          <legend>{t("rep3d.framingLabel")}</legend>
          <div className="u-rep3d-seg u-rep3d-tiles">
            <button type="button" aria-pressed={framing === "large"} data-framing="large" onClick={() => pickFraming("large")}>{t("rep3d.framing.large")}</button>
            <button type="button" aria-pressed={framing === "moyen"} data-framing="moyen" onClick={() => pickFraming("moyen")}>{t("rep3d.framing.moyen")}</button>
            <button type="button" aria-pressed={street} data-street-toggle="" onClick={toggleStreet}>{t("rep3d.street")}</button>
          </div>
        </fieldset>
        <fieldset className="u-rep3d-group" disabled={!ready} aria-describedby={ready ? undefined : "u-rep3d-why-set"}>
          <legend>{t("rep3d.lightLabel")}</legend>
          <div className="u-rep3d-seg">
            {SUN_PRESETS.map(item => <button key={item} type="button" aria-pressed={preset === item} data-sun={item} onClick={() => pickPreset(item)}>{t(`rep3d.light.${item}`)}</button>)}
          </div>
        </fieldset>
        {src === "3d" && rue.state === "ready" && <p className="u-small" data-rep3d-rue-tip="">{t("rep3d.rueTip", { count: rue.photos.length })}</p>}
        <details className="u-rep3d-reglages" data-reglages="">
          <summary>{t("rep3d.reglages")}</summary>
          <fieldset className="u-rep3d-group" disabled={!ready} aria-describedby={ready ? undefined : "u-rep3d-why-set"}>
            <legend>{t("rep3d.lookLabel")}</legend>
            <div className="u-rep3d-seg u-rep3d-looks">
              {LOOKS.map(item => <button key={item} type="button" aria-pressed={look === item} data-look-pick={item} onClick={() => pickLook(item)}>
                <i className={`u-rep3d-swatch is-${item}`} aria-hidden="true" />{t(`rep3d.look.${item}`)}
              </button>)}
            </div>
            <p className="u-small">{t("rep3d.lookSent")}</p>
          </fieldset>
          <fieldset className="u-rep3d-group" disabled={!ready} aria-describedby={ready ? undefined : "u-rep3d-why-set"}>
            <legend>{t("rep3d.angleLabel")}</legend>
            <div className="u-rep3d-seg">
              <button type="button" aria-pressed={framing === "contre"} data-framing="contre" onClick={() => pickFraming("contre")}>{t("rep3d.framing.contre")}</button>
            </div>
          </fieldset>
          <Slider id="az" label={t("rep3d.set.azimuth")} value={sun.azimuth} min={LIMITS.azimuth.min} max={LIMITS.azimuth.max} step={1} shown={`${Math.round(sun.azimuth)}°`} why={ready ? undefined : t("rep3d.why.place")} disabled={!ready} onChange={value => changeSun("azimuth", value)} />
          <Slider id="alt" label={t("rep3d.set.altitude")} value={sun.altitude} min={LIMITS.altitude.min} max={LIMITS.altitude.max} step={1} shown={`${Math.round(sun.altitude)}°`} why={ready ? undefined : t("rep3d.why.place")} disabled={!ready} onChange={value => changeSun("altitude", value)} />
          <Slider id="fov" label={t("rep3d.set.fov")} value={fov} min={LIMITS.fov.min} max={LIMITS.fov.max} step={1} shown={t("rep3d.set.focal", { focal })} why={ready ? undefined : t("rep3d.why.place")} disabled={!ready} onChange={changeFov} />
          <Slider id="line" label={t("rep3d.set.line")} value={line} min={LIMITS.line.min} max={LIMITS.line.max} step={0.25} shown={line.toFixed(2)} why={!ready ? t("rep3d.why.place") : look === "carte" || look === "volumes" ? t("rep3d.why.line") : undefined} disabled={!ready || look === "carte" || look === "volumes"} onChange={value => { setLine(value); engine.current?.setLine(value); }} />
          <Slider id="tone" label={t("rep3d.set.tone")} value={tone} min={LIMITS.tone.min} max={LIMITS.tone.max} step={0.05} shown={`${Math.round(tone * 100)} %`} why={!ready ? t("rep3d.why.place") : look !== "ombres" ? t("rep3d.why.tone") : undefined} disabled={!ready || look !== "ombres"} onChange={value => { setTone(value); engine.current?.setTone(value); }} />
          <FilePick label={t("rep3d.file.open")} small onFile={file => void openFile(file)} />
          {fileNote && <p className="u-small" role="status">{fileNote}</p>}
          <div className="u-rep3d-sources">
            <button type="button" className="u-rep3d-link" aria-expanded={sourcesOpen} onClick={() => setSourcesOpen(value => !value)}>{t("rep3d.sources")}</button>
            {sourcesOpen && <ul className="u-small">
              {(["osm", "openfreemap", "terrain", "swisstopo"] as SourceId[]).map(id => <li key={id}><a href={SOURCES[id].url} target="_blank" rel="noreferrer noopener">{SOURCES[id].short}</a> — {SOURCES[id].licence}</li>)}
              <li>{t("rep3d.terrainFull")} {TERRAIN_FULL.join(" · ")}</li>
              <li>{t("rep3d.noGoogle")}</li>
            </ul>}
          </div>
        </details>
      </aside>}
      {step === 3 && captured && <section className="u-rep3d-decor" aria-labelledby="u-rep3d-decor-title" data-rep3d-decor="">
        <h3 id="u-rep3d-decor-title" className="sr-only">{t("rep3d.steps.decor")}</h3>
        <div className="u-rep3d-base" data-capture-done="" data-rep3d-block={captured.block}>
          <img src={captured.urls.frame} alt={t("rep3d.base.alt", { name: captured.name })} />
          <div>
            <p className="u-label">{t("rep3d.base.title")}</p>
            <p className="u-small">{t("rep3d.base.line")}</p>
            <p className="u-small" data-rep3d-kept="">{t("rep3d.captured")}</p>
            <button type="button" className="u-secondary" data-rep3d-reframe="" onClick={() => setStep(2)}>{t("rep3d.base.change")}</button>
          </div>
        </div>
        <fieldset className="u-rep3d-group u-rep3d-refs" data-rep3d-refs={photos.length}>
          <legend>{t("rep3d.refs.label")} · {photos.length}/{CADRE_PHOTOS_MAX}</legend>
          <ul className="u-rep3d-slots">
            {photos.map((item, index) => <li key={item.id} className="u-rep3d-slot" data-rep3d-photo={item.origin}>
              <img src={item.url} alt={t("rep3d.refs.alt", { n: index + 2, name: item.name })} />
              <span className="u-rep3d-slot-n">{index + 2}</span>
              <button type="button" className="u-rep3d-slot-x" aria-label={t("rep3d.refs.remove", { n: index + 1 })} data-rep3d-photo-remove={index} onClick={() => removePhoto(item.id)}><span aria-hidden="true">×</span></button>
            </li>)}
            {photos.length < CADRE_PHOTOS_MAX && <li className="u-rep3d-slot is-add">
              <button type="button" data-rep3d-pick="rue" aria-pressed={picker === "rue"} onClick={() => setPicker(value => value === "rue" ? null : "rue")}>{t("rep3d.pick.rue")}</button>
              <button type="button" data-rep3d-pick="mes" aria-pressed={picker === "mes"} onClick={() => setPicker(value => value === "mes" ? null : "mes")}>{t("rep3d.pick.mes")}</button>
              <label className="u-rep3d-pick-file" data-rep3d-pick="import">{t("rep3d.pick.import")}<input className="sr-only" type="file" accept="image/*" multiple onChange={event => { importPhotos([...(event.target.files ?? [])]); event.target.value = ""; }} /></label>
            </li>}
          </ul>
          <p className="u-small">{t("rep3d.refs.hint")}</p>
        </fieldset>
        {picker === "rue" && <div className="u-rep3d-picker" data-rep3d-picker="rue">{rueSection}</div>}
        {picker === "mes" && <div className="u-rep3d-picker" data-rep3d-picker="mes">
          <p className="u-label">{t("rep3d.pick.mes")}</p>
          {mine.length === 0 ? <p className="u-small">{t("rep3d.pick.mesEmpty")}</p> : <ul className="u-rep3d-mine">
            {mine.map(card => <li key={card.id}><button type="button" data-rep3d-mine={card.id} onClick={() => void pickMine(card)}>
              <img src={card.url} alt="" loading="lazy" /><span>{card.name}</span><small>{card.decor ? t("rep3d.kind.decor") : t("rep3d.kind.cadre")}</small>
            </button></li>)}
          </ul>}
        </div>}
        {photos.length === 0 && !picker && <ExempleSaintFrancois compact />}
        <fieldset className="u-rep3d-group">
          <legend>{t("rep3d.ambiance.label")}</legend>
          <div className="u-rep3d-seg">
            {CADRE_AMBIANCES.map(item => <button key={item} type="button" aria-pressed={ambiance === item} data-ambiance={item} onClick={() => setAmbiance(item)}>{t(`rep3d.ambiance.${item}`)}</button>)}
          </div>
        </fieldset>
        <label className="u-field">
          <span className="u-label">{t("rep3d.decorName")}</span>
          <input value={decorName} maxLength={40} autoComplete="off" data-rep3d-name="" onChange={event => setDecorName(event.target.value)} />
        </label>
        <details className="u-rep3d-reglages" data-rep3d-more="">
          <summary>{t("rep3d.more")}</summary>
          <fieldset className="u-rep3d-group">
            <legend>{t("rep3d.strict.label")}</legend>
            <div className="u-rep3d-seg">
              <button type="button" aria-pressed="true" data-strict="normal">{t("rep3d.strict.normal")}</button>
              <button type="button" aria-pressed="false" data-strict="strict" disabled aria-describedby="u-rep3d-strict-why">{t("rep3d.strict.strict")}</button>
            </div>
            <p className="u-why" id="u-rep3d-strict-why">{t("rep3d.strict.soon")}</p>
          </fieldset>
          <label className="u-field">
            <span className="u-label">{t("rep3d.detail")}</span>
            <input value={detail} maxLength={240} autoComplete="off" placeholder={t("rep3d.detailPh")} data-rep3d-detail="" onChange={event => setDetail(event.target.value)} />
          </label>
        </details>
        <p className="u-small">{t("rep3d.sameplace")}</p>
      </section>}
      {step === 4 && made && captured && <section className="u-rep3d-made" aria-labelledby="u-rep3d-made-title" data-rep3d-made={made.id}>
        <h3 id="u-rep3d-made-title">{t("rep3d.made.title")}</h3>
        <div className="u-rep3d-pair">
          <figure><img src={captured.urls.frame} alt="" /><figcaption>{t("rep3d.kind.cadre")} · {t("rep3d.made.free")}</figcaption></figure>
          <figure><img src={made.url} alt={made.name} /><figcaption>{t("rep3d.kind.decor")} · {made.name}</figcaption></figure>
        </div>
        <p className="u-small" data-rep3d-made-line="">{t("rep3d.made.line", { name: made.name })}</p>
        <p className="u-small" data-rep3d-made-cost="">{made.cost !== null ? t("rep3d.made.cost", { cost: made.cost, quote: made.quote }) : t("rep3d.made.costUnknown", { quote: made.quote })}</p>
      </section>}
    </div>
    <footer className="u-rep3d-bar">
      {step === 1 && <p className="u-why" data-rep3d-step-why="">{t("rep3d.stepWhy")}</p>}
      {step === 2 && <>
        <button type="button" className="u-primary u-rep3d-capture" data-rep3d-capture="" disabled={!ready || capturing} aria-describedby={!ready ? "u-rep3d-capture-why" : undefined} onClick={() => void capture()}>
          {capturing ? t("rep3d.capturing") : t("rep3d.capture")}
        </button>
        {!ready && <p className="u-why" id="u-rep3d-capture-why">{place ? t("rep3d.captureWait") : t("rep3d.captureOff")}</p>}
        {captureNoteText && <p className="u-small" role="alert">{captureNoteText}</p>}
        {ready && view && <p className="u-rep3d-meta" data-rep3d-view="">{t("rep3d.viewLine", { heading: Math.round(view.heading), pitch: Math.round(view.pitch), focal, height: Math.round(view.height) })}</p>}
      </>}
      {step === 3 && (ask && quoted ? <div className="u-rep3d-ask" role="dialog" aria-labelledby="u-rep3d-ask-title" data-rep3d-ask="">
        <p id="u-rep3d-ask-title" className="u-label">{t("rep3d.ask.title")}</p>
        <p className="u-small" data-rep3d-quote="">{t("rep3d.ask.line", { credits: quoted.credits, high: quoted.high, photos: photos.length })}</p>
        <div className="u-rep3d-done-bar">
          <button type="button" className="u-secondary" onClick={() => setAsk(false)}>{t("rep3d.ask.cancel")}</button>
          <button type="button" className="u-primary" data-rep3d-yes="" disabled={creating} onClick={() => void make()}>{creating ? t("create.running") : t("rep3d.ask.yes")}</button>
        </div>
      </div> : <>
        <button type="button" className="u-primary u-rep3d-capture" data-rep3d-create="" data-rep3d-credits={quoted?.credits ?? ""} disabled={makeBlocked} aria-describedby={makeBlocked && makeWhy ? "u-rep3d-make-why" : undefined} onClick={() => setAsk(true)}>
          {t("rep3d.make.button", { credits: shownQuote.credits })}
        </button>
        {makeBlocked && makeWhy && <p className="u-why" id="u-rep3d-make-why">{makeWhy}</p>}
        {makeBlocked && quoted && !connected && <ConnectLink />}
        {makeNote && <p className="u-small" role="alert">{makeNote}</p>}
      </>)}
      {step === 4 && made && <div className="u-rep3d-done-bar u-rep3d-made-bar">
        <button type="button" className="u-secondary" data-rep3d-again="" onClick={() => { setMade(null); setStep(3); }}>{t("rep3d.made.again")}</button>
        <button type="button" className="u-secondary" data-rep3d-to-decor="" onClick={onDecor}>{t("rep3d.use")}</button>
        <button type="button" className="u-primary" data-rep3d-to-prise="" onClick={onPrise}>{t("rep3d.made.prise")}</button>
      </div>}
    </footer>
  </div>;
}

function FilePick({ label, small, onFile }: { label: string; small?: boolean; onFile(file: File | null): void }) {
  return <label className={small ? "u-rep3d-file is-small" : "u-rep3d-file"} data-rep3d-file="">
    {label}
    <input className="sr-only" type="file" accept=".kml,.kmz,.geojson,.json,application/geo+json,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" onChange={event => { onFile(event.target.files?.[0] ?? null); event.target.value = ""; }} />
  </label>;
}

function Slider({ id, label, value, min, max, step, shown, why, disabled, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; shown: string; why?: string; disabled?: boolean; onChange(value: number): void }) {
  const whyId = `u-rep3d-${id}-why`;
  return <label className="u-rep3d-slider" htmlFor={`u-rep3d-${id}`}>
    <span>{label}<output>{shown}</output></span>
    <input id={`u-rep3d-${id}`} type="range" min={min} max={max} step={step} value={value} aria-describedby={disabled && why ? whyId : undefined} disabled={disabled} onChange={event => onChange(Number(event.target.value))} />
    {disabled && why && <small id={whyId}>{why}</small>}
  </label>;
}

