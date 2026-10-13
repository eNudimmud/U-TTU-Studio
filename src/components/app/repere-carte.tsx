"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useI18n } from "@/components/i18n/provider";
import { guideQuote } from "@/lib/prise/guide";
import { parseFichier } from "@/lib/repere/fichier";
import { fixtureQuartier } from "@/lib/repere/fixture";
import {
  LIEUX_EXEMPLE, OSM_CREDIT, OPENFREEMAP_STYLE, lieuNote, pitchFor, zoomFor,
  type LieuTrouve, type Regard,
} from "@/lib/repere/lieu";
import { parseQuartier, rayonFor, type Quartier } from "@/lib/repere/quartier";
import { parseSaisie } from "@/lib/repere/saisie";
import { useStudio } from "./studio-session";
import { QuartierView } from "./quartier-view";

interface Props {
  onSave(place: LieuTrouve, regard: Regard, autour: boolean, quartier: string): Promise<void>;
}

export function RepereCarte({ onSave }: Props) {
  const { t } = useI18n();
  const { demo } = useStudio();
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ easeTo(options: object): void; remove(): void } | null>(null);
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState<LieuTrouve>(LIEUX_EXEMPLE[0]);
  const [regard, setRegard] = useState<Regard>("debout");
  const [autour, setAutour] = useState(false);
  const [quartier, setQuartier] = useState<Quartier | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
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
      mapRef.current = map;
      remove = () => map.remove();
    }).catch(() => { setNote(t("r7.introuvable")); });
    return () => {
      dead = true;
      remove();
      mapRef.current = null;
    };
  }, [t]);

  function showMap(next: LieuTrouve, view = regard, wide = autour) {
    mapRef.current?.easeTo({
      center: [next.lon, next.lat],
      zoom: zoomFor(wide),
      pitch: pitchFor(view),
      duration: 600,
    });
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

  const empty = query.trim().length < 2;
  const waiting = empty || busy;
  const canKeep = Boolean(quartier) && !busy;
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
    <p className="u-repere-credit">{OSM_CREDIT} · {t("r7.creditMap")} · {t("r7.creditRelief")}</p>
    <div className="u-repere-map" ref={host} />
    {quartier && <QuartierView quartier={quartier} regard={regard} onStand={stand => setQuartier(current => current ? { ...current, stand } : current)} />}
    <div className="u-repere-views">
      <button type="button" aria-pressed={regard === "debout"} onClick={() => retake("debout", autour)}>{t("r7.debout")}</button>
      <button type="button" aria-pressed={regard === "dessus"} onClick={() => retake("dessus", autour)}>{t("r7.dessus")}</button>
      <button type="button" aria-pressed={autour} onClick={() => retake(regard, !autour)}>{t("r7.autour")}</button>
    </div>
    <p className="u-small">{lieuNote(place, regard, autour)}</p>
    <button type="button" className="u-secondary" data-garder-lieu="" disabled={!canKeep} aria-describedby={canKeep ? undefined : "u-why-garder"} onClick={() => void keep()}>{t("r7.garderLieu")}</button>
    {!canKeep && <p className="u-why" id="u-why-garder">{busy ? t("r7.allerBusy") : t("r7.garderOff")}</p>}
    <button type="button" className="u-secondary" disabled aria-describedby="u-why-habiller">{t("r7.habiller")}</button>
    <p className="u-prise-quote" id="u-why-habiller">{t("r7.habillerQuote", { credits: guide.credits })}</p>
    {note && <p className="u-small" role="status">{note}</p>}
  </section>;
}

function pause(ms: number): Promise<void> {
  return new Promise(resolve => { window.setTimeout(resolve, ms); });
}
