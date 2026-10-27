"use client";

import { useAgentDraft } from "./use-agent-draft";
import { PRISE_HANDOFF_KEY, isPriseHandoff, takeHandoff, type PriseHandoff } from "@/lib/barre/model";
import { OutilsStrip } from "./outils-hub";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { framePoster } from "@/lib/montage/poster";
import { maquetteJson, readMaquette } from "@/lib/maquette/persistence";
import { assetPath } from "@/lib/site";
import { DEMO_CAST, DEMO_DECOR } from "@/lib/creation/demo";
import { TUILES, tuileById, tuileInText, tuileNeedsPair, type TuileId } from "@/lib/cinema/tuiles";
import {
  addFigure, addNeutral, applyTuile, astuce, autreEssai, canAddFigure, captureLine, initialMaquette, MAX_FIGURES, moveFigure, orbitDrag, pinch, removeFigure, scenePhrase, seedLead, toggleLock, undoMaquette, yawFigure,
  type MaquetteState,
} from "@/lib/maquette/state";
import { ACTION_EXAMPLES, ACTION_MAX, type PlanEtat } from "@/lib/prise/copy";
import { cameraChoice } from "@/lib/prise/camera-words";
import { mergeTakeIds, planVersions, sequenceTakes, shownTake, takeIdsFromShotNote } from "@/lib/prise/versions";
import { protocole } from "@/lib/fiabilite";
import { resolveTakeQuote } from "@/lib/render/billed-quote";
import { quotesToRecords } from "@/lib/render/measured-quote";
import { takeProfile, type TakeRendu, type TakeSettings } from "@/lib/render/take-graph";
import { quoteCredits, readRendu, saveRendu } from "@/lib/prise/rendu";
import { formatCredits } from "@/lib/credits";
import { FiabiliteCard, type SentLine } from "./fiabilite-card";
import { quoteWords } from "./studio-frames";
import { decide, emptyPlan, primaryIntent, type PlanInput } from "@/lib/prise/decision";
import { chooseFinaliser, finaliserDefaults, type FinaliserInput, type FinalMedia } from "@/lib/prise/finaliser";
import { buildPrompt } from "@/lib/prise/prompt";
import { parseQuartier, type Quartier } from "@/lib/repere/quartier";
import { moveId, planFromJson, planJson, planMarkdown, planStateFromJson, type StoredPlan } from "@/lib/prise/vault";
import type { Shot } from "@/lib/coffre/model";
import { useI18n } from "@/components/i18n/provider";
import { ComfyProgress, useComfyElapsed, typicalFor } from "./comfy-progress";
import { montrerDepart } from "@/lib/creation/depart";
import { ExempleDepart } from "./exemple-depart";
import { FormatSwitch, useFormat } from "./format-switch";
import { MaquetteView } from "./maquette-view";
import { useStudio } from "./studio-session";
import { ToolStage } from "./tool-shell";
import { EtEnsuite } from "./et-ensuite";
import { VideoGestes, type PrevisClip } from "./video-gestes";
import { PrevisPanel } from "./previs-panel";
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
  const { ready, demo, notice, setNotice, resumeRun, creating, cast, decor, media, studio, pickedDecor, requestRun, writeProjectFile, readProjectFile, savePrevis, pickCast, pickDecor, run, cancelRun, sendSequence, prefs, setPrefs, pendingTake, sheet, connected, setSheet } = useStudio();
  const { t, say } = useI18n();
  const [viewed, setViewed] = useState<Record<string, string>>({});
  const [nextAction, setNextAction] = useState("");
  const [advanced, setAdvanced] = useState(false);
  // « Maquette 3D et cadrage » (the 3D row of Outils) lands on #prise/maquette: unfold AVANCÉ and the maquette.
  const [maquetteAsk, setMaquetteAsk] = useState(0);
  useEffect(() => {
    const apply = () => {
      if (!/^#prise\/maquette\b/.test(window.location.hash)) return;
      setAdvanced(true);
      setMaquetteAsk(value => value + 1);
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
  const [drafts, setDrafts] = useState<Draft[]>(() => [blank("plan-01", "Plan 1", "16:9")]);
  const [currentId, setCurrentId] = useState("plan-01");
  const [dragId, setDragId] = useState<string | null>(null);
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
  const [playFrom, setPlayFrom] = useState<number | null>(null);
  const [previsLeft, setPrevisLeft] = useState(0);
  const [previsClip, setPrevisClip] = useState<PrevisClip | null>(null);
  const filming = useRef(false);
  useAgentDraft(op => op.id === "local:take", (draft) => {
    setDrafts(list => list.map(item => item.id === currentId ? { ...item, input: { ...item.input, action: draft.prompt.slice(0, 240) } } : item));
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
      const next = demoDraft(asked, format, t("p0.action.1"));
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
    if (stored.length === 0) { setDrafts([blank("plan-01", "Plan 1", format)]); setCurrentId("plan-01"); return; }
    const next = stored
      .slice()
      .sort((a, b) => a.ordre - b.ordre)
      .map(shot => draftFromShot(shot, format));
    setDrafts(next);
    setCurrentId(next.find(item => item.id === targetPlan)?.id ?? next[0]?.id ?? "plan-01");
  }, [ready, format, studio.project, studio.shots, t]);

  // The creation bar (mode Vidéo) hands over a sentence, the chosen references and the settings, once.
  const [barre, setBarre] = useState<PriseHandoff | null>(null);
  useEffect(() => {
    if (!ready) return;
    const handed = takeHandoff(window.sessionStorage, PRISE_HANDOFF_KEY, isPriseHandoff);
    if (handed) setBarre(handed);
  }, [ready]);
  useEffect(() => {
    if (!barre || booted.current !== (studio.project ?? "")) return;
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
  }, [barre, currentId, studio.project]);

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
  // Every take of the plan is a version. The newest is shown when it lands; « Garder » marks the one for the cut.
  const versions = planVersions(takeIds, studio.takes);
  const requestedTake = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("take");
  const landed = shownTake(versions, viewed[draft?.id ?? ""] ?? requestedTake);
  useEffect(() => {
    setDrafts(list => list.map(item => {
      const ids = studio.shots.find(shot => shot.id === item.id)?.takeIds ?? [];
      const hasTake = studio.takes.some(take => ids.includes(take.id));
      return hasTake === item.hasTake ? item : { ...item, hasTake };
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
    cadrage: resolved.cadrage?.value ?? tuileById(maquette.tuile).cadrage,
    camera: tuileById(maquette.tuile).camera,
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
    const pick = cameraPick[planId];
    const lines = ambianceOff[planId] ? decided.promptLines.filter(line => !line.startsWith("[ambiance]")) : decided.promptLines;
    return { read, inherited, decided, extra: { lines, camera: pick === undefined ? undefined : pick === "none" ? null : pick } };
  }
  const intention = intentionFor(draft.input.action, draft.id, input);
  const engine = intention.decided.engine;
  const intent = primaryIntent(input);
  const cardDecision = decide(input, intent);
  const essai = decide(input, "essai");
  const fin = chooseFinaliser({ ...finaliser, media: mediaKind, seconds: input.duree });
  const showFinal = draft.finalised;
  const cadre = [captureLine(maquette, tuileById(maquette.tuile).prompt), quartier ? t("r7.rue") : ""].filter(Boolean).join(" ");
  const prompt = buildPrompt(input, showFinal ? { graph: fin.graph, son: false } : cardDecision, { cadre, ...intention.extra });
  const tip = astuce(maquette);
  const tileLabels = TUILES.map(item => ({ id: item.id, label: t(`r7.tuile.${item.id}`) }));
  const knownLabels = [...tileLabels, ...TUILES.map(item => ({ id: item.id, label: item.label }))];
  // One quote per take, from the plan's own engine, format and length. LTX is estimated in 16:9 and 9:16.
  // Aperçu (first pass only) or Qualité finale (today's two passes). LTX only; each keeps its own profile.
  const baseSettings: TakeSettings = { seconds: input.duree, aspect: input.format === "9:16" ? "vertical" : "horizontal", quality: "rapide", engine };
  const planSettings: TakeSettings = engine === "ltx" && rendu === "apercu" ? { ...baseSettings, rendu: "apercu" } : baseSettings;
  const planQuote = resolveTakeQuote(takeProfile(planSettings), quotesToRecords(studio.quotes));
  const renduQuotes = {
    apercu: quoteCredits(resolveTakeQuote(takeProfile({ ...baseSettings, engine: "ltx", rendu: "apercu" }), quotesToRecords(studio.quotes))),
    finale: quoteCredits(resolveTakeQuote(takeProfile({ ...baseSettings, engine: "ltx" }), quotesToRecords(studio.quotes))),
  };
  const planCredits = quoteCredits(planQuote);
  const creditsWord = (value: number | null) => value === null ? "" : t("p0.rendu.quote", { credits: formatCredits(value) });
  const quoted = planQuote.source !== "unmeasured";
  const realRefs = input.castIds.length <= 3 && input.castIds.every(id => cast.some(card => card.id === id && !id.startsWith("demo-")));
  const savedDecor = !input.decorId || studio.scenes.some(scene => scene.id === input.decorId);
  const runPlan = pendingTake?.planId ?? null;
  const busy = run.phase === "running";
  const priseElapsed = useComfyElapsed(busy);
  const runningHere = busy && (!runPlan || runPlan === draft.id);
  const failedHere = run.phase === "error" && (!runPlan || runPlan === draft.id);
  const canGenerate = !demo && !creating && !busy && quoted && realRefs && savedDecor && Boolean(input.castIds.length || shownPlace?.src);
  const generateReason = demo ? t("p0.why.demo")
    : busy ? t("p0.why.busy")
    : !quoted ? t(engine === "h3" ? "p0.why.h3Format" : "p0.why.noQuote")
    : !realRefs ? t("p0.why.refs")
    : !savedDecor ? t("p0.why.decorExample")
    : t("p0.why.nothing");

  function cameraLine(plan: PlanInput): SentLine {
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
    rows.push({ label: t("p1.fiab.engine"), value: t(prefs.engineManual ? "p1.fiab.engineHand" : "p1.fiab.engineAuto", { engine: t(decided.engine === "h3" ? "stage.engine.h3" : "stage.engine.ltx") }) });
    if (read.unknown.length) rows.push({ label: t("p1.chip.unknown"), value: read.unknown.join(", "), flag: true });
    return rows;
  }
  function changeFor(plan: PlanInput, planId = draft.id): string {
    const { decided } = intentionFor(plan.action, planId, plan);
    return [t("p0.fiab.changePrise"), ...decided.warnings.map(sayIt)].join(" ");
  }

  async function generate() {
    if (!canGenerate) return;
    try {
      await persist(drafts.map(item => item.id === draft.id ? { ...item, input } : item));
      await requestRun({ planId: draft.id, castIds: input.castIds, decorId: input.decorId, line: input.action, prompt: buildPrompt(input, essai, { cadre, ...intention.extra }).text, settings: planSettings, resume: resumeFor(input), change: changeFor(input), extraRefs: intention.decided.refs.filter(ref => ref.kind === "etat").map(ref => ref.path) });
    } catch (error) { setNotice(error instanceof Error ? error.message : t("p0.saveFailed")); }
  }

  // « Tourner le plan suivant »: one tap creates the next plan with the same cast, décor and staging, then asks once.
  const isLast = index === drafts.length - 1;
  const showNext = !demo && isLast && (versions.length > 0 || runningHere) && drafts.length < 12;
  const nextNumber = drafts.length + 1;
  const canNext = canGenerate && nextAction.trim().length > 0;
  async function tournerSuivant() {
    if (!canNext) return;
    let n = nextNumber;
    while (drafts.some(item => item.id === `plan-${String(n).padStart(2, "0")}`)) n += 1;
    const id = `plan-${String(n).padStart(2, "0")}`;
    const nextInput: PlanInput = { ...input, action: nextAction.trim().slice(0, ACTION_MAX), imageCle: "aucune", enchainer: false, imageFin: false, hasKeptTake: false, previousKept: Boolean(draft.kept) };
    const item: Draft = { ...blank(id, `Plan ${n}`, format), input: nextInput };
    const next = [...drafts, item];
    try {
      await writeProjectFile(`.uttu/maquette-${id}.json`, maquetteJson(maquette));
      setDrafts(next);
      setCurrentId(id);
      setNextAction("");
      await persist(next, id);
      const nextIntention = intentionFor(nextInput.action, id, nextInput);
      const nextSettings: TakeSettings = { ...planSettings, engine: nextIntention.decided.engine };
      await requestRun({ planId: id, castIds: nextInput.castIds, decorId: nextInput.decorId, line: nextInput.action, prompt: buildPrompt(nextInput, decide(nextInput, "essai"), { cadre, ...nextIntention.extra }).text, settings: nextSettings, resume: resumeFor(nextInput, id), change: changeFor(nextInput, id), extraRefs: nextIntention.decided.refs.filter(ref => ref.kind === "etat").map(ref => ref.path) });
    } catch (error) { setNotice(error instanceof Error ? error.message : t("p0.saveFailed")); }
  }

  function planWord(item: Draft): string {
    const mark = etatOf(item);
    if (mark !== "vide") return t(`p0.etat.${mark}`);
    const live = item.id === draft.id;
    const filled = Boolean(item.input.action.trim() || item.input.castIds.length > 0 || item.input.decorId)
      || (live && (maquette.figures.length > 0 || Boolean(shownPlace)));
    return filled ? t("r7.enPlace") : t("p0.etat.vide");
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
      takeIds: mergeTakeIds(studio.shots.find(item => item.id === shot.id)?.takeIds ?? [], onDisk),
      garde: shot.garde,
      imageCle: shot.before,
      imageFin: "",
      finalVideo: shot.finalised ? shot.after : "",
    };
    await writeProjectFile(`Shots/${shot.id}.md`, planMarkdown(record));
  }

  function addPlan() {
    const n = drafts.length + 1;
    const id = `plan-${String(n).padStart(2, "0")}`;
    const next = [...drafts, blank(id, `Plan ${n}`, format)];
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
  const sequence = sequenceTakes(drafts.map(item => ({ id: item.id, garde: item.garde })), studio.shots, studio.takes);
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
  async function monter() {
    if (!canMonter) return;
    setSending(true);
    try {
      const live = drafts.map(item => item.id === draft.id ? { ...item, input } : item);
      await persist(live);
      await sendSequence(live.map((item, at) => {
        const entry = sequence[at];
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

  function keep(takeId: string) {
    const next = drafts.map(item => item.id === draft.id ? { ...item, kept: true, garde: takeId } : item);
    setDrafts(next);
    void persist(next).catch(error => setNotice(error.message));
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
  const failure = failedHere && run.phase === "error" ? say(run.message) : "";

  type Action = { label: string; enabled: boolean; reason: string; onClick(): void; mark: string };
  const monterAction: Action = { label: withTake > 0 ? t("p0.monter", { count: withTake }) : t("p0.monterStill"), enabled: canMonter, reason: "", onClick: () => void monter(), mark: "monter" };
  let gold: Action;
  let second: Action | null = null;
  if (demo) { gold = { label: t("p0.tourner"), enabled: false, reason: t("p0.why.demo"), onClick() {}, mark: "tourner" }; second = monterAction; }
  else if (busy) { gold = { label: t("p0.running"), enabled: false, reason: runningHere ? t("p0.runningWhy") : t("p0.why.busy"), onClick() {}, mark: "attente" }; second = withTake > 0 ? monterAction : null; }
  else if (showNext) { gold = { label: planCredits === null ? t("p0.tournerSuivant", { n: String(nextNumber) }) : t("p0.rendu.goNext", { n: String(nextNumber), credits: formatCredits(planCredits) }), enabled: canNext, reason: canNext ? "" : nextAction.trim() ? generateReason : t("p0.why.nextWords", { n: String(nextNumber) }), onClick: () => void tournerSuivant(), mark: "suivant" }; second = withTake > 0 ? monterAction : null; }
  else if (versions.length > 0) gold = monterAction;
  // Default level: no still-image shortcut. MONTAGE gets takes; the example (demo) keeps its still.
  else { gold = { label: planCredits === null ? t("p0.tourner") : t("p0.rendu.go", { credits: formatCredits(planCredits) }), enabled: canGenerate, reason: generateReason, onClick: () => void generate(), mark: "tourner" }; second = withTake > 0 && canMonter ? monterAction : null; }
  const reasonText = gold.enabled ? "" : gold.reason;

  return <section className="u-stage u-prise" data-section="prise" data-prise-shell="" data-prise-ready={ready ? "true" : undefined} data-prise-seed={seed} aria-labelledby="u-title">
    <aside className="u-prise-strip" aria-label={t("p0.plans")}>
      <p className="u-label">{t("p0.plans")}</p>
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
            onDragStart={() => setDragId(item.id)}
            onDragOver={event => event.preventDefault()}
            onDrop={() => dropOn(item.id)}
            onClick={() => { setCurrentId(item.id); setPanel(item.finalised || item.kept); setAsk(null); }}
          >
            <span className="u-plan-num">{String(at + 1)}</span>
            <span className={thumb ? "u-plan-thumb" : "u-plan-thumb is-empty"}>{thumb ? <img src={thumb} alt="" /> : null}</span>
            <span className="u-plan-etat">{word}</span>
            <span className="u-plan-time">{item.input.duree} s</span>
          </button>;
        })}
        <button type="button" className="u-plan-add" onClick={addPlan}>{t("p0.addPlan")}</button>
      </div>
      <p className="u-plan-sum">{t("p0.sequenceSum", { time: clock(total), count: drafts.length })}</p>
    </aside>

    <div className="u-prise-side">
    <div className="u-prise-preview">
      <p className="u-label">{t("p0.preview")}</p>
      {runningHere && <div className="u-card u-run" role="status" data-prise-progress="">
        <ComfyProgress label={t("job.running")} elapsedSec={priseElapsed} typicalSec={typicalFor("prise")} note={t("finaliser.keepOpen")} marker="prise" />
        <button type="button" className="u-link" onClick={cancelRun}>{t("job.stopWaiting")}</button>
      </div>}
      {landed && media[landed.video] && <div className="u-take-view" data-take-view={landed.id} data-versions={versions.length}>
        <p className="u-label">{t("p0.takeOf", { n: versionIndex, total: versions.length })}{draft.garde === landed.id ? ` · ${t("p0.kept")}` : ""}</p>
        <video controls playsInline src={media[landed.video]} />
        {versions.length > 1 && <div className="u-versions" role="group" aria-label={t("p0.versions")}>
          {versions.map((take, at) => <button key={take.id} type="button" data-version={take.id} aria-pressed={take.id === landed.id} onClick={() => setViewed(map => ({ ...map, [draft.id]: take.id }))}>{t("p0.versionN", { n: at + 1 })}{take.id === draft.garde ? " ★" : ""}</button>)}
        </div>}
        <div className="u-card-actions">
          <button type="button" className="u-secondary" data-garder="" aria-pressed={draft.garde === landed.id} onClick={() => keep(landed.id)}>{draft.garde === landed.id ? t("p0.keptBtn") : t("p0.keep")}</button>
          <button type="button" className="u-secondary" data-autre-prise="" disabled={!canGenerate} aria-describedby={!canGenerate ? "u-why-autre" : undefined} onClick={() => void generate()}>{t("p0.another")}</button>
        </div>
        {!canGenerate && <p className="u-why" id="u-why-autre">{generateReason}</p>}
        <EtEnsuite source={{ kind: "video", url: media[landed.video], name: landed.id, path: landed.video, aspect: format === "9:16" ? "vertical" : "horizontal" }} />
      </div>}
      {draft.finalised && draft.before
        ? <Compare before={draft.before} after={draft.after || draft.before} ratio={format} />
        : !landed && <ToolStage
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
            const pick = cameraPick[draft.id];
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
          onCamera={value => setCameraPick(map => {
            const next = { ...map };
            if (value === "auto") delete next[draft.id];
            else next[draft.id] = value as CameraMove | "none";
            return next;
          })}
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


      <OutilsStrip onglet="prise" />
      <details className="u-fold u-avance" data-avance-prise="" open={advanced} onToggle={event => setAdvanced(event.currentTarget.open)}>
        <summary>{t("p0.advanced")}</summary>
        {!demo && withTake === 0 && canMonter && <button type="button" className="u-secondary" data-envoyer-montage="" data-image-fixe="" onClick={() => void monter()}>{t("p0.monterStill")}</button>}
        {/* AVANCÉ is short collapsed groups; the gestures that do not need the maquette live in Outils. */}
        <AvanceGroup id="maquette" title={t("p0.groups.maquette")} ask={maquetteAsk}>
        <div className="u-maquette-avance" data-maquette-avance="">
      <MaquetteView
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
        />
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
        </div>
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
        </AvanceGroup>
        <AvanceGroup id="rendu" title={t("p0.groups.rendu")}>
        <Row label={t("stage.engine.label")}>
          <div className="u-choice-row u-engine" data-engine={engine} data-engine-mode={prefs.engineManual ? "main" : "auto"}>
            <button type="button" className="u-chip" data-engine-auto="" aria-pressed={!prefs.engineManual} onClick={() => setPrefs({ engineManual: false })}>{t("p1.engineAuto")} · {intention.decided.auto === "h3" ? "H3" : "LTX"}</button>
            {(["ltx", "h3"] as const).map(item => (
              <button key={item} type="button" className="u-chip" aria-pressed={prefs.engineManual && prefs.engine === item} onClick={() => setPrefs({ engine: item, engineManual: true })}>{t(`stage.engine.${item}`)}</button>
            ))}
          </div>
          <p className="u-engine-hint">{t(engine === "ltx" ? "stage.engine.ltxHint" : "stage.engine.h3Hint")}</p>
        </Row>

        <Row label={t("p0.duration")}>
          <div className="u-choice-row u-duree">
            {([5, 8] as const).map(seconds => (
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
        <AvanceGroup id="previs" title={t("p0.groups.previs")}>
        <PrevisPanel state={maquette} setState={setMaquette} cast={people.map(person => ({ id: person.id, name: person.name }))} neutralName={t("r7.neutralName")} recording={previsLeft} onRecord={() => void filmPrevis()} />
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
          <span>{t("r7.lireCadrage")} : {t(`r7.tuile.${maquette.tuile}`)}</span>
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
  ambiance: string[]; duree: 5 | 8; unknown: string[]; line: string[]; flags: string[]; t: T;
  onWho(): void; onWhere(): void; onCamera(value: string): void; onDropAmbiance(): void; onDuree(seconds: 5 | 8): void; onUnknown(): void;
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
        <select aria-label={t("p1.chip.duration")} value={props.duree} onChange={event => props.onDuree(event.target.value === "8" ? 8 : 5)}>
          <option value="5">{t("p1.chip.sec", { n: 5 })}</option>
          <option value="8">{t("p1.chip.sec", { n: 8 })}</option>
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
function AvanceGroup({ id, title, children, ask = 0 }: { id: string; title: string; children: ReactNode; ask?: number }) {
  const [open, setOpen] = useState(false);
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
