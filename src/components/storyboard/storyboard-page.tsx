"use client";

// SB5–SB10 · The storyboard page (« Papier »): the list of the project's storyboards, one board with its
// scenes and shot cards, the shot sheet, the Uttu column, the confirmation before anything is filmed and
// the print view. The studio's session does the work (vault, Comfy link, quotes, PRISE); nothing here
// renders without one « Start ».

import { useMessages } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { ajouterPlan as ajouterPlanFilm, ajouterPrise, auMontage, garderPrise, nouveauPlan } from "@/lib/film/registre";
import { assetPath } from "@/lib/site";
import { appliquerCorrection, lireCorrection, type Correction } from "@/lib/storyboard/corriger";
import { devisPlan, devisStoryboard, plansATourner, reglagesDuPlan } from "@/lib/storyboard/devis";
import { definirPersonnage, ecrireStoryboard, type Gabarits, type Question } from "@/lib/storyboard/ecrire";
import { fileVide, finDuPlan, suivantDeLaFile, versPlanFilm, type FileTournage } from "@/lib/storyboard/film";
import {
  ajouterPlan, archiver, changerFormat, cheminMarkdown, deplacerPlan, dureeTotale, etatDuPlan, filtrer, majPlan, planVide,
  progression, retirerPlan, tousLesPlans, trouverPlan, type DureeCible, type Filtre, type Format, type PlanSB, type Storyboard,
} from "@/lib/storyboard/storyboard";
import { ConnectSheet, CreditSheet } from "../app/studio-frames";
import { useStudio } from "../app/studio-session";
import { StoryboardConfirm } from "./storyboard-confirm";
import { StoryboardPrint } from "./storyboard-print";
import { StoryboardSheet } from "./storyboard-sheet";
import { RefAvatars, ShotThumb } from "./storyboard-ui";
import { UttuColumn, type Bulle, type Ecrit } from "./storyboard-uttu";
import { useStoryboards, type Storyboards } from "./use-storyboards";

const FILTRES: Filtre[] = ["tous", "en-cours", "tournes", "archives"];
const nouvelIdCourt = () => Math.random().toString(36).slice(2, 8);

function adresse(id: string | null, print = false) {
  return assetPath(id ? `/storyboard/${id}${print ? "/print" : ""}` : "/storyboard");
}

export function StoryboardPage({ initialId, print }: { initialId: string | null; print: boolean }) {
  const studio = useStudio();
  const { t } = useI18n();
  const messages = useMessages() as unknown as { storyboard: { gabarits: Gabarits } };
  const data = useStoryboards();
  const { studio: vault, balance, connected, sheet, setSheet, run, runOrigin } = studio;
  const [currentId, setCurrentId] = useState<string | null>(initialId);
  const [vue, setVue] = useState<"board" | "uttu">("board");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [aConfirmer, setAConfirmer] = useState<string[] | null>(null);
  const [file, setFile] = useState<FileTournage | null>(null);
  const [echecs, setEchecs] = useState<Record<string, string>>({});
  const [annuler, setAnnuler] = useState<{ sb: Storyboard; label: string } | null>(null);
  const [bulles, setBulles] = useState<Record<string, Bulle[]>>({});
  const [ecrits, setEcrits] = useState<Record<string, Ecrit>>({});
  const [ecriture, setEcriture] = useState(false);
  const [ideeInitiale, setIdeeInitiale] = useState("");

  // Address ↔ page without a server round trip; the back button works.
  useEffect(() => {
    const back = () => {
      const match = /\/storyboard(?:\/([a-z0-9-]+))?/.exec(window.location.pathname);
      setCurrentId(match?.[1] ?? null);
      setOuvert(null);
    };
    window.addEventListener("popstate", back);
    try { setIdeeInitiale(new URLSearchParams(window.location.search).get("idee")?.slice(0, 240) ?? ""); } catch { /* no address */ }
    return () => window.removeEventListener("popstate", back);
  }, []);
  const aller = useCallback((id: string | null) => {
    setCurrentId(id);
    setOuvert(null);
    try { window.history.pushState(null, "", adresse(id)); } catch { /* sandboxed */ }
    window.scrollTo({ top: 0 });
  }, []);

  const sb = currentId ? data.boards[currentId] ?? null : null;
  const known = useMemo(() => ({
    cast: vault.cast.filter(card => card.sheet || card.photos.length).map(card => ({ id: card.id, name: card.name })),
    decor: vault.scenes.map(scene => ({ id: scene.id, name: scene.name })),
  }), [vault.cast, vault.scenes]);

  const dire = useCallback((id: string, bulle: Bulle) => setBulles(all => ({ ...all, [id]: [...(all[id] ?? []), bulle].slice(-30) })), []);

  // ---- writing (Uttu writes from one sentence: no model, no credit) ----
  const ecrire = useCallback(async (idee: string, dureeCible: DureeCible, format: Format, formatChoisi: boolean, remplace?: Storyboard) => {
    if (!idee.trim()) return false;
    setEcriture(true);
    const res = ecrireStoryboard(idee, known, {
      dureeCible, format, formatChoisi, gabarits: messages.storyboard.gabarits, now: new Date().toISOString(), suffixe: nouvelIdCourt(),
      dureeChiffree: duree => data.prixPrise(reglagesDuPlan({ duree, format, rendu: "fidele" })) !== null,
    });
    const next = remplace ? { ...res.storyboard, id: remplace.id, creeLe: remplace.creeLe } : res.storyboard;
    const ok = await data.sauver(next, { now: true });
    setEcriture(false);
    if (!ok) return false;
    setEcrits(all => ({ ...all, [next.id]: { idee: idee.trim(), question: res.question, repris: res.repris, nouveaux: res.nouveaux } }));
    setBulles(all => ({ ...all, [next.id]: [] }));
    aller(next.id);
    setVue("uttu");
    return true;
  }, [known, messages.storyboard.gabarits, data, aller]);

  const changer = useCallback((next: Storyboard, label?: string) => {
    if (label && sb) setAnnuler({ sb, label });
    void data.sauver(next);
  }, [data, sb]);

  useEffect(() => {
    if (!annuler) return;
    const timer = setTimeout(() => setAnnuler(null), 7000);
    return () => clearTimeout(timer);
  }, [annuler]);

  // ---- filming: one shot or the whole queue, in board order, one after the other ----
  const lance = useRef<string | null>(null);
  const filed = useRef<string | null>(null);
  const runRef = useRef(run);
  runRef.current = run;
  const sbFile = useRef<string | null>(null);

  const terminer = useCallback((planId: string, ok: boolean, raison?: string) => {
    lance.current = null;
    if (!ok) setEchecs(all => ({ ...all, [planId]: raison || t("storyboard.board.etat.echec") }));
    else setEchecs(all => { const { [planId]: _gone, ...rest } = all; return rest; });
    setFile(current => {
      if (!current || current.enCours !== planId) return current;
      const next = finDuPlan(current, ok);
      return next.enCours || next.restants.length ? suivantDeLaFile(next) : null;
    });
  }, [t]);

  const enCours = file?.enCours ?? null;
  useEffect(() => {
    const boardId = sbFile.current;
    const board = boardId ? data.boards[boardId] : null;
    if (!enCours || !board || lance.current === enCours) return;
    if (runRef.current.phase === "running") return;
    const found = trouverPlan(board, enCours);
    if (!found) { terminer(enCours, false); return; }
    lance.current = enCours;
    const envoi = versPlanFilm(board, found.plan, known);
    if (found.plan.planFilmId !== envoi.planId) void data.sauver(majPlan(board, found.plan.id, { planFilmId: envoi.planId }), { now: true });
    studio.resetRun();
    void studio.tournerPlan({ ...envoi, onEchec: raison => terminer(enCours, false, raison) }).then(started => {
      if (!started) { terminer(enCours, false, studio.notice); setFile(null); return; }
      // The gate said no (balance, quote, reference): nothing left, the queue stops there.
      const now = runRef.current;
      if (now.phase !== "running" && now.phase !== "done" && now.phase !== "error" && lance.current === enCours) { terminer(enCours, false, studio.notice); setFile(null); }
    });
  }, [enCours, data, known, studio, terminer]);

  // A take landed (or failed) for the shot in flight: register it, put it on the cut, next shot.
  useEffect(() => {
    const boardId = sbFile.current;
    const board = boardId ? data.boards[boardId] : null;
    if (!enCours || !board || lance.current !== enCours) return;
    const found = trouverPlan(board, enCours);
    const filmId = found?.plan.planFilmId;
    if (!found || !filmId || runOrigin?.planId !== filmId) return;
    if (run.phase === "error") { terminer(enCours, false, run.message); return; }
    if (run.phase !== "done") return;
    const take = vault.takes.find(item => item.id === run.takeId);
    if (!take || filed.current === take.id) return;
    filed.current = take.id;
    void (async () => {
      const envoi = versPlanFilm(board, found.plan, known);
      await studio.sendToMontage({ takeId: take.id, planId: filmId, label: found.plan.titre.slice(0, 80) || envoi.phrase.slice(0, 80), seconds: take.settings.seconds, aspect: take.settings.aspect === "vertical" ? "vertical" : "horizontal", still: take.poster ?? "", video: take.video, prompt: take.prompt, sceneName: take.sceneName, composeur: "" });
      const base = data.registre.plans.some(item => item.id === filmId) ? data.registre : ajouterPlanFilm(data.registre, { ...nouveauPlan(data.registre, filmId, envoi.phrase), quiIds: envoi.castIds, ouId: envoi.decorId });
      await data.setRegistre(auMontage(ajouterPrise(base, filmId, { id: take.id, fichier: take.video }), filmId, take.settings.seconds));
      // New characters and places are cards now: link them, so the next shots reuse them.
      const latest = data.boards[board.id] ?? board;
      const relie = { ...latest, sequences: latest.sequences.map(seq => ({ ...seq, plans: seq.plans.map(plan => ({ ...plan, refs: plan.refs.map(ref => {
        if (ref.id) return ref;
        const list = ref.role === "qui" ? studio.studio.cast : ref.role === "ou" ? studio.studio.scenes : [];
        const hit = list.find(item => item.name.trim().toLowerCase() === ref.nom.trim().toLowerCase());
        return hit ? { ...ref, id: hit.id } : ref;
      }) })) })) };
      await data.sauver(relie, { now: true });
      terminer(enCours, true);
    })();
  }, [run, runOrigin, enCours, vault.takes, data, known, studio, terminer]);

  const filmer = useCallback((ids: string[]) => {
    if (!sb) return;
    if (!connected) { setSheet("connect"); return; }
    setAConfirmer(ids);
  }, [sb, connected, setSheet]);

  const demarrer = useCallback(() => {
    if (!sb || !aConfirmer?.length) return;
    sbFile.current = sb.id;
    filed.current = null;
    setEchecs(all => { const next = { ...all }; for (const id of aConfirmer) delete next[id]; return next; });
    setFile(suivantDeLaFile(fileVide(aConfirmer)));
    setAConfirmer(null);
  }, [sb, aConfirmer]);

  const etat = useCallback((plan: PlanSB) => {
    if (sb && sbFile.current === sb.id && enCours === plan.id) return "en-cours" as const;
    if (echecs[plan.id]) return "echec" as const;
    return etatDuPlan(plan, data.registre);
  }, [sb, enCours, echecs, data.registre]);

  // ---- Uttu column: plain corrections ----
  const corriger = useCallback((texte: string) => {
    if (!sb) return;
    dire(sb.id, { qui: "moi", texte });
    const c = lireCorrection(texte);
    const applied = c ? appliquerCorrection(sb, c, data.registre, nouvelIdCourt()) : null;
    if (!c || !applied) { dire(sb.id, { qui: "uttu", texte: t("storyboard.uttu.notUnderstood") }); return; }
    const text = reponse(c, applied.n, applied.sb);
    changer(applied.sb, text);
    dire(sb.id, { qui: "uttu", texte: text });
  }, [sb, data.registre, dire, changer, t]); // eslint-disable-line react-hooks/exhaustive-deps
  function reponse(c: Correction, n: number | null, next: Storyboard): string {
    switch (c.type) {
      case "ajouter": return t("storyboard.uttu.done.added", { n: String(n ?? "") });
      case "retirer": return t("storyboard.uttu.done.removed", { n: String(c.n) });
      case "deplacer": return t("storyboard.uttu.done.moved", { n: String(c.n) });
      case "format": return t("storyboard.uttu.done.format", { format: t(`storyboard.format.${c.format}`) });
      case "raccourcir": return t("storyboard.uttu.done.tightened", { n: String(dureeTotale(next)) });
      case "replique": return t("storyboard.uttu.done.line", { n: String(c.n), text: c.texte });
    }
  }
  const repondre = useCallback((question: NonNullable<Question>, value: string) => {
    if (!sb) return;
    const next = question.type === "qui"
      ? definirPersonnage(sb, value, known, messages.storyboard.gabarits.quelquun, new Date().toISOString())
      : changerFormat(sb, value === "portrait" ? "portrait" : "paysage", data.registre);
    changer(next);
    setEcrits(all => all[sb.id] ? { ...all, [sb.id]: { ...all[sb.id]!, question: null } } : all);
  }, [sb, known, messages.storyboard.gabarits, data.registre, changer]);

  // ---- render ----
  const credits = balance ? t("storyboard.balance", { n: formatCredits(balance.credits) }) : null;
  const ouvertPlan = sb && ouvert ? trouverPlan(sb, ouvert) : null;
  const dark = sheet === "connect" ? <ConnectSheet /> : sheet === "credits" ? <CreditSheet /> : null;

  if (print && sb) return <div className="sb-root" data-theme="paper"><StoryboardPrint sb={sb} data={data} back={adresse(sb.id)} /></div>;

  return <div className="sb-root" data-theme="paper" data-view={sb ? vue : "board"} data-storyboard-page="" data-ready={studio.ready && data.charge ? "true" : "false"}>
    <header className="sb-bar">
      <div className="sb-bar-l">
        <span className="sb-mark" aria-hidden="true"><img src={assetPath("/brand/uttu-mark-h48.png")} alt="" width={22} height={22} /></span>
        {sb
          ? <button type="button" className="sb-bar-t" data-sb-back="" onClick={() => aller(null)}><span aria-hidden="true">←&nbsp;</span>{t("storyboard.back")}</button>
          : <span className="sb-bar-t">U*TTU · <i>&nbsp;{t("storyboard.name")}</i></span>}
        {vault.projectName && <span className="sb-bar-proj sb-wide-only">· {vault.projectName}</span>}
      </div>
      <div className="sb-bar-r">
        {credits && <button type="button" className="sb-credits sb-wide-only" onClick={() => setSheet("credits")}>{credits}</button>}
        <a className="sb-ghost sb-wide-only" href={assetPath("/studio")} data-sb-studio="">{t("storyboard.studio")}</a>
        {sb && <button type="button" className="sb-out sb-uttu-toggle" data-sb-toggle="" aria-pressed={vue === "uttu"} onClick={() => setVue(vue === "uttu" ? "board" : "uttu")}>{vue === "uttu" ? t("storyboard.uttu.toggleBoard") : t("storyboard.uttu.toggle")}</button>}
        {!sb && <a className="sb-ghost sb-uttu-toggle" href={assetPath("/studio")}>{t("storyboard.studio")}</a>}
      </div>
    </header>
    <div className="sb-wrap">
      <main className="sb-main" id="u-main">
        {currentId && !sb && data.charge
          ? <p className="sb-notice" role="status" data-sb-not-found="">{t("storyboard.board.notFound")}</p>
          : sb
            ? <Board sb={sb} data={data} etat={etat} echecs={echecs} onOpen={setOuvert} onChange={changer} onFilm={id => filmer([id])} ecriture={ecriture} />
            : <Liste data={data} onOpen={aller} ecrire={ecrire} ecriture={ecriture} idee={ideeInitiale} />}
        {data.echecEcriture && <p className="sb-notice is-fail" role="alert">{t("storyboard.writer.failed")}</p>}
      </main>
      <aside className="sb-side" aria-label={t("storyboard.uttu.label")}>
        {sb
          ? <UttuColumn sb={sb} data={data} etat={etat} bulles={bulles[sb.id] ?? []} ecrit={ecrits[sb.id] ?? null} ecriture={ecriture}
              onCorrect={corriger} onAnswer={repondre} onOpenBoard={() => setVue("board")}
              onRewrite={(idee, cible, format) => ecrire(idee, cible, format, true, sb)}
              onFilmAll={() => filmer(plansATourner(sb, data.registre).map(plan => plan.id))} />
          : <IdeaBox ecrire={ecrire} ecriture={ecriture} idee={ideeInitiale} />}
      </aside>
    </div>
    {sb && <Dock sb={sb} data={data} file={file} enCours={enCours} connected={connected} onFilm={ids => filmer(ids)} />}
    {ouvertPlan && sb && <StoryboardSheet sb={sb} found={ouvertPlan} data={data} etat={etat(ouvertPlan.plan)} echec={echecs[ouvertPlan.plan.id] ?? null}
      onClose={() => setOuvert(null)} onChange={next => changer(next)} onFilm={() => filmer([ouvertPlan.plan.id])}
      onKeep={async priseId => { if (ouvertPlan.plan.planFilmId) await data.setRegistre(garderPrise(data.registre, ouvertPlan.plan.planFilmId, priseId)); }}
      onRemove={() => { changer(retirerPlan(sb, ouvertPlan.plan.id), t("storyboard.board.removed")); setOuvert(null); }} />}
    {aConfirmer && sb && <StoryboardConfirm sb={sb} ids={aConfirmer} data={data} onStart={demarrer} onClose={() => setAConfirmer(null)} />}
    {annuler && <div className="sb-toast" role="status" data-sb-undo="">
      <span>{annuler.label}</span>
      <button type="button" onClick={() => { void data.sauver(annuler.sb); setAnnuler(null); }}>{t("storyboard.board.undo")}</button>
    </div>}
    {dark && <div className="u-app sb-dark">{dark}</div>}
  </div>;
}

// ---------- screen 1: the list ----------

function Liste({ data, onOpen, ecrire, ecriture, idee }: { data: Storyboards; onOpen(id: string): void; ecrire: EcrireFn; ecriture: boolean; idee: string }) {
  const { t } = useI18n();
  const { studio: vault } = useStudio();
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const shown = filtrer(data.liste, filtre, data.registre);
  const count = (f: Filtre) => filtrer(data.liste, f, data.registre).length;
  return <>
    <div className="sb-hello">
      <h1 className="sb-serif">{t("storyboard.list.titleA")} <em>{t("storyboard.list.titleB")}</em></h1>
      <p className="sb-muted">{t("storyboard.list.lead")}</p>
    </div>
    <IdeaBox ecrire={ecrire} ecriture={ecriture} idee={idee} />
    {data.liste.length > 0 && <div className="sb-chips" role="group" aria-label={t("storyboard.filter.label")}>
      {FILTRES.map(f => <button key={f} type="button" className="sb-chip" aria-pressed={filtre === f} data-sb-filter={f} onClick={() => setFiltre(f)}>{t("storyboard.filter.count", { label: t(`storyboard.filter.${f}`), n: String(count(f)) })}</button>)}
    </div>}
    {data.illisibles.map(file => <p key={file} className="sb-notice" role="status">{t("storyboard.list.unreadable", { file })}</p>)}
    {data.charge && data.liste.length === 0 && <p className="sb-muted" data-sb-empty="">{t("storyboard.list.empty")}</p>}
    <div className="sb-list" data-sb-list="">
      {shown.map(sb => <ListCard key={sb.id} sb={sb} data={data} onOpen={onOpen} />)}
    </div>
    {vault.project && <p className="sb-where">{t("storyboard.list.savedIn", { path: `Projets/${vault.project}/Storyboard/` })}</p>}
    <p className="sb-faint sb-small">{t("storyboard.list.noRender")}</p>
  </>;
}

function ListCard({ sb, data, onOpen }: { sb: Storyboard; data: Storyboards; onOpen(id: string): void }) {
  const { t } = useI18n();
  const plans = tousLesPlans(sb);
  const { tournes, total } = progression(sb, data.registre);
  const reste = devisStoryboard(sb, data.ctxDevis, data.registre);
  const statut = sb.archive ? "archive" : tournes === 0 ? "brouillon" : tournes === total ? "tourne" : "en-cours";
  return <article className="sb-card" data-sb-card={sb.id}>
    <a className="sb-card-open" href={adresse(sb.id)} onClick={event => { event.preventDefault(); onOpen(sb.id); }} aria-label={t("storyboard.list.open", { title: sb.titre })}>
      <div className="sb-strip" aria-hidden="true">{plans.slice(0, 4).map(plan => <ShotThumb key={plan.id} plan={plan} data={data} />)}</div>
      <div className="sb-card-b">
        <div className="sb-card-h"><h2 className="sb-serif">{sb.titre}</h2><span className={`sb-tag${statut === "tourne" ? " is-ok" : statut === "en-cours" ? " is-gold" : ""}`}>{t(`storyboard.statut.${statut}`)}</span></div>
        <p className="sb-meta sb-mono">{t("storyboard.list.meta", { scenes: sb.sequences.length, shots: total, seconds: String(dureeTotale(sb)), format: t(`storyboard.format.${sb.format}Ratio`) })}</p>
        <div className="sb-prog" aria-hidden="true"><span style={{ width: `${total ? Math.round((tournes / total) * 100) : 0}%` }} /></div>
        <p className="sb-small sb-muted">{t("storyboard.list.progress", { x: String(tournes), y: String(total) })}{tournes < total && reste.total !== null ? <> · <span className="sb-mono">{t("storyboard.list.toFinish", { n: formatCredits(reste.total) })}</span></> : null}</p>
      </div>
    </a>
    <div className="sb-card-f">
      <span />
      <button type="button" className="sb-ghost" data-sb-archive="" onClick={() => void data.sauver(archiver(sb, !sb.archive), { now: true })}>{sb.archive ? t("storyboard.list.restore") : t("storyboard.list.archive")}</button>
    </div>
  </article>;
}

type EcrireFn = (idee: string, dureeCible: DureeCible, format: Format, formatChoisi: boolean) => Promise<boolean>;

export function IdeaBox({ ecrire, ecriture, idee: initial, compact = false }: { ecrire: EcrireFn; ecriture: boolean; idee: string; compact?: boolean }) {
  const { t } = useI18n();
  const [idee, setIdee] = useState(initial);
  const [cible, setCible] = useState<DureeCible>(30);
  const [format, setFormat] = useState<Format>("paysage");
  const [formatChoisi, setFormatChoisi] = useState(false);
  const [vide, setVide] = useState(false);
  useEffect(() => { if (initial) setIdee(initial); }, [initial]);
  const go = async () => {
    if (!idee.trim()) { setVide(true); return; }
    await ecrire(idee, cible, format, formatChoisi);
  };
  return <section className="sb-start" data-sb-idea="">
    {!compact && <h2 className="sb-serif">{t("storyboard.idea.titleA")} <em>{t("storyboard.idea.titleB")}</em></h2>}
    {!compact && <p className="sb-small sb-muted sb-hide-short">{t("storyboard.idea.lead")}</p>}
    <label className="sr-only" htmlFor={compact ? "sb-idea-again" : undefined}>{t("storyboard.idea.label")}</label>
    <textarea id={compact ? "sb-idea-again" : undefined} className="sb-field" rows={3} maxLength={240} value={idee} aria-label={t("storyboard.idea.label")} placeholder={t("storyboard.idea.placeholder")} data-sb-idea-field="" onChange={event => { setIdee(event.target.value); setVide(false); }} aria-invalid={vide || undefined} aria-describedby={vide ? "sb-idea-empty" : undefined} />
    {vide && <p id="sb-idea-empty" className="sb-small" role="alert">{t("storyboard.idea.empty")}</p>}
    <div className="sb-chips" role="group" aria-label={t("storyboard.idea.length")}>
      {([15, 30, 60] as const).map(n => <button key={n} type="button" className="sb-chip" aria-pressed={cible === n} onClick={() => setCible(n)}>{t("storyboard.idea.target", { n: String(n) })}</button>)}
    </div>
    <div className="sb-chips" role="group" aria-label={t("storyboard.idea.format")}>
      {(["paysage", "portrait"] as const).map(f => <button key={f} type="button" className="sb-chip" aria-pressed={format === f} onClick={() => { setFormat(f); setFormatChoisi(true); }}>{t(`storyboard.format.${f}Ratio`)}</button>)}
    </div>
    <button type="button" className="sb-gold" data-sb-write="" disabled={ecriture} onClick={() => void go()}>{ecriture ? t("storyboard.writer.writing") : t("storyboard.idea.write")}</button>
  </section>;
}

// ---------- screen 2: the board ----------

function Board({ sb, data, etat, echecs, onOpen, onChange, onFilm, ecriture }: {
  sb: Storyboard; data: Storyboards; etat(plan: PlanSB): ReturnType<typeof etatDuPlan>; echecs: Record<string, string>;
  onOpen(id: string): void; onChange(next: Storyboard, label?: string): void; onFilm(id: string): void; ecriture: boolean;
}) {
  const { t } = useI18n();
  const { studio: vault } = useStudio();
  const [menu, setMenu] = useState(false);
  const { tournes, total } = progression(sb, data.registre);
  let numero = 0;
  return <>
    <div className="sb-head">
      <h1 className="sb-serif"><label className="sr-only" htmlFor="sb-title">{t("storyboard.board.titleLabel")}</label>
        <input id="sb-title" className="sb-head-title" value={sb.titre} maxLength={80} data-sb-title="" onChange={event => onChange({ ...sb, titre: event.target.value, majLe: new Date().toISOString() })} /></h1>
      {sb.idee && <p className="sb-log sb-muted">{sb.idee}</p>}
      <div className="sb-facts">
        <span className="sb-tag">{t("storyboard.board.seconds", { n: String(dureeTotale(sb)) })}</span>
        <span className="sb-tag">{sb.format === "portrait" ? "9:16" : "16:9"}</span>
        {sb.musique && <span className="sb-tag">{t("storyboard.board.music", { text: sb.musique })}</span>}
        <span className={`sb-tag${tournes === total && total > 0 ? " is-ok" : ""}`} data-sb-filmed="">{t("storyboard.board.filmed", { x: String(tournes), y: String(total) })}</span>
      </div>
      <div className="sb-tools">
        <button type="button" className="sb-out" aria-expanded={menu} data-sb-export="" onClick={() => setMenu(open => !open)}>{t("storyboard.board.export")}</button>
        {menu && <div className="sb-menu" role="group" aria-label={t("storyboard.board.export")}>
          <p className="sb-small sb-muted" style={{ padding: "8px 12px" }}>{t("storyboard.board.exportMd")}<br /><span className="sb-where">{vault.project ? `Projets/${vault.project}/${cheminMarkdown(sb.id)}` : cheminMarkdown(sb.id)}</span></p>
          <a className="sb-ghost" href={adresse(sb.id, true)} data-sb-print="">{t("storyboard.board.print")}</a>
        </div>}
        <button type="button" className="sb-ghost" onClick={() => onChange(archiver(sb, !sb.archive))}>{sb.archive ? t("storyboard.list.restore") : t("storyboard.list.archive")}</button>
      </div>
    </div>
    {sb.sequences.map((seq, s) => <section key={seq.id} className="sb-scene" data-sb-scene={seq.id} aria-labelledby={`sb-scene-${seq.id}`}>
      <div className="sb-scene-h">
        <span className="sb-k">{t("storyboard.board.scene", { n: String(s + 1) })}</span>
        <h2 id={`sb-scene-${seq.id}`}>{seq.titre || t("storyboard.board.scene", { n: String(s + 1) })}</h2>
        <span className="sb-s sb-mono">{t("storyboard.board.sceneMeta", { shots: seq.plans.length, seconds: String(seq.plans.reduce((sum, plan) => sum + plan.duree, 0)) })}</span>
      </div>
      {seq.resume && seq.resume !== sb.idee && <p className="sb-small sb-muted sb-hide-short">{seq.resume}</p>}
      <div className="sb-shots">
        {seq.plans.map(plan => { numero += 1; return <ShotCard key={plan.id} sb={sb} plan={plan} numero={numero} total={total} data={data} etat={etat(plan)} echec={echecs[plan.id] ?? null} onOpen={onOpen} onChange={onChange} onFilm={onFilm} />; })}
        {ecriture && <div className="sb-thumb is-skeleton" aria-hidden="true" />}
      </div>
      <button type="button" className="sb-add" data-sb-add={seq.id} onClick={() => {
        const id = nouvelIdCourt();
        onChange(ajouterPlan(sb, seq.id, planVide(id, sb.format)));
        onOpen(id);
      }}>{t("storyboard.board.addShot")}</button>
    </section>)}
  </>;
}

function ShotCard({ sb, plan, numero, total, data, etat, echec, onOpen, onChange, onFilm }: {
  sb: Storyboard; plan: PlanSB; numero: number; total: number; data: Storyboards; etat: ReturnType<typeof etatDuPlan>; echec: string | null;
  onOpen(id: string): void; onChange(next: Storyboard, label?: string): void; onFilm(id: string): void;
}) {
  const { t } = useI18n();
  const devis = devisPlan(plan, data.ctxDevis).total;
  const hit = data.priseDuPlan(plan);
  const prises = hit?.film.prises.length ?? 0;
  const tag = etat === "tourne" ? " is-ok" : etat === "en-cours" ? " is-gold" : etat === "echec" ? " is-fail" : "";
  return <article className="sb-shot" data-sb-shot={plan.id} data-sb-etat={etat}>
    <button type="button" className="sb-shot-open" aria-label={t("storyboard.board.open", { n: String(numero) })} data-sb-open={plan.id} onClick={() => onOpen(plan.id)} />
    <ShotThumb plan={plan} numero={numero} data={data} kept={t("storyboard.board.kept")} />
    <div className="sb-shot-b">
      <h3>{plan.titre || t("storyboard.board.shot", { n: String(numero) })}</h3>
      {plan.action && <p className="sb-act">{plan.action}</p>}
      {plan.dialogue.type !== "aucune" && plan.dialogue.texte && <p className="sb-line" data-sb-line="">{t("storyboard.quoted", { text: plan.dialogue.texte })}</p>}
      <p className="sb-meta sb-mono">{[plan.cadrage ? t(`storyboard.sheet.cadrage.${plan.cadrage}`) : null, plan.camera ? t(`storyboard.sheet.cam.${plan.camera}`) : null, `${plan.duree} s`].filter(Boolean).join(" · ")}</p>
      <div className="sb-shot-f">
        <RefAvatars refs={plan.refs} />
        <span className={`sb-tag${tag}`} title={echec ?? undefined}>{t(`storyboard.board.etat.${etat}`)}</span>
      </div>
      <div className="sb-shot-a">
        {numero > 1 ? <button type="button" className="sb-ghost sb-icon" aria-label={t("storyboard.board.moveUp", { n: String(numero) })} onClick={() => onChange(deplacerPlan(sb, plan.id, -1))}>↑</button> : <span className="sb-icon" aria-hidden="true" />}
        {numero < total ? <button type="button" className="sb-ghost sb-icon" aria-label={t("storyboard.board.moveDown", { n: String(numero) })} onClick={() => onChange(deplacerPlan(sb, plan.id, 1))}>↓</button> : <span className="sb-icon" aria-hidden="true" />}
        {etat === "tourne"
          ? <button type="button" className="sb-out" onClick={() => onOpen(plan.id)}>{t("storyboard.board.takes", { n: String(prises) })}</button>
          : etat === "en-cours"
            ? <span className="sb-small sb-muted" role="status">{t("storyboard.board.etat.en-cours")}</span>
            : devis === null
              ? <span className="sb-small sb-muted" data-sb-no-quote={plan.id}>{t("storyboard.board.noQuote")}</span>
              : <button type="button" className="sb-out is-gold" data-sb-film={plan.id} title={t("storyboard.board.filmTitle", { n: formatCredits(devis) })} aria-label={t("storyboard.board.filmTitle", { n: formatCredits(devis) })} onClick={() => onFilm(plan.id)}>
                {t("storyboard.board.film", { n: formatCredits(devis) })}</button>}
      </div>
    </div>
  </article>;
}

// ---------- the gold dock ----------

function Dock({ sb, data, file, enCours, connected, onFilm }: { sb: Storyboard; data: Storyboards; file: FileTournage | null; enCours: string | null; connected: boolean; onFilm(ids: string[]): void }) {
  const { t } = useI18n();
  const plans = plansATourner(sb, data.registre);
  const devis = devisStoryboard(sb, data.ctxDevis, data.registre, plans);
  if (file && enCours) {
    const i = file.faits.length + file.echecs.length + 1;
    const n = i + file.restants.length;
    return <div className="sb-dock" data-sb-dock=""><p className="sb-notice" role="status" data-sb-queue="">{t("storyboard.board.queue", { i: String(i), n: String(n) })}</p></div>;
  }
  if (!plans.length) return <div className="sb-dock" data-sb-dock=""><p className="sb-notice" role="status">{t("storyboard.board.allFilmed")}</p></div>;
  return <div className="sb-dock" data-sb-dock="">
    {connected && devis.total === null
      ? <p className="sb-notice" role="status" data-sb-no-quote="">{t("storyboard.board.noQuote")}</p>
      : <button type="button" className="sb-gold" data-sb-film-all="" onClick={() => onFilm(plans.map(plan => plan.id))}>
        {connected && devis.total !== null
          ? <><span>{t("storyboard.board.filmAll", { n: plans.length })}</span><span className="sb-p">{t("storyboard.board.filmAllPrice", { n: formatCredits(devis.total) })}</span></>
          : <span>{t("storyboard.board.connect")}</span>}
      </button>}
    <p className="sb-dock-under">{t("storyboard.board.filmAllNote")}</p>
  </div>;
}

