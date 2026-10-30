"use client";

import dynamic from "next/dynamic";

import { useAgentDraft } from "./use-agent-draft";
import { ETAPES, etapeApres, etapeInitiale, etapePrecedente, etapeSuivante, type Etape, type EtapeSignal } from "@/lib/prise/etapes";
import { PRISE_HANDOFF_KEY, isPriseHandoff, takeHandoff, type PriseHandoff } from "@/lib/barre/model";
import { OutilsStrip } from "./outils-hub";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { framePoster } from "@/lib/montage/poster";
import { framingSize, type CaptureFraming } from "@/lib/maquette/framing";
import { maquetteJson, readMaquette } from "@/lib/maquette/persistence";
import { assetPath } from "@/lib/site";
import { DEMO_CAST, DEMO_DECOR } from "@/lib/creation/demo";
import { TUILES, tuileById, tuileInText, tuileNeedsPair, type TuileId } from "@/lib/cinema/tuiles";
import {
  addFigure, addNeutral, applyTuile, astuce, autreEssai, canAddFigure, captureLine, cadrageFromOrbit, initialMaquette, MAX_FIGURES, moveFigure, orbitDrag, pinch, removeFigure, scenePhrase, seedLead, toggleLock, undoMaquette, yawFigure,
  type MaquetteState,
} from "@/lib/maquette/state";
import { ACTION_EXAMPLES, ACTION_MAX, CADRAGES, type Cadrage, type PlanEtat } from "@/lib/prise/copy";
import { cameraChoice } from "@/lib/prise/camera-words";
import { duplicatePlan, nextPlanId, removePlan, stepMove } from "@/lib/prise/plans";
import { historyJson, PLAN_HISTORY_FILE, planHistory, planReducer, readPlanHistory } from "@/lib/prise/history";
import { PlanUndo } from "./plan-undo";
import { mergeTakeIds, planVersions, sequenceTakes, shownTake, takeIdsFromShotNote } from "@/lib/prise/versions";
import { protocole } from "@/lib/fiabilite";
import { resolveTakeQuote } from "@/lib/render/billed-quote";
import { quotesToRecords } from "@/lib/render/measured-quote";
import { takeProfile, type TakeEngine, type TakeRendu, type TakeSettings } from "@/lib/render/take-graph";
import { quoteCredits, readRendu, saveRendu } from "@/lib/prise/rendu";
import { readPending } from "@/lib/render/recovery";
import { formatCredits } from "@/lib/credits";
import { FiabiliteCard, type SentLine } from "./fiabilite-card";
import { quoteWords } from "./studio-frames";
import { quoteAmount } from "@/lib/render/quote-words";
import { decide, emptyPlan, primaryIntent, type PlanInput } from "@/lib/prise/decision";
import { chooseFinaliser, finaliserDefaults, type FinaliserInput, type FinalMedia } from "@/lib/prise/finaliser";
import { buildPrompt } from "@/lib/prise/prompt";
import { parseQuartier, type Quartier } from "@/lib/repere/quartier";
import { framingGroups } from "@/lib/prise/framing-refs";
import { moveId, planFromJson, planJson, planMarkdown, planStateFromJson, type StoredPlan } from "@/lib/prise/vault";
import type { Shot } from "@/lib/coffre/model";
import { useI18n } from "@/components/i18n/provider";
import { ComfyProgress, useComfyElapsed, typicalFor } from "./comfy-progress";
import { montrerDepart } from "@/lib/creation/depart";
import { ExempleDepart } from "./exemple-depart";
import { FormatSwitch, useFormat } from "./format-switch";
import { useStudio } from "./studio-session";
import { ToolStage } from "./tool-shell";
import { EtEnsuite } from "./et-ensuite";
import { VideoGestes, type PrevisClip } from "./video-gestes";
// The maquette (three.js) and the prévis panel load only once their « Avancé » group is opened.
const MaquetteView = dynamic(() => import("./maquette-view").then(module => module.MaquetteView), { ssr: false, loading: () => <div className="u-maquette" data-maquette-loading="" aria-busy="true" /> });
const PrevisPanel = dynamic(() => import("./previs-panel").then(module => module.PrevisPanel), { ssr: false });
import { recordMaquette } from "@/lib/maquette/record";
import { resolveIntention, type KnownName } from "@/lib/intention/resolve";
import { planIntention, uttuLine, type Say } from "@/lib/intention/plan";
import { CAMERAS, type CameraMove } from "@/lib/prise/copy";
import {
  MEMOIRE_FILE, bindCards, changeState, findCharacter, findEnvironment, inherit, memoryJson, memoryMarkdown, migrateMemory, parseMemory, recordEvent, shotCode, syncShots,
  type ProductionMemory,
} from "@/lib/memoire/model";
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
  /** The take marked « Garder ». Other takes stay as versions. */
  garde: string;
  takeIds?: string[];
  /** Synchronous seed for a duplicate, before its separate maquette file exists. */
  maquetteSeed?: string;
  render?: { phase: "queued" | "running" | "error" | "done"; message: string; jobId?: string };
}

function fr(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
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

// The house examples carry a French name in demo.ts; on screen they follow the locale.
const DEMO_IDS = new Set([...DEMO_CAST, ...DEMO_DECOR].map(card => card.id));
function demoName(t: (key: string) => string, id: string, name: string): string {
  return DEMO_IDS.has(id) ? t(`demoNames.${id}`) : name;
}

function personSrc(preview: string | null | undefined, sheet: string | null | undefined, media: Record<string, string>): string {
  if (preview) return assetPath(preview);
  if (sheet && media[sheet]) return media[sheet];
  return "";
}

export function PriseStage({ goCast, goDecor, onMontage }: { goCast(): void; goDecor(): void; onMontage(): void }) {
  const { ready, demo, runOrigin, notice, setNotice, resumeRun, creating, cast, decor, media, studio, pickedCast, pickedDecor, requestRun, writeProjectFile, readProjectFile, deleteShot, savePrevis, saveFraming, pickCast, pickDecor, run, cancelRun, sendSequence, sendToMontage, prefs, setPrefs, pendingTake, sheet, connected, setSheet } = useStudio();
  const { t, say } = useI18n();
  const activeProject = useRef(studio.project); activeProject.current = studio.project;
  const [viewed, setViewed] = useState<Record<string, string>>({});
  const [nextAction, setNextAction] = useState("");
  const [undoToast, setUndoToast] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  // P1-3 · phone path in five steps (CSS shows one step below 1024 px; large screens keep every block).
  const [etape, setEtape] = useState<Etape>("preparer");
  // « Modifier ce plan » is open as soon as the « Plans » step is: React owns `open`, so no frame passes with it shut.
  const [editorOpen, setEditorOpen] = useState(false);
  // « Maquette 3D et cadrage » (the 3D row of Outils) lands on #prise/maquette: unfold AVANCÉ and the maquette.
  const [maquetteAsk, setMaquetteAsk] = useState(0);
  // Mounted on the first opening of the maquette or prévis group, then kept so its state survives a fold.
  const [maquetteSeen, setMaquetteSeen] = useState(false);
  const seeMaquette = useCallback(() => setMaquetteSeen(true), []);
  useEffect(() => {
    const apply = () => {
      if (!/^#prise\/maquette\b/.test(window.location.hash)) return;
      setAdvanced(true);
      setMaquetteAsk(value => value + 1);
      setEtape("previs");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  const { format, setFormat } = useFormat();
  // P1 · production memory and intention overrides (per plan, this session).
  const [memory, setMemory] = useState<ProductionMemory | null>(null);
  const [cameraPick, setCameraPick] = useState<Record<string, CameraMove | "none">>({});
  const [ambianceOff, setAmbianceOff] = useState<Record<string, boolean>>({});
  const [stateEdit, setStateEdit] = useState<string | null>(null);
  const [stateDraft, setStateDraft] = useState("");
  const memoryProject = useRef<string | null>(null);
  const memorySave = useRef<number>(0);
  const [seed, setSeed] = useState<Seed>("vide");
  const [history, setHistory] = useState(() => planHistory<Draft>([blank("plan-01", "Plan 1", "16:9")]));
  const drafts = history.plans;
  const currentId = history.currentId;
  const [plansLoaded, setPlansLoaded] = useState<string | null>(null);
  const [planSaveState, setSaveState] = useState<"saving" | "saved" | "error">("saved");
  const [dragId, setDragId] = useState<string | null>(null);
  const [receiptBlocked, setReceiptBlocked] = useState(false);
  useEffect(() => {
    try { setReceiptBlocked(Boolean(readPending(localStorage))); }
    catch { setReceiptBlocked(true); }
  }, [run, creating, ready, plansLoaded]);
  const saveRevision = useRef(0);
  const latestPlanSave = useRef(new Map<string, number>());
  const savedIds = useRef<string[]>([]);
  const planWrites = useRef<Promise<void>>(Promise.resolve());
  // System updates (a landed take, hydration) do not consume an undo step.
  function setDrafts(update: Draft[] | ((list: Draft[]) => Draft[])) {
    setHistory(state => planReducer(state, { type: "replace", plans: typeof update === "function" ? update(state.plans) : update, record: false }));
  }
  function setCurrentId(id: string) { setHistory(state => planReducer(state, { type: "select", id })); }
  function editPlans(next: Draft[], focus = currentId, group?: string) {
    setHistory(state => planReducer(state, { type: "replace", plans: next, currentId: focus, group, at: Date.now() }));
  }
  function undoPlan() {
    const next = planReducer(history, { type: "undo" });
    // Paid jobs and their versions are facts, never something an undo can replay or erase.
    const restored = { ...next, plans: next.plans.map(item => {
      const live = drafts.find(plan => plan.id === item.id);
      return live ? { ...item, hasTake: live.hasTake, takeIds: mergeTakeIds(item.takeIds ?? [], live.takeIds ?? []), render: live.render } : item;
    }) };
    setHistory(restored);
    const selected = restored.plans.find(item => item.id === restored.currentId);
    if (selected && selected.id === currentId) {
      setMaquette(state => {
        let shape = state;
        for (const figure of shape.figures) if (!selected.input.castIds.includes(figure.id)) shape = removeFigure(shape, figure.id);
        for (const id of selected.input.castIds) {
          const person = people.find(item => item.id === id);
          if (person && !shape.figures.some(figure => figure.id === id)) shape = addFigure(shape, { id, name: person.name });
        }
        return shape;
      });
      setPlaceCleared(!selected.input.decorId);
    }
    setAsk(null);
  }
  const [panel, setPanel] = useState(false);
  const [mediaKind, setMediaKind] = useState<FinalMedia>("video");
  const [finaliser, setFinaliser] = useState<FinaliserInput>(finaliserDefaults("video", 5));
  const [rendu, setRenduState] = useState<TakeRendu>("finale");
  // The quality choice is remembered per project, in this browser.
  useEffect(() => { setRenduState(readRendu(typeof window === "undefined" ? null : window.localStorage, studio.project)); }, [studio.project]);
  const chooseRendu = (next: TakeRendu) => { setRenduState(next); saveRendu(window.localStorage, studio.project, next); };
  const [ask, setAsk] = useState<"composer" | null>(null);
  const [maquette, setMaquette] = useState<MaquetteState>(() => initialMaquette());
  const [sending, setSending] = useState(false);
  const [picker, setPicker] = useState(false);
  const captureFraming = useRef<CaptureFraming | null>(null);
  const [captureReady, setCaptureReady] = useState(false);
  const [framingBusy, setFramingBusy] = useState(false);
  const framingSaving = useRef(false);
  const framingTouch = useRef<number | null>(null);
  const framingTouchHandled = useRef(false);
  const [force2D, setForce2D] = useState(false);
  const [noWebGL, setNoWebGL] = useState(false);
  const onWebGLFailed = useCallback(() => setNoWebGL(true), []);
  const [maquetteMode, setMaquetteMode] = useState<"webgl" | "plat">("webgl");
  const onCaptureReady = useCallback((capture: CaptureFraming | null) => { captureFraming.current = capture; setCaptureReady(Boolean(capture)); }, []);
  useEffect(() => {
    if (plansLoaded === (studio.project ?? "")) setForce2D(drafts.find(item => item.id === currentId)?.input.framing?.source === "2d");
  }, [plansLoaded, currentId, studio.project]);
  const [playFrom, setPlayFrom] = useState<number | null>(null);
  const [previsLeft, setPrevisLeft] = useState(0);
  const [previsClip, setPrevisClip] = useState<PrevisClip | null>(null);
  const filming = useRef(false);
  useAgentDraft(op => op.id === "local:take", (draft) => {
    patch({ action: draft.prompt.slice(0, 240) });
    setAsk(null);
  });


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
  const canCapture = captureReady && maquetteLoaded === maquetteKey && plansLoaded === (studio.project ?? "");
  const maquetteSeed = drafts.find(item => item.id === currentId)?.maquetteSeed;
  useEffect(() => {
    if (!ready) return;
    let dead = false;
    setMaquetteLoaded("");
    seeded.current = false;
    void readProjectFile(`.uttu/maquette-${currentId}.json`).then(raw => {
      if (dead) return;
      const saved = readMaquette(raw ?? maquetteSeed);
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
    setPlansLoaded(null);
    seeded.current = false;
    setMaquette(initialMaquette());
    setPlaceCleared(false);
    const asked = new URLSearchParams(window.location.search).get("prise");
    if (demo && (asked === "compose" || asked === "final")) {
      const next = demoDraft(asked, format, t("p0.action.1"));
      setSeed(asked);
      setHistory(planHistory([next]));
      setPlansLoaded(key);
      setPanel(asked === "final");
      setFinaliser(finaliserDefaults("video", next.input.duree));
      return;
    }
    const target = new URLSearchParams(window.location.search);
    const targetTake = target.get("take");
    const targetPlan = target.get("plan") ?? studio.shots.find(shot => shot.takeIds.includes(targetTake ?? ""))?.id;
    const stored = studio.shots.filter(shot => shot.composeur || shot.id === targetPlan).slice().sort((a, b) => a.ordre - b.ordre);
    const next = stored.length ? stored.map(shot => draftFromShot(shot, format)) : [blank("plan-01", t("p0.planN", { n: "1" }), format)];
    savedIds.current = stored.map(shot => shot.id);
    let dead = false;
    void readProjectFile(PLAN_HISTORY_FILE).then(raw => {
      if (dead) return;
      const saved = readPlanHistory(raw, decodeDraft);
      const loaded = saved ?? planHistory(next);
      if (targetPlan && loaded.plans.some(plan => plan.id === targetPlan)) loaded.currentId = targetPlan;
      setHistory(loaded);
      setPlansLoaded(key);
    }).catch(error => {
      if (dead) return;
      setHistory(planHistory(next));
      setPlansLoaded(key);
      setNotice(error instanceof Error ? error.message : t("p0.saveFailed"));
    });
    // Only a project switch/unmount invalidates the read, not a take landing meanwhile.
    return () => { dead = true; booted.current = null; };
  }, [ready, studio.project, readProjectFile, demo]);

  // The creation bar (mode Vidéo) hands over a sentence, the chosen references and the settings, once.
  const [barre, setBarre] = useState<PriseHandoff | null>(null);
  useEffect(() => {
    if (!ready) return;
    const handed = takeHandoff(window.sessionStorage, PRISE_HANDOFF_KEY, isPriseHandoff);
    if (handed) setBarre(handed);
  }, [ready]);
  useEffect(() => {
    // Hydration is asynchronous: applying the handoff before it finishes lets
    // the saved journal overwrite the sentence and references from the bar.
    if (!barre || plansLoaded !== (studio.project ?? "")) return;
    const hand = barre;
    setBarre(null);
    if (hand.castIds.concat(hand.decorId ?? "").some(id => DEMO_IDS.has(id))) setSeed("compose");
    if (hand.settings.format !== format) setFormat(hand.settings.format);
    chooseRendu(hand.settings.rendu);
    const planche = hand.castIds.map(id => { const card = cast.find(item => item.id === id); return Boolean(card?.sheet && card.template); });
    setDrafts(list => list.map(item => item.id !== currentId ? item : {
      ...item,
      input: {
        ...item.input,
        action: hand.action || item.input.action,
        castIds: hand.castIds.length ? hand.castIds : item.input.castIds,
        castNames: hand.castIds.length ? hand.castNames : item.input.castNames,
        castPlanche: hand.castIds.length ? planche : item.input.castPlanche,
        decorId: hand.decorId ?? item.input.decorId,
        decorName: hand.decorId ? hand.decorName : item.input.decorName,
        duree: hand.settings.duree,
        format: hand.settings.format,
      },
    }));
    if (hand.decorId) setPlaceCleared(false);
    setAsk(null);
  }, [barre, currentId, studio.project, plansLoaded]);

  /** Same fill as ?prise=compose: La coursière and Le vieil homme on the quay, framing, camera and action set. */
  function partirExemple() {
    const next = demoDraft("compose", format, t("p0.action.1"));
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
      name: demoName(t, card.id, card.name),
      planche: Boolean(card.sheet && card.template),
      src: personSrc(card.preview, card.sheet, media),
    }));
  }, [cast, media, seed, t]);

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
    return DEMO_DECOR.map(card => ({ id: card.id, name: demoName(t, card.id, card.name), note: card.prompt, src: card.preview ? assetPath(card.preview) : "", exemple: true, repere: false }));
  }, [mine, t]);

  const castKey = `${drafts.find(item => item.id === currentId)?.input.castIds.join(",") ?? ""}|${people.map(person => `${person.id}:${person.name}`).join(",")}`;
  useEffect(() => {
    if (plansLoaded !== (studio.project ?? "") || maquetteLoaded !== maquetteKey || seeded.current || people.length === 0) return;
    const chosenIds = drafts.find(item => item.id === currentId)?.input.castIds ?? [];
    // Like the décor: the character just made or imported in CAST leads, else the first one.
    const lead = (chosenIds.length > 0 ? people.find(person => person.id === chosenIds[0]) : people.find(person => person.id === pickedCast) ?? people[0]) ?? null;
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
  }, [plansLoaded, studio.project, maquetteLoaded, maquetteKey, castKey, people, drafts, currentId, places, pickedDecor, pickedCast, t]);

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
  const takeIds = mergeTakeIds(draft?.takeIds ?? [], studio.shots.find(shot => shot.id === draft?.id)?.takeIds ?? []);
  // Every take of the plan is a version. The newest is shown when it lands; « Garder » marks the one for the cut.
  const versions = planVersions(takeIds, studio.takes);
  const requestedTake = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("take");
  const landed = shownTake(versions, viewed[draft?.id ?? ""] ?? requestedTake);
  const etapeSignal: EtapeSignal = {
    running: run.phase === "running" && runOrigin?.project === studio.project && runOrigin?.planId === draft?.id,
    failed: draft?.render?.phase === "error",
    versions: versions.length,
  };
  const etapeSeen = useRef<{ plan: string; signal: EtapeSignal } | null>(null);
  const etapeLoaded = plansLoaded === (studio.project ?? "");
  useEffect(() => {
    if (!etapeLoaded) return;
    const plan = draft?.id ?? "";
    const before = etapeSeen.current;
    etapeSeen.current = { plan, signal: etapeSignal };
    // First load opens on the takes when there are some. Picking another plan keeps the step,
    // except « Réviser » on a plan with nothing to review: back to « Préparer ».
    if (!before) { setEtape(current => current === "preparer" ? etapeInitiale(etapeSignal) : current); return; }
    if (before.plan !== plan) {
      if (etapeInitiale(etapeSignal) === "preparer") setEtape(current => current === "reviser" || current === "generer" ? "preparer" : current);
      return;
    }
    setEtape(current => etapeApres(current, before.signal, etapeSignal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapeLoaded, draft?.id, etapeSignal.running, etapeSignal.failed, etapeSignal.versions]);
  useEffect(() => {
    setDrafts(list => list.map(item => {
      const ids = studio.shots.find(shot => shot.id === item.id)?.takeIds ?? [];
      const hasTake = studio.takes.some(take => ids.includes(take.id));
      const takeIds = mergeTakeIds(item.takeIds ?? [], ids);
      const available = hasTake || studio.takes.some(take => takeIds.includes(take.id));
      return available === item.hasTake && takeIds.join() === (item.takeIds ?? []).join() ? item : { ...item, hasTake: available, takeIds };
    }));
  }, [studio.shots, studio.takes]);
  // A take that just landed is shown at once, even if another version was open.
  useEffect(() => {
    if (run.phase !== "done") return;
    const planId = studio.shots.find(shot => shot.takeIds.includes(run.takeId))?.id;
    if (planId) setViewed(map => ({ ...map, [planId]: run.takeId }));
  }, [run, studio.shots]);

  // Production memory: read once per project (or migrated from CAST, DÉCOR and the plans), then kept in step.
  useEffect(() => {
    const project = studio.project;
    if (!ready || demo || !project || booted.current !== project || memoryProject.current === project) return;
    memoryProject.current = project;
    setMemory(null);
    // Not tied to the effect's lifetime: drafts and cards change while the file is read; only a project switch drops the result.
    void readProjectFile(MEMOIRE_FILE).then(text => {
      if (memoryProject.current !== project) return;
      const stored = parseMemory(text);
      setMemory(stored ?? migrateMemory({ title: project, cast, decor: studio.scenes.map(scene => ({ id: scene.id, name: scene.name, stills: scene.stills })), plans: drafts.map(item => ({ id: item.id, action: item.input.action })) }));
    }).catch(() => { if (memoryProject.current === project) memoryProject.current = null; });
  }, [ready, demo, studio.project, readProjectFile, cast, studio.scenes, drafts]);
  const planOrder = drafts.map(item => `${item.id}:${item.input.action.slice(0, 400)}`).join("|");
  const cardKey = `${cast.map(card => `${card.id}:${card.name}`).join(",")}|${studio.scenes.map(scene => `${scene.id}:${scene.name}`).join(",")}`;
  useEffect(() => {
    if (!memory) return;
    const next = bindCards(syncShots(memory, drafts.map(item => ({ id: item.id, action: item.input.action }))), cast, studio.scenes.map(scene => ({ id: scene.id, name: scene.name, stills: scene.stills })));
    if (memoryJson(next) !== memoryJson(memory)) setMemory(next);
  }, [memory, planOrder, cardKey]);
  useEffect(() => {
    if (!memory || demo || !studio.project || memoryProject.current !== studio.project) return;
    window.clearTimeout(memorySave.current);
    const project = studio.project;
    memorySave.current = window.setTimeout(() => {
      void (async () => {
        await writeProjectFile(MEMOIRE_FILE, memoryJson(memory));
        for (const file of memoryMarkdown(memory, project)) await writeProjectFile(file.file, file.text);
      })().catch(error => setNotice(error instanceof Error ? error.message : String(error)));
    }, 600);
    return () => window.clearTimeout(memorySave.current);
  }, [memory]);
  // A landed take is history.
  useEffect(() => {
    if (run.phase !== "done" || !memory) return;
    const planId = studio.shots.find(shot => shot.takeIds.includes(run.takeId))?.id;
    if (!planId || memory.history.some(event => event.text.includes(run.takeId))) return;
    setMemory(recordEvent(memory, { at: new Date().toISOString(), kind: "generation", shot: shotCode(memory, planId), text: `${run.takeId} · ${drafts.find(item => item.id === planId)?.input.action.slice(0, 200) ?? ""}` }));
  }, [run, studio.shots]);

  function patch(partial: Partial<PlanInput>) {
    const next = drafts.map(item => item.id === draft.id ? { ...item, input: { ...input, ...partial, format } } : item);
    editPlans(next, draft.id, Object.keys(partial).length === 1 ? `${draft.id}:${Object.keys(partial)[0]}` : undefined);
    setAsk(null);
  }

  // The journal is saved first, then the interoperable Shots notes. All mutations share one queue.
  useEffect(() => {
    if (!ready || demo || plansLoaded !== (studio.project ?? "") || !studio.project) return;
    const revision = ++saveRevision.current;
    const project = studio.project;
    latestPlanSave.current.set(project, revision);
    setSaveState("saving");
    const previousIds = savedIds.current;
    // Keep every known id until cleanup succeeds, including after a failed disk write.
    savedIds.current = [...new Set([...previousIds, ...drafts.map(item => item.id)])];
    const snapshot = history;
    const next = planWrites.current.catch(() => {}).then(async () => {
      // While one save is in flight, keep only the newest queued snapshot per project.
      if (latestPlanSave.current.get(project) !== revision) return;
      await writeProjectFile(PLAN_HISTORY_FILE, historyJson(snapshot));
      for (const id of previousIds) if (!snapshot.plans.some(item => item.id === id)) await deleteShot(id);
      for (const item of snapshot.plans) await persist(snapshot.plans, item.id);
    });
    planWrites.current = next;
    void next.then(() => { if (saveRevision.current === revision) setSaveState("saved"); }).catch(error => {
      if (saveRevision.current === revision) setSaveState("error");
      setNotice(error instanceof Error ? error.message : t("p0.saveFailed"));
    });
  }, [history, plansLoaded, ready, demo, studio.project]);

  // A render belongs to its original plan, including after refresh or when another card is open.
  useEffect(() => {
    if (!runOrigin || runOrigin.project !== studio.project || run.phase === "idle" || plansLoaded !== (studio.project ?? "")) return;
    setDrafts(list => list.map(item => {
      if (item.id !== runOrigin.planId) return item;
      const render: Draft["render"] = run.phase === "running"
        ? { phase: run.event.stage === "render" || run.event.stage === "fetch" || run.event.stage === "measure" || run.event.stage === "ready" ? "running" : "queued", message: "", ...("jobId" in run.event ? { jobId: run.event.jobId } : {}) }
        : run.phase === "error" ? { phase: "error", message: say(run.message), jobId: item.render?.jobId }
        : { phase: "done", message: "", jobId: item.render?.jobId };
      return JSON.stringify(render) === JSON.stringify(item.render) ? item : { ...item, render };
    }));
  }, [run, runOrigin, studio.project, plansLoaded, drafts.map(item => item.id).join(",")]);

  useEffect(() => {
    setDrafts(list => list.map(item => item.input.format === format ? item : { ...item, input: { ...item.input, format } }));
  }, [format]);

  if (!draft) return null;

  const shownPlace = draft.input.decorId
    ? places.find(place => place.id === draft.input.decorId) ?? null
    : placeCleared
      ? null
      : places.find(place => place.id === pickedDecor) ?? mine[0] ?? null;
  // P1 · the sentence, read against CAST/DÉCOR names and the memory's aliases.
  const knownCast: KnownName[] = people.map(person => {
    const character = memory ? findCharacter(memory, { id: person.id, name: person.name }) : null;
    return { id: person.id, name: person.name, aliases: character ? [character.name, ...character.aliases] : [] };
  });
  const knownDecor: KnownName[] = places.map(place => {
    const environment = memory ? findEnvironment(memory, { id: place.id, name: place.name }) : null;
    return { id: place.id, name: place.name, aliases: environment ? [environment.name, ...environment.aliases] : [] };
  });
  const resolved = resolveIntention(draft.input.action, { cast: knownCast, decor: knownDecor });
  const input: PlanInput = {
    ...draft.input,
    format,
    castIds: maquette.figures.map(figure => figure.id),
    castNames: maquette.figures.map(figure => figure.name),
    castPlanche: maquette.figures.map(figure => people.find(person => person.id === figure.id)?.planche ?? false),
    decorId: shownPlace?.id ?? null,
    decorName: shownPlace?.name ?? "",
    decorNote: shownPlace?.note ?? "",
    // Geometry from the 3D view wins: never hardcode close-up when the camera is far.
    cadrage: draft.input.manualFraming ? draft.input.cadrage : (cadrageFromOrbit(maquette.orbit, maquette.figures) as PlanInput["cadrage"]),
    camera: draft.input.manualCamera ? draft.input.camera : tuileById(maquette.tuile).camera,
    speakerName: draft.input.speakerName || maquette.figures[0]?.name || "",
    previousKept: Boolean(previous && (previous.kept || previous.finalised)),
    hasKeptTake: draft.kept || draft.finalised,
  };
  function intentionFor(text: string, planId: string, plan: PlanInput) {
    const read = text === draft.input.action ? resolved : resolveIntention(text, { cast: knownCast, decor: knownDecor });
    const names = plan.castIds.map(id => ({ id, name: people.find(person => person.id === id)?.name ?? id }));
    const inherited = memory ? inherit(memory, planId, names) : [];
    const scene = studio.scenes.find(item => item.id === plan.decorId) ?? null;
    const prev = drafts[drafts.findIndex(item => item.id === planId) - 1] ?? (planId === draft.id ? null : draft);
    const decided = planIntention(read, {
      cast: plan.castIds.map(id => {
        const card = cast.find(item => item.id === id);
        return { id, name: card?.name ?? people.find(person => person.id === id)?.name ?? id, sheet: card?.sheet ?? null, photos: card?.photos ?? [] };
      }),
      decor: plan.decorId ? { id: plan.decorId, name: plan.decorName || scene?.name || "", stills: scene?.stills ?? [places.find(place => place.id === plan.decorId)?.src ?? ""].filter(Boolean) } : null,
      inherited,
      engineOverride: prefs.engineManual ? prefs.engine : null,
      previousInPlace: Boolean(prev && (prev.kept || prev.finalised || prev.hasTake) && prev.input.decorId && prev.input.decorId === plan.decorId),
      format: plan.format,
    });
    const pick = plan.manualCamera ? plan.camera : cameraPick[planId];
    const lines = ambianceOff[planId] ? decided.promptLines.filter(line => !line.startsWith("[ambiance]")) : decided.promptLines;
    return { read, inherited, decided, extra: { lines, camera: pick === undefined ? undefined : pick === "none" ? null : pick } };
  }
  const intention = intentionFor(draft.input.action, draft.id, input);
  // A kept framing needs LTX (depth + edges). Choosing H3 by hand still wins: the framing stays saved, not sent.
  const engineFor = (plan: PlanInput, decided: { engine: TakeEngine }): TakeEngine => plan.framing && !(prefs.engineManual && prefs.engine === "h3") ? "ltx" : decided.engine;
  const engine = engineFor(input, intention.decided);
  const framingSent = Boolean(input.framing) && engine === "ltx";
  const intent = primaryIntent(input);
  const cardDecision = decide(input, intent);
  const essai = decide(input, "essai");
  const fin = chooseFinaliser({ ...finaliser, media: mediaKind, seconds: input.duree });
  const showFinal = draft.finalised;
  const cadre = input.manualFraming || input.manualCamera ? "" : [captureLine(maquette, tuileById(maquette.tuile).prompt), quartier ? t("r7.rue") : ""].filter(Boolean).join(" ");
  const prompt = buildPrompt(input, showFinal ? { graph: fin.graph, son: false } : cardDecision, { cadre, ...intention.extra });
  const tip = astuce(maquette);
  const tileLabels = TUILES.map(item => ({ id: item.id, label: t(`r7.tuile.${item.id}`) }));
  const knownLabels = [...tileLabels, ...TUILES.map(item => ({ id: item.id, label: item.label }))];
  // One quote per take, from the plan's own engine, format and length. LTX is estimated in 16:9 and 9:16.
  // Aperçu (first pass only) or Qualité finale (today's two passes). LTX only; each keeps its own profile.
  const baseSettings: TakeSettings = { seconds: input.duree, aspect: input.format === "9:16" ? "vertical" : "horizontal", quality: "rapide", engine, ...(framingSent ? { cadrage: "depth-edges-v1" as const } : {}) };
  const planSettings: TakeSettings = engine === "ltx" && rendu === "apercu" ? { ...baseSettings, rendu: "apercu" } : baseSettings;
  const planQuote = resolveTakeQuote(takeProfile(planSettings), quotesToRecords(studio.quotes));
  const renduQuotes = {
    apercu: quoteCredits(resolveTakeQuote(takeProfile({ ...baseSettings, engine: "ltx", rendu: "apercu" }), quotesToRecords(studio.quotes))),
    finale: quoteCredits(resolveTakeQuote(takeProfile({ ...baseSettings, engine: "ltx" }), quotesToRecords(studio.quotes))),
  };
  const planCredits = quoteCredits(planQuote);
  // One price per engine for the chooser, so switching never surprises.
  const engineCredits = {
    ltx: quoteCredits(resolveTakeQuote(takeProfile({ ...baseSettings, engine: "ltx", ...(input.framing ? { cadrage: "depth-edges-v1" as const } : {}), ...(rendu === "apercu" ? { rendu: "apercu" as const } : {}) }), quotesToRecords(studio.quotes))),
    h3: quoteCredits(resolveTakeQuote(takeProfile({ seconds: baseSettings.seconds, aspect: baseSettings.aspect, quality: "rapide", engine: "h3" }), quotesToRecords(studio.quotes))),
  };
  // What each chip and the gold button print: a measured quote reads « 4 à 6 », like the quote line.
  const engineAmount = {
    ltx: quoteAmount(t, resolveTakeQuote(takeProfile({ ...baseSettings, engine: "ltx", ...(input.framing ? { cadrage: "depth-edges-v1" as const } : {}), ...(rendu === "apercu" ? { rendu: "apercu" as const } : {}) }), quotesToRecords(studio.quotes))),
    h3: quoteAmount(t, resolveTakeQuote(takeProfile({ seconds: baseSettings.seconds, aspect: baseSettings.aspect, quality: "rapide", engine: "h3" }), quotesToRecords(studio.quotes))),
  };
  const planAmount = quoteAmount(t, planQuote);
  const framedLtx = quoteCredits(resolveTakeQuote(takeProfile({ seconds: baseSettings.seconds, aspect: baseSettings.aspect, quality: "rapide", engine: "ltx", cadrage: "depth-edges-v1", ...(rendu === "apercu" ? { rendu: "apercu" as const } : {}) }), quotesToRecords(studio.quotes)));
  const creditsWord = (value: number | null) => value === null ? "" : t("p0.rendu.quote", { credits: formatCredits(value) });
  const quoted = planQuote.source !== "unmeasured";
  const realRefs = input.castIds.length <= 3 && input.castIds.every(id => cast.some(card => card.id === id && !id.startsWith("demo-")));
  const savedDecor = !input.decorId || studio.scenes.some(scene => scene.id === input.decorId);
  const runPlan = sheet === "confirm" ? pendingTake?.planId ?? null : runOrigin?.project === studio.project ? runOrigin.planId : null;
  const busy = run.phase === "running";
  const priseElapsed = useComfyElapsed(busy);
  const runningHere = busy && runPlan === draft.id;
  const failedHere = draft.render?.phase === "error" || (run.phase === "error" && runPlan === draft.id);
  const framingFits = !input.framing || (input.framing.width === framingSize(format).width && input.framing.height === framingSize(format).height);
  const canGenerate = framingFits && !framingBusy && !demo && !creating && !busy && !receiptBlocked && quoted && realRefs && savedDecor && Boolean(input.castIds.length || shownPlace?.src);
  const generateReason = !framingFits ? t("framing.formatChanged") : framingBusy ? t("framing.saving") : demo ? t("p0.why.demo")
    : busy ? t("p0.why.busy")
    : receiptBlocked ? t("recovery.blocked")
    : !quoted ? t(engine === "h3" ? "p0.why.h3Format" : "p0.why.noQuote")
    : !realRefs ? t("p0.why.refs")
    : !savedDecor ? t("p0.why.decorExample")
    : t("p0.why.nothing");

  function cameraLine(plan: PlanInput): SentLine {
    if (plan.manualCamera) return { label: t("p0.fiab.sentCamera"), value: t(`p0.camera.move.${plan.camera}`) };
    const choice = cameraChoice(plan.action, plan.camera);
    const move = choice.move ? t(`p0.camera.move.${choice.move}`) : "";
    const value = choice.source === "texte"
      ? t("p0.camera.fromText", { words: choice.words, move })
      : choice.source === "tuile" ? t("p0.camera.fromTile", { move }) : t("p0.camera.free");
    return { label: t("p0.fiab.sentCamera"), value, flag: Boolean(choice.overridden) };
  }
  function sayIt(item: Say): string {
    return t(`p1.say.${item.key}`, item.vars ?? {});
  }
  function resumeFor(plan: PlanInput, planId = draft.id): SentLine[] {
    const { read, inherited, decided } = intentionFor(plan.action, planId, plan);
    const rows: SentLine[] = [
      { label: t("p0.fiab.sentCast"), value: plan.castNames.join(", ") || "—" },
      { label: t("p0.fiab.sentDecor"), value: plan.decorName || "—" },
      { label: t("p0.fiab.sentWords"), value: plan.action.trim() || "—" },
      cameraLine(plan),
    ];
    if (read.ambiance.length && !ambianceOff[planId]) rows.push({ label: t("p1.fiab.ambiance"), value: read.ambiance.map(item => item.label).join(", ") });
    const kept = inherited.filter(row => row.state).map(row => `${row.name} · ${row.state!.label} (${row.state!.fromCode || "?"})`);
    if (kept.length) rows.push({ label: t("p1.fiab.continuity"), value: kept.join(" ; ") });
    rows.push({ label: t("p1.fiab.engine"), value: t(prefs.engineManual ? "p1.fiab.engineHand" : "p1.fiab.engineAuto", { engine: t(engineFor(plan, decided) === "h3" ? "stage.engine.h3" : "stage.engine.ltx") }) });
    if (plan.framing && engineFor(plan, decided) === "ltx") rows.push({ label: t("framing.kept"), value: `${plan.framing.width} × ${plan.framing.height} · ${t("framing.depth")} + ${t("framing.edges")}` });
    if (read.unknown.length) rows.push({ label: t("p1.chip.unknown"), value: read.unknown.join(", "), flag: true });
    return rows;
  }
  function changeFor(plan: PlanInput, planId = draft.id): string {
    const { decided } = intentionFor(plan.action, planId, plan);
    return [t("p0.fiab.changePrise"), ...decided.warnings.map(sayIt)].join(" ");
  }

  async function keepFraming() {
    if (framingBusy || framingSaving.current || !canCapture) return;
    const project = studio.project;
    if (!captureFraming.current) { setNotice(t("framing.loading")); return; }
    const id = draft.id;
    framingSaving.current = true;
    setFramingBusy(true);
    try {
      const size = framingSize(format);
      const capture = await captureFraming.current(size.width, size.height);
      const frame = await saveFraming(id, capture);
      if (activeProject.current !== project) return;
      setHistory(state => planReducer(state, { type: "replace", plans: state.plans.map(item => item.id === id ? { ...item, input: { ...item.input, framing: frame } } : item) }));
      // Say the switch out loud: a kept framing moves an H3 plan to LTX, at LTX's price.
      if (engine === "h3" && !prefs.engineManual) setNotice(t("framing.switched", { before: engineCredits.h3 === null ? "—" : formatCredits(engineCredits.h3), after: framedLtx === null ? "—" : formatCredits(framedLtx) }));
    } catch { setNotice(t("framing.failed")); }
    finally { framingSaving.current = false; setFramingBusy(false); }
  }

  async function generate() {
    if (!canGenerate) return;
    try {
      await planWrites.current;
      await persist(drafts.map(item => item.id === draft.id ? { ...item, input } : item));
      await requestRun({ planId: draft.id, castIds: input.castIds, decorId: input.decorId, line: input.action, prompt: buildPrompt(input, essai, { cadre, ...intention.extra }).text, settings: planSettings, resume: resumeFor(input), change: changeFor(input), extraRefs: intention.decided.refs.filter(ref => ref.kind === "etat").map(ref => ref.path), framingRef: input.framingRef, framing: framingSent ? input.framing : undefined });
    } catch (error) { setNotice(error instanceof Error ? error.message : t("p0.saveFailed")); }
  }

  // « Tourner le plan suivant »: one tap creates the next plan with the same cast, décor and staging, then asks once.
  const isLast = index === drafts.length - 1;
  // The bar points to a plan that exists and has no take yet, before it offers to write a new one.
  const pendingPlan = demo ? null : [...drafts.slice(index + 1), ...drafts.slice(0, index)].find(item => !item.hasTake && item.render?.phase !== "running" && !item.kept && !item.finalised) ?? null;
  const pendingNumber = pendingPlan ? drafts.indexOf(pendingPlan) + 1 : 0;
  const showNext = !demo && isLast && !pendingPlan && (versions.length > 0 || runningHere) && drafts.length < 12;
  const nextNumber = drafts.length + 1;
  const canNext = canGenerate && nextAction.trim().length > 0;
  async function tournerSuivant() {
    if (!canNext) return;
    const n = nextNumber;
    const id = nextPlanId(reservedPlanIds());
    const nextInput: PlanInput = { ...input, action: nextAction.trim().slice(0, ACTION_MAX), imageCle: "aucune", enchainer: false, imageFin: false, hasKeptTake: false, previousKept: Boolean(draft.kept) };
    const item: Draft = { ...blank(id, `Plan ${n}`, format), input: nextInput };
    const next = [...drafts, item];
    try {
      await writeProjectFile(`.uttu/maquette-${id}.json`, maquetteJson(maquette));
      editPlans(next, id);
      setNextAction("");
      await persist(next, id);
      const nextIntention = intentionFor(nextInput.action, id, nextInput);
      const nextEngine = engineFor(nextInput, nextIntention.decided);
      const nextSettings: TakeSettings = { seconds: nextInput.duree, aspect: baseSettings.aspect, quality: "rapide", engine: nextEngine, ...(nextEngine === "ltx" && nextInput.framing ? { cadrage: "depth-edges-v1" as const } : {}), ...(nextEngine === "ltx" && rendu === "apercu" ? { rendu: "apercu" as const } : {}) };
      await requestRun({ planId: id, castIds: nextInput.castIds, decorId: nextInput.decorId, line: nextInput.action, prompt: buildPrompt(nextInput, decide(nextInput, "essai"), { cadre, ...nextIntention.extra }).text, settings: nextSettings, resume: resumeFor(nextInput, id), change: changeFor(nextInput, id), extraRefs: nextIntention.decided.refs.filter(ref => ref.kind === "etat").map(ref => ref.path), framingRef: nextInput.framingRef, framing: nextSettings.cadrage ? nextInput.framing : undefined });
    } catch (error) { setNotice(error instanceof Error ? error.message : t("p0.saveFailed")); }
  }

  function planWord(item: Draft): string {
    if (item.render && item.render.phase !== "done") return t(`p0.editor.states.${item.render.phase}`);
    const mark = etatOf(item);
    if (item.hasTake && !item.kept && !item.finalised) return t("p0.editor.states.done");
    if (mark !== "vide") return t(`p0.etat.${mark}`);
    const live = item.id === draft.id;
    const filled = Boolean(item.input.action.trim() || item.input.castIds.length > 0 || item.input.decorId)
      || (live && (maquette.figures.length > 0 || Boolean(shownPlace)));
    return filled ? t("r7.enPlace") : t("p0.editor.states.draft");
  }
  const total = drafts.reduce((sum, item) => sum + item.input.duree, 0);
  const planLabel = t("p0.planN", { n: String(index + 1) });

  async function persist(next: Draft[], focus = draft.id) {
    const shot = next.find(item => item.id === focus);
    if (!shot) return;
    const ordre = next.findIndex(item => item.id === focus);
    const decision = decide({ ...shot.input, format }, primaryIntent({ ...shot.input, format }));
    // A late save must never drop a take that landed meanwhile: merge with the note on disk.
    const onDisk = takeIdsFromShotNote(await readProjectFile(`Shots/${shot.id}.md`).catch(() => undefined));
    const record: StoredPlan = {
      id: shot.id,
      name: shot.name,
      ordre,
      etat: etatOf(shot),
      input: { ...shot.input, format },
      graph: decision.graph ?? "",
      pourquoi: decision.pourquoi,
      takeIds: mergeTakeIds(shot.takeIds ?? [], studio.shots.find(item => item.id === shot.id)?.takeIds ?? [], onDisk),
      garde: shot.garde,
      imageCle: shot.before,
      imageFin: "",
      finalVideo: shot.finalised ? shot.after : "",
    };
    await writeProjectFile(`Shots/${shot.id}.md`, planMarkdown(record));
  }

  function addPlan() {
    const id = nextPlanId(reservedPlanIds());
    const next = [...drafts, blank(id, t("p0.planN", { n: String(drafts.length + 1) }), format)];
    editPlans(next, id);
    setPanel(false);
  }

  function dropOn(id: string) {
    if (!dragId || dragId === id) return;
    const order = moveId(drafts.map(item => item.id), dragId, id);
    editPlans(order.flatMap(key => drafts.find(item => item.id === key) ?? []));
    setDragId(null);
  }

  function deletePlanAt(id: string) {
    const { next, removed } = removePlan(drafts, id);
    if (!removed) return;
    const list = next.length ? next : [blank(nextPlanId(reservedPlanIds()), t("p0.planN", { n: "1" }), format)];
    editPlans(list, currentId === id ? list[Math.min(removed.at, list.length - 1)].id : currentId);
    setPanel(false);
  }

  function duplicateAt(id: string) {
    const { next, id: copy } = duplicatePlan(drafts, id, (source, newId) => ({ ...blank(newId, `${source.name} · ${t("p0.plans.copy")}`, format), input: { ...structuredClone(source.input), imageCle: "aucune" as const, hasKeptTake: false }, maquetteSeed: maquetteJson(maquette) }), reservedPlanIds());
    if (!copy) return;
    // The seed travels with the draft; an asynchronous copy cannot race its first load.
    editPlans(next, copy);
    setPanel(false);
  }

  function moveAt(id: string, dir: -1 | 1) { editPlans(stepMove(drafts, id, dir)); }

  function reservedPlanIds(): string[] {
    return [...new Set([...drafts.map(item => item.id), ...history.past.flatMap(step => step.plans.map(item => item.id)), ...studio.shots.map(item => item.id), ...(runOrigin?.project === studio.project ? [runOrigin.planId] : [])])];
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

  /** The sentence names who, where, how long, which format: the plan follows. Nothing named → nothing changes. */
  function fromSentence(action: string): Partial<PlanInput> {
    const read = resolveIntention(action, { cast: knownCast, decor: knownDecor });
    const partial: Partial<PlanInput> = {};
    const ids = read.who.map(item => item.id).filter(id => people.some(person => person.id === id)).slice(0, MAX_FIGURES);
    if (ids.length && !maquette.lockPose && ids.join(",") !== maquette.figures.map(figure => figure.id).join(",")) {
      setMaquette(state => {
        let next = state;
        for (const figure of state.figures) if (!ids.includes(figure.id)) next = removeFigure(next, figure.id);
        for (const id of ids) {
          const person = people.find(item => item.id === id);
          if (person && !next.figures.some(figure => figure.id === id) && canAddFigure(next)) next = addFigure(next, { id: person.id, name: person.name });
        }
        return next;
      });
      partial.castIds = ids;
    }
    if (read.where && read.where.id !== (draft.input.decorId ?? shownPlace?.id ?? null)) {
      setPlaceCleared(false);
      partial.decorId = read.where.id;
    }
    if (read.duration && read.duration.seconds !== draft.input.duree) partial.duree = read.duration.seconds;
    if (read.format && read.format.value !== format) setFormat(read.format.value);
    return partial;
  }

  function onAction(action: string) {
    const id = tuileInText(action, knownLabels);
    const named = fromSentence(action);
    if (id && tuileNeedsPair(id) && maquette.figures.length < 2) {
      patch({ ...named, action });
      return;
    }
    if (id && id !== maquette.tuile) {
      const preset = tuileById(id);
      setMaquette(state => applyTuile(state, id));
      patch({ ...named, action, cadrage: preset.cadrage, camera: preset.camera });
      return;
    }
    patch({ ...named, action });
  }

  function saveState(characterId: string) {
    if (!memory || !stateDraft.trim()) return;
    setMemory(changeState(memory, characterId, draft.id, stateDraft, new Date().toISOString()));
    setStateEdit(null);
    setStateDraft("");
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

  // « Monter la séquence »: every plan goes to the cut in order, with its kept take (else its newest take).
  const sequenceShots = drafts.map(item => ({ id: item.id, takeIds: mergeTakeIds(item.takeIds ?? [], studio.shots.find(shot => shot.id === item.id)?.takeIds ?? []) }));
  const sequence = sequenceTakes(drafts.map(item => ({ id: item.id, garde: item.garde })), sequenceShots, studio.takes);
  const withTake = sequence.filter(entry => entry.take).length;
  function stillOf(plan: PlanInput): string {
    return places.find(place => place.id === plan.decorId)?.src
      || people.find(person => person.id === plan.castIds[0])?.src
      || "";
  }
  // Takes without a poster: first decoded frame for the plan strip (local, cached).
  const [frames, setFrames] = useState<Record<string, string>>({});
  const frameKey = sequence.map(entry => entry.take && !(entry.take.poster && media[entry.take.poster]) && media[entry.take.video] ? entry.take.id : "").join("|");
  useEffect(() => {
    let gone = false;
    for (const entry of sequence) {
      const take = entry.take;
      if (!take || (take.poster && media[take.poster]) || frames[take.id] || !media[take.video]) continue;
      void framePoster(media[take.video]).then(image => { if (!gone && image) setFrames(map => ({ ...map, [take.id]: image })); });
    }
    return () => { gone = true; };
  }, [frameKey]);
  const canMonter = !sending && (withTake > 0 || Boolean(stillOf(input)));
  async function monter(keptOverride?: { planId: string; takeId: string }) {
    if (!canMonter) return;
    setSending(true);
    try {
      const live = drafts.map(item => ({ ...(item.id === draft.id ? { ...item, input } : item), ...(keptOverride?.planId === item.id ? { kept: true, garde: keptOverride.takeId } : {}) }));
      const chosen = sequenceTakes(live.map(item => ({ id: item.id, garde: item.garde })), sequenceShots, studio.takes);
      await persist(live);
      await sendSequence(live.map((item, at) => {
        const entry = chosen[at];
        const plan = item.input;
        return {
          takeId: entry?.take?.id,
          planId: item.id,
          label: plan.action.trim() || item.name || t(`r7.tuile.${maquette.tuile}`),
          seconds: plan.duree,
          aspect: plan.format === "9:16" ? "vertical" as const : "horizontal" as const,
          still: entry?.take ? "" : stillOf(plan),
          prompt: item.id === draft.id ? prompt.text : "",
          sceneName: places.find(place => place.id === plan.decorId)?.name ?? "",
          composeur: planJson(plan, { etat: etatOf(item), before: item.before, after: item.after, garde: item.garde }),
        };
      }));
      onMontage();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("p0.montageFailed"));
    } finally {
      setSending(false);
    }
  }

  // P1-4: a kept take lands on the cut by itself, once, without leaving PRISE.
  // MONTAGE dedupes by take id and by source, so keeping twice never doubles the clip.
  const [keptWaiting, setKeptWaiting] = useState<{ planId: string; takeId: string } | null>(null);
  async function keptToMontage(planId: string, takeId: string): Promise<boolean> {
    const take = studio.takes.find(item => item.id === takeId);
    const stored = drafts.find(item => item.id === planId);
    const plan = stored && planId === draft.id ? { ...stored, input } : stored;
    if (!take || !plan) return false;
    if (!media[take.video]) { setKeptWaiting({ planId, takeId }); setNotice(t("p0.montageWait")); return false; }
    setKeptWaiting(null);
    try {
      await sendToMontage({
        takeId, planId, label: plan.input.action.trim() || plan.name || take.line, seconds: plan.input.duree,
        aspect: plan.input.format === "9:16" ? "vertical" : "horizontal", still: "", prompt: "",
        sceneName: places.find(place => place.id === plan.input.decorId)?.name ?? "",
        composeur: planJson(plan.input, { etat: etatOf(plan), before: plan.before, after: plan.after, garde: takeId }),
      });
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("p0.montageFailed"));
      return false;
    }
  }
  const waitingVideo = keptWaiting ? media[studio.takes.find(take => take.id === keptWaiting.takeId)?.video ?? ""] ?? "" : "";
  useEffect(() => {
    if (!keptWaiting || !waitingVideo) return;
    void keptToMontage(keptWaiting.planId, keptWaiting.takeId).then(ok => { if (ok) setNotice(t("p0.keptOnMontage")); });
  }, [keptWaiting, waitingVideo]);

  function keep(takeId: string) {
    const next = drafts.map(item => item.id === draft.id ? { ...item, kept: true, garde: takeId } : item);
    editPlans(next);
    void keptToMontage(draft.id, takeId).then(ok => { if (ok) setNotice(t("p0.keptOnMontage")); });
  }

  async function keepAndMontage(takeId: string) {
    const next = drafts.map(item => item.id === draft.id ? { ...item, kept: true, garde: takeId } : item);
    editPlans(next);
    if (!media[studio.takes.find(take => take.id === takeId)?.video ?? ""]) {
      setKeptWaiting({ planId: draft.id, takeId });
      setNotice(t("p0.montageWait"));
      return;
    }
    await monter({ planId: draft.id, takeId });
  }

  // Demo keeps its illustrative quote; production shows the plan's own single estimate.
  const statusWord = t(cardDecision.statut === "mesure" ? "create.statusMeasured" : cardDecision.statut === "hypothese" ? "create.statusHypothesis" : "create.statusUnknown");
  const estimate = demo
    ? (cardDecision.quote === null ? t("create.quoteUnknown") : t("create.quoteLead", { quote: fr(cardDecision.quote), status: statusWord }))
    : quoteWords(t, planQuote);
  const states = protocole(runningHere
    ? { prepared: true, checked: true, quoted: true, running: true }
    : failedHere
      ? { prepared: true, checked: true, quoted: true, failed: true }
      : landed
        ? { prepared: true, checked: true, quoted: true, landed: true, archived: true }
        : { prepared: Boolean(input.castIds.length || shownPlace), checked: canGenerate, quoted: quoted && !demo, confirming: sheet === "confirm" && runPlan === draft.id });
  const versionIndex = landed ? versions.findIndex(take => take.id === landed.id) + 1 : 0;
  const where = landed ? t("p0.fiab.whereTake", { plan: planLabel, n: versionIndex, total: versions.length }) : "";
  const failure = failedHere ? draft.render?.message || (run.phase === "error" ? say(run.message) : "") : "";

  type Action = { label: string; enabled: boolean; reason: string; onClick(): void; mark: string };
  const monterAction: Action = { label: withTake > 0 ? t("p0.monter", { count: withTake }) : t("p0.monterStill"), enabled: canMonter, reason: "", onClick: () => void monter(), mark: "monter" };
  let gold: Action;
  let second: Action | null = null;
  if (demo) { gold = { label: t("p0.tourner"), enabled: false, reason: t("p0.why.demo"), onClick() {}, mark: "tourner" }; second = monterAction; }
  else if (busy) { gold = { label: t("p0.running"), enabled: false, reason: runningHere ? t("p0.runningWhy") : t("p0.why.busy"), onClick() {}, mark: "attente" }; second = withTake > 0 ? monterAction : null; }
  else if (pendingPlan && versions.length > 0) { gold = { label: t("p0.goPlan", { n: String(pendingNumber) }), enabled: true, reason: "", onClick: () => { setCurrentId(pendingPlan.id); setPanel(false); setAsk(null); window.scrollTo({ top: 0, behavior: "instant" }); }, mark: "aller" }; second = withTake > 0 ? monterAction : null; }
  else if (showNext) { gold = { label: planCredits === null ? t("p0.tournerSuivant", { n: String(nextNumber) }) : t("p0.rendu.goNext", { n: String(nextNumber), credits: planAmount ?? formatCredits(planCredits) }), enabled: canNext, reason: canNext ? "" : nextAction.trim() ? generateReason : t("p0.why.nextWords", { n: String(nextNumber) }), onClick: () => void tournerSuivant(), mark: "suivant" }; second = withTake > 0 ? monterAction : null; }
  else if (versions.length > 0) gold = monterAction;
  // Default level: no still-image shortcut. MONTAGE gets takes; the example (demo) keeps its still.
  else { gold = { label: planCredits === null ? t("p0.tourner") : t("p0.rendu.go", { credits: planAmount ?? formatCredits(planCredits) }), enabled: canGenerate, reason: generateReason, onClick: () => void generate(), mark: "tourner" }; second = withTake > 0 && canMonter ? monterAction : null; }
  const reasonText = gold.enabled ? "" : gold.reason;

  function goEtape(next: Etape) {
    setEtape(next);
    if (next === "previs") { setAdvanced(true); setMaquetteAsk(value => value + 1); }
    // « Prévisualiser » opened « Avancé » itself: leaving the step folds it back.
    else if (etape === "previs") setAdvanced(false);
    if (next === "plans") setEditorOpen(true);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const etapeAt = ETAPES.indexOf(etape);
  const etapePrev = etapePrecedente(etape);
  const etapeNext = etapeSuivante(etape);

  return <section className="u-stage u-prise" data-section="prise" data-prise-shell="" data-prise-etape={etape} data-prise-ready={ready && plansLoaded === (studio.project ?? "") ? "true" : undefined} data-prise-seed={seed} aria-labelledby="u-title">
    <nav className="u-prise-steps" aria-label={t("p0.etapes.aria")} data-prise-steps="">
      <ol>
        {ETAPES.map((id, at) => <li key={id}>
          <button type="button" data-prise-step={id} aria-current={etape === id ? "step" : undefined} data-done={at < etapeAt ? "" : undefined} aria-label={`${t("p0.etapes.step", { n: String(at + 1) })} · ${t(`p0.etapes.${id}`)}`} onClick={() => goEtape(id)}>
            <span className="u-prise-step-n" aria-hidden="true">{at + 1}</span>
            <span className="u-prise-step-name">{t(`p0.etapes.${id}`)}</span>
          </button>
        </li>)}
      </ol>
      <p className="u-prise-step-lead" data-prise-step-lead={etape}>{t(`p0.etapes.lead.${etape}`)}</p>
    </nav>
    <aside className="u-prise-strip" aria-label={t("p0.plans.label")}>
      <p className="u-label">{t("p0.plans.label")}</p>
      <div className="u-prise-film">
        {drafts.map((item, at) => {
          const mark = etatOf(item);
          const take = sequence[at]?.take;
          const poster = take?.poster;
          const thumb = item.before || (poster && media[poster]) || (take ? frames[take.id] : "") || "";
          const word = planWord(item);
          return <button
            key={item.id}
            type="button"
            className="u-plan-card"
            draggable
            aria-current={item.id === draft.id ? "true" : undefined}
            data-etat={mark}
            data-plan={item.id}
            aria-label={`${item.name} · ${word}`}
            data-render-state={item.render?.phase ?? (item.hasTake ? "done" : "draft")}
            onDragStart={() => setDragId(item.id)}
            onDragOver={event => event.preventDefault()}
            onDrop={() => dropOn(item.id)}
            onClick={() => { setCurrentId(item.id); setPanel(item.finalised || item.kept); setAsk(null); }}
          >
            <span className="u-plan-num">{String(at + 1)}</span>
            <span className={thumb ? "u-plan-thumb" : "u-plan-thumb is-empty"}>{thumb ? <img src={thumb} alt="" /> : null}</span>
            <span className="u-plan-etat">{word}</span>
            <span className="u-plan-name">{item.name}</span>
            {(item.render?.phase === "queued" || item.render?.phase === "running") && <progress aria-label={word} />}
            <span className="u-plan-time">{item.input.duree} s</span>
          </button>;
        })}
        <button type="button" className="u-plan-add" onClick={addPlan}>{t("p0.addPlan")}</button>
      </div>
      {!demo && <div className="u-plan-tools" role="group" aria-label={t("p0.plans.tools", { n: String(index + 1) })} data-plan-tools="">
        {history.past.length > 0 && !undoToast && <button type="button" className="u-secondary" data-plan-undo-action="" onClick={undoPlan}>{t("p0.plans.undo")}</button>}
        {drafts.length < 12 && <button type="button" className="u-secondary" data-plan-duplicate="" onClick={() => void duplicateAt(draft.id)}>{t("p0.plans.duplicate")}</button>}
        {index > 0 && <button type="button" className="u-secondary" data-plan-up="" aria-label={t("p0.plans.up")} onClick={() => moveAt(draft.id, -1)}>↑</button>}
        {index < drafts.length - 1 && <button type="button" className="u-secondary" data-plan-down="" aria-label={t("p0.plans.down")} onClick={() => moveAt(draft.id, 1)}>↓</button>}
        <button type="button" className="u-secondary" data-plan-delete="" onClick={() => deletePlanAt(draft.id)}>{t("p0.plans.delete")}</button>
      </div>}
      {!demo && history.revision > 0 && history.past.length > 0 && <PlanUndo revision={history.revision} text={t("p0.editor.changed")} label={t("p0.plans.undo")} onUndo={undoPlan} onVisible={setUndoToast} />}
      {!demo && <p className="u-plan-save" role="status" data-plan-save={planSaveState}>{t(`p0.editor.save.${planSaveState}`)}</p>}
      <p className="u-plan-sum">{t("p0.sequenceSum", { time: clock(total), count: drafts.length })}</p>
    </aside>

    <div className="u-prise-side">
    <div className="u-prise-preview">
      <p className="u-label">{t("p0.preview")}</p>
      {runningHere && <div className="u-card u-run" role="status" data-prise-progress="">
        <ComfyProgress label={t("job.running")} elapsedSec={priseElapsed} typicalSec={typicalFor("prise")} note={t("finaliser.keepOpen")} marker="prise" />
        <button type="button" className="u-link" onClick={cancelRun}>{t("job.stopWaiting")}</button>
      </div>}
      {failedHere && <div className="u-plan-error" role="alert" data-plan-error=""><p>{failure}</p>{receiptBlocked
        ? <button type="button" className="u-secondary" data-plan-recover="" onClick={resumeRun}>{t("p0.editor.recover")}</button>
        : <><button type="button" className="u-secondary" data-plan-retry="" disabled={!canGenerate} aria-describedby={!canGenerate ? "u-plan-retry-why" : undefined} onClick={() => void generate()}>{t("p0.editor.retry")}</button>{!canGenerate && <p id="u-plan-retry-why" className="u-why">{generateReason}</p>}</>}</div>}
      {landed && <div className="u-take-view" data-take-view={landed.id} data-versions={versions.length} data-media-ready={media[landed.video] ? "true" : "false"}>
        <p className="u-label">{t("p0.takeOf", { n: versionIndex, total: versions.length })}{draft.garde === landed.id ? ` · ${t("p0.kept")}` : ""}</p>
        {media[landed.video]
          ? <video controls playsInline src={media[landed.video]} />
          : <div className="u-card u-run" role="status" data-prise-media-wait=""><ComfyProgress label={t("job.running")} elapsedSec={priseElapsed} typicalSec={typicalFor("prise")} note={t("finaliser.keepOpen")} marker="prise-wait" /></div>}
        {versions.length > 1 && <div className="u-versions" role="group" aria-label={t("p0.versions")}>
          {versions.map((take, at) => <button key={take.id} type="button" data-version={take.id} aria-pressed={take.id === landed.id} onClick={() => setViewed(map => ({ ...map, [draft.id]: take.id }))}>{t("p0.versionN", { n: at + 1 })}{take.id === draft.garde ? " ★" : ""}</button>)}
        </div>}
        <div className="u-card-actions">
          <button type="button" className="u-secondary" data-garder="" aria-pressed={draft.garde === landed.id} onClick={() => keep(landed.id)}>{draft.garde === landed.id ? t("p0.keptBtn") : t("p0.keep")}</button>
          <button type="button" className="u-secondary" data-ajouter-montage="" disabled={!media[landed.video] || sending} aria-describedby={!media[landed.video] || sending ? "u-why-montage" : undefined} onClick={() => void keepAndMontage(landed.id)}>{t("p0.addToMontage")}</button>
          <button type="button" className="u-secondary" data-autre-prise="" disabled={!canGenerate} aria-describedby={!canGenerate ? "u-why-autre" : undefined} onClick={() => void generate()}>{t("p0.another")}</button>
        </div>
        {(!media[landed.video] || sending) && <p className="u-why" id="u-why-montage">{sending ? t("p0.running") : t("finaliser.keepOpen")}</p>}
        {!canGenerate && <p className="u-why" id="u-why-autre">{generateReason}</p>}
        {media[landed.video] && <EtEnsuite source={{ kind: "video", url: media[landed.video], name: landed.id, path: landed.video, aspect: format === "9:16" ? "vertical" : "horizontal" }} />}
      </div>}
      {draft.finalised && draft.before
        ? <Compare before={draft.before} after={draft.after || draft.before} ratio={format} />
        : !landed && !runningHere && <ToolStage
          view="source"
          source={<figure className="u-prise-still" data-prise-still="" data-ratio={format === "9:16" ? "9/16" : "16/9"}>
            {shownPlace?.src ? <img src={shownPlace.src} alt="" /> : <span className="u-prise-still-empty" aria-hidden="true" />}
            <figcaption>{[maquette.figures.map(figure => figure.name).join(", "), shownPlace?.name].filter(Boolean).join(" · ") || t("p0.stillEmpty")}</figcaption>
          </figure>}
          lab={shownPlace?.src ? <>{t("shell.source")}</> : null}
        />}
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

      {!demo && <details className="u-fold u-plan-editor" data-plan-editor={draft.id} open={editorOpen} onToggle={event => setEditorOpen(event.currentTarget.open)}>
        <summary>{t("p0.editor.title")}</summary>
        <div className="u-plan-fields">
          <label>{t("p0.editor.name")}<input aria-label={t("p0.editor.name")} maxLength={80} value={draft.name} onChange={event => editPlans(drafts.map(item => item.id === draft.id ? { ...item, name: event.target.value } : item), draft.id, `${draft.id}:title`)} /></label>
          <label>{t("p0.editor.framing")}<select aria-label={t("p0.editor.framing")} value={input.cadrage} onChange={event => patch({ cadrage: event.target.value as Cadrage, manualFraming: true })}>{CADRAGES.map(value => <option key={value} value={value}>{t(`p0.editor.framings.${value}`)}</option>)}</select></label>
          <label>{t("p0.editor.angle")}<select aria-label={t("p0.editor.angle")} value={input.angle ?? "niveau"} onChange={event => patch({ angle: event.target.value as PlanInput["angle"] })}>{(["niveau", "plongee", "contre-plongee"] as const).map(value => <option key={value} value={value}>{t(`p0.editor.angles.${value}`)}</option>)}</select></label>
          <label>{t("p0.editor.move")}<select aria-label={t("p0.editor.move")} value={input.camera} onChange={event => patch({ camera: event.target.value as CameraMove, manualCamera: true })}>{CAMERAS.map(value => <option key={value} value={value}>{t(`p0.camera.move.${value}`)}</option>)}</select></label>
          <label>{t("p0.editor.position")}<input aria-label={t("p0.editor.position")} maxLength={160} placeholder={t("p0.editor.positionHint")} value={input.cameraPosition ?? ""} onChange={event => patch({ cameraPosition: event.target.value })} /></label>
          <label>{t("p0.duration")}<select aria-label={t("p0.editor.duration")} value={input.duree} onChange={event => patch({ duree: Number(event.target.value) as PlanInput["duree"] })}><option value="5">5 s</option>{input.duree === 8 && <option value="8">8 s</option>}<option value="10">10 s</option></select></label>
          <label className="u-plan-field-wide">{t("p0.editor.reference")}<select aria-label={t("p0.editor.reference")} value={input.framingRef ?? ""} onChange={event => patch({ framingRef: event.target.value })}><option value="">{t("p0.editor.none")}</option>{framingGroups(Object.keys(media), studio.scenes, cast, input.decorId).map(({ group, items }) => <optgroup key={group} label={t(`p0.editor.refGroups.${group}`)} data-framing-group={group}>{items.map(item => <option key={item.path} value={item.path}>{item.kind === "image" && item.n <= 1 ? item.name : `${item.name} · ${t(`p0.editor.refKinds.${item.kind}`)}${item.n ? ` ${item.n}` : ""}`}</option>)}</optgroup>)}</select></label>
        </div>
        {input.framingRef && media[input.framingRef] && <img className="u-plan-ref" src={media[input.framingRef]} alt={t("p0.editor.reference")} />}
        <p className="u-why">{t("p0.editor.referencesHint")}</p>
      </details>}

      <Row className="u-who-row" label={t("p0.who")}>
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
            <span>{t("p0.addPerson")}</span>
          </button>
        </div>
      </Row>

      <Row label={t("p0.where")}>
        {mine.length === 0 && <button type="button" className="u-where-empty" onClick={goDecor} data-ou-vide="">
          <span className="u-place-face is-empty" aria-hidden="true"><AddPlaceIcon /></span>
          <span><strong>{t("p0.firstPlace")}</strong><small>{t("p0.firstPlaceHint")}</small></span>
        </button>}
        {mine.length === 0 && places.length > 0 && <p className="u-where-note">{t("p0.orExample")}</p>}
        <div className="u-choice-row u-where" data-ou-count={places.length} data-ou-source={mine.length > 0 ? "mes-decors" : "exemples"}>
          {places.map(place => {
            const on = shownPlace?.id === place.id;
            return <button key={place.id} type="button" className="u-place" aria-pressed={on} aria-label={place.exemple ? `${t("p0.example")} ${place.name}` : place.name} onClick={() => choosePlace(place.id)}>
              <span className="u-place-face">{place.src ? <img src={place.src} alt="" /> : <i />}{place.exemple && <em className="u-place-tag">{t("p0.example")}</em>}</span>
              <span>{place.name}</span>
            </button>;
          })}
          {mine.length > 0 && <button type="button" className="u-place u-add-tile" onClick={goDecor}>
            <span className="u-place-face is-empty" aria-hidden="true"><AddPlaceIcon /></span>
            <span>{t("p0.addPlace")}</span>
          </button>}
        </div>
      </Row>

      <Row className="u-scene-row" label={t("r7.cequi")}>
        <label className="u-field">
          <textarea aria-label={t("r7.cequi")} aria-describedby="u-intent-hint" value={input.action} rows={3} maxLength={ACTION_MAX} placeholder={t("p0.actionPh")} onChange={event => onAction(event.target.value)} />
        </label>
        <p className="u-intent-hint" id="u-intent-hint">{t("p1.hint")}</p>
        {input.action.trim() && <IntentionChips
          names={maquette.figures.map(figure => figure.name)}
          place={shownPlace?.name ?? ""}
          camera={(() => {
            const pick = input.manualCamera ? input.camera : cameraPick[draft.id];
            const move = pick === undefined ? (intention.read.camera.move ?? cameraChoice(input.action, input.camera).move) : pick === "none" ? null : pick;
            const label = move ? t(`p0.camera.move.${move}`) : t("p1.chip.cameraFree");
            return { value: pick ?? "auto", label: move === "orbite" && intention.read.camera.degrees && pick === undefined ? t("p1.chip.degrees", { move: label, degrees: intention.read.camera.degrees }) : label, autoLabel: t("p1.chip.cameraWords") };
          })()}
          moves={CAMERAS.map(move => ({ move, label: t(`p0.camera.move.${move}`) }))}
          ambiance={ambianceOff[draft.id] ? [] : intention.read.ambiance.map(item => item.label)}
          duree={input.duree}
          unknown={intention.read.unknown}
          line={uttuLine(intention.decided).line.map(sayIt)}
          flags={uttuLine(intention.decided).flags.map(sayIt)}
          t={t}
          onWho={() => document.querySelector<HTMLElement>(".u-who-row button")?.focus()}
          onWhere={() => document.querySelector<HTMLElement>(".u-where button")?.focus()}
          onCamera={value => {
            if (value !== "auto" && value !== "none") patch({ camera: value as CameraMove, manualCamera: true });
            else {
              patch({ manualCamera: false });
              setCameraPick(map => {
                const next = { ...map };
                if (value === "none") next[draft.id] = "none";
                else delete next[draft.id];
                return next;
              });
            }
          }}
          onDropAmbiance={() => setAmbianceOff(map => ({ ...map, [draft.id]: true }))}
          onDuree={seconds => patch({ duree: seconds })}
          onUnknown={goCast}
        />}
        {!demo && memory && intention.inherited.length > 0 && <div className="u-continuity" role="group" aria-label={t("p1.cont.aria")} data-continuite="">
          {intention.inherited.map(row => {
            const code = shotCode(memory, draft.id) || `A-${String(index + 1).padStart(2, "0")}`;
            return <div className="u-cont-row" key={row.characterId} data-cont={row.name} data-etat={row.state?.label ?? ""}>
              <span className={row.state ? "u-cont-chip is-on" : "u-cont-chip"}>{row.state ? t("p1.cont.chip", { name: row.name, state: row.state.label, code: row.state.fromCode || code }) : t("p1.cont.none", { name: row.name })}</span>
              {stateEdit !== row.characterId && <button type="button" className="u-link u-cont-change" data-changer-etat={row.name} onClick={() => { setStateEdit(row.characterId); setStateDraft(""); }}>{row.state ? t("p1.cont.change") : t("p1.cont.set")}</button>}
              {stateEdit === row.characterId && <form className="u-cont-form" onSubmit={event => { event.preventDefault(); saveState(row.characterId); }}>
                <label className="u-field"><span className="u-label">{t("p1.cont.label", { name: row.name, code })}</span>
                  <input value={stateDraft} maxLength={120} placeholder={t("p1.cont.ph")} autoFocus onChange={event => setStateDraft(event.target.value)} />
                </label>
                <span className="u-cont-actions">
                  <button type="submit" className="u-secondary">{t("p1.cont.save")}</button>
                  <button type="button" className="u-link" onClick={() => setStateEdit(null)}>{t("p1.cont.cancel")}</button>
                </span>
              </form>}
            </div>;
          })}
        </div>}
        <div className="u-choice-row u-actions">
          {ACTION_EXAMPLES.map((example, at) => {
            const words = t(`p0.action.${at}`);
            return <button key={example} type="button" className="u-chip" aria-pressed={input.action === words} onClick={() => onAction(words)}>{words}</button>;
          })}
        </div>
      </Row>


      {<Row label={t("stage.engine.label")}>
        <div className="u-choice-row u-engine" data-engine={engine} data-engine-mode={prefs.engineManual ? "main" : "auto"} data-framing-sent={framingSent ? "" : undefined}>
          <button type="button" className="u-chip" data-engine-auto="" aria-pressed={!prefs.engineManual} onClick={() => setPrefs({ engineManual: false })}>{t("p1.engineAuto")} · {(input.framing ? "ltx" : intention.decided.auto) === "h3" ? "H3" : "LTX"}</button>
          {(["h3", "ltx"] as const).map(item => (
            <button key={item} type="button" className="u-chip" data-engine-choice={item} aria-pressed={prefs.engineManual && prefs.engine === item} onClick={() => setPrefs({ engine: item, engineManual: true })}>{t(`stage.engine.${item}`)}{engineAmount[item] === null ? "" : ` · ${t("p0.rendu.quote", { credits: engineAmount[item]! })}`}</button>
          ))}
        </div>
        <p className="u-engine-hint" data-engine-hint="">{input.framing
          ? engine === "ltx"
            ? t("framing.ltxSent", { credits: engineCredits.ltx === null ? "—" : formatCredits(engineCredits.ltx) })
            : t("framing.h3NotSent")
          : t(engine === "ltx" ? "stage.engine.ltxHint" : "stage.engine.h3Hint")}</p>
      </Row>}

      <OutilsStrip onglet="prise" />
      <details className="u-fold u-avance" data-avance-prise="" open={advanced} onToggle={event => setAdvanced(event.currentTarget.open)}>
        <summary>{t("p0.advanced")}</summary>
        {!demo && withTake === 0 && canMonter && <button type="button" className="u-secondary" data-envoyer-montage="" data-image-fixe="" onClick={() => void monter()}>{t("p0.monterStill")}</button>}
        {/* AVANCÉ is short collapsed groups; the gestures that do not need the maquette live in Outils. */}
        <AvanceGroup id="maquette" title={t("p0.groups.maquette")} ask={maquetteAsk} onOpen={seeMaquette}>
        <div className="u-maquette-avance" data-maquette-avance="" data-framing-mode={maquetteMode}>
      {maquetteSeen && <MaquetteView
          state={{ ...maquette, props: maquette.props?.map(prop => ({ ...prop, url: prop.source ? media[prop.source] : undefined })) }}
          backdrop={quartier && !force2D && maquetteMode !== "plat" ? "" : (shownPlace?.src || "")}
          placeName={shownPlace?.name || ""}
          quartier={quartier}
          badge={t(`r7.tuile.${maquette.tuile}`)}
          hint={t(maquetteMode === "plat" ? "framing.flatHint" : "r7.hint")}
          force2D={force2D}
          aspect={format}
          onWebGLFailed={onWebGLFailed}
          onMode={setMaquetteMode}
          onCaptureReady={onCaptureReady}
          onFlat={flat => setMaquette(state => ({ ...state, flat }))}
          onMove={(id, x, z) => setMaquette(state => moveFigure(state, id, x, z))}
          onOrbit={(dx, dy) => setMaquette(state => orbitDrag(state, dx, dy))}
          onPinch={(previous, distance) => setMaquette(state => pinch(state, previous, distance))}
          onMoveProp={(id, x, z) => setMaquette(state => moveProp(state, id, x, z))}
          playFrom={playFrom}
        />}
      <div className="u-framing-controls" data-framing-panel="">
        <div className="u-choice-row">
          {!noWebGL && <button type="button" className="u-chip" disabled={framingBusy} aria-describedby={framingBusy ? "u-framing-wait" : undefined} aria-pressed={!force2D} onClick={() => { if (force2D) { onCaptureReady(null); setForce2D(false); } }}>{t("framing.three")}</button>}
          <button type="button" className="u-chip" data-framing-2d="" disabled={framingBusy} aria-describedby={framingBusy ? "u-framing-wait" : undefined} aria-pressed={force2D || maquetteMode === "plat"} onClick={() => { if (!force2D) { if (maquetteMode !== "plat") onCaptureReady(null); setForce2D(true); } }}>{t("framing.flat")}</button>
        </div>
        {maquetteMode === "plat" && <label className="u-field">{t("framing.zoom")}<input type="range" min="50" max="300" disabled={maquette.lockCam} aria-describedby={maquette.lockCam ? "u-flat-zoom-why" : undefined} value={Math.round((maquette.flat?.zoom ?? 1) * 100)} onChange={event => setMaquette(state => ({ ...state, flat: { x: state.flat?.x ?? 0, y: state.flat?.y ?? 0, zoom: Number(event.target.value) / 100 } }))} /></label>}
        {maquetteMode === "plat" && maquette.lockCam && <p id="u-flat-zoom-why" className="u-why">{t("framing.unlock")}</p>}
        <button type="button" className="u-secondary" data-framing-save="" disabled={!canCapture || framingBusy} aria-describedby={!canCapture || framingBusy ? "u-framing-wait" : undefined} onPointerDown={event => { framingTouchHandled.current = false; framingTouch.current = event.pointerType === "touch" ? event.pointerId : null; }}
          onPointerCancel={() => { framingTouch.current = null; framingTouchHandled.current = false; }}
          onPointerUp={event => { if (event.pointerType === "touch" && framingTouch.current === event.pointerId) { framingTouch.current = null; framingTouchHandled.current = true; void keepFraming(); } }}
          onClick={event => { if (event.detail > 0 && framingTouchHandled.current) { framingTouchHandled.current = false; return; } framingTouchHandled.current = false; void keepFraming(); }}>{t(framingBusy ? "framing.saving" : "framing.save")}</button>
        {!input.framing && engine === "h3" && !prefs.engineManual && <p className="u-why" data-framing-engine-warn="">{t("framing.willSwitch", { before: engineCredits.h3 === null ? "—" : formatCredits(engineCredits.h3), after: framedLtx === null ? "—" : formatCredits(framedLtx) })}</p>}
        {(!canCapture || framingBusy) && <p id="u-framing-wait" className="u-why">{t(framingBusy ? "framing.saving" : "framing.loading")}</p>}
        {input.framing && <div data-framing-kept={input.framing.source}>
          <p>{t("framing.kept")} · {input.framing.width} × {input.framing.height}</p>
          <div className="u-framing-maps">{(["color", "depth", "edges"] as const).map(key => <a key={key} href={media[input.framing![key]]} download={`${draft.id}-${key}.png`}><img src={media[input.framing![key]]} alt={t(`framing.${key}`)} /><span>{t(`framing.${key}`)}</span></a>)}</div>
          <p className="u-why">{t(input.framing.source === "2d" ? "framing.flatDepth" : "framing.nativeDepth")}</p>
          <p className="u-why">{t("framing.pipeline")}</p>
          <button type="button" className="u-chip" data-framing-clear="" onClick={() => patch({ framing: undefined })}>{t("framing.clear")}</button>
        </div>}
      </div>
      <div className="u-maquette-tools">
        <button type="button" className="u-lock" aria-pressed={maquette.lockPose} onClick={() => setMaquette(state => toggleLock(state, "pose"))}>{maquette.lockPose ? "🔒" : "🔓"} {t("r7.pose")}</button>
        <button type="button" className="u-lock" aria-pressed={maquette.lockCam} onClick={() => setMaquette(state => toggleLock(state, "cam"))}>{maquette.lockCam ? "🔒" : "🔓"} {t("r7.cam")}</button>
        <button type="button" data-autre-essai="" onClick={() => setMaquette(state => autreEssai(state))}>🎲 {t("r7.essai")} <small>{t("r7.gratuit")}</small></button>
        <button type="button" disabled={maquette.past.length === 0} aria-describedby={maquette.past.length === 0 ? "u-why-annuler" : undefined} onClick={() => setMaquette(state => undoMaquette(state))}>{t("r7.annuler")}</button>
        <button type="button" data-add-person="" disabled={!canAddFigure(maquette)} aria-describedby={!canAddFigure(maquette) ? "u-why-cap" : undefined} onClick={() => setPicker(open => !open)}>{t("r7.add")}</button>
        <button type="button" data-still-shot="" className="u-secondary" onClick={() => void monter()}>{t("r7.stillShot")}</button>
      </div>
      <label className="u-maquette-distance" data-maquette-distance="">
        <span className="u-label">{t("r7.distance")}</span>
        <input type="range" min={25} max={140} step={1} value={Math.round(maquette.orbit.radius * 10)} aria-valuetext={t(`r7.cadrage.${cadrageFromOrbit(maquette.orbit, maquette.figures)}`)} disabled={maquette.lockCam} onChange={event => {
          const radius = Number(event.target.value) / 10;
          setMaquette(state => state.lockCam ? state : { ...state, orbit: { ...state.orbit, radius } });
        }} />
        <small>{t(`r7.cadrage.${cadrageFromOrbit(maquette.orbit, maquette.figures)}`)}</small>
      </label>
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
          <button type="button" className="u-chip u-figure-action" data-tourner={figure.id} disabled={maquette.lockPose} aria-describedby={maquette.lockPose ? "u-why-pose" : undefined} aria-label={t("r7.turnName", { name: figure.name })} onClick={() => setMaquette(state => yawFigure(state, figure.id, Math.PI / 4))}>{t("r7.turn")}</button>
          <button type="button" className="u-chip u-figure-action" data-retirer={figure.id} disabled={maquette.lockPose} aria-describedby={maquette.lockPose ? "u-why-pose" : undefined} aria-label={t("r7.removeName", { name: figure.name })} onClick={() => placeFigure(removeFigure(maquette, figure.id))}>{t("r7.remove")}</button>
        </li>)}
      </ul>
      {maquette.lockPose && <p className="u-why" id="u-why-pose">{t("r7.poseLock")}</p>}
      <p className="u-why" data-astuce={tip.id}>{t(`r7.astuce.${tip.id}`, { name: tip.name })}</p>
        </div>
      <Row className="u-tuiles-row" label={t("r7.tuiles")}>
        <div className="u-tuiles" data-tuiles="">
          {TUILES.map(item => {
            const needsPair = tuileNeedsPair(item.id) && maquette.figures.length < 2;
            const hint = needsPair
              ? t("r7.pairTile")
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
        </AvanceGroup>
        <AvanceGroup id="rendu" title={t("p0.groups.rendu")}>
        <Row label={t("p0.duration")}>
          <div className="u-choice-row u-duree">
            {([5, ...(input.duree === 8 ? [8 as const] : []), 10] as const).map(seconds => (
              <button key={seconds} type="button" className="u-chip" aria-pressed={input.duree === seconds} onClick={() => patch({ duree: seconds })}>{seconds} s</button>
            ))}
          </div>
        </Row>
        </AvanceGroup>

        <details className="u-fold">
          <summary>{t("p0.speech")} · {t(`p0.paroles.${input.paroles}`)}</summary>
          <div className="u-choice-row">
            {(["aucune", "replique", "voix-off"] as const).map(mode => (
              <button key={mode} type="button" className="u-chip" aria-pressed={input.paroles === mode} onClick={() => patch({ paroles: mode })}>
                {t(`p0.paroles.${mode}`)}
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
              <span className="u-label">{t("p0.line")}</span>
              <textarea value={input.replique} rows={1} maxLength={ACTION_MAX} onChange={event => patch({ replique: event.target.value })} />
            </label>
          </>}
        </details>

        <details className="u-fold">
          <summary>{t("p0.chain")} · {t(input.enchainer ? "p0.yes" : "p0.no")}</summary>
          <button type="button" className="u-chip" aria-pressed={input.enchainer} onClick={() => patch({ enchainer: !input.enchainer })}>{t("p0.chainStart")}</button>
          {!input.previousKept && input.enchainer && <p className="u-why">{t("p0.chainNotKept")}</p>}
          <button type="button" className="u-chip" aria-pressed={input.imageFin} onClick={() => patch({ imageFin: !input.imageFin })}>{t("p0.chainEnd")}</button>
        </details>
        <AvanceGroup id="previs" title={t("p0.groups.previs")} onOpen={seeMaquette}>
        {maquetteSeen && <PrevisPanel state={maquette} setState={setMaquette} cast={people.map(person => ({ id: person.id, name: person.name }))} neutralName={t("r7.neutralName")} recording={previsLeft} onRecord={() => void filmPrevis()} />}
        <VideoGestes aspect={format === "9:16" ? "vertical" : "horizontal"} previs={previsClip} previsLeft={previsLeft} onRecordPrevis={() => void filmPrevis()} only={["prise-previs", "prise-camera"]} />
        </AvanceGroup>
        {!demo && memory && <MemoirePanel memory={memory} planId={draft.id} t={t} />}
      </details>
    </div>

    <aside className="u-prise-dock" aria-label={t("p0.fiab.title")}>
      <div className="u-prise-card" id="u-prise-card" data-row={showFinal ? "final" : cardDecision.row}>
        <p className="u-prise-brief" data-lire-maquette="">
          <span>{t("r7.lireCast")} : {maquette.figures.map(figure => figure.name).join(", ") || "—"}</span>
          <span>{t("r7.lireLieu")} : {shownPlace?.name || "—"}{quartier ? ` · ${t("r7.rue")}` : ""}</span>
          <span>{t("r7.lireCadrage")} : {input.manualFraming ? t(`p0.editor.framings.${input.cadrage}`) : t(`r7.tuile.${maquette.tuile}`)}</span>
        </p>
        <FiabiliteCard
          states={states}
          estimate={estimate}
          estimateClass="u-prise-quote"
          failure={failure || undefined}
          where={where || undefined}
          sent={resumeFor(input)}
          technical={[
            { label: t("p0.fiab.sentEngine"), value: `${t(engine === "h3" ? "stage.engine.h3" : "stage.engine.ltx")} · ${input.duree} s · ${input.format}` },
            { label: t("p1.fiab.resolution"), value: `≈ ${intention.decided.resolution}` },
            { label: t("p1.fiab.refs"), value: intention.decided.refs.map(ref => `${ref.owner} (${ref.kind})`).join(", ") || "—" },
            { label: t("p1.fiab.identity"), value: t(`p1.fiab.identity${intention.decided.identity}`) },
            { label: t("p0.fiab.sentRaw"), value: prompt.text },
          ]}
          change={changeFor(input)}
        >
          {failedHere && <div className="u-card-actions">
            <button type="button" className="u-secondary" data-recuperer="" onClick={resumeRun}>{t("p0.recover")}</button>
            <button type="button" className="u-secondary" data-relancer="" disabled={!canGenerate} aria-describedby={!canGenerate ? "u-why-relancer" : undefined} onClick={() => void generate()}>{t("p0.relaunch")}</button>
          </div>}
          {failedHere && !canGenerate && <p className="u-why" id="u-why-relancer">{generateReason}</p>}
        </FiabiliteCard>
      </div>

      {showNext && <label className="u-next-plan" data-plan-suivant="">
        <span className="u-label">{t("p0.nextLabel", { n: String(nextNumber) })}</span>
        <textarea aria-label={t("p0.nextAria")} value={nextAction} rows={2} maxLength={ACTION_MAX} placeholder={t("p0.nextPh")} onChange={event => setNextAction(event.target.value)} />
      </label>}

      {engine === "ltx" && (gold.mark === "tourner" || gold.mark === "suivant") && <fieldset className="u-rendu" data-rendu={rendu}>
        <legend className="u-label">{t("p0.rendu.label")}</legend>
        {(["apercu", "finale"] as const).map(item => <label key={item} className="u-rendu-opt" data-rendu-opt={item}>
          <input type="radio" name="u-rendu" value={item} checked={rendu === item} disabled={busy} onChange={() => chooseRendu(item)} />
          <span className="u-rendu-text"><b>{t(`p0.rendu.${item}`)}</b><small>{t(`p0.rendu.${item}Body`)}</small></span>
          <span className="u-rendu-quote">{creditsWord(renduQuotes[item])}</span>
        </label>)}
        <p className="u-small u-rendu-hint">{t(rendu === "apercu" ? "p0.rendu.apercuHint" : "p0.rendu.keep")}</p>
      </fieldset>}
      <div className="u-prise-actions" data-action={gold.mark}>
        {notice && !sheet && <p className="u-inline-status" role="status" data-statut-inline="" onClick={() => setNotice("")}>{say(notice)}</p>}
        {reasonText && <p className="u-why" id="u-prise-reason">{reasonText}</p>}
        {/* Phone: the card is out of view, so the single estimate rides with the action (CSS shows one of the two). */}
        {(gold.mark === "tourner" || gold.mark === "suivant") && <p className="u-prise-quote u-bar-quote">{estimate}</p>}
        <button type="button" className="u-primary" data-tourner-gold={gold.mark} data-envoyer-montage={gold.mark === "monter" ? "" : undefined} data-lire-sequence={gold.mark === "monter" ? "" : undefined} disabled={!gold.enabled && (connected || demo || gold.mark === "attente" || gold.mark === "monter")} aria-describedby={reasonText ? "u-prise-reason" : undefined} onClick={() => { if (!connected && !demo && gold.mark !== "attente" && gold.mark !== "monter") { setSheet("connect"); return; } gold.onClick(); }}>{gold.label}</button>
        {second && <button type="button" className="u-secondary" data-envoyer-montage={second.mark === "monter" ? "" : undefined} data-lire-sequence={second.mark === "monter" ? "" : undefined} disabled={!second.enabled} aria-describedby={!second.enabled ? "u-prise-second" : undefined} onClick={second.onClick}>{second.label}</button>}
        {second && !second.enabled && <p className="u-why" id="u-prise-second">{sending ? t("nav.opening") : second.reason}</p>}
      </div>
    </aside>
    </div>

    <div className="u-prise-step-nav" data-prise-step-nav="">
      {etapePrev && <button type="button" className="u-secondary" data-prise-step-prev={etapePrev} onClick={() => goEtape(etapePrev)}>← {t("p0.etapes.prev", { step: t(`p0.etapes.${etapePrev}`) })}</button>}
      {etapeNext && <button type="button" className="u-secondary" data-prise-step-next={etapeNext} onClick={() => goEtape(etapeNext)}>{t("p0.etapes.next", { step: t(`p0.etapes.${etapeNext}`) })} →</button>}
    </div>
  </section>;
}

function blank(id: string, name: string, format: PlanInput["format"]): Draft {
  return { id, name, input: emptyPlan(format), kept: false, finalised: false, hasTake: false, before: "", after: "", garde: "" };
}

/** `action` is the example line in the visitor's language (« se retourne », « turns around »…). */
function demoDraft(seed: "compose" | "final", format: PlanInput["format"], action: string): Draft {
  const input = emptyPlan(format);
  input.castIds = ["demo-coursiere", "demo-vieil-homme"];
  input.decorId = "demo-quai";
  input.cadrage = "moyen";
  input.camera = "travelling-avant";
  input.action = action;
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
      garde: "",
    };
  }
  return { id: "plan-03", name: "Plan 03", input, kept: false, finalised: false, hasTake: false, before: "", after: "", garde: "" };
}

function draftFromShot(shot: Shot, format: PlanInput["format"]): Draft {
  const input = planFromJson(shot.composeur, emptyPlan(format));
  const state = planStateFromJson(shot.composeur);
  return {
    id: shot.id,
    name: shot.name || shot.id,
    input,
    kept: state.etat === "gardee" || state.etat === "finalisee" || Boolean(state.garde),
    finalised: state.etat === "finalisee",
    takeIds: shot.takeIds,
    hasTake: state.etat === "prise" || state.etat === "gardee" || state.etat === "finalisee" || shot.takeIds.length > 0,
    before: state.before,
    after: state.after,
    garde: state.garde,
  };
}

function Row({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={className ? `u-prise-row ${className}` : "u-prise-row"}>
    <p className="u-label">{label}</p>
    {children}
  </div>;
}

function Compare({ before, after, ratio }: { before: string; after: string; ratio: string }) {
  const { t } = useI18n();
  const [pos, setPos] = useState(58);
  return <div className="u-compare">
    <p className="u-compare-legend"><span>{t("p0.before")}</span><span>{t("p0.after")}</span></p>
    <div className="u-prise-frame" data-ratio={ratio}>
      <img src={after} alt={t("p0.after")} />
      <img className="u-compare-soft" src={before} alt={t("p0.before")} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
    </div>
    <input type="range" min={0} max={100} value={pos} aria-label={t("p0.compare")} onChange={event => setPos(Number(event.target.value))} />
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



type T = (key: string, values?: Record<string, string | number>) => string;

/** Understood items, as editable chips: Qui, Où, Caméra, Ambiance, Durée, then unknown words. And the studio assistant's line. */
function IntentionChips(props: {
  names: string[]; place: string;
  camera: { value: string; label: string; autoLabel: string };
  moves: { move: CameraMove; label: string }[];
  ambiance: string[]; duree: 5 | 8 | 10; unknown: string[]; line: string[]; flags: string[]; t: T;
  onWho(): void; onWhere(): void; onCamera(value: string): void; onDropAmbiance(): void; onDuree(seconds: 5 | 8 | 10): void; onUnknown(): void;
}) {
  const { t } = props;
  return <div className="u-intent" data-intention="">
    <p className="u-label u-intent-head">{t("p1.chips")}</p>
    <div className="u-intent-chips">
      <button type="button" className={props.names.length ? "u-ichip" : "u-ichip is-empty"} data-chip="qui" onClick={props.onWho}><small>{t("p1.chip.who")}</small><b>{props.names.join(", ") || t("p1.chip.none")}</b></button>
      <button type="button" className={props.place ? "u-ichip" : "u-ichip is-empty"} data-chip="ou" onClick={props.onWhere}><small>{t("p1.chip.where")}</small><b>{props.place || t("p1.chip.none")}</b></button>
      <label className="u-ichip u-ichip-select" data-chip="camera"><small>{t("p1.chip.camera")}</small><b aria-hidden="true">{props.camera.label}</b>
        <select aria-label={t("p1.chip.camera")} value={props.camera.value} onChange={event => props.onCamera(event.target.value)}>
          <option value="auto">{props.camera.autoLabel}</option>
          {props.moves.map(item => <option key={item.move} value={item.move}>{item.label}</option>)}
          <option value="none">{t("p1.chip.cameraFree")}</option>
        </select>
      </label>
      {props.ambiance.length
        ? <button type="button" className="u-ichip" data-chip="ambiance" aria-label={t("p1.chip.drop", { label: props.ambiance.join(", ") })} onClick={props.onDropAmbiance}><small>{t("p1.chip.ambiance")}</small><b>{props.ambiance.join(", ")} <span aria-hidden="true">×</span></b></button>
        : <span className="u-ichip is-empty" data-chip="ambiance"><small>{t("p1.chip.ambiance")}</small><b>{t("p1.chip.none")}</b></span>}
      <label className="u-ichip u-ichip-select" data-chip="duree"><small>{t("p1.chip.duration")}</small><b aria-hidden="true">{t("p1.chip.sec", { n: props.duree })}</b>
        <select aria-label={t("p1.chip.duration")} value={props.duree} onChange={event => props.onDuree(event.target.value === "10" ? 10 : event.target.value === "8" ? 8 : 5)}>
          <option value="5">{t("p1.chip.sec", { n: 5 })}</option>
          {props.duree === 8 && <option value="8">{t("p1.chip.sec", { n: 8 })}</option>}
          <option value="10">{t("p1.chip.sec", { n: 10 })}</option>
        </select>
      </label>
      {props.unknown.map(word => <button key={word} type="button" className="u-ichip is-unknown" data-chip="inconnu" aria-label={t("p1.chip.unknownGo", { word })} onClick={props.onUnknown}><small>{t("p1.chip.unknown")}</small><b>{word}</b></button>)}
    </div>
    {(props.line.length > 0 || props.flags.length > 0) && <div className="u-uttu" data-uttu-dit="">
      <div>
        <p className="u-uttu-who"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>{t("p1.uttu")}</p>
        {props.line.length > 0 && <p className="u-uttu-line">{props.line.join(" ")}</p>}
        {props.flags.map(flag => <p key={flag} className="u-uttu-flag">{flag}</p>)}
      </div>
    </div>}
  </div>;
}

/** Avancé › Mémoire de production: canon, characters and their dated states, places, sequences A–F. */
function MemoirePanel({ memory, planId, t }: { memory: ProductionMemory; planId: string; t: T }) {
  return <details className="u-fold u-memoire" data-memoire="">
    <summary>{t("p1.mem.title")}</summary>
    {(memory.canon.name || memory.canon.text) && <section><p className="u-label">{t("p1.mem.canon")}</p><p className="u-memoire-text"><b>{memory.canon.name}</b> {memory.canon.text}</p></section>}
    <section><p className="u-label">{t("p1.mem.characters")}</p>
      <ul className="u-memoire-list">{memory.characters.map(item => {
        const states = memory.states.filter(state => state.characterId === item.id);
        return <li key={item.id} data-memoire-perso={item.name}>
          <b>{item.name}</b>{item.aliases.length ? <small> · {item.aliases.join(", ")}</small> : null}
          {item.identity ? <span>{item.identity}</span> : !item.refs.length && !item.castId ? <span className="u-memoire-empty">{t("p1.mem.empty")}</span> : null}
          <small>{t("p1.mem.states")} : {states.map(state => `${state.fromCode || "?"} ${state.label}`).join(" · ") || t("p1.mem.noState")}</small>
        </li>;
      })}</ul>
    </section>
    <section><p className="u-label">{t("p1.mem.places")}</p>
      <ul className="u-memoire-list">{memory.environments.map(item => <li key={item.id}><b>{item.name}</b>{!item.refs.length && !item.decorId && <span className="u-memoire-empty">{t("p1.mem.empty")}</span>}</li>)}</ul>
    </section>
    <section><p className="u-label">{t("p1.mem.sequences")}</p>
      <ul className="u-memoire-seq">{memory.sequences.map(sequence => <li key={sequence.code} aria-current={sequence.shots.some(shot => shot.planId === planId) ? "true" : undefined}><b>{sequence.code}</b> {t("p1.mem.shots", { count: sequence.shots.length })}</li>)}</ul>
    </section>
    <p className="u-memoire-note">{t("p1.mem.saved")}</p>
  </details>;
}

// One AVANCÉ group: a real button (aria-expanded) instead of a nested <summary>, which Safari did not toggle on tap.
// The content stays mounted while closed so the maquette, the engine choice and the prévis keep their state.
// `onOpen` lets a heavy child (the three.js maquette) mount on the first opening only.
function AvanceGroup({ id, title, children, ask = 0, onOpen }: { id: string; title: string; children: ReactNode; ask?: number; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (open) onOpen?.(); }, [open, onOpen]);
  const bodyId = `u-avance-${id}`;
  const groupRef = useRef<HTMLElement>(null);
  // A link asked for this group: open it and bring it into view.
  useEffect(() => {
    if (!ask) return;
    setOpen(true);
    requestAnimationFrame(() => groupRef.current?.scrollIntoView({ block: "start" }));
  }, [ask]);
  return <section ref={groupRef} className="u-fold u-avance-group" data-avance-group={id} data-open={open ? "" : undefined}>
    <button type="button" className="u-fold-head" data-avance-toggle={id} aria-expanded={open} aria-controls={bodyId} onClick={event => { setOpen(current => !current); event.currentTarget.scrollIntoView({ block: "nearest" }); }}>{title}</button>
    <div id={bodyId} className="u-avance-body" hidden={!open}>{children}</div>
  </section>;
}

function decodeDraft(value: unknown): Draft | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Draft;
  if (typeof item.id !== "string" || !/^[a-z0-9-]{1,80}$/i.test(item.id) || typeof item.name !== "string" || !item.input || !Array.isArray(item.input.castIds)) return null;
  const input = planFromJson(JSON.stringify({ ...item.input, qui: item.input.castIds, ou: item.input.decorId }), emptyPlan());
  return {
    ...blank(item.id, item.name.slice(0, 80), input.format), input,
    kept: item.kept === true, finalised: item.finalised === true, hasTake: item.hasTake === true,
    garde: typeof item.garde === "string" ? item.garde : "",
    before: typeof item.before === "string" && !item.before.startsWith("blob:") ? item.before : "",
    after: typeof item.after === "string" && !item.after.startsWith("blob:") ? item.after : "",
    takeIds: Array.isArray(item.takeIds) ? item.takeIds.filter(id => typeof id === "string") : [],
    ...(typeof item.maquetteSeed === "string" && readMaquette(item.maquetteSeed) ? { maquetteSeed: item.maquetteSeed } : {}),
    render: item.render && ["queued", "running", "error", "done"].includes(item.render.phase) ? { phase: item.render.phase, message: String(item.render.message ?? "").slice(0, 2000), ...(typeof item.render.jobId === "string" ? { jobId: item.render.jobId } : {}) } : undefined,
  };
}
