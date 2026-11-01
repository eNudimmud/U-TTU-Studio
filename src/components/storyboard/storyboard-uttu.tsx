"use client";

// Screen 4 · the Uttu column: where the board stands in one sentence, what Uttu just wrote (reused /
// created later, at most one question with the default already applied), a few suggestions with
// their cost, and plain corrections. Nothing here renders: only « Film everything » leads to « Start ».
// CE4 · U1: this column is the one conversation of the workspace; the scope of the selected shot sits
// next to the field (« Working on Shot 02 »).

import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { assetPath } from "@/lib/site";
import { devisStoryboard, plansATourner } from "@/lib/storyboard/devis";
import type { Question } from "@/lib/storyboard/ecrire";
import { dureeTotale, tousLesPlans, type DureeCible, type Format, type PlanSB, type Storyboard, type EtatPlan } from "@/lib/storyboard/storyboard";
import { IdeaBoxAgain } from "./storyboard-rewrite";
import type { Storyboards } from "./use-storyboards";

export interface Bulle { qui: "moi" | "uttu"; texte: string }
export interface Ecrit { idee: string; question: Question; repris: string[]; nouveaux: string[] }

function joindre(t: ReturnType<typeof useI18n>["t"], names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return t("storyboard.writer.and", { a: names.slice(0, -1).join(", "), b: names.at(-1)! });
}

export function UttuColumn({ sb, data, etat, bulles, ecrit, ecriture, scope, onCorrect, onAnswer, onOpenBoard, onRewrite, onFilmAll }: {
  sb: Storyboard; data: Storyboards; etat(plan: PlanSB): EtatPlan; bulles: Bulle[]; ecrit: Ecrit | null; ecriture: boolean; scope: number | null;
  onCorrect(text: string): void; onAnswer(question: NonNullable<Question>, value: string): void; onOpenBoard(): void;
  onRewrite(idee: string, cible: DureeCible, format: Format): Promise<boolean>; onFilmAll(): void;
}) {
  const { t } = useI18n();
  const [texte, setTexte] = useState("");
  const [nom, setNom] = useState("");
  const [reecrire, setReecrire] = useState(false);
  const plans = tousLesPlans(sb);
  const tournes = plans.filter(plan => etat(plan) === "tourne").length;
  const suivant = plans.findIndex(plan => etat(plan) !== "tourne");
  const reste = devisStoryboard(sb, data.ctxDevis, data.registre, plansATourner(sb, data.registre));
  const total = dureeTotale(sb);
  const filmed = tournes > 0;
  const send = () => { const value = texte.trim(); if (!value) return; onCorrect(value); setTexte(""); };
  const suggestion = (label: string, cost: string, action: () => void, key: string) =>
    <button key={key} type="button" className="sb-out" data-sb-suggest={key} onClick={action}><span>{label}</span><span className="sb-tag">{cost}</span></button>;
  const q = ecrit?.question ?? null;

  return <>
    <div className="sb-who sb-ws-who"><span className="sb-dot" aria-hidden="true"><img src={assetPath("/brand/uttu-mark-h48.png")} alt="" width={15} height={15} /></span>
      <span><h2 className="sb-serif">{t("storyboard.uttuName")}</h2><span className="sb-ws-meta">{t("storyboard.ws.director")}</span></span></div>
    <div className="sb-chat" aria-live="polite" data-sb-chat="">
      {ecrit && <>
        <p className="sb-me">{ecrit.idee}</p>
        <div className="sb-ut" data-sb-writer-reply="">
          <p>{t("storyboard.writer.reply", { shots: plans.length, scenes: sb.sequences.length, seconds: String(total) })}</p>
          {ecrit.repris.length > 0 && <p>{t("storyboard.writer.reuse", { names: joindre(t, ecrit.repris) })}</p>}
          {ecrit.nouveaux.length > 0 && <p>{t("storyboard.writer.create", { names: joindre(t, ecrit.nouveaux) })}</p>}
        </div>
        {q && <div className="sb-ask" data-sb-question={q.type}>
          <p className="sb-kicker">{t("storyboard.writer.oneQuestion")}</p>
          {q.type === "qui"
            ? <><p className="sb-small">{t("storyboard.writer.qWho")}</p><form className="sb-compose" onSubmit={event => { event.preventDefault(); if (nom.trim()) onAnswer(q, nom.trim()); }}>
                <label className="sr-only" htmlFor="sb-q-who">{t("storyboard.writer.qWho")}</label>
                <input id="sb-q-who" value={nom} maxLength={40} placeholder={t("storyboard.writer.qWhoPlaceholder")} onChange={event => setNom(event.target.value)} />
                <button type="submit" className="sb-out">{t("storyboard.writer.qWhoOk")}</button>
              </form></>
            : <>
                <p className="sb-small">{sb.format === "paysage" ? t("storyboard.writer.qFormat") : t("storyboard.writer.qFormatPortrait")}</p>
                <div className="sb-chips">
                  {(["paysage", "portrait"] as const).map(f => <button key={f} type="button" className="sb-chip" aria-pressed={sb.format === f} onClick={() => onAnswer(q, f)}>{t(`storyboard.format.${f}Ratio`)}</button>)}
                </div>
              </>}
        </div>}
        <button type="button" className="sb-out sb-ws-open-board" data-sb-open-board="" onClick={onOpenBoard}>{t("storyboard.ws.selectToRefine")}</button>
        {!filmed && <button type="button" className="sb-out" aria-expanded={reecrire} data-sb-rewrite="" onClick={() => setReecrire(open => !open)}>{t("storyboard.writer.rewrite")}</button>}
        {reecrire && !filmed && <IdeaBoxAgain idee={ecrit.idee} sb={sb} ecriture={ecriture} onRewrite={async (idee, cible, format) => { if (await onRewrite(idee, cible, format)) setReecrire(false); }} />}
        <p className="sb-small sb-faint">{t("storyboard.writer.note")}</p>
      </>}
      {!ecrit && <p className="sb-ut" data-sb-status="">{t("storyboard.uttu.status", { x: String(tournes), y: String(plans.length), next: suivant < 0 ? t("storyboard.uttu.allDone") : t("storyboard.uttu.nextFilm", { n: String(suivant + 1) }) })}</p>}
      {bulles.map((bulle, index) => <p key={index} className={bulle.qui === "moi" ? "sb-me" : "sb-ut"}>{bulle.texte}</p>)}
    </div>
    <div className="sb-sug">
      {total > sb.dureeCible + 4 && suggestion(t("storyboard.uttu.tighten", { n: String(sb.dureeCible) }), t("storyboard.uttu.noRenderTag"), () => onCorrect(t("storyboard.uttu.tighten", { n: String(sb.dureeCible) })), "tighten")}
      {suggestion(t("storyboard.uttu.addClosing"), t("storyboard.uttu.noRenderTag"), () => onCorrect(t("storyboard.uttu.addClosing")), "closing")}
      {sb.format === "paysage"
        ? suggestion(t("storyboard.uttu.toPortrait"), t("storyboard.uttu.noRenderTag"), () => onCorrect(t("storyboard.uttu.toPortrait")), "portrait")
        : suggestion(t("storyboard.uttu.toLandscape"), t("storyboard.uttu.noRenderTag"), () => onCorrect(t("storyboard.uttu.toLandscape")), "landscape")}
      {ecrit && suivant >= 0 && reste.total !== null && suggestion(t("storyboard.writer.filmEverything"), t("storyboard.board.filmAllPrice", { n: formatCredits(reste.total) }), onFilmAll, "film-all")}
    </div>
    <div className="sb-grow" />
    <form className="sb-ws-compose" onSubmit={event => { event.preventDefault(); send(); }}>
      <p className="sb-ws-scope" data-sb-scope="" aria-live="polite">{scope ? t("storyboard.ws.scope", { n: String(scope).padStart(2, "0") }) : t("storyboard.ws.scopeBoard")}</p>
      <label className="sb-ws-label" htmlFor="sb-ask">{t("storyboard.ws.describe")}</label>
      <textarea id="sb-ask" value={texte} maxLength={200} rows={3} placeholder={t("storyboard.uttu.ask")} data-sb-ask="" aria-describedby="sb-ask-hint"
        onChange={event => setTexte(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
      <p className="sr-only" id="sb-ask-hint">{t("storyboard.ws.askHint")}</p>
      <button type="submit" className="sb-out sb-ws-send" data-sb-send="" disabled={!texte.trim()}>{t("storyboard.uttu.send")}</button>
    </form>
  </>;
}
