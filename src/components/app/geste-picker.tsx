"use client";

import { useState } from "react";
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
  return <article className="u-tile" data-selected={selected || undefined} data-soon={gesteOuvert(item) ? undefined : "true"}>
    <button type="button" role="option" aria-selected={selected} className="u-tile-hit" onClick={() => onChange(item.id)}>
      {file ? <img src={assetPath(file)} alt="" /> : <span className="u-tile-blank" />}
      <span className="u-tile-copy">
        <strong>{t(`gestes.${item.clef}.title`)}</strong>
        <span>{t(`gestes.${item.clef}.phrase`)}</span>
      </span>
    </button>
    {example && onExample && <button type="button" className="u-link" onClick={() => onExample(item.id)}>{t("gestes.seeExample")}</button>}
  </article>;
}

export function GestePicker({ onglet, value, onChange, onExample, examples = [] }: {
  onglet: Onglet;
  value: string;
  onChange(id: string): void;
  onExample?(id: string): void;
  examples?: readonly string[];
}) {
  const { t } = useI18n();
  const rows = REGISTRE.filter(item => item.onglet === onglet);
  const open = rows.filter(gesteOuvert);
  const soon = rows.filter(item => !gesteOuvert(item));
  const [more, setMore] = useState(soon.some(item => item.id === value));
  const known = new Set(examples);

  return <div className="u-gestes">
    <p className="u-label" id="u-gestes-label">{t("gestes.ask")}</p>
    <div className="u-tile-scroll" role="listbox" aria-labelledby="u-gestes-label">
      {open.map(item => <Tile key={item.id} item={item} selected={item.id === value} example={known.has(item.id)} onChange={onChange} onExample={onExample} />)}
    </div>
    {soon.length > 0 && <button type="button" className="u-link" aria-expanded={more} onClick={() => setMore(current => !current)}>{more ? t("gestes.less") : t("gestes.more")}</button>}
    {more && <div className="u-soon">
      <p className="u-label">{t("gestes.soon")}</p>
      <div className="u-tile-scroll" role="listbox" aria-label={t("gestes.soon")}>
        {soon.map(item => <Tile key={item.id} item={item} selected={item.id === value} example={false} onChange={onChange} onExample={onExample} />)}
      </div>
    </div>}
  </div>;
}
