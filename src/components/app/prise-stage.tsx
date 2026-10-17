"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { maquetteJson, readMaquette } from "@/lib/maquette/persistence";
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
import { parseQuartier, type Quartier } from "@/lib/repere/quartier";
import { moveId, planFromJson, planJson, planMarkdown, planStateFromJson, type StoredPlan } from "@/lib/prise/vault";
import type { Shot } from "@/lib/coffre/model";
import { useI18n } from "@/components/i18n/provider";
import { montrerDepart } from "@/lib/creation/depart";
import { ExempleDepart } from "./exemple-depart";
import { FormatSwitch, useFormat } from "./format-switch";
import { MaquetteView } from "./maquette-view";
import { useStudio } from "./studio-session";
import { VideoGestes, type PrevisClip } from "./video-gestes";
import { PrevisPanel } from "./previs-panel";
import { recordMaquette } from "@/lib/maquette/record";
import { PATH_SECONDS, moveProp } from "@/lib/maquette/scene";

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
  const { ready, demo, gate: productionGate, setNotice, resumeRun, creating, cast, decor, media, studio, pickedDecor, requestRun, writeProjectFile, readProjectFile, savePrevis, pickCast, pickDecor, run, cancelRun, sendToMontage, prefs, setPrefs } = useStudio();
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
  const [playFrom, setPlayFrom] = useState<number | null>(null);
  const [previsLeft, setPrevisLeft] = useState(0);
  const [previsClip, setPrevisClip] = useState<PrevisClip | null>(null);
  const filming = useRef(false);

  // Films 5 s of the maquette, along the camera path when there is one, and hands the clip to Caméra maîtrisée.
  async function filmPrevis() {
    if (filming.current) return;
    filming.current = true;
    const keyed = (maquette.path?.length ?? 0) > 1;
    if (keyed) setPlayFrom(performance.now());
    try {
      const file = await recordMaquette(PATH_SECONDS, setPrevisLeft);
      if (file) {
        await savePrevis(file);
        setPrevisClip({ file, at: Date.now() });
        setNotice(t("previs.savedClip"));
      }
      else setNotice(t("videoGeste.previsNoCanvas"));
    } catch (error) { setNotice(error instanceof Error ? error.message : t("videoGeste.previsNoCanvas")); }
    finally {
      setPlayFrom(null);
      setPrevisLeft(0);
      filming.current = false;
    }
  }
  const [placeCleared, setPlaceCleared] = useState(false);
  const [quartier, setQuartier] = useState<Quartier | null>(null);
  const booted = useRef<string | null>(null);
  const seeded = useRef(false);
  const [maquetteLoaded, setMaquetteLoaded] = useState("");
  const maquetteKey = `${studio.project ?? ""}/${currentId}`;
  useEffect(() => {
    if (!ready) return;
    let dead = false;
    setMaquetteLoaded("");
    seeded.current = false;
    void readProjectFile(`.uttu/maquette-${currentId}.json`).then(raw => {
      if (dead) return;
      const saved = readMaquette(raw);
      if (saved) { setMaquette(saved); seeded.current = true; }
      else setMaquette(demo ? initialMaquette() : { ...initialMaquette(), figures: [] });
      setMaquetteLoaded(maquetteKey);
    }).catch(error => setNotice(error.message));
    return () => { dead = true; };
  }, [ready, maquetteKey, readProjectFile, demo, setNotice]);
  useEffect(() => {
    if (!ready || maquetteLoaded !== maquetteKey) return;
    const save = () => { void writeProjectFile(`.uttu/maquette-${currentId}.json`, maquetteJson(maquette)).catch(error => setNotice(error.message)); };
    const timer = window.setTimeout(save, 250);
    return () => { window.clearTimeout(timer); save(); };
  }, [ready, maquetteLoaded, maquetteKey, currentId, maquette, writeProjectFile, setNotice]);

  useEffect(() => {
    const key = studio.project ?? "";
    if (!ready || booted.current === key) return;
    booted.current = key;
    seeded.current = false;
    setMaquette(initialMaquette());
    setPlaceCleared(false);
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
    const target = new URLSearchParams(window.location.search);
    const targetTake = target.get("take");
    const targetPlan = target.get("plan") ?? studio.shots.find(shot => shot.takeIds.includes(targetTake ?? ""))?.id;
    const stored = studio.shots.filter(shot => shot.composeur || shot.id === targetPlan);
    if (stored.length === 0) { setDrafts([blank("plan-01", "Plan 01", format)]); setCurrentId("plan-01"); return; }
    const next = stored
      .slice()
      .sort((a, b) => a.ordre - b.ordre)
      .map(shot => draftFromShot(shot, format));
    setDrafts(next);
    setCurrentId(next.find(item => item.id === targetPlan)?.id ?? next[0]?.id ?? "plan-01");
  }, [ready, format, studio.project, studio.shots]);

  /** Same fill as ?prise=compose: Uttu and La coursière on the quay, framing, camera and action set. */
  function partirExemple() {
    const next = demoDraft("compose", format);
    seeded.current = false;
    setSeed("compose");
    setDrafts([next]);
    setCurrentId(next.id);
    setPanel(false);
    setFinaliser(finaliserDefaults("video", next.input.duree));
  }

  const people = useMemo(() => {
    const cards = cast.length > 0 ? cast : seed === "vide" ? [] : DEMO_CAST;
    return cards.map(card => ({
      id: card.id,
      name: card.name,
      planche: Boolean(card.sheet && card.template),
      src: personSrc(card.preview, card.sheet, media),
    }));
  }, [cast, media, seed]);

  // Only décors the user made: with pixels, or a real place kept from repérage.
  // A name-only scene has nothing to film.
  // With none, three labelled house renders stay usable in one tap.
  const mine = useMemo(() => decor
    .map(card => ({
      id: card.id,
      name: card.name,
      note: card.prompt ?? "",
      src: card.preview ? assetPath(card.preview) : card.sheet && media[card.sheet] ? media[card.sheet] : "",
      exemple: false,
      repere: card.geste === "repere",
    }))
    .filter(place => place.src || place.repere), [decor, media]);
  const places = useMemo(() => {
    if (mine.length > 0) return mine;
    return DEMO_DECOR.map(card => ({ id: card.id, name: card.name, note: card.prompt, src: card.preview ? assetPath(card.preview) : "", exemple: true, repere: false }));
  }, [mine]);

  const castKey = `${drafts.find(item => item.id === currentId)?.input.castIds.join(",") ?? ""}|${people.map(person => `${person.id}:${person.name}`).join(",")}`;
  useEffect(() => {
    if (maquetteLoaded !== maquetteKey || seeded.current || people.length === 0) return;
    const chosenIds = drafts.find(item => item.id === currentId)?.input.castIds ?? [];
    const lead = (chosenIds.length > 0 ? people.find(person => person.id === chosenIds[0]) : people[0]) ?? null;
    if (!lead) return;
    seeded.current = true;
    setMaquette(state => seedLead(state, { id: lead.id, name: lead.name }));
    const tile = tuileById("regard");
    const placeId = places.find(place => place.id === pickedDecor)?.id ?? mine[0]?.id ?? null;
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
  }, [maquetteLoaded, maquetteKey, castKey, people, drafts, currentId, places, pickedDecor, t]);

  const index = Math.max(0, drafts.findIndex(item => item.id === currentId));
  const draft = drafts[index] ?? drafts[0];
  const previewPlaceId = !draft
    ? null
    : draft.input.decorId ?? (placeCleared ? null : pickedDecor ?? mine[0]?.id ?? null);
  useEffect(() => {
    let dead = false;
    if (!previewPlaceId) {
      setQuartier(null);
      return;
    }
    void readProjectFile(`Lieux/${previewPlaceId}.quartier.json`).then(text => {
      if (dead) return;
      setQuartier(text ? parseQuartier(text) : null);
    });
    return () => { dead = true; };
  }, [previewPlaceId, readProjectFile]);
  const previous = index > 0 ? drafts[index - 1] : null;
  const takeIds = studio.shots.find(shot => shot.id === draft?.id)?.takeIds ?? [];
  const requestedTake = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("take");
  const landed = studio.takes.find(take => take.id === requestedTake && (takeIds.includes(take.id) || !studio.shots.some(shot => shot.takeIds.includes(take.id))))
    ?? studio.takes.find(take => takeIds.includes(take.id)) ?? null;
  useEffect(() => {
    setDrafts(list => list.map(item => {
      const ids = studio.shots.find(shot => shot.id === item.id)?.takeIds ?? [];
      const hasTake = studio.takes.some(take => ids.includes(take.id));
      return hasTake === item.hasTake ? item : { ...item, hasTake };
    }));
  }, [studio.shots, studio.takes]);

  function patch(partial: Partial<PlanInput>) {
    const next = drafts.map(item => item.id === draft.id ? { ...item, input: { ...input, ...partial, format } } : item);
    setDrafts(next);
    setAsk(null);
    void persist(next).catch(error => setNotice(error.message));
  }

  useEffect(() => {
    setDrafts(list => list.map(item => item.input.format === format ? item : { ...item, input: { ...item.input, format } }));
  }, [format]);

  if (!draft) return null;

  const shownPlace = draft.input.decorId
    ? places.find(place => place.id === draft.input.decorId) ?? null
    : placeCleared
      ? null
      : places.find(place => place.id === pickedDecor) ?? mine[0] ?? null;
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
  const composer = { ...decide(input, "composer"), enabled: false, reason: "La composition d’image clé n’est pas encore raccordée. Utilisez Générer une prise." };
  const essai = decide(input, "essai");
  const tourner = decide(input, "tourner");
  const fin = chooseFinaliser({ ...finaliser, media: mediaKind, seconds: input.duree });
  const showFinal = draft.finalised;
  const cadre = [captureLine(maquette, tuileById(maquette.tuile).prompt), quartier ? t("r7.rue") : ""].filter(Boolean).join(" ");
  const prompt = buildPrompt(input, showFinal ? { graph: fin.graph, son: false } : cardDecision, { cadre });
  const tip = astuce(maquette);
  const tileLabels = TUILES.map(item => ({ id: item.id, label: t(`r7.tuile.${item.id}`) }));
  const knownLabels = [...tileLabels, ...TUILES.map(item => ({ id: item.id, label: item.label }))];
  const etat = etatOf(draft);
  const measuredProfile = input.format === "9:16" && input.duree === 5;
  const realRefs = input.castIds.length <= 3 && input.castIds.every(id => cast.some(card => card.id === id && !id.startsWith("demo-")));
  const savedDecor = !input.decorId || studio.scenes.some(scene => scene.id === input.decorId);
  const canGenerate = !demo && !creating && run.phase !== "running" && measuredProfile && realRefs && savedDecor && Boolean(input.castIds.length || shownPlace?.src);
  const generateReason = demo ? "La démonstration n’envoie aucun rendu."
    : !measuredProfile ? "Le profil actuellement chiffré est 5 s en 9:16. Choisissez ce format pour générer."
    : !realRefs ? "Utilisez au plus trois personnages enregistrés ; les silhouettes neutres servent à préparer le cadre."
    : !savedDecor ? "Ce décor d’exemple sert à préparer le cadre. Importez ou créez votre décor dans DÉCOR pour le transmettre au rendu."
    : "Choisissez au moins un personnage ou une image de décor enregistrée.";
  async function generate() {
    if (!canGenerate) return;
    try {
      await persist(drafts.map(item => item.id === draft.id ? { ...item, input } : item));
      await requestRun({ planId: draft.id, castIds: input.castIds, decorId: input.decorId, line: input.action, prompt: buildPrompt(input, essai, { cadre }).text, settings: { seconds: input.duree, aspect: input.format === "9:16" ? "vertical" : "horizontal", quality: "rapide", engine: prefs.engine } });
    } catch (error) { setNotice(error instanceof Error ? error.message : "Sauvegarde du plan impossible."); }
  }

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
    extra = { label: "Autre prise", price: "", enabled: canGenerate, reason: generateReason, onClick: () => void generate() };
  } else if (etat === "gardee" || etat === "finalisee") {
    // Finaliser se fait une seule fois, sur tout le montage (R8). La prise gardée y part.
    gold = { label: FINAL_LABEL, price: "", enabled: true, reason: "", composer: false, onClick: () => void envoyer() };
    extra = { label: "Autre prise", price: "", enabled: canGenerate, reason: generateReason, onClick: () => void generate() };
  } else {
    gold = { label: "Composer l'image", price: "", enabled: composer.enabled, reason: composer.reason, composer: true, onClick: () => { if (composer.enabled) setAsk("composer"); } };
    extra = { label: "Essai rapide", price: "", enabled: essai.enabled, reason: essai.reason, onClick: () => { void generate(); } };
  }
  if (!demo && etat !== "prise" && etat !== "gardee" && etat !== "finalisee") {
    gold = { label: "Générer une prise", price: "", enabled: canGenerate, reason: generateReason, composer: false, onClick: () => void generate() };
    extra = { label: "Composer l’image clé", price: "", enabled: false, reason: composer.reason, onClick() {} };
  }
  const reasonText = gold.enabled ? "" : gold.reason;
  const extraReason = extra && !extra.enabled && extra.reason && extra.reason !== reasonText ? extra.reason : "";

  async function persist(next: Draft[], focus = draft.id) {
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
      takeIds: studio.shots.find(item => item.id === shot.id)?.takeIds ?? [],
      imageCle: shot.before,
      imageFin: "",
      finalVideo: shot.finalised ? shot.after : "",
    };
    await writeProjectFile(`Shots/${shot.id}.md`, planMarkdown(record));
  }

  function addPlan() {
    const n = drafts.length + 1;
    const id = `plan-${String(n).padStart(2, "0")}`;
    const next = [...drafts, blank(id, `Plan ${String(n).padStart(2, "0")}`, format)];
    setDrafts(next);
    setCurrentId(id);
    setPanel(false);
    void persist(next, id).catch(error => setNotice(error.message));
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
    void Promise.all(next.map(item => persist(next, item.id))).catch(error => setNotice(error.message));
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
      || "";
    try {
      await sendToMontage({
        takeId: landed?.id,
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Envoi au montage interrompu.");
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
    void persist(next).catch(error => setNotice(error.message));
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
  const statusWord = t(card.statut === "mesure" ? "create.statusMeasured" : card.statut === "hypothese" ? "create.statusHypothesis" : "create.statusUnknown");
  const ceiling = card.cap === null
    ? ""
    : ` · ${t(card.statut === "mesure" ? "create.ceilingMeasured" : "create.ceilingHyp", { high: fr(card.cap) })}`;
  const quoteLine = !demo ? (measuredProfile ? productionGate.line : "Ce format n’est pas encore chiffré ; aucun envoi.") : card.quote === null
    ? t("create.quoteUnknown")
    : `${t("create.quoteLead", { quote: fr(card.quote), status: statusWord })}${ceiling}`;
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
      {run.phase === "error" && <div role="alert"><p>{run.message}</p><button type="button" className="u-secondary" onClick={resumeRun}>Récupérer le rendu</button></div>}
      {landed && media[landed.video] && <div><p>Prise enregistrée · {landed.settings.seconds} s</p><video controls playsInline src={media[landed.video]} style={{ width: "100%", maxHeight: 360 }} /></div>}
      {draft.finalised && draft.before
        ? <Compare before={draft.before} after={draft.after || draft.before} ratio={format} />
        : <MaquetteView
          state={{ ...maquette, props: maquette.props?.map(prop => ({ ...prop, url: prop.source ? media[prop.source] : undefined })) }}
          backdrop={quartier ? "" : (shownPlace?.src || "")}
          placeName={shownPlace?.name || ""}
          quartier={quartier}
          badge={t(`r7.tuile.${maquette.tuile}`)}
          hint={t("r7.hint")}
          onMove={(id, x, z) => setMaquette(state => moveFigure(state, id, x, z))}
          onOrbit={(dx, dy) => setMaquette(state => orbitDrag(state, dx, dy))}
          onPinch={(previous, distance) => setMaquette(state => pinch(state, previous, distance))}
          onMoveProp={(id, x, z) => setMaquette(state => moveProp(state, id, x, z))}
          playFrom={playFrom}
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
      <PrevisPanel state={maquette} setState={setMaquette} cast={people.map(person => ({ id: person.id, name: person.name }))} neutralName={t("r7.neutralName")} recording={previsLeft} onRecord={() => void filmPrevis()} />
      <p className="u-why" data-astuce={tip.id}>{t(`r7.astuce.${tip.id}`, { name: tip.name })}</p>
      <button type="button" className="u-link" data-lire-sequence="" data-envoyer-montage="" disabled={sending || (!landed && !shownPlace?.src && !people.some(person => input.castIds.includes(person.id) && person.src))} aria-describedby={sending ? "u-why-envoyer" : undefined} onClick={() => void envoyer()}>{landed ? "Envoyer la prise au montage" : "Ajouter l’image au montage"}</button>
      {sending && <p className="u-why" id="u-why-envoyer">{t("nav.opening")}</p>}
    </div>
    </div>

    <div className="u-prise-rail">
    <div className="u-prise-work">
      <header className="u-prise-head">
        <div className="u-prise-title">
          <h1 id="u-title" tabIndex={-1}>{planLabel}</h1>
          <FormatSwitch />
        </div>
        <p className="u-plan-etat">{planWord(draft)}</p>
      </header>
      {montrerDepart({ mesAssets: cast.length + decor.length + studio.shots.filter(shot => shot.composeur).length, rempli: seed !== "vide" }) && <ExempleDepart etape="prise" onStart={partirExemple} />}

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
        {mine.length === 0 && <button type="button" className="u-where-empty" onClick={goDecor} data-ou-vide="">
          <span className="u-place-face is-empty" aria-hidden="true"><AddPlaceIcon /></span>
          <span><strong>Crée ton premier lieu</strong><small>Dans DÉCOR, depuis un texte ou une photo de rue. Il apparaîtra ici.</small></span>
        </button>}
        {mine.length === 0 && places.length > 0 && <p className="u-where-note">Ou pars d’un exemple :</p>}
        <div className="u-choice-row u-where" data-ou-count={places.length} data-ou-source={mine.length > 0 ? "mes-decors" : "exemples"}>
          {places.map(place => {
            const on = shownPlace?.id === place.id;
            return <button key={place.id} type="button" className="u-place" aria-pressed={on} onClick={() => choosePlace(place.id)}>
              <span className="u-place-face">{place.src ? <img src={place.src} alt="" /> : <i />}{place.exemple && <em className="u-place-tag">Exemple</em>}</span>
              <span>{place.name}</span>
            </button>;
          })}
          {mine.length > 0 && <button type="button" className="u-place u-add-tile" onClick={goDecor}>
            <span className="u-place-face is-empty" aria-hidden="true"><AddPlaceIcon /></span>
            <span>Ajouter un lieu</span>
          </button>}
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

      <Row label={t("stage.engine.label")}>
        <div className="u-choice-row u-engine" data-engine={prefs.engine}>
          {(["ltx", "h3"] as const).map(engine => (
            <button key={engine} type="button" className="u-chip" aria-pressed={prefs.engine === engine} onClick={() => setPrefs({ engine })}>{t(`stage.engine.${engine}`)}</button>
          ))}
        </div>
        <p className="u-engine-hint">{t(prefs.engine === "ltx" ? "stage.engine.ltxHint" : "stage.engine.h3Hint")}</p>
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
      <VideoGestes aspect={format === "9:16" ? "vertical" : "horizontal"} previs={previsClip} previsLeft={previsLeft} onRecordPrevis={() => void filmPrevis()} />
    </div>

    <aside className="u-prise-dock" aria-label="Ce que l'app va faire">
      <div className="u-prise-card" id="u-prise-card" data-row={showFinal ? "final" : cardDecision.row}>
        <p className="u-label">Ce que l'app va faire</p>
        <p className="u-prise-brief" data-lire-maquette="">
          <span>{t("r7.lireCast")} : {maquette.figures.map(figure => figure.name).join(", ") || "—"}</span>
          <span>{t("r7.lireLieu")} : {shownPlace?.name || "—"}{quartier ? ` · ${t("r7.rue")}` : ""}</span>
          <span>{t("r7.lireCadrage")} : {t(`r7.tuile.${maquette.tuile}`)}</span>
        </p>
        <h2>{!demo ? "Générer une prise" : card.titre || "En attente"}</h2>
        {demo && card.mots && !sameAsMots && <p>{card.mots}</p>}
        {demo && card.pourquoi && card.pourquoi !== card.mots && !sameAsPourquoi && <p>{card.pourquoi}</p>}
        <p className="u-prise-quote">{quoteLine}</p>
        <button type="button" className="u-link" aria-expanded={details} onClick={() => setDetails(open => !open)}>Détails</button>
        {details && <div className="u-prise-details">
          {card.graph && <p>Graphe : {card.graph}</p>}
          {showFinal && fin.graphs.filter(item => !item.choisi).map(item => <p key={item.id}>{item.role} : {item.note}</p>)}
          <button type="button" className="u-link" aria-expanded={textOpen} onClick={() => setTextOpen(open => !open)}>Texte envoyé</button>
          {textOpen && <textarea className="u-prise-prompt" readOnly value={prompt.text} aria-label="Texte envoyé" />}
        </div>}
      </div>


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

const FINAL_LABEL = "Finaliser au montage";
