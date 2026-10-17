"use client";

// One compact card for every paid operation: the seven steps, what leaves for the engine,
// what may change, the single estimate, the failure in plain words, and where the result goes.

import type { ReactNode } from "react";
import { useI18n } from "@/components/i18n/provider";
import { ETAPES, etapeCourante, type Etape, type EtapeEtat } from "@/lib/fiabilite";

export interface SentLine {
  label: string;
  value: string;
  /** Flagged lines (for example camera words that overrode a tile) are outlined. */
  flag?: boolean;
}

export function ProtocolStrip({ states }: { states: Record<Etape, EtapeEtat> }) {
  const { t } = useI18n();
  const current = etapeCourante(states);
  return <ol className="u-fiab-steps" aria-label={t("p0.fiab.title")} data-etape-courante={current ?? "fini"}>
    {ETAPES.map((step, index) => <li key={step} data-etape={step} data-etat={states[step]} aria-current={step === current ? "step" : undefined}>
      <span className="u-fiab-dot" aria-hidden="true">{states[step] === "fait" ? "✓" : states[step] === "echec" ? "!" : index + 1}</span>
      <span className="u-fiab-word">{t(`p0.fiab.${step}`)}</span>
    </li>)}
  </ol>;
}

export function FiabiliteCard({ states, sent, change, estimate, estimateId, estimateClass = "", failure, where, open, children }: {
  states: Record<Etape, EtapeEtat>;
  sent: SentLine[];
  change: string;
  estimate: string;
  estimateId?: string;
  estimateClass?: string;
  failure?: string;
  where?: string;
  /** Opened by default inside a confirmation; folded in the stage. */
  open?: boolean;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return <section className="u-fiab" data-fiabilite="" aria-label={t("p0.fiab.title")}>
    <ProtocolStrip states={states} />
    <p className={`u-fiab-estimate u-cost is-ok ${estimateClass}`.trim()} id={estimateId} data-fiab-estimate="">{estimate}</p>
    {failure && <p className="u-fiab-fail" role="alert" data-fiab-echec="">{failure}</p>}
    {where && <p className="u-fiab-where" data-fiab-archive="">{where}</p>}
    <details className="u-fiab-more" open={open}>
      <summary>{t("p0.fiab.sentTitle")}</summary>
      <dl className="u-fiab-sent">
        {sent.map(line => <div key={line.label} data-flag={line.flag || undefined}><dt>{line.label}</dt><dd>{line.value}</dd></div>)}
      </dl>
      <p className="u-fiab-change"><strong>{t("p0.fiab.changeTitle")}</strong> {change}</p>
    </details>
    {children}
  </section>;
}
