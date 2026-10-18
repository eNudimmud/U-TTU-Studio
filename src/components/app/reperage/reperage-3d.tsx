"use client";

// « Repérer un lieu » : a 3D city anywhere, four looks, the sun, a lens, one capture.
// Open data only (OpenStreetMap, Terrain Tiles, swisstopo in Switzerland). Nothing is spent here.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { useStudio } from "../studio-session";
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
  quote: { credits: number | null; high: number | null };
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

export function Reperage3DSheet({ onClose, onCapture, onCaptured, onStreetPhoto, quote }: Props) {
  const { t } = useI18n();
  const { locale } = useLocaleSwitch();
  const { demo } = useStudio();
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
  const [look, setLook] = useState<Look>(DEFAULT_SETTINGS.look);
  const [framing, setFraming] = useState<Framing | null>("moyen");
  const [preset, setPreset] = useState<SunPreset | "manuel">("midi");
  const [sun, setSun] = useState<Sun>({ azimuth: 180, altitude: 45 });
  const [fov, setFov] = useState(DEFAULT_SETTINGS.fov);
  const [line, setLine] = useState(DEFAULT_SETTINGS.line);
  const [tone, setTone] = useState(DEFAULT_SETTINGS.tone);
  const [street, setStreet] = useState(false);
  const [view, setView] = useState<ViewInfo | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<{ meta: CaptureMeta; urls: { color: string; depth: string; lines: string }; block: number } | null>(null);
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
    if (captured) for (const url of Object.values(captured.urls)) URL.revokeObjectURL(url);
  }, [captured]);

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
      const name = `${place.name} · ${t(`rep3d.look.${look}`)}`.slice(0, 40);
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
      setCaptured({ meta, urls: { color: URL.createObjectURL(shot.color), depth: URL.createObjectURL(shot.depth), lines: URL.createObjectURL(shot.lines) }, block: block ? block.buildings.length + block.streets.length : 0 });
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
      const ok = await onStreetPhoto(place, { id: photo.id, author: photo.author, credit, blob });
      setRueNote(ok ? t("rep3d.rue.added") : t("rep3d.rue.fail"));
    } catch {
      setRueNote(t("rep3d.rue.fail"));
    } finally {
      setRueSaving(false);
    }
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

  return <div className="u-rep3d" role="dialog" aria-modal="true" aria-labelledby="u-rep3d-title" data-rep3d-state={phase} data-rep3d-roofs={roofs.state} data-look={look} data-street={street ? "1" : "0"}>
    <header className="u-rep3d-top">
      <button type="button" className="u-rep3d-close" aria-label={t("rep3d.close")} onClick={onClose}>×</button>
      <h2 id="u-rep3d-title" className="u-rep3d-title">{t("rep3d.title")}</h2>
      <form className="u-rep3d-search" role="search" onSubmit={event => { event.preventDefault(); void search(); }}>
        <input ref={input} type="search" enterKeyHint="search" value={query} maxLength={200} aria-label={t("rep3d.searchLabel")} placeholder={t("rep3d.searchPh")} onChange={event => setQuery(event.target.value)} />
        <button type="submit" className="u-primary" disabled={searching || query.trim().length < 2} aria-describedby={query.trim().length < 2 ? "u-rep3d-why" : undefined}>{searching ? t("rep3d.searching") : t("rep3d.search.go")}</button>
      </form>
    </header>
    {query.trim().length < 2 && !place && <p className="sr-only" id="u-rep3d-why">{t("rep3d.searchWhy")}</p>}
    {(results.length > 0 || searchNote) && <div className="u-rep3d-results" role="region" aria-label={t("rep3d.results")}>
      {searchNote && <p className="u-small" role="status" data-rep3d-search-note="">{searchNote}</p>}
      {results.length > 0 && <ul>
        {results.map(item => <li key={`${item.name}-${item.lat}-${item.lon}`}>
          <button type="button" onClick={() => void open(item)}><b>{item.name}</b>{item.detail && <span>{item.detail}</span>}</button>
        </li>)}
      </ul>}
    </div>}
    <div className="u-rep3d-body">
      <div className="u-rep3d-view">
        <div className={place ? "u-rep3d-stage" : "u-rep3d-stage is-empty"} ref={stage} data-rep3d-stage="">
          {!place && <div className="u-rep3d-empty">
            <p>{t("rep3d.empty")}</p>
            <div className="u-rep3d-chips" aria-label={t("rep3d.tryThese")}>
              {EXEMPLES_3D.map(item => <button key={item.name} type="button" onClick={() => { setQuery(item.name); void open(item); }}>{item.name}<span>{item.detail}</span></button>)}
            </div>
            <FilePick label={t("rep3d.file.open")} onFile={file => void openFile(file)} />
            {fileNote && <p className="u-small" role="status">{fileNote}</p>}
            <p className="u-small">{t("rep3d.noGoogle")}</p>
          </div>}
          {place && ready && <div className="u-rep3d-frame" aria-hidden="true"><span>{t("rep3d.frame")}</span></div>}
          {loading && <p className="u-rep3d-overlay" role="status">{t("rep3d.loading")}</p>}
          {problem && <div className="u-rep3d-overlay is-problem" role="alert">
            <p>{t(`rep3d.state.${phase}`)}</p>
            {phase !== "nogl" && place && <button type="button" className="u-secondary" onClick={() => void open(place)}>{t("rep3d.retry")}</button>}
          </div>}
          {phase === "empty" && <p className="u-rep3d-flag" role="status">{t("rep3d.state.empty")}</p>}
          {ready && roofs.state === "loading" && <p className="u-rep3d-flag is-soft" role="status" data-rep3d-roofs-loading="">{t("rep3d.roofs.loading")}</p>}

          {place && <p className="u-rep3d-credit" data-rep3d-credit="">{credit}</p>}
        </div>
          {ready && <div className="u-rep3d-pad" data-rep3d-pad="" aria-label={t("rep3d.camera")} role="group">
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
        {ready && <p className="u-rep3d-hint">{hint}</p>}
      </div>
      <aside className="u-rep3d-side">
        {place && <p className="u-rep3d-place" data-rep3d-place="">
          <b>{place.name}</b>
          <span>{place.detail ? `${place.detail} · ` : ""}{place.lat.toFixed(4)}, {place.lon.toFixed(4)}{ready ? ` · ${t("rep3d.buildings", { count })}` : ""}</span>
          {ready && roofs.state !== "off" && <span className="u-rep3d-roofs" data-rep3d-roofs={roofs.state}>{t(`rep3d.roofs.${roofs.state}`, { count: roofs.count })}</span>}
        </p>}
        {place && <FilePick label={t("rep3d.file.open")} small onFile={file => void openFile(file)} />}
        {place && fileNote && <p className="u-small" role="status">{fileNote}</p>}
        {!ready && <p className="u-rep3d-why" id="u-rep3d-why-set">{t("rep3d.why.place")}</p>}
        <fieldset className="u-rep3d-group" disabled={!ready} aria-describedby={ready ? undefined : "u-rep3d-why-set"}>
          <legend>{t("rep3d.lookLabel")}</legend>
          <div className="u-rep3d-seg u-rep3d-looks">
            {LOOKS.map(item => <button key={item} type="button" aria-pressed={look === item} data-look-pick={item} onClick={() => pickLook(item)}>
              <i className={`u-rep3d-swatch is-${item}`} aria-hidden="true" />{t(`rep3d.look.${item}`)}
            </button>)}
          </div>
        </fieldset>
        <fieldset className="u-rep3d-group" disabled={!ready} aria-describedby={ready ? undefined : "u-rep3d-why-set"}>
          <legend>{t("rep3d.framingLabel")}</legend>
          <div className="u-rep3d-seg">
            {FRAMINGS.map(item => <button key={item} type="button" aria-pressed={framing === item} data-framing={item} onClick={() => pickFraming(item)}>{t(`rep3d.framing.${item}`)}</button>)}
            <button type="button" aria-pressed={street} data-street-toggle="" onClick={toggleStreet}>{t("rep3d.street")}</button>
          </div>
        </fieldset>
        <fieldset className="u-rep3d-group" disabled={!ready} aria-describedby={ready ? undefined : "u-rep3d-why-set"}>
          <legend>{t("rep3d.lightLabel")}</legend>
          <div className="u-rep3d-seg">
            {SUN_PRESETS.map(item => <button key={item} type="button" aria-pressed={preset === item} data-sun={item} onClick={() => pickPreset(item)}>{t(`rep3d.light.${item}`)}</button>)}
          </div>
        </fieldset>
        <details className="u-rep3d-reglages" data-reglages="">
          <summary>{t("rep3d.reglages")}</summary>
          <Slider id="az" label={t("rep3d.set.azimuth")} value={sun.azimuth} min={LIMITS.azimuth.min} max={LIMITS.azimuth.max} step={1} shown={`${Math.round(sun.azimuth)}°`} why={ready ? undefined : t("rep3d.why.place")} disabled={!ready} onChange={value => changeSun("azimuth", value)} />
          <Slider id="alt" label={t("rep3d.set.altitude")} value={sun.altitude} min={LIMITS.altitude.min} max={LIMITS.altitude.max} step={1} shown={`${Math.round(sun.altitude)}°`} why={ready ? undefined : t("rep3d.why.place")} disabled={!ready} onChange={value => changeSun("altitude", value)} />
          <Slider id="fov" label={t("rep3d.set.fov")} value={fov} min={LIMITS.fov.min} max={LIMITS.fov.max} step={1} shown={t("rep3d.set.focal", { focal })} why={ready ? undefined : t("rep3d.why.place")} disabled={!ready} onChange={changeFov} />
          <Slider id="line" label={t("rep3d.set.line")} value={line} min={LIMITS.line.min} max={LIMITS.line.max} step={0.25} shown={line.toFixed(2)} why={!ready ? t("rep3d.why.place") : look === "carte" ? t("rep3d.why.line") : undefined} disabled={!ready || look === "carte"} onChange={value => { setLine(value); engine.current?.setLine(value); }} />
          <Slider id="tone" label={t("rep3d.set.tone")} value={tone} min={LIMITS.tone.min} max={LIMITS.tone.max} step={0.05} shown={`${Math.round(tone * 100)} %`} why={!ready ? t("rep3d.why.place") : look !== "ombres" ? t("rep3d.why.tone") : undefined} disabled={!ready || look !== "ombres"} onChange={value => { setTone(value); engine.current?.setTone(value); }} />
        </details>
        <section className="u-rep3d-rue" aria-label={t("rep3d.rue.title")} data-rep3d-rue={rue.state}>
          <p className="u-label">{t("rep3d.rue.title")}</p>
          {rue.state === "idle" && <p className="u-small">{t("rep3d.rue.idle")}</p>}
          {rue.state === "load" && <p className="u-small" role="status">{t("rep3d.rue.load")}</p>}
          {rue.state === "none" && <p className="u-small">{t("rep3d.rue.none", { radius: rue.radius })}</p>}
          {rue.state === "rate" && <p className="u-small">{t("rep3d.state.rate")}</p>}
          {rue.state === "demo" && <p className="u-small">{t("rep3d.rue.demo")}</p>}
          {rue.state === "fail" && <p className="u-small">{t("rep3d.rue.fail")}</p>}
          {(rue.state === "none" || rue.state === "fail") && place && rue.radius < RUE_PLUS_LOIN && <button type="button" className="u-secondary" data-rep3d-rue-wider="" onClick={() => void findRue(place, RUE_PLUS_LOIN)}>{t("rep3d.rue.wider", { radius: RUE_PLUS_LOIN })}</button>}
          {rue.state === "ready" && photo && place && <div className="u-rep3d-rue-card" data-rep3d-rue-index={rue.index} data-rep3d-rue-count={rue.photos.length}>
            {around
              ? <RueViewer ref={rueView} photo={photo} demo={false} cap={aroundCap} onCap={setAroundCap} onFail={() => setRueNote(t("rep3d.rue.fail"))} />
              : photo.thumb ? <img src={photo.thumb} alt={t("rep3d.rue.alt", { author: photo.author })} loading="lazy" referrerPolicy="no-referrer" /> : <span className="u-rep3d-rue-blank" />}
            <p className="u-small" data-rep3d-rue-credit="">{rueCredit(photo)} · {Math.round(distanceMeters(place.lat, place.lon, photo.lat, photo.lon))} m · <a href={photo.sourceUrl || photoSourceUrl(photo)} target="_blank" rel="noreferrer noopener">{t("rep3d.rue.source")}</a></p>
            <div className="u-rep3d-rue-bar">
              {rue.photos.length > 1 && <>
                <button type="button" className="u-secondary" data-rep3d-rue-prev="" disabled={rue.index === 0} aria-describedby="u-rep3d-rue-pos" aria-label={t("rep3d.rue.prev")} onClick={() => stepRue(-1)}>‹</button>
                <span className="u-small" id="u-rep3d-rue-pos" aria-live="polite">{t("rep3d.rue.count", { index: rue.index + 1, count: rue.photos.length })}</span>
                <button type="button" className="u-secondary" data-rep3d-rue-next="" disabled={rue.index >= rue.photos.length - 1} aria-describedby="u-rep3d-rue-pos" aria-label={t("rep3d.rue.next")} onClick={() => stepRue(1)}>›</button>
              </>}
              {photo.view && <button type="button" className="u-secondary" data-rep3d-rue-around="" aria-pressed={around} onClick={() => setAround(value => !value)}>{around ? t("rep3d.rue.aroundOff") : photo.tour ? t("rep3d.rue.around360") : t("rep3d.rue.around")}</button>}
              <button type="button" className="u-secondary" data-rep3d-rue-add="" disabled={rueSaving || !reusablePhoto(photo)} aria-describedby={!reusablePhoto(photo) ? "u-rep3d-rue-why" : undefined} onClick={() => void addRue()}>{t("rep3d.rue.add")}</button>
            </div>
            {!reusablePhoto(photo) && <p className="u-why" id="u-rep3d-rue-why">{t("rep3d.rue.licence")}</p>}
          </div>}
          {rueNote && <p className="u-small" role="status" data-rep3d-rue-note="">{rueNote}</p>}
        </section>
        <div className="u-rep3d-sources">
          <button type="button" className="u-rep3d-link" aria-expanded={sourcesOpen} onClick={() => setSourcesOpen(value => !value)}>{t("rep3d.sources")}</button>
          {sourcesOpen && <ul className="u-small">
            {(["osm", "openfreemap", "terrain", "swisstopo"] as SourceId[]).map(id => <li key={id}><a href={SOURCES[id].url} target="_blank" rel="noreferrer noopener">{SOURCES[id].short}</a> — {SOURCES[id].licence}</li>)}
            <li>{t("rep3d.terrainFull")} {TERRAIN_FULL.join(" · ")}</li>
            <li>{t("rep3d.noGoogle")}</li>
          </ul>}
        </div>
      </aside>
    </div>
    <footer className="u-rep3d-bar">
      {captured ? <div className="u-rep3d-done" role="status" data-capture-done="" data-rep3d-block={captured.block}>
        <div className="u-rep3d-thumbs">
          <figure><img src={captured.urls.color} alt="" /><figcaption>{t("rep3d.out.color")}</figcaption></figure>
          <figure><img src={captured.urls.depth} alt="" /><figcaption>{t("rep3d.out.depth")}</figcaption></figure>
          <figure><img src={captured.urls.lines} alt="" /><figcaption>{t("rep3d.out.lines")}</figcaption></figure>
        </div>
        <p className="u-small">{t("rep3d.captured")}</p>
        {quote.credits !== null && quote.high !== null && <p className="u-prise-quote" data-rep3d-quote="">{t("rep3d.quote", { credits: quote.credits, high: quote.high })}</p>}
        <div className="u-rep3d-done-bar">
          <button type="button" className="u-secondary" onClick={() => setCaptured(null)}>{t("rep3d.again")}</button>
          <button type="button" className="u-primary" data-rep3d-use="" onClick={onClose}>{t("rep3d.use")}</button>
        </div>
      </div> : <>
        <button type="button" className="u-primary u-rep3d-capture" data-rep3d-capture="" disabled={!ready || capturing} aria-describedby={!ready ? "u-rep3d-capture-why" : undefined} onClick={() => void capture()}>
          {capturing ? t("rep3d.capturing") : t("rep3d.capture")}
        </button>
        {!ready && <p className="u-why" id="u-rep3d-capture-why">{place ? t("rep3d.captureWait") : t("rep3d.captureOff")}</p>}
        {captureNoteText && <p className="u-small" role="alert">{captureNoteText}</p>}
        {ready && view && <p className="u-rep3d-meta" data-rep3d-view="">{t("rep3d.viewLine", { heading: Math.round(view.heading), pitch: Math.round(view.pitch), focal, height: Math.round(view.height) })}</p>}
      </>}
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

