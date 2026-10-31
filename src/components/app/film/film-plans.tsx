"use client";

// Refonte FILM · PR 5 — la carte du plan (derrière film2). One sentence, Qui and Où read from it,
// what Uttu understood as chips, one gold button with its estimated price, one confirmation that
// lists every step (a missing character or place is created first), then the take lands in the card
// and on the cut by itself. CAST and DÉCOR stay the libraries behind Qui and Où.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { quoteForCast, quoteForDecor } from "@/lib/creation/quotes";
import { appliquerChoix, CHOIX_VIDE, type Choix, type ChoixOu, type ChoixQui } from "@/lib/film/choix";
import { comprendrePlan, etapesPlan } from "@/lib/film/comprendre";
import { ajouterPlan, ajouterPrise, auMontage, lireRegistre, nouveauPlan, registreJson, REGISTRE_FILE, type Registre } from "@/lib/film/registre";
import { quoteCredits } from "@/lib/prise/rendu";
import { resolveTakeQuote } from "@/lib/render/billed-quote";
import { quotesToRecords } from "@/lib/render/measured-quote";
import { takeProfile, type TakeSettings } from "@/lib/render/take-graph";
import { ligneDuPlan, lireReglages, reglagesChiffres, reglagesVersTake, REGLAGES_FILM, REGLAGES_KEY, type ReglagesFilm } from "@/lib/film/reglages";
import { assetPath } from "@/lib/site";
import { useStudio } from "../studio-session";
import { coutExemple, EXEMPLE_KEY, EXEMPLES_FILM, type Exemple } from "@/lib/film/exemples";
import { FilmChoix, type CarteChoix } from "./film-choix";
import { FilmExemples } from "./film-exemples";
import { FilmReglages } from "./film-reglages";
import "./film-plans.css";

const DRAFT_KEY = "u-ttu-film2-plan";

export function FilmPlans({ goCast, goDecor, onMontage }: { goCast(): void; goDecor(): void; onMontage(): void }) {
  const { t, say } = useI18n();
  const studio = useStudio();
  const { studio: vault, media, run, runOrigin, balance } = studio;
  const [phrase, setPhrase] = useState("");
  const [reglagesVoulus, setReglagesVoulus] = useState<ReglagesFilm>(REGLAGES_FILM);
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  const [asking, setAsking] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [launched, setLaunched] = useState<string | null>(null);
  // « Autre prise » / « Modifier et refaire »: the next try is one more take of this plan, not a new plan.
  const [reprise, setReprise] = useState<string | null>(null);
  const [etape, setEtape] = useState(0);
  const [echec, setEchec] = useState("");
  // The steps of the try in flight: after a failure, what is no longer a step was made and is kept.
  const [lancees, setLancees] = useState<{ type: string; nom: string }[]>([]);
  const [choix, setChoix] = useState<Choix>(CHOIX_VIDE);
  const [fichiers, setFichiers] = useState<Record<string, File[]>>({});
  const [ouvert, setOuvert] = useState<null | "qui" | "ou">(null);
  const [registre, setRegistre] = useState<Registre>(() => lireRegistre(null));
  const filed = useRef<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const lancer = useRef<HTMLButtonElement>(null);
  const raisonRef = useRef("");
  const carte = useRef<HTMLDivElement>(null);
  // PR 4: « Refaire cet exemple » — which one is being prepared, and the card lit while it fills.
  const [prepare, setPrepare] = useState<string | null>(null);
  const [rempli, setRempli] = useState(false);
  const [askAfterFill, setAskAfterFill] = useState(false);

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
  const records = useMemo(() => quotesToRecords(vault.quotes), [vault.quotes]);
  const prixPrise = useCallback((take: TakeSettings) => quoteCredits(resolveTakeQuote(takeProfile(take), records)), [records]);
  // A duration with no price for this rendu is never kept: the quote stays real.
  const reglages = useMemo(() => reglagesChiffres(reglagesVoulus, prixPrise), [reglagesVoulus, prixPrise]);
  const duree = reglages.duree;
  const settings = useMemo<TakeSettings>(() => reglagesVersTake(reglages), [reglages]);
  const priseQuote = prixPrise(settings);
  const priseCredits = priseQuote ?? 0;
  const ligne = ligneDuPlan(plan.phrase, reglages);
  const changerReglages = (next: ReglagesFilm) => {
    setReglagesVoulus(next);
    try { localStorage.setItem(REGLAGES_KEY, JSON.stringify(next)); } catch { /* private tab */ }
  };
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
    const deja = registre.plans.find(item => item.id === launched)?.prises.length ?? 0;
    void (async () => {
      // Another take of a plan already on the cut stays in « Mes plans »: the cut keeps the first one.
      if (deja === 0) await studio.sendToMontage({ takeId: landed.id, planId: launched, label: plan.phrase.slice(0, 80), seconds: landed.settings.seconds, aspect: landed.settings.aspect === "vertical" ? "vertical" : "horizontal", still: landed.poster ?? "", video: landed.video, prompt: landed.prompt, sceneName: landed.sceneName, composeur: "" });
      const base = registre.plans.some(item => item.id === launched) ? registre : ajouterPlan(registre, { ...nouveauPlan(registre, launched, plan.phrase), quiIds: plan.qui.flatMap(who => who.id ?? []), ouId: plan.ou?.id ?? null });
      const next = auMontage(ajouterPrise(base, launched, { id: landed.id, fichier: landed.video }), launched, landed.settings.seconds);
      setRegistre(next);
      await studio.writeProjectFile(REGISTRE_FILE, registreJson(next));
    })();
  }, [landed, launched, plan.phrase, plan.qui, plan.ou, registre, studio]);

  useEffect(() => {
    try { setReglagesVoulus(lireReglages(localStorage.getItem(REGLAGES_KEY))); } catch { /* private tab */ }
  }, []);
  useEffect(() => { if (asking) requestAnimationFrame(() => lancer.current?.focus()); }, [asking]);

  // The example has filled the card: once seen, the confirmation opens (nothing is sent before Lancer).
  useEffect(() => {
    if (!askAfterFill || !plan.phrase) return;
    const timer = window.setTimeout(() => { setAskAfterFill(false); ask(); }, 700);
    return () => window.clearTimeout(timer);
  });
  useEffect(() => {
    if (!rempli) return;
    const timer = window.setTimeout(() => setRempli(false), 2400);
    return () => window.clearTimeout(timer);
  }, [rempli]);

  const ask = () => {
    if (!plan.phrase) { setEchec(t("film2.phraseVide")); field.current?.focus(); return; }
    if (!studio.connected) { studio.setSheet("connect"); return; }
    setEchec("");
    setAsking(true);
  };
  const go = async () => {
    setAsking(false);
    // A retry keeps the plan id: the steps already made are found again, only the rest is sent.
    const id = failed && launched ? launched : reprise ?? `plan-${Date.now().toString(36)}`;
    if (!(failed && launched)) setLancees(etapes.map(step => ({ type: step.type, nom: step.nom })));
    setEchec("");
    setLaunched(id);
    setEtape(0);
    studio.resetRun();
    const ok = await studio.tournerPlan({
      planId: id,
      phrase: plan.phrase,
      ligne,
      castIds: plan.qui.flatMap(who => who.id && !who.nouveau ? [who.id] : []),
      decorId: plan.ou && !plan.ou.nouveau ? plan.ou.id : null,
      nouveaux: plan.qui.filter(who => who.nouveau).map(who => ({ nom: who.nom, ...(who.description ? { description: who.description } : {}), ...(who.source === "photos" ? { files: fichiers[who.nom.toLowerCase()] ?? [] } : {}) })),
      nouveauLieu: plan.ou?.nouveau ? { nom: plan.ou.nom, ...(plan.ou.description ? { description: plan.ou.description } : {}), ...(plan.ou.source === "photo" ? { file: fichiers[plan.ou.nom.toLowerCase()]?.[0] ?? null } : {}) } : null,
      settings,
      onEtape: setEtape,
      onEchec: raison => { raisonRef.current = raison; },
    });
    // A refused step says why (notice from the step); the steps already done are kept and found again.
    if (!ok) setEchec(raisonRef.current ? say(raisonRef.current) : studio.connected ? t("create.failed") : t("create.needLink"));
    raisonRef.current = "";
  };
  const suivant = () => {
    write("");
    setLancees([]);
    setChoix(CHOIX_VIDE);
    setFichiers({});
    setLaunched(null);
    setReprise(null);
    studio.resetRun();
    requestAnimationFrame(() => field.current?.focus());
  };
  // A take of a plan that already has one does not go on the cut: the sheet says so.
  const autreDuPlan = reprise !== null && (registre.plans.find(item => item.id === reprise)?.prises.length ?? 0) > 0;
  // Same sentence, same Qui/Où, same settings: only the take is quoted again (the cards exist now).
  const autrePrise = () => {
    if (!launched) return;
    setReprise(launched);
    studio.resetRun();
    ask();
  };
  const modifierRefaire = () => {
    if (!launched) return;
    setReprise(launched);
    studio.resetRun();
    requestAnimationFrame(() => { field.current?.focus(); field.current?.select(); });
  };

  const prixExemple = (exemple: Exemple) => coutExemple(exemple, {
    prise: rendu => prixPrise(reglagesVersTake({ ...reglages, duree: exemple.secondes ?? 5, rendu })),
    cast: source => quoteForCast(source).credits,
    decor: source => quoteForDecor(source).credits,
  });
  // The house references become the visitor's own cards (a local import, no render, never twice);
  // the sentence, Qui and Où fill the card on screen, then the confirmation opens.
  const refaire = async (exemple: Exemple) => {
    const cible = exemple.refaire;
    if (cible.vers !== "plan") {
      try { sessionStorage.setItem(EXEMPLE_KEY, JSON.stringify(cible)); } catch { /* private tab */ }
      if (cible.vers === "cast") goCast(); else goDecor();
      return;
    }
    setPrepare(exemple.id);
    setEchec("");
    try {
      const picked: { cast: { id: string; nom: string }[]; decor: { id: string; nom: string } | null } = { cast: [], decor: null };
      for (const item of exemple.avant) {
        if (item.kind === "texte") continue;
        const list = item.kind === "cast" ? known.cast : known.decor;
        let found = list.find(card => card.name.trim().toLowerCase() === item.nom.toLowerCase());
        if (!found) {
          const response = await fetch(assetPath(item.image));
          if (!response.ok) throw new Error(t("film2.exemples.introuvable"));
          const blob = await response.blob();
          const [made] = await studio.importAssets([new File([blob], `${item.nom}.webp`, { type: blob.type || "image/webp" })], item.kind === "cast" ? "personnage" : "decor");
          if (!made) throw new Error(t("film2.exemples.introuvable"));
          found = { id: made.id, name: made.name };
        }
        if (item.kind === "cast") picked.cast.push({ id: found.id, nom: found.name }); else picked.decor = { id: found.id, nom: found.name };
      }
      write(t(exemple.phrase ?? exemple.titre));
      setChoix({ qui: picked.cast.length ? picked.cast : null, ou: picked.decor });
      changerReglages({ ...reglagesVoulus, duree: exemple.secondes ?? 5, rendu: cible.rendu });
      setRempli(true);
      carte.current?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      setAskAfterFill(true);
    } catch (error) {
      setEchec(error instanceof Error && error.message ? error.message : t("film2.exemples.introuvable"));
    } finally {
      setPrepare(null);
    }
  };
  const vide = !phrase.trim() && !launched && !running && registre.plans.length === 0 && choix.qui === null && choix.ou === null;

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
  const gardes = lancees.filter(step => step.type !== "prise" && !etapes.some(item => item.type === step.type && item.nom.toLowerCase() === step.nom.toLowerCase()));
  const ouvrirReglages = () => setReglagesOuverts(true);
  const chips: { key: string; label: string; onClick?(): void; aria?: string }[] = [
    ...(plan.read.camera.words ? [{ key: "camera", label: /cam[eé]ra|kamera|c[aá]mara/i.test(plan.read.camera.words) ? plan.read.camera.words.charAt(0).toUpperCase() + plan.read.camera.words.slice(1) : t("film2.camera", { words: plan.read.camera.words }) }] : []),
    ...(reglages.camera ? [{ key: "camera-choisie", label: t(`film2.reglages.cam.${reglages.camera}`), onClick: ouvrirReglages, aria: t("film2.reglages.changer") }] : []),
    { key: "duree", label: t("film2.duree", { s: String(duree) }), onClick: ouvrirReglages, aria: t("film2.reglages.changer") },
    { key: "format", label: reglages.format === "portrait" ? t("film2.portrait") : t("film2.paysage"), onClick: ouvrirReglages, aria: t("film2.reglages.changer") },
    { key: "rendu", label: t(`film2.reglages.${reglages.rendu}`), onClick: ouvrirReglages, aria: t("film2.reglages.changer") },
    ...(reglages.paroles !== "aucune" ? [{ key: "paroles", label: t(`film2.reglages.par.${reglages.paroles}`), onClick: ouvrirReglages, aria: t("film2.reglages.changer") }] : []),
    ...plan.read.ambiance.slice(0, 1).map(item => ({ key: `amb-${item.label}`, label: item.label })),
  ];

  return <section className="u-film" data-film-plans="" data-film-ready={studio.ready ? "true" : "false"}>
    <h1 id="u-title" tabIndex={-1} className="u-film-title"><span className="u-film-stage">{t("film2.title")}</span> <span>{t("film2.planN", { n: String(numero) })}</span></h1>
    <div ref={carte} className="u-film-card" data-rempli={rempli ? "" : undefined}>
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
      {/* PR 9: the first screen stays short; « Uttu a compris » appears once there is a sentence to read. */}
      {phrase.trim() !== "" && <>
        <p className="u-film-eyebrow">{t("film2.compris")}</p>
        <div className="u-film-chips" data-film-chips="">
          {chips.map(chip => chip.onClick
            ? <button key={chip.key} type="button" className="u-film-chip" aria-label={`${chip.aria} : ${chip.label}`} onClick={chip.onClick} disabled={running} aria-describedby={running ? "u-film-running" : undefined}>{chip.label}</button>
            : <span key={chip.key} className="u-film-chip">{chip.label}</span>)}
        </div>
      </>}
    </div>

    {running && <p id="u-film-running" className="u-film-state" role="status" data-film-running="">{t("film2.enCours", { i: String(Math.min(etape + 1, etapes.length)), n: String(etapes.length), label: labelEtape(etape) })}</p>}
    {landed && <div className="u-film-result" data-film-result="">
      {media[landed.video] ? <video src={media[landed.video]} controls playsInline muted loop preload="metadata" /> : null}
      <p role="status" data-film-fini="">{(() => { const n = registre.plans.find(item => item.id === launched)?.prises.findIndex(item => item.id === landed.id) ?? -1; return n > 0 ? t("film2.finiAutre", { n: String(n + 1) }) : t("film2.fini"); })()}</p>
      <div className="u-film-result-actions">
        <button type="button" className="u-secondary" data-film-autre="" onClick={autrePrise} disabled={priseQuote === null} aria-describedby={priseQuote === null ? "u-film-autre-why" : undefined}><span>{t("film2.autrePrise")}</span>{priseQuote !== null && <span className="u-film-price">{t("film2.credits", { n: formatCredits(priseCredits) })}</span>}</button>
        {priseQuote === null && <span id="u-film-autre-why" className="sr-only">{t("film2.reglages.sansPrixLong")}</span>}
        <button type="button" className="u-secondary" data-film-refaire-plan="" onClick={modifierRefaire}>{t("film2.modifierRefaire")}</button>
        <button type="button" className="u-secondary" data-film-suivant="" onClick={suivant}>{t("film2.planSuivant")}</button>
        <button type="button" className="u-secondary" data-film-montage="" onClick={onMontage}>{t("film2.voirMontage")}</button>
      </div>
    </div>}
    {failed && !running && <div className="u-film-error" role="alert" data-film-error="">
      <p>{launched ? t("film2.erreur", { raison: failed }) : failed}</p>
      {launched && gardes.length > 0 && <p data-film-garde="">{t("film2.garde", { faits: gardes.map(step => step.nom).join(", "), reste: etapes.map((_, index) => labelEtape(index)).join(", ") })}</p>}
    </div>}
    {vide && <FilmExemples exemples={EXEMPLES_FILM} cout={prixExemple} busy={prepare} onRefaire={exemple => void refaire(exemple)} />}
    {!running && !landed && !vide && <p className="u-film-note"><span className="u-film-badge">{t("film2.video", { s: String(duree) })}</span> {etapes.length > 1 ? t("film2.explication") : t("film2.explicationPrete")}</p>}

    {!landed && <div className="u-film-dock">
      {priseQuote === null && <p id="u-film-sans-prix" className="u-film-note" data-film-sans-prix="">{t("film2.reglages.sansPrixLong")}</p>}
      <button type="button" className="u-film-gold" data-film-tourner="" disabled={running || priseQuote === null} aria-describedby={running ? "u-film-running" : priseQuote === null ? "u-film-sans-prix" : undefined} onClick={failed && launched ? () => void go() : ask}>
        <span>{failed && launched ? t("film2.reessayer") : t("film2.tourner")}</span><span className="u-film-price">· {prix}</span>
      </button>
    </div>}

    {reglagesOuverts && <FilmReglages value={reglages} onChange={changerReglages} prix={prixPrise} onClose={() => setReglagesOuverts(false)} />}
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
        <p className="u-film-after" data-film-apres-lancer="">{balance ? t(autreDuPlan ? "film2.soldeApresAutre" : "film2.soldeApres", { n: formatCredits(Math.max(0, balance.credits - total)) }) : t(autreDuPlan ? "film2.soldeInconnuAutre" : "film2.soldeInconnu")}</p>
        <button ref={lancer} type="button" className="u-film-gold" data-film-lancer="" onClick={() => void go()}><span>{t("film2.lancer")}</span><span className="u-film-price">· {prix}</span></button>
        <div className="u-film-sheet-row">
          <button type="button" className="u-secondary" data-film-modifier="" onClick={() => { setAsking(false); field.current?.focus(); }}>{t("film2.modifier")}</button>
          <button type="button" className="u-secondary" aria-expanded={envoye} data-film-envoye="" onClick={() => setEnvoye(value => !value)}>{t("film2.envoye")}</button>
        </div>
        {envoye && <p className="u-film-sent" data-film-sent="">{t("film2.envoyeLead")}<br /><q>{ligne}</q><br /><small data-film-moteur="">{t("film2.reglages.moteur", { moteur: settings.engine === "h3" ? "MiniMax H3" : "LTX 2.5 (aperçu)" })}</small></p>}
      </div>
    </div>}
  </section>;
}
