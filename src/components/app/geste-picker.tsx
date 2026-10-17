"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { assetPath } from "@/lib/site";
import { illustrationGeste } from "@/lib/workflows/tuiles";
import { REGISTRE, gesteOuvert, gesteVisible, type Geste, type Onglet } from "@/lib/workflows/registre";
import { useStudio } from "./studio-session";

function Tile({ item, selected, example, onChange, onExample, onStart }: {
  item: Geste;
  selected: boolean;
  example: boolean;
  onChange(id: string): void;
  onExample?(id: string): void;
  onStart?(id: string): void;
}) {
  const { t } = useI18n();
  const file = illustrationGeste(item.id);
  const open = gesteOuvert(item);
  return <article className="u-tile" data-geste={item.id} data-selected={selected || undefined} data-soon={open ? undefined : "true"}>
    <button type="button" role="option" aria-selected={selected} className="u-tile-hit" onClick={() => onChange(item.id)}>
      {file ? <img src={assetPath(file)} alt="" /> : <span className="u-tile-blank" />}
      <span className="u-tile-copy">
        <strong>{t(`gestes.${item.clef}.title`)}</strong>
        <span>{t(`gestes.${item.clef}.phrase`)}</span>
      </span>
    </button>
    {!open && item.raison && <p className="u-tile-why">{t(item.raison)}</p>}
    {example && (onExample || onStart) && <div className="u-tile-examples">
      {onExample && <button type="button" className="u-link" data-voir-exemple={item.id} onClick={() => onExample(item.id)}>{t("gestes.seeExample")}</button>}
      {onStart && <button type="button" className="u-link u-start" data-partir-exemple={item.id} onClick={() => onStart(item.id)}>{t("gestes.startExample")}</button>}
    </div>}
  </article>;
}

function groupsOf(items: readonly Geste[]): { categorie: Geste["categorie"]; rows: Geste[] }[] {
  const order: Geste["categorie"][] = [];
  const map = new Map<Geste["categorie"], Geste[]>();
  for (const item of items) {
    const list = map.get(item.categorie);
    if (list) list.push(item);
    else {
      order.push(item.categorie);
      map.set(item.categorie, [item]);
    }
  }
  return order.map(categorie => ({ categorie, rows: map.get(categorie) ?? [] }));
}

export function GestePicker({ onglet, value, onChange, onExample, onStart, examples = [] }: {
  onglet: Onglet;
  value: string;
  onChange(id: string): void;
  onExample?(id: string): void;
  onStart?(id: string): void;
  examples?: readonly string[];
}) {
  const { t } = useI18n();
  const { prefs, setPrefs } = useStudio();
  // Closed gestures are not shown at all: a novice only sees what really runs.
  const mine = REGISTRE.filter(item => item.onglet === onglet && gesteVisible(item, prefs) && gesteOuvert(item));
  const open = mine;
  const premiers = open.filter(item => item.premier);
  const extras = open.filter(item => !item.premier);
  const visible = (premiers.length >= 4 ? premiers : [...premiers, ...extras]).slice(0, 4);
  const folded = open.filter(item => !visible.includes(item));
  const [more, setMore] = useState(false);
  const known = new Set(examples);
  const foldedGroups = groupsOf(folded);

  useEffect(() => {
    if (!mine.some(item => item.id === value) && visible[0]) onChange(visible[0].id);
  }, [prefs.openWeightsOnly, prefs.nanoBanana, onglet]);
  useEffect(() => {
    if (folded.some(item => item.id === value)) setMore(true);
  }, [value, onglet]);
  useEffect(() => {
    document.querySelector(`[data-geste="${value}"]`)?.scrollIntoView({ block: "nearest" });
  }, [value, more]);

  return <div className="u-gestes">
    <p className="u-label" id="u-gestes-label">{t("gestes.ask")}</p>
    <div className="u-tile-scroll" role="listbox" aria-labelledby="u-gestes-label">
      {visible.map(item => <Tile key={item.id} item={item} selected={item.id === value} example={known.has(item.id)} onChange={onChange} onExample={onExample} onStart={onStart} />)}
    </div>
    {folded.length > 0 && <button type="button" className="u-link" aria-expanded={more} onClick={() => setMore(current => !current)}>{more ? t("gestes.less") : t("gestes.more")}</button>}
    {more && foldedGroups.map(group => <div key={group.categorie} className="u-geste-group">
      {foldedGroups.length > 1 && <p className="u-label">{t(`gestes.cat.${group.categorie}`)}</p>}
      <div className="u-tile-scroll" role="listbox">
        {group.rows.map(item => <Tile key={item.id} item={item} selected={item.id === value} example={known.has(item.id)} onChange={onChange} onExample={onExample} onStart={onStart} />)}
      </div>
    </div>)}
    <details className="u-fold u-avance" data-avance="">
      <summary>{t("p0.advanced")}</summary>
      <ModelOptions openWeightsOnly={prefs.openWeightsOnly} nanoBanana={prefs.nanoBanana} onChange={setPrefs} />
    </details>
  </div>;
}

/** Two device options. Open Weights Only hides partner nodes; Nano Banana is off by default. */
export function ModelOptions({ openWeightsOnly, nanoBanana, onChange }: {
  openWeightsOnly: boolean;
  nanoBanana: boolean;
  onChange(next: { openWeightsOnly?: boolean; nanoBanana?: boolean }): void;
}) {
  const { t } = useI18n();
  return <fieldset className="u-model-options">
    <legend className="u-label">{t("gestes.options.title")}</legend>
    <label className="u-toggle" title={t("gestes.options.openWeightsHint")}>
      <input type="checkbox" checked={openWeightsOnly} onChange={event => onChange({ openWeightsOnly: event.target.checked })} />
      <span>{t("gestes.options.openWeights")}</span>
    </label>
    <label className="u-toggle">
      <input type="checkbox" checked={nanoBanana} disabled={openWeightsOnly} onChange={event => onChange({ nanoBanana: event.target.checked })} />
      <span>{t("gestes.options.nano")}</span>
    </label>
  </fieldset>;
}
