"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/components/i18n/provider";
import { placeStoryboard } from "@/lib/montage/arrivee";
import type { Edit } from "@/lib/montage/edit";
import { assetPath } from "@/lib/site";
import { assetNote, assetPaths, importNotes, looseAssets, type AssetRecord } from "@/lib/creation/assets";
import { importMedia } from "@/lib/creation/import-media";
import { readFrontmatter, list, withFrontmatter } from "@/lib/coffre/markdown";
import { castNote } from "@/lib/creation/fiche";
import { runStem, type StemKind } from "@/lib/creation/stem";
import { SFX_DEFAULT_SECONDS, musicQuote, sfxQuote, voiceQuote } from "@/lib/montage/quotes";
import { gesteOuvert, gesteParId, gesteVisible, templatePartenaire, type RoleRef } from "@/lib/workflows/registre";
import { cleanCardName, copyCast, decorFromScene, renameById, type CastCard, type DecorCard } from "@/lib/creation/gallery";
import { creationAllowed, quoteForCast, quoteForDecor, spendAllowed } from "@/lib/creation/quotes";
import { stillOutput, runStill } from "@/lib/creation/still";
import { DEMO_CAST, DEMO_DECOR } from "@/lib/creation/demo";
import { coffreZip } from "@/lib/coffre/export";
import { mergeCoffreZip, vaultPathFromZip } from "@/lib/coffre/import";
import { folderLinkSupported, linkedStore, mirrorAll, pickFolder, type DirectoryHandle } from "@/lib/coffre/link";
import {
  emptySceneDraft, ensureActiveProject, extensionFor, loadStudio, removeScene, sceneMarkdown, selectProject as chooseProject, sequenceStem, shotStem, slugify, takeId, uniqueId,
  writeBlob, writeLook, writeScene, writeSequence, writeShot, writeState, writeTake, writeText,
  type Scene, type Shot, type Studio, type Take,
} from "@/lib/coffre/model";
import { allowFolder, folderPermission, loadFolderHandle, readFolder, saveFolderHandle } from "@/lib/coffre/permit";
import { projectPath } from "@/lib/coffre/project";
import { idbVault, removeUnreferenced, type VaultStore } from "@/lib/coffre/store";
import { posePlan } from "@/lib/ergonomie";
import { type Balance } from "@/lib/credits";
import { finalFileId, finalGraph, finalQuote, type FinalChoice, type FinalRatio } from "@/lib/montage/finaliser";
import { priseGate, resolveTakeQuote, type TakeQuote } from "@/lib/render/billed-quote";
import { audioOutput, videoOutput, meshOutput, jobStage, createRenderClient, RenderError, type RenderClient } from "@/lib/render/client";
import { isVideoGeste, VIDEO_GESTE_TEXT, videoGesteGraph } from "@/lib/render/video-gestes";
import { importModel, modelExtension } from "@/lib/maquette/files";
import { isMeshGeste, meshGesteGraph, runMesh } from "@/lib/render/mesh-gestes";
import { learnTakeCost } from "@/lib/render/landed-cost";
import { quotesToRecords } from "@/lib/render/measured-quote";
import { referencePaths } from "@/lib/render/references";
import { followTake, referenceLimit, submitTake, type TakeRunEvent } from "@/lib/render/run";
import { sessionTokens } from "@/lib/render/session";
import { settleLandedTake } from "@/lib/render/settle-take";
import { readInFlight, readRenderLink, sameRenderLink, saveInFlight, saveRenderLink, cleanApiKey, type InFlight, type RenderLink } from "@/lib/render/settings";
import { DEFAULT_TAKE, takeProfile, type TakeSettings } from "@/lib/render/take-graph";
import { DEFAULT_PREFS, readPrefs, savePrefs, type StudioPrefs } from "@/lib/studio-prefs";
import { takePrompt } from "@/lib/render/take-prompt";
import { accountFingerprint, bindPendingJob, clearPending, readPending, recoverableClient, projectVault, type PendingRender } from "@/lib/render/recovery";
import { readMontages, writeMontageEdit } from "@/lib/montage/vault";

export type SheetName = null | "credits" | "confirm" | "connect";

export type RunState =
  | { phase: "idle" }
  | { phase: "running"; event: TakeRunEvent | { stage: "start" } }
  | { phase: "done"; takeId: string }
  | { phase: "error"; code: string; message: string; detail: string[] };

export type FolderMode = "unsupported" | "off" | "ask" | "on";

const LINE_KEY = "u-ttu-plan";
const PICTURE = /\.(jpe?g|png|webp|gif)$/i;
const VIDEO = /\.(mp4|webm|mov)$/i;

export interface StudioSession {
  ready: boolean;
  demo: boolean;
  studio: Studio;
  media: Record<string, string>;
  cast: CastCard[];
  decor: DecorCard[];
  pickedCast: string | null;
  pickedDecor: string | null;
  line: string;
  setLine(line: string): void;
  notice: string;
  setNotice(text: string): void;
  sheet: SheetName;
  setSheet(sheet: SheetName): void;
  connected: boolean;
  balance: Balance | null;
  balanceNote: string;
  takeQuote: TakeQuote;
  gate: ReturnType<typeof priseGate>;
  settings: TakeSettings;
  run: RunState;
  folderMode: FolderMode;
  folderName: string | null;
  requestRun(input?: TakeRequest): Promise<void>;
  pendingTake: TakeRequest | null;
  confirmRun(): Promise<void>;
  cancelRun(): void;
  resetRun(): void;
  resumeRun(): void;
  identifyPendingJob(jobId: string, confirmed: boolean): Promise<string | null>;
  refreshBalance(): Promise<Balance | null>;
  connectKey(raw: string): Promise<string | null>;
  sessionLinked(): Promise<boolean>;
  disconnect(): Promise<void>;
  creating: boolean;
  loose: AssetRecord[];
  createCast(input: { name: string; prompt: string; source: "texte" | "photos"; files: File[]; confirmed: boolean; geste?: string }): Promise<boolean>;
  createDecor(input: { name: string; prompt: string; source: "texte" | "photo"; file: File | null; files?: File[]; confirmed: boolean; geste?: string }): Promise<boolean>;
  createStem(input: { geste: string; text: string; confirmed: boolean }): Promise<File | null>;
  prefs: StudioPrefs;
  setPrefs(next: Partial<StudioPrefs>): void;
  finaliseMontage(input: FinaliseInput): Promise<FinaliseOutcome>;
  runVideoGeste(input: VideoGesteRun): Promise<FinaliseOutcome>;
  runMeshGeste(input: MeshGesteRun): Promise<FinaliseOutcome>;
  renameCast(id: string, name: string): Promise<void>;
  renameDecor(id: string, name: string): Promise<void>;
  duplicateCast(id: string): Promise<void>;
  duplicateDecor(id: string): Promise<void>;
  deleteCast(id: string): Promise<void>;
  deleteDecor(id: string): Promise<void>;
  copyCastTo(id: string, slug: string): Promise<void>;
  pickCast(id: string): Promise<void>;
  pickDecor(id: string): Promise<void>;
  poseTake(takeId: string, names: { sequence: string; shot: string }): Promise<void>;
  loadMontages(): Promise<Edit[]>;
  saveMontage(edit: Edit, files: Record<string, { blob: Blob; ext: string }>): Promise<{ edit: Edit; slug: string }>;
  exportCoffre(): Promise<void>;
  importCoffre(file: File): Promise<void>;
  importFiles(files: File[]): Promise<void>;
  importAssets(files: File[], as?: "personnage" | "decor"): Promise<void>;
  refreshStudio(): Promise<void>;
  pendingRef: HeldRef | null;
  holdRef(ref: HeldRef | null): void;
  pendingClip: HeldClip | null;
  holdClip(clip: HeldClip | null): void;
  copyDecorTo(id: string, slug: string): Promise<void>;
  linkFolder(): Promise<void>;
  allowLinkedFolder(): Promise<void>;
  selectProject(slug: string): Promise<void>;
  outgoing(): string;
  saveModel(file: File): Promise<string>;
  readProjectFile(file: string): Promise<string | undefined>;
  writeProjectFile(file: string, text: string): Promise<void>;
  saveShot(shot: Shot): Promise<void>;
  saveLieu(input: { name: string; note: string; quartier?: string }): Promise<string | null>;
  saveLieuPhoto(input: { name: string; note: string; quartier?: string; photo: { id: string; author: string; credit: string; blob: Blob } }): Promise<string | null>;
  sendToMontage(input: { takeId?: string; planId: string; label: string; seconds: number; aspect: "horizontal" | "vertical"; still: string; prompt: string; sceneName: string; composeur: string }): Promise<void>;
}

export interface TakeRequest {
  planId: string;
  castIds: string[];
  decorId: string | null;
  line: string;
  prompt: string;
  settings: TakeSettings;
}

/** One PRISE video gesture (raccord, caméra, élargir, effacer). Same gate as a take: confirmed quote, balance over the ceiling. */
export interface VideoGesteRun {
  geste: string;
  files: Record<string, File>;
  prompt: string;
  confirmed: boolean;
  aspect?: "horizontal" | "vertical";
  onStage(stage: FinaliseStage, seconds?: number): void;
}

export interface MeshGesteRun {
  geste: string;
  file: File;
  confirmed: boolean;
  onStage(stage: FinaliseStage, seconds?: number): void;
}

export type FinaliseStage = "envoi" | "file" | "calcul" | "retour" | "mesure";

export interface FinaliseInput {
  project: string;
  video: Blob;
  name: string;
  seconds: number;
  ratio: FinalRatio;
  choice: FinalChoice;
  confirmed: boolean;
  onStage(stage: FinaliseStage, seconds?: number): void;
}

export type FinaliseOutcome =
  | { ok: true; path: string; url: string; cost: number | null }
  | { ok: false; message: string };

export interface HeldRef {
  id: string;
  role: RoleRef;
  name: string;
  url: string;
  assetId: string | null;
}

export interface HeldClip {
  seconds?: number;
  source: string;
  label: string;
  kind: "video" | "audio" | "image";
}

const SessionContext = createContext<StudioSession | null>(null);

export function useStudio(): StudioSession {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Studio absent.");
  return value;
}

function pictureName(index: number): string {
  return `uttu-${index + 1}.jpg`;
}

async function posterOf(video: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(video);
  const element = document.createElement("video");
  element.muted = true;
  element.playsInline = true;
  try {
    const loaded = new Promise<boolean>(resolve => {
      const timer = window.setTimeout(() => resolve(false), 4000);
      element.onloadeddata = () => { window.clearTimeout(timer); resolve(true); };
    });
    element.src = url;
    if (!(await loaded)) return null;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth || 720;
    canvas.height = element.videoHeight || 1280;
    canvas.getContext("2d")?.drawImage(element, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(value => resolve(value), "image/jpeg", 0.8));
    return blob;
  } catch {
    return null;
  } finally {
    element.removeAttribute("src");
    element.load();
    URL.revokeObjectURL(url);
  }
}

export function StudioProvider({ children, demo = false }: { children: ReactNode; demo?: boolean }) {
  const { t } = useI18n();
  const baseRef = useRef<VaultStore | null>(null);
  const folderRef = useRef<DirectoryHandle | null>(null);
  const mediaRef = useRef<Record<string, string>>({});
  const studioRef = useRef<Studio | null>(null);
  const targetProjectApplied = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const paidBusy = useRef(false);
  const following = useRef<string | null>(null);
  const saves = useRef<Promise<unknown>>(Promise.resolve());
  const mediaVersions = useRef<Record<string, number>>({});
  const retiredUrls = useRef<string[]>([]);
  const [pendingTake, setPendingTake] = useState<TakeRequest | null>(null);
  const tokens = useMemo(() => sessionTokens(), []);
  const [ready, setReady] = useState(false);
  const [studio, setStudioState] = useState<Studio | null>(null);
  const [media, setMedia] = useState<Record<string, string>>({});
  const [pickedCast, setPickedCast] = useState<string | null>(null);
  const [pickedDecor, setPickedDecor] = useState<string | null>(null);
  const [line, setLineState] = useState("");
  const [notice, setNotice] = useState("");
  const [sheet, setSheet] = useState<SheetName>(null);
  const [link, setLink] = useState<RenderLink>({ mode: "none" });
  const [connected, setConnected] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceNote, setBalanceNote] = useState("");
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  const [creating, setCreating] = useState(false);
  const [folderMode, setFolderMode] = useState<FolderMode>("off");
  const [folderName, setFolderName] = useState<string | null>(null);
  const [demoOn, setDemoOn] = useState(demo);
  const [loose, setLoose] = useState<AssetRecord[]>([]);
  const [pendingRef, setPendingRef] = useState<HeldRef | null>(null);
  const [pendingClip, setPendingClip] = useState<HeldClip | null>(null);

  const store = useCallback((): VaultStore => {
    const base = baseRef.current ?? idbVault();
    baseRef.current = base;
    return linkedStore(base, () => folderRef.current, () => {
      setFolderMode("ask");
      setNotice("Enregistré dans ce navigateur. La copie vers le dossier lié a échoué : reconnectez-le pour synchroniser.");
    });
  }, []);

  const setStudio = useCallback((next: Studio) => {
    studioRef.current = next;
    setStudioState(next);
  }, []);

  const showMedia = useCallback(async (vault: VaultStore, next: Studio) => {
    const urls: Record<string, string> = {};
    const wanted = new Set<string>();
    for (const card of next.cast) {
      for (const path of card.photos) wanted.add(path);
      if (card.sheet) wanted.add(card.sheet);
    }
    for (const scene of next.scenes) {
      for (const path of [...scene.stills, ...scene.frames, ...scene.views]) wanted.add(path);
      if (scene.render) wanted.add(scene.render);
    }
    for (const take of next.takes) {
      wanted.add(take.video);
      if (take.poster) wanted.add(take.poster);
    }
    for (const entry of await vault.list()) {
      if (/\/Sequences\/[^/]+\.(wav|mp3|m4a|ogg|webm|mp4)$/i.test(entry.path)) wanted.add(entry.path);
      if (/\/(?:Cast|Decors|Lieux|Prises|Sons|Assets)\/[^/]+\.(png|jpe?g|webp|gif|mp4|webm|mov|wav|mp3|m4a|ogg|glb|gltf)$/i.test(entry.path)) wanted.add(entry.path);
    }
    for (const path of next.look.photos) wanted.add(path);
    for (const path of wanted) {
      const entry = await vault.get(path);
      if (!entry?.blob) continue;
      urls[path] = mediaRef.current[path] && mediaVersions.current[path] === entry.updatedAt
        ? mediaRef.current[path] : URL.createObjectURL(entry.blob);
      mediaVersions.current[path] = entry.updatedAt;
    }
    // Keep older URLs alive until unmount: an export may still use a snapshot.
    for (const [path, url] of Object.entries(mediaRef.current)) if (urls[path] !== url) retiredUrls.current.push(url);
    mediaRef.current = urls;
    setMedia(urls);
  }, []);

  const reload = useCallback(async () => {
    const vault = store();
    const next = await loadStudio(vault);
    setStudio(next);
    const entries = await vault.list();
    const paths = entries.map(entry => entry.path);
    const noted = await importNotes(async path => (await vault.get(path))?.text, paths, next.project);
    setLoose([...looseAssets(paths, next.project), ...noted]);
    await showMedia(vault, next);
    return next;
  }, [setStudio, showMedia, store]);

  const client = useMemo<RenderClient | null>(() => {
    if (link.mode === "key") return createRenderClient({ auth: { kind: "key", key: link.key } });
    if (link.mode === "session") return createRenderClient({ auth: { kind: "session", token: () => tokens.token() } });
    return null;
  }, [link, tokens]);

  useEffect(() => () => {
    for (const url of [...Object.values(mediaRef.current), ...retiredUrls.current]) URL.revokeObjectURL(url);
  }, []);

  const activeClient = useRef(client);
  activeClient.current = client;
  const fingerprint = useCallback(async () => accountFingerprint(link.mode === "key" ? link.key : JSON.stringify(await client?.user())), [client, link]);

  // Synchronous guard before any await, plus an origin-wide Web Lock for tabs.
  const paid = useCallback(async <T,>(work: () => Promise<T>, refused: T): Promise<T> => {
    if (paidBusy.current || following.current) return refused;
    paidBusy.current = true;
    setCreating(true);
    try {
      if (!navigator.locks) throw new Error("Ce navigateur ne peut pas sécuriser les envois simultanés. Utilisez un navigateur récent.");
      return await navigator.locks.request("uttu-paid-render", { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Un rendu est déjà suivi dans un autre onglet.");
        if (readPending(localStorage) || readInFlight(localStorage)) throw new Error("Un rendu attend sa récupération. Ouvrez Crédits puis Récupérer le rendu avant un nouvel envoi.");
        return work();
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Opération interrompue.");
      return refused;
    } finally { paidBusy.current = false; setCreating(false); }
  }, []);

  const refreshBalance = useCallback(async (): Promise<Balance | null> => {
    if (!client) {
      setBalance(null);
      return null;
    }
    try {
      const credits = await client.balance();
      if (activeClient.current !== client) return null;
      setConnected(true);
      if (credits === null) {
        setBalance(null);
        setBalanceNote("Solde illisible sur ce compte.");
        return null;
      }
      const next = { credits, readAt: Date.now() };
      setBalance(next);
      setBalanceNote("");
      return next;
    } catch (error) {
      if (activeClient.current !== client) return null;
      setBalance(null);
      if (error instanceof RenderError && error.code === "auth") setConnected(false);
      setBalanceNote(error instanceof Error ? error.message : "Solde illisible.");
      return null;
    }
  }, [client]);

  const finish = useCallback(async (flight: InFlight, renderClient: RenderClient) => {
    if (following.current) return;
    following.current = flight.jobId;
    abort.current = new AbortController();
    try {
      const slug = flight.project ?? await ensureActiveProject(store());
      const vault = projectVault(store(), slug);
      const result = await followTake(renderClient, flight.jobId, flight.balanceBefore, event => setRun({ phase: "running", event }), { signal: abort.current.signal });
      if (flight.manualRecovery) { result.costCredits = null; result.balanceAfter = null; }
      const id = takeId(new Date(flight.at), flight.sceneName || "prise");
      const video = `Projets/${slug}/Prises/${id}.${extensionFor(result.video.type || "video/mp4")}`;
      await writeBlob(vault, video, result.video);
      const frame = await posterOf(result.video);
      const poster = frame ? `Projets/${slug}/Prises/${id}.jpg` : null;
      if (frame && poster) await writeBlob(vault, poster, frame);
      const current = await loadStudio(vault);
      const take: Take = {
        id, at: flight.at, sceneId: flight.sceneId, sceneName: flight.sceneName, line: flight.line, settings: flight.settings,
        profile: takeProfile(flight.settings), jobId: result.jobId, video, poster, prompt: flight.prompt,
        gpuSeconds: result.gpuSeconds, costCredits: result.costCredits, balanceBefore: result.balanceBefore, balanceAfter: result.balanceAfter,
        engine: "comfy", loraId: null, resolution: null, costUsd: null, costSource: null, announcedCredits: null, announcedHigh: null,
      };
      const learned = learnTakeCost({
        profile: take.profile, quotes: current.quotes, before: result.balanceBefore, after: result.balanceAfter, at: flight.at, balance: result.balanceAfter ?? flight.balanceBefore,
      });
      take.announcedCredits = learned.announced?.credits ?? null;
      take.announcedHigh = learned.announced?.high ?? null;
      const takes = [take, ...current.takes.filter(item => item.id !== id)];
      await settleLandedTake(vault, take, current.sequences, current.shots, takes, current.loras, flight.planId);
      clearPending(localStorage, flight.jobId);
      saveInFlight(localStorage, null);
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
      await reload();
      setRun({ phase: "done", takeId: id });
      setNotice("Prise enregistrée dans son projet. Vous pouvez la retrouver et l’ajouter au montage.");
    } catch (error) {
      const failure = error instanceof RenderError ? error : new RenderError("failed", error instanceof Error ? error.message : "La prise n’a pas abouti.");
      // Keep the receipt on timeout, download and disk errors. Recovery is read-only.
      setRun({ phase: "error", code: failure.code, message: failure.message, detail: failure.detail });
    } finally {
      abort.current = null;
      following.current = null;
    }
  }, [reload, store]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") setDemoOn(true);
    const cast = params.get("cast");
    const decor = params.get("decor");
    if (cast) setPickedCast(cast);
    if (decor) setPickedDecor(decor);
    try {
      const stored = localStorage.getItem(LINE_KEY);
      setLineState(stored ?? "");
    } catch {}
    setLink(prev => {
      const next = readRenderLink(localStorage);
      return sameRenderLink(prev, next) ? prev : next;
    });
    let gone = false;
    void (async () => {
      baseRef.current = idbVault();
      if (!folderLinkSupported()) setFolderMode("unsupported");
      else {
        const remembered = await loadFolderHandle();
        if (remembered) {
          const permission = await folderPermission(remembered);
          if (permission === "granted") {
            folderRef.current = remembered;
            setFolderName(remembered.name);
            setFolderMode("on");
            await readFolder(remembered, baseRef.current).catch(error => { folderRef.current = null; setFolderMode("ask"); setNotice(error.message); });
          } else setFolderMode(permission === "denied" ? "off" : "ask");
        }
      }
      if (!targetProjectApplied.current) {
        targetProjectApplied.current = true;
        const target = params.get("project");
        if (target) {
          const existing = await loadStudio(store());
          if (existing.projects.some(project => project.slug === target)) await chooseProject(store(), target);
          else setNotice(t("safety.projectMissing"));
        }
      }
      const next = await reload();
      if (gone) return;
      const targetAsset = new URLSearchParams(window.location.search).get("asset");
      if (targetAsset && (!params.get("project") || params.get("project") === next.project)) {
        const vault = store();
        const entries = await vault.list();
        const paths = entries.map(entry => entry.path);
        const assets = await importNotes(async path => (await vault.get(path))?.text, paths, next.project);
        const take = next.takes.find(item => item.id === targetAsset);
        const asset = assets.find(item => item.id === targetAsset) ?? looseAssets(paths, next.project).find(item => item.id === targetAsset);
        if (gone) return;
        const source = take?.video ?? asset?.media;
        if (source) {
          setPendingClip({ source, label: take?.line ?? asset?.name ?? targetAsset, kind: take || VIDEO.test(source) ? "video" : asset?.kind === "son" ? "audio" : "image", seconds: take?.settings.seconds });
          const url = new URL(window.location.href);
          url.searchParams.delete("asset"); // A reload must not append the same clip twice.
          window.history.replaceState(window.history.state, "", url);
        } else setNotice(t("safety.assetMissing"));
      }
      if (!cast && next.cast[0]) setPickedCast(next.cast[0].id);
      if (!decor && next.currentScene) setPickedDecor(next.currentScene);
      setReady(true);
      const flight = client ? readInFlight(localStorage) : null;
      if (flight) setNotice("Un rendu attend sa récupération. Ouvrez Crédits puis Récupérer le rendu.");
    })();
    return () => { gone = true; };
  }, [client, finish, reload]);

  useEffect(() => {
    setLineState(current => current.trim() ? current : t("take.defaultLine"));
  }, [t]);

  useEffect(() => {
    if (link.mode === "none") {
      setConnected(false);
      setBalance(null);
      return;
    }
    void refreshBalance();
  }, [link, refreshBalance]);

  const current = studio ?? {
    look: { name: "", traits: [], photos: [], note: "" },
    scenes: [], currentScene: null, takes: [], sequences: [], shots: [], loras: [], cast: [], clips: [], role: { name: "", photos: [] },
    quotes: [], project: null, projectName: "", projects: [], tree: [], memory: { bible: "", style: "", lexique: "", prompts: "", notes: [] },
  } as Studio;

  const cast = demoOn && current.cast.length === 0 ? DEMO_CAST : current.cast;
  const decor = demoOn && current.scenes.length === 0 ? DEMO_DECOR : current.scenes.map(decorFromScene);
  const [prefs, setPrefsState] = useState<StudioPrefs>(DEFAULT_PREFS);
  useEffect(() => { setPrefsState(readPrefs(localStorage)); }, []);
  const setPrefs = useCallback((next: Partial<StudioPrefs>) => {
    setPrefsState(prev => {
      const merged = { ...prev, ...next };
      savePrefs(localStorage, merged);
      return merged;
    });
  }, []);
  const defaultSettings = useMemo<TakeSettings>(() => ({ ...DEFAULT_TAKE, engine: prefs.engine }), [prefs.engine]);
  const settings = sheet === "confirm" && pendingTake ? pendingTake.settings : defaultSettings;
  const takeQuote = resolveTakeQuote(takeProfile(settings), quotesToRecords(current.quotes));
  const gate = priseGate(balance, takeQuote);

  const setLine = useCallback((next: string) => {
    const value = next.slice(0, 240);
    setLineState(value);
    try { localStorage.setItem(LINE_KEY, value); } catch {}
  }, []);

  const outgoing = useCallback(() => {
    if (pendingTake) return pendingTake.prompt;
    const who = cast.find(card => card.id === pickedCast) ?? null;
    const where = current.scenes.find(scene => scene.id === pickedDecor) ?? null;
    const photos = who && !who.id.startsWith("demo-") ? [...who.photos, ...(who.sheet ? [who.sheet] : [])].filter(Boolean) : current.look.photos;
    const paths = referencePaths(photos, where);
    if (paths.length === 0) return "";
    const lookCount = Math.min(photos.length, paths.length);
    return takePrompt({
      traits: current.look.traits,
      lookPictures: lookCount,
      place: where ? { name: where.name, note: where.prompt || where.note, pictures: Math.max(0, paths.length - lookCount) } : null,
      line: line.trim() || t("take.defaultLine"),
    });
  }, [cast, current.look.photos, current.look.traits, current.scenes, line, pickedCast, pickedDecor, pendingTake, t]);

  const createCast = useCallback(async (input: { name: string; prompt: string; source: "texte" | "photos"; files: File[]; confirmed: boolean; geste?: string }) => {
    const row = input.geste ? gesteParId(input.geste) : null;
    const opened = !row || (gesteOuvert(row) && row.still !== "prise" && row.onglet === "cast");
    const quote = row && row.credits !== null && row.high !== null
      ? { credits: row.credits, high: row.high, template: row.template }
      : quoteForCast(input.source);
    if (!spendAllowed(quote.credits, input.confirmed)) return false;
    if (!opened || (input.geste && !row)) {
      setNotice(t("gestes.unwired"));
      return false;
    }
    if ((row && !gesteVisible(row, prefs)) || (prefs.openWeightsOnly && templatePartenaire(quote.template))) {
      setNotice(t("safety.modelBlocked"));
      return false;
    }
    if (!client) {
      setNotice(t("create.needLink"));
      return false;
    }
    const name = cleanCardName(input.name);
    if (!name) return false;
    if (!row && input.source === "photos" && (input.files.length < 2 || input.files.length > 3)) return false;
    if (row && (input.files.length < row.minRefs || input.files.length > Math.max(3, row.slots.length))) return false;
    if ((!row && input.source === "texte" || row?.still === "texte-cast") && !input.prompt.trim()) return false;
    const fresh = await refreshBalance();
    if (!creationAllowed(true, fresh?.credits ?? null, quote.high)) {
      setNotice(t("create.needCeiling"));
      return false;
    }
    const slug = await ensureActiveProject(store());
    const vault = projectVault(store(), slug);
    const held = studioRef.current ?? await loadStudio(vault);
    const id = uniqueId(slugify(name), held.cast.map(card => card.id));
    const kind = row?.still === "photo-cast" || row?.still === "planche" || row?.still === "texte-cast"
      ? row.still
      : input.source === "photos" ? "planche" : "texte-cast";
    const sent = [input.prompt.trim(), row?.consigne ?? ""].filter(Boolean).join("\n\n");
    setCreating(true);
    try {
      const refs: string[] = [];
      for (const [index, file] of input.files.slice(0, row ? Math.max(3, row.slots.length) : 3).entries()) {
        const path = projectPath(slug, `Cast/${id}-p${index + 1}.${extensionFor(file.type)}`);
        await writeBlob(vault, path, file);
        refs.push(path);
      }
      const receipt: PendingRender = { version: 1, kind: "cast", project: slug, id, name, prompt: input.prompt.trim(), at: new Date().toISOString(), account: await fingerprint(), refs, template: quote.template, quote: quote.credits, balanceBefore: fresh?.credits ?? 0, jobId: null };
      const result = await runStill(recoverableClient(client, localStorage, receipt), {
        kind,
        template: quote.template,
        prompt: sent,
        pictures: input.files.slice(0, row ? Math.max(3, row.slots.length) : 3).map((file, index) => ({ blob: file, name: `uttu-${index + 1}.jpg` })),
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
        clientId: crypto.randomUUID(),
        balanceBefore: fresh?.credits ?? 0,
      });
      const photos = refs;
      const sheet = `Projets/${slug}/Cast/${id}.png`;
      await writeBlob(vault, sheet, result.image);
      const at = new Date().toISOString();
      await writeText(vault, `Projets/${slug}/Cast/${id}.md`, castNote({
        id, name, at, prompt: input.prompt.trim(), source: input.source, photos, sheet,
        template: quote.template, quote: quote.credits, cost: result.costCredits, project: slug, geste: row?.id ?? "",
      }));
      await writeLook(vault, { ...held.look, name, photos: [sheet, ...photos].slice(0, 3) });
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
      clearPending(localStorage, result.jobId);
      await reload();
      setPickedCast(id);
      setNotice(t("create.filed"));
      return true;
    } catch (error) {
      const failure = error instanceof RenderError ? error : new RenderError("failed", error instanceof Error ? error.message : t("create.failed"));
      setNotice(failure.message || t("create.failed"));
      return false;
    } finally {
      setCreating(false);
    }
  }, [client, fingerprint, prefs, refreshBalance, reload, store, t]);

  const createDecor = useCallback(async (input: { name: string; prompt: string; source: "texte" | "photo"; file: File | null; files?: File[]; confirmed: boolean; geste?: string }) => {
    const row = input.geste ? gesteParId(input.geste) : null;
    const opened = !row || (gesteOuvert(row) && row.onglet === "decor");
    const pictures = (input.files && input.files.length > 0 ? input.files : input.file ? [input.file] : []).slice(0, 3);
    const quote = row && row.credits !== null && row.high !== null
      ? { credits: row.credits, high: row.high, template: row.template }
      : quoteForDecor(input.source);
    if (!spendAllowed(quote.credits, input.confirmed)) return false;
    if (!opened || (input.geste && !row)) {
      setNotice(t("gestes.unwired"));
      return false;
    }
    if ((row && !gesteVisible(row, prefs)) || (prefs.openWeightsOnly && templatePartenaire(quote.template))) {
      setNotice(t("safety.modelBlocked"));
      return false;
    }
    if (!client) {
      setNotice(t("create.needLink"));
      return false;
    }
    const name = cleanCardName(input.name);
    if (!name) return false;
    if ((!row && input.source === "texte" || row?.still === "texte-decor") && !input.prompt.trim()) return false;
    if (row && pictures.length < row.minRefs) return false;
    if (!row && input.source === "photo" && pictures.length === 0) return false;
    const fresh = await refreshBalance();
    if (!creationAllowed(true, fresh?.credits ?? null, quote.high)) {
      setNotice(t("create.needCeiling"));
      return false;
    }
    const slug = await ensureActiveProject(store());
    const vault = projectVault(store(), slug);
    const held = studioRef.current ?? await loadStudio(vault);
    const id = uniqueId(slugify(name), held.scenes.map(scene => scene.id));
    const kind = row?.still === "photo-decor" || row?.still === "texte-decor"
      ? row.still
      : input.source === "photo" ? "photo-decor" : "texte-decor";
    const sent = [input.prompt.trim(), row?.consigne ?? ""].filter(Boolean).join("\n\n");
    setCreating(true);
    try {
      const refs: string[] = [];
      for (const [index, file] of pictures.entries()) {
        const path = projectPath(slug, `Decors/${id}-p${index + 1}.${extensionFor(file.type)}`);
        await writeBlob(vault, path, file);
        refs.push(path);
      }
      const receipt: PendingRender = { version: 1, kind: "decor", project: slug, id, name, prompt: input.prompt.trim(), at: new Date().toISOString(), account: await fingerprint(), refs, template: quote.template, quote: quote.credits, balanceBefore: fresh?.credits ?? 0, jobId: null };
      const result = await runStill(recoverableClient(client, localStorage, receipt), {
        kind,
        template: quote.template,
        prompt: sent,
        pictures: pictures.map((file, index) => ({ blob: file, name: `uttu-lieu-${index + 1}.jpg` })),
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
        clientId: crypto.randomUUID(),
        balanceBefore: fresh?.credits ?? 0,
      });
      const sheet = `Projets/${slug}/Decors/${id}.png`;
      await writeBlob(vault, sheet, result.image);
      const scene: Scene = {
        ...emptySceneDraft(),
        id, name, note: input.prompt.trim(), stills: [sheet], render: sheet,
        prompt: input.prompt.trim(), template: quote.template, devis: quote.credits, cout: result.costCredits, home: "Decors", source: input.source,
        geste: row?.id,
      };
      await writeScene(vault, scene);
      await writeState(vault, id);
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
      clearPending(localStorage, result.jobId);
      await reload();
      setPickedDecor(id);
      setNotice(t("create.filed"));
      return true;
    } catch (error) {
      const failure = error instanceof RenderError ? error : new RenderError("failed", error instanceof Error ? error.message : t("create.failed"));
      setNotice(failure.message || t("create.failed"));
      return false;
    } finally {
      setCreating(false);
    }
  }, [client, fingerprint, prefs, refreshBalance, reload, store, t]);

  const createStem = useCallback(async (input: { geste: string; text: string; confirmed: boolean }) => {
    const row = gesteParId(input.geste);
    const text = input.text.trim();
    const quote = row?.id === "mont-voix" ? voiceQuote(text.length)
      : row?.id === "mont-effet" ? sfxQuote(SFX_DEFAULT_SECONDS)
      : row?.id === "mont-musique" ? musicQuote()
      : null;
    const kind: StemKind | null = row?.still === "voix" || row?.still === "effet" || row?.still === "musique" ? row.still : null;
    if (!row || row.onglet !== "montage" || !gesteOuvert(row) || !kind || !quote) {
      setNotice(t(row?.raison ?? "gestes.unwired"));
      return null;
    }
    if (!text || !spendAllowed(quote.credits, input.confirmed)) return null;
    if (!gesteVisible(row, prefs)) { setNotice(t("safety.modelBlocked")); return null; }
    if (!client) {
      setNotice(t("create.needLink"));
      return null;
    }
    const fresh = await refreshBalance();
    if (!creationAllowed(true, fresh?.credits ?? null, quote.high)) {
      setNotice(t("create.needCeiling"));
      return null;
    }
    setCreating(true);
    try {
      const slug = await ensureActiveProject(store());
      const vault = projectVault(store(), slug);
      const id = `son-${crypto.randomUUID()}`;
      const receipt: PendingRender = { version: 1, kind: "son", project: slug, id, name: t(row.clef), prompt: text, at: new Date().toISOString(), account: await fingerprint(), refs: [], template: row.template, quote: quote.credits, balanceBefore: fresh?.credits ?? 0, jobId: null };
      const result = await runStem(recoverableClient(client, localStorage, receipt), {
        kind,
        text,
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
        clientId: crypto.randomUUID(),
        balanceBefore: fresh?.credits ?? 0,
      });
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
      const paths = assetPaths(slug, "son", id, "mp3");
      await writeBlob(vault, paths.media, result.audio);
      await writeText(vault, paths.note, assetNote({ id, kind: "son", name: receipt.name, at: receipt.at, prompt: text, geste: input.geste, template: row.template, refs: [], devis: quote.credits, cout: result.costCredits, media: paths.media, note: paths.note, preview: null, loose: false }));
      clearPending(localStorage, result.jobId);
      await reload();
      return new File([result.audio], result.filename, { type: result.audio.type || "audio/mpeg" });
    } catch (error) {
      const failure = error instanceof RenderError ? error : new RenderError("failed", error instanceof Error ? error.message : t("create.failed"));
      setNotice(failure.message || t("create.failed"));
      return null;
    } finally {
      setCreating(false);
    }
  }, [client, fingerprint, prefs, refreshBalance, reload, store, t]);

  // Finaliser : une passe sur le montage entier. Jamais d'annulation : le job va au bout.
  const finaliseMontage = useCallback(async (input: FinaliseInput): Promise<FinaliseOutcome> => {
    if (prefs.openWeightsOnly) return { ok: false, message: t("safety.finalBlocked") };
    const quote = finalQuote(input.seconds, input.choice);
    if (!quote || !spendAllowed(quote.credits, input.confirmed)) return { ok: false, message: t("finaliser.noQuote") };
    if (!client) return { ok: false, message: t("create.needLink") };
    const fresh = await refreshBalance();
    if (!creationAllowed(true, fresh?.credits ?? null, quote.ceiling)) return { ok: false, message: t("create.needCeiling") };
    setCreating(true);
    try {
      const slug = input.project;
      const vault = projectVault(store(), slug);
      const at = new Date().toISOString();
      const id = `${finalFileId(input.name, input.choice.resolution, new Date(at))}-${crypto.randomUUID().slice(0, 8)}`;
      const receipt: PendingRender = { version: 1, kind: "final", project: slug, id, name: `${input.name} — final ${input.choice.resolution}`, prompt: JSON.stringify({ seconds: input.seconds, ratio: input.ratio, choice: input.choice }), at, account: await fingerprint(), refs: [], template: "RTXVideoSuperResolution", quote: quote.credits, balanceBefore: fresh!.credits, jobId: null };
      input.onStage("envoi");
      const file = await client.upload(input.video, "uttu-montage.mp4");
      const graph = finalGraph({ file, ratio: input.ratio, ...input.choice });
      const jobId = await recoverableClient(client, localStorage, receipt).submit(graph, crypto.randomUUID());
      const result = await followTake(client, jobId, fresh?.credits ?? 0, event => {
        if (event.stage === "queue" || event.stage === "prepare") input.onStage("file");
        else if (event.stage === "render") input.onStage("calcul", event.seconds);
        else if (event.stage === "fetch") input.onStage("retour");
        else if (event.stage === "measure") input.onStage("mesure");
      });
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
      const path = `Projets/${slug}/Assets/${id}.mp4`;
      await writeBlob(vault, path, result.video);
      await writeText(vault, `Projets/${slug}/Assets/${id}.md`, assetNote({ id, kind: "plan", name: receipt.name, at, prompt: receipt.prompt, geste: "mont-final", template: receipt.template, refs: [], devis: quote.credits, cout: result.costCredits, media: path, note: `Projets/${slug}/Assets/${id}.md`, preview: null, loose: false }));
      clearPending(localStorage, jobId);
      await reload();
      return { ok: true, path, url: URL.createObjectURL(result.video), cost: result.costCredits };
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t("create.failed");
      return { ok: false, message };
    } finally {
      setCreating(false);
    }
  }, [client, fingerprint, prefs, refreshBalance, reload, store, t]);

  // Gestes vidéo de PRISE. Devis estimé, confirmé, plafond couvert par le solde. Jamais d'annulation.
  const runVideoGeste = useCallback(async (input: VideoGesteRun): Promise<FinaliseOutcome> => {
    const row = gesteParId(input.geste);
    if (!row || row.still !== "video" || !gesteOuvert(row) || !isVideoGeste(row.id) || row.credits === null || row.high === null) {
      return { ok: false, message: t(row?.raison ?? "gestes.unwired") };
    }
    const geste = row.id;
    if (!gesteVisible(row, prefs)) return { ok: false, message: t("safety.modelBlocked") };
    if (!spendAllowed(row.credits, input.confirmed)) return { ok: false, message: t("finaliser.noQuote") };
    if (VIDEO_GESTE_TEXT[geste] && !input.prompt.trim()) return { ok: false, message: t("videoGeste.needText") };
    if (row.slots.some(slot => !input.files[slot.slot])) return { ok: false, message: t("videoGeste.needFiles") };
    if (!client) return { ok: false, message: t("create.needLink") };
    const fresh = await refreshBalance();
    if (!creationAllowed(true, fresh?.credits ?? null, row.high)) return { ok: false, message: t("create.needCeiling") };
    setCreating(true);
    try {
      const slug = await ensureActiveProject(store());
      const vault = projectVault(store(), slug);
      const at = new Date().toISOString();
      const id = `${geste}-${crypto.randomUUID()}`;
      const refs: string[] = [];
      input.onStage("envoi");
      const names: Record<string, string> = {};
      for (const slot of row.slots) {
        const file = input.files[slot.slot];
        const ext = extensionFor(file.type);
        const path = `Projets/${slug}/Assets/${id}-${slot.slot}.${ext}`;
        await writeBlob(vault, path, file);
        refs.push(path);
        names[slot.slot] = await client.upload(file, `${id}-${slot.slot}.${ext}`);
      }
      const graph = videoGesteGraph({ geste, files: names, prompt: input.prompt, aspect: input.aspect, seed: crypto.getRandomValues(new Uint32Array(1))[0] });
      const receipt: PendingRender = { version: 1, kind: "video", geste, project: slug, id, name: t(`gestes.${row.clef}.title`), prompt: input.prompt, at, account: await fingerprint(), refs, template: row.template, quote: row.credits, balanceBefore: fresh!.credits, jobId: null };
      const jobId = await recoverableClient(client, localStorage, receipt).submit(graph, crypto.randomUUID());
      const result = await followTake(client, jobId, fresh?.credits ?? 0, event => {
        if (event.stage === "queue" || event.stage === "prepare") input.onStage("file");
        else if (event.stage === "render") input.onStage("calcul", event.seconds);
        else if (event.stage === "fetch") input.onStage("retour");
        else if (event.stage === "measure") input.onStage("mesure");
      });
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
      const path = `Projets/${slug}/Assets/${id}.mp4`;
      await writeBlob(vault, path, result.video);
      await writeText(vault, `Projets/${slug}/Assets/${id}.md`, assetNote({ id, kind: "plan", name: receipt.name, at, prompt: input.prompt, geste, template: row.template, refs, devis: row.credits, cout: result.costCredits, media: path, note: `Projets/${slug}/Assets/${id}.md`, preview: null, loose: false }));
      clearPending(localStorage, jobId);
      await reload();
      return { ok: true, path, url: URL.createObjectURL(result.video), cost: result.costCredits };
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t("create.failed");
      return { ok: false, message };
    } finally {
      setCreating(false);
    }
  }, [client, fingerprint, prefs, refreshBalance, reload, store, t]);

  // « Générer en 3D » de la maquette. Même règle : devis estimé, confirmé, plafond couvert. Jamais d'annulation.
  const runMeshGeste = useCallback(async (input: MeshGesteRun): Promise<FinaliseOutcome> => {
    const row = gesteParId(input.geste);
    if (!row || row.still !== "mesh" || !gesteOuvert(row) || !isMeshGeste(row.id) || row.credits === null || row.high === null) {
      return { ok: false, message: t(row?.raison ?? "gestes.unwired") };
    }
    if (!gesteVisible(row, prefs)) return { ok: false, message: t("safety.modelBlocked") };
    if (!spendAllowed(row.credits, input.confirmed)) return { ok: false, message: t("finaliser.noQuote") };
    if (!client) return { ok: false, message: t("create.needLink") };
    const fresh = await refreshBalance();
    if (!creationAllowed(true, fresh?.credits ?? null, row.high)) return { ok: false, message: t("create.needCeiling") };
    setCreating(true);
    try {
      const slug = await ensureActiveProject(store());
      const vault = projectVault(store(), slug);
      const id = `${row.id}-${crypto.randomUUID()}`;
      const at = new Date().toISOString();
      const name = t(`gestes.${row.clef}.title`);
      const source = `Projets/${slug}/Assets/${id}-input.${extensionFor(input.file.type)}`;
      await writeBlob(vault, source, input.file);
      const refs = [source];
      const receipt: PendingRender = { version: 1, kind: "mesh", geste: row.id, project: slug, id, name, prompt: "", at, account: await fingerprint(), refs, template: row.template, quote: row.credits, balanceBefore: fresh!.credits, jobId: null };
      input.onStage("envoi");
      const ext = input.file.name.includes(".") ? input.file.name.slice(input.file.name.lastIndexOf(".")) : ".png";
      const image = await client.upload(input.file, `${id}${ext}`);
      const graph = meshGesteGraph({ geste: row.id, image, seed: crypto.getRandomValues(new Uint32Array(1))[0] });
      const result = await runMesh(recoverableClient(client, localStorage, receipt), { graph, clientId: crypto.randomUUID(), balanceBefore: fresh?.credits ?? 0 }, {
        onStage: (stage, seconds) => input.onStage(stage, seconds),
      });
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
      const path = `Projets/${slug}/Assets/${id}.glb`;
      await modelExtension(result.mesh, path);
      await writeBlob(vault, path, result.mesh);
      await writeText(vault, `Projets/${slug}/Assets/${id}.md`, assetNote({ id, kind: "importe", name, at, prompt: "", geste: row.id, template: row.template, refs, devis: row.credits, cout: result.costCredits, media: path, note: `Projets/${slug}/Assets/${id}.md`, preview: null, loose: false }));
      clearPending(localStorage, result.jobId);
      await reload();
      return { ok: true, path, url: URL.createObjectURL(result.mesh), cost: result.costCredits };
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t("create.failed");
      return { ok: false, message };
    } finally {
      setCreating(false);
    }
  }, [client, fingerprint, prefs, refreshBalance, reload, store, t]);

  const rewriteCast = useCallback(async (cards: CastCard[]) => {
    const vault = store();
    const slug = current.project ?? await ensureActiveProject(vault);
    for (const card of cards) {
      await writeText(vault, `Projets/${slug}/Cast/${card.id}.md`, castNote({
        id: card.id, name: card.name, at: card.at, prompt: card.prompt, source: card.source, photos: card.photos, sheet: card.sheet,
        template: card.template, quote: card.quote, cost: card.cost, project: slug,
      }));
    }
    await reload();
  }, [current.project, reload, store]);

  const renameCast = useCallback(async (id: string, name: string) => {
    await rewriteCast(renameById(current.cast, id, name));
  }, [current.cast, rewriteCast]);

  const duplicateCast = useCallback(async (id: string) => {
    const card = current.cast.find(item => item.id === id);
    if (!card) return;
    const vault = store();
    const slug = current.project ?? await ensureActiveProject(vault);
    const copy = copyCast(card, uniqueId(`${card.id}-copie`, current.cast.map(item => item.id)), new Date().toISOString());
    for (const path of [...card.photos, ...(card.sheet ? [card.sheet] : [])]) {
      const entry = await vault.get(path);
      if (!entry?.blob) continue;
      const leaf = path.split("/").pop() ?? "photo.jpg";
      const next = `Projets/${slug}/Cast/${copy.id}-${leaf}`;
      await writeBlob(vault, next, entry.blob);
      if (path === card.sheet) copy.sheet = next;
      else copy.photos = copy.photos.map(item => item === path ? next : item);
    }
    await writeText(vault, `Projets/${slug}/Cast/${copy.id}.md`, castNote({
      id: copy.id, name: copy.name, at: copy.at, prompt: copy.prompt, source: copy.source, photos: copy.photos, sheet: copy.sheet,
      template: copy.template, quote: copy.quote, cost: null, project: slug,
    }));
    await reload();
  }, [current.cast, current.project, reload, store]);

  const deleteCast = useCallback(async (id: string) => {
    const card = current.cast.find(item => item.id === id);
    if (!card || !current.project) return;
    const vault = store();
    await vault.remove(`Projets/${current.project}/Cast/${id}.md`);
    await removeUnreferenced(vault, [...card.photos, ...(card.sheet ? [card.sheet] : [])]);
    if (pickedCast === id) setPickedCast(null);
    await reload();
  }, [current.cast, current.project, pickedCast, reload, store]);

  const copyCastTo = useCallback(async (id: string, slug: string) => {
    const card = current.cast.find(item => item.id === id);
    if (!card || slug === current.project) return;
    const vault = store();
    const destination = await loadStudio(projectVault(vault, slug));
    const copy = copyCast(card, uniqueId(card.id, destination.cast.map(item => item.id)), new Date().toISOString());
    const photos: string[] = [];
    for (const path of card.photos) {
      const entry = await vault.get(path);
      if (!entry?.blob) continue;
      const next = `Projets/${slug}/Cast/${copy.id}-${path.split("/").pop()}`;
      await writeBlob(vault, next, entry.blob);
      photos.push(next);
    }
    await writeText(vault, `Projets/${slug}/Cast/${copy.id}.md`, castNote({
      id: copy.id, name: copy.name, at: copy.at, prompt: copy.prompt, source: copy.source, photos, sheet: photos[0] ?? null,
      template: copy.template, quote: copy.quote, cost: null, project: slug,
    }));
    setNotice(t("create.copied"));
  }, [current.cast, current.project, store, t]);

  const renameDecor = useCallback(async (id: string, name: string) => {
    const scene = current.scenes.find(item => item.id === id);
    const next = cleanCardName(name);
    if (!scene || !next) return;
    await writeScene(store(), { ...scene, name: next });
    await reload();
  }, [current.scenes, reload, store]);

  const duplicateDecor = useCallback(async (id: string) => {
    const scene = current.scenes.find(item => item.id === id);
    if (!scene) return;
    const vault = store();
    const slug = current.project ?? await ensureActiveProject(vault);
    const copyId = uniqueId(`${scene.id}-copie`, current.scenes.map(item => item.id));
    let render = scene.render;
    const stills: string[] = [];
    for (const path of scene.stills) {
      const entry = await vault.get(path);
      if (!entry?.blob) continue;
      const next = `Projets/${slug}/Decors/${copyId}-${path.split("/").pop()}`;
      await writeBlob(vault, next, entry.blob);
      stills.push(next);
      if (path === scene.render) render = next;
    }
    await writeScene(vault, { ...scene, id: copyId, name: cleanCardName(`${scene.name} copie`) || scene.name, stills, render, home: "Decors", cout: null });
    await reload();
  }, [current.project, current.scenes, reload, store]);

  const deleteDecor = useCallback(async (id: string) => {
    const scene = current.scenes.find(item => item.id === id);
    if (!scene) return;
    await removeScene(store(), scene);
    if (pickedDecor === id) setPickedDecor(null);
    await reload();
  }, [current.scenes, pickedDecor, reload, store]);

  const pickCast = useCallback(async (id: string) => {
    setPickedCast(id);
    const card = current.cast.find(item => item.id === id);
    if (!card) return;
    const photos = [...card.photos, ...(card.sheet && !card.photos.includes(card.sheet) ? [card.sheet] : [])].slice(0, 3);
    await writeLook(store(), { ...current.look, name: card.name, photos: photos.length ? photos : current.look.photos });
    await reload();
    setPickedCast(id);
  }, [current.cast, current.look, reload, store]);

  const pickDecor = useCallback(async (id: string) => {
    setPickedDecor(id);
    if (current.scenes.some(scene => scene.id === id)) await writeState(store(), id);
  }, [current.scenes, store]);

  const requestRun = useCallback(async (input?: TakeRequest) => {
    if (input) setPendingTake(structuredClone(input));
    if (!client || !connected) {
      setSheet("connect");
      return;
    }
    await refreshBalance();
    setSheet("confirm");
  }, [client, connected, refreshBalance]);

  const confirmRun = useCallback(async () => {
    if (run.phase === "running") return;
    if (!client) {
      setSheet("connect");
      return;
    }
    const fresh = await refreshBalance();
    const freshQuote = resolveTakeQuote(takeProfile(settings), quotesToRecords(studioRef.current?.quotes ?? []));
    const freshGate = priseGate(fresh, freshQuote);
    if (!fresh || !freshGate.allowed || !freshGate.line.trim()) {
      setNotice(freshGate.line || t("stage.noQuote"));
      return;
    }
    const held = studioRef.current;
    const place = held?.scenes.find(item => item.id === (pendingTake ? pendingTake.decorId : pickedDecor)) ?? null;
    if (pendingTake?.decorId && !place) { setNotice("Le décor choisi n’est pas enregistré dans ce projet. Enregistrez-le dans DÉCOR avant de générer."); return; }
    const selected = pendingTake ? pendingTake.castIds.flatMap(id => held?.cast.find(item => item.id === id) ? [held.cast.find(item => item.id === id)!] : []) : held?.cast.filter(item => item.id === pickedCast) ?? [];
    if (pendingTake && selected.length !== pendingTake.castIds.length) { setNotice("Chaque personnage doit avoir une référence enregistrée. Retirez les silhouettes neutres avant de générer."); return; }
    const photos = selected.length ? selected.flatMap(who => who.sheet ? [who.sheet] : who.photos.slice(0, 1)) : (pendingTake ? [] : held?.look.photos ?? []);
    const paths = referencePaths(photos, place, Infinity);
    if (paths.length > referenceLimit(settings)) { setNotice(t("safety.referencesMax", { max: referenceLimit(settings) })); return; }
    const prompt = outgoing();
    if (!prompt.trim()) {
      setNotice(t("create.noPicture"));
      return;
    }
    const slug = await ensureActiveProject(store());
    const vault = projectVault(store(), slug);
    const pictures: { blob: Blob; name: string }[] = [];
    for (const path of paths) {
      const entry = await vault.get(path);
      if (!entry?.blob) {
        setSheet(null);
        setRun({ phase: "error", code: "invalid", message: t("create.noPicture"), detail: [] });
        return;
      }
      pictures.push({ blob: entry.blob, name: pictureName(pictures.length) });
    }
    if (pictures.length === 0) {
      setNotice(t("create.noPicture"));
      return;
    }
    setSheet(null);
    setRun({ phase: "running", event: { stage: "start" } });
    abort.current = new AbortController();
    try {
      const at = new Date().toISOString();
      const flightData: Omit<InFlight, "jobId"> = { at, project: slug, planId: pendingTake?.planId, sceneId: place?.id ?? null, sceneName: place?.name ?? "", line: pendingTake?.line ?? line, prompt, settings, balanceBefore: fresh.credits };
      const receipt: PendingRender = { version: 1, kind: "take", project: slug, id: takeId(new Date(at), place?.name || "prise"), name: flightData.line, prompt, at, account: await fingerprint(), refs: referencePaths(photos, place), template: takeProfile(settings), quote: freshQuote.source === "balance" ? freshQuote.credits : freshQuote.source === "billed" ? freshQuote.measure.credits : 0, balanceBefore: fresh.credits, jobId: null, flight: flightData };
      const jobId = await submitTake(recoverableClient(client, localStorage, receipt), {
        pictures, prompt, settings, seed: crypto.getRandomValues(new Uint32Array(1))[0], clientId: crypto.randomUUID(),
      }, event => setRun({ phase: "running", event }), abort.current.signal);
      const flight: InFlight = { ...flightData, jobId };
      saveInFlight(localStorage, flight);
      await finish(flight, client);
    } catch (error) {
      const failure = error instanceof RenderError ? error : new RenderError("failed", error instanceof Error ? error.message : "La prise n’a pas abouti.");
      setRun({ phase: "error", code: failure.code, message: failure.message, detail: failure.detail });
      abort.current = null;
    }
  }, [client, fingerprint, finish, line, outgoing, pendingTake, pickedCast, pickedDecor, refreshBalance, run.phase, settings, store, t]);

  const cancelRun = useCallback(() => {
    abort.current?.abort();
  }, []);

  const resetRun = useCallback(() => setRun({ phase: "idle" }), []);

  const identifyPendingJob = useCallback(async (jobId: string, confirmed: boolean): Promise<string | null> => {
    if (!client) return t("create.needLink");
    if (paidBusy.current || !navigator.locks) return t("recovery.busy");
    paidBusy.current = true;
    setCreating(true);
    try {
      await navigator.locks.request("uttu-paid-render", { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("recovery.busy");
        await bindPendingJob(localStorage, client, await fingerprint(), jobId, confirmed);
      });
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "recovery.failed";
      return message.startsWith("recovery.") ? t(message) : message;
    } finally { paidBusy.current = false; setCreating(false); }
  }, [client, fingerprint, t]);

  const resumeRun = useCallback(() => {
    if (!client || paidBusy.current || following.current) return;
    paidBusy.current = true;
    setCreating(true);
    void (async () => {
      const recover = async () => {
        const receipt = readPending(localStorage);
        const legacy = readInFlight(localStorage);
        if (!receipt) {
          if (legacy) await finish(legacy, client);
          else setNotice("Aucun rendu en attente sur cet appareil.");
          return;
        }
        if (receipt.account !== await fingerprint()) throw new Error("Reconnectez le compte qui a envoyé ce rendu pour le récupérer.");
        if (!receipt.jobId) throw new Error("L’envoi a été interrompu sans reçu. Il peut avoir été facturé. Vérifiez l’historique Comfy avant toute nouvelle génération ; ne supprimez pas les données de ce navigateur.");
        const stage = jobStage(await client.status(receipt.jobId));
        const vault = projectVault(store(), receipt.project);
        if (stage === "failed" || stage === "cancelled") {
          await writeText(vault, projectPath(receipt.project, `.uttu/${receipt.id}.json`), JSON.stringify({ ...receipt, account: undefined, terminal: stage }));
          clearPending(localStorage, receipt.jobId);
          if (legacy?.jobId === receipt.jobId) saveInFlight(localStorage, null);
          setNotice("Le cloud confirme que ce rendu est terminé sans résultat. Vous pouvez préparer un nouvel envoi avec confirmation.");
          return;
        }
        if (receipt.kind === "take" && receipt.flight) {
          await finish({ ...receipt.flight, jobId: receipt.jobId }, client);
          return;
        }
        if (stage !== "done") { setNotice("Le cloud travaille encore. Réessayez Récupérer le rendu dans quelques instants. Aucun nouvel envoi."); return; }
        const detail = await client.job(receipt.jobId);
        const isVideo = receipt.kind === "final" || receipt.kind === "video";
        const ref = receipt.kind === "mesh" ? meshOutput(detail.outputs) : receipt.kind === "son" ? audioOutput(detail.outputs) : isVideo ? videoOutput(detail.outputs) : stillOutput(detail.outputs);
        if (!ref) throw new Error("Le cloud annonce la fin mais le fichier manque. Le reçu est conservé.");
        const blob = await client.file(ref);
        if (receipt.kind === "mesh") await modelExtension(blob, ref.filename);
        const ext = ref.filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || (receipt.kind === "son" ? "mp3" : "png");
        const kind = receipt.kind === "cast" ? "personnage" : receipt.kind === "decor" ? "decor" : isVideo ? "plan" : receipt.kind === "mesh" ? "importe" : "son";
        const paths = isVideo ? { media: `Projets/${receipt.project}/Assets/${receipt.id}.${ext}`, note: `Projets/${receipt.project}/Assets/${receipt.id}.md` } : assetPaths(receipt.project, kind, receipt.id, ext);
        await writeBlob(vault, paths.media, blob);
        if (receipt.kind === "cast") {
          await writeText(vault, paths.note, castNote({ id: receipt.id, name: receipt.name, at: receipt.at, prompt: receipt.prompt, source: receipt.refs.length ? "photos" : "texte", photos: receipt.refs, sheet: paths.media, template: receipt.template, quote: receipt.quote, cost: null, project: receipt.project }));
        } else if (receipt.kind === "decor") {
          await writeScene(vault, { ...emptySceneDraft(), id: receipt.id, name: receipt.name, note: receipt.prompt, prompt: receipt.prompt, render: paths.media, stills: [paths.media], views: receipt.refs, home: "Decors", template: receipt.template, devis: receipt.quote, cout: null });
        } else {
          await writeText(vault, paths.note, assetNote({ id: receipt.id, kind: isVideo ? "plan" : receipt.kind === "mesh" ? "importe" : "son", name: receipt.name, at: receipt.at, prompt: receipt.prompt, geste: receipt.geste ?? "", template: receipt.template, refs: receipt.refs, devis: receipt.quote, cout: null, media: paths.media, note: paths.note, preview: null, loose: false }));
        }
        clearPending(localStorage, receipt.jobId);
        await reload();
        setNotice("Rendu récupéré dans son projet d’origine. Le coût reste à vérifier dans votre compte.");
      };
      if (!navigator.locks) throw new Error("La récupération nécessite un navigateur récent.");
      await navigator.locks.request("uttu-paid-render", { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Un autre onglet suit déjà un rendu.");
        await recover();
      });
    })().catch(error => setNotice(error instanceof Error ? error.message : "Récupération impossible pour le moment.")).finally(() => { paidBusy.current = false; setCreating(false); });
  }, [client, fingerprint, finish, reload, store]);

  useEffect(() => {
    if (!ready || !client) return;
    try { if (readPending(localStorage) || readInFlight(localStorage)) resumeRun(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Reçu illisible."); }
  }, [ready, client, resumeRun]);

  const connectKey = useCallback(async (raw: string) => {
    const key = cleanApiKey(raw);
    if (!key) return t("sheet.keyInvalid");
    const candidate = createRenderClient({ auth: { kind: "key", key } });
    try {
      await candidate.user();
    } catch (error) {
      return error instanceof Error ? error.message : t("sheet.keyInvalid");
    }
    const next: RenderLink = { mode: "key", key };
    saveRenderLink(localStorage, next);
    setLink(next);
    setConnected(true);
    setSheet(null);
    return null;
  }, [t]);

  const sessionLinked = useCallback(async () => {
    const ok = await tokens.connected();
    if (!ok) return false;
    const next: RenderLink = { mode: "session" };
    saveRenderLink(localStorage, next);
    setLink(next);
    setConnected(true);
    setSheet(null);
    return true;
  }, [tokens]);

  const disconnect = useCallback(async () => {
    saveRenderLink(localStorage, { mode: "none" });
    await tokens.forget();
    setLink({ mode: "none" });
    setConnected(false);
    setBalance(null);
  }, [tokens]);

  const poseTake = useCallback(async (id: string, names: { sequence: string; shot: string }) => {
    const held = studioRef.current;
    if (!held?.takes.some(item => item.id === id)) return;
    const plan = posePlan(id, held.sequences, held.shots, names);
    if (!plan) return;
    const vault = store();
    let sequenceId = plan.openSequenceId;
    if (plan.createSequence) {
      sequenceId = uniqueId(sequenceStem(plan.createSequence), held.sequences.map(item => item.id));
      await writeSequence(vault, { id: sequenceId, name: plan.createSequence, links: [{ takeId: id, raccord: "" }] }, held.takes);
    }
    if (plan.createShotName && sequenceId) {
      const shot: Shot = {
        id: uniqueId(shotStem(plan.createShotName), held.shots.map(item => item.id)),
        name: plan.createShotName, sequenceId, takeIds: [id], note: "", ordre: held.shots.length,
      };
      await writeShot(vault, shot, held.takes, plan.createSequence ?? "");
    }
    await reload();
    setNotice(t("sequence.created"));
  }, [reload, store, t]);

  const exportCoffre = useCallback(async () => {
    const data = await coffreZip(store());
    const bytes = data.slice().buffer;
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "U-TTU-Studio.zip";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, [store]);

  const importCoffre = useCallback(async (file: File) => {
    const report = await mergeCoffreZip(store(), new Uint8Array(await file.arrayBuffer()));
    await reload();
    setNotice(report.written === 0 ? t("runtime.zipEmpty") : t("create.imported", { count: report.written }));
  }, [reload, store, t]);

  const importFiles = useCallback(async (files: File[]) => {
    const vault = store();
    let written = 0;
    for (const file of files) {
      const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const parts = relative.split("/").filter(Boolean);
      if (parts[0] && !parts[0].startsWith("Projets") && parts.length > 1) parts.shift();
      const path = vaultPathFromZip(parts.join("/"));
      if (!path || await vault.get(path)) continue;
      if (PICTURE.test(file.name) || /\.(glb|gltf)$/i.test(file.name) || VIDEO.test(file.name) || /\.(wav|mp3|m4a|ogg)$/i.test(file.name)) await writeBlob(vault, path, file);
      else if (/\.(md|json|txt)$/i.test(file.name)) await writeText(vault, path, await file.text());
      else continue;
      written += 1;
    }
    await reload();
    setNotice(t("create.imported", { count: written }));
  }, [reload, store, t]);

  const attachFolder = useCallback(async (handle: DirectoryHandle) => {
    folderRef.current = null;
    try {
      const base = baseRef.current ?? idbVault();
      baseRef.current = base;
      await readFolder(handle, base);
      await mirrorAll(base, handle);
      await saveFolderHandle(handle);
      folderRef.current = handle;
      setFolderName(handle.name);
      setFolderMode("on");
      await reload();
    } catch (error) {
      setFolderMode("ask");
      setNotice(error instanceof Error ? error.message : "La synchronisation du dossier a échoué. Les données locales sont conservées.");
    }
  }, [reload]);

  const linkFolder = useCallback(async () => {
    if (!folderLinkSupported()) {
      setFolderMode("unsupported");
      return;
    }
    const picked = await pickFolder();
    if (!picked) return;
    await attachFolder(picked);
  }, [attachFolder]);

  const allowLinkedFolder = useCallback(async () => {
    const remembered = folderRef.current ?? await loadFolderHandle();
    if (!remembered) {
      await linkFolder();
      return;
    }
    const permission = await allowFolder(remembered);
    if (permission === "granted") await attachFolder(remembered);
    else setFolderMode("ask");
  }, [attachFolder, linkFolder]);

  const loadMontages = useCallback(async () => {
    const slug = studioRef.current?.project;
    if (!slug) return [];
    return readMontages(store(), slug);
  }, [store]);

  const saveMontage = useCallback(async (edit: Edit, files: Record<string, { blob: Blob; ext: string }>) => {
    const slug = studioRef.current?.project ?? await ensureActiveProject(store());
    const next = saves.current.catch(() => {}).then(async () => {
      const placed = await writeMontageEdit(projectVault(store(), slug), edit, files);
      await reload();
      return { edit: placed, slug };
    });
    saves.current = next;
    return next;
  }, [reload, store]);

  const selectProject = useCallback(async (slug: string) => {
    await chooseProject(store(), slug);
    const next = await reload();
    setPickedCast(next.cast[0]?.id ?? null);
    setPickedDecor(next.currentScene);
    setPendingTake(null);
    setSheet(null);
  }, [reload, store]);

  const importAssets = useCallback(async (files: File[], as?: "personnage" | "decor") => {
    try {
      const count = await importMedia(store(), files, as);
      await reload();
      if (count > 0) setNotice(t("create.imported", { count }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Import interrompu. Les fichiers déjà enregistrés sont conservés."); }
  }, [reload, store, t]);

  const refreshStudio = useCallback(async () => {
    await reload();
  }, [reload]);

  const copyDecorTo = useCallback(async (id: string, slug: string) => {
    const scene = current.scenes.find(item => item.id === id);
    if (!scene || slug === current.project) return;
    const vault = store();
    const destination = await loadStudio(projectVault(vault, slug));
    const copyId = uniqueId(scene.id, destination.scenes.map(item => item.id));
    const stills: string[] = [];
    for (const path of scene.stills) {
      const entry = await vault.get(path);
      if (!entry?.blob) continue;
      const next = `Projets/${slug}/Decors/${copyId}-${path.split("/").pop()}`;
      await writeBlob(vault, next, entry.blob);
      stills.push(next);
    }
    const copy: Scene = { ...scene, id: copyId, name: cleanCardName(`${scene.name} copie`) || scene.name, stills, render: stills[0] ?? null, home: "Decors", cout: null };
    await writeText(vault, `Projets/${slug}/Decors/${copyId}.md`, sceneMarkdown(copy, slug));
    setNotice(t("create.copied"));
  }, [current.project, current.scenes, store, t]);

  useEffect(() => {
    if (!demoOn || !ready) return;
    setPickedCast(prev => prev ?? DEMO_CAST[0]?.id ?? null);
    setPickedDecor(prev => prev ?? DEMO_DECOR[0]?.id ?? null);
  }, [demoOn, ready]);

  const saveModel = useCallback(async (file: File) => {
    const slug = current.project ?? await ensureActiveProject(store());
    const path = await importModel(projectVault(store(), slug), file);
    await reload();
    return path;
  }, [current.project, reload, store]);

  const readProjectFile = useCallback(async (file: string) => {
    const slug = current.project;
    if (!slug) return undefined;
    const entry = await store().get(projectPath(slug, file));
    return entry?.text;
  }, [current.project, store]);

  const writeProjectFile = useCallback(async (file: string, text: string) => {
    const slug = current.project ?? await ensureActiveProject(store());
    const next = saves.current.catch(() => {}).then(async () => {
      if (/^Shots\/[a-z0-9-]+\.md$/.test(file)) {
        const existing = readFrontmatter((await store().get(projectPath(slug, file)))?.text ?? "");
        const incoming = readFrontmatter(text);
        incoming.fields.prises = [...new Set([...list(existing.fields.prises), ...list(incoming.fields.prises)])];
        if (!incoming.fields.sequence && existing.fields.sequence) incoming.fields.sequence = existing.fields.sequence;
        text = withFrontmatter(incoming.fields, incoming.body);
      }
      await writeText(store(), projectPath(slug, file), text);
    });
    saves.current = next;
    await next;
  }, [current.project, store]);

  const saveShot = useCallback(async (shot: Shot) => {
    await writeShot(store(), shot, current.takes, "");
  }, [current.takes, store]);

  const saveLieu = useCallback(async (input: { name: string; note: string; quartier?: string }) => {
    const name = cleanCardName(input.name);
    if (!name) return null;
    const vault = store();
    const slug = await ensureActiveProject(vault);
    const held = studioRef.current ?? await loadStudio(vault);
    const note = input.note.slice(0, 500);
    const existing = held.scenes.find(scene => scene.geste === "repere" && scene.name.toLowerCase() === name.toLowerCase());
    const id = existing?.id ?? uniqueId(slugify(name), held.scenes.map(scene => scene.id));
    const scene: Scene = { ...(existing ?? emptySceneDraft()), id, name, note, prompt: note, home: "Lieux", geste: "repere" };
    await writeScene(vault, scene);
    if (input.quartier) await writeText(vault, projectPath(slug, `Lieux/${id}.quartier.json`), input.quartier);
    await writeState(vault, id);
    await reload();
    setPickedDecor(id);
    return id;
  }, [reload, store]);

  const saveLieuPhoto = useCallback(async (input: { name: string; note: string; quartier?: string; photo: { id: string; author: string; credit: string; blob: Blob } }) => {
    const sceneId = await saveLieu({ name: input.name, note: input.note, quartier: input.quartier });
    if (!sceneId || input.photo.blob.size < 32) return sceneId;
    const vault = store();
    const slug = await ensureActiveProject(vault);
    const safe = input.photo.id.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) || "photo";
    const ext = input.photo.blob.type.includes("jpeg") ? "jpg" : "png";
    const viewId = `${safe}-${crypto.randomUUID().slice(0, 8)}`;
    const path = projectPath(slug, `Lieux/${sceneId}-mly-${viewId}.${ext}`);
    await writeBlob(vault, path, input.photo.blob);
    const held = await loadStudio(vault);
    const scene = held.scenes.find(item => item.id === sceneId);
    if (scene) {
      const views = scene.views.includes(path) ? scene.views : [...scene.views, path].slice(-12);
      await writeScene(vault, { ...scene, views });
    }
    const assetId = (slugify(`${sceneId.slice(0, 12)}-${viewId}`) || `mly-${safe}`).slice(0, 40);
    const paths = assetPaths(slug, "importe", assetId, ext);
    const credit = input.photo.credit.replace(/\s+/g, " ").trim().slice(0, 1024);
    const card: AssetRecord = {
      id: assetId,
      kind: "importe",
      name: cleanCardName(credit) || assetId,
      at: new Date().toISOString(),
      prompt: credit,
      geste: "repere",
      template: "",
      refs: [path],
      devis: null,
      cout: null,
      media: path,
      note: paths.note,
      preview: null,
      loose: false,
    };
    await writeText(vault, paths.note, assetNote(card));
    await reload();
    setPickedDecor(sceneId);
    return sceneId;
  }, [reload, saveLieu, store]);

  const sendToMontage = useCallback(async (input: { takeId?: string; planId: string; label: string; seconds: number; aspect: "horizontal" | "vertical"; still: string; prompt: string; sceneName: string; composeur: string }) => {
    await saves.current;
    const slug = await ensureActiveProject(store());
    const vault = projectVault(store(), slug);
    const held = await loadStudio(vault);
    const planId = input.planId.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || "plan";
    const take = input.takeId ? held.takes.find(item => item.id === input.takeId) : null;
    if (input.takeId && !take) throw new Error("Cette prise n’est plus disponible dans le projet.");
    let source = take?.video ?? "";
    let clipId = take?.id ?? `storyboard-${crypto.randomUUID()}`;
    if (take) {
      if (!(await vault.get(take.video))?.blob) throw new Error("Le fichier de la prise manque. Récupérez-le avant le montage.");
    } else {
      if (!input.still) throw new Error("Choisissez une image enregistrée ou générez une prise avant le montage.");
      const response = await fetch(input.still.startsWith("/") ? assetPath(input.still) : input.still);
      if (!response.ok) throw new Error("Impossible de lire l’image. Rien n’a été ajouté au montage.");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/") || !blob.size) throw new Error("L’image de storyboard est illisible.");
      const paths = assetPaths(slug, "importe", clipId, extensionFor(blob.type));
      source = paths.media;
      await writeBlob(vault, source, blob);
      await writeText(vault, paths.note, assetNote({ id: clipId, kind: "importe", name: `Storyboard · ${input.label}`.slice(0, 80), at: new Date().toISOString(), prompt: input.prompt, geste: "storyboard", template: "", refs: [], devis: null, cout: 0, media: source, note: paths.note, preview: null, loose: false }));
    }
    const seconds = take?.settings.seconds ?? input.seconds;
    const previous = held.shots.find(shot => shot.id === planId);
    const sequence = held.sequences.find(item => item.id === previous?.sequenceId) ?? held.sequences[0] ?? { id: "suite", name: "Séquence", links: [] };
    if (take && !sequence.links.some(link => link.takeId === take.id)) sequence.links = [...sequence.links, { takeId: take.id, raccord: "" }];
    await writeSequence(vault, sequence, held.takes);
    await writeShot(vault, { id: planId, name: input.label.slice(0, 80) || planId, sequenceId: sequence.id, takeIds: [...new Set([...(previous?.takeIds ?? []), ...(take ? [take.id] : [])])], note: previous?.note ?? "", ordre: previous?.ordre ?? held.shots.length, composeur: input.composeur }, held.takes, sequence.name);
    const saved = await readMontages(vault, slug);
    const existing = saved.find(edit => edit.id === sequence.id);
    const base: Edit = existing ?? { id: sequence.id, name: sequence.name, video: [], audio: [] };
    if (!base.video.some(clip => clip.source === source)) {
      await writeMontageEdit(vault, placeStoryboard(base, { id: clipId, label: take ? take.line : `Storyboard · ${input.label}`, seconds, source }, demoOn && !existing), {});
    }
    await reload();
  }, [demoOn, reload, store]);

  const value: StudioSession = {
    prefs, setPrefs,
    ready, demo: demoOn, studio: current, media, cast, decor, pickedCast, pickedDecor, line, setLine, notice, setNotice, sheet, setSheet,
    connected, balance, balanceNote, takeQuote, gate, settings, run, creating, folderMode, folderName,
    pendingTake, requestRun, confirmRun: () => paid(confirmRun, undefined), cancelRun, resetRun, resumeRun, identifyPendingJob, refreshBalance, connectKey, sessionLinked, disconnect,
    loose, createCast: input => paid(() => createCast(input), false), createDecor: input => paid(() => createDecor(input), false), createStem: input => paid(() => createStem(input), null), finaliseMontage: input => paid(() => finaliseMontage(input), { ok: false, message: "Envoi refusé : vérifiez le message du studio et récupérez le rendu en attente." } as FinaliseOutcome), runVideoGeste: input => paid(() => runVideoGeste(input), { ok: false, message: t("recovery.failed") } as FinaliseOutcome), runMeshGeste: input => paid(() => runMeshGeste(input), { ok: false, message: t("recovery.failed") } as FinaliseOutcome), renameCast, renameDecor, duplicateCast, duplicateDecor, deleteCast, deleteDecor, copyCastTo,
    pickCast, pickDecor, poseTake, loadMontages, saveMontage, exportCoffre, importCoffre, importFiles, importAssets, refreshStudio,
    pendingRef, holdRef: setPendingRef, pendingClip, holdClip: setPendingClip, copyDecorTo,
    linkFolder, allowLinkedFolder, selectProject, outgoing,
    saveModel, readProjectFile, writeProjectFile, saveShot, saveLieu, saveLieuPhoto, sendToMontage,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
