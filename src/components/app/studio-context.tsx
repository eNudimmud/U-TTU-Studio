"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { costClaim, falGate, runGate, type Balance, type CostClaim, type RunGate, type UsdBalance } from "@/lib/credits";
import { coffreZip } from "@/lib/coffre/export";
import { linkedStore, mirrorAll, pickFolder, type DirectoryHandle } from "@/lib/coffre/link";
import {
  LOOK_PHOTOS_MAX, ROLE_PHOTOS_MAX, SCENE_STILLS_MAX, emptyLook, emptyRole, emptySceneDraft, emptyStudio, extensionFor, isPlaceLora, loadStudio, loraId, removeLora, removeScene, removeTake, sha256Hex, slugify, takeId, uniqueId,
  writeBlob, writeClips, writeLook, writeLora, writeRole, writeScene, writeState, writeTake, type Look, type Lora, type RoleDraft, type Scene, type Studio, type Take,
} from "@/lib/coffre/model";
import { FalError, createFalClient, type FalClient, type FalHandle, type FalPrice } from "@/lib/fal/client";
import { cleanFalKey, readFalKey, saveFalKey } from "@/lib/fal/link";
import { LORA_TAKE, LORA_TRAINER, PLACE_SCENE, PLACE_TRAINER, loraTakeQuote, placeSceneQuote, placeTrainQuote, trainingQuote, type LoraResolution } from "@/lib/fal/prices";
import { reduceConnect } from "@/lib/link-epoch";
import { CLIPS_MAX, clipFormat, clipProblem, datasetCheck, triggerPhrase, type Clip, type DatasetCheck, type TrainingAspect } from "@/lib/lora/dataset";
import {
  readLoraTakeFlight, readLoraUploads, readTrainingFlight, saveLoraTakeFlight, saveLoraUploads, saveTrainingFlight,
  type LoraTakeFlight, type TrainingFlight,
} from "@/lib/lora/flight";
import {
  PLACE_HEIGHT, PLACE_KEEP_SECONDS, PLACE_SHOTS_MIN, PLACE_STEPS, PLACE_UPLOAD_KEEP_SECONDS, PLACE_VIEWS_MAX, PLACE_WIDTH,
  followPlaceScene, followPlaceTraining, placeShotLine, placeShotList, placeTrigger, submitPlaceScene, submitPlaceTraining,
} from "@/lib/lora/place";
import { followLoraTake, loraTakeProfile, submitLoraTake, type LoraTakeEvent } from "@/lib/lora/take";
import { TRAINING_KEEP_SECONDS, TRAINING_RANK, TRAINING_STEPS, followTraining, submitTraining, type TrainingEvent, type TrainingSteps } from "@/lib/lora/train";
import { idbVault, type VaultStore } from "@/lib/coffre/store";
import { readGuide, saveGuide, type GuideMoment, type GuideState } from "@/lib/guide";
import { cleanBlenderKey, readBlenderKey, saveBlenderKey } from "@/lib/render/blender-link";
import { createRenderClient, RenderError, type RenderClient } from "@/lib/render/client";
import { FarpyError, filmGate, type FilmQuote } from "@/lib/render/farpy";
import { buildPlaceBlend, defaultCamera, moveCamera as shiftCamera, type Lens, type PrevizPlan } from "@/lib/render/previz";
import { followFilm, quoteFilm, startRender, type PrevizEvent } from "@/lib/render/previz-run";
import { SHOT_LINE, SHOT_RESOLUTION, SHOT_SECONDS, shotGate, shotPrompt } from "@/lib/render/shot";
import { referencePaths } from "@/lib/render/references";
import { followTake, submitTake, type TakeRunEvent } from "@/lib/render/run";
import { sessionTokens } from "@/lib/render/session";
import {
  readInFlight, readRenderLink, saveInFlight, saveRenderLink, cleanApiKey, type InFlight, type RenderLink,
} from "@/lib/render/settings";
import { DEFAULT_TAKE, takeProfile, type TakeSettings } from "@/lib/render/take-graph";
import { takePrompt } from "@/lib/render/take-prompt";

export type Sheet = null | "connect" | "credits" | "coffre" | "confirm" | "fal" | "blender" | "train-confirm" | "previz-confirm" | "place-train" | "place-scene" | { take: string };

export type RunState =
  | { phase: "idle" }
  | { phase: "running"; event: TakeRunEvent | LoraTakeEvent | { stage: "start" } }
  | { phase: "done"; takeId: string }
  | { phase: "error"; code: string; message: string; detail: string[] };

export type PrevizState =
  | { phase: "idle" }
  | { phase: "running"; event: PrevizEvent }
  | { phase: "error"; message: string; detail: string[] };

const FILM_KEY = "u-ttu-film";

interface FilmFlight {
  jobId: string;
  sceneId: string;
  stage: "blender" | "person";
  handle: FalHandle | null;
  balanceBefore: number | null;
  loraId: string | null;
  prompt: string;
}

function readFilmFlight(): FilmFlight | null {
  try {
    localStorage.removeItem("u-ttu-previz");
    const data = JSON.parse(localStorage.getItem(FILM_KEY) ?? "null") as Partial<FilmFlight> | null;
    if (!data || typeof data.sceneId !== "string") return null;
    const stage = data.stage === "person" ? "person" : "blender";
    const handle = data.handle && typeof data.handle.requestId === "string" && typeof data.handle.statusUrl === "string" ? data.handle : null;
    if (stage === "blender" && typeof data.jobId !== "string") return null;
    if (stage === "person" && !handle) return null;
    return {
      jobId: typeof data.jobId === "string" ? data.jobId : "",
      sceneId: data.sceneId,
      stage,
      handle,
      balanceBefore: typeof data.balanceBefore === "number" ? data.balanceBefore : null,
      loraId: typeof data.loraId === "string" ? data.loraId : null,
      prompt: typeof data.prompt === "string" ? data.prompt : "",
    };
  } catch {
    return null;
  }
}

function saveFilmFlight(flight: FilmFlight | null) {
  try {
    if (flight) localStorage.setItem(FILM_KEY, JSON.stringify(flight));
    else localStorage.removeItem(FILM_KEY);
  } catch {}
}

function filmProblem(error: unknown): { message: string; detail: string[] } {
  if (error instanceof DOMException && error.name === "AbortError") {
    return { message: "Suivi arrêté ici. Si le rendu est déjà parti, il continue sur ton compte.", detail: [] };
  }
  if (error instanceof FarpyError) return { message: error.message, detail: error.detail };
  return { message: "Le filmage n’a pas abouti.", detail: [] };
}

export type TrainingState =
  | { phase: "idle" }
  | { phase: "running"; event: TrainingEvent }
  | { phase: "done"; loraId: string }
  | { phase: "error"; code: string; message: string; detail: string[] };

export type TakeEngineChoice = "comfy" | "lora";

const PICTURE_EDGE = 1536;
const SETTINGS_KEY = "u-ttu-reglage";
const LINE_KEY = "u-ttu-plan";
const ENGINE_KEY = "u-ttu-moteur";
const LORA_RES_KEY = "u-ttu-lora-reso";
const LORA_PICK_KEY = "u-ttu-lora-choisi";
const STEPS_KEY = "u-ttu-formation-pas";

function toAspect(aspect: TakeSettings["aspect"]): TrainingAspect {
  return aspect === "horizontal" ? "16:9" : aspect === "carre" ? "1:1" : "9:16";
}

function falFailure(error: unknown, fallback: string): { code: string; message: string; detail: string[] } {
  if (error instanceof FalError) return { code: error.code, message: error.message, detail: error.detail };
  return { code: "failed", message: error instanceof Error ? error.message : fallback, detail: [] };
}

async function probeClip(file: File): Promise<{ seconds: number; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  const element = document.createElement("video");
  element.preload = "metadata";
  element.muted = true;
  element.playsInline = true;
  try {
    const loaded = waitFor(element, "loadedmetadata", 8000);
    element.src = url;
    if (!(await loaded) || !Number.isFinite(element.duration)) return { seconds: 0, width: 0, height: 0 };
    return { seconds: element.duration, width: element.videoWidth, height: element.videoHeight };
  } catch {
    return { seconds: 0, width: 0, height: 0 };
  } finally {
    element.removeAttribute("src");
    element.load();
    URL.revokeObjectURL(url);
  }
}

async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PICTURE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image illisible.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("Image illisible."))), "image/jpeg", 0.9));
}

function waitFor(target: EventTarget, event: string, ms: number): Promise<boolean> {
  return new Promise(resolve => {
    const timer = window.setTimeout(() => done(false), ms);
    const fail = () => done(false);
    function done(ok: boolean) {
      window.clearTimeout(timer);
      target.removeEventListener(event, succeed);
      target.removeEventListener("error", fail);
      resolve(ok);
    }
    function succeed() {
      done(true);
    }
    target.addEventListener(event, succeed);
    target.addEventListener("error", fail);
  });
}

/** One decoded frame of the take. iOS paints nothing for a video tile until it plays. */
async function posterOf(video: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(video);
  const element = document.createElement("video");
  element.muted = true;
  element.playsInline = true;
  element.preload = "auto";
  try {
    const loaded = waitFor(element, "loadeddata", 8000);
    element.src = url;
    element.load();
    if (!(await loaded)) return null;
    if (Number.isFinite(element.duration) && element.duration > 0.4) {
      const seeked = waitFor(element, "seeked", 4000);
      element.currentTime = Math.min(0.6, element.duration / 4);
      await seeked;
    }
    const { videoWidth: width, videoHeight: height } = element;
    if (!width || !height) return null;
    const scale = Math.min(1, 720 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    return await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.86));
  } catch {
    return null;
  } finally {
    element.removeAttribute("src");
    element.load();
    URL.revokeObjectURL(url);
  }
}

function readSettings(): TakeSettings {
  try {
    const data = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<TakeSettings> | null;
    return {
      seconds: data?.seconds === 8 ? 8 : 5,
      quality: data?.quality === "fine" ? "fine" : "rapide",
      aspect: data?.aspect === "horizontal" || data?.aspect === "carre" ? data.aspect : "vertical",
    };
  } catch {
    return DEFAULT_TAKE;
  }
}

function stamp() {
  return Date.now().toString(36);
}

interface StudioValue {
  ready: boolean;
  studio: Studio;
  media: Record<string, string>;
  scene: Scene | null;
  line: string;
  settings: TakeSettings;
  claim: CostClaim;
  gate: RunGate;
  link: RenderLink;
  connected: boolean;
  balance: Balance | null;
  balanceNote: string;
  falLinked: boolean;
  falBalance: UsdBalance | null;
  falBalanceNote: string;
  falUsername: string;
  engine: TakeEngineChoice;
  setEngine(engine: TakeEngineChoice): void;
  chosenLora: Lora | null;
  setLora(id: string): void;
  loraResolution: LoraResolution;
  setLoraResolution(resolution: LoraResolution): void;
  loraQuote: number | null;
  dataset: DatasetCheck;
  trainingSteps: TrainingSteps;
  setTrainingSteps(steps: TrainingSteps): void;
  training: TrainingState;
  trainQuote: number | null;
  trainGate: RunGate;
  run: RunState;
  sheet: Sheet;
  folder: string | null;
  guide: GuideState;
  notice: string;
  setSheet(sheet: Sheet): void;
  setNotice(text: string): void;
  saveLook(patch: Partial<Look>): Promise<void>;
  addLookPhotos(files: File[]): Promise<void>;
  removeLookPhoto(path: string): Promise<void>;
  addScene(name: string): Promise<void>;
  saveScene(id: string, patch: Partial<Scene>): Promise<void>;
  addSceneStills(id: string, files: File[]): Promise<void>;
  removeSceneStill(id: string, path: string): Promise<void>;
  deleteScene(id: string): Promise<void>;
  selectScene(id: string): Promise<void>;
  setPreviz(id: string, plan: PrevizPlan): Promise<void>;
  moveCamera(point: "start" | "end", target: "stand" | "aim", axis: "x" | "y" | "z", direction: -1 | 1): Promise<void>;
  addSceneViews(id: string, files: File[]): Promise<void>;
  removeSceneView(id: string, path: string): Promise<void>;
  placeTrainQuote: number | null;
  placeSceneQuote: number | null;
  placeTrainGate: RunGate;
  placeSceneGate: RunGate;
  placeRun: "idle" | "running";
  requestPlaceTrain(): Promise<void>;
  confirmPlaceTrain(): Promise<void>;
  requestPlaceScene(): Promise<void>;
  confirmPlaceScene(): Promise<void>;
  setLens(lens: Lens): Promise<void>;
  previz: PrevizState;
  previzGate: RunGate;
  blenderLinked: boolean;
  requestPreviz(): Promise<void>;
  confirmPreviz(): Promise<void>;
  cancelPreviz(): void;
  connectBlender(raw: string): string | null;
  disconnectBlender(): void;
  setLine(line: string): void;
  setSettings(patch: Partial<TakeSettings>): void;
  addClips(files: File[]): Promise<void>;
  removeClip(path: string): Promise<void>;
  saveRole(patch: Partial<RoleDraft>): Promise<void>;
  addRolePhotos(files: File[]): Promise<void>;
  removeRolePhoto(path: string): Promise<void>;
  copyLookPhotos(): Promise<void>;
  resetLook(): Promise<void>;
  resetScene(): Promise<void>;
  resetTake(): void;
  resetRole(): Promise<void>;
  requestTraining(): Promise<void>;
  confirmTraining(): Promise<void>;
  cancelTraining(): void;
  resetTraining(): void;
  deleteLora(id: string): Promise<void>;
  requestRun(): Promise<void>;
  confirmRun(): Promise<void>;
  cancelRun(): void;
  resetRun(): void;
  deleteTake(id: string): Promise<void>;
  refreshBalance(): Promise<Balance | null>;
  refreshFal(): Promise<UsdBalance | null>;
  connectFal(raw: string): Promise<string | null>;
  disconnectFal(): void;
  connectKey(raw: string): Promise<string | null>;
  sessionLinked(): Promise<boolean>;
  disconnect(): Promise<void>;
  exportCoffre(): Promise<void>;
  linkFolder(): Promise<void>;
  dismissGuide(moment: GuideMoment): void;
  guideOff(): void;
}

const StudioContext = createContext<StudioValue | null>(null);

export function useStudio(): StudioValue {
  const value = useContext(StudioContext);
  if (!value) throw new Error("Studio absent.");
  return value;
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const folderRef = useRef<DirectoryHandle | null>(null);
  const storeRef = useRef<VaultStore | null>(null);
  const mediaRef = useRef<Record<string, string>>({});
  const tokens = useMemo(() => sessionTokens(), []);
  const abort = useRef<AbortController | null>(null);
  const abortTrain = useRef<AbortController | null>(null);
  const abortPlace = useRef<AbortController | null>(null);
  const abortPreviz = useRef<AbortController | null>(null);
  const wake = useRef<{ release(): Promise<void> } | null>(null);
  const wakeTrain = useRef<{ release(): Promise<void> } | null>(null);
  const studioRef = useRef<Studio>(emptyStudio());
  const falEpoch = useRef(0);
  const comfyEpoch = useRef(0);

  const [ready, setReady] = useState(false);
  const [studio, setStudioState] = useState<Studio>(emptyStudio());
  const [media, setMedia] = useState<Record<string, string>>({});
  const [line, setLineState] = useState("");
  const [settings, setSettingsState] = useState<TakeSettings>(DEFAULT_TAKE);
  const [link, setLink] = useState<RenderLink>({ mode: "none" });
  const [connected, setConnected] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceNote, setBalanceNote] = useState("");
  const [falKey, setFalKey] = useState<string | null>(null);
  const [falLinked, setFalLinked] = useState(false);
  const [falBalance, setFalBalance] = useState<UsdBalance | null>(null);
  const [falBalanceNote, setFalBalanceNote] = useState("");
  const [falUsername, setFalUsername] = useState("");
  const [trainerPrice, setTrainerPrice] = useState<FalPrice | null>(null);
  const [takePrice, setTakePrice] = useState<FalPrice | null>(null);
  const [engine, setEngineState] = useState<TakeEngineChoice>("comfy");
  const [loraResolution, setLoraResolutionState] = useState<LoraResolution>("768P");
  const [loraPick, setLoraPickState] = useState<string | null>(null);
  const [trainingSteps, setTrainingStepsState] = useState<TrainingSteps>(1000);
  const [training, setTraining] = useState<TrainingState>({ phase: "idle" });
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  const [previz, setPrevizState] = useState<PrevizState>({ phase: "idle" });
  const [filmQuote, setFilmQuote] = useState<FilmQuote | null>(null);
  const quoteRef = useRef<FilmQuote | null>(null);
  const [blenderKey, setBlenderKey] = useState<string | null>(null);
  const [placeTrainPrice, setPlaceTrainPrice] = useState<FalPrice | null>(null);
  const [placeScenePrice, setPlaceScenePrice] = useState<FalPrice | null>(null);
  const [placeRun, setPlaceRun] = useState<"idle" | "running">("idle");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const [guide, setGuide] = useState<GuideState>({ off: false, seen: [] });
  const [notice, setNotice] = useState("");

  const store = useCallback((): VaultStore => {
    storeRef.current ??= linkedStore(idbVault(), () => folderRef.current);
    return storeRef.current;
  }, []);

  const setStudio = useCallback((next: Studio) => {
    studioRef.current = next;
    setStudioState(next);
  }, []);

  const addMedia = useCallback((path: string, blob: Blob) => {
    const previous = mediaRef.current[path];
    if (previous) URL.revokeObjectURL(previous);
    mediaRef.current = { ...mediaRef.current, [path]: URL.createObjectURL(blob) };
    setMedia(mediaRef.current);
  }, []);

  const dropMedia = useCallback((path: string) => {
    const previous = mediaRef.current[path];
    if (!previous) return;
    URL.revokeObjectURL(previous);
    const next = { ...mediaRef.current };
    delete next[path];
    mediaRef.current = next;
    setMedia(next);
  }, []);

  const client = useMemo<RenderClient | null>(() => {
    if (link.mode === "key") return createRenderClient({ auth: { kind: "key", key: link.key } });
    if (link.mode === "session") return createRenderClient({ auth: { kind: "session", token: () => tokens.token() } });
    return null;
  }, [link, tokens]);

  const fal = useMemo<FalClient | null>(() => (falKey ? createFalClient({ key: falKey }) : null), [falKey]);

  const refreshBalance = useCallback(async (): Promise<Balance | null> => {
    if (!client) {
      setBalance(null);
      return null;
    }
    const epoch = comfyEpoch.current;
    try {
      const credits = await client.balance();
      if (reduceConnect({ epoch: comfyEpoch.current, connected: true }, { type: "read", epoch, ok: true }).ignored) return null;
      setConnected(true);
      if (credits === null) {
        setBalanceNote("Solde illisible sur ce compte.");
        setBalance(null);
        return null;
      }
      const next = { credits, readAt: Date.now() };
      setBalance(next);
      setBalanceNote("");
      return next;
    } catch (error) {
      if (reduceConnect({ epoch: comfyEpoch.current, connected: true }, { type: "read", epoch, ok: false }).ignored) return null;
      setBalance(null);
      if (error instanceof RenderError && error.code === "auth") setConnected(false);
      setBalanceNote(error instanceof Error ? error.message : "Solde illisible.");
      return null;
    }
  }, [client]);

  const refreshFal = useCallback(async (): Promise<UsdBalance | null> => {
    if (!fal) {
      setFalBalance(null);
      return null;
    }
    const epoch = falEpoch.current;
    const [account, trainer, priced, placeTrain, placeStill] = await Promise.all([
      fal.account().then(value => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error })),
      fal.price(LORA_TRAINER).catch(() => null),
      fal.price(LORA_TAKE).catch(() => null),
      fal.price(PLACE_TRAINER).catch(() => null),
      fal.price(PLACE_SCENE).catch(() => null),
    ]);
    if (reduceConnect({ epoch: falEpoch.current, connected: true }, { type: "read", epoch, ok: account.ok }).ignored) return null;
    setTrainerPrice(trainer);
    setTakePrice(priced);
    setPlaceTrainPrice(placeTrain);
    setPlaceScenePrice(placeStill);
    if (!account.ok) {
      const failure = falFailure(account.error, "Solde fal illisible.");
      setFalBalance(null);
      if (failure.code === "auth" || failure.code === "scope") setFalLinked(false);
      setFalBalanceNote(failure.message);
      return null;
    }
    if (!account.value) {
      setFalBalance(null);
      setFalBalanceNote("Solde fal illisible.");
      return null;
    }
    const next = { usd: account.value.usd, readAt: Date.now() };
    setFalLinked(true);
    setFalUsername(account.value.username);
    setFalBalance(next);
    setFalBalanceNote("");
    return next;
  }, [fal]);

  useEffect(() => {
    if (!fal) {
      setFalBalance(null);
      setTrainerPrice(null);
      setTakePrice(null);
      return;
    }
    void refreshFal();
  }, [fal, refreshFal]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setGuide(readGuide(localStorage));
      setSettingsState(readSettings());
      setLineState(localStorage.getItem(LINE_KEY) ?? "");
      setLink(readRenderLink(localStorage));
      const storedFal = readFalKey(localStorage);
      setFalKey(storedFal);
      setFalLinked(Boolean(storedFal));
      setBlenderKey(readBlenderKey(localStorage));
      setEngineState(localStorage.getItem(ENGINE_KEY) === "lora" ? "lora" : "comfy");
      setLoraResolutionState(localStorage.getItem(LORA_RES_KEY) === "480P" ? "480P" : "768P");
      setLoraPickState(localStorage.getItem(LORA_PICK_KEY));
      setTrainingStepsState(localStorage.getItem(STEPS_KEY) === "2000" ? 2000 : 1000);
      try {
        void navigator.storage?.persist?.();
        const loaded = await loadStudio(store());
        const entries = await store().list();
        if (!alive) return;
        const urls: Record<string, string> = {};
        for (const entry of entries) if (entry.blob) urls[entry.path] = URL.createObjectURL(entry.blob);
        mediaRef.current = urls;
        setMedia(urls);
        setStudio(loaded);
      } catch {
        setNotice("Le coffre de cet appareil ne s’ouvre pas. Un navigateur privé peut le bloquer.");
      }
      setReady(true);
    })();
    return () => {
      alive = false;
      for (const url of Object.values(mediaRef.current)) URL.revokeObjectURL(url);
    };
  }, [store, setStudio]);

  useEffect(() => {
    if (!client) {
      setConnected(false);
      setBalance(null);
      return;
    }
    void refreshBalance();
  }, [client, refreshBalance]);

  const scene = studio.scenes.find(item => item.id === studio.currentScene) ?? null;
  const profile = takeProfile(settings);
  const claim = useMemo(
    () => costClaim(profile, studio.takes.map(take => ({ profile: take.profile, credits: take.costCredits, gpuSeconds: take.gpuSeconds, at: take.at }))),
    [profile, studio.takes],
  );
  const comfyGate = useMemo(() => runGate(balance, claim), [balance, claim]);
  const dataset = useMemo(() => datasetCheck(studio.clips, studio.role.photos.length, studio.role.name), [studio.clips, studio.role.photos.length, studio.role.name]);
  const people = studio.loras.filter(item => !isPlaceLora(item));
  const chosenLora = people.find(item => item.id === loraPick) ?? people[0] ?? null;
  const trainQuote = useMemo(() => trainingQuote(trainerPrice, trainingSteps), [trainerPrice, trainingSteps]);
  const trainGate = useMemo(() => falGate(falBalance, trainQuote, "formation"), [falBalance, trainQuote]);
  const loraQuote = useMemo(() => loraTakeQuote(takePrice, settings.seconds, loraResolution), [takePrice, settings.seconds, loraResolution]);
  const loraGate = useMemo(() => falGate(falBalance, loraQuote, "prise"), [falBalance, loraQuote]);
  const gate = engine === "lora" ? loraGate : comfyGate;
  const characterUsd = useMemo(() => loraTakeQuote(takePrice, SHOT_SECONDS, SHOT_RESOLUTION), [takePrice]);
  const trajetReady = (scene?.frames.length ?? 0) >= 2;
  const shotCheck = useMemo(() => shotGate({ blender: filmQuote, characterUsd, trajetReady }), [characterUsd, filmQuote, trajetReady]);
  const pricedPlace = useMemo(() => placeTrainQuote(placeTrainPrice, PLACE_STEPS), [placeTrainPrice]);
  const pricedStill = useMemo(() => placeSceneQuote(placeScenePrice, PLACE_WIDTH, PLACE_HEIGHT), [placeScenePrice]);
  const placeTrainGate = useMemo(() => falGate(falBalance, pricedPlace, "formation"), [falBalance, pricedPlace]);
  const placeSceneGate = useMemo(() => falGate(falBalance, pricedStill, "prise"), [falBalance, pricedStill]);

  const saveLook = useCallback(async (patch: Partial<Look>) => {
    const look = { ...studioRef.current.look, ...patch };
    setStudio({ ...studioRef.current, look });
    await writeLook(store(), look);
  }, [setStudio, store]);

  const addLookPhotos = useCallback(async (files: File[]) => {
    const room = LOOK_PHOTOS_MAX - studioRef.current.look.photos.length;
    const picked = files.filter(file => file.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (picked.length === 0) {
      setNotice(room <= 0 ? "Trois photos au plus. Retire une photo pour en mettre une autre." : "Choisis une photo.");
      return;
    }
    const paths: string[] = [];
    for (const [index, file] of picked.entries()) {
      try {
        const blob = await downscale(file);
        const path = `refs/look-${stamp()}-${index + 1}.jpg`;
        await writeBlob(store(), path, blob);
        addMedia(path, blob);
        paths.push(path);
      } catch {
        setNotice("Une photo n’a pas pu être lue. Essaie un JPEG ou un PNG.");
      }
    }
    await saveLook({ photos: [...studioRef.current.look.photos, ...paths].slice(0, LOOK_PHOTOS_MAX) });
  }, [addMedia, saveLook, store]);

  const removeLookPhoto = useCallback(async (path: string) => {
    await store().remove(path);
    dropMedia(path);
    await saveLook({ photos: studioRef.current.look.photos.filter(item => item !== path) });
  }, [dropMedia, saveLook, store]);

  const resetLook = useCallback(async () => {
    const current = studioRef.current.look;
    for (const path of current.photos) {
      await store().remove(path);
      dropMedia(path);
    }
    const look = emptyLook();
    setStudio({ ...studioRef.current, look });
    await writeLook(store(), look);
  }, [dropMedia, setStudio, store]);

  const saveRole = useCallback(async (patch: Partial<RoleDraft>) => {
    const role = { ...studioRef.current.role, ...patch };
    setStudio({ ...studioRef.current, role });
    await writeRole(store(), role);
  }, [setStudio, store]);

  const addRolePhotos = useCallback(async (files: File[]) => {
    const room = ROLE_PHOTOS_MAX - studioRef.current.role.photos.length;
    const picked = files.filter(file => file.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (picked.length === 0) {
      setNotice(room <= 0 ? "Quatre photos au plus pour un personnage." : "Choisis une photo.");
      return;
    }
    const paths: string[] = [];
    for (const [index, file] of picked.entries()) {
      try {
        const blob = await downscale(file);
        const path = `roles/photo-${stamp()}-${index + 1}.jpg`;
        await writeBlob(store(), path, blob);
        addMedia(path, blob);
        paths.push(path);
      } catch {
        setNotice("Une photo n’a pas pu être lue. Essaie un JPEG ou un PNG.");
      }
    }
    await saveRole({ photos: [...studioRef.current.role.photos, ...paths].slice(0, ROLE_PHOTOS_MAX) });
  }, [addMedia, saveRole, store]);

  const copyLookPhotos = useCallback(async () => {
    const room = ROLE_PHOTOS_MAX - studioRef.current.role.photos.length;
    const sources = studioRef.current.look.photos.slice(0, Math.max(0, room));
    const paths: string[] = [];
    for (const [index, path] of sources.entries()) {
      const entry = await store().get(path);
      if (!entry?.blob) continue;
      const next = `roles/photo-${stamp()}-${index + 1}.jpg`;
      await writeBlob(store(), next, entry.blob);
      addMedia(next, entry.blob);
      paths.push(next);
    }
    if (paths.length) await saveRole({ photos: [...studioRef.current.role.photos, ...paths].slice(0, ROLE_PHOTOS_MAX) });
  }, [addMedia, saveRole, store]);

  const removeRolePhoto = useCallback(async (path: string) => {
    await store().remove(path);
    dropMedia(path);
    await saveRole({ photos: studioRef.current.role.photos.filter(item => item !== path) });
  }, [dropMedia, saveRole, store]);

  const resetRole = useCallback(async () => {
    if (training.phase === "running") return;
    const current = studioRef.current;
    for (const path of [...current.role.photos, ...current.clips.map(clip => clip.path)]) {
      await store().remove(path);
      dropMedia(path);
    }
    const role = emptyRole();
    setStudio({ ...studioRef.current, role, clips: [] });
    await writeRole(store(), role);
    await writeClips(store(), []);
  }, [dropMedia, setStudio, store, training.phase]);

  const selectScene = useCallback(async (id: string) => {
    setStudio({ ...studioRef.current, currentScene: id });
    await writeState(store(), id);
  }, [setStudio, store]);

  const addScene = useCallback(async (name: string) => {
    const clean = name.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!clean) return;
    const id = uniqueId(slugify(clean), studioRef.current.scenes.map(item => item.id));
    const created: Scene = { id, ...emptySceneDraft(), name: clean };
    setStudio({ ...studioRef.current, scenes: [...studioRef.current.scenes, created], currentScene: id });
    await writeScene(store(), created);
    await writeState(store(), id);
  }, [setStudio, store]);

  const saveScene = useCallback(async (id: string, patch: Partial<Scene>) => {
    const current = studioRef.current.scenes.find(item => item.id === id);
    if (!current) return;
    const next = { ...current, ...patch, id };
    setStudio({ ...studioRef.current, scenes: studioRef.current.scenes.map(item => (item.id === id ? next : item)) });
    await writeScene(store(), next);
  }, [setStudio, store]);

  const addSceneStills = useCallback(async (id: string, files: File[]) => {
    const current = studioRef.current.scenes.find(item => item.id === id);
    if (!current) return;
    const room = SCENE_STILLS_MAX - current.stills.length;
    const picked = files.filter(file => file.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (picked.length === 0) {
      setNotice(room <= 0 ? "Deux images par lieu au plus." : "Choisis une image.");
      return;
    }
    const paths: string[] = [];
    for (const [index, file] of picked.entries()) {
      try {
        const blob = await downscale(file);
        const path = `scenes/${id}-${stamp()}-${index + 1}.jpg`;
        await writeBlob(store(), path, blob);
        addMedia(path, blob);
        paths.push(path);
      } catch {
        setNotice("Une image n’a pas pu être lue.");
      }
    }
    await saveScene(id, { stills: [...current.stills, ...paths].slice(0, SCENE_STILLS_MAX) });
  }, [addMedia, saveScene, store]);

  const removeSceneStill = useCallback(async (id: string, path: string) => {
    const current = studioRef.current.scenes.find(item => item.id === id);
    if (!current) return;
    await store().remove(path);
    dropMedia(path);
    await saveScene(id, { stills: current.stills.filter(item => item !== path) });
  }, [dropMedia, saveScene, store]);

  const deleteScene = useCallback(async (id: string) => {
    const current = studioRef.current.scenes.find(item => item.id === id);
    if (!current) return;
    await removeScene(store(), current);
    current.stills.forEach(dropMedia);
    if (current.previzFile) dropMedia(current.previzFile);
    if (current.render) dropMedia(current.render);
    current.frames.forEach(dropMedia);
    current.views.forEach(dropMedia);
    const scenes = studioRef.current.scenes.filter(item => item.id !== id);
    const currentScene = studioRef.current.currentScene === id ? scenes[0]?.id ?? null : studioRef.current.currentScene;
    setStudio({ ...studioRef.current, scenes, currentScene });
    await writeState(store(), currentScene);
  }, [dropMedia, setStudio, store]);

  const dropPath = useCallback(async (current: Scene) => {
    for (const path of current.frames) {
      await store().remove(path);
      dropMedia(path);
    }
    if (current.render && !current.frames.includes(current.render)) {
      await store().remove(current.render);
      dropMedia(current.render);
    }
    quoteRef.current = null;
    setFilmQuote(null);
  }, [dropMedia, store]);

  const setPreviz = useCallback(async (id: string, plan: PrevizPlan) => {
    const current = studioRef.current.scenes.find(item => item.id === id);
    if (!current) return;
    const camera = current.camera ?? defaultCamera(plan);
    if (current.previz !== plan) await dropPath(current);
    await saveScene(id, { previz: plan, camera, ...(current.previz !== plan ? { frames: [], render: null, shot: null } : {}) });
  }, [dropPath, saveScene]);

  const moveCamera = useCallback(async (point: "start" | "end", target: "stand" | "aim", axis: "x" | "y" | "z", direction: -1 | 1) => {
    const current = studioRef.current.scenes.find(item => item.id === studioRef.current.currentScene);
    if (!current?.previz) return;
    const camera = shiftCamera(current.camera ?? defaultCamera(current.previz), point, target, axis, direction);
    await dropPath(current);
    await saveScene(current.id, { camera, frames: [], render: null, shot: null });
  }, [dropPath, saveScene]);

  const setLens = useCallback(async (lens: Lens) => {
    const current = studioRef.current.scenes.find(item => item.id === studioRef.current.currentScene);
    if (!current?.previz) return;
    const camera = { ...(current.camera ?? defaultCamera(current.previz)), lens };
    await dropPath(current);
    await saveScene(current.id, { camera, frames: [], render: null, shot: null });
  }, [dropPath, saveScene]);

  const resetScene = useCallback(async () => {
    const current = studioRef.current.scenes.find(item => item.id === studioRef.current.currentScene);
    if (!current) return;
    for (const path of [...current.stills, ...current.frames, ...current.views, current.previzFile, current.render]) {
      if (!path) continue;
      await store().remove(path);
      dropMedia(path);
    }
    await saveScene(current.id, emptySceneDraft());
  }, [dropMedia, saveScene, store]);

  const addSceneViews = useCallback(async (id: string, files: File[]) => {
    const current = studioRef.current.scenes.find(item => item.id === id);
    if (!current) return;
    const room = PLACE_VIEWS_MAX - current.views.length;
    const picked = files.filter(file => file.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (picked.length === 0) {
      setNotice(room <= 0 ? "Douze vues en plus au plus." : "Choisis une image.");
      return;
    }
    const paths: string[] = [];
    for (const [index, file] of picked.entries()) {
      try {
        const blob = await downscale(file);
        const path = `scenes/${id}-vue-${stamp()}-${index + 1}.jpg`;
        await writeBlob(store(), path, blob);
        addMedia(path, blob);
        paths.push(path);
      } catch {
        setNotice("Une vue n’a pas pu être lue.");
      }
    }
    await saveScene(id, { views: [...current.views, ...paths].slice(0, PLACE_VIEWS_MAX) });
  }, [addMedia, saveScene, store]);

  const removeSceneView = useCallback(async (id: string, path: string) => {
    const current = studioRef.current.scenes.find(item => item.id === id);
    if (!current) return;
    await store().remove(path);
    dropMedia(path);
    await saveScene(id, { views: current.views.filter(item => item !== path) });
  }, [dropMedia, saveScene, store]);

  const setLine = useCallback((value: string) => {
    const next = value.replace(/[\r\n]+/g, " ").slice(0, 240);
    setLineState(next);
    try { localStorage.setItem(LINE_KEY, next); } catch {}
  }, []);

  const setSettings = useCallback((patch: Partial<TakeSettings>) => {
    setSettingsState(current => {
      const next = { ...current, ...patch };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const resetTake = useCallback(() => {
    if (run.phase !== "idle") return;
    setLine("");
    setSettings(DEFAULT_TAKE);
  }, [run.phase, setLine, setSettings]);

  const finish = useCallback(async (flight: InFlight, renderClient: RenderClient) => {
    abort.current = new AbortController();
    try {
      wake.current = await (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen") ?? null;
    } catch {}
    try {
      const result = await followTake(renderClient, flight.jobId, flight.balanceBefore, event => setRun({ phase: "running", event }), { signal: abort.current.signal });
      const id = takeId(new Date(flight.at), flight.sceneName);
      const video = `prises/${id}.${extensionFor(result.video.type || "video/mp4")}`;
      await writeBlob(store(), video, result.video);
      addMedia(video, result.video);
      const frame = await posterOf(result.video);
      const poster = frame ? `prises/${id}.jpg` : null;
      if (frame && poster) {
        await writeBlob(store(), poster, frame);
        addMedia(poster, frame);
      }
      const take: Take = {
        id,
        at: flight.at,
        sceneId: flight.sceneId,
        sceneName: flight.sceneName,
        line: flight.line,
        settings: flight.settings,
        profile: takeProfile(flight.settings),
        jobId: result.jobId,
        video,
        poster,
        prompt: flight.prompt,
        gpuSeconds: result.gpuSeconds,
        costCredits: result.costCredits,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
        engine: "comfy",
        loraId: null,
        resolution: null,
        costUsd: null,
        costSource: null,
      };
      const takes = [take, ...studioRef.current.takes.filter(item => item.id !== id)];
      await writeTake(store(), take, takes, studioRef.current.loras);
      setStudio({ ...studioRef.current, takes });
      saveInFlight(localStorage, null);
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
      else void refreshBalance();
      setRun({ phase: "done", takeId: id });
    } catch (error) {
      const failure = error instanceof RenderError ? error : new RenderError("failed", error instanceof Error ? error.message : "La prise n’a pas abouti.");
      if (failure.code !== "network") saveInFlight(localStorage, null);
      setRun({ phase: "error", code: failure.code, message: failure.message, detail: failure.detail });
      void refreshBalance();
    } finally {
      abort.current = null;
      await wake.current?.release().catch(() => {});
      wake.current = null;
    }
  }, [addMedia, refreshBalance, setStudio, store]);

  const finishLora = useCallback(async (flight: LoraTakeFlight, falClient: FalClient) => {
    abort.current = new AbortController();
    try {
      wake.current = await (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen") ?? null;
    } catch {}
    try {
      const result = await followLoraTake(falClient, flight.handle, flight.balanceBefore, event => setRun({ phase: "running", event }), { signal: abort.current.signal });
      const id = takeId(new Date(flight.at), flight.sceneName);
      const video = `prises/${id}.${extensionFor(result.video.type || "video/mp4")}`;
      await writeBlob(store(), video, result.video);
      addMedia(video, result.video);
      const frame = await posterOf(result.video);
      const poster = frame ? `prises/${id}.jpg` : null;
      if (frame && poster) {
        await writeBlob(store(), poster, frame);
        addMedia(poster, frame);
      }
      const take: Take = {
        id,
        at: flight.at,
        sceneId: flight.sceneId,
        sceneName: flight.sceneName,
        line: flight.line,
        settings: flight.settings,
        profile: loraTakeProfile(flight.settings.seconds, flight.settings.aspect, flight.resolution),
        jobId: flight.handle.requestId,
        video,
        poster,
        prompt: flight.prompt,
        gpuSeconds: result.seconds,
        costCredits: null,
        balanceBefore: flight.balanceBefore,
        balanceAfter: result.balanceAfter,
        engine: "lora",
        loraId: flight.loraId,
        resolution: flight.resolution,
        costUsd: result.costUsd,
        costSource: result.costSource,
      };
      const takes = [take, ...studioRef.current.takes.filter(item => item.id !== id)];
      await writeTake(store(), take, takes, studioRef.current.loras);
      setStudio({ ...studioRef.current, takes });
      saveLoraTakeFlight(localStorage, null);
      if (result.balanceAfter !== null) setFalBalance({ usd: result.balanceAfter, readAt: Date.now() });
      else void refreshFal();
      setRun({ phase: "done", takeId: id });
    } catch (error) {
      const failure = falFailure(error, "La prise n’a pas abouti.");
      if (failure.code !== "network" && failure.code !== "timeout") saveLoraTakeFlight(localStorage, null);
      setRun({ phase: "error", code: failure.code, message: failure.message, detail: failure.detail });
      void refreshFal();
    } finally {
      abort.current = null;
      await wake.current?.release().catch(() => {});
      wake.current = null;
    }
  }, [addMedia, refreshFal, setStudio, store]);

  const finishTraining = useCallback(async (flight: TrainingFlight, falClient: FalClient) => {
    abortTrain.current = new AbortController();
    try {
      wakeTrain.current = await (navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen") ?? null;
    } catch {}
    try {
      const result = await followTraining(falClient, flight.handle, flight.balanceBefore, event => setTraining({ phase: "running", event }), { signal: abortTrain.current.signal });
      const id = uniqueId(loraId(new Date(flight.at), flight.name), studioRef.current.loras.map(item => item.id));
      const file = `loras/${id}.safetensors`;
      const created: Lora = {
        id,
        at: flight.at,
        name: flight.name,
        trigger: flight.trigger,
        file,
        bytes: result.lora.size,
        sha256: await sha256Hex(result.lora),
        steps: flight.steps,
        rank: TRAINING_RANK,
        aspect: flight.aspect,
        clips: flight.clips,
        kind: "personnage",
        sceneId: null,
        endpoint: LORA_TRAINER,
        requestId: result.requestId,
        seconds: result.seconds,
        costUsd: result.costUsd,
        costSource: result.costSource,
        balanceBefore: flight.balanceBefore,
        balanceAfter: result.balanceAfter,
      };
      const loras = [created, ...studioRef.current.loras.filter(item => item.id !== id)];
      await writeLora(store(), created, result.lora, studioRef.current.takes, loras);
      setStudio({ ...studioRef.current, loras });
      setLoraPickState(id);
      try { localStorage.setItem(LORA_PICK_KEY, id); } catch {}
      const uploads = readLoraUploads(localStorage);
      uploads[id] = { url: result.loraUrl, until: Date.now() + TRAINING_KEEP_SECONDS * 1000 };
      saveLoraUploads(localStorage, uploads);
      saveTrainingFlight(localStorage, null);
      if (result.balanceAfter !== null) setFalBalance({ usd: result.balanceAfter, readAt: Date.now() });
      else void refreshFal();
      setTraining({ phase: "done", loraId: id });
    } catch (error) {
      const failure = falFailure(error, "La formation n’a pas abouti.");
      if (failure.code !== "network" && failure.code !== "timeout") saveTrainingFlight(localStorage, null);
      setTraining({ phase: "error", code: failure.code, message: failure.message, detail: failure.detail });
      void refreshFal();
    } finally {
      abortTrain.current = null;
      await wakeTrain.current?.release().catch(() => {});
      wakeTrain.current = null;
    }
  }, [refreshFal, setStudio, store]);

  useEffect(() => {
    if (!ready || run.phase !== "idle") return;
    const comfyFlight = client ? readInFlight(localStorage) : null;
    if (comfyFlight && client) {
      setRun({ phase: "running", event: { stage: "queue", jobId: comfyFlight.jobId } });
      void finish(comfyFlight, client);
      return;
    }
    const loraFlight = fal ? readLoraTakeFlight(localStorage) : null;
    if (loraFlight && fal) {
      setRun({ phase: "running", event: { stage: "queue", position: null } });
      void finishLora(loraFlight, fal);
    }
  }, [client, fal, finish, finishLora, ready, run.phase]);

  useEffect(() => {
    if (!ready || !fal || training.phase !== "idle") return;
    const flight = readTrainingFlight(localStorage);
    if (!flight) return;
    setTraining({ phase: "running", event: { stage: "queue", position: null } });
    void finishTraining(flight, fal);
  }, [fal, finishTraining, ready, training.phase]);

  const requestRun = useCallback(async () => {
    if (engine === "lora") {
      if (!falLinked || !fal) {
        setSheet("fal");
        return;
      }
      await refreshFal();
      setSheet("confirm");
      return;
    }
    if (!client || !connected) {
      setSheet("connect");
      return;
    }
    await refreshBalance();
    setSheet("confirm");
  }, [client, connected, engine, fal, falLinked, refreshBalance, refreshFal]);

  const confirmRun = useCallback(async () => {
    if (run.phase === "running") return;
    const current = studioRef.current;
    const place = current.scenes.find(item => item.id === current.currentScene) ?? null;
    if (engine === "lora") {
      if (!fal) return;
      const trained = current.loras.find(item => item.id === loraPick) ?? current.loras[0] ?? null;
      if (!trained) return;
      const fresh = await refreshFal();
      const priced = await fal.price(LORA_TAKE).catch(() => null);
      setTakePrice(priced);
      const quote = loraTakeQuote(priced, settings.seconds, loraResolution);
      const freshGate = falGate(fresh, quote, "prise");
      if (!fresh || !freshGate.allowed) return;
      const vault = store();
      const weights = await vault.get(trained.file);
      if (!weights?.blob) {
        setRun({ phase: "error", code: "invalid", message: "Le fichier du personnage manque au coffre.", detail: [] });
        return;
      }
      const pictures: { blob: Blob; name: string }[] = [];
      let lookCount = 0;
      for (const path of current.look.photos) {
        const entry = await vault.get(path);
        if (!entry?.blob) continue;
        lookCount += 1;
        pictures.push({ blob: entry.blob, name: `uttu-${pictures.length + 1}.jpg` });
      }
      let filmed = false;
      for (const path of referencePaths([], place)) {
        const entry = await vault.get(path);
        if (!entry?.blob) continue;
        if (path === place?.render) filmed = true;
        pictures.push({ blob: entry.blob, name: `uttu-${pictures.length + 1}.jpg` });
      }
      if (lookCount === 0 && !filmed) {
        setRun({ phase: "error", code: "invalid", message: place?.render ? "L’image filmée manque au coffre." : "Les photos du look manquent au coffre.", detail: [] });
        return;
      }
      const prompt = takePrompt({
        traits: current.look.traits,
        lookPictures: lookCount,
        place: place ? { name: place.name, note: place.note, pictures: pictures.length - lookCount } : null,
        line,
        tags: "image",
        subject: trained.trigger,
      });
      setSheet(null);
      setRun({ phase: "running", event: { stage: "start" } });
      abort.current = new AbortController();
      try {
        const cached = readLoraUploads(localStorage)[trained.id];
        const submitted = await submitLoraTake(fal, {
          lora: { id: trained.id, blob: weights.blob, url: cached?.url ?? null, urlUntil: cached?.until ?? null },
          pictures,
          prompt,
          seconds: settings.seconds,
          aspect: toAspect(settings.aspect),
          resolution: loraResolution,
          seed: crypto.getRandomValues(new Uint32Array(1))[0],
        }, event => setRun({ phase: "running", event }), { signal: abort.current.signal });
        const uploads = readLoraUploads(localStorage);
        uploads[trained.id] = { url: submitted.loraUrl, until: submitted.loraUrlUntil };
        saveLoraUploads(localStorage, uploads);
        const flight: LoraTakeFlight = {
          handle: submitted.handle,
          at: new Date().toISOString(),
          sceneId: place?.id ?? null,
          sceneName: place?.name ?? "",
          line,
          prompt,
          settings,
          resolution: loraResolution,
          loraId: trained.id,
          balanceBefore: fresh.usd,
        };
        saveLoraTakeFlight(localStorage, flight);
        await finishLora(flight, fal);
      } catch (error) {
        const failure = falFailure(error, "La prise n’a pas abouti.");
        setRun({ phase: "error", code: failure.code, message: failure.message, detail: failure.detail });
        abort.current = null;
      }
      return;
    }
    if (!client) return;
    const fresh = await refreshBalance();
    const freshGate = runGate(fresh, claim);
    if (!fresh || !freshGate.allowed) return;
    setSheet(null);
    setRun({ phase: "running", event: { stage: "start" } });
    const vault = store();
    const pictures: { blob: Blob; name: string }[] = [];
    for (const [index, path] of referencePaths(current.look.photos, place).entries()) {
      const entry = await vault.get(path);
      if (entry?.blob) pictures.push({ blob: entry.blob, name: `uttu-${index + 1}.jpg` });
    }
    const lookCount = current.look.photos.length;
    const prompt = takePrompt({
      traits: current.look.traits,
      lookPictures: lookCount,
      place: place ? { name: place.name, note: place.note, pictures: Math.max(0, pictures.length - lookCount) } : null,
      line,
    });
    abort.current = new AbortController();
    try {
      const jobId = await submitTake(client, {
        pictures,
        prompt,
        settings,
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
        clientId: crypto.randomUUID(),
      }, event => setRun({ phase: "running", event }), abort.current.signal);
      const flight: InFlight = {
        jobId,
        at: new Date().toISOString(),
        sceneId: place?.id ?? null,
        sceneName: place?.name ?? "",
        line,
        prompt,
        settings,
        balanceBefore: fresh.credits,
      };
      saveInFlight(localStorage, flight);
      await finish(flight, client);
    } catch (error) {
      const failure = error instanceof RenderError ? error : new RenderError("failed", error instanceof Error ? error.message : "La prise n’a pas abouti.");
      setRun({ phase: "error", code: failure.code, message: failure.message, detail: failure.detail });
      abort.current = null;
    }
  }, [claim, client, engine, fal, finish, finishLora, line, loraPick, loraResolution, refreshBalance, refreshFal, run.phase, settings, store]);

  const cancelRun = useCallback(() => abort.current?.abort(), []);
  const resetRun = useCallback(() => setRun({ phase: "idle" }), []);

  const keepFrames = useCallback(async (sceneId: string, images: readonly Blob[]) => {
    const current = studioRef.current.scenes.find(item => item.id === sceneId);
    if (!current) return;
    for (const path of current.frames) {
      await store().remove(path);
      dropMedia(path);
    }
    const paths: string[] = [];
    for (const [index, image] of images.entries()) {
      const path = `scenes/${sceneId}-trajet-${String(index + 1).padStart(2, "0")}.png`;
      await writeBlob(store(), path, image);
      addMedia(path, image);
      paths.push(path);
    }
    await saveScene(sceneId, { frames: paths, render: paths[0] ?? null });
  }, [addMedia, dropMedia, saveScene, store]);

  const finishPerson = useCallback(async (flight: FilmFlight, falClient: FalClient) => {
    if (!flight.handle || flight.balanceBefore === null || !flight.loraId) return;
    const abort = new AbortController();
    abortPreviz.current = abort;
    try {
      setPrevizState({ phase: "running", event: { stage: "person" } });
      const result = await followLoraTake(falClient, flight.handle, flight.balanceBefore, event => {
        if (event.stage === "render") setPrevizState({ phase: "running", event: { stage: "shot", seconds: event.seconds } });
        else if (event.stage === "fetch" || event.stage === "measure") setPrevizState({ phase: "running", event: { stage: "video" } });
        else setPrevizState({ phase: "running", event: { stage: "person" } });
      }, { signal: abort.signal });
      const place = studioRef.current.scenes.find(item => item.id === flight.sceneId);
      const id = takeId(new Date(), place?.name || flight.sceneId);
      const video = `prises/${id}.${extensionFor(result.video.type || "video/mp4")}`;
      await writeBlob(store(), video, result.video);
      addMedia(video, result.video);
      const frame = await posterOf(result.video);
      const poster = frame ? `prises/${id}.jpg` : null;
      if (frame && poster) {
        await writeBlob(store(), poster, frame);
        addMedia(poster, frame);
      }
      const settings: TakeSettings = { seconds: 5, quality: "rapide", aspect: "vertical" };
      const take: Take = {
        id,
        at: new Date().toISOString(),
        sceneId: flight.sceneId,
        sceneName: place?.name ?? "",
        line: SHOT_LINE,
        settings,
        profile: loraTakeProfile(SHOT_SECONDS, "9:16", SHOT_RESOLUTION),
        jobId: flight.handle.requestId,
        video,
        poster,
        prompt: flight.prompt,
        gpuSeconds: result.seconds,
        costCredits: null,
        balanceBefore: flight.balanceBefore,
        balanceAfter: result.balanceAfter,
        engine: "lora",
        loraId: flight.loraId,
        resolution: SHOT_RESOLUTION,
        costUsd: result.costUsd,
        costSource: result.costSource,
      };
      const takes = [take, ...studioRef.current.takes.filter(item => item.id !== id)];
      await writeTake(store(), take, takes, studioRef.current.loras);
      await saveScene(flight.sceneId, { shot: id });
      setStudio({ ...studioRef.current, takes });
      saveFilmFlight(null);
      if (result.balanceAfter !== null) setFalBalance({ usd: result.balanceAfter, readAt: Date.now() });
      setPrevizState({ phase: "idle" });
      setNotice("Le plan est filmé. Blender a rendu le lieu vide. Le personnage est dans la prise.");
    } catch (error) {
      const failure = falFailure(error, "Le personnage n’est pas dans le plan.");
      if (failure.code === "network" || failure.code === "timeout") {
        setPrevizState({ phase: "error", message: "Le lieu est rendu. Le suivi du personnage reprend. Rien n’est renvoyé.", detail: [] });
      } else {
        saveFilmFlight(null);
        setPrevizState({ phase: "error", message: `Le lieu est rendu. ${failure.message}`, detail: failure.detail });
      }
    } finally {
      abortPreviz.current = null;
    }
  }, [addMedia, saveScene, setStudio, store]);

  const finishFilm = useCallback(async (flight: FilmFlight, key: string) => {
    const abort = abortPreviz.current ?? new AbortController();
    abortPreviz.current = abort;
    try {
      const result = await followFilm(key, flight.jobId, event => setPrevizState({ phase: "running", event }), { signal: abort.signal });
      await keepFrames(flight.sceneId, result.images);
      saveFilmFlight(null);
      quoteRef.current = null;
      setFilmQuote(null);
      setPrevizState({ phase: "idle" });
      setNotice("Le lieu est rendu, vide. Le prochain geste filme le personnage, au prix fal seul.");
    } catch (error) {
      const failure = filmProblem(error);
      if (!(error instanceof DOMException)) saveFilmFlight(null);
      setPrevizState({ phase: "error", message: failure.message, detail: failure.detail });
    } finally {
      abortPreviz.current = null;
    }
  }, [keepFrames]);

  const requestPreviz = useCallback(async () => {
    const place = studioRef.current.scenes.find(item => item.id === studioRef.current.currentScene);
    if (!place?.previz || previz.phase === "running") return;
    const person = studioRef.current.loras.find(item => !isPlaceLora(item));
    if (!person) return;
    if (!blenderKey) {
      setSheet("blender");
      return;
    }
    if (!fal) {
      setSheet("fal");
      return;
    }
    if (place.frames.length >= 2) {
      await refreshFal();
      setSheet("previz-confirm");
      return;
    }
    saveFilmFlight(null);
    const camera = place.camera ?? defaultCamera(place.previz);
    setPrevizState({ phase: "running", event: { stage: "write" } });
    abortPreviz.current = new AbortController();
    try {
      const bytes = buildPlaceBlend(place.previz, camera);
      const path = `scenes/${place.id}.blend`;
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" });
      if (place.previzFile && place.previzFile !== path) await store().remove(place.previzFile);
      await writeBlob(store(), path, blob);
      await saveScene(place.id, { previzFile: path, camera });
      setPrevizState({ phase: "running", event: { stage: "inspect" } });
      const quote = await quoteFilm(blenderKey, blob, `uttu-${place.id}.blend`, abortPreviz.current.signal);
      quoteRef.current = quote;
      setFilmQuote(quote);
      await refreshFal();
      setPrevizState({ phase: "idle" });
      setSheet("previz-confirm");
    } catch (error) {
      const failure = filmProblem(error);
      setPrevizState({ phase: "error", message: failure.message, detail: failure.detail });
    } finally {
      abortPreviz.current = null;
    }
  }, [blenderKey, fal, previz.phase, refreshFal, saveScene, store]);

  const confirmPreviz = useCallback(async () => {
    if (!blenderKey || !fal || previz.phase === "running") return;
    const place = studioRef.current.scenes.find(item => item.id === studioRef.current.currentScene);
    const person = studioRef.current.loras.find(item => !isPlaceLora(item));
    if (!place?.previz || !person) return;
    const fresh = await refreshFal();
    const priced = await fal.price(LORA_TAKE).catch(() => null);
    setTakePrice(priced);
    const usd = loraTakeQuote(priced, SHOT_SECONDS, SHOT_RESOLUTION);
    const ready = place.frames.length >= 2;
    const gate = shotGate({ blender: quoteRef.current, characterUsd: usd, trajetReady: ready });
    const money = falGate(fresh, usd, "prise");
    if (!fresh || !gate.allowed || !money.allowed) {
      setNotice(gate.allowed ? money.line : gate.line);
      return;
    }
    if (!ready && !filmGate(quoteRef.current).allowed) return;
    setSheet(null);
    abortPreviz.current = new AbortController();
    let started = false;
    try {
      let images: Blob[] = [];
      if (!ready) {
        const quote = quoteRef.current;
        if (!quote) return;
        setPrevizState({ phase: "running", event: { stage: "start" } });
        const jobId = await startRender(blenderKey, quote, abortPreviz.current.signal);
        started = true;
        saveFilmFlight({ jobId, sceneId: place.id, stage: "blender", handle: null, balanceBefore: fresh.usd, loraId: person.id, prompt: "" });
        const result = await followFilm(blenderKey, jobId, event => setPrevizState({ phase: "running", event }), { signal: abortPreviz.current.signal });
        images = result.images;
        await keepFrames(place.id, images);
        saveFilmFlight(null);
        quoteRef.current = null;
        setFilmQuote(null);
      } else {
        for (const path of place.frames) {
          const entry = await store().get(path);
          if (entry?.blob) images.push(entry.blob);
        }
      }
      if (images.length < 2) throw new FarpyError("Blender n’a pas rendu le trajet.");
      const weights = await store().get(person.file);
      if (!weights?.blob) throw new FalError("invalid", "Le fichier du personnage manque au coffre.");
      const prompt = shotPrompt({ subject: person.trigger, place: place.name, note: place.note, frames: images.length, line: SHOT_LINE });
      setPrevizState({ phase: "running", event: { stage: "person" } });
      const cached = readLoraUploads(localStorage)[person.id];
      const submitted = await submitLoraTake(fal, {
        lora: { id: person.id, blob: weights.blob, url: cached?.url ?? null, urlUntil: cached?.until ?? null },
        pictures: images.map((blob, index) => ({ blob, name: `trajet-${index + 1}.png` })),
        prompt,
        seconds: SHOT_SECONDS,
        aspect: "9:16",
        resolution: SHOT_RESOLUTION,
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
      }, () => setPrevizState({ phase: "running", event: { stage: "person" } }), { signal: abortPreviz.current.signal });
      const uploads = readLoraUploads(localStorage);
      uploads[person.id] = { url: submitted.loraUrl, until: submitted.loraUrlUntil };
      saveLoraUploads(localStorage, uploads);
      const flight: FilmFlight = {
        jobId: "",
        sceneId: place.id,
        stage: "person",
        handle: submitted.handle,
        balanceBefore: fresh.usd,
        loraId: person.id,
        prompt,
      };
      saveFilmFlight(flight);
      await finishPerson(flight, fal);
    } catch (error) {
      if (!started) saveFilmFlight(null);
      const failure = error instanceof FalError ? falFailure(error, "Le personnage n’est pas dans le plan.") : filmProblem(error);
      const held = studioRef.current.scenes.find(item => item.id === place.id);
      const rendered = (held?.frames.length ?? 0) >= 2;
      setPrevizState({
        phase: "error",
        message: rendered ? `Le lieu est rendu. ${failure.message}` : failure.message,
        detail: failure.detail,
      });
      abortPreviz.current = null;
    }
  }, [blenderKey, fal, finishPerson, keepFrames, previz.phase, refreshFal, store]);

  const cancelPreviz = useCallback(() => abortPreviz.current?.abort(), []);

  const connectBlender = useCallback((raw: string): string | null => {
    const key = cleanBlenderKey(raw);
    if (!key) return "Il faut une clé de job Farpy, celle qui commence par farpy_agent_. Une clé de compte ne suffit pas.";
    saveBlenderKey(localStorage, key);
    setBlenderKey(key);
    return null;
  }, []);

  const disconnectBlender = useCallback(() => {
    saveBlenderKey(localStorage, null);
    setBlenderKey(null);
    quoteRef.current = null;
    setFilmQuote(null);
  }, []);

  useEffect(() => {
    if (!ready || previz.phase !== "idle") return;
    const flight = readFilmFlight();
    if (!flight) return;
    if (flight.stage === "person" && flight.handle && fal) {
      void finishPerson(flight, fal);
      return;
    }
    if (!blenderKey || flight.stage !== "blender" || !flight.jobId) return;
    setPrevizState({ phase: "running", event: { stage: "queue", jobId: flight.jobId } });
    void finishFilm(flight, blenderKey);
  }, [blenderKey, fal, finishFilm, finishPerson, previz.phase, ready]);

  const deleteTake = useCallback(async (id: string) => {
    const take = studioRef.current.takes.find(item => item.id === id);
    if (!take) return;
    const takes = studioRef.current.takes.filter(item => item.id !== id);
    await removeTake(store(), take, takes, studioRef.current.loras);
    dropMedia(take.video);
    if (take.poster) dropMedia(take.poster);
    setStudio({ ...studioRef.current, takes });
  }, [dropMedia, setStudio, store]);

  const addClips = useCallback(async (files: File[]) => {
    const room = CLIPS_MAX - studioRef.current.clips.length;
    if (room <= 0) {
      setNotice("Trente clips au plus.");
      return;
    }
    const added: Clip[] = [];
    for (const [index, file] of [...files].slice(0, room).entries()) {
      const format = clipFormat(file.name, file.type);
      if (!format) {
        setNotice("Ce clip n’est pas une vidéo mp4, mov, mkv ou avi.");
        continue;
      }
      const probed = await probeClip(file);
      const clip: Clip = { path: `clips/clip-${stamp()}-${index + 1}.${format}`, format, bytes: file.size, seconds: probed.seconds, width: probed.width, height: probed.height };
      const problem = clipProblem(clip);
      if (problem) {
        setNotice(problem);
        continue;
      }
      await writeBlob(store(), clip.path, file);
      addMedia(clip.path, file);
      added.push(clip);
    }
    if (added.length === 0) return;
    const clips = [...studioRef.current.clips, ...added];
    setStudio({ ...studioRef.current, clips });
    await writeClips(store(), clips);
  }, [addMedia, setStudio, store]);

  const removeClip = useCallback(async (path: string) => {
    await store().remove(path);
    dropMedia(path);
    const clips = studioRef.current.clips.filter(clip => clip.path !== path);
    setStudio({ ...studioRef.current, clips });
    await writeClips(store(), clips);
  }, [dropMedia, setStudio, store]);

  const setTrainingSteps = useCallback((steps: TrainingSteps) => {
    setTrainingStepsState(steps);
    try { localStorage.setItem(STEPS_KEY, String(steps)); } catch {}
  }, []);

  const requestTraining = useCallback(async () => {
    if (!falLinked || !fal) {
      setSheet("fal");
      return;
    }
    await refreshFal();
    setSheet("train-confirm");
  }, [fal, falLinked, refreshFal]);

  const confirmTraining = useCallback(async () => {
    if (!fal || training.phase === "running") return;
    const fresh = await refreshFal();
    const priced = await fal.price(LORA_TRAINER).catch(() => null);
    setTrainerPrice(priced);
    const quote = trainingQuote(priced, trainingSteps);
    const freshGate = falGate(fresh, quote, "formation");
    if (!fresh || !freshGate.allowed) return;
    const current = studioRef.current;
    const check = datasetCheck(current.clips, current.role.photos.length, current.role.name);
    if (!check.ready) return;
    const vault = store();
    const clips: { blob: Blob; format: Clip["format"] }[] = [];
    for (const clip of current.clips) {
      const entry = await vault.get(clip.path);
      if (entry?.blob) clips.push({ blob: entry.blob, format: clip.format });
    }
    const refs: Blob[] = [];
    for (const path of current.role.photos.slice(0, ROLE_PHOTOS_MAX)) {
      const entry = await vault.get(path);
      if (entry?.blob) refs.push(entry.blob);
    }
    if (clips.length !== current.clips.length || refs.length !== current.role.photos.length) {
      setTraining({ phase: "error", code: "invalid", message: "Un clip ou une photo manque au coffre.", detail: [] });
      return;
    }
    setSheet(null);
    setTraining({ phase: "running", event: { stage: "pack" } });
    const trigger = triggerPhrase(current.role.name);
    abortTrain.current = new AbortController();
    try {
      const handle = await submitTraining(fal, { clips, refs, trigger, steps: trainingSteps, aspect: check.aspect }, event => setTraining({ phase: "running", event }), abortTrain.current.signal);
      const flight: TrainingFlight = {
        handle,
        at: new Date().toISOString(),
        name: current.role.name,
        trigger,
        steps: trainingSteps,
        aspect: check.aspect,
        clips: clips.length,
        balanceBefore: fresh.usd,
      };
      saveTrainingFlight(localStorage, flight);
      await finishTraining(flight, fal);
    } catch (error) {
      const failure = falFailure(error, "La formation n’a pas abouti.");
      setTraining({ phase: "error", code: failure.code, message: failure.message, detail: failure.detail });
      abortTrain.current = null;
    }
  }, [fal, finishTraining, refreshFal, training.phase, trainingSteps, store]);

  const cancelTraining = useCallback(() => abortTrain.current?.abort(), []);
  const resetTraining = useCallback(() => setTraining({ phase: "idle" }), []);

  const deleteLora = useCallback(async (id: string) => {
    const lora = studioRef.current.loras.find(item => item.id === id);
    if (!lora) return;
    const loras = studioRef.current.loras.filter(item => item.id !== id);
    await removeLora(store(), lora, studioRef.current.takes, loras);
    const uploads = readLoraUploads(localStorage);
    delete uploads[id];
    saveLoraUploads(localStorage, uploads);
    setStudio({ ...studioRef.current, loras });
  }, [setStudio, store]);

  const setEngine = useCallback((next: TakeEngineChoice) => {
    setEngineState(next);
    try { localStorage.setItem(ENGINE_KEY, next); } catch {}
  }, []);

  const setLora = useCallback((id: string) => {
    setLoraPickState(id);
    try { localStorage.setItem(LORA_PICK_KEY, id); } catch {}
  }, []);

  const setLoraResolution = useCallback((resolution: LoraResolution) => {
    setLoraResolutionState(resolution);
    try { localStorage.setItem(LORA_RES_KEY, resolution); } catch {}
  }, []);

  const connectFal = useCallback(async (raw: string): Promise<string | null> => {
    const key = cleanFalKey(raw);
    if (!key) return "Cette clé n’a pas la forme d’une clé fal.";
    const opened = reduceConnect({ epoch: falEpoch.current, connected: false }, { type: "connect" });
    falEpoch.current = opened.epoch;
    try {
      const account = await createFalClient({ key }).account();
      if (reduceConnect(opened, { type: "read", epoch: opened.epoch, ok: Boolean(account) }).ignored) return null;
      if (falEpoch.current !== opened.epoch) return null;
      if (!account) return "fal n’a pas montré de solde en dollars.";
      saveFalKey(localStorage, key);
      setFalKey(key);
      setFalLinked(true);
      setFalUsername(account.username);
      setFalBalance({ usd: account.usd, readAt: Date.now() });
      setFalBalanceNote("");
      return null;
    } catch (error) {
      if (falEpoch.current !== opened.epoch) return null;
      return falFailure(error, "Clé refusée.").message;
    }
  }, []);

  const disconnectFal = useCallback(() => {
    falEpoch.current = reduceConnect({ epoch: falEpoch.current, connected: true }, { type: "connect" }).epoch;
    saveFalKey(localStorage, null);
    setFalKey(null);
    setFalLinked(false);
    setFalBalance(null);
    setFalUsername("");
    setFalBalanceNote("");
    setPlaceTrainPrice(null);
    setPlaceScenePrice(null);
  }, []);

  const connectKey = useCallback(async (raw: string): Promise<string | null> => {
    const key = cleanApiKey(raw);
    if (!key) return "Cette clé n’a pas la forme d’une clé de rendu.";
    const opened = reduceConnect({ epoch: comfyEpoch.current, connected: false }, { type: "connect" });
    comfyEpoch.current = opened.epoch;
    const candidate = createRenderClient({ auth: { kind: "key", key } });
    try {
      await candidate.user();
    } catch (error) {
      if (comfyEpoch.current !== opened.epoch) return null;
      return error instanceof Error ? error.message : "Clé refusée.";
    }
    if (comfyEpoch.current !== opened.epoch) return null;
    const next: RenderLink = { mode: "key", key };
    saveRenderLink(localStorage, next);
    setLink(next);
    setConnected(true);
    return null;
  }, []);

  const sessionLinked = useCallback(async (): Promise<boolean> => {
    if (!(await tokens.connected())) return false;
    const opened = reduceConnect({ epoch: comfyEpoch.current, connected: false }, { type: "connect" });
    comfyEpoch.current = opened.epoch;
    if (comfyEpoch.current !== opened.epoch) return false;
    const next: RenderLink = { mode: "session" };
    saveRenderLink(localStorage, next);
    setLink(next);
    setConnected(true);
    return true;
  }, [tokens]);

  const disconnect = useCallback(async () => {
    comfyEpoch.current = reduceConnect({ epoch: comfyEpoch.current, connected: true }, { type: "connect" }).epoch;
    if (link.mode === "session") await tokens.forget();
    saveRenderLink(localStorage, { mode: "none" });
    setLink({ mode: "none" });
    setConnected(false);
    setBalance(null);
  }, [link.mode, tokens]);

  const exportCoffre = useCallback(async () => {
    const data = await coffreZip(store());
    const url = URL.createObjectURL(new Blob([data.slice().buffer], { type: "application/zip" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "U-TTU-Studio.zip";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, [store]);

  const linkFolder = useCallback(async () => {
    const handle = await pickFolder();
    if (!handle) return;
    folderRef.current = handle;
    const count = await mirrorAll(idbVault(), handle);
    setFolder(handle.name);
    setNotice(`${count} fichiers copiés dans « ${handle.name} ». Le dossier suit le studio jusqu’à la fermeture.`);
  }, []);

  const dismissGuide = useCallback((moment: GuideMoment) => {
    setGuide(current => {
      const next = { ...current, seen: [...new Set([...current.seen, moment])] };
      saveGuide(localStorage, next);
      return next;
    });
  }, []);

  const guideOff = useCallback(() => {
    setGuide(current => {
      const next = { ...current, off: true };
      saveGuide(localStorage, next);
      return next;
    });
  }, []);

  const requestPlaceTrain = useCallback(async () => {
    const place = studioRef.current.scenes.find(item => item.id === studioRef.current.currentScene);
    if (!place || placeRun === "running") return;
    const check = placeShotLine(placeShotList(place).length);
    if (!check.ready) {
      setNotice(check.line);
      return;
    }
    if (!fal) {
      setSheet("fal");
      return;
    }
    await refreshFal();
    setSheet("place-train");
  }, [fal, placeRun, refreshFal]);

  const confirmPlaceTrain = useCallback(async () => {
    if (!fal || placeRun === "running") return;
    const place = studioRef.current.scenes.find(item => item.id === studioRef.current.currentScene);
    if (!place) return;
    const shots = placeShotList(place);
    if (shots.length < PLACE_SHOTS_MIN) return;
    const fresh = await refreshFal();
    const priced = await fal.price(PLACE_TRAINER).catch(() => null);
    setPlaceTrainPrice(priced);
    const quote = placeTrainQuote(priced, PLACE_STEPS);
    const freshGate = falGate(fresh, quote, "formation");
    if (!fresh || !freshGate.allowed) {
      setNotice(freshGate.line);
      return;
    }
    const images: Blob[] = [];
    for (const path of shots) {
      const entry = await store().get(path);
      if (entry?.blob) images.push(entry.blob);
    }
    if (images.length < PLACE_SHOTS_MIN) {
      setNotice("Une vue manque au coffre.");
      return;
    }
    setSheet(null);
    setPlaceRun("running");
    abortPlace.current = new AbortController();
    try {
      const trigger = placeTrigger(place.name);
      const handle = await submitPlaceTraining(fal, { images, trigger, steps: PLACE_STEPS }, abortPlace.current.signal);
      const result = await followPlaceTraining(fal, handle, fresh.usd, { signal: abortPlace.current.signal });
      const id = uniqueId(loraId(new Date(), place.name), studioRef.current.loras.map(item => item.id));
      const file = `loras/${id}.safetensors`;
      const created: Lora = {
        id,
        at: new Date().toISOString(),
        name: place.name,
        kind: "lieu",
        sceneId: place.id,
        trigger,
        file,
        bytes: result.lora.size,
        sha256: await sha256Hex(result.lora),
        steps: PLACE_STEPS,
        rank: 0,
        aspect: "9:16",
        clips: images.length,
        endpoint: PLACE_TRAINER,
        requestId: result.requestId,
        seconds: result.seconds,
        costUsd: result.costUsd,
        costSource: result.costSource,
        balanceBefore: fresh.usd,
        balanceAfter: result.balanceAfter,
      };
      const loras = [created, ...studioRef.current.loras.filter(item => item.id !== id)];
      await writeLora(store(), created, result.lora, studioRef.current.takes, loras);
      const uploads = readLoraUploads(localStorage);
      uploads[id] = { url: result.loraUrl, until: Date.now() + PLACE_KEEP_SECONDS * 1000 };
      saveLoraUploads(localStorage, uploads);
      setStudio({ ...studioRef.current, loras });
      if (result.balanceAfter !== null) setFalBalance({ usd: result.balanceAfter, readAt: Date.now() });
      setNotice("Le lieu est au coffre. Ce fichier n’est pas un volume : le Blender du lieu reste le modèle 3D.");
    } catch (error) {
      setNotice(falFailure(error, "La formation du lieu n’a pas abouti.").message);
    } finally {
      abortPlace.current = null;
      setPlaceRun("idle");
    }
  }, [fal, placeRun, refreshFal, setStudio, store]);

  const requestPlaceScene = useCallback(async () => {
    const place = studioRef.current.scenes.find(item => item.id === studioRef.current.currentScene);
    const trained = studioRef.current.loras.find(item => isPlaceLora(item) && item.sceneId === place?.id);
    if (!place || !trained || placeRun === "running") return;
    if (!fal) {
      setSheet("fal");
      return;
    }
    await refreshFal();
    setSheet("place-scene");
  }, [fal, placeRun, refreshFal]);

  const confirmPlaceScene = useCallback(async () => {
    if (!fal || placeRun === "running") return;
    const place = studioRef.current.scenes.find(item => item.id === studioRef.current.currentScene);
    const trained = studioRef.current.loras.find(item => isPlaceLora(item) && item.sceneId === place?.id);
    if (!place || !trained) return;
    const fresh = await refreshFal();
    const priced = await fal.price(PLACE_SCENE).catch(() => null);
    setPlaceScenePrice(priced);
    const quote = placeSceneQuote(priced, PLACE_WIDTH, PLACE_HEIGHT);
    const freshGate = falGate(fresh, quote, "prise");
    if (!fresh || !freshGate.allowed) {
      setNotice(freshGate.line);
      return;
    }
    setSheet(null);
    setPlaceRun("running");
    abortPlace.current = new AbortController();
    try {
      const cached = readLoraUploads(localStorage)[trained.id];
      let loraUrl = cached?.url ?? "";
      if (!loraUrl || (cached?.until ?? 0) - Date.now() < 2 * 3600 * 1000) {
        const weights = await store().get(trained.file);
        if (!weights?.blob) throw new FalError("invalid", "Le fichier du lieu manque au coffre.");
        loraUrl = await fal.upload(weights.blob, `${trained.id}.safetensors`, { expiresIn: PLACE_UPLOAD_KEEP_SECONDS, signal: abortPlace.current.signal });
        const uploads = readLoraUploads(localStorage);
        uploads[trained.id] = { url: loraUrl, until: Date.now() + PLACE_UPLOAD_KEEP_SECONDS * 1000 };
        saveLoraUploads(localStorage, uploads);
      }
      const handle = await submitPlaceScene(fal, {
        loraUrl,
        trigger: trained.trigger,
        place: place.name,
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
      }, abortPlace.current.signal);
      const result = await followPlaceScene(fal, handle, fresh.usd, { signal: abortPlace.current.signal });
      const path = `scenes/${place.id}-vue-${stamp()}-batie.jpg`;
      await writeBlob(store(), path, result.image);
      addMedia(path, result.image);
      const views = place.views.length >= PLACE_VIEWS_MAX ? [...place.views.slice(1), path] : [...place.views, path];
      if (place.views.length >= PLACE_VIEWS_MAX) {
        await store().remove(place.views[0]);
        dropMedia(place.views[0]);
      }
      await saveScene(place.id, { views });
      if (result.balanceAfter !== null) setFalBalance({ usd: result.balanceAfter, readAt: Date.now() });
      setNotice("Image bâtie depuis le LoRA du lieu. Le fichier Blender reste le modèle 3D.");
    } catch (error) {
      setNotice(falFailure(error, "L’image du lieu n’a pas abouti.").message);
    } finally {
      abortPlace.current = null;
      setPlaceRun("idle");
    }
  }, [addMedia, dropMedia, fal, placeRun, refreshFal, saveScene, store]);

  const value: StudioValue = {
    ready, studio, media, scene, line, settings, claim, gate, link, connected, balance, balanceNote, previz, previzGate: shotCheck, blenderLinked: Boolean(blenderKey), requestPreviz, confirmPreviz, cancelPreviz, connectBlender, disconnectBlender, setPreviz, moveCamera, setLens,
    addSceneViews, removeSceneView, placeTrainQuote: pricedPlace, placeSceneQuote: pricedStill, placeTrainGate, placeSceneGate, placeRun, requestPlaceTrain, confirmPlaceTrain, requestPlaceScene, confirmPlaceScene,
    falLinked, falBalance, falBalanceNote, falUsername, engine, setEngine, chosenLora, setLora, loraResolution, setLoraResolution, loraQuote,
    dataset, trainingSteps, setTrainingSteps, training, trainQuote, trainGate, run, sheet, folder, guide, notice,
    setSheet, setNotice, saveLook, addLookPhotos, removeLookPhoto, resetLook, addScene, saveScene, addSceneStills, removeSceneStill, deleteScene, selectScene, resetScene,
    setLine, setSettings, resetTake, saveRole, addRolePhotos, removeRolePhoto, copyLookPhotos, resetRole, addClips, removeClip, requestTraining, confirmTraining, cancelTraining, resetTraining, deleteLora,
    requestRun, confirmRun, cancelRun, resetRun, deleteTake, refreshBalance, refreshFal, connectFal, disconnectFal, connectKey, sessionLinked, disconnect,
    exportCoffre, linkFolder, dismissGuide, guideOff,
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
