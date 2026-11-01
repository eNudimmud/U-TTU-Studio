"use client";

// CE4 · U1 workspace (docs/architecture/UX_REVIEW.md, prototypes/uttu-cinema-u1.html): the shots of the board
// as one selectable strip, the selected shot large with its one-line caption, its actions and a « Context »
// disclosure (references by role, versions, engine and quote on demand). The Uttu column next to it is the
// only conversation. Nothing here renders by itself: « Film » goes through the existing confirmation; the
// keyframe step stays disabled until the cinema engine (CE1/CE3) is wired, and says so.

import { useId, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { devisPlan, plansATourner, devisStoryboard } from "@/lib/storyboard/devis";
import type { FileTournage } from "@/lib/storyboard/film";
import {
  ajouterPlan, deplacerPlan, dureeTotale, planVide, progression, retirerPlan, tousLesPlans, trouverPlan,
  type EtatPlan, type PlanSB, type RefPlan, type Storyboard,
} from "@/lib/storyboard/storyboard";
import { useStudio } from "../app/studio-session";
import { useRefPicture } from "./storyboard-ui";
import type { Storyboards } from "./use-storyboards";

const ENGINE = { fidele: "MiniMax H3", rapide: "LTX" } as const;
const pad = (n: number) => String(n).padStart(2, "0");

export interface WorkspaceProps {
  sb: Storyboard; data: Storyboards; etat(plan: PlanSB): EtatPlan; echecs: Record<string, string>;
  selectedId: string | null; onSelect(id: string): void; onOpen(id: string): void;
  onChange(next: Storyboard, label?: string): void; onFilm(id: string): void; newId(): string;
  file: FileTournage | null; enCours: string | null; connected: boolean; onFilmAll(ids: string[]): void;
}

/** The shot the workspace works on: the one chosen, or the first. */
export function planChoisi(sb: Storyboard, selectedId: string | null) {
  return (selectedId ? trouverPlan(sb, selectedId) : null) ?? (tousLesPlans(sb)[0] ? trouverPlan(sb, tousLesPlans(sb)[0]!.id) : null);
}

export function Workspace(props: WorkspaceProps) {
  const { sb, data, etat, echecs, selectedId, onSelect, onChange, newId } = props;
  const { t } = useI18n();
  const plans = tousLesPlans(sb);
  const found = planChoisi(sb, selectedId);
  const { tournes, total } = progression(sb, data.registre);
  const state = sb.archive ? t("storyboard.statut.archive") : tournes === 0 ? t("storyboard.statut.brouillon") : tournes === total ? t("storyboard.statut.tourne") : t("storyboard.statut.en-cours");
  return <div className="sb-ws" data-sb-workspace="">
    <div className="sb-ws-top">
      <h1 className="sb-serif sb-ws-title"><label className="sr-only" htmlFor="sb-title">{t("storyboard.board.titleLabel")}</label>
        <input id="sb-title" className="sb-head-title" value={sb.titre} maxLength={80} data-sb-title="" onChange={event => onChange({ ...sb, titre: event.target.value, majLe: new Date().toISOString() })} /></h1>
      <span className="sb-ws-meta" data-sb-filmed="">{[t("storyboard.board.seconds", { n: String(dureeTotale(sb)) }), sb.format === "portrait" ? "9:16" : "16:9", state, tournes > 0 ? t("storyboard.board.filmed", { x: String(tournes), y: String(total) }) : null].filter(Boolean).join(" · ")}</span>
    </div>
    <div className="sb-ws-shots" role="group" aria-label={t("storyboard.ws.selectShot")} data-sb-strip="">
      {plans.map((plan, index) => <ShotTile key={plan.id} plan={plan} numero={index + 1} data={data} etat={etat(plan)} echec={echecs[plan.id] ?? null} selected={found?.plan.id === plan.id} onSelect={onSelect} />)}
      {sb.sequences.length > 0 && <button type="button" className="sb-ws-add" data-sb-add={sb.sequences.at(-1)!.id} onClick={() => {
        const last = sb.sequences.at(-1);
        if (!last) return;
        const id = newId();
        onChange(ajouterPlan(sb, last.id, planVide(id, sb.format)));
        onSelect(id);
      }}>{t("storyboard.board.addShot")}</button>}
    </div>
    {found
      ? <Selected {...props} found={found} total={plans.length} />
      : <p className="sb-notice" role="status">{t("storyboard.ws.noShot")}</p>}
    <Dock {...props} />
  </div>;
}

function ShotTile({ plan, numero, data, etat, echec, selected, onSelect }: { plan: PlanSB; numero: number; data: Storyboards; etat: EtatPlan; echec: string | null; selected: boolean; onSelect(id: string): void }) {
  const { t } = useI18n();
  const { media } = useStudio();
  const hit = data.priseDuPlan(plan);
  const poster = hit?.take?.poster ? media[hit.take.poster] ?? "" : "";
  const tag = etat === "tourne" ? " is-ok" : etat === "en-cours" ? " is-gold" : etat === "echec" ? " is-fail" : "";
  return <button type="button" className={`sb-ws-shot${poster ? " has-still" : ""}`} aria-pressed={selected} data-sb-shot={plan.id} data-sb-etat={etat} data-sb-select={plan.id}
    title={echec ?? undefined} onClick={() => onSelect(plan.id)}>
    {poster && <img className="sb-ws-still" src={poster} alt="" loading="lazy" decoding="async" />}
    <span className="sb-ws-num">{pad(numero)}</span>
    <span className="sb-ws-name">{plan.titre || t("storyboard.board.shot", { n: String(numero) })}</span>
    <span className="sb-ws-dur">{plan.duree} s · <span className={`sb-ws-state${tag}`}>{t(`storyboard.board.etat.${etat}`)}</span></span>
    {plan.dialogue.type !== "aucune" && plan.dialogue.texte && <span className="sr-only" data-sb-line="">{t("storyboard.quoted", { text: plan.dialogue.texte })}</span>}
  </button>;
}

function names(refs: readonly RefPlan[]): string {
  return refs.map(ref => ref.nom.trim()).filter(Boolean).join(", ");
}

function Selected({ sb, data, etat, echecs, onSelect, onOpen, onChange, onFilm, newId, found, total, connected }: WorkspaceProps & { found: NonNullable<ReturnType<typeof trouverPlan>>; total: number }) {
  const { t } = useI18n();
  const { media } = useStudio();
  const picture = useRefPicture();
  const [context, setContext] = useState(false);
  const [menu, setMenu] = useState(false);
  const uid = useId();
  const { plan, sequence } = found;
  const numero = tousLesPlans(sb).findIndex(item => item.id === plan.id) + 1;
  const state = etat(plan);
  const echec = echecs[plan.id] ?? null;
  const hit = data.priseDuPlan(plan);
  const poster = hit?.take?.poster ? media[hit.take.poster] ?? "" : "";
  const devis = devisPlan(plan, data.ctxDevis).total;
  const qui = plan.refs.filter(ref => ref.role === "qui");
  const ou = plan.refs.filter(ref => ref.role === "ou");
  const autres = plan.refs.filter(ref => ref.role === "objet" || ref.role === "style");
  const manquantes = plan.refs.filter(ref => (ref.role === "qui" || ref.role === "ou") && (!ref.id || !picture(ref)));
  const prises = hit?.film.prises.length ?? (plan.planFilmId ? data.registre.plans.find(item => item.id === plan.planFilmId)?.prises.length ?? 0 : 0);
  const caption = [
    qui.length ? names(qui) : null,
    ou.length ? names(ou) : null,
    plan.cadrage ? t(`storyboard.sheet.cadrage.${plan.cadrage}`) : null,
    plan.camera ? t(`storyboard.sheet.cam.${plan.camera}`) : null,
    t(`storyboard.board.etat.${state}`),
  ].filter(Boolean).join(" · ");
  const at = (ref: RefPlan) => `@${ref.nom.trim()}${ref.id ? "" : ` (${t("storyboard.ws.notInProject")})`}`;
  const portrait = plan.format === "portrait";
  const contextId = `${uid}-context`;
  const pendingId = `${uid}-pending`;
  const doDuplicate = () => {
    const id = newId();
    const { id: _old, planFilmId: _film, etat: _etat, ...rest } = plan;
    onChange(ajouterPlan(sb, sequence.id, { ...planVide(id, plan.format), ...rest, titre: plan.titre, planFilmId: null, etat: "a-tourner" }, plan.id), t("storyboard.ws.duplicated", { n: String(numero) }));
    onSelect(id);
    setMenu(false);
  };
  return <section className="sb-ws-sel" aria-labelledby={`${uid}-title`} data-sb-selected={plan.id}>
    <div className={`sb-ws-frame${portrait ? " is-portrait" : ""}${poster ? " has-still" : ""}`} aria-live="polite" data-sb-frame="">
      {poster
        ? <><img src={poster} alt={t("storyboard.ws.keptStill", { n: pad(numero) })} decoding="async" /><span className="sb-ws-badge">{t("storyboard.ws.shotLabel", { n: pad(numero) })} · {t("storyboard.board.kept")}</span></>
        : <div><small>{t("storyboard.ws.shotLabel", { n: pad(numero) })}</small><strong id={`${uid}-title`}>{plan.titre || t("storyboard.board.shot", { n: String(numero) })}</strong><small>{t("storyboard.ws.keyframeHere")}</small></div>}
      {poster && <span className="sr-only" id={`${uid}-title`}>{plan.titre || t("storyboard.board.shot", { n: String(numero) })}</span>}
    </div>
    <p className="sb-ws-caption" data-sb-caption="">{caption}</p>
    {plan.action && <p className="sb-ws-action" data-sb-action="">{plan.action}</p>}
    {echec && <p className="sb-notice is-fail" role="status">{echec}</p>}
    <div className="sb-ws-actions">
      <button type="button" className="sb-ws-primary" disabled aria-describedby={pendingId} data-sb-keyframe="">{t("storyboard.ws.prepareKeyframe")}</button>
      {state === "en-cours"
        ? <span className="sb-ws-est" role="status">{t("storyboard.board.etat.en-cours")}</span>
        : devis === null
          ? <span className="sb-ws-est" data-sb-no-quote={plan.id}>{t("storyboard.ws.estimateUnavailable")}</span>
          : <button type="button" className="sb-out is-gold" data-sb-film={plan.id} aria-label={t("storyboard.board.filmTitle", { n: formatCredits(devis) })} onClick={() => onFilm(plan.id)}>
            {connected ? t("storyboard.board.film", { n: formatCredits(devis) }) : t("storyboard.board.connect")}</button>}
      <button type="button" className="sb-out" data-sb-open={plan.id} aria-label={t("storyboard.board.open", { n: String(numero) })} onClick={() => onOpen(plan.id)}>{state === "tourne" ? t("storyboard.board.takes", { n: String(prises) }) : t("storyboard.ws.edit")}</button>
      <button type="button" className="sb-out" aria-expanded={context} aria-controls={contextId} data-sb-context-toggle="" onClick={() => setContext(open => !open)}>{context ? t("storyboard.ws.closeContext") : t("storyboard.ws.context")}</button>
      <span className="sb-ws-menu-wrap">
        <button type="button" className="sb-out" aria-expanded={menu} data-sb-shot-menu="" onClick={() => setMenu(open => !open)}>{t("storyboard.ws.shotMenu")}</button>
        {menu && <span className="sb-menu sb-ws-menu" role="group" aria-label={t("storyboard.ws.shotMenu")}>
          {numero > 1 && <button type="button" className="sb-ghost" aria-label={t("storyboard.board.moveUp", { n: String(numero) })} data-sb-move-up="" onClick={() => onChange(deplacerPlan(sb, plan.id, -1))}>↑ {t("storyboard.ws.moveEarlier")}</button>}
          {numero < total && <button type="button" className="sb-ghost" aria-label={t("storyboard.board.moveDown", { n: String(numero) })} data-sb-move-down="" onClick={() => onChange(deplacerPlan(sb, plan.id, 1))}>↓ {t("storyboard.ws.moveLater")}</button>}
          <button type="button" className="sb-ghost" data-sb-duplicate="" onClick={doDuplicate}>{t("storyboard.ws.duplicate")}</button>
          {state !== "en-cours" && <button type="button" className="sb-ghost" data-sb-remove="" onClick={() => {
            const rest = tousLesPlans(sb).filter(item => item.id !== plan.id);
            onChange(retirerPlan(sb, plan.id), t("storyboard.board.removed"));
            const next = rest[Math.min(numero - 1, rest.length - 1)];
            if (next) onSelect(next.id);
            setMenu(false);
          }}>{t("storyboard.board.remove", { n: String(numero) })}</button>}
        </span>}
      </span>
    </div>
    <p className="sb-ws-pending" id={pendingId}>{t("storyboard.ws.keyframePending")}</p>
    <section id={contextId} className="sb-ws-context" hidden={!context} data-sb-context="" aria-label={t("storyboard.ws.plannedRefs")}>
      <h3>{t("storyboard.ws.plannedRefs")}</h3>
      <dl>
        <dt>{t("storyboard.ws.characters")}</dt><dd data-sb-ctx-cast="">{qui.length ? qui.map(at).join(" · ") : t("storyboard.ws.none")}</dd>
        <dt>{t("storyboard.ws.environment")}</dt><dd data-sb-ctx-place="">{ou.length ? ou.map(at).join(" · ") : t("storyboard.ws.none")}</dd>
        <dt>{t("storyboard.ws.objectStyle")}</dt><dd>{autres.length ? autres.map(at).join(" · ") : t("storyboard.ws.none")}</dd>
        <dt>{t("storyboard.ws.versions")}</dt><dd data-sb-ctx-versions="">{prises ? t("storyboard.ws.takes", { n: prises }) : t("storyboard.ws.noTake")} · {t("storyboard.ws.originals")}</dd>
        <dt>{t("storyboard.ws.engine")}</dt><dd>{ENGINE[plan.rendu]} · {devis === null ? t("storyboard.ws.estimateUnavailable") : t("storyboard.board.filmAllPrice", { n: formatCredits(devis) })}</dd>
        <dt>{t("storyboard.ws.scene")}</dt><dd>{sequence.titre || t("storyboard.board.scene", { n: String(sb.sequences.indexOf(sequence) + 1) })}</dd>
      </dl>
      {manquantes.length > 0 && <p className="sb-ws-missing" role="note" data-sb-ctx-missing="">
        {t("storyboard.ws.missing", { names: manquantes.map(ref => `@${ref.nom.trim()}`).join(", ") })}
        <button type="button" className="sb-ghost" onClick={() => onOpen(plan.id)}>{t("storyboard.ws.fixInShot")}</button>
      </p>}
      <button type="button" className="sb-ghost" onClick={() => setContext(false)}>{t("storyboard.ws.closeContext")}</button>
    </section>
  </section>;
}

function Dock({ sb, data, file, enCours, connected, onFilmAll }: WorkspaceProps) {
  const { t } = useI18n();
  const plans = plansATourner(sb, data.registre);
  const devis = devisStoryboard(sb, data.ctxDevis, data.registre, plans);
  if (file && enCours) {
    const i = file.faits.length + file.echecs.length + 1;
    const n = i + file.restants.length;
    return <div className="sb-ws-dock" data-sb-dock=""><p className="sb-notice" role="status" data-sb-queue="">{t("storyboard.board.queue", { i: String(i), n: String(n) })}</p></div>;
  }
  if (!plans.length) return <div className="sb-ws-dock" data-sb-dock=""><p className="sb-notice" role="status">{t("storyboard.board.allFilmed")}</p></div>;
  return <div className="sb-ws-dock" data-sb-dock="">
    {connected && devis.total === null
      ? <p className="sb-notice" role="status" data-sb-no-quote="">{t("storyboard.ws.estimateUnavailable")}</p>
      : <button type="button" className="sb-out sb-ws-all" data-sb-film-all="" onClick={() => onFilmAll(plans.map(plan => plan.id))}>
        {connected && devis.total !== null
          ? <><span>{t("storyboard.board.filmAll", { n: plans.length })}</span><span className="sb-p">{t("storyboard.board.filmAllPrice", { n: formatCredits(devis.total) })}</span></>
          : <span>{t("storyboard.board.connect")}</span>}
      </button>}
    <p className="sb-dock-under">{t("storyboard.board.filmAllNote")}</p>
  </div>;
}
