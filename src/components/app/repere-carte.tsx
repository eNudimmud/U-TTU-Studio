"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useI18n } from "@/components/i18n/provider";
import { guideQuote } from "@/lib/prise/guide";
import { parseFichier } from "@/lib/repere/fichier";
import { fixtureQuartier } from "@/lib/repere/fixture";
import { fixturePhotos } from "@/lib/repere/mapillary";
import {
  LIEUX_EXEMPLE, OSM_CREDIT, OPENFREEMAP_STYLE, lieuNote, pitchFor, zoomFor,
  type LieuTrouve, type Regard,
} from "@/lib/repere/lieu";
import { parseQuartier, rayonFor, type Quartier } from "@/lib/repere/quartier";
import { parseSaisie } from "@/lib/repere/saisie";
import { useStudio } from "./studio-session";
import { QuartierView } from "./quartier-view";

interface RueVue {
  id: string;
  author: string;
  thumb: string;
  source: "panoramax" | "mapillary";
  license: string;
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
  const mapRef = useRef<{ easeTo(options: object): void; remove(): void } | null>(null);
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
  const [photoState, setPhotoState] = useState<"idle" | "load" | "ready" | "token" | "empty" | "fail" | "rate">("idle");
  const [saving, setSaving] = useState("");
  const [photoNote, setPhotoNote] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [mapillaryOff, setMapillaryOff] = useState(false);
  const guide = guideQuote();
  const lastAsk = useRef(0);

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

  const lat = quartier?.lat ?? null;
  const lon = quartier?.lon ?? null;
  useEffect(() => {
    if (lat === null || lon === null) {
      setPhotos([]);
      setChosen([]);
      setPhotoState("idle");
      setPhotoNote("");
      return;
    }
    setChosen([]);
    let dead = false;
    const made: string[] = [];
    if (demo) {
      setPhotoState("load");
      void Promise.all(fixturePhotos().map(async item => {
        const blob = await paintRue(item.author);
        const thumb = URL.createObjectURL(blob);
        made.push(thumb);
        return { id: item.id, author: item.author, thumb, blob, source: item.source, license: item.license };
      })).then(list => {
        if (dead) {
          for (const url of made) URL.revokeObjectURL(url);
          return;
        }
        setPhotos(list);
        setPhotoState("ready");
      }).catch(() => {
        if (!dead) setPhotoState("fail");
      });
      return () => {
        dead = true;
        for (const url of made) URL.revokeObjectURL(url);
      };
    }
    setPhotoState("load");
    setPhotos([]);
    const mobile = window.matchMedia("(max-width: 799px)").matches;
    const params = new URLSearchParams({
      photos: "1",
      lat: String(lat),
      lon: String(lon),
      mobile: mobile ? "1" : "0",
    });
    void fetch(`/api/repere?${params}`)
      .then(async response => {
        const payload = await response.json() as { error?: string; mapillary?: string; photos?: { id?: string; author?: string; thumb?: string; source?: string; license?: string }[] };
        if (dead) return;
        setMapillaryOff(payload.mapillary === "off");
        if (payload.error === "token") {
          setPhotos([]);
          setPhotoState("token");
          return;
        }
        if (response.status === 429 || payload.error === "rate") {
          setPhotoState("rate");
          return;
        }
        if (payload.error || !response.ok) {
          setPhotos([]);
          setPhotoState("fail");
          return;
        }
        const list = (payload.photos ?? []).flatMap(item => {
          if (!item.id || !item.author || !item.thumb) return [];
          const source = item.source === "mapillary" ? "mapillary" as const : "panoramax" as const;
          return [{ id: item.id, author: item.author, thumb: item.thumb, source, license: item.license || (source === "mapillary" ? "CC BY-SA" : "etalab-2.0") }];
        });
        setPhotos(list);
        setPhotoState(list.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (!dead) setPhotoState("fail");
      });
    return () => {
      dead = true;
    };
  }, [demo, lat, lon]);

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

  async function loadBlock(next: LieuTrouve, heading = 0, tilt = 0, wide = autour) {
    setPlace(next);
    showMap(next, regard, wide);
    if (demo) {
      setQuartier(fixtureQuartier(next, heading, tilt));
      setNote("");
      return;
    }
    if (limited()) return;
    setBusy(true);
    try {
      const block = await fetchBlock(next, heading, tilt, wide);
      if (block === "rate") {
        setNote(t("r7.rate"));
        return;
      }
      setQuartier(block);
      setNote(block ? "" : t("r7.quartierFail"));
    } catch {
      setQuartier(null);
      setNote(t("r7.quartierFail"));
    } finally {
      setBusy(false);
    }
  }
  loadRef.current = loadBlock;

  async function fetchBlock(next: LieuTrouve, heading: number, tilt: number, wide: boolean): Promise<Quartier | "rate" | null> {
    const mobile = window.matchMedia("(max-width: 799px)").matches;
    const params = new URLSearchParams({
      lat: String(next.lat),
      lon: String(next.lon),
      rayon: String(rayonFor(mobile, wide)),
      mobile: mobile ? "1" : "0",
      name: next.name,
      heading: String(heading),
      tilt: String(tilt),
    });
    const response = await fetch(`/api/repere?${params}`);
    const payload = await response.json() as { error?: string };
    if (response.status === 429 || payload.error === "rate") return "rate";
    if (!response.ok) return null;
    return parseQuartier(JSON.stringify(payload));
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
      if (demo) {
        setNote(t("r7.introuvable"));
        return;
      }
      if (limited()) return;
      setBusy(true);
      try {
        const response = await fetch(`/api/repere?url=${encodeURIComponent(parsed.url)}`);
        const payload = await response.json() as { name?: string; lat?: number; lon?: number; heading?: number; tilt?: number; error?: string };
        if (!response.ok || typeof payload.lat !== "number" || typeof payload.lon !== "number") {
          setNote(payload.error === "rate" ? t("r7.rate") : t("r7.introuvable"));
          return;
        }
        await pause(1100);
        await loadBlock(
          { name: payload.name || "Lieu", lat: payload.lat, lon: payload.lon },
          payload.heading ?? 0,
          payload.tilt ?? 0,
        );
      } catch {
        setNote(t("r7.introuvable"));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (demo) {
      const known = LIEUX_EXEMPLE.find(item => parsed.query.toLowerCase().includes(item.name.toLowerCase()));
      const next = known ?? { name: parsed.query.slice(0, 80), lat: LIEUX_EXEMPLE[0].lat, lon: LIEUX_EXEMPLE[0].lon };
      await loadBlock(next, 0, 0);
      return;
    }
    if (limited()) return;
    setBusy(true);
    try {
      const mobile = window.matchMedia("(max-width: 799px)").matches;
      const params = new URLSearchParams({
        q: parsed.query,
        bloc: "1",
        mobile: mobile ? "1" : "0",
        rayon: String(rayonFor(mobile, autour)),
      });
      const response = await fetch(`/api/repere?${params}`);
      const payload = await response.json() as { name?: string; lat?: number; lon?: number; quartier?: unknown; error?: string };
      if (!response.ok || typeof payload.lat !== "number" || typeof payload.lon !== "number" || !payload.name) {
        setNote(payload.error === "rate" ? t("r7.rate") : t("r7.introuvable"));
        return;
      }
      const next = { name: payload.name, lat: payload.lat, lon: payload.lon };
      setPlace(next);
      showMap(next);
      const block = payload.quartier ? parseQuartier(JSON.stringify(payload.quartier)) : null;
      setQuartier(block);
      setNote(block ? "" : t("r7.quartierFail"));
    } catch {
      setNote(t("r7.quartierFail"));
    } finally {
      setBusy(false);
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

  async function addPhoto(photo: RueVue) {
    if (saving || !quartier) return;
    setSaving(photo.id);
    setPhotoNote("");
    try {
      const blob = photo.blob ?? await loadPhoto(photo.id);
      if (!blob || blob.size < 32) {
        setPhotoNote(t("r7.photosFail"));
        return;
      }
      const credit = lineOf(photo);
      await onPhoto?.(place, regard, autour, JSON.stringify(quartier), { id: photo.id, author: photo.author, credit, blob });
      setChosen(list => list.includes(photo.id) ? list : [...list, photo.id]);
      setPhotoNote(`${t("r7.photosAdded")} ${credit}`);
    } catch (error) {
      setPhotoNote(error instanceof Error && error.message === "rate" ? t("r7.rate") : t("r7.photosFail"));
    } finally {
      setSaving("");
    }
  }

  async function keep() {
    if (!quartier) return;
    await onSave(place, regard, autour, JSON.stringify(quartier));
    setNote(t("r7.saved"));
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
  const canKeep = Boolean(quartier) && !busy;
  const creerBlocked = !quartier || demo || !guide.enabled;
  const creerWhy = !quartier ? t("r7.creerOff") : demo ? t("r7.creerDemo") : t("r7.creerMesure");
  return <section className="u-repere" aria-label={t("r7.repere")}>
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
    <p className="u-repere-credit">{OSM_CREDIT} · {t("r7.creditMap")} · {t("r7.creditRelief")}{quartier ? ` · ${quartier.source === "overture" ? t("r7.creditOverture") : t("r7.creditBatiments")}` : ""}</p>
    <div className="u-repere-map" data-pas="1" ref={host} />
    {quartier && <section data-pas="2">
      <p className="u-label">{t("r7.pasSol")}</p>
      <p className="u-small">{t("r7.pasAngle")}</p>
      <QuartierView quartier={quartier} regard={regard} onStand={stand => setQuartier(current => current ? { ...current, stand } : current)} />
    </section>}
    {quartier && <section className={photoState === "token" ? "u-photos is-off" : "u-photos"} aria-label={t("r7.photosLieu")} data-photos={demo && photoState === "ready" ? "fixture" : photoState}>
      <p className="u-label">{t("r7.photosLieu")}</p>
      {photoState === "token" && <p className="u-why">{t("r7.photosOff")}</p>}
      {photoState === "load" && <p className="u-small">{t("r7.photosBusy")}</p>}
      {photoState === "empty" && <p className="u-small">{t("r7.photosEmpty")}</p>}
      {photoState === "fail" && <p className="u-small">{t("r7.photosFail")}</p>}
      {photoState === "rate" && <p className="u-why">{t("r7.rate")}</p>}
      {mapillaryOff && photoState === "ready" && <p className="u-small">{t("r7.mapillaryOff")}</p>}
      {photoState === "ready" && <div className="u-photos-row">
        {photos.map(photo => {
          const credit = lineOf(photo);
          const held = saving === photo.id;
          const picked = chosen.includes(photo.id);
          return <button key={photo.id} type="button" className="u-photo" data-photo={photo.id} aria-label={credit} aria-pressed={picked} disabled={held} aria-describedby={held ? "u-why-photo" : undefined} onClick={() => { if (picked) setChosen(list => list.filter(id => id !== photo.id)); else void addPhoto(photo); }}>
            <img src={photo.thumb} alt="" />
            <span>{photo.author} · {photo.source === "panoramax" ? "Panoramax" : "Mapillary"} · {photo.license}</span>
          </button>;
        })}
      </div>}
      {saving && <p className="u-why" id="u-why-photo">{t("r7.photosBusy")}</p>}
      {photoNote && <p className="u-small" role="status" data-photo-ajoute="">{photoNote}</p>}
    </section>}
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

function pause(ms: number): Promise<void> {
  return new Promise(resolve => { window.setTimeout(resolve, ms); });
}

async function paintRue(author: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 100;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#8a7355";
    ctx.fillRect(0, 0, 160, 100);
    ctx.fillStyle = "#6e675c";
    ctx.fillRect(0, 62, 160, 38);
    ctx.fillStyle = "#d4af37";
    ctx.font = "14px sans-serif";
    ctx.fillText(author, 8, 28);
  }
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(file => resolve(file), "image/png"));
  return blob ?? new Blob();
}

async function loadPhoto(id: string): Promise<Blob | null> {
  const response = await fetch(`/api/repere?photo=${encodeURIComponent(id)}`);
  if (response.status === 429) throw new Error("rate");
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith("image/")) return null;
  return response.blob();
}
