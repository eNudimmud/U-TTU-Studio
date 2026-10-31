"use client";

// Refonte FILM · PR 5 — la carte du plan (derrière film2). One sentence, Qui and Où read from it,
// what Uttu understood as chips, one gold button with its estimated price, one confirmation that
// lists every step (a missing character or place is created first), then the take lands in the card
// and on the cut by itself. CAST and DÉCOR stay the libraries behind Qui and Où.

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { quoteForCast, quoteForDecor } from "@/lib/creation/quotes";
import { appliquerChoix, CHOIX_VIDE, type Choix, type ChoixOu, type ChoixQui } from "@/lib/film/choix";
import { comprendrePlan, etapesPlan } from "@/lib/film/comprendre";
import { ajouterPlan, ajouterPrise, auMontage, lireRegistre, nouveauPlan, registreJson, REGISTRE_FILE, type Registre } from "@/lib/film/registre";
import { quoteCredits } from "@/lib/prise/rendu";
import { resolveTakeQuote } from "@/lib/render/billed-quote";
import { quotesToRecords } from "@/lib/render/measured-quote";
import { DEFAULT_TAKE, takeProfile, type TakeSettings } from "@/lib/render/take-graph";
import { assetPath } from "@/lib/site";
import { useStudio } from "../studio-session";
import { FilmChoix, type CarteChoix } from "./film-choix";
import "./film-plans.css";

const DRAFT_KEY = "u-ttu-film2-plan";

export function FilmPlans({ goCast, goDecor, onMontage }: { goCast(): void; goDecor(): void; onMontage(): void }) {
  const { t, say } = useI18n();
  const studio = useStudio();
  const { studio: vault, media, run, runOrigin, balance, notice } = studio;
  const [phrase, setPhrase] = useState("");
  const [duree, setDuree] = useState<5 | 8>(5);
  const [portrait, setPortrait] = useState(false);
  const [asking, setAsking] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [launched, setLaunched] = useState<string | null>(null);
  const [etape, setEtape] = useState(0);
  const [echec, setEchec] = useState("");
  const [choix, setChoix] = useState<Choix>(CHOIX_VIDE);
  const [fichiers, setFichiers] = useState<Record<string, File[]>>({});
  const [ouvert, setOuvert] = useState<null | "qui" | "ou">(null);
  const [registre, setRegistre] = useState<Registre>(() => lireRegistre(null));
  const filed = useRef<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const lancer = useRef<HTMLButtonElement>(null);
  const said = useRef(notice);
  said.current = notice;

  useEffect(() => {
    try { setPhrase(localStorage.getItem(DRAFT_KEY) ?? ""); } catch { /* private tab */ }
  }, []);
  useEffect(() => {
    let gone = false;
    void studio.readProjectFile(REGISTRE_FILE).then(text => { if (!gone) setRegistre(lireRegistre(text)); });
    return () => { gone = true; };
  }, [studio.readProjectFile, vault.project]);
  const write = (value: string) => {
    setPhrase(value.slice(0, 240));
    setEchec("");
    try { localStorage.setItem(DRAFT_KEY, value.slice(0, 240)); } catch { /* private tab */ }
  };

  // Only real cards: the demo gallery is not registered in the project, it cannot be sent.
  const known = useMemo(() => ({
    cast: vault.cast.filter(card => card.sheet || card.photos.length).map(card => ({ id: card.id, name: card.name })),
    decor: vault.scenes.map(scene => ({ id: scene.id, name: scene.name })),
  }), [vault.cast, vault.scenes]);
  // A new one made in an earlier try is a card now: it is picked, not made twice.
  const plan = useMemo(() => {
    const byName = (list: readonly { id: string; name: string }[], nom: string) => list.find(item => item.name.trim().toLowerCase() === nom.trim().toLowerCase());
    const qui = choix.qui?.map(item => { const hit = item.id ? null : byName(known.cast, item.nom); return hit ? { id: hit.id, nom: hit.name } : item; }) ?? null;
    const ouHit = choix.ou && !choix.ou.id ? byName(known.decor, choix.ou.nom) : null;
    return appliquerChoix(comprendrePlan(phrase, known), { qui, ou: ouHit ? { id: ouHit.id, nom: ouHit.name } : choix.ou });
  }, [phrase, known, choix]);
  const settings = useMemo<TakeSettings>(() => ({ ...DEFAULT_TAKE, engine: "h3", seconds: duree, aspect: portrait ? "vertical" : "horizontal" }), [duree, portrait]);
  const priseCredits = quoteCredits(resolveTakeQuote(takeProfile(settings), quotesToRecords(vault.quotes))) ?? 0;
  const { etapes, total } = etapesPlan(plan, { personnage: quoteForCast("texte").credits, personnagePhotos: quoteForCast("photos").credits, lieu: quoteForDecor("texte").credits, lieuPhoto: quoteForDecor("photo").credits, prise: priseCredits });
  const numero = registre.plans.length + (launched && registre.plans.some(item => item.id === launched) ? 0 : 1);
  const running = run.phase === "running" || (launched !== null && studio.creating && run.phase !== "done");
  const mine = launched !== null && runOrigin?.planId === launched;
  const landed = mine && run.phase === "done" ? vault.takes.find(take => take.id === run.takeId) ?? null : null;
  const failed = mine && run.phase === "error" ? run.message : echec;

  // The take is on the cut without a tap, once.
  useEffect(() => {
    if (!landed || !launched || filed.current === landed.id) return;
    filed.current = landed.id;
    void (async () => {
      await studio.sendToMontage({ takeId: landed.id, planId: launched, label: plan.phrase.slice(0, 80), seconds: landed.settings.seconds, aspect: landed.settings.aspect === "vertical" ? "vertical" : "horizontal", still: landed.poster ?? "", video: landed.video, prompt: landed.prompt, sceneName: landed.sceneName, composeur: "" });
      const base = registre.plans.some(item => item.id === launched) ? registre : ajouterPlan(registre, { ...nouveauPlan(registre, launched, plan.phrase), quiIds: plan.qui.flatMap(who => who.id ?? []), ouId: plan.ou?.id ?? null });
      const next = auMontage(ajouterPrise(base, launched, { id: landed.id, fichier: landed.video }), launched, landed.settings.seconds);
      setRegistre(next);
      await studio.writeProjectFile(REGISTRE_FILE, registreJson(next));
    })();
  }, [landed, launched, plan.phrase, plan.qui, plan.ou, registre, studio]);

  useEffect(() => { if (asking) requestAnimationFrame(() => lancer.current?.focus()); }, [asking]);

  const ask = () => {
    if (!plan.phrase) { setEchec(t("film2.phraseVide")); field.current?.focus(); return; }
    if (!studio.connected) { studio.setSheet("connect"); return; }
    setEchec("");
    setAsking(true);
  };
  const go = async () => {
    setAsking(false);
    const id = `plan-${Date.now().toString(36)}`;
    setLaunched(id);
    setEtape(0);
    studio.resetRun();
    const ok = await studio.tournerPlan({
      planId: id,
      phrase: plan.phrase,
      castIds: plan.qui.flatMap(who => who.id && !who.nouveau ? [who.id] : []),
      decorId: plan.ou && !plan.ou.nouveau ? plan.ou.id : null,
      nouveaux: plan.qui.filter(who => who.nouveau).map(who => ({ nom: who.nom, ...(who.description ? { description: who.description } : {}), ...(who.source === "photos" ? { files: fichiers[who.nom.toLowerCase()] ?? [] } : {}) })),
      nouveauLieu: plan.ou?.nouveau ? { nom: plan.ou.nom, ...(plan.ou.description ? { description: plan.ou.description } : {}), ...(plan.ou.source === "photo" ? { file: fichiers[plan.ou.nom.toLowerCase()]?.[0] ?? null } : {}) } : null,
      settings,
      onEtape: setEtape,
    });
    // A refused step says why (notice from the step); the steps already done are kept and found again.
    if (!ok) setEchec(said.current ? say(said.current) : t("create.failed"));
  };
  const suivant = () => {
    write("");
    setChoix(CHOIX_VIDE);
    setFichiers({});
    setLaunched(null);
    studio.resetRun();
    requestAnimationFrame(() => field.current?.focus());
  };

  const thumb = (path: string | null | undefined, preview?: string | null) => preview ? assetPath(preview) : path && media[path] ? media[path] : "";
  const cartesQui: CarteChoix[] = vault.cast.filter(card => card.sheet || card.photos.length).map(card => ({ id: card.id, nom: card.name, thumb: thumb(card.sheet ?? card.photos[0]), paths: [...(card.sheet ? [card.sheet] : []), ...card.photos] }));
  const cartesOu: CarteChoix[] = vault.scenes.map(item => ({ id: item.id, nom: item.name, thumb: thumb(item.render ?? item.stills[0]), paths: [...(item.render ? [item.render] : []), ...item.stills] }));
  const fermerChoix = (kind: "qui" | "ou", pick: (ChoixQui | ChoixOu)[], files: Record<string, File[]>) => {
    setChoix(current => kind === "qui" ? { ...current, qui: pick.length ? pick as ChoixQui[] : null } : { ...current, ou: (pick[0] as ChoixOu | undefined) ?? null });
    setFichiers(current => ({ ...current, ...files }));
    setOuvert(null);
    setEchec("");
  };
  const quiNoms = plan.qui.map(who => who.nom);
  const quiTexte = quiNoms.length > 1 ? t("film2.plusieurs", { a: quiNoms.slice(0, -1).join(", "), b: quiNoms.at(-1)! }) : quiNoms[0] ?? "";
  const castCard = (id: string | null) => id ? vault.cast.find(card => card.id === id) : undefined;
  const scene = plan.ou?.id ? vault.scenes.find(item => item.id === plan.ou!.id) : undefined;
  const prix = t("film2.credits", { n: formatCredits(total) });
  const labelEtape = (index: number) => {
    const step = etapes[index];
    if (!step) return "";
    return step.type === "personnage" ? t("film2.etapePersonnage", { nom: step.nom }) : step.type === "lieu" ? t("film2.etapeLieu", { nom: step.nom }) : t("film2.etapePrise");
  };
  const chips: { key: string; label: string; onClick?(): void; aria?: string }[] = [
    ...(plan.read.camera.words ? [{ key: "camera", label: /cam[eé]ra|kamera|c[aá]mara/i.test(plan.read.camera.words) ? plan.read.camera.words.charAt(0).toUpperCase() + plan.read.camera.words.slice(1) : t("film2.camera", { words: plan.read.camera.words }) }] : []),
    { key: "duree", label: t("film2.duree", { s: String(duree) }), onClick: () => setDuree(value => value === 5 ? 8 : 5), aria: t("film2.changerDuree") },
    { key: "format", label: portrait ? t("film2.portrait") : t("film2.paysage"), onClick: () => setPortrait(value => !value), aria: t("film2.changerFormat") },
    ...plan.read.ambiance.slice(0, 2).map(item => ({ key: `amb-${item.label}`, label: item.label })),
  ];

  return <section className="u-film" data-film-plans="" data-film-ready={studio.ready ? "true" : "false"}>
    <h1 id="u-title" tabIndex={-1} className="u-film-title"><span className="u-film-stage">{t("film2.title")}</span> <span>{t("film2.planN", { n: String(numero) })}</span></h1>
    <div className="u-film-card">
      <label className="sr-only" htmlFor="u-film-phrase">{t("film2.phrase")}</label>
      <textarea id="u-film-phrase" ref={field} className="u-film-phrase" data-film-phrase="" rows={2} maxLength={240} value={phrase} placeholder={t("film2.phrasePh")} onChange={event => write(event.target.value)} disabled={running} />
      <div className="u-film-slots">
        <button type="button" className="u-film-slot" data-film-qui="" data-nouveau={plan.qui.some(who => who.nouveau) ? "" : undefined} aria-haspopup="dialog" onClick={() => setOuvert("qui")} disabled={running} aria-describedby={running ? "u-film-running" : undefined}>
          {(() => { const card = castCard(plan.qui[0]?.id ?? null); const src = card ? thumb(card.sheet ?? card.photos[0], card.preview) : ""; return src ? <img src={src} alt="" width={44} height={44} /> : <span className="u-film-slot-ph" aria-hidden="true">?</span>; })()}
          <span><small>{t("film2.qui")}</small><strong>{quiTexte || t("film2.quiVide")}</strong>{plan.qui.length > 0 && <em>{plan.qui.some(who => who.nouveau) ? t("film2.nouveau") : t("film2.deTaDistribution")}</em>}</span>
        </button>
        <button type="button" className="u-film-slot" data-film-ou="" data-nouveau={plan.ou?.nouveau ? "" : undefined} aria-haspopup="dialog" onClick={() => setOuvert("ou")} disabled={running} aria-describedby={running ? "u-film-running" : undefined}>
          {(() => { const src = scene ? thumb(scene.render ?? scene.stills[0]) : ""; return src ? <img src={src} alt="" width={44} height={44} /> : <span className="u-film-slot-ph" aria-hidden="true">?</span>; })()}
          <span><small>{t("film2.ou")}</small><strong>{plan.ou?.nom || t("film2.ouVide")}</strong>{plan.ou && <em>{plan.ou.nouveau ? t("film2.nouveau") : t("film2.deTesLieux")}</em>}</span>
        </button>
      </div>
      <p className="u-film-eyebrow">{t("film2.compris")}</p>
      <div className="u-film-chips" data-film-chips="">
        {chips.map(chip => chip.onClick
          ? <button key={chip.key} type="button" className="u-film-chip" aria-label={`${chip.aria} : ${chip.label}`} onClick={chip.onClick} disabled={running} aria-describedby={running ? "u-film-running" : undefined}>{chip.label}</button>
          : <span key={chip.key} className="u-film-chip">{chip.label}</span>)}
      </div>
    </div>

    {running && <p id="u-film-running" className="u-film-state" role="status" data-film-running="">{t("film2.enCours", { i: String(Math.min(etape + 1, etapes.length)), n: String(etapes.length), label: labelEtape(etape) })}</p>}
    {landed && <div className="u-film-result" data-film-result="">
      {media[landed.video] ? <video src={media[landed.video]} controls playsInline muted loop preload="metadata" /> : null}
      <p role="status">{t("film2.fini")}</p>
      <div className="u-film-result-actions">
        <button type="button" className="u-secondary" data-film-suivant="" onClick={suivant}>{t("film2.planSuivant")}</button>
        <button type="button" className="u-secondary" data-film-montage="" onClick={onMontage}>{t("film2.voirMontage")}</button>
      </div>
    </div>}
    {failed && !running && <p className="u-film-error" role="alert" data-film-error="">{launched ? t("film2.erreur", { raison: failed }) : failed}</p>}
    {!running && !landed && <p className="u-film-note"><span className="u-film-badge">{t("film2.video", { s: String(duree) })}</span> {etapes.length > 1 ? t("film2.explication") : t("film2.explicationPrete")}</p>}

    {!landed && <div className="u-film-dock">
      <button type="button" className="u-film-gold" data-film-tourner="" disabled={running} aria-describedby={running ? "u-film-running" : undefined} onClick={failed && launched ? () => void go() : ask}>
        <span>{failed && launched ? t("film2.reessayer") : t("film2.tourner")}</span><span className="u-film-price">· {prix}</span>
      </button>
    </div>}

    {ouvert && <FilmChoix
      kind={ouvert}
      cartes={ouvert === "qui" ? cartesQui : cartesOu}
      media={media}
      choisis={ouvert === "qui" ? plan.qui.map(who => who.id ? { id: who.id, nom: who.nom } : { id: null, nom: who.nom, source: who.source ?? "texte", ...(who.description ? { description: who.description } : {}) }) : plan.ou ? [plan.ou.id ? { id: plan.ou.id, nom: plan.ou.nom } : { id: null, nom: plan.ou.nom, source: plan.ou.source ?? "texte", ...(plan.ou.description ? { description: plan.ou.description } : {}) }] : []}
      credits={ouvert === "qui" ? { photos: quoteForCast("photos").credits, texte: quoteForCast("texte").credits } : { photos: quoteForDecor("photo").credits, texte: quoteForDecor("texte").credits }}
      onDone={(pick, files) => fermerChoix(ouvert, pick, files)}
      onClose={() => setOuvert(null)}
      onBibliotheque={() => { setOuvert(null); if (ouvert === "qui") goCast(); else goDecor(); }}
    />}
    {asking && <div className="u-film-sheet-back" onClick={() => setAsking(false)}>
      <div className="u-film-sheet" role="dialog" aria-modal="true" aria-labelledby="u-film-confirm-title" data-film-confirm="" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") setAsking(false); }}>
        <h2 id="u-film-confirm-title">{t("film2.confirmTitle")}</h2>
        <p className="u-film-lead">{etapes.length > 1 ? t("film2.confirmLead", { n: String(etapes.length) }) : t("film2.confirmLead1")}</p>
        <ol className="u-film-steps">
          {etapes.map((step, index) => <li key={`${step.type}-${index}`} data-film-etape={step.type}>
            <span><strong>{index + 1}. {labelEtape(index)}</strong><small>{step.type === "prise" ? t("film2.etapePriseSous", { s: String(duree), qui: [quiTexte, plan.ou?.nom].filter(Boolean).join(" · ") }) : t("film2.depuisPhrase")}</small></span>
            <span className="u-film-step-cost">≈ {formatCredits(step.credits)}</span>
          </li>)}
        </ol>
        <p className="u-film-total"><strong>{t("film2.total")}</strong><strong data-film-total="">{prix}</strong></p>
        <p className="u-film-after">{balance ? t("film2.soldeApres", { n: formatCredits(Math.max(0, balance.credits - total)) }) : t("film2.soldeInconnu")}</p>
        <button ref={lancer} type="button" className="u-film-gold" data-film-lancer="" onClick={() => void go()}><span>{t("film2.lancer")}</span><span className="u-film-price">· {prix}</span></button>
        <div className="u-film-sheet-row">
          <button type="button" className="u-secondary" data-film-modifier="" onClick={() => { setAsking(false); field.current?.focus(); }}>{t("film2.modifier")}</button>
          <button type="button" className="u-secondary" aria-expanded={envoye} data-film-envoye="" onClick={() => setEnvoye(value => !value)}>{t("film2.envoye")}</button>
        </div>
        {envoye && <p className="u-film-sent" data-film-sent="">{t("film2.envoyeLead")}<br /><q>{plan.phrase}</q></p>}
      </div>
    </div>}
  </section>;
}
