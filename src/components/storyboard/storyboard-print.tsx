"use client";

// SB10 · /storyboard/<id>/print: A4 landscape, six shots per page, paper theme, then the browser's own
// « Print / Save as PDF ». Only pictures already on this device are shown: printing fetches nothing.

import { useI18n } from "@/components/i18n/provider";
import { tousLesPlans, type Storyboard } from "@/lib/storyboard/storyboard";
import { ShotThumb } from "./storyboard-ui";
import type { Storyboards } from "./use-storyboards";

export function StoryboardPrint({ sb, data, back }: { sb: Storyboard; data: Storyboards; back: string }) {
  const { t } = useI18n();
  const plans = tousLesPlans(sb);
  const pages: typeof plans[] = [];
  for (let i = 0; i < plans.length; i += 6) pages.push(plans.slice(i, i + 6));
  const scene = (id: string) => { const index = sb.sequences.findIndex(seq => seq.plans.some(plan => plan.id === id)); return { n: index + 1, titre: sb.sequences[index]?.titre ?? "" }; };
  return <div className="sb-print" data-sb-print-view="">
    <div className="sb-print-head">
      <a className="sb-ghost" href={back}><span aria-hidden="true">←&nbsp;</span>{t("storyboard.back")}</a>
      <h1 className="sb-serif">{t("storyboard.print.title", { title: sb.titre })}</h1>
      <div style={{ display: "grid", gap: 4, justifyItems: "end" }}>
        <button type="button" className="sb-gold" style={{ width: "auto" }} data-sb-print-go="" onClick={() => window.print()}>{t("storyboard.print.go")}</button>
        <span className="sb-small sb-faint">{t("storyboard.print.page")}</span>
      </div>
    </div>
    {pages.map((page, p) => <section key={p} className="sb-print-page" data-sb-print-page="">
      <header><strong className="sb-serif" style={{ fontSize: 18, color: "var(--sb-ink)" }}>{sb.titre}</strong><span className="sb-mono">{p + 1} / {pages.length}</span></header>
      {page.map((plan, i) => {
        const numero = p * 6 + i + 1;
        const s = scene(plan.id);
        return <article key={plan.id} className="sb-print-case">
          <ShotThumb plan={plan} numero={numero} data={data} kept="★" />
          <strong>{plan.titre || t("storyboard.board.shot", { n: String(numero) })}</strong>
          <span className="sb-faint sb-mono">{t("storyboard.board.scene", { n: String(s.n) })}{s.titre ? ` · ${s.titre}` : ""} · {[plan.cadrage ? t(`storyboard.sheet.cadrage.${plan.cadrage}`) : null, plan.camera ? t(`storyboard.sheet.cam.${plan.camera}`) : null, `${plan.duree} s`].filter(Boolean).join(" · ")}</span>
          {plan.action && <span>{plan.action}</span>}
          {plan.dialogue.type !== "aucune" && plan.dialogue.texte && <span className="sb-line">{t("storyboard.quoted", { text: plan.dialogue.texte })}</span>}
        </article>;
      })}
    </section>)}
  </div>;
}
