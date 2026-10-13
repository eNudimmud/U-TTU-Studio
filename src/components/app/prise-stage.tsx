"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { assetPath } from "@/lib/site";
import { DEMO_CAST, DEMO_DECOR } from "@/lib/creation/demo";
import { TUILES, tuileById, tuileInText, tuileNeedsPair, type TuileId } from "@/lib/cinema/tuiles";
import {
  addFigure, addNeutral, applyTuile, astuce, autreEssai, canAddFigure, captureLine, initialMaquette, MAX_FIGURES, moveFigure, orbitDrag, pinch, removeFigure, scenePhrase, seedLead, toggleLock, undoMaquette, yawFigure,
  type MaquetteState,
} from "@/lib/maquette/state";
import {
  ACTION_EXAMPLES, ACTION_MAX,
  DUREE_DIX, ETAT_LABEL, PAS_MESURE,
  type PlanEtat,
} from "@/lib/prise/copy";
import { decide, emptyPlan, primaryIntent, type PlanInput } from "@/lib/prise/decision";
import { chooseFinaliser, finaliserDefaults, type FinaliserInput, type FinalMedia } from "@/lib/prise/finaliser";
import { buildPrompt } from "@/lib/prise/prompt";
import { moveId, planFromJson, planJson, planMarkdown, planStateFromJson, priseMarkdown, type StoredPlan } from "@/lib/prise/vault";
import type { Shot } from "@/lib/coffre/model";
import { useI18n } from "@/components/i18n/provider";
import { FormatSwitch, useFormat } from "./format-switch";
import { MaquetteView } from "./maquette-view";
import { useStudio } from "./studio-session";

type Seed = "vide" | "compose" | "final";

interface Draft {
  id: string;
  name: string;
  input: PlanInput;
  kept: boolean;
  finalised: boolean;
  hasTake: boolean;
  before: string;
  after: string;
}

interface ClickAction {
  label: string;
  price: string;
  enabled: boolean;
  reason: string;
  onClick(): void;
}

function fr(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function priceOf(quote: number | null): string {
  return quote === null ? "" : ` · ${fr(quote)}`;
}

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function etatOf(draft: Draft): PlanEtat {
  if (draft.finalised) return "finalisee";
  if (draft.kept) return "gardee";
  if (draft.hasTake) return "prise";
  if (draft.input.imageCle === "validee") return "validee";
  if (draft.input.imageCle === "proposee") return "image-cle";
  return "vide";
}

function personSrc(preview: string | null | undefined, sheet: string | null | undefined, media: Record<string, string>): string {
  if (preview) return assetPath(preview);
  if (sheet && media[sheet]) return media[sheet];
  return "";
}

export function PriseStage({ goCast, goDecor, onMontage }: { goCast(): void; goDecor(): void; onMontage(): void }) {
  const { ready, cast, decor, media, studio, pickedDecor, requestRun, writeProjectFile, pickCast, pickDecor, run, cancelRun, sendToMontage } = useStudio();
  const { t } = useI18n();
  const { format } = useFormat();
  const [seed, setSeed] = useState<Seed>("vide");
  const [drafts, setDrafts] = useState<Draft[]>(() => [blank("plan-01", "Plan 01", "16:9")]);
  const [currentId, setCurrentId] = useState("plan-01");
  const [dragId, setDragId] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [mediaKind, setMediaKind] = useState<FinalMedia>("video");
  const [finaliser, setFinaliser] = useState<FinaliserInput>(finaliserDefaults("video", 5));
  const [details, setDetails] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [ask, setAsk] = useState<"composer" | null>(null);
  const [maquette, setMaquette] = useState<MaquetteState>(() => initialMaquette());
  const [sending, setSending] = useState(false);
  const [picker, setPicker] = useState(false);
  const [placeCleared, setPlaceCleared] = useState(false);
  const booted = useRef(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (!ready || booted.current) return;
    booted.current = true;
    const asked = new URLSearchParams(window.location.search).get("prise");
    if (asked === "compose" || asked === "final") {
      const next = demoDraft(asked, format);
      setSeed(asked);
      setDrafts([next]);
      setCurrentId(next.id);
      setPanel(asked === "final");
      setFinaliser(finaliserDefaults("video", next.input.duree));
      return;
    }
    const stored = studio.shots.filter(shot => shot.composeur);
    if (stored.length === 0) return;
    const next = stored
      .slice()
      .sort((a, b) => a.ordre - b.ordre)
      .map(shot => draftFromShot(shot, format));
    setDrafts(next);
    setCurrentId(next[0]?.id ?? "plan-01");
  }, [ready, format, studio.shots]);

  const people = useMemo(() => {
    const cards = cast.length > 0 ? cast : seed === "vide" ? [] : DEMO_CAST;
    return cards.map(card => ({
      id: card.id,
      name: card.name,
      planche: Boolean(card.sheet),
      src: personSrc(card.preview, card.sheet, media),
    }));
  }, [cast, media, seed]);

  const places = useMemo(() => {
    if (decor.length > 0) {
      return decor.map(card => ({
        id: card.id,
        name: card.name,
        note: card.prompt ?? "",
        src: card.preview ? assetPath(card.preview) : card.sheet && media[card.sheet] ? media[card.sheet] : "",
      }));
    }
    if (seed === "vide") return [];
    return DEMO_DECOR.map(card => ({ id: card.id, name: card.name, note: card.prompt, src: card.preview ? assetPath(card.preview) : "" }));
  }, [decor, media, seed]);

  const castKey = `${drafts.find(item => item.id === currentId)?.input.castIds.join(",") ?? ""}|${people.map(person => `${person.id}:${person.name}`).join(",")}`;
  useEffect(() => {
    if (seeded.current || people.length === 0) return;
    const chosenIds = drafts.find(item => item.id === currentId)?.input.castIds ?? [];
    const lead = (chosenIds.length > 0 ? people.find(person => person.id === chosenIds[0]) : people[0]) ?? null;
    if (!lead) return;
    seeded.current = true;
    setMaquette(state => seedLead(state, { id: lead.id, name: lead.name }));
    const tile = tuileById("regard");
    const placeId = places.find(place => place.id === pickedDecor)?.id ?? places[0]?.id ?? null;
    setDrafts(list => list.map(item => {
      if (item.id !== currentId || item.input.action.trim()) return item;
      return {
        ...item,
        input: {
          ...item.input,
          castIds: item.input.castIds.length > 0 ? item.input.castIds : [lead.id],
          decorId: item.input.decorId ?? placeId,
          action: scenePhrase([lead.name], t("r7.tuile.regard"), t("r7.link")),
          cadrage: tile.cadrage,
          camera: tile.camera,
        },
      };
    }));
  }, [castKey, people, drafts, currentId, places, pickedDecor, t]);

  const index = Math.max(0, drafts.findIndex(item => item.id === currentId));
  const draft = drafts[index] ?? drafts[0];
  const previous = index > 0 ? drafts[index - 1] : null;

  function patch(partial: Partial<PlanInput>) {
    const next = drafts.map(item => item.id === draft.id ? { ...item, input: { ...item.input, ...partial, format } } : item);
    setDrafts(next);
    setAsk(null);
    persist(next);
  }

  useEffect(() => {
    setDrafts(list => list.map(item => item.input.format === format ? item : { ...item, input: { ...item.input, format } }));
  }, [format]);

  if (!draft) return null;

  const shownPlace = draft.input.decorId
    ? places.find(place => place.id === draft.input.decorId) ?? null
    : placeCleared
      ? null
      : places.find(place => place.id === pickedDecor) ?? places[0] ?? null;
  const input: PlanInput = {
    ...draft.input,
    format,
    castIds: maquette.figures.map(figure => figure.id),
    castNames: maquette.figures.map(figure => figure.name),
    castPlanche: maquette.figures.map(figure => people.find(person => person.id === figure.id)?.planche ?? false),
    decorId: shownPlace?.id ?? null,
    decorName: shownPlace?.name ?? "",
    decorNote: shownPlace?.note ?? "",
    cadrage: tuileById(maquette.tuile).cadrage,
    camera: tuileById(maquette.tuile).camera,
    speakerName: draft.input.speakerName || maquette.figures[0]?.name || "",
    previousKept: Boolean(previous && (previous.kept || previous.finalised)),
    hasKeptTake: draft.kept || draft.finalised,
  };
  const intent = primaryIntent(input);
  const cardDecision = decide(input, intent);
  const composer = decide(input, "composer");
  const essai = decide(input, "essai");
  const tourner = decide(input, "tourner");
  const fin = chooseFinaliser({ ...finaliser, media: mediaKind, seconds: input.duree });
  const showFinal = panel || draft.finalised;
  const cadre = captureLine(maquette, tuileById(maquette.tuile).prompt);
  const prompt = buildPrompt(input, showFinal ? { graph: fin.graph, son: false } : cardDecision, { cadre });
  const tip = astuce(maquette);
  const tileLabels = TUILES.map(item => ({ id: item.id, label: t(`r7.tuile.${item.id}`) }));
  const knownLabels = [...tileLabels, ...TUILES.map(item => ({ id: item.id, label: item.label }))];
  const etat = etatOf(draft);
  function planWord(item: Draft): string {
    const mark = etatOf(item);
    if (mark !== "vide") return ETAT_LABEL[mark];
    const live = item.id === draft.id;
    const filled = Boolean(item.input.action.trim() || item.input.castIds.length > 0 || item.input.decorId)
      || (live && (maquette.figures.length > 0 || Boolean(shownPlace)));
    return filled ? t("r7.enPlace") : ETAT_LABEL.vide;
  }
  const total = drafts.reduce((sum, item) => sum + item.input.duree, 0);
  const planLabel = `Plan ${String(index + 1).padStart(2, "0")}`;

  let gold: ClickAction & { composer: boolean };
  let extra: ClickAction | null = null;
  if (etat === "image-cle") {
    gold = { label: "Garder ce cadre", price: "", enabled: true, reason: "", composer: false, onClick: () => patch({ imageCle: "validee" }) };
    extra = { label: "Refaire", price: priceOf(composer.quote), enabled: composer.enabled, reason: composer.reason, onClick: () => { if (composer.enabled) setAsk("composer"); } };
  } else if (etat === "validee") {
    gold = { label: "Tourner", price: priceOf(tourner.quote), enabled: tourner.enabled, reason: tourner.reason, composer: false, onClick: () => {} };
  } else if (etat === "prise") {
    gold = { label: "★ Garder", price: "", enabled: true, reason: "", composer: false, onClick: keep };
    extra = { label: "Autre prise", price: "", enabled: false, reason: PAS_MESURE, onClick: () => {} };
  } else if (etat === "gardee" || etat === "finalisee") {
    gold = { label: FINAL_LABEL, price: priceOf(fin.quote), enabled: fin.enabled, reason: fin.reason || PAS_MESURE, composer: false, onClick: () => setPanel(true) };
  } else {
    gold = { label: "Composer l'image", price: "", enabled: composer.enabled, reason: composer.reason, composer: true, onClick: () => { if (composer.enabled) setAsk("composer"); } };
    extra = { label: "Essai rapide", price: "", enabled: essai.enabled, reason: essai.reason, onClick: () => { if (essai.enabled) void requestRun(); } };
  }
  const reasonText = gold.enabled ? "" : gold.reason;
  const extraReason = extra && !extra.enabled && extra.reason && extra.reason !== reasonText ? extra.reason : "";

  function persist(next: Draft[], focus = draft.id) {
    const shot = next.find(item => item.id === focus);
    if (!shot) return;
    const ordre = next.findIndex(item => item.id === focus);
    const decision = decide({ ...shot.input, format }, primaryIntent({ ...shot.input, format }));
    const record: StoredPlan = {
      id: shot.id,
      name: shot.name,
      ordre,
      etat: etatOf(shot),
      input: { ...shot.input, format },
      graph: decision.graph ?? "",
      pourquoi: decision.pourquoi,
      takeIds: [],
      imageCle: shot.before,
      imageFin: "",
      finalVideo: shot.finalised ? shot.after : "",
    };
    void writeProjectFile(`Shots/${shot.id}.md`, planMarkdown(record));
  }

  function addPlan() {
    const n = drafts.length + 1;
    const id = `plan-${String(n).padStart(2, "0")}`;
    const next = [...drafts, blank(id, `Plan ${String(n).padStart(2, "0")}`, format)];
    setDrafts(next);
    setCurrentId(id);
    setPanel(false);
    persist(next, id);
  }

  function dropOn(id: string) {
    if (!dragId || dragId === id) return;
    const order = moveId(drafts.map(item => item.id), dragId, id);
    const next = order.flatMap(key => {
      const found = drafts.find(item => item.id === key);
      return found ? [found] : [];
    });
    setDrafts(next);
    setDragId(null);
    persist(next, id);
  }

  function onWho(id: string) {
    if (maquette.figures.some(figure => figure.id === id)) {
      if (maquette.lockPose) return;
      placeFigure(removeFigure(maquette, id));
      return;
    }
    const person = people.find(item => item.id === id);
    if (!person || !canAddFigure(maquette)) return;
    placeFigure(addFigure(maquette, { id: person.id, name: person.name }));
    if (cast.some(card => card.id === id)) void pickCast(id);
  }

  function choosePlace(id: string) {
    const current = draft.input.decorId ?? shownPlace?.id ?? null;
    if (current === id) {
      setPlaceCleared(true);
      patch({ decorId: null });
      return;
    }
    setPlaceCleared(false);
    patch({ decorId: id });
    if (decor.some(card => card.id === id)) void pickDecor(id);
  }

  function phraseFor(names: string[], shot: string): string {
    return scenePhrase(names, shot, t("r7.link"));
  }

  function chooseTuile(id: TuileId) {
    if (tuileNeedsPair(id) && maquette.figures.length < 2) return;
    const preset = tuileById(id);
    setMaquette(state => applyTuile(state, id));
    patch({
      cadrage: preset.cadrage,
      camera: preset.camera,
      action: phraseFor(maquette.figures.map(figure => figure.name), t(`r7.tuile.${id}`)),
    });
  }

  function onAction(action: string) {
    const id = tuileInText(action, knownLabels);
    if (id && tuileNeedsPair(id) && maquette.figures.length < 2) {
      patch({ action });
      return;
    }
    if (id && id !== maquette.tuile) {
      const preset = tuileById(id);
      setMaquette(state => applyTuile(state, id));
      patch({ action, cadrage: preset.cadrage, camera: preset.camera });
      return;
    }
    patch({ action });
  }

  function placeFigure(next: MaquetteState) {
    setMaquette(next);
    setPicker(false);
    const preset = tuileById(next.tuile);
    const names = next.figures.map(figure => figure.name);
    const shot = t(`r7.tuile.${next.tuile}`);
    const written = tuileInText(draft.input.action, knownLabels);
    patch({
      castIds: next.figures.map(figure => figure.id),
      decorId: draft.input.decorId ?? (placeCleared ? null : shownPlace?.id ?? null),
      cadrage: preset.cadrage,
      camera: preset.camera,
      action: !draft.input.action.trim() || written ? phraseFor(names, shot) : phraseFor(names, draft.input.action),
    });
  }

  async function envoyer() {
    if (sending) return;
    setSending(true);
    const still = places.find(place => place.id === input.decorId)?.src
      || people.find(person => person.id === input.castIds[0])?.src
      || "/exemples/decor-piece.webp";
    try {
      await sendToMontage({
        planId: draft.id,
        label: draft.input.action.trim() || t(`r7.tuile.${maquette.tuile}`),
        seconds: input.duree,
        aspect: input.format === "9:16" ? "vertical" : "horizontal",
        still,
        prompt: prompt.text,
        sceneName: input.decorName,
        composeur: planJson(input, { etat: etatOf(draft), before: draft.before, after: draft.after }),
      });
      onMontage();
    } finally {
      setSending(false);
    }
  }

  function keep() {
    if (!(draft.hasTake || draft.kept || draft.finalised)) return;
    const next = drafts.map(item => item.id === draft.id ? { ...item, kept: true } : item);
    setDrafts(next);
    setPanel(true);
    setFinaliser(finaliserDefaults("video", input.duree));
    persist(next);
    const video = `Prises/${draft.id}-prise.mp4`;
    void writeProjectFile(`Prises/${draft.id}-prise.md`, priseMarkdown({
      id: `${draft.id}-prise`,
      planId: draft.id,
      template: tourner.graph ?? "",
      entrees: [...input.castIds.map(id => `Cast/${id}`), ...(input.decorId ? [`Lieux/${input.decorId}`] : [])],
      camera: input.camera,
      duree: input.duree,
      devis: tourner.quote ?? "inconnu",
      plafond: tourner.cap,
      cout: 0,
      promptId: "",
      etat: "gardee",
      date: "2026-10-08",
      video,
      finalVideo: "",
      prompt: prompt.text,
    }));
  }

  const card = showFinal
    ? {
      titre: "Finaliser",
      mots: fin.sentence,
      pourquoi: fin.sentence,
      quote: fin.quote,
      cap: fin.cap,
      statut: fin.statut,
      graph: fin.graph,
      enabled: fin.enabled,
      reason: fin.reason,
    }
    : cardDecision;
  const quoteLine = card.quote === null
    ? "Devis : inconnu"
    : `Devis : ${fr(card.quote)} · ${card.statut === "mesure" ? "mesuré" : card.statut === "hypothese" ? "hypothèse" : "inconnu"}${card.cap !== null ? ` · Plafond ${fr(card.cap)}` : ""}`;
  const sameAsMots = Boolean(reasonText) && reasonText === card.mots;
  const sameAsPourquoi = Boolean(reasonText) && reasonText === card.pourquoi;

  return <section className="u-stage u-prise" data-section="prise" data-prise-ready={ready ? "true" : undefined} data-prise-seed={seed} aria-labelledby="u-title">
    <aside className="u-prise-strip" aria-label="Plans">
      <p className="u-label">Plans</p>
      <div className="u-prise-film">
        {drafts.map((item, at) => {
          const mark = etatOf(item);
          const thumb = item.before || "";
          const word = planWord(item);
          return <button
            key={item.id}
            type="button"
            className="u-plan-card"
            draggable
            aria-current={item.id === draft.id ? "true" : undefined}
            data-etat={mark}
            onDragStart={() => setDragId(item.id)}
            onDragOver={event => event.preventDefault()}
            onDrop={() => dropOn(item.id)}
            onClick={() => { setCurrentId(item.id); setPanel(item.finalised || item.kept); setAsk(null); }}
          >
            <span className="u-plan-num">{String(at + 1).padStart(2, "0")}</span>
            <span className={thumb ? "u-plan-thumb" : "u-plan-thumb is-empty"}>{thumb ? <img src={thumb} alt="" /> : null}</span>
            <span className="u-plan-etat">{word}</span>
            <span className="u-plan-time">{item.input.duree} s</span>
          </button>;
        })}
        <button type="button" className="u-plan-add" onClick={addPlan}>＋ Plan</button>
      </div>
      <p className="u-plan-sum">Séquence : {clock(total)} / {drafts.length} {drafts.length > 1 ? "plans" : "plan"}</p>
    </aside>

    <div className="u-prise-side">
    <div className="u-prise-preview">
      <p className="u-label">Aperçu</p>
      {run.phase === "running" && <div className="u-card u-run" role="status">
        <p className="u-run-label">{t("job.running")}</p>
        <button type="button" className="u-link" onClick={cancelRun}>{t("verb.cancel")}</button>
      </div>}
      {draft.finalised && draft.before
        ? <Compare before={draft.before} after={draft.after || draft.before} ratio={format} />
        : <MaquetteView
          state={maquette}
          backdrop={shownPlace?.src || ""}
          placeName={shownPlace?.name || ""}
          badge={t(`r7.tuile.${maquette.tuile}`)}
          hint={t("r7.hint")}
          onMove={(id, x, z) => setMaquette(state => moveFigure(state, id, x, z))}
          onOrbit={(dx, dy) => setMaquette(state => orbitDrag(state, dx, dy))}
          onPinch={(previous, distance) => setMaquette(state => pinch(state, previous, distance))}
        />}
      <div className="u-maquette-tools">
        <button type="button" className="u-lock" aria-pressed={maquette.lockPose} onClick={() => setMaquette(state => toggleLock(state, "pose"))}>{maquette.lockPose ? "🔒" : "🔓"} {t("r7.pose")}</button>
        <button type="button" className="u-lock" aria-pressed={maquette.lockCam} onClick={() => setMaquette(state => toggleLock(state, "cam"))}>{maquette.lockCam ? "🔒" : "🔓"} {t("r7.cam")}</button>
        <button type="button" data-autre-essai="" onClick={() => setMaquette(state => autreEssai(state))}>🎲 {t("r7.essai")} <small>{t("r7.gratuit")}</small></button>
        <button type="button" disabled={maquette.past.length === 0} aria-describedby={maquette.past.length === 0 ? "u-why-annuler" : undefined} onClick={() => setMaquette(state => undoMaquette(state))}>{t("r7.annuler")}</button>
        <button type="button" data-add-person="" disabled={!canAddFigure(maquette)} aria-describedby={!canAddFigure(maquette) ? "u-why-cap" : undefined} onClick={() => setPicker(open => !open)}>{t("r7.add")}</button>
      </div>
      {maquette.past.length === 0 && <p className="u-why" id="u-why-annuler">{t("r7.annulerOff")}</p>}
      {!canAddFigure(maquette) && <p className="u-why" id="u-why-cap">{t("r7.addOff", { max: MAX_FIGURES })}</p>}
      {picker && canAddFigure(maquette) && <div className="u-picker" data-personnage-picker="">
        {people.filter(person => !maquette.figures.some(figure => figure.id === person.id)).map(person => (
          <button key={person.id} type="button" data-pick={person.id} onClick={() => placeFigure(addFigure(maquette, { id: person.id, name: person.name }))}>{person.name}</button>
        ))}
        <button type="button" data-pick="neutre" onClick={() => placeFigure(addNeutral(maquette, t("r7.neutralName")))}>{t("r7.neutral")}</button>
        <button type="button" onClick={() => setPicker(false)}>{t("verb.cancel")}</button>
      </div>}
      <ul className="u-figure-row">
        {maquette.figures.map(figure => <li key={figure.id}>
          <span className="u-figure-name"><i className="u-swatch" style={{ background: figure.color }} aria-hidden="true" />{figure.name}</span>
          <button type="button" className="u-chip" data-tourner={figure.id} disabled={maquette.lockPose} aria-describedby={maquette.lockPose ? "u-why-pose" : undefined} aria-label={t("r7.turnName", { name: figure.name })} onClick={() => setMaquette(state => yawFigure(state, figure.id, Math.PI / 4))}>{t("r7.turn")}</button>
          <button type="button" className="u-chip" data-retirer={figure.id} disabled={maquette.lockPose} aria-describedby={maquette.lockPose ? "u-why-pose" : undefined} aria-label={t("r7.removeName", { name: figure.name })} onClick={() => placeFigure(removeFigure(maquette, figure.id))}>{t("r7.remove")}</button>
        </li>)}
      </ul>
      {maquette.lockPose && <p className="u-why" id="u-why-pose">{t("r7.poseLock")}</p>}
      <p className="u-why" data-astuce={tip.id}>{t(`r7.astuce.${tip.id}`, { name: tip.name })}</p>
      <button type="button" className="u-link" data-lire-sequence="" data-envoyer-montage="" disabled={sending} aria-describedby={sending ? "u-why-envoyer" : undefined} onClick={() => void envoyer()}>{t("r7.envoyer")}</button>
      {sending && <p className="u-why" id="u-why-envoyer">{t("nav.opening")}</p>}
    </div>

    <aside className="u-prise-dock" aria-label="Ce que l'app va faire">
      <div className="u-prise-card" id="u-prise-card" data-row={showFinal ? "final" : cardDecision.row}>
        <p className="u-label">Ce que l'app va faire</p>
        <p className="u-prise-brief" data-lire-maquette="">
          <span>{t("r7.lireCast")} : {maquette.figures.map(figure => figure.name).join(", ") || "—"}</span>
          <span>{t("r7.lireLieu")} : {shownPlace?.name || "—"}</span>
          <span>{t("r7.lireCadrage")} : {t(`r7.tuile.${maquette.tuile}`)}</span>
        </p>
        <h2>{card.titre || "En attente"}</h2>
        {card.mots && !sameAsMots && <p>{card.mots}</p>}
        {card.pourquoi && card.pourquoi !== card.mots && !sameAsPourquoi && <p>{card.pourquoi}</p>}
        <p className="u-prise-quote">{quoteLine}</p>
        <button type="button" className="u-link" aria-expanded={details} onClick={() => setDetails(open => !open)}>Détails</button>
        {details && <div className="u-prise-details">
          {card.graph && <p>Graphe : {card.graph}</p>}
          {showFinal && fin.graphs.filter(item => !item.choisi).map(item => <p key={item.id}>{item.role} : {item.note}</p>)}
          <button type="button" className="u-link" aria-expanded={textOpen} onClick={() => setTextOpen(open => !open)}>Texte envoyé</button>
          {textOpen && <textarea className="u-prise-prompt" readOnly value={prompt.text} aria-label="Texte envoyé" />}
        </div>}
      </div>

      {showFinal && <FinalPanel
        value={{ ...finaliser, media: mediaKind, seconds: input.duree }}
        onMedia={next => { setMediaKind(next); setFinaliser(finaliserDefaults(next, input.duree)); }}
        onChange={setFinaliser}
        plan={fin}
      />}

      <div className="u-prise-actions">
        <p className="u-prise-quote u-bar-quote">{quoteLine}</p>
        {reasonText && <p className="u-why" id="u-prise-reason">{reasonText}</p>}
        <button type="button" className="u-primary" data-composer-gold={gold.composer ? "" : undefined} disabled={!gold.enabled} aria-describedby={reasonText ? "u-prise-reason" : undefined} onClick={gold.onClick}>{gold.label}{gold.price}</button>
        {ask === "composer" && <p className="u-why" id="u-why-branch">L'envoi de l'image clé n'est pas branché dans cette version. Rien ne part.</p>}
        {extra && <button type="button" className="u-secondary" disabled={!extra.enabled} aria-describedby={!extra.enabled && extra.reason ? (extra.reason === reasonText ? "u-prise-reason" : "u-prise-extra") : undefined} onClick={extra.onClick}>{extra.label}{extra.price}</button>}
        {extraReason && <p className="u-why" id="u-prise-extra">{extraReason}</p>}
      </div>
    </aside>
    </div>

    <div className="u-prise-work">
      <header className="u-prise-head">
        <div className="u-prise-title">
          <h1 id="u-title" tabIndex={-1}>{planLabel}</h1>
          <FormatSwitch />
        </div>
        <p className="u-plan-etat">{planWord(draft)}</p>
      </header>

      <Row className="u-who-row" label="Qui ?">
        <div className="u-choice-row u-who">
          {maquette.figures.map(figure => {
            const person = people.find(item => item.id === figure.id);
            const locked = maquette.lockPose;
            return <button key={figure.id} type="button" className="u-avatar" aria-pressed={true} disabled={locked} aria-describedby={locked ? "u-why-pose" : undefined} onClick={() => onWho(figure.id)}>
              <span className="u-avatar-face" style={{ boxShadow: `inset 0 0 0 3px ${figure.color}` }}>{person?.src ? <img src={person.src} alt="" /> : <i style={{ background: figure.color }} />}</span>
              <span>{figure.name}</span>
            </button>;
          })}
          {people.filter(person => !maquette.figures.some(figure => figure.id === person.id)).map(person => {
            const blocked = !canAddFigure(maquette);
            return <button key={person.id} type="button" className="u-avatar" aria-pressed={false} disabled={blocked} aria-describedby={blocked ? "u-why-cap" : undefined} onClick={() => onWho(person.id)}>
              <span className="u-avatar-face">{person.src ? <img src={person.src} alt="" /> : <i />}</span>
              <span>{person.name}</span>
            </button>;
          })}
          <button type="button" className="u-avatar u-add-tile" onClick={goCast}>
            <span className="u-avatar-face is-empty" aria-hidden="true"><AddPersonIcon /></span>
            <span>Ajouter un personnage</span>
          </button>
        </div>
      </Row>

      <Row label="Où ?">
        <div className="u-choice-row u-where">
          {places.map(place => {
            const on = shownPlace?.id === place.id;
            return <button key={place.id} type="button" className="u-place" aria-pressed={on} onClick={() => choosePlace(place.id)}>
              <span className="u-place-face">{place.src ? <img src={place.src} alt="" /> : <i />}</span>
              <span>{place.name}</span>
            </button>;
          })}
          <button type="button" className="u-place u-add-tile" onClick={goDecor}>
            <span className="u-place-face is-empty" aria-hidden="true"><AddPlaceIcon /></span>
            <span>Ajouter un lieu</span>
          </button>
        </div>
      </Row>

      <Row className="u-scene-row" label={t("r7.cequi")}>
        <label className="u-field">
          <textarea aria-label={t("r7.cequi")} value={input.action} rows={3} maxLength={ACTION_MAX} placeholder={ACTION_PLACEHOLDER} onChange={event => onAction(event.target.value)} />
        </label>
        <div className="u-choice-row u-actions">
          {ACTION_EXAMPLES.map(example => (
            <button key={example} type="button" className="u-chip" aria-pressed={input.action === example} onClick={() => onAction(example)}>{example}</button>
          ))}
        </div>
      </Row>

      <Row className="u-tuiles-row" label={t("r7.tuiles")}>
        <div className="u-tuiles" data-tuiles="">
          {TUILES.map(item => {
            const needsPair = tuileNeedsPair(item.id) && maquette.figures.length < 2;
            const hint = needsPair
              ? t("r7.pairShort")
              : item.id === "taille" && maquette.figures.length > 2
                ? t("r7.tuile.tailleHintMany")
                : item.id === "regard" && maquette.figures.length > 1
                  ? t("r7.tuile.regardHintMany")
                  : t(`r7.tuile.${item.id}Hint`);
            return <button key={item.id} type="button" className="u-tuile" data-tuile={item.id} aria-pressed={maquette.tuile === item.id} disabled={needsPair} aria-describedby={needsPair ? "u-why-paire" : undefined} onClick={() => chooseTuile(item.id)}>
              <span>{t(`r7.tuile.${item.id}`)}</span>
              <small>{hint}</small>
            </button>;
          })}
        </div>
        {maquette.figures.length < 2 && <p className="u-why" id="u-why-paire">{t("r7.pairWhy")}</p>}
      </Row>

      <Row label="Durée">
        <div className="u-choice-row u-duree">
          {([5, 8] as const).map(seconds => (
            <button key={seconds} type="button" className="u-chip" aria-pressed={input.duree === seconds} onClick={() => patch({ duree: seconds })}>{seconds} s</button>
          ))}
          <button type="button" className="u-chip" disabled aria-describedby="u-why-dix">10 s</button>
        </div>
        <p className="u-why" id="u-why-dix">{DUREE_DIX}</p>
      </Row>

      <details className="u-fold">
        <summary>Paroles · {input.paroles === "aucune" ? "Aucune" : input.paroles === "voix-off" ? "Voix off" : "Réplique"}</summary>
        <div className="u-choice-row">
          {(["aucune", "replique", "voix-off"] as const).map(mode => (
            <button key={mode} type="button" className="u-chip" aria-pressed={input.paroles === mode} onClick={() => patch({ paroles: mode })}>
              {mode === "aucune" ? "Aucune" : mode === "replique" ? "Réplique" : "Voix off"}
            </button>
          ))}
        </div>
        {input.paroles === "replique" && <>
          <div className="u-choice-row">
            {input.castIds.map(id => {
              const person = people.find(item => item.id === id);
              if (!person) return null;
              return <button key={id} type="button" className="u-chip" aria-pressed={input.speakerName === person.name || (!input.speakerName && input.castIds[0] === id)} onClick={() => patch({ speakerName: person.name })}>{person.name}</button>;
            })}
          </div>
          <label className="u-field">
            <span className="u-label">La phrase</span>
            <textarea value={input.replique} rows={1} maxLength={ACTION_MAX} onChange={event => patch({ replique: event.target.value })} />
          </label>
        </>}
      </details>

      <details className="u-fold">
        <summary>Enchaîner · {input.enchainer ? "oui" : "non"}</summary>
        <button type="button" className="u-chip" aria-pressed={input.enchainer} onClick={() => patch({ enchainer: !input.enchainer })}>Commencer là où le plan précédent s'arrête</button>
        {!input.previousKept && input.enchainer && <p className="u-why">Le plan précédent n'est pas encore gardé.</p>}
        <button type="button" className="u-chip" aria-pressed={input.imageFin} onClick={() => patch({ imageFin: !input.imageFin })}>Imposer l'image de fin</button>
      </details>
    </div>

  </section>;
}

const ACTION_PLACEHOLDER = "reste immobile, respire";

function blank(id: string, name: string, format: PlanInput["format"]): Draft {
  return { id, name, input: emptyPlan(format), kept: false, finalised: false, hasTake: false, before: "", after: "" };
}

function demoDraft(seed: "compose" | "final", format: PlanInput["format"]): Draft {
  const input = emptyPlan(format);
  input.castIds = ["demo-uttu", "demo-coursiere"];
  input.decorId = "demo-quai";
  input.cadrage = "moyen";
  input.camera = "travelling-avant";
  input.action = "se retourne";
  input.duree = 5;
  const quai = assetPath("/exemples/decor-quai-nuit.webp");
  if (seed === "final") {
    input.imageCle = "validee";
    return {
      id: "plan-03",
      name: "Plan 03",
      input,
      kept: true,
      finalised: true,
      hasTake: true,
      before: quai,
      after: quai,
    };
  }
  return { id: "plan-03", name: "Plan 03", input, kept: false, finalised: false, hasTake: false, before: "", after: "" };
}

function draftFromShot(shot: Shot, format: PlanInput["format"]): Draft {
  const input = planFromJson(shot.composeur, emptyPlan(format));
  const state = planStateFromJson(shot.composeur);
  return {
    id: shot.id,
    name: shot.name || shot.id,
    input,
    kept: state.etat === "gardee" || state.etat === "finalisee",
    finalised: state.etat === "finalisee",
    hasTake: state.etat === "prise" || state.etat === "gardee" || state.etat === "finalisee" || shot.takeIds.length > 0,
    before: state.before,
    after: state.after,
  };
}

function Row({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={className ? `u-prise-row ${className}` : "u-prise-row"}>
    <p className="u-label">{label}</p>
    {children}
  </div>;
}

function FinalPanel({ value, onMedia, onChange, plan }: {
  value: FinaliserInput;
  onMedia(next: FinalMedia): void;
  onChange(next: FinaliserInput): void;
  plan: ReturnType<typeof chooseFinaliser>;
}) {
  return <div className="u-final" data-finaliser="">
    <p className="u-label">Finaliser</p>
    <div className="u-choice-row" role="group" aria-label="Ce qu'on agrandit">
      <button type="button" className="u-chip" aria-pressed={value.media === "video"} onClick={() => onMedia("video")}>La prise</button>
      <button type="button" className="u-chip" aria-pressed={value.media === "image"} onClick={() => onMedia("image")}>L'image</button>
    </div>
    <p className="u-label">Résolution</p>
    <div className="u-choice-row">
      <button type="button" className="u-chip" aria-pressed={value.resolution === "1080p"} onClick={() => onChange({ ...value, resolution: "1080p" })}>1080p</button>
      <button type="button" className="u-chip" disabled aria-describedby="u-why-4k" aria-pressed={false}>4K</button>
    </div>
    <p className="u-why" id="u-why-4k">{plan.resolution4k.reason}</p>
    <button type="button" className="u-chip" aria-pressed={value.nettete} onClick={() => onChange({ ...value, nettete: !value.nettete })}>Netteté et détails</button>
    {value.media === "video" && <button type="button" className="u-chip" aria-pressed={value.fluidifier} onClick={() => onChange({ ...value, fluidifier: !value.fluidifier })}>Fluidifier</button>}
  </div>;
}

function Compare({ before, after, ratio }: { before: string; after: string; ratio: string }) {
  const [pos, setPos] = useState(58);
  return <div className="u-compare">
    <p className="u-compare-legend"><span>Avant</span><span>Après</span></p>
    <div className="u-prise-frame" data-ratio={ratio}>
      <img src={after} alt="Après" />
      <img className="u-compare-soft" src={before} alt="Avant" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
    </div>
    <input type="range" min={0} max={100} value={pos} aria-label="Comparer avant et après" onChange={event => setPos(Number(event.target.value))} />
  </div>;
}

function AddPersonIcon() {
  return <svg className="u-ico u-add-ico" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="11" r="4" />
    <path d="M8 26c1.4-5 4.2-7 8-7s6.6 2 8 7" />
  </svg>;
}

function AddPlaceIcon() {
  return <svg className="u-ico u-add-ico" viewBox="0 0 32 24" aria-hidden="true">
    <rect x="3" y="6" width="26" height="14" rx="2" />
    <path d="M3 16 10 11l5 5 4-3 10 7" />
  </svg>;
}

const FINAL_LABEL = "Finaliser (agrandir)";
