"use client";

import { useMemo, useState } from "react";
import { useLocaleSwitch } from "@/components/i18n/provider";
import cards from "@/lib/guide/tools.json";
import { GuideBar } from "./guide-bar";
import "./guide.css";

type Card = (typeof cards)[number];
const FAMS = ["all", "cast", "decor", "prise", "finish", "sound", "agent"] as const;
const FAM_LABEL: Record<string, Record<string, string>> = {
  en: { all: "All", cast: "Cast", decor: "Set", prise: "Shoot", finish: "Finish", sound: "Sound", agent: "Uttu" },
  fr: { all: "Tout", cast: "CAST", decor: "DÉCOR", prise: "PRISE", finish: "Finaliser", sound: "Son", agent: "Uttu" },
  de: { all: "Alle", cast: "Besetzung", decor: "Kulisse", prise: "Take", finish: "Finalisieren", sound: "Ton", agent: "Uttu" },
  es: { all: "Todo", cast: "Reparto", decor: "Decorado", prise: "Toma", finish: "Finalizar", sound: "Sonido", agent: "Uttu" },
};

export function GuideTools() {
  const { locale } = useLocaleSwitch();
  const labels = FAM_LABEL[locale] ?? FAM_LABEL.en;
  const [q, setQ] = useState("");
  const [fam, setFam] = useState<(typeof FAMS)[number]>("all");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (cards as Card[]).filter(card => {
      if (fam !== "all" && card.fam !== fam) return false;
      if (!needle) return true;
      const text = locale === "fr" ? card.fr : card.en;
      return `${text.name} ${text.one} ${card.fam}`.toLowerCase().includes(needle);
    });
  }, [q, fam, locale]);
  return <>
    <GuideBar page="tools" />
    <div className="g-wrap">
      <div className="g-hero">
        <div className="eyebrow">Guide</div>
        <h1>Know your <em>tools</em>.</h1>
        <p className="g-lede">Short notes on every engine: what it does best, where it slips, one tip, and what it costs. Prices read “≈ X credits estimated”.</p>
      </div>
      <label className="g-search">
        <span className="sr-only">Search</span>
        <input value={q} onChange={event => setQ(event.target.value)} placeholder="faces, rain, talking, music…" />
        <span className="g-count" aria-live="polite">{shown.length} / {cards.length}</span>
      </label>
      <div className="g-fams" role="toolbar">
        {FAMS.map(id => <button key={id} type="button" aria-pressed={fam === id} onClick={() => setFam(id)}>{labels[id]}</button>)}
      </div>
      <div className="g-tools">
        {shown.map(card => {
          const text = locale === "fr" ? card.fr : card.en;
          return <article className="g-card" key={card.id} id={card.id}>
            <div className="thumb">
              {card.img ? <img src={card.img} alt="" /> : <span className="g-ph">Studio example coming</span>}
            </div>
            <div className="body">
              <h3>{text.name}</h3>
              <p className="g-muted">{text.one}</p>
              <span className="g-cost">{text.cost}</span>
              <p className="g-muted">{text.tip}</p>
            </div>
          </article>;
        })}
      </div>
    </div>
  </>;
}
