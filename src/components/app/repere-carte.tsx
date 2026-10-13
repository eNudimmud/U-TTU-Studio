"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { useI18n } from "@/components/i18n/provider";
import { guideQuote } from "@/lib/prise/guide";
import {
  LIEUX_EXEMPLE, OSM_CREDIT, OPENFREEMAP_STYLE, lieuNote, pitchFor, zoomFor,
  type LieuTrouve, type Regard,
} from "@/lib/repere/lieu";

interface Props {
  onSave(place: LieuTrouve, regard: Regard, autour: boolean): Promise<void>;
}

export function RepereCarte({ onSave }: Props) {
  const { t } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ easeTo(options: object): void; remove(): void } | null>(null);
  const [query, setQuery] = useState("Montmartre, Paris");
  const [place, setPlace] = useState<LieuTrouve>(LIEUX_EXEMPLE[0]);
  const [regard, setRegard] = useState<Regard>("debout");
  const [autour, setAutour] = useState(false);
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
        center: [place.lon, place.lat],
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

  function show(next: LieuTrouve, view = regard, wide = autour) {
    setPlace(next);
    mapRef.current?.easeTo({
      center: [next.lon, next.lat],
      zoom: zoomFor(wide),
      pitch: pitchFor(view),
      duration: 600,
    });
  }

  async function remember(next: LieuTrouve, view = regard, wide = autour) {
    show(next, view, wide);
    await onSave(next, view, wide);
    setNote(t("r7.saved"));
  }

  async function go() {
    const asked = query.trim();
    if (asked.length < 2) return;
    const now = Date.now();
    if (now - lastAsk.current < 1000) {
      setNote(t("r7.rate"));
      return;
    }
    lastAsk.current = now;
    setBusy(true);
    try {
      const response = await fetch(`/api/repere?q=${encodeURIComponent(asked)}`);
      const payload = await response.json() as { name?: string; lat?: number; lon?: number; error?: string };
      if (!response.ok || typeof payload.lat !== "number" || typeof payload.lon !== "number" || !payload.name) {
        setNote(payload.error === "rate" ? t("r7.rate") : t("r7.introuvable"));
        return;
      }
      await remember({ name: payload.name, lat: payload.lat, lon: payload.lon });
    } catch {
      setNote(t("r7.introuvable"));
    } finally {
      setBusy(false);
    }
  }

  const empty = query.trim().length < 2;
  const waiting = empty || busy;
  return <section className="u-repere" aria-label={t("r7.repere")}>
    <p className="u-label">{t("r7.repere")}</p>
    <div className="u-repere-search">
      <input aria-label={t("r7.lieuPh")} value={query} maxLength={120} placeholder={t("r7.lieuPh")} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void go(); }} />
      <button type="button" className="u-primary" disabled={waiting} aria-describedby={waiting ? "u-why-aller" : undefined} onClick={() => void go()}>{t("r7.aller")}</button>
    </div>
    {waiting && <p className="u-why" id="u-why-aller">{empty ? t("r7.allerOff") : t("r7.allerBusy")}</p>}
    <div className="u-repere-chips">
      {LIEUX_EXEMPLE.map(item => <button key={item.id} type="button" aria-pressed={place.name === item.name} onClick={() => { setQuery(item.name); void remember(item); }}>{item.name}</button>)}
    </div>
    <p className="u-repere-credit">{OSM_CREDIT}</p>
    <div className="u-repere-map" ref={host} />
    <div className="u-repere-views">
      <button type="button" aria-pressed={regard === "debout"} onClick={() => { setRegard("debout"); show(place, "debout", autour); void onSave(place, "debout", autour); }}>{t("r7.debout")}</button>
      <button type="button" aria-pressed={regard === "dessus"} onClick={() => { setRegard("dessus"); show(place, "dessus", autour); void onSave(place, "dessus", autour); }}>{t("r7.dessus")}</button>
      <button type="button" aria-pressed={autour} onClick={() => { const next = !autour; setAutour(next); show(place, regard, next); void onSave(place, regard, next); }}>{t("r7.autour")}</button>
    </div>
    <p className="u-small">{lieuNote(place, regard, autour)}</p>
    <button type="button" className="u-secondary" disabled aria-describedby="u-why-habiller">{t("r7.habiller")}</button>
    <p className="u-why" id="u-why-habiller">{t("r7.habillerWhy")}</p>
    <p className="u-prise-quote">{t("r7.habillerQuote", { credits: guide.credits })}</p>
    {note && <p className="u-small" role="status">{note}</p>}
  </section>;
}
