"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { assetPath } from "@/lib/site";
import { illustrationGeste } from "@/lib/workflows/tuiles";
import { REGISTRE, gesteOuvert, type Geste, type Onglet } from "@/lib/workflows/registre";

function Tile({ item, selected, example, onChange, onExample }: {
  item: Geste;
  selected: boolean;
  example: boolean;
  onChange(id: string): void;
  onExample?(id: string): void;
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
    {example && onExample && <button type="button" className="u-link" onClick={() => onExample(item.id)}>{t("gestes.seeExample")}</button>}
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

export function GestePicker({ onglet, value, onChange, onExample, examples = [] }: {
  onglet: Onglet;
  value: string;
  onChange(id: string): void;
  onExample?(id: string): void;
  examples?: readonly string[];
}) {
  const { t } = useI18n();
  const mine = REGISTRE.filter(item => item.onglet === onglet);
  const open = mine.filter(gesteOuvert);
  const soon = mine.filter(item => !gesteOuvert(item));
  const premiers = open.filter(item => item.premier);
  const extras = open.filter(item => !item.premier);
  const visible = (premiers.length >= 4 ? premiers : [...premiers, ...extras]).slice(0, 4);
  const folded = open.filter(item => !visible.includes(item));
  const [more, setMore] = useState(false);
  const known = new Set(examples);
  const foldedGroups = groupsOf(folded);
  const soonGroups = groupsOf(soon);

  useEffect(() => {
    if (soon.some(item => item.id === value) || folded.some(item => item.id === value)) setMore(true);
  }, [value, onglet]);
  useEffect(() => {
    document.querySelector(`[data-geste="${value}"]`)?.scrollIntoView({ block: "nearest" });
  }, [value, more]);

  return <div className="u-gestes">
    <p className="u-label" id="u-gestes-label">{t("gestes.ask")}</p>
    <div className="u-tile-scroll" role="listbox" aria-labelledby="u-gestes-label">
      {visible.map(item => <Tile key={item.id} item={item} selected={item.id === value} example={known.has(item.id)} onChange={onChange} onExample={onExample} />)}
    </div>
    {(folded.length > 0 || soon.length > 0) && <button type="button" className="u-link" aria-expanded={more} onClick={() => setMore(current => !current)}>{more ? t("gestes.less") : t("gestes.more")}</button>}
    {more && <>
      {foldedGroups.map(group => <div key={group.categorie} className="u-geste-group">
        {foldedGroups.length > 1 && <p className="u-label">{t(`gestes.cat.${group.categorie}`)}</p>}
        <div className="u-tile-scroll" role="listbox">
          {group.rows.map(item => <Tile key={item.id} item={item} selected={item.id === value} example={known.has(item.id)} onChange={onChange} onExample={onExample} />)}
        </div>
      </div>)}
      {soon.length > 0 && <div className="u-soon">
        <p className="u-label">{t("gestes.soon")}</p>
        {soonGroups.map(group => <div key={group.categorie} className="u-geste-group">
          {soonGroups.length > 1 && <p className="u-label">{t(`gestes.cat.${group.categorie}`)}</p>}
          <div className="u-tile-scroll" role="listbox" aria-label={t("gestes.soon")}>
            {group.rows.map(item => <Tile key={item.id} item={item} selected={item.id === value} example={false} onChange={onChange} onExample={onExample} />)}
          </div>
        </div>)}
      </div>}
    </>}
  </div>;
}
