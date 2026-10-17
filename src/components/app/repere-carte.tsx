"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useI18n } from "@/components/i18n/provider";
import { guideQuote } from "@/lib/prise/guide";
import { parseFichier } from "@/lib/repere/fichier";
import { chargerPhoto, chargerPhotos, chargerQuartier, chercherNom } from "@/lib/repere/direct";
import { fixtureQuartier } from "@/lib/repere/fixture";
import { fixturePhotos, mapillaryToken } from "@/lib/repere/mapillary";
import { applyCouverture, couverture, type CouvertureMap } from "@/lib/repere/couverture";
import { RUE_RAYON, distanceMeters, reusablePhoto, photoSourceUrl, photoLicenseUrl, type PhotoRue } from "@/lib/repere/panoramax";
import {
  LIEUX_EXEMPLE, OSM_CREDIT, OPENFREEMAP_STYLE, lieuNote, pitchFor, zoomFor,
  type LieuTrouve, type Regard,
} from "@/lib/repere/lieu";
import { rayonFor, type Quartier } from "@/lib/repere/quartier";
import { parseSaisie } from "@/lib/repere/saisie";
import { useStudio } from "./studio-session";
import { QuartierView } from "./quartier-view";
import { RueViewer, type RueHandle } from "./rue-viewer";

interface RueVue extends PhotoRue {
  blob?: Blob;
}

interface PhotoFile {
  id: string;
  author: string;
  credit: string;
  blob: Blob;
}

interface Props {
  onSave(place: LieuTrouve, regard: Regard, autour: boolean, quartier: string): Promise<void>;
  onPhoto?(place: LieuTrouve, regard: Regard, autour: boolean, quartier: string, photo: PhotoFile): Promise<void>;
}

export function RepereCarte({ onSave, onPhoto }: Props) {
  const { t } = useI18n();
  const { demo } = useStudio();
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<({ easeTo(options: object): void; remove(): void; resize(): void; isStyleLoaded(): boolean | void; once(event: string, run: () => void): void } & CouvertureMap) | null>(null);
  const [couv, setCouv] = useState(false);
  const couvRef = useRef(false);
  const overlay = useRef(couverture(mapillaryToken()));
  const markerRef = useRef<{ setLngLat(center: [number, number]): void } | null>(null);
  const loadRef = useRef<(next: LieuTrouve, heading?: number, tilt?: number, wide?: boolean) => Promise<void>>(async () => {});
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<LieuTrouve>(LIEUX_EXEMPLE[0]);
  const [regard, setRegard] = useState<Regard>("debout");
  const [autour, setAutour] = useState(false);
  const [quartier, setQuartier] = useState<Quartier | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<RueVue[]>([]);
  const [index, setIndex] = useState(0);
  const [cap, setCap] = useState(0);
  const [plein, setPlein] = useState(false);
  const [placed, setPlaced] = useState(false);
  const rueRef = useRef<RueHandle>(null);
  const [photoState, setPhotoState] = useState<"idle" | "load" | "ready" | "token" | "empty" | "fail" | "rate">("idle");
  const [saving, setSaving] = useState("");
  const [photoNote, setPhotoNote] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [mapillaryOff, setMapillaryOff] = useState(false);
  const guide = guideQuote();
  const lastAsk = useRef(0);
  const loadSequence = useRef(0);
  const [radius, setRadius] = useState(RUE_RAYON);
  useEffect(() => () => { loadSequence.current += 1; }, []);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let dead = false;
    let remove = () => {};
    void import("maplibre-gl").then(module => {
      if (dead || !host.current) return;
      const maplibre = module.default;
      const map = new maplibre.Map({
        container: host.current,
        style: OPENFREEMAP_STYLE,
        center: [LIEUX_EXEMPLE[0].lon, LIEUX_EXEMPLE[0].lat],
        zoom: zoomFor(false),
        pitch: pitchFor("debout"),
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-left");
      const marker = new maplibre.Marker({ color: "#d4af37" })
        .setLngLat([LIEUX_EXEMPLE[0].lon, LIEUX_EXEMPLE[0].lat])
        .addTo(map);
      markerRef.current = marker;
      map.on("click", (event: { lngLat: { lat: number; lng: number } }) => {
        const lat = event.lngLat.lat;
        const lon = event.lngLat.lng;
        void loadRef.current({ name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, lat, lon }, 0, 0);
      });
      map.on("load", () => { if (couvRef.current) paintCouverture(map, true); });
      mapRef.current = map;
      remove = () => map.remove();
    }).catch(() => { setNote(t("r7.introuvable")); });
    return () => {
      dead = true;
      remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [t]);

  function paintCouverture(map: CouvertureMap & { isStyleLoaded(): boolean | void; once(event: string, run: () => void): void }, on: boolean) {
    const run = () => { try { applyCouverture(map, on, overlay.current); } catch { setNote(t("r7.couvertureFail")); } };
    if (map.isStyleLoaded()) run();
    else map.once("load", run);
  }

  function toggleCouverture() {
    const next = !couvRef.current;
    couvRef.current = next;
    setCouv(next);
    if (mapRef.current) paintCouverture(mapRef.current, next);
  }

  const photo = photos[index] ?? null;
  const rueOpen = photoState === "ready" && Boolean(photo);
  useEffect(() => {
    if (!photo || (photo.lat === 0 && photo.lon === 0)) return;
    markerRef.current?.setLngLat([photo.lon, photo.lat]);
    mapRef.current?.easeTo({ center: [photo.lon, photo.lat], duration: 500 });
    const frame = document.querySelector(".u-rue-frame");
    frame?.scrollIntoView({ block: "center", inline: "nearest" });
    const timer = window.setTimeout(() => mapRef.current?.resize(), 60);
    return () => window.clearTimeout(timer);
  }, [photo]);

  function showMap(next: LieuTrouve, view = regard, wide = autour) {
    mapRef.current?.easeTo({
      center: [next.lon, next.lat],
      zoom: zoomFor(wide),
      pitch: pitchFor(view),
      duration: 600,
    });
    markerRef.current?.setLngLat([next.lon, next.lat]);
  }

  function limited(): boolean {
    if (demo) return false;
    const now = Date.now();
    if (now - lastAsk.current < 1000) {
      setNote(t("r7.rate"));
      return true;
    }
    lastAsk.current = now;
    return false;
  }

  async function loadBlock(next: LieuTrouve, heading = 0, tilt = 0, wide = autour, searchRadius = RUE_RAYON) {
    if (limited()) return;
    const request = ++loadSequence.current;
    setPlace(next);
    setRadius(searchRadius);
    setPlaced(true);
    setPlein(true);
    setChosen([]);
    setPhotoNote("");
    setCap(Math.round(heading));
    setQuartier(null);
    showMap(next, regard, wide);
    if (demo) {
      setQuartier(fixtureQuartier(next, heading, tilt));
      setPhotos(demoRue(next));
      setIndex(0);
      setPhotoState("ready");
      setNote("");
      return;
    }
    setBusy(true);
    setPhotoState("load");
    setPhotos([]);
    // Independent completion: a hanging Overpass must not delay street photography.
    void fetchBlock(next, heading, tilt, wide).then(block => {
      if (request === loadSequence.current && block !== "rate") setQuartier(block);
    }).catch(() => {});
    try {
      const shots = await chargerPhotos(next.lat, next.lon, searchRadius);
      if (request !== loadSequence.current) return;
      if (shots === "rate") {
        setPhotoState("rate");
        setNote(t("r7.rate"));
        return;
      }
      setMapillaryOff(shots.mapillary === "off");
      setPhotos(shots.photos);
      setIndex(shots.start);
      setPhotoState(shots.photos.length > 0 ? "ready" : shots.panoramax === "fail" || shots.mapillary === "fail" ? "fail" : "empty");
      setNote(shots.mapillary === "fail" ? t("audit.mapillaryFail") : "");
    } catch {
      if (request !== loadSequence.current) return;
      setPhotoState("fail");
      setNote(t("r7.photosFail"));
    } finally {
      if (request === loadSequence.current) setBusy(false);
    }
  }
  loadRef.current = loadBlock;

  async function fetchBlock(next: LieuTrouve, heading: number, tilt: number, wide: boolean): Promise<Quartier | "rate" | null> {
    const mobile = window.matchMedia("(max-width: 799px)").matches;
    return chargerQuartier(next, rayonFor(mobile, wide), mobile, heading, tilt);
  }

  async function go() {
    const parsed = parseSaisie(query);
    if (!parsed || busy) return;
    setNote("");
    if (parsed.kind === "point") {
      await loadBlock({ name: parsed.name, lat: parsed.lat, lon: parsed.lon }, parsed.heading, parsed.tilt);
      return;
    }
    if (parsed.kind === "short") {
      setNote(t("r7.lienCourt"));
      return;
    }
    if (demo) {
      const known = LIEUX_EXEMPLE.find(item => parsed.query.toLowerCase().includes(item.name.toLowerCase()));
      const next = known ?? { name: parsed.query.slice(0, 80), lat: LIEUX_EXEMPLE[0].lat, lon: LIEUX_EXEMPLE[0].lon };
      await loadBlock(next, 0, 0);
      return;
    }
    const request = ++loadSequence.current;
    setBusy(true);
    try {
      const found = await chercherNom(parsed.query);
      if (request !== loadSequence.current) return;
      if (found === "rate") {
        setNote(t("r7.rate"));
        return;
      }
      if (!found) {
        setNote(t("r7.introuvable"));
        return;
      }
      // loadBlock owns the next request and its loading state.
      void loadBlock(found, 0, 0);
      return;
    } catch {
      if (request === loadSequence.current) setNote(t("r7.introuvable"));
    } finally {
      if (request === loadSequence.current) setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    const point = await parseFichier(file.name, new Uint8Array(await file.arrayBuffer()));
    if (!point) {
      setNote(t("r7.fichierOff"));
      return;
    }
    setQuery(point.name);
    await loadBlock({ name: point.name, lat: point.lat, lon: point.lon }, point.heading, point.tilt);
  }

  function volume(): string {
    if (!quartier || (quartier.buildings.length === 0 && quartier.streets.length === 0)) return "";
    return JSON.stringify({
      ...quartier,
      heading: cap,
      lat: photo?.lat || quartier.lat,
      lon: photo?.lon || quartier.lon,
    });
  }

  async function takeView() {
    if (saving || !photo || (!demo && !reusablePhoto(photo))) return;
    setSaving(photo.id);
    setPhotoNote("");
    try {
      const captured = photo.blob ?? await rueRef.current?.capture();
      const blob = captured ?? await loadPhoto(photo.view || photo.thumb);
      if (!blob || blob.size < 32) {
        setPhotoNote(t("r7.photosFail"));
        return;
      }
      const credit = `${lineOf(photo)}. ${captured ? "Vue recadrée" : "Photo entière"}. ${photo.sourceUrl || photoSourceUrl(photo)} — ${photo.licenseUrl || photoLicenseUrl(photo.license)}`;
      await onPhoto?.(place, regard, autour, volume(), { id: photo.id, author: photo.author, credit, blob });
      setChosen(list => list.includes(photo.id) ? list : [...list, photo.id]);
      setPhotoNote(`${t("r7.photosAdded")} ${credit}`);
      setPlein(false);
    } catch (error) {
      setPhotoNote(error instanceof Error && error.message === "rate" ? t("r7.rate") : t("r7.photosFail"));
    } finally {
      setSaving("");
    }
  }

  async function step(dir: -1 | 1) {
    const current = photos[index];
    if (!current || saving) return;
    const neighbor = index + dir;
    if (neighbor >= 0 && neighbor < photos.length) {
      setIndex(neighbor);
      return;
    }
    const id = dir < 0 ? current.prev : current.next;
    if (!id || demo) return;
    setPhotoState("load");
    const extra = await chargerPhoto(id);
    setPhotoState("ready");
    if (extra === "rate") {
      setNote(t("r7.rate"));
      return;
    }
    if (!extra) return;
    setPhotos(list => {
      if (list.some(item => item.id === extra.id)) return list;
      return dir < 0 ? [extra, ...list] : [...list, extra];
    });
    setIndex(dir < 0 ? 0 : photos.length);
  }

  async function keep() {
    if (!placed) return;
    await onSave(place, regard, autour, volume());
    setNote(t("r7.saved"));
    setPlein(false);
  }

  function retake(view: Regard, wide: boolean) {
    const wideChanged = wide !== autour;
    setRegard(view);
    setAutour(wide);
    showMap(place, view, wide);
    if (!quartier || !wideChanged || demo) return;
    void loadBlock(place, quartier.heading, quartier.tilt, wide);
  }

  function lineOf(photo: RueVue): string {
    if (photo.source === "panoramax") return t("r7.photosDroit", { author: photo.author, license: photo.license });
    return t("r7.photosCredit", { author: photo.author });
  }

  const empty = query.trim().length < 2;
  const waiting = empty || busy;
  const rue = rueOpen;
  const repli = !rue && photoState !== "load" && photoState !== "idle" && Boolean(quartier);
  const canKeep = placed && !busy && photoState !== "load";
  const creerBlocked = !canKeep || demo || !guide.enabled;
  const creerWhy = !canKeep ? t("r7.creerOff") : demo ? t("r7.creerDemo") : t("r7.creerMesure");
  const canPrev = Boolean(photo) && (index > 0 || Boolean(photo?.prev));
  const canNext = Boolean(photo) && (index < photos.length - 1 || Boolean(photo?.next));
  const stepWhy = !canPrev && !canNext ? t("r7.vueSeule") : !canPrev ? t("r7.vueDebut") : !canNext ? t("r7.vueFin") : "";
  return <section className={rue && plein ? "u-repere is-rue" : "u-repere"} aria-label={t("r7.repere")}>
    <p className="u-label">{t("r7.repere")}</p>
    <div className="u-repere-search">
      <input aria-label={t("r7.ou")} value={query} maxLength={600} placeholder={t("r7.lieuPh")} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void go(); }} />
      <button type="button" className="u-repere-go" disabled={waiting} aria-describedby={waiting ? "u-why-aller" : undefined} onClick={() => void go()}>{t("r7.aller")}</button>
    </div>
    {waiting && <p className="u-why" id="u-why-aller">{empty ? t("r7.allerOff") : t("r7.allerBusy")}</p>}
    <div className="u-repere-chips">
      {LIEUX_EXEMPLE.map(item => <button key={item.id} type="button" aria-pressed={quartier?.name === item.name} onClick={() => { setQuery(item.name); void loadBlock(item, 0, 0); }}>{item.name}</button>)}
      <label className="u-repere-file">
        {t("r7.fichier")}
        <input aria-label={t("r7.fichier")} type="file" accept=".kml,.kmz,.geojson,.json,application/geo+json,application/vnd.google-earth.kml+xml" onChange={event => { void onFile(event.target.files?.[0] ?? null); event.target.value = ""; }} />
      </label>
    </div>
    <p className="u-label">{t("r7.pasCarte")}</p>
    <div className="u-repere-couv">
      <button type="button" className="u-secondary" data-couverture={couv ? "on" : "off"} aria-pressed={couv} aria-describedby="u-couv-note" onClick={toggleCouverture}>{t("r7.couverture")}</button>
      <p className="u-small" id="u-couv-note">{couv ? t(overlay.current.mapillary ? "r7.couvertureOnBoth" : "r7.couvertureOn") : t("r7.couvertureOff")}</p>
    </div>
    <p className="u-repere-credit">{OSM_CREDIT} · {t("r7.creditMap")} · {t("r7.creditPhoton")}{quartier ? ` · ${t("r7.creditBatiments")}` : ""}{couv ? ` · ${overlay.current.credits.join(" · ")}` : ""}</p>
    <div className={rue ? "u-rue-frame" : "u-map-slot"}>
      <div className={rue ? "u-repere-map is-mini" : "u-repere-map"} data-pas="1" ref={host} />
    {photoState === "load" && <p className="u-small" id="u-why-search">{t("r7.photosBusy")}</p>}
    {photoState === "fail" && <p className="u-small">{t("r7.photosFail")}</p>}
    {photoState === "rate" && <p className="u-why">{t("r7.rate")}</p>}
    {rue && <section className="u-rue" aria-label={t("r7.photosLieu")} data-pas="2" data-photos={demo ? "fixture" : "live"} data-rue-count={photos.length} data-rue-index={index}>
      <p className="u-label">{t("r7.pasSol")}</p>
      <p className="u-small">{t("r7.pasAngle")}</p>
      <RueViewer ref={rueRef} photo={photo} demo={demo} cap={cap} onCap={setCap} onFail={() => setPhotoNote(t("r7.photosFail"))} />
      <div className="u-rue-bar">
        <button type="button" className="u-secondary" data-rue-prev="" disabled={!canPrev} aria-describedby={!canPrev ? "u-why-rue" : undefined} onClick={() => void step(-1)}>{t("r7.vuePrecedente")}</button>
        <button type="button" className="u-secondary" data-rue-next="" disabled={!canNext} aria-describedby={!canNext ? "u-why-rue" : undefined} onClick={() => void step(1)}>{t("r7.vueSuivante")}</button>
        <button type="button" className="u-secondary" data-prendre-vue="" disabled={Boolean(saving) || (!demo && Boolean(photo) && !reusablePhoto(photo!))} aria-describedby={saving ? "u-why-photo" : photo && !reusablePhoto(photo) ? "u-why-license" : undefined} onClick={() => void takeView()}>{t("r7.prendreVue")}</button>
        <button type="button" className="u-secondary u-rue-quit" data-rue-quitter="" onClick={() => setPlein(false)}>{t("r7.vueQuitter")}</button>
      </div>
      {stepWhy && <p className="u-why" id="u-why-rue">{stepWhy}</p>}
      {saving && <p className="u-why" id="u-why-photo">{t("r7.photosBusy")}</p>}
      <p className="u-small" data-rue-credit="">{photo ? `${photo.author} · ${photo.source === "panoramax" ? "Panoramax" : "Mapillary"} · ${photo.license}${photo.tour ? " · 360°" : ""}` : ""}</p>
      <p className="u-small u-rue-carte-credit" data-carte-credit="">{t("r7.creditCarteMini")} {OSM_CREDIT} · {t("r7.creditMap")}</p>
      {photo && <p className="u-small"><a href={photo.sourceUrl || photoSourceUrl(photo)} target="_blank" rel="noreferrer">{t("audit.source")}</a>{photoLicenseUrl(photo.license) && <> · <a href={photoLicenseUrl(photo.license)} target="_blank" rel="noreferrer">{photo.license}</a></>} · {Math.round(distanceMeters(place.lat, place.lon, photo.lat, photo.lon))} m</p>}
      {photo && !demo && !reusablePhoto(photo) && <p className="u-why" id="u-why-license">{t("audit.licenseMissing")}</p>}
      {photoNote && <p className="u-small" role="status" data-photo-ajoute="">{photoNote}</p>}
    </section>}
    </div>
    {repli && <section data-pas="2">
      <p className="u-label">{t("r7.pasSol")}</p>
      <p className="u-small">{t("audit.photosEmpty", { radius })}</p>
      <QuartierView quartier={quartier!} regard={regard} onStand={stand => setQuartier(current => current ? { ...current, stand } : current)} />
    </section>}
    {photoState === "empty" && !quartier && <p className="u-small">{t("audit.photosEmpty", { radius })}</p>}
    {mapillaryOff && <p className="u-small">{t("r7.mapillaryOff")}</p>}
    {(photoState === "empty" || photoState === "fail") && <button type="button" className="u-secondary" disabled={busy} aria-describedby={busy ? "u-why-search" : undefined} onClick={() => void loadBlock(place, 0, 0, autour, radius < 1000 ? 1000 : 3000)}>{radius < 3000 ? t("audit.expand", { radius: radius < 1000 ? 1000 : 3000 }) : t("audit.retry")}</button>}
    <div className="u-repere-views">
      <button type="button" aria-pressed={regard === "debout"} onClick={() => retake("debout", autour)}>{t("r7.debout")}</button>
      <button type="button" aria-pressed={regard === "dessus"} onClick={() => retake("dessus", autour)}>{t("r7.dessus")}</button>
      <button type="button" aria-pressed={autour} onClick={() => retake(regard, !autour)}>{t("r7.autour")}</button>
    </div>
    <p className="u-small">{lieuNote(place, regard, autour)}</p>
    <button type="button" className="u-secondary" data-garder-lieu="" disabled={!canKeep} aria-describedby={canKeep ? undefined : "u-why-garder"} onClick={() => void keep()}>{t("r7.garderLieu")}</button>
    {!canKeep && <p className="u-why" id="u-why-garder">{busy ? t("r7.allerBusy") : t("r7.garderOff")}</p>}
    <section data-pas="3" data-choisies={chosen.length}>
      <p className="u-label">{t("r7.pasCreer")}</p>
      <button type="button" className="u-secondary" data-creer-decor="" disabled={creerBlocked} aria-describedby="u-why-creer">{t("r7.creerDecor")}</button>
      <p className="u-why" id="u-why-creer">{creerWhy}</p>
      <p className="u-prise-quote">{t("r7.habillerQuote", { credits: guide.credits })}</p>
    </section>
    {note && <p className="u-small" role="status">{note}</p>}
  </section>;
}

function demoRue(place: LieuTrouve): RueVue[] {
  const items = fixturePhotos();
  return items.map((item, index) => ({
    id: item.id,
    author: item.author,
    thumb: "",
    view: "",
    source: item.source,
    license: item.license,
    tour: true,
    lat: place.lat,
    lon: place.lon + index * 0.0003,
    heading: index * 30,
    fov: 360,
    next: items[index + 1]?.id ?? null,
    prev: items[index - 1]?.id ?? null,
  }));
}

async function loadPhoto(thumb: string): Promise<Blob | null> {
  const response = await fetch(thumb);
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith("image/")) return null;
  return response.blob();
}
