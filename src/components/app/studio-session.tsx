"use client";

import { tracked } from "@/lib/tasks";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/components/i18n/provider";
import { orderSequence, placeStoryboard } from "@/lib/montage/arrivee";
import type { Edit } from "@/lib/montage/edit";
import { assetPath } from "@/lib/site";
import { assetNote, assetPaths, importNotes, looseAssets, type AssetRecord } from "@/lib/creation/assets";
import { importMedia } from "@/lib/creation/import-media";
import { promoteDemoRefs, type PromotedRef } from "@/lib/creation/promote-demo";
import type { ExempleRefSpec } from "@/lib/creation/exemple-galerie";
import { readFrontmatter, list, withFrontmatter } from "@/lib/coffre/markdown";
import { castNote } from "@/lib/creation/fiche";
import { runStem, type StemKind } from "@/lib/creation/stem";
import { SFX_DEFAULT_SECONDS, musicQuote, sfxQuote, voiceQuote } from "@/lib/montage/quotes";
import { gesteOuvert, gesteParId, gesteVisible, templatePartenaire, type RoleRef } from "@/lib/workflows/registre";
import { captureFiles } from "@/lib/repere3d/capture";
import { cleanCardName, copyCast, decorFromScene, renameById, type CastCard, type DecorCard } from "@/lib/creation/gallery";
import { creationAllowed, quoteForCast, quoteForDecor, spendAllowed } from "@/lib/creation/quotes";
import { stillOutput, runStill } from "@/lib/creation/still";
import { cadreQuote } from "@/lib/creation/decor-cadre";
import { KLEIN_REFS_MAX } from "@/lib/render/klein-graph";
import { DEMO_CAST, DEMO_DECOR } from "@/lib/creation/demo";
import { coffreZip } from "@/lib/coffre/export";
import { mergeCoffreZip, vaultPathFromZip } from "@/lib/coffre/import";
import { folderLinkSupported, linkedStore, mirrorAll, pickFolder, type DirectoryHandle } from "@/lib/coffre/link";
import {
  emptySceneDraft, ensureActiveProject, extensionFor, loadStudio, removeScene, removeTake, sceneMarkdown, selectProject as chooseProject, createProject as makeProject, sequenceStem, shotStem, slugify, takeId, uniqueId,
  removeShot, writeBlob, writeLook, writeScene, writeSequence, writeShot, writeState, writeTake, writeText,
  type Scene, type Shot, type Studio, type Take,
} from "@/lib/coffre/model";
import { allowFolder, folderPermission, loadFolderHandle, readFolder, saveFolderHandle } from "@/lib/coffre/permit";
import { projectPath } from "@/lib/coffre/project";
import { idbVault, removeUnreferenced, type VaultStore } from "@/lib/coffre/store";
import { posePlan } from "@/lib/ergonomie";
import { type Balance } from "@/lib/credits";
import { FINAL_MAX_SECONDS, finalFileId, finalGraph, finalQuote, type FinalChoice, type FinalRatio } from "@/lib/montage/finaliser";
import { priseGate, resolveTakeQuote, type TakeQuote } from "@/lib/render/billed-quote";
import { audioOutput, videoOutput, meshOutput, jobStage, createRenderClient, RenderError, type RenderClient } from "@/lib/render/client";
import { isVideoGeste, VIDEO_GESTE_TEXT, videoGesteGraph } from "@/lib/render/video-gestes";
import { importModel, modelExtension } from "@/lib/maquette/files";
import { isMeshGeste, meshGesteGraph, runMesh } from "@/lib/render/mesh-gestes";
import { isSuiteGeste, SUITE_SORTIE, SUITE_SOURCE, SUITE_TEXTE, suiteGraph, type Elargir } from "@/lib/suite/graphs";
import { suiteQuote } from "@/lib/suite/quote";
import { videoSeconds } from "@/lib/suite/media";
import { kindOf, needForTemplate, type UploadNeed } from "@/lib/render/prepare-upload";
import { outilParGeste, outilParId, outilRow } from "@/lib/outils/catalogue";
import { outilGraph, outilQuote } from "@/lib/outils/graphs";
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
import { accountFingerprint, bindPendingJob, clearPending, clearTerminalPending, readPending, reconcilePendingReceipt, recoverableClient, projectVault, type PendingRender } from "@/lib/render/recovery";
import { failView, type FailKind } from "@/lib/render/fail";
import { readMontages, writeMontageEdit } from "@/lib/montage/vault";
import { namedReferenceNote, readNamedReferences, referenceNotePath, REFERENCE_CATEGORIES, REFERENCE_PHOTOS_MAX, type NamedReference, type ReferenceCategory } from "@/lib/creation/named-references";
import { referenceBoard } from "@/lib/creation/reference-board";
import { bubbleGraph, bubbleGeste, bubbleQuote, bubbleTool, type BubbleMode, type BubbleSettings } from "@/lib/creation/bubble";

export type SheetName = null | "credits" | "confirm" | "connect";

export type RunState =
  | { phase: "idle" }
  | { phase: "running"; event: TakeRunEvent | { stage: "start" } }
  | { phase: "done"; takeId: string }
  | { phase: "error"; code: string; message: string; detail: string[] };

export type FolderMode = "unsupported" | "off" | "ask" | "on";

const LINE_KEY = "u-ttu-plan";

/** A voice file's extension, from its type, else its name. */
function audioExtension(file: File): string {
  const byType: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "m4a", "audio/ogg": "ogg", "audio/flac": "flac", "audio/webm": "webm" };
  const known = byType[file.type];
  if (known) return known;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return /^(mp3|wav|m4a|ogg|flac|webm|opus)$/.test(ext) ? ext : "mp3";
}
const PICTURE = /\.(jpe?g|png|webp|gif)$/i;
const VIDEO = /\.(mp4|webm|mov)$/i;

import { getComfyAuthHeaders, renderCredentialScope } from "@/lib/render/client";
import { randomSeed } from "@/lib/seed";
import { connectMessage } from "@/lib/render/connect";
import { accountScope, discoverLocal, readCatalog, registerRender, updateCatalog, parseCatalog, type MediaAsset, type MediaCatalog } from "@/lib/media/catalog";
import { createMediaClient } from "@/lib/media/cloud";
import { syncPage, verifyMedia, cacheMedia, classify } from "@/lib/media/sync";

export interface DecorInput {
  name: string;
  prompt: string;
  source: "texte" | "photo";
  file: File | null;
  files?: File[];
  confirmed: boolean;
  geste?: string;
  /** Décor from a kept 3D frame. `photos` = street photo count. `layout: photo-lines` = [style photo, edges, …photos]. */
  cadre?: { photos: number; layout?: "structure-style" | "depth-control" | "frame-first" | "photo-lines" };
  /** Credits of the open photos sent with the frame, kept in the décor's note. */
  credits?: string[];
  /** Called once the décor is filed in DÉCOR. */
  onFiled?(filed: { id: string; name: string; cost: number | null; quote: number; image: Blob }): void;
}

export interface StudioSession {
  catalog: MediaCatalog | null;
  syncMedia(more?: boolean): Promise<void>;
  verifyMedia(ids: string[]): Promise<void>;
  cacheMedia(id: string): Promise<string>;
  previewMedia(id: string): Promise<Blob>;
  classifyMedia(ids: string[], patch: Partial<MediaAsset['organization']>): Promise<void>;
  importManifest(text: string): Promise<void>;

  ready: boolean;
  demo: boolean;
  studio: Studio;
  media: Record<string, string>;
  cast: CastCard[];
  decor: DecorCard[];
  references: NamedReference[];
  saveReference(input: { original?: NamedReference; name: string; description: string; category: ReferenceCategory; images: { file?: File; path?: string }[] }): Promise<NamedReference>;
  deleteReference(ref: NamedReference): Promise<void>;
  markCreation(path: string, patch: { favorite?: boolean; kept?: boolean }): Promise<void>;
  storeCreationInput(file: File): Promise<{ path: string; url: string }>;
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
  runOrigin: { project: string; planId: string } | null;
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
  /** Headers that let U*TTU's paid agent use the visitor's own Comfy account. Null when nothing is linked. Never stored. */
  agentAuth(): Promise<Record<string, string> | null>;
  /** How the render account is linked: a pasted key, a Comfy session (no key), or nothing. */
  linkMode: RenderLink["mode"];
  creating: boolean;
  loose: AssetRecord[];
  createCast(input: { name: string; prompt: string; source: "texte" | "photos"; files: File[]; confirmed: boolean; geste?: string }): Promise<boolean>;
  createDecor(input: DecorInput): Promise<boolean>;
  createStem(input: { geste: string; text: string; confirmed: boolean }): Promise<File | null>;
  prefs: StudioPrefs;
  setPrefs(next: Partial<StudioPrefs>): void;
  finaliseMontage(input: FinaliseInput): Promise<FinaliseOutcome>;
  runVideoGeste(input: VideoGesteRun): Promise<FinaliseOutcome>;
  runMeshGeste(input: MeshGesteRun): Promise<FinaliseOutcome>;
  /** « Et ensuite ? » : one tool on an asset or a take. The source is never overwritten. */
  runSuite(input: SuiteRun): Promise<FinaliseOutcome>;
  runOutil(input: OutilRun): Promise<FinaliseOutcome>;
  renameCast(id: string, name: string): Promise<void>;
  renameDecor(id: string, name: string): Promise<void>;
  duplicateCast(id: string): Promise<void>;
  duplicateDecor(id: string): Promise<void>;
  deleteCast(id: string): Promise<void>;
  deleteDecor(id: string): Promise<void>;
  /** Remove a Mes créations media card (son, plan, importe) and its files. */
  deleteAsset(asset: { id: string; media: string; note: string }): Promise<void>;
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
  /** P0-2: copy gallery/example refs into the project so Vidéo routes to PRISE. */
  promoteExempleRefs(specs: readonly ExempleRefSpec[]): Promise<PromotedRef[]>;
  refreshStudio(): Promise<void>;
  pendingRef: HeldRef | null;
  holdRef(ref: HeldRef | null): void;
  pendingClip: HeldClip | null;
  holdClip(clip: HeldClip | null | ((current: HeldClip | null) => HeldClip | null)): void;
  copyDecorTo(id: string, slug: string): Promise<void>;
  linkFolder(): Promise<void>;
  allowLinkedFolder(): Promise<void>;
  selectProject(slug: string): Promise<void>;
  /** A new project folder (Projets/<slug>/), made the active one. */
  createProject(name: string): Promise<void>;
  outgoing(): string;
  saveModel(file: File): Promise<string>;
  savePrevis(file: File): Promise<string>;
  /** The film just exported from MONTAGE, kept in the project so it shows in Mes créations. */
  saveExport(film: Blob, name: string): Promise<string>;
  readProjectFile(file: string): Promise<string | undefined>;
  writeProjectFile(file: string, text: string): Promise<void>;
  saveShot(shot: Shot): Promise<void>;
  /** Removes one plan note (Shots/<id>.md). Its takes stay in the vault, so « Annuler » loses nothing. */
  deleteShot(id: string): Promise<void>;
  saveLieu(input: { name: string; note: string; quartier?: string }): Promise<string | null>;
  saveLieuPhoto(input: { name: string; note: string; quartier?: string; photo: { id: string; author: string; credit: string; blob: Blob } }): Promise<string | null>;
  /** 3D repérage: one framing becomes its own DÉCOR card, colour first, then depth, lines and the camera card. */
  saveLieuCapture(input: LieuCaptureInput): Promise<{ sceneId: string; color: string } | null>;
  sendToMontage(input: MontageInput): Promise<void>;
  /** Puts every plan on the cut, in plan order: kept take, else newest take, else its still. */
  sendSequence(inputs: MontageInput[]): Promise<number>;
}

export interface LieuCaptureInput {
  name: string;
  note: string;
  color: Blob;
  depth: Blob;
  lines: Blob;
  /** The block around the view, written as Lieux/<id>.quartier.json for PRISE's maquette. */
  quartier?: string;
  /** Builds the camera card (JSON) and the plain note once the file names are known. */
  meta(files: { color: string; depth: string; lines: string }): { json: string; note: string };
}

/** One plan for the cut: a PRISE take, a video already in the project (a tool's result), or a still. */
export interface MontageInput { takeId?: string; planId: string; label: string; seconds: number; aspect: "horizontal" | "vertical"; still: string; video?: string; prompt: string; sceneName: string; composeur: string }

export interface TakeRequest {
  planId: string;
  castIds: string[];
  decorId: string | null;
  line: string;
  prompt: string;
  settings: TakeSettings;
  /** What the reliability card shows in the single confirmation (refs, words, camera, engine). */
  resume?: { label: string; value: string; flag?: boolean }[];
  /** What may change in the character or décor, in plain words. */
  change?: string;
  /** Vault paths of state references inherited from the production memory, after the character sheets. */
  extraRefs?: string[];
  /** Separate from characters and set: this image is a composition reference. */
  framingRef?: string;
}

/** One PRISE video gesture (raccord, caméra, élargir, effacer). Same gate as a take: confirmed quote, balance over the ceiling. */
export interface VideoGesteRun {
  geste: string;
  files: Record<string, File>;
  prompt: string;
  confirmed: boolean;
  aspect?: "horizontal" | "vertical";
  onStage(stage: FinaliseStage, seconds?: number): void;
  /** Real cost after the result is already shown (deferred balance read). */
  onCost?(cost: number | null): void;
}

export interface MeshGesteRun {
  geste: string;
  file: File;
  confirmed: boolean;
  onStage(stage: FinaliseStage, seconds?: number): void;
}

export interface SuiteRun {
  geste: string;
  /** The image or video the tool starts from. For Prolonger, the take's last frame. */
  source: File;
  /** Faire parler: the voice. */
  audio?: File;
  prompt: string;
  confirmed: boolean;
  aspect?: "horizontal" | "vertical";
  elargir?: Elargir;
  fluidifier?: boolean;
  /** Length of the source video, for the estimate of Finaliser and Fluidifier. */
  seconds?: number;
  /** Vault path of the validated asset it starts from. Read only, written in the note. */
  from?: string;
  onStage(stage: FinaliseStage, seconds?: number): void;
  /** Real cost after the result is already shown (deferred balance read). */
  onCost?(cost: number | null): void;
}

export interface OutilRun {
  outil: string;
  /** Images in slot order (the second one is optional). Prolonger: the take's last frame. */
  images: File[];
  /** The home bubble uses the same upload / receipt / recovery / result path. */
  creation?: { mode: BubbleMode; settings: BubbleSettings };
  /** Original vault references remain linked to the production note, even if its library card is deleted. */
  originRefs?: string[];
  onSubmitted?(receipt: { jobId: string; assetId: string; project: string }): void;
  video?: File;
  audio?: File;
  prompt: string;
  confirmed: boolean;
  aspect?: "horizontal" | "vertical";
  elargir?: Elargir;
  fluidifier?: boolean;
  seconds?: number;
  mesh?: "objet" | "perso";
  resolution?: import("@/lib/outils/genjutsu").GenjutsuResolution;
  /** The visitor may use the voice they upload. */
  consent?: boolean;
  from?: string;
  onStage(stage: FinaliseStage, seconds?: number): void;
  /** Real cost after the result is already shown (deferred balance read). */
  onCost?(cost: number | null): void;
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
  /** Open weights: add in-between frames in the same pass (SeedVR2 path only). */
  fluidifier?: boolean;
  onStage(stage: FinaliseStage, seconds?: number): void;
  /** Real cost after the result is already shown (deferred balance read). */
  onCost?(cost: number | null): void;
}

const judgeOutcome = (outcome: FinaliseOutcome) => outcome.ok ? { ok: true } : { ok: false, reason: outcome.message };

export type FinaliseOutcome =
  | { ok: true; path: string; url: string; cost: number | null }
  | { ok: false; message: string; kind?: FailKind; intact?: boolean; reconnect?: boolean; retry?: boolean };

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
    // loadeddata alone often has no painted frame yet (black poster on Safari / headless): seek, then draw.
    await new Promise<void>(resolve => {
      const timer = window.setTimeout(resolve, 2000);
      element.onseeked = () => { window.clearTimeout(timer); resolve(); };
      element.currentTime = Math.min(0.1, (element.duration || 1) / 10);
    });
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
  // Read the saved link on the first client paint so Film/Créer never flash « Relier mon compte ».
  const [link, setLink] = useState<RenderLink>(() => readRenderLink(typeof window === "undefined" ? null : localStorage));
  const [connected, setConnected] = useState(() => readRenderLink(typeof window === "undefined" ? null : localStorage).mode !== "none");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceNote, setBalanceNote] = useState("");
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  const [runOrigin, setRunOrigin] = useState<{ project: string; planId: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [folderMode, setFolderMode] = useState<FolderMode>("off");
  const [folderName, setFolderName] = useState<string | null>(null);
  const [demoOn, setDemoOn] = useState(demo);
  const [catalog, setCatalog] = useState<MediaCatalog | null>(null);
  const [loose, setLoose] = useState<AssetRecord[]>([]);
  const [references, setReferences] = useState<NamedReference[]>([]);
  const [pendingRef, setPendingRef] = useState<HeldRef | null>(null);
  const [pendingClip, setPendingClip] = useState<HeldClip | null>(null);

  const store = useCallback((): VaultStore => {
    const base = baseRef.current ?? idbVault();
    baseRef.current = base;
    return linkedStore(base, () => folderRef.current, () => {
      setFolderMode("ask");
      setNotice("Enregistré dans ce navigateur. La copie vers le dossier lié a échoué : reconnecte-le pour synchroniser.");
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
      if (next.project && entry.path.startsWith("Projets/") && !entry.path.startsWith(`Projets/${next.project}/`)) continue;
      if (/\/Sequences\/[^/]+\.(wav|mp3|m4a|ogg|webm|mp4)$/i.test(entry.path)) wanted.add(entry.path);
      if (/\/(?:Cast|Decors|Lieux|Refs|Prises|Sons|Assets)\/[^/]+\.(png|jpe?g|webp|gif|avif|mp4|webm|mov|wav|mp3|m4a|ogg|glb|gltf)$/i.test(entry.path)) wanted.add(entry.path);
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
    try {
      const labels: Parameters<typeof discoverLocal>[2] = {};
      for (const card of next.cast) for (const path of [card.sheet, ...card.photos]) if (path) labels[path] = { name: card.name, character: card.name, createdAt: card.at, workflowId: card.template };
      for (const scene of next.scenes) for (const path of [scene.render, ...scene.stills, ...scene.views]) if (path) labels[path] = { name: scene.name, decor: scene.name, workflowId: scene.template };
      for (const take of next.takes) if (take.video) { const shot = next.shots.find(s => s.takeIds.includes(take.id)); labels[take.video] = { name: take.line || take.id, createdAt: take.at, jobId: take.jobId, workflowId: take.profile, decor: take.sceneName, sequence: shot?.sequenceId ?? '', take: take.id }; }
      setCatalog(next.project ? await discoverLocal(vault, next.project, labels) : null);
    }
    catch { setCatalog(null); setNotice("L’index des médias est illisible. Les fichiers d’origine sont conservés ; exporte le coffre avant réparation."); }
    const entries = await vault.list();
    const paths = entries.map(entry => entry.path);
    setReferences(await readNamedReferences(vault, next.project));
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
  const mediaClient = useMemo(() => link.mode === "key" ? createMediaClient({ kind: "key", key: link.key }) : link.mode === "session" ? createMediaClient({ kind: "session", token: () => tokens.token() }) : null, [link, tokens]);
  const mediaScope = useCallback(async () => {
    const project = studioRef.current?.project;
    if (!client || !mediaClient || !project) throw new Error("media.auth");
    const account = await accountScope(await client.user(), await renderCredentialScope(client));
    const scope = { project, account, current: () => activeClient.current === client && studioRef.current?.project === project };
    if (!scope.current()) throw new Error("media.changed");
    return { scope, render: client, cloud: mediaClient };
  }, [client, mediaClient, link]);
  const syncMedia = useCallback(async (more = false) => {
    const { scope, cloud } = await mediaScope();
    const current = await readCatalog(store(), scope.project);
    const offset = more ? current.sync[scope.account]?.offset ?? 0 : 0;
    const next = await syncPage(store(), scope, cloud, offset);
    if (scope.current()) setCatalog(next);
  }, [mediaScope, store]);
  const checkMedia = useCallback(async (ids: string[]) => {
    const { scope, cloud } = await mediaScope();
    try { const next = await verifyMedia(store(), scope, cloud, ids); if (scope.current()) setCatalog(next); }
    finally { if (scope.current()) setCatalog(await readCatalog(store(), scope.project)); }
  }, [mediaScope, store]);
  const fetchMedia = useCallback(async (id: string) => {
    const { scope, cloud, render } = await mediaScope();
    try {
      const path = await cacheMedia(store(), scope, cloud, render, id);
      if (scope.current()) await reload();
      return path;
    } finally { if (scope.current()) setCatalog(await readCatalog(store(), scope.project)); }
  }, [mediaScope, reload, store]);
  const previewMedia = useCallback(async (id: string) => {
    const { scope, cloud } = await mediaScope();
    const asset = (await readCatalog(store(), scope.project)).assets.find(a => a.id === id);
    if (asset?.remote?.account !== scope.account || !asset.remote.previewId) throw new Error("media.preview");
    const blob = await cloud.content(asset.remote.previewId, 2 * 1024 * 1024);
    if (!scope.current() || !blob.type.startsWith("image/")) throw new Error("media.changed");
    return blob;
  }, [mediaScope, store]);
  const classifyMedia = useCallback(async (ids: string[], patch: Partial<MediaAsset['organization']>) => {
    const project = studioRef.current?.project;
    if (!project) throw new Error("media.project");
    const next = await updateCatalog(store(), project, c => classify(c, ids, patch));
    if (studioRef.current?.project === project) setCatalog(next);
  }, [store]);
  const importManifest = useCallback(async (text: string) => {
    const project = studioRef.current?.project;
    if (!project) throw new Error("media.project");
    const incoming = parseCatalog(text, project);
    const next = await updateCatalog(store(), project, current => ({ ...current, assets: [...current.assets, ...incoming.assets.filter(a => !current.assets.some(b => b.id === a.id || (a.remote?.assetId && b.remote?.assetId === a.remote.assetId && b.remote.account === a.remote.account))) ] }));
    if (studioRef.current?.project === project) setCatalog(next);
  }, [store]);
  const completePending = useCallback(async (render: RenderClient, jobId: string) => {
    const receipt = readPending(localStorage);
    if (receipt?.jobId === jobId) {
      // Preserve the receipt until both legacy files and the hybrid index are durable.
      const account = await accountScope(await render.user(), await renderCredentialScope(render));
      await registerRender(store(), receipt, await render.job(jobId), account);
    }
    clearPending(localStorage, jobId);
  }, [store]);
  const fingerprint = useCallback(async () => accountFingerprint(link.mode === "key" ? link.key : JSON.stringify(await client?.user())), [client, link]);


  const failOutcome = useCallback((error: unknown): Extract<FinaliseOutcome, { ok: false }> => {
    const view = failView(error);
    if (error instanceof RenderError && (error.code === "failed" || error.code === "cancelled")) {
      const pending = readPending(localStorage);
      if (pending?.jobId) clearTerminalPending(localStorage, pending.jobId);
    }
    // Partner/API node Unauthorized often arrives as auth on /api/prompt while the
    // session or key is still valid. Keep the link; the reconnect button still shows.
    if (error instanceof RenderError && error.code === "auth") {
      setBalanceNote(view.message);
    }
    return { ok: false, message: view.message, kind: view.kind, intact: view.intact, reconnect: view.reconnect, retry: view.retry };
  }, []);


  // Synchronous guard before any await, plus an origin-wide Web Lock for tabs.
  // A receipt whose Comfy job already failed/cancelled is dropped so the visitor is not stuck.
  const paid = useCallback(async <T,>(work: () => Promise<T>, refused: T): Promise<T> => {
    if (paidBusy.current || following.current) return refused;
    paidBusy.current = true;
    setCreating(true);
    try {
      if (!navigator.locks) throw new Error("Ce navigateur ne peut pas sécuriser les envois simultanés. Utilise un navigateur récent.");
      return await navigator.locks.request("uttu-paid-render", { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Un rendu est déjà suivi dans un autre onglet.");
        if (client) {
          const reconciled = await reconcilePendingReceipt(localStorage, client);
          if (reconciled === "cleared") setNotice(t("runtimeSafe.cloudNoResult"));
        }
        if (readPending(localStorage) || readInFlight(localStorage)) {
          throw new Error("Un rendu précédent attend encore sa récupération. Ouvre Crédits, puis Récupérer le rendu — ou réessaie si le cloud l’a déjà terminé sans résultat.");
        }
        return work();
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Opération interrompue.");
      return refused;
    } finally { paidBusy.current = false; setCreating(false); }
  }, [client, t]);

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
      if (error instanceof RenderError && error.code === "auth") {
        setConnected(false);
        setBalance(null);
      }
      // Transient balance read failure: keep the last known amount so the header
      // stays filled and we never treat "unknown" as "too low".
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
      if (flight.planId) setRunOrigin({ project: slug, planId: flight.planId });
      const vault = projectVault(store(), slug);
      const result = await followTake(renderClient, flight.jobId, flight.balanceBefore, event => { if (event.stage === "measure") return; setRun({ phase: "running", event }); }, { signal: abort.current.signal });
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
      await completePending(renderClient, flight.jobId);
      saveInFlight(localStorage, null);
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
      await reload();
      setRun({ phase: "done", takeId: id });
      setNotice("Prise enregistrée dans son projet. Tu peux la retrouver et l’ajouter au montage.");
    } catch (error) {
      const failure = error instanceof RenderError ? error : new RenderError("failed", error instanceof Error ? error.message : "La prise n’a pas abouti.");
      // Keep the receipt on timeout, download and disk errors. Recovery is read-only.
      // Only a confirmed terminal cloud failure permits a new, separately confirmed send.
      if (await reconcilePendingReceipt(localStorage, renderClient) === "cleared") saveInFlight(localStorage, null);
      setRun({ phase: "error", code: failure.code, message: failure.message, detail: failure.detail });
    } finally {
      abort.current = null;
      following.current = null;
    }
  }, [completePending, reload, store]);

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
      if (flight) setNotice("Un rendu attend sa récupération. Ouvre Crédits puis Récupérer le rendu.");
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
        seed: randomSeed(),
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
      await completePending(client, result.jobId);
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
  }, [client, completePending, failOutcome, fingerprint, prefs, refreshBalance, reload, store, t]);

  const createDecor = useCallback(async (input: DecorInput) => {
    const row = input.geste ? gesteParId(input.geste) : null;
    const opened = !row || (gesteOuvert(row) && row.onglet === "decor");
    // From a kept 3D frame: the frame plus one to three photos, quoted by photo count.
    const cadre = input.cadre ? cadreQuote(input.cadre.photos) : null;
    if (input.cadre && !cadre) return false;
    const layout = input.cadre?.layout ?? "structure-style";
    // structure-style: the frame (structure) then the photos (style). InstantX depth-control: frame alone.
    const cadreSlots = cadre ? (layout === "depth-control" ? 1 : input.cadre!.photos + 1) : 0;
    const pictures = (input.files && input.files.length > 0 ? input.files : input.file ? [input.file] : []).slice(0, cadre ? cadreSlots : 3);
    if (cadre && pictures.length !== cadreSlots) return false;
    const quote = cadre ?? (row && row.credits !== null && row.high !== null
      ? { credits: row.credits, high: row.high, template: row.template }
      : quoteForDecor(input.source));
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
    const kind = cadre ? "cadre-decor" as const
      : row?.still === "photo-decor" || row?.still === "texte-decor"
        ? row.still
        : input.source === "photo" ? "photo-decor" : "texte-decor";
    const sent = cadre ? input.prompt.trim() : [input.prompt.trim(), row?.consigne ?? ""].filter(Boolean).join("\n\n");
    setCreating(true);
    try {
      const refs: string[] = [];
      for (const [index, file] of pictures.entries()) {
        const path = projectPath(slug, `Decors/${id}-p${index + 1}.${extensionFor(file.type)}`);
        await writeBlob(vault, path, file);
        refs.push(path);
      }
      const receipt: PendingRender = { version: 1, kind: "decor", project: slug, id, name, prompt: input.prompt.trim(), at: new Date().toISOString(), account: await fingerprint(), refs, template: quote.template, quote: quote.credits, balanceBefore: fresh?.credits ?? 0, jobId: null };
      const pictureName = (index: number) => {
        if (!cadre) return `uttu-lieu-${index + 1}.jpg`;
        if (layout === "depth-control") return "uttu-cadre-3d.png";
        if (layout === "photo-lines") {
          if (index === 0) return "uttu-lieu-1.jpg";
          if (index === 1) return "uttu-cadre-lines.png";
          return `uttu-lieu-${index}.jpg`;
        }
        return index === 0 ? "uttu-cadre-3d.png" : `uttu-lieu-${index}.jpg`;
      };
      const result = await runStill(recoverableClient(client, localStorage, receipt), {
        kind,
        template: quote.template,
        prompt: sent,
        pictures: pictures.map((file, index) => ({ blob: file, name: pictureName(index) })),
        seed: randomSeed(),
        clientId: crypto.randomUUID(),
        balanceBefore: fresh?.credits ?? 0,
        cadreLayout: cadre ? layout : undefined,
      });
      const sheet = `Projets/${slug}/Decors/${id}.png`;
      await writeBlob(vault, sheet, result.image);
      const scene: Scene = {
        ...emptySceneDraft(),
        id, name, note: [input.prompt.trim(), ...(input.credits?.length ? [`Photos : ${input.credits.join(" · ")}`] : [])].join("\n\n"), stills: [sheet], render: sheet,
        prompt: input.prompt.trim(), template: quote.template, devis: quote.credits, cout: result.costCredits, home: "Decors", source: input.source,
        geste: cadre ? "decor-cadre" : row?.id,
      };
      await writeScene(vault, scene);
      await writeState(vault, id);
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
      await completePending(client, result.jobId);
      await reload();
      setPickedDecor(id);
      setNotice(t("create.filed"));
      input.onFiled?.({ id, name, cost: result.costCredits, quote: quote.credits, image: result.image });
      return true;
    } catch (error) {
      const failure = error instanceof RenderError ? error : new RenderError("failed", error instanceof Error ? error.message : t("create.failed"));
      setNotice(failure.message || t("create.failed"));
      return false;
    } finally {
      setCreating(false);
    }
  }, [client, completePending, failOutcome, fingerprint, prefs, refreshBalance, reload, store, t]);

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
        seed: randomSeed(),
        clientId: crypto.randomUUID(),
        balanceBefore: fresh?.credits ?? 0,
      });
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
      const paths = assetPaths(slug, "son", id, "mp3");
      await writeBlob(vault, paths.media, result.audio);
      await writeText(vault, paths.note, assetNote({ id, kind: "son", name: receipt.name, at: receipt.at, prompt: text, geste: input.geste, template: row.template, refs: [], devis: quote.credits, cout: result.costCredits, media: paths.media, note: paths.note, preview: null, loose: false }));
      await completePending(client, result.jobId);
      await reload();
      return new File([result.audio], result.filename, { type: result.audio.type || "audio/mpeg" });
    } catch (error) {
      const failure = error instanceof RenderError ? error : new RenderError("failed", error instanceof Error ? error.message : t("create.failed"));
      setNotice(failure.message || t("create.failed"));
      return null;
    } finally {
      setCreating(false);
    }
  }, [client, completePending, failOutcome, fingerprint, prefs, refreshBalance, reload, store, t]);

  // Finaliser : une passe sur le montage entier. Jamais d'annulation : le job va au bout.
  const finaliseMontage = useCallback(async (input: FinaliseInput): Promise<FinaliseOutcome> => {
    // Open Weights Only: the same Finaliser runs on SeedVR2 (open weights) instead of RTX.
    const open = prefs.openWeightsOnly;
    const openQuote = open && input.seconds > 0 && input.seconds <= FINAL_MAX_SECONDS ? suiteQuote("suite-finaliser-video", { seconds: input.seconds, fluidifier: input.fluidifier }) : null;
    const quote = open ? (openQuote ? { credits: openQuote.credits, ceiling: openQuote.high } : null) : finalQuote(input.seconds, input.choice);
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
      const template = open ? "utility_seedvr2_3b_int8_upscale_video" : "RTXVideoSuperResolution";
      const receipt: PendingRender = { version: 1, kind: "final", project: slug, id, name: `${input.name} — final ${open ? "1080p" : input.choice.resolution}`, prompt: JSON.stringify({ seconds: input.seconds, ratio: input.ratio, choice: input.choice, open, fluidifier: Boolean(input.fluidifier) }), at, account: await fingerprint(), refs: [], template, quote: quote.credits, balanceBefore: fresh!.credits, jobId: null };
      input.onStage("envoi");
      const file = await client.upload(input.video, "uttu-montage.mp4", { kind: "video", keepQuality: true } satisfies UploadNeed);
      const graph = open
        ? suiteGraph({ geste: "suite-finaliser-video", files: { source: file }, prompt: "", seed: randomSeed(), seconds: input.seconds, fluidifier: input.fluidifier })
        : finalGraph({ file, ratio: input.ratio, ...input.choice });
      const jobId = await recoverableClient(client, localStorage, receipt).submit(graph, crypto.randomUUID());
      const notePath = `Projets/${slug}/Assets/${id}.md`;
      const path = `Projets/${slug}/Assets/${id}.mp4`;
      const result = await followTake(client, jobId, fresh?.credits ?? 0, event => {
        if (event.stage === "queue" || event.stage === "prepare") input.onStage("file");
        else if (event.stage === "render") input.onStage("calcul", event.seconds);
        else if (event.stage === "fetch" || event.stage === "ready") input.onStage("retour");
      }, {
        deferMeasure: true,
        onCost: info => {
          if (info.balanceAfter !== null) setBalance({ credits: info.balanceAfter, readAt: Date.now() });
          void writeText(vault, notePath, assetNote({ id, kind: "plan", name: receipt.name, at, prompt: receipt.prompt, geste: "mont-final", template: receipt.template, refs: [], devis: quote.credits, cout: info.costCredits, media: path, note: notePath, preview: null, loose: false }));
          input.onCost?.(info.costCredits);
        },
      });
      await writeBlob(vault, path, result.video);
      await writeText(vault, notePath, assetNote({ id, kind: "plan", name: receipt.name, at, prompt: receipt.prompt, geste: "mont-final", template: receipt.template, refs: [], devis: quote.credits, cout: result.costCredits, media: path, note: notePath, preview: null, loose: false }));
      await completePending(client, jobId);
      await reload();
      return { ok: true, path, url: URL.createObjectURL(result.video), cost: result.costCredits };
    } catch (error) {
      return failOutcome(error);
    } finally {
      setCreating(false);
    }
  }, [client, completePending, failOutcome, fingerprint, prefs, refreshBalance, reload, store, t]);

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
        names[slot.slot] = await client.upload(file, `${id}-${slot.slot}.${ext}`, needForTemplate(row.template, kindOf(file.type)));
      }
      const graph = videoGesteGraph({ geste, files: names, prompt: input.prompt, aspect: input.aspect, seed: randomSeed() });
      const receipt: PendingRender = { version: 1, kind: "video", geste, project: slug, id, name: t(`gestes.${row.clef}.title`), prompt: input.prompt, at, account: await fingerprint(), refs, template: row.template, quote: row.credits, balanceBefore: fresh!.credits, jobId: null };
      const jobId = await recoverableClient(client, localStorage, receipt).submit(graph, crypto.randomUUID());
      const notePath = `Projets/${slug}/Assets/${id}.md`;
      const path = `Projets/${slug}/Assets/${id}.mp4`;
      const result = await followTake(client, jobId, fresh?.credits ?? 0, event => {
        if (event.stage === "queue" || event.stage === "prepare") input.onStage("file");
        else if (event.stage === "render") input.onStage("calcul", event.seconds);
        else if (event.stage === "fetch" || event.stage === "ready") input.onStage("retour");
      }, {
        deferMeasure: true,
        onCost: info => {
          if (info.balanceAfter !== null) setBalance({ credits: info.balanceAfter, readAt: Date.now() });
          void writeText(vault, notePath, assetNote({ id, kind: "plan", name: receipt.name, at, prompt: input.prompt, geste, template: row.template, refs, devis: row.credits, cout: info.costCredits, media: path, note: notePath, preview: null, loose: false }));
          input.onCost?.(info.costCredits);
        },
      });
      await writeBlob(vault, path, result.video);
      await writeText(vault, notePath, assetNote({ id, kind: "plan", name: receipt.name, at, prompt: input.prompt, geste, template: row.template, refs, devis: row.credits, cout: result.costCredits, media: path, note: notePath, preview: null, loose: false }));
      await completePending(client, jobId);
      await reload();
      return { ok: true, path, url: URL.createObjectURL(result.video), cost: result.costCredits };
    } catch (error) {
      return failOutcome(error);
    } finally {
      setCreating(false);
    }
  }, [client, completePending, failOutcome, fingerprint, prefs, refreshBalance, reload, store, t]);

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
      const graph = meshGesteGraph({ geste: row.id, image, seed: randomSeed() });
      const result = await runMesh(recoverableClient(client, localStorage, receipt), { graph, clientId: crypto.randomUUID(), balanceBefore: fresh?.credits ?? 0 }, {
        onStage: (stage, seconds) => input.onStage(stage, seconds),
      });
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
      const path = `Projets/${slug}/Assets/${id}.glb`;
      await modelExtension(result.mesh, path);
      await writeBlob(vault, path, result.mesh);
      await writeText(vault, `Projets/${slug}/Assets/${id}.md`, assetNote({ id, kind: "importe", name, at, prompt: "", geste: row.id, template: row.template, refs, devis: row.credits, cout: result.costCredits, media: path, note: `Projets/${slug}/Assets/${id}.md`, preview: null, loose: false }));
      await completePending(client, result.jobId);
      await reload();
      return { ok: true, path, url: URL.createObjectURL(result.mesh), cost: result.costCredits };
    } catch (error) {
      return failOutcome(error);
    } finally {
      setCreating(false);
    }
  }, [client, completePending, failOutcome, fingerprint, prefs, refreshBalance, reload, store, t]);

  // « Et ensuite ? ». Préparer → Vérifier → Estimer → Confirmer → Exécuter → Contrôler → Archiver.
  // The result is a new asset; the asset it starts from is only read. Jamais d'annulation.
  const runSuite = useCallback(async (input: SuiteRun): Promise<FinaliseOutcome> => {
    const row = gesteParId(input.geste);
    if (!row || row.still !== "suite" || !gesteOuvert(row) || !isSuiteGeste(row.id)) return { ok: false, message: t(row?.raison ?? "gestes.unwired") };
    const geste = row.id;
    if (!gesteVisible(row, prefs)) return { ok: false, message: t("safety.modelBlocked") };
    const quote = suiteQuote(geste, { seconds: input.seconds, fluidifier: input.fluidifier });
    if (!quote || !spendAllowed(quote.credits, input.confirmed)) return { ok: false, message: t("finaliser.noQuote") };
    if (SUITE_TEXTE[geste] === "requis" && !input.prompt.trim()) return { ok: false, message: t("videoGeste.needText") };
    // Prolonger starts from the take's last frame (an image); the others from their own media.
    const wants = geste === "suite-prolonger" ? "image" : SUITE_SOURCE[geste];
    if (!input.source || !input.source.type.startsWith(`${wants}/`)) return { ok: false, message: t("videoGeste.needFiles") };
    if (geste === "suite-parler" && !input.audio) return { ok: false, message: t("videoGeste.needFiles") };
    if (!client) return { ok: false, message: t("create.needLink") };
    const fresh = await refreshBalance();
    if (!creationAllowed(true, fresh?.credits ?? null, quote.high)) return { ok: false, message: t("create.needCeiling") };
    setCreating(true);
    try {
      const slug = await ensureActiveProject(store());
      const vault = projectVault(store(), slug);
      const at = new Date().toISOString();
      const id = `${geste}-${crypto.randomUUID()}`;
      const name = t(`gestes.${row.clef}.title`);
      input.onStage("envoi");
      const refs: string[] = [];
      if (input.from) refs.push(input.from);
      if (!input.from || geste === "suite-prolonger") {
        const copy = `Projets/${slug}/Assets/${id}-source.${extensionFor(input.source.type)}`;
        await writeBlob(vault, copy, input.source);
        refs.push(copy);
      }
      const source = await client.upload(input.source, `${id}-source.${extensionFor(input.source.type)}`, needForTemplate(row.template, kindOf(input.source.type)));
      let audio: string | undefined;
      if (input.audio) {
        const voiceExt = audioExtension(input.audio);
        const voice = `Projets/${slug}/Assets/${id}-voix.${voiceExt}`;
        await writeBlob(vault, voice, input.audio);
        refs.push(voice);
        audio = await client.upload(input.audio, `${id}-voix.${voiceExt}`);
      }
      const graph = suiteGraph({ geste, files: { source, audio }, prompt: input.prompt, seed: randomSeed(), aspect: input.aspect, elargir: input.elargir, fluidifier: input.fluidifier, seconds: input.seconds });
      const still = SUITE_SORTIE[geste] === "image";
      const receipt: PendingRender = { version: 1, kind: still ? "image" : "video", geste, project: slug, id, name, prompt: input.prompt, at, account: await fingerprint(), refs, template: row.template, quote: quote.credits, balanceBefore: fresh!.credits, jobId: null };
      const jobId = await recoverableClient(client, localStorage, receipt).submit(graph, crypto.randomUUID());
      const ext = still ? "png" : "mp4";
      const path = `Projets/${slug}/Assets/${id}.${ext}`;
      const notePath = `Projets/${slug}/Assets/${id}.md`;
      const kindNote = still ? "importe" : "plan";
      const result = await followTake(client, jobId, fresh?.credits ?? 0, event => {
        if (event.stage === "queue" || event.stage === "prepare") input.onStage("file");
        else if (event.stage === "render") input.onStage("calcul", event.seconds);
        else if (event.stage === "fetch" || event.stage === "ready") input.onStage("retour");
      }, {
        output: still ? "image" : "video",
        deferMeasure: true,
        onCost: info => {
          if (info.balanceAfter !== null) setBalance({ credits: info.balanceAfter, readAt: Date.now() });
          void writeText(vault, notePath, assetNote({ id, kind: kindNote, name, at, prompt: input.prompt, geste, template: row.template, refs, devis: quote.credits, cout: info.costCredits, media: path, note: notePath, preview: null, loose: false }));
          input.onCost?.(info.costCredits);
        },
      });
      if (!result.video.size) throw new RenderError("failed", t("suite.emptyResult"));
      await writeBlob(vault, path, result.video);
      await writeText(vault, notePath, assetNote({ id, kind: kindNote, name, at, prompt: input.prompt, geste, template: row.template, refs, devis: quote.credits, cout: result.costCredits, media: path, note: notePath, preview: null, loose: false }));
      await completePending(client, jobId);
      await reload();
      return { ok: true, path, url: URL.createObjectURL(result.video), cost: result.costCredits };
    } catch (error) {
      return failOutcome(error);
    } finally {
      setCreating(false);
    }
  }, [client, completePending, failOutcome, fingerprint, prefs, refreshBalance, reload, store, t]);

  // Hub tools: the same seven steps. « Et ensuite ? » rows go through runSuite; the others are
  // built by outilGraph and land in Mon studio as a new asset. Jamais d'annulation.
  const runOutil = useCallback(async (input: OutilRun): Promise<FinaliseOutcome> => {
    const outil = outilParId(input.outil);
    const creation = input.creation;
    const row = creation ? gesteParId(bubbleGeste(creation.mode, input.images.length, Boolean(input.audio))) : outil ? outilRow(outil) : undefined;
    if (!outil || !row || !outil.moteur || outil.bientot) return { ok: false, message: t(outil?.bientot ? `outils.why.${outil.bientot}` : "gestes.unwired") };
    if (creation && input.outil !== bubbleTool(creation.mode, input.images.length, Boolean(input.audio))) return { ok: false, message: t("bubble.invalid") };
    if (!gesteVisible(row, prefs)) return { ok: false, message: t("safety.modelBlocked") };
    if (outil.moteur.kind === "suite" && !creation) {
      const source = outil.entrees.includes("video") && row.id !== "suite-prolonger" ? input.video : input.images[0];
      if (!source) return { ok: false, message: t("videoGeste.needFiles") };
      return runSuite({ geste: row.id, source, audio: input.audio, prompt: input.prompt, confirmed: input.confirmed, aspect: input.aspect, elargir: input.elargir, fluidifier: input.fluidifier, seconds: input.seconds, from: input.from, onStage: input.onStage, onCost: input.onCost });
    }
    const quote = creation ? bubbleQuote(creation.mode, input.images.length, creation.settings, Boolean(input.audio)) : outilQuote(outil, { seconds: input.seconds, fluidifier: input.fluidifier, mesh: input.mesh, resolution: input.resolution });
    if (!quote || !spendAllowed(quote.credits, input.confirmed)) return { ok: false, message: t("finaliser.noQuote") };
    if (outil.texte === "requis" && !input.prompt.trim()) return { ok: false, message: t("videoGeste.needText") };
    if (outil.entrees.includes("image") && !input.images[0]?.type.startsWith("image/")) return { ok: false, message: t("videoGeste.needFiles") };
    if (outil.entrees.includes("video") && !input.video?.type.startsWith("video/")) return { ok: false, message: t("videoGeste.needFiles") };
    if (outil.entrees.includes("audio") && !input.audio?.type.startsWith("audio/")) return { ok: false, message: t("videoGeste.needFiles") };
    if (outil.consentement && input.audio && !input.consent) return { ok: false, message: t("outils.needConsent") };
    if (!client) return { ok: false, message: t("create.needLink") };
    const fresh = await refreshBalance();
    if (!creationAllowed(true, fresh?.credits ?? null, quote.high)) return { ok: false, message: t("create.needCeiling") };
    setCreating(true);
    try {
      const slug = await ensureActiveProject(store());
      const vault = projectVault(store(), slug);
      const at = new Date().toISOString();
      const id = `${outil.id}-${crypto.randomUUID()}`;
      const when = new Date(at);
      const stamp = `${String(when.getDate()).padStart(2, "0")}/${String(when.getMonth() + 1).padStart(2, "0")} ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}:${String(when.getSeconds()).padStart(2, "0")}`;
      const subject = (input.prompt || "").replace(/\s+/g, " ").trim().slice(0, 40);
      const toolTitle = t(`outils.t.${outil.id}.title`);
      const name = cleanCardName(subject ? `${toolTitle} · ${subject} · ${stamp}` : `${toolTitle} · ${stamp}`) || `${outil.id}-${stamp}`;
      input.onStage("envoi");
      const refs: string[] = [...new Set([...(input.originRefs ?? []), ...(input.from ? [input.from] : [])])];
      if (refs.some(path => !path.startsWith(`Projets/${slug}/`))) throw new RenderError("invalid", t("namedRefs.changed"));
      const send = async (file: File, label: string) => {
        const ext = file.type.startsWith("audio/") ? audioExtension(file) : extensionFor(file.type);
        if (!input.from) {
          const copy = `Projets/${slug}/Assets/${id}-${label}.${ext}`;
          await writeBlob(vault, copy, file);
          refs.push(copy);
        }
        // The workflow's need (Copier un mouvement: one 16 fps window) is applied in client.upload.
        return client.upload(file, `${id}-${label}.${ext}`, needForTemplate(row.template, kindOf(file.type)));
      };
      const images: string[] = [];
      for (const [index, file] of input.images.entries()) images.push(await send(file, `image-${index + 1}`));
      const video = input.video ? await send(input.video, "video") : undefined;
      const audio = input.audio ? await send(input.audio, "son") : undefined;
      const graph = creation ? bubbleGraph({ mode: creation.mode, settings: creation.settings, images, audio, prompt: input.prompt, seed: randomSeed() }) : outilGraph(outil, { files: { images, video, audio }, prompt: input.prompt, seed: randomSeed(), aspect: input.aspect, elargir: input.elargir, fluidifier: input.fluidifier, seconds: input.seconds, mesh: input.mesh, resolution: input.resolution });
      const sortie = outil.sortie;
      const kind: PendingRender["kind"] = sortie === "audio" ? "son" : sortie;
      const receipt: PendingRender = { version: 1, kind, geste: row.id, project: slug, id, name, prompt: input.prompt, at, account: await fingerprint(), refs, template: row.template, quote: quote.credits, balanceBefore: fresh!.credits, jobId: null };
      const jobId = await recoverableClient(client, localStorage, receipt).submit(graph, crypto.randomUUID());
      input.onSubmitted?.({ jobId, assetId: id, project: slug });
      let notePath = "";
      let mediaPath = "";
      let kindNote: "plan" | "son" | "importe" = "importe";
      const result = await followTake(client, jobId, fresh?.credits ?? 0, event => {
        if (event.stage === "queue" || event.stage === "prepare") input.onStage("file");
        else if (event.stage === "render") input.onStage("calcul", event.seconds);
        else if (event.stage === "fetch" || event.stage === "ready") input.onStage("retour");
      }, {
        output: sortie,
        deferMeasure: true,
        onCost: info => {
          if (info.balanceAfter !== null) setBalance({ credits: info.balanceAfter, readAt: Date.now() });
          if (notePath) {
            void writeText(vault, notePath, assetNote({ id, kind: kindNote, name, at, prompt: input.prompt, geste: row.id, template: row.template, refs, devis: quote.credits, cout: info.costCredits, media: mediaPath, note: notePath, preview: null, loose: false }));
          }
          input.onCost?.(info.costCredits);
        },
      });
      if (!result.video.size) throw new RenderError("failed", t("suite.emptyResult"));
      const ext = sortie === "image" ? "png" : sortie === "video" ? "mp4" : sortie === "mesh" ? await modelExtension(result.video, "model.glb") : (result.video.type.includes("wav") ? "wav" : result.video.type.includes("flac") ? "flac" : "mp3");
      mediaPath = `Projets/${slug}/Assets/${id}.${ext}`;
      notePath = `Projets/${slug}/Assets/${id}.md`;
      kindNote = sortie === "video" ? "plan" : sortie === "audio" ? "son" : "importe";
      await writeBlob(vault, mediaPath, result.video);
      await writeText(vault, notePath, assetNote({ id, kind: kindNote, name, at, prompt: input.prompt, geste: row.id, template: row.template, refs, devis: quote.credits, cout: result.costCredits, media: mediaPath, note: notePath, preview: null, loose: false }));
      await completePending(client, jobId);
      await reload();
      return { ok: true, path: mediaPath, url: URL.createObjectURL(result.video), cost: result.costCredits };
    } catch (error) {
      return failOutcome(error);
    } finally {
      setCreating(false);
    }
  }, [client, completePending, failOutcome, fingerprint, prefs, refreshBalance, reload, runSuite, store, t]);

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

  const deleteAsset = useCallback(async (asset: { id: string; media: string; note: string }) => {
    if (!current.project) return;
    const vault = store();
    const take = current.takes.find(item => item.id === asset.id);
    if (take) {
      await removeTake(vault, take, current.takes);
      await reload();
      return;
    }
    if (asset.note) await vault.remove(asset.note).catch(() => undefined);
    if (asset.media) await vault.remove(asset.media).catch(() => undefined);
    // Loose media without a note: drop matching sidecar paths and any Assets note.
    if (!asset.note && asset.media) {
      const base = asset.media.replace(/\.[^.]+$/, "");
      await vault.remove(`${base}.md`).catch(() => undefined);
    }
    await reload();
  }, [current.project, current.takes, reload, store]);

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
    if (pendingTake?.decorId && !place) { setNotice("Le décor choisi n’est pas enregistré dans ce projet. Enregistre-le dans DÉCOR avant de générer."); return; }
    const selected = pendingTake ? pendingTake.castIds.flatMap(id => held?.cast.find(item => item.id === id) ? [held.cast.find(item => item.id === id)!] : []) : held?.cast.filter(item => item.id === pickedCast) ?? [];
    if (pendingTake && selected.length !== pendingTake.castIds.length) { setNotice("Chaque personnage doit avoir une référence enregistrée. Retire les silhouettes neutres avant de générer."); return; }
    const photos = [...(selected.length ? selected.flatMap(who => who.sheet ? [who.sheet] : who.photos.slice(0, 1)) : (pendingTake ? [] : held?.look.photos ?? [])), ...(pendingTake?.extraRefs ?? []).filter(path => path.startsWith("Projets/"))];
    const paths = referencePaths(photos, place, Infinity);
    const framingRef = pendingTake?.framingRef;
    if (framingRef?.startsWith("Projets/") && !paths.includes(framingRef)) paths.push(framingRef);
    if (paths.length > referenceLimit(settings)) { setNotice(t("safety.referencesMax", { max: referenceLimit(settings) })); return; }
    let prompt = outgoing();
    if (framingRef && paths.includes(framingRef)) {
      const index = paths.indexOf(framingRef) + 1;
      const tag = settings.engine === "h3" ? `<Picture ${index}>` : `image ${index}`;
      prompt += `\n[framing reference] ${tag} guides composition and framing only; keep character identity and set appearance from their named references.`;
    }
    if (!prompt.trim()) {
      setNotice(t("create.noPicture"));
      return;
    }
    const slug = await ensureActiveProject(store());
    const vault = projectVault(store(), slug);
    const pictures: { blob: Blob; name: string }[] = [];
    if (pendingTake?.planId) setRunOrigin({ project: slug, planId: pendingTake.planId });
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
      const receipt: PendingRender = { version: 1, kind: "take", project: slug, id: takeId(new Date(at), place?.name || "prise"), name: flightData.line, prompt, at, account: await fingerprint(), refs: paths, template: takeProfile(settings), quote: freshQuote.source === "balance" ? freshQuote.credits : freshQuote.source === "billed" ? freshQuote.measure.credits : 0, balanceBefore: fresh.credits, jobId: null, flight: flightData };
      const jobId = await submitTake(recoverableClient(client, localStorage, receipt), {
        pictures, prompt, settings, seed: randomSeed(), clientId: crypto.randomUUID(),
      }, event => setRun({ phase: "running", event }), abort.current.signal);
      const flight: InFlight = { ...flightData, jobId };
      saveInFlight(localStorage, flight);
      await finish(flight, client);
    } catch (error) {
      const failure = error instanceof RenderError ? error : new RenderError("failed", error instanceof Error ? error.message : "La prise n’a pas abouti.");
      setRun({ phase: "error", code: failure.code, message: failure.message, detail: failure.detail });
      abort.current = null;
    }
  }, [client, completePending, fingerprint, finish, line, outgoing, pendingTake, pickedCast, pickedDecor, refreshBalance, run.phase, settings, store, t]);

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
  }, [client, completePending, fingerprint, t]);

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
        if (receipt.account !== await fingerprint()) throw new Error("Reconnecte le compte qui a envoyé ce rendu pour le récupérer.");
        if (!receipt.jobId) throw new Error("L’envoi a été interrompu sans reçu. Il peut avoir été facturé. Vérifie l’historique Comfy avant toute nouvelle génération ; ne supprime pas les données de ce navigateur.");
        const stage = jobStage(await client.status(receipt.jobId));
        const vault = projectVault(store(), receipt.project);
        if (stage === "failed" || stage === "cancelled") {
          await writeText(vault, projectPath(receipt.project, `.uttu/${receipt.id}.json`), JSON.stringify({ ...receipt, account: undefined, terminal: stage }));
          clearPending(localStorage, receipt.jobId);
          if (legacy?.jobId === receipt.jobId) saveInFlight(localStorage, null);
          if (receipt.kind === "take" && receipt.flight?.planId) {
            setRunOrigin({ project: receipt.project, planId: receipt.flight.planId });
            setRun({ phase: "error", code: "failed", message: "Le rendu a échoué dans le cloud.", detail: [] });
          }
          setNotice("Le cloud confirme que ce rendu est terminé sans résultat. Tu peux préparer un nouvel envoi avec confirmation.");
          return;
        }
        if (receipt.kind === "take" && receipt.flight) {
          await finish({ ...receipt.flight, jobId: receipt.jobId }, client);
          return;
        }
        if (stage !== "done") { setNotice("Le cloud travaille encore. Réessaie Récupérer le rendu dans quelques instants. Aucun nouvel envoi."); return; }
        const detail = await client.job(receipt.jobId);
        const isVideo = receipt.kind === "final" || receipt.kind === "video";
        const isImage = receipt.kind === "image";
        const ref = receipt.kind === "mesh" ? meshOutput(detail.outputs) : receipt.kind === "son" ? audioOutput(detail.outputs) : isVideo ? videoOutput(detail.outputs) : stillOutput(detail.outputs);
        if (!ref) throw new Error("Le cloud annonce la fin mais le fichier manque. Le reçu est conservé.");
        const blob = await client.file(ref);
        if (receipt.kind === "mesh") await modelExtension(blob, ref.filename);
        const ext = ref.filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || (receipt.kind === "son" ? "mp3" : "png");
        const kind = receipt.kind === "cast" ? "personnage" : receipt.kind === "decor" ? "decor" : isVideo ? "plan" : receipt.kind === "mesh" || isImage ? "importe" : "son";
        const paths = isVideo || isImage ? { media: `Projets/${receipt.project}/Assets/${receipt.id}.${ext}`, note: `Projets/${receipt.project}/Assets/${receipt.id}.md` } : assetPaths(receipt.project, kind, receipt.id, ext);
        await writeBlob(vault, paths.media, blob);
        if (receipt.kind === "cast") {
          await writeText(vault, paths.note, castNote({ id: receipt.id, name: receipt.name, at: receipt.at, prompt: receipt.prompt, source: receipt.refs.length ? "photos" : "texte", photos: receipt.refs, sheet: paths.media, template: receipt.template, quote: receipt.quote, cost: null, project: receipt.project }));
        } else if (receipt.kind === "decor") {
          await writeScene(vault, { ...emptySceneDraft(), id: receipt.id, name: receipt.name, note: receipt.prompt, prompt: receipt.prompt, render: paths.media, stills: [paths.media], views: receipt.refs, home: "Decors", template: receipt.template, devis: receipt.quote, cout: null });
        } else {
          await writeText(vault, paths.note, assetNote({ id: receipt.id, kind: isVideo ? "plan" : receipt.kind === "mesh" || isImage ? "importe" : "son", name: receipt.name, at: receipt.at, prompt: receipt.prompt, geste: receipt.geste ?? "", template: receipt.template, refs: receipt.refs, devis: receipt.quote, cout: null, media: paths.media, note: paths.note, preview: null, loose: false }));
        }
        await completePending(client, receipt.jobId);
        await reload();
        setNotice("Rendu récupéré dans son projet d’origine. Le coût reste à vérifier dans ton compte.");
      };
      if (!navigator.locks) throw new Error("La récupération nécessite un navigateur récent.");
      await navigator.locks.request("uttu-paid-render", { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Un autre onglet suit déjà un rendu.");
        await recover();
      });
    })().catch(error => setNotice(error instanceof Error ? error.message : "Récupération impossible pour le moment.")).finally(() => { paidBusy.current = false; setCreating(false); });
  }, [client, completePending, fingerprint, finish, reload, store]);

  useEffect(() => {
    if (!ready || !client) return;
    try {
      const receipt = readPending(localStorage);
      // An ambiguous submission has no job to poll. Its explicit identification
      // must not race an automatic attempt holding the same operation lock.
      if (receipt?.jobId || (!receipt && readInFlight(localStorage))) resumeRun();
    }
    catch (error) { setNotice(error instanceof Error ? error.message : "Reçu illisible."); }
  }, [ready, client, resumeRun]);

  const connectKey = useCallback(async (raw: string) => {
    const key = cleanApiKey(raw);
    if (!key) return t("sheet.keyInvalid");
    const candidate = createRenderClient({ auth: { kind: "key", key } });
    try {
      await candidate.user();
    } catch (error) {
      return t(`sheet.${connectMessage(error instanceof RenderError ? error.code : null)}`);
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
    await saves.current;
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
    await saves.current;
    await chooseProject(store(), slug);
    const next = await reload();
    setPickedCast(next.cast[0]?.id ?? null);
    setPickedDecor(next.currentScene);
    setPendingTake(null);
    setSheet(null);
  }, [reload, store]);

  const createProject = useCallback(async (name: string) => {
    await saves.current;
    await makeProject(store(), name);
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

  const saveReference = useCallback(async (input: { original?: NamedReference; name: string; description: string; category: ReferenceCategory; images: { file?: File; path?: string }[] }): Promise<NamedReference> => {
    const name = cleanCardName(input.name);
    if (!name || !REFERENCE_CATEGORIES.includes(input.category) || input.images.length < 1 || input.images.length > REFERENCE_PHOTOS_MAX) throw new Error("namedRefs.invalid");
    const slug = studioRef.current?.project ?? await ensureActiveProject(store());
    const vault = projectVault(store(), slug);
    const operation = saves.current.catch(() => {}).then(async () => {
      const all = await readNamedReferences(vault, slug);
      const original = input.original ? all.find(r => r.note === input.original!.note) : undefined;
      if (input.original && !original) throw new Error("namedRefs.changed");
      const id = original?.id ?? `${slugify(name).slice(0, 24)}-${crypto.randomUUID().slice(0, 8)}`;
      const folder = referenceNotePath(slug, id, input.category).replace(/\/[^/]+$/, "");
      const images: string[] = [], blobs: Blob[] = [];
      for (const photo of input.images) {
        if (photo.file) {
          if (!photo.file.type.startsWith("image/") || !photo.file.size) throw new Error("namedRefs.invalid");
          const path = `${folder}/${id}-${crypto.randomUUID().slice(0, 8)}.${extensionFor(photo.file.type)}`;
          await writeBlob(vault, path, photo.file); images.push(path); blobs.push(photo.file);
        } else {
          if (!photo.path?.startsWith(`Projets/${slug}/`)) throw new Error("namedRefs.invalid");
          const entry = await vault.get(photo.path);
          if (!entry?.blob) throw new Error("namedRefs.missing");
          images.push(photo.path); blobs.push(entry.blob);
        }
      }
      const sameImages = original && images.length === original.images.length && images.every((p, i) => p === original.images[i]);
      const preview = sameImages ? original.preview : images.length === 1 ? images[0] : `${folder}/${id}-planche-${crypto.randomUUID().slice(0, 8)}.png`;
      if (!sameImages && images.length > 1) await writeBlob(vault, preview, await referenceBoard(blobs, name));
      const note = original?.category === input.category ? original.note : referenceNotePath(slug, id, input.category);
      const source = original ? (await vault.get(original.note))?.text : undefined;
      await writeText(vault, note, namedReferenceNote(slug, id, { name, description: input.description, category: input.category, images, preview }, source));
      if (original && original.note !== note) await vault.remove(original.note);
      return { id, name, description: input.description.trim().slice(0, 2000), category: input.category, images, preview, note };
    });
    saves.current = operation;
    const ref = await operation;
    await reload();
    return ref;
  }, [reload, store]);

  const deleteReference = useCallback(async (ref: NamedReference) => {
    const slug = studioRef.current?.project;
    if (!slug) return;
    const vault = projectVault(store(), slug);
    const found = (await readNamedReferences(vault, slug)).find(r => r.note === ref.note);
    if (!found) throw new Error("namedRefs.changed");
    await vault.remove(found.note);
    if (found.category === 'cast') setPickedCast(current => current === found.id ? null : current);
    if (found.category === 'decor') setPickedDecor(current => current === found.id ? null : current);
    await removeUnreferenced(vault, [...found.images, found.preview]);
    await reload();
  }, [reload, store]);

  const markCreation = useCallback(async (path: string, patch: { favorite?: boolean; kept?: boolean }) => {
    const project = studioRef.current?.project;
    if (!project || !path.startsWith(`Projets/${project}/`)) throw new Error("media.path");
    const next = await updateCatalog(store(), project, c => ({ ...c, assets: c.assets.map(a => {
      if (a.localPath !== path) return a;
      const tags = new Set(a.organization.tags);
      if (patch.favorite !== undefined) { if (patch.favorite) tags.add("favori"); else tags.delete("favori"); }
      return { ...a, organization: { ...a.organization, tags: [...tags], ...(patch.kept !== undefined ? { validated: patch.kept } : {}) } };
    }) }));
    if (studioRef.current?.project === project) setCatalog(next);
  }, [store]);

  const storeCreationInput = useCallback(async (file: File) => {
    if (!/^(image|audio)\//.test(file.type) || !file.size) throw new Error("bubble.invalid");
    const slug = studioRef.current?.project ?? await ensureActiveProject(store());
    const path = `Projets/${slug}/Assets/source-${crypto.randomUUID()}.${file.type.startsWith("audio/") ? audioExtension(file) : extensionFor(file.type)}`;
    await writeBlob(projectVault(store(), slug), path, file);
    const url = URL.createObjectURL(file);
    retiredUrls.current.push(url);
    await reload();
    return { path, url };
  }, [reload, store]);

  const promoteExempleRefs = useCallback(async (specs: readonly ExempleRefSpec[]) => {
    const promoted = await promoteDemoRefs(store(), specs);
    await reload();
    return promoted;
  }, [reload, store]);

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

  const savePrevis = useCallback(async (file: File) => {
    const slug = current.project ?? await ensureActiveProject(store());
    const vault = projectVault(store(), slug);
    const id = `previs-${crypto.randomUUID()}`;
    const path = `Projets/${slug}/Assets/${id}.${file.type === "video/mp4" ? "mp4" : "webm"}`;
    const note = `Projets/${slug}/Assets/${id}.md`;
    await writeBlob(vault, path, file);
    await writeText(vault, note, assetNote({ id, kind: "plan", name: t("previs.localClip"), at: new Date().toISOString(), prompt: t("previs.localClipNote"), geste: "", template: "", refs: [], devis: 0, cout: 0, media: path, note, preview: null, loose: false }));
    await reload();
    return path;
  }, [current.project, reload, store, t]);

  const saveExport = useCallback(async (film: Blob, name: string) => {
    const slug = current.project ?? await ensureActiveProject(store());
    const vault = projectVault(store(), slug);
    const id = `export-${crypto.randomUUID()}`;
    const path = `Projets/${slug}/Assets/${id}.${film.type.includes("webm") ? "webm" : "mp4"}`;
    const note = `Projets/${slug}/Assets/${id}.md`;
    await writeBlob(vault, path, film);
    await writeText(vault, note, assetNote({ id, kind: "plan", name: (name.trim() || t("montage.exportName")).slice(0, 80), at: new Date().toISOString(), prompt: "", geste: "", template: "", refs: [], devis: 0, cout: 0, media: path, note, preview: null, loose: false }));
    await reload();
    return path;
  }, [current.project, reload, store, t]);

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

  const deleteShot = useCallback(async (id: string) => {
    const slug = current.project ?? await ensureActiveProject(store());
    const next = saves.current.catch(() => {}).then(() => removeShot(projectVault(store(), slug), id));
    saves.current = next;
    await next;
  }, [current.project, store]);

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
    const when = new Date();
    const stamp = `${String(when.getDate()).padStart(2, "0")}/${String(when.getMonth() + 1).padStart(2, "0")} ${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
    const placeName = cleanCardName(input.name) || "Lieu";
    const card: AssetRecord = {
      id: assetId,
      kind: "importe",
      name: cleanCardName(`${placeName} · photo · ${stamp}`) || assetId,
      at: when.toISOString(),
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

  const saveLieuCapture = useCallback(async (input: LieuCaptureInput) => {
    const name = cleanCardName(input.name);
    if (!name || input.color.size < 32) return null;
    const vault = store();
    const slug = await ensureActiveProject(vault);
    const held = studioRef.current ?? await loadStudio(vault);
    const id = uniqueId(slugify(name) || "cadrage", held.scenes.map(scene => scene.id));
    const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(2, 14);
    const files = captureFiles(id, stamp);
    const color = projectPath(slug, `Lieux/${files.color}`);
    const depth = projectPath(slug, `Lieux/${files.depth}`);
    const lines = projectPath(slug, `Lieux/${files.lines}`);
    await writeBlob(vault, color, input.color);
    await writeBlob(vault, depth, input.depth);
    await writeBlob(vault, lines, input.lines);
    const card = input.meta({ color, depth, lines });
    await writeText(vault, projectPath(slug, `Lieux/${files.meta}`), card.json);
    if (input.quartier) await writeText(vault, projectPath(slug, `Lieux/${id}.quartier.json`), input.quartier);
    const note = (card.note || input.note).replace(/\s+/g, " ").trim().slice(0, 900);
    const scene: Scene = { ...emptySceneDraft(), id, name, note, prompt: note, home: "Lieux", geste: "repere", source: "photo", stills: [color], views: [color, depth, lines] };
    await writeScene(vault, scene);
    await writeState(vault, id);
    await reload();
    setPickedDecor(id);
    return { sceneId: id, color };
  }, [reload, store]);

  /** Copies one plan's media into the project and returns the clip it becomes. Shared by single and sequence sends. */
  const prepareMontageClip = useCallback(async (vault: VaultStore, slug: string, held: Studio, input: MontageInput) => {
    const planId = input.planId.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || "plan";
    const take = input.takeId ? held.takes.find(item => item.id === input.takeId) : null;
    if (input.takeId && !take) throw new Error("Cette prise n’est plus disponible dans le projet.");
    let source = take?.video ?? "";
    let clipId = take?.id ?? `storyboard-${crypto.randomUUID()}`;
    let measured: number | null = null;
    if (take) {
      if (!(await vault.get(take.video))?.blob) throw new Error("Le fichier de la prise manque. Récupère-le avant le montage.");
    } else if (input.video) {
      // A tool's video (Animer, Prolonger…): already in the project, placed like a take, with its real length.
      const blob = (await vault.get(input.video))?.blob;
      if (!blob?.size) throw new Error("Le fichier de la vidéo manque. Rien n’a été ajouté au montage.");
      source = input.video;
      clipId = input.video.split("/").pop()!.replace(/\.[a-z0-9]+$/i, "");
      const url = URL.createObjectURL(blob);
      try { measured = await videoSeconds(url); } finally { URL.revokeObjectURL(url); }
    } else {
      if (!input.still) throw new Error("Choisis une image enregistrée ou génère une prise avant le montage.");
      const response = await fetch(input.still.startsWith("/") ? assetPath(input.still) : input.still);
      if (!response.ok) throw new Error("Impossible de lire l’image. Rien n’a été ajouté au montage.");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/") || !blob.size) throw new Error("L’image de storyboard est illisible.");
      const paths = assetPaths(slug, "importe", clipId, extensionFor(blob.type));
      source = paths.media;
      await writeBlob(vault, source, blob);
      await writeText(vault, paths.note, assetNote({ id: clipId, kind: "importe", name: `Storyboard · ${input.label}`.slice(0, 80), at: new Date().toISOString(), prompt: input.prompt, geste: "storyboard", template: "", refs: [], devis: null, cout: 0, media: source, note: paths.note, preview: null, loose: false }));
    }
    const seconds = take?.settings.seconds ?? (measured && measured > 0 ? Math.round(measured * 100) / 100 : input.seconds);
    return { planId, take, source, clipId, seconds, label: take ? take.line : input.video ? input.label : `Storyboard · ${input.label}` };
  }, []);

  const sendToMontage = useCallback(async (input: MontageInput) => {
    await saves.current;
    const slug = await ensureActiveProject(store());
    const vault = projectVault(store(), slug);
    const held = await loadStudio(vault);
    const { planId, take, source, clipId, seconds, label } = await prepareMontageClip(vault, slug, held, input);
    const previous = held.shots.find(shot => shot.id === planId);
    const sequence = held.sequences.find(item => item.id === previous?.sequenceId) ?? held.sequences[0] ?? { id: "suite", name: "Séquence", links: [] };
    if (take && !sequence.links.some(link => link.takeId === take.id)) sequence.links = [...sequence.links, { takeId: take.id, raccord: "" }];
    await writeSequence(vault, sequence, held.takes);
    await writeShot(vault, { id: planId, name: input.label.slice(0, 80) || planId, sequenceId: sequence.id, takeIds: [...new Set([...(previous?.takeIds ?? []), ...(take ? [take.id] : [])])], note: previous?.note ?? "", ordre: previous?.ordre ?? held.shots.length, composeur: input.composeur }, held.takes, sequence.name);
    const saved = await readMontages(vault, slug);
    const existing = saved.find(edit => edit.id === sequence.id);
    const base: Edit = existing ?? { id: sequence.id, name: sequence.name, video: [], audio: [] };
    if (!base.video.some(clip => clip.source === source)) {
      await writeMontageEdit(vault, placeStoryboard(base, { id: clipId, label, seconds, source }, demoOn && !existing), {});
    }
    await reload();
  }, [demoOn, prepareMontageClip, reload, store]);

  const sendSequence = useCallback(async (inputs: MontageInput[]) => {
    await saves.current;
    const slug = await ensureActiveProject(store());
    const vault = projectVault(store(), slug);
    const held = await loadStudio(vault);
    const sequence = held.sequences[0] ?? { id: "suite", name: "Séquence", links: [] };
    const clips: { id: string; label: string; seconds: number; source: string }[] = [];
    const takeOrder: string[] = [];
    for (const [ordre, input] of inputs.entries()) {
      if (!input.takeId && !input.still && !input.video) continue;
      const prepared = await prepareMontageClip(vault, slug, held, input);
      clips.push({ id: prepared.clipId, label: prepared.label, seconds: prepared.seconds, source: prepared.source });
      if (prepared.take) takeOrder.push(prepared.take.id);
      const previous = held.shots.find(shot => shot.id === prepared.planId);
      await writeShot(vault, { id: prepared.planId, name: input.label.slice(0, 80) || prepared.planId, sequenceId: sequence.id, takeIds: [...new Set([...(previous?.takeIds ?? []), ...(prepared.take ? [prepared.take.id] : [])])], note: previous?.note ?? "", ordre, composeur: input.composeur }, held.takes, sequence.name);
    }
    if (clips.length === 0) throw new Error("Choisis une image enregistrée ou génère une prise avant le montage.");
    // The sequence note follows the plan order; links to other takes stay after.
    const others = sequence.links.filter(link => !takeOrder.includes(link.takeId));
    sequence.links = [...takeOrder.map(takeId => sequence.links.find(link => link.takeId === takeId) ?? { takeId, raccord: "" }), ...others];
    await writeSequence(vault, sequence, held.takes);
    const saved = await readMontages(vault, slug);
    const existing = saved.find(edit => edit.id === sequence.id);
    const base: Edit = existing ?? { id: sequence.id, name: sequence.name, video: [], audio: [] };
    await writeMontageEdit(vault, orderSequence(base, clips, demoOn && !existing), {});
    await reload();
    return clips.length;
  }, [demoOn, prepareMontageClip, reload, store]);

  // Mêmes en-têtes que les rendus : clé → x-api-key, connexion Comfy → Bearer (Router accepte les deux).
  const agentAuth = (): Promise<Record<string, string> | null> => getComfyAuthHeaders(
    link.mode === "key" ? { kind: "key", key: link.key } : link.mode === "session" ? { kind: "session", token: () => tokens.token() } : null,
  );
  const value: StudioSession = {
    catalog, syncMedia, verifyMedia: checkMedia, cacheMedia: fetchMedia, previewMedia, classifyMedia, importManifest,
    prefs, setPrefs,
    ready, demo: demoOn, studio: current, media, cast, decor, references, saveReference, deleteReference, markCreation, storeCreationInput, pickedCast, pickedDecor, line, setLine, notice, setNotice, sheet, setSheet,
    connected, balance, balanceNote, takeQuote, gate, settings, run, creating, folderMode, folderName,
    pendingTake, runOrigin, requestRun, confirmRun: () => paid(confirmRun, undefined), cancelRun, resetRun, resumeRun, identifyPendingJob, refreshBalance, connectKey, sessionLinked, disconnect, agentAuth, linkMode: link.mode,
    loose, createCast: input => tracked({ project: current.project ?? undefined, tool: null, label: "taches.cast" }, () => paid(() => createCast(input), false), ok => ({ ok })), createDecor: input => tracked({ project: current.project ?? undefined, tool: null, label: "taches.decor" }, () => paid(() => createDecor(input), false), ok => ({ ok })), createStem: input => paid(() => createStem(input), null), finaliseMontage: input => paid(() => finaliseMontage(input), { ok: false, message: t("recovery.blocked"), kind: "pending" as const, intact: false, reconnect: false, retry: true } as FinaliseOutcome), runVideoGeste: input => paid(() => runVideoGeste(input), { ok: false, message: t("recovery.blocked"), kind: "pending" as const, intact: false, reconnect: false, retry: true } as FinaliseOutcome), runMeshGeste: input => paid(() => runMeshGeste(input), { ok: false, message: t("recovery.blocked"), kind: "pending" as const, intact: false, reconnect: false, retry: true } as FinaliseOutcome), runSuite: input => tracked({ project: current.project ?? undefined, tool: outilParGeste(input.geste)?.id ?? null, label: outilParGeste(input.geste) ? `outils.t.${outilParGeste(input.geste)!.id}.title` : "taches.tool" }, () => paid(() => runSuite(input), { ok: false, message: t("recovery.blocked"), kind: "pending" as const, intact: false, reconnect: false, retry: true } as FinaliseOutcome), judgeOutcome), runOutil: input => tracked({ project: current.project ?? undefined, tool: input.outil, label: `outils.t.${input.outil}.title` }, () => paid(() => runOutil(input), { ok: false, message: t("recovery.blocked"), kind: "pending" as const, intact: false, reconnect: false, retry: true } as FinaliseOutcome), judgeOutcome), renameCast, renameDecor, duplicateCast, duplicateDecor, deleteCast, deleteDecor, deleteAsset, copyCastTo,
    pickCast, pickDecor, poseTake, loadMontages, saveMontage, exportCoffre, importCoffre, importFiles, importAssets, promoteExempleRefs, refreshStudio,
    pendingRef, holdRef: setPendingRef, pendingClip, holdClip: setPendingClip, copyDecorTo,
    linkFolder, allowLinkedFolder, selectProject, createProject, outgoing,
    saveModel, savePrevis, saveExport, readProjectFile, writeProjectFile, saveShot, deleteShot, saveLieu, saveLieuPhoto, saveLieuCapture, sendToMontage, sendSequence,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
