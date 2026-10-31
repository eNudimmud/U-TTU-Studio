"use client";

// « Film · ≈ X » / « Film N shots » → this one confirmation, over the page: every step of every shot
// (a missing character or place is made once, by the first shot that needs it), the total, the balance
// after. Nothing is sent before « Start ». Same words as PRISE's film2 confirmation.

import { useEffect, useRef } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { devisStoryboard, type EtapeDevis } from "@/lib/storyboard/devis";
import { trouverPlan, type Storyboard } from "@/lib/storyboard/storyboard";
import { useStudio } from "../app/studio-session";
import type { Storyboards } from "./use-storyboards";

export function StoryboardConfirm({ sb, ids, data, onStart, onClose }: { sb: Storyboard; ids: string[]; data: Storyboards; onStart(): void; onClose(): void }) {
  const { t } = useI18n();
  const { balance, setSheet } = useStudio();
  const start = useRef<HTMLButtonElement>(null);
  const plans = ids.flatMap(id => trouverPlan(sb, id) ?? []);
  const devis = devisStoryboard(sb, data.ctxDevis, data.registre, plans.map(found => found.plan));
  const total = devis.total;
  const apres = balance && total !== null ? balance.credits - total : null;
  const court = apres !== null && apres < 0;
  useEffect(() => { start.current?.focus(); }, []);
  const label = (step: EtapeDevis, seconds: number) => step.type === "personnage" ? t("film2.etapePersonnage", { nom: step.nom })
    : step.type === "lieu" ? t("film2.etapeLieu", { nom: step.nom })
    : `${t("film2.etapePrise")} · ${t("storyboard.board.seconds", { n: String(seconds) })}`;
  const count = devis.plans.reduce((sum, plan) => sum + plan.etapes.length, 0);
  return <div className="sb-confirm-back" onClick={onClose}>
    <div className="sb-confirm" role="dialog" aria-modal="true" aria-labelledby="sb-confirm-title" data-sb-confirm="" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") onClose(); }}>
      <h2 id="sb-confirm-title" className="sb-serif">{plans.length === 1 ? t("film2.confirmTitle") : t("storyboard.confirm.titleN", { n: plans.length })}</h2>
      <p className="sb-small sb-muted">{plans.length === 1 ? (count > 1 ? t("film2.confirmLead", { n: String(count) }) : t("film2.confirmLead1")) : t("storyboard.confirm.lead")}</p>
      <ol className="sb-steps" data-sb-steps="">
        {plans.map(found => {
          const row = devis.plans.find(item => item.id === found.plan.id);
          return <li key={found.plan.id} style={{ display: "grid", gap: 2 }}>
            {plans.length > 1 && <strong className="sb-small">{t("storyboard.confirm.shotLine", { n: String(found.numero), title: found.plan.titre || t("storyboard.board.shot", { n: String(found.numero) }) })}</strong>}
            {(row?.etapes ?? []).map((step, index) => <span key={index} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>{label(step, found.plan.duree)}</span><span className="sb-mono">≈ {formatCredits(step.credits)}</span>
            </span>)}
            {row?.total === null && <span className="sb-small">{t("storyboard.board.noQuote")}</span>}
          </li>;
        })}
      </ol>
      <p className="sb-total"><strong>{t("film2.total")}</strong><strong className="sb-mono" data-sb-total="">{total === null ? t("storyboard.board.noQuote") : t("film2.credits", { n: formatCredits(total) })}</strong></p>
      <p className="sb-small sb-muted">{apres !== null ? t("film2.soldeApres", { n: apres < 0 ? `−${formatCredits(-apres)}` : formatCredits(apres) }) : t("film2.soldeInconnu")}</p>
      {court
        ? <button ref={start} type="button" className="sb-gold" data-sb-topup="" onClick={() => { onClose(); setSheet("credits"); }}>{t("storyboard.confirm.topUp")}</button>
        : total === null
          ? <p className="sb-small" role="status" data-sb-no-quote="">{t("storyboard.board.noQuote")}</p>
          : <button ref={start} type="button" className="sb-gold" data-sb-start="" onClick={onStart}><span>{t("film2.lancer")}</span><span className="sb-p">· ≈ {formatCredits(total)}</span></button>}
      <div className="sb-row"><button type="button" className="sb-out" data-sb-cancel="" onClick={onClose}>{t("film2.modifier")}</button></div>
    </div>
  </div>;
}
