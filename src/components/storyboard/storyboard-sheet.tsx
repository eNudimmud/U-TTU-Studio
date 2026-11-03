"use client";

// Screen 3 · the shot sheet: everything about one shot in one place. Every change is saved as it is
// made; only the gold « Film this shot · ≈ X » leads to a render, through the one confirmation.

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { CAMERAS, RENDUS } from "@/lib/film/reglages";
import { devisPlan, reglagesDuPlan } from "@/lib/storyboard/devis";
import { promptCalcule, promptDuPlan } from "@/lib/storyboard/prompt";
import {
  CADRAGES, DUREES_PLAN, QUI_MAX, REPLIQUE_MAX, choisirProposition, ecrireReplique, majPlan,
  type EtatPlan, type PlanSB, type RefPlan, type Storyboard, type trouverPlan,
} from "@/lib/storyboard/storyboard";
import { useStudio } from "../app/studio-session";
import { useRefPicture } from "./storyboard-ui";
import type { Storyboards } from "./use-storyboards";

type Found = NonNullable<ReturnType<typeof trouverPlan>>;

const ENGINE = { fidele: "MiniMax H3", rapide: "LTX" } as const;

export function StoryboardSheet({ sb, found, data, etat, echec, onClose, onChange, onFilm, onKeep, onRemove }: {
  sb: Storyboard; found: Found; data: Storyboards; etat: EtatPlan; echec: string | null;
  onClose(): void; onChange(next: Storyboard): void; onFilm(): void; onKeep(priseId: string): void; onRemove(): void;
}) {
  const { t } = useI18n();
  const { studio, media, connected } = useStudio();
  const picture = useRefPicture();
  const { plan, sequence, numero } = found;
  const titre = useRef<HTMLInputElement>(null);
  const [ajoutQui, setAjoutQui] = useState("");
  const [ajoutObjet, setAjoutObjet] = useState("");
  const [ecrireMien, setEcrireMien] = useState(plan.dialogue.source === "visiteur");
  const total = sb.sequences.reduce((sum, seq) => sum + seq.plans.length, 0);
  const patch = (value: Partial<Omit<PlanSB, "id">>) => onChange(majPlan(sb, plan.id, value));
  const filmed = etat === "tourne" || etat === "en-cours";
  const devis = devisPlan(plan, data.ctxDevis);
  const qui = plan.refs.filter(ref => ref.role === "qui");
  const ou = plan.refs.find(ref => ref.role === "ou") ?? null;
  const autres = plan.refs.filter(ref => ref.role === "objet" || ref.role === "style");
  const cast = studio.cast;
  const lieux = studio.scenes;
  const film = plan.planFilmId ? data.registre.plans.find(item => item.id === plan.planFilmId) ?? null : null;
  const prises = film?.prises ?? [];

  useEffect(() => { titre.current?.focus(); }, [plan.id]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const setRefs = (refs: RefPlan[]) => patch({ refs });
  const ajouterQui = (nom: string) => {
    const value = nom.trim();
    if (!value) return;
    const known = cast.find(card => card.name.trim().toLowerCase() === value.toLowerCase());
    setRefs([...plan.refs, { role: "qui", nom: known?.name ?? value, id: known?.id ?? null }]);
    setAjoutQui("");
  };
  const choisirLieu = (nom: string) => {
    const value = nom.trim();
    const known = lieux.find(scene => scene.name.trim().toLowerCase() === value.toLowerCase());
    const rest = plan.refs.filter(ref => ref.role !== "ou");
    setRefs(value ? [...rest, { role: "ou", nom: known?.name ?? value, id: known?.id ?? null }] : rest);
  };
  const retirerRef = (ref: RefPlan) => setRefs(plan.refs.filter(item => item !== ref));
  const prixDuree = (duree: number) => data.prixPrise(reglagesDuPlan({ ...plan, duree: duree as PlanSB["duree"] }));
  const prixRendu = (rendu: PlanSB["rendu"]) => data.prixPrise(reglagesDuPlan({ ...plan, rendu }));
  const settings = reglagesDuPlan(plan);
  const sourceLabel = plan.dialogue.source === "uttu" ? t("storyboard.sheet.suggested") : plan.dialogue.source === "idee" ? t("storyboard.sheet.fromIdea") : t("storyboard.sheet.editable");
  const stepNames = devis.etapes.map(step => step.type === "personnage" ? t("film2.etapePersonnage", { nom: step.nom }) : step.type === "lieu" ? t("film2.etapeLieu", { nom: step.nom }) : t("film2.etapePrise"));

  const slot = (ref: RefPlan, sub: string) => {
    const src = picture(ref);
    return <div key={`${ref.role}:${ref.nom}`} className={`sb-slot${ref.id ? "" : " is-new"}`} data-sb-ref={ref.role}>
      {src ? <img src={src} alt="" /> : <span className="sb-ph" aria-hidden="true">{ref.nom.slice(0, 1).toUpperCase()}</span>}
      <span><strong>{ref.nom}</strong><em>{ref.id ? sub : t("storyboard.sheet.newRef")}</em></span>
      {!filmed && <button type="button" className="sb-x" aria-label={t("storyboard.sheet.removeRef", { nom: ref.nom })} onClick={() => retirerRef(ref)}>×</button>}
    </div>;
  };

  return <div className="sb-veil" onClick={onClose}>
    <section className="sb-sheet" role="dialog" aria-modal="true" aria-labelledby="sb-sheet-title" data-sb-sheet={plan.id} onClick={event => event.stopPropagation()}>
      <header className="sb-sheet-hd">
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="sb-kicker">{t("storyboard.sheet.where", { s: String(sb.sequences.indexOf(sequence) + 1), scene: sequence.titre, n: String(numero), total: String(total) })}</p>
          <label className="sr-only" htmlFor="sb-sheet-title">{t("storyboard.sheet.shotTitle")}</label>
          <input ref={titre} id="sb-sheet-title" className="sb-input sb-serif sb-title-input" value={plan.titre} maxLength={80} placeholder={t("storyboard.board.shot", { n: String(numero) })} onChange={event => patch({ titre: event.target.value })} />
        </div>
        <button type="button" className="sb-x" aria-label={t("storyboard.sheet.close")} data-sb-close="" onClick={onClose}>×</button>
      </header>

      <div className="sb-grp">
        <label className="sb-label" htmlFor="sb-action">{t("storyboard.sheet.what")}</label>
        <textarea id="sb-action" className="sb-field" rows={3} maxLength={240} value={plan.action} onChange={event => patch({ action: event.target.value })} />
      </div>

      <div className="sb-grp">
        <p className="sb-label">{t("storyboard.sheet.references")} <span className="sb-faint">· {t("storyboard.sheet.refsMax", { n: "7" })}</span></p>
        <div className="sb-slots">
          {qui.map(ref => slot(ref, t("storyboard.sheet.fromCast")))}
          {ou && slot(ou, t("storyboard.sheet.fromPlaces"))}
          {autres.map(ref => slot(ref, t("storyboard.sheet.objectStyle")))}
        </div>
        {!filmed && <div className="sb-two">
          {qui.length < QUI_MAX && <form className="sb-compose" onSubmit={event => { event.preventDefault(); ajouterQui(ajoutQui); }}>
            <label className="sr-only" htmlFor="sb-add-who">{t("storyboard.sheet.addWho")}</label>
            <input id="sb-add-who" list="sb-cast-names" value={ajoutQui} maxLength={40} placeholder={t("storyboard.sheet.addWho")} onChange={event => setAjoutQui(event.target.value)} />
            <datalist id="sb-cast-names">{cast.map(card => <option key={card.id} value={card.name} />)}</datalist>
            <button type="submit" className="sb-out">{t("storyboard.sheet.addRef")}</button>
          </form>}
          <form className="sb-compose" onSubmit={event => { event.preventDefault(); const input = event.currentTarget.elements.namedItem("ou") as HTMLInputElement; choisirLieu(input.value); input.value = ""; }}>
            <label className="sr-only" htmlFor="sb-add-where">{t("storyboard.sheet.addWhere")}</label>
            <input id="sb-add-where" name="ou" list="sb-place-names" maxLength={60} placeholder={ou?.nom ?? t("storyboard.sheet.addWhere")} />
            <datalist id="sb-place-names">{lieux.map(scene => <option key={scene.id} value={scene.name} />)}</datalist>
            <button type="submit" className="sb-out">{t("storyboard.sheet.addRef")}</button>
          </form>
          <form className="sb-compose" onSubmit={event => { event.preventDefault(); if (ajoutObjet.trim()) { setRefs([...plan.refs, { role: "objet", nom: ajoutObjet.trim(), id: null }]); setAjoutObjet(""); } }}>
            <label className="sr-only" htmlFor="sb-add-object">{t("storyboard.sheet.objectStyle")}</label>
            <input id="sb-add-object" value={ajoutObjet} maxLength={60} placeholder={t("storyboard.sheet.objectStyle")} onChange={event => setAjoutObjet(event.target.value)} />
            <button type="submit" className="sb-out">{t("storyboard.sheet.addRef")}</button>
          </form>
        </div>}
      </div>

      <div className="sb-grp sb-dlg" data-sb-dialogue="">
        <p className="sb-label">{t("storyboard.sheet.dialogue")}{plan.dialogue.texte && <span className="sb-tag is-gold">{sourceLabel}</span>}</p>
        <div className="sb-chips" role="group" aria-label={t("storyboard.sheet.dialogue")}>
          {(["aucune", "replique", "voixoff"] as const).map(type => <button key={type} type="button" className="sb-chip" aria-pressed={plan.dialogue.type === type} onClick={() => patch({ dialogue: { ...plan.dialogue, type } })}>{t(`storyboard.sheet.paroles.${type}`)}</button>)}
        </div>
        {plan.dialogue.type !== "aucune" && <>
          {plan.dialogue.type === "replique" && qui.length > 0 && <label className="sb-label">{t("storyboard.sheet.speaker")}
            <select className="sb-field" value={plan.dialogue.qui ?? ""} onChange={event => patch({ dialogue: { ...plan.dialogue, qui: event.target.value || null } })}>
              <option value="">—</option>
              {qui.map(ref => <option key={ref.nom} value={ref.nom}>{ref.nom}</option>)}
            </select>
          </label>}
          {plan.dialogue.propositions.length > 0 && !ecrireMien && <div className="sb-props" role="radiogroup" aria-label={t("storyboard.sheet.lineLabel")}>
            {plan.dialogue.propositions.map((texte, index) => <button key={index} type="button" role="radio" className="sb-prop" aria-checked={plan.dialogue.texte === texte} onClick={() => onChange(choisirProposition(sb, plan.id, index))}>{t("storyboard.quoted", { text: texte })}</button>)}
          </div>}
          {(ecrireMien || plan.dialogue.propositions.length === 0)
            ? <label className="sb-label">{t("storyboard.sheet.lineLabel")}
                <textarea className="sb-field sb-line" rows={2} maxLength={REPLIQUE_MAX} value={plan.dialogue.texte} placeholder={t("storyboard.sheet.linePlaceholder")} data-sb-line-input="" onChange={event => onChange(ecrireReplique(sb, plan.id, event.target.value))} />
                <span className="sb-faint sb-mono">{plan.dialogue.texte.length} / {REPLIQUE_MAX}</span>
              </label>
            : <button type="button" className="sb-ghost" data-sb-write-own="" onClick={() => setEcrireMien(true)}>{t("storyboard.sheet.writeOwn")}</button>}
        </>}
      </div>

      <div className="sb-grp">
        <p className="sb-label">{t("storyboard.sheet.framing")}</p>
        <div className="sb-chips">{CADRAGES.map(c => <button key={c} type="button" className="sb-chip" aria-pressed={plan.cadrage === c} onClick={() => patch({ cadrage: plan.cadrage === c ? null : c })}>{t(`storyboard.sheet.cadrage.${c}`)}</button>)}</div>
        <p className="sb-label">{t("storyboard.sheet.camera")}</p>
        <div className="sb-chips">{CAMERAS.map(c => <button key={c} type="button" className="sb-chip" aria-pressed={plan.camera === c} onClick={() => patch({ camera: plan.camera === c ? null : c })}>{t(`storyboard.sheet.cam.${c}`)}</button>)}</div>
        <p className="sb-label">{t("storyboard.sheet.length")}</p>
        <div className="sb-chips">{DUREES_PLAN.map(d => { const prix = prixDuree(d); return <button key={d} type="button" className="sb-chip" aria-pressed={plan.duree === d} aria-describedby="sb-no-quote-why" disabled={prix === null} onClick={() => patch({ duree: d })}>{t("storyboard.board.seconds", { n: String(d) })}{prix !== null && <span className="sb-faint"> · ≈ {formatCredits(prix)}</span>}</button>; })}</div>
        <p className="sb-label">{t("storyboard.sheet.render")}</p>
        <div className="sb-chips">{RENDUS.slice().reverse().map(r => { const prix = prixRendu(r); return <button key={r} type="button" className="sb-chip" aria-pressed={plan.rendu === r} aria-describedby="sb-no-quote-why" disabled={prix === null} onClick={() => patch({ rendu: r })}>{t(`storyboard.sheet.rendu.${r}`)}{prix !== null && <span className="sb-faint"> · ≈ {formatCredits(prix)}</span>}</button>; })}</div>
        {(DUREES_PLAN.some(d => prixDuree(d) === null) || RENDUS.some(r => prixRendu(r) === null)) && <p id="sb-no-quote-why" className="sb-small sb-muted">{t("storyboard.board.noQuote")}</p>}
        {numero > 1 && <label className="sb-check"><input type="checkbox" checked={plan.raccord} onChange={event => patch({ raccord: event.target.checked })} />{t("storyboard.sheet.raccord")}</label>}
      </div>

      <div className="sb-grp">
        <p className="sb-label">{t("storyboard.sheet.sound")}</p>
        <div className="sb-two">
          <label className="sb-label">{t("storyboard.sheet.music")}<input className="sb-field" maxLength={120} value={plan.son.musique} onChange={event => patch({ son: { ...plan.son, musique: event.target.value } })} /></label>
          <label className="sb-label">{t("storyboard.sheet.ambience")}<input className="sb-field" maxLength={120} value={plan.son.ambiance} onChange={event => patch({ son: { ...plan.son, ambiance: event.target.value } })} /></label>
        </div>
      </div>

      <div className="sb-grp" data-sb-takes="">
        <p className="sb-label">{t("storyboard.sheet.takes")}</p>
        {prises.length === 0
          ? <p className="sb-small sb-muted">{t("storyboard.sheet.noTake")}</p>
          : <div className="sb-takes">{prises.map(prise => {
              const take = studio.takes.find(item => item.id === prise.id);
              const poster = take?.poster ? media[take.poster] ?? null : null;
              return <div key={prise.id} className="sb-take">
                <span className="sb-thumb" aria-hidden="true">{poster && <img src={poster} alt="" />}</span>
                {prise.garde ? <span className="sb-tag is-gold">{t("storyboard.sheet.keptTake")}</span>
                  : <button type="button" className="sb-out" onClick={() => onKeep(prise.id)}>{t("storyboard.sheet.keep")}</button>}
              </div>;
            })}</div>}
      </div>

      <details className="sb-grp sb-sent-box" data-sb-sent="">
        <summary className="sb-label">{t("storyboard.sheet.sent")}</summary>
        <p className="sb-faint sb-mono">{t("storyboard.sheet.sentMeta", { engine: ENGINE[plan.rendu], s: String(settings.seconds), ratio: plan.format === "portrait" ? "9:16" : "16:9", refs: Math.min(plan.refs.length, 7) })}</p>
        <label className="sr-only" htmlFor="sb-prompt">{t("storyboard.sheet.sentEdit")}</label>
        <textarea id="sb-prompt" className="sb-field sb-sent" rows={4} maxLength={600} value={promptDuPlan(plan)} onChange={event => patch({ promptManuel: event.target.value === promptCalcule(plan) ? null : event.target.value })} />
        {plan.promptManuel && <button type="button" className="sb-ghost" onClick={() => patch({ promptManuel: null })}>{t("storyboard.sheet.sentReset")}</button>}
      </details>

      {etat !== "en-cours" && <button type="button" className="sb-ghost" data-sb-remove-shot="" onClick={onRemove}>{t("storyboard.sheet.delete")}</button>}

      {echec && <p className="sb-small" role="alert" style={{ color: "var(--sb-bad)" }}>{t("film2.erreur", { raison: echec })}</p>}

      <footer className="sb-foot">
        {!connected
          ? <button type="button" className="sb-gold" data-sb-sheet-film="" onClick={onFilm}>{t("storyboard.board.connect")}</button>
          : etat === "en-cours"
            ? <p className="sb-small" role="status">{t("storyboard.board.etat.en-cours")}</p>
            : devis.total === null
              ? <p className="sb-small" role="status" data-sb-no-quote="">{t("storyboard.board.noQuote")}</p>
              : <button type="button" className="sb-gold" data-sb-sheet-film="" onClick={onFilm}>
                <span>{etat === "tourne" ? t("storyboard.sheet.newTake") : t("storyboard.sheet.filmThis")}</span><span className="sb-p">· ≈ {formatCredits(devis.total)}</span>
              </button>}
        {devis.total !== null && etat !== "en-cours" && <p className="sb-foot-under">{t("storyboard.sheet.steps", { n: devis.etapes.length, list: stepNames.join(" · ") })}</p>}
      </footer>
    </section>
  </div>;
}
