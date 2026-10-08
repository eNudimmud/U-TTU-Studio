"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { gestesOnglet, type Fourniture, type Geste, type Onglet } from "@/lib/workflows/registre";

function fournitLabel(t: (key: string) => string, items: readonly Fourniture[]): string {
  const labels = [...new Set(items)].map(item => t(`gestes.fournit.${item}`));
  return labels.join(", ");
}

export function GestePicker({ onglet, value, onChange }: { onglet: Onglet; value: string; onChange(id: string): void }) {
  const { t } = useI18n();
  const { premiers, suite } = gestesOnglet(onglet);
  const [open, setOpen] = useState(suite.some(item => item.id === value));
  const groups = new Map<string, Geste[]>();
  for (const item of open ? [...premiers, ...suite] : premiers) {
    const list = groups.get(item.categorie) ?? [];
    list.push(item);
    groups.set(item.categorie, list);
  }

  return <div className="u-gestes">
    <p className="u-label" id="u-gestes-label">{t("gestes.ask")}</p>
    <div role="listbox" aria-labelledby="u-gestes-label">
      {[...groups.entries()].map(([categorie, items]) => <div key={categorie} className="u-geste-group">
        <p className="u-small">{t(`gestes.cat.${categorie}`)}</p>
        <div className="u-geste-grid">
          {items.map(item => {
            const selected = item.id === value;
            return <button key={item.id} type="button" role="option" aria-selected={selected} className="u-geste" data-selected={selected || undefined} onClick={() => onChange(item.id)}>
              <span className="u-geste-soon">{t("gestes.exampleSoon")}</span>
              <strong>{t(`gestes.${item.clef}.title`)}</strong>
              <span>{t(`gestes.${item.clef}.phrase`)}</span>
              <small>{t("gestes.need", { list: fournitLabel(t, item.fournit) })}</small>
              <small className="u-geste-cost">{item.nature === "mesure" && item.credits !== null && item.high !== null
                ? t("gestes.costMeasured", { amount: item.credits, high: item.high })
                : item.credits !== null && item.high !== null
                  ? t("gestes.cost", { amount: item.credits, high: item.high })
                  : t("gestes.costUnknown")}</small>
            </button>;
          })}
        </div>
      </div>)}
    </div>
    {suite.length > 0 && <button type="button" className="u-link" aria-expanded={open} onClick={() => setOpen(current => !current)}>{open ? t("gestes.less") : t("gestes.more")}</button>}
  </div>;
}
