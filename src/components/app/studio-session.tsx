"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/components/i18n/provider";
import { castNote } from "@/lib/creation/fiche";
import { cleanCardName, copyCast, decorFromScene, renameById, type CastCard, type DecorCard } from "@/lib/creation/gallery";
import { creationAllowed, quoteForCast, quoteForDecor, spendAllowed } from "@/lib/creation/quotes";
import { runStill } from "@/lib/creation/still";
import { DEMO_CAST, DEMO_DECOR } from "@/lib/creation/demo";
import { coffreZip } from "@/lib/coffre/export";
import { mergeCoffreZip } from "@/lib/coffre/import";
import { folderLinkSupported, linkedStore, mirrorAll, pickFolder, type DirectoryHandle } from "@/lib/coffre/link";
import {
  emptySceneDraft, ensureActiveProject, extensionFor, loadStudio, removeScene, selectProject as chooseProject, sequenceStem, shotStem, slugify, takeId, uniqueId,
  writeBlob, writeLook, writeScene, writeSequence, writeShot, writeState, writeText,
  type Scene, type Shot, type Studio, type Take,
} from "@/lib/coffre/model";
import { allowFolder, folderPermission, loadFolderHandle, readFolder, saveFolderHandle } from "@/lib/coffre/permit";
import { idbVault, type VaultStore } from "@/lib/coffre/store";
import { posePlan } from "@/lib/ergonomie";
import { type Balance } from "@/lib/credits";
import { priseGate, resolveTakeQuote, type TakeQuote } from "@/lib/render/billed-quote";
import { createRenderClient, RenderError, type RenderClient } from "@/lib/render/client";
import { learnTakeCost } from "@/lib/render/landed-cost";
import { quotesToRecords } from "@/lib/render/measured-quote";
import { referencePaths } from "@/lib/render/references";
import { followTake, submitTake, type TakeRunEvent } from "@/lib/render/run";
import { sessionTokens } from "@/lib/render/session";
import { settleLandedTake } from "@/lib/render/settle-take";
import { readInFlight, readRenderLink, saveInFlight, saveRenderLink, cleanApiKey, type InFlight, type RenderLink } from "@/lib/render/settings";
import { DEFAULT_TAKE, takeProfile, type TakeSettings } from "@/lib/render/take-graph";
import { takePrompt } from "@/lib/render/take-prompt";

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
  requestRun(): Promise<void>;
  confirmRun(): Promise<void>;
  cancelRun(): void;
  resetRun(): void;
  resumeRun(): void;
  refreshBalance(): Promise<Balance | null>;
  connectKey(raw: string): Promise<string | null>;
  sessionLinked(): Promise<boolean>;
  disconnect(): Promise<void>;
  creating: boolean;
  createCast(input: { name: string; prompt: string; source: "texte" | "photos"; files: File[]; confirmed: boolean }): Promise<boolean>;
  createDecor(input: { name: string; prompt: string; source: "texte" | "photo"; file: File | null; confirmed: boolean }): Promise<boolean>;
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
  exportCoffre(): Promise<void>;
  importCoffre(file: File): Promise<void>;
  importFiles(files: File[]): Promise<void>;
  linkFolder(): Promise<void>;
  allowLinkedFolder(): Promise<void>;
  selectProject(slug: string): Promise<void>;
  outgoing(): string;
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
  const abort = useRef<AbortController | null>(null);
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

  const store = useCallback((): VaultStore => {
    const base = baseRef.current ?? idbVault();
    baseRef.current = base;
    return linkedStore(base, () => folderRef.current);
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
    for (const path of next.look.photos) wanted.add(path);
    for (const path of wanted) {
      const entry = await vault.get(path);
      if (!entry?.blob) continue;
      urls[path] = URL.createObjectURL(entry.blob);
    }
    for (const url of Object.values(mediaRef.current)) URL.revokeObjectURL(url);
    mediaRef.current = urls;
    setMedia(urls);
  }, []);

  const reload = useCallback(async () => {
    const next = await loadStudio(store());
    setStudio(next);
    await showMedia(store(), next);
    return next;
  }, [setStudio, showMedia, store]);

  const client = useMemo<RenderClient | null>(() => {
    if (link.mode === "key") return createRenderClient({ auth: { kind: "key", key: link.key } });
    if (link.mode === "session") return createRenderClient({ auth: { kind: "session", token: () => tokens.token() } });
    return null;
  }, [link, tokens]);

  const refreshBalance = useCallback(async (): Promise<Balance | null> => {
    if (!client) {
      setBalance(null);
      return null;
    }
    try {
      const credits = await client.balance();
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
      setBalance(null);
      if (error instanceof RenderError && error.code === "auth") setConnected(false);
      setBalanceNote(error instanceof Error ? error.message : "Solde illisible.");
      return null;
    }
  }, [client]);

  const finish = useCallback(async (flight: InFlight, renderClient: RenderClient) => {
    abort.current = new AbortController();
    try {
      const result = await followTake(renderClient, flight.jobId, flight.balanceBefore, event => setRun({ phase: "running", event }), { signal: abort.current.signal });
      const id = takeId(new Date(flight.at), flight.sceneName || "prise");
      const video = `Projets/${(await ensureActiveProject(store()))}/Prises/${id}.${extensionFor(result.video.type || "video/mp4")}`;
      await writeBlob(store(), video, result.video);
      const frame = await posterOf(result.video);
      const poster = frame ? `Projets/${(await ensureActiveProject(store()))}/Prises/${id}.jpg` : null;
      if (frame && poster) await writeBlob(store(), poster, frame);
      const current = studioRef.current ?? await loadStudio(store());
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
      await settleLandedTake(store(), take, current.sequences, current.shots, takes, current.loras);
      saveInFlight(localStorage, null);
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
      await reload();
      setRun({ phase: "done", takeId: id });
    } catch (error) {
      const failure = error instanceof RenderError ? error : new RenderError("failed", error instanceof Error ? error.message : "La prise n’a pas abouti.");
      if (failure.code !== "network") saveInFlight(localStorage, null);
      setRun({ phase: "error", code: failure.code, message: failure.message, detail: failure.detail });
    } finally {
      abort.current = null;
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
    setLink(readRenderLink(localStorage));
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
            await readFolder(remembered, baseRef.current).catch(() => {});
          } else setFolderMode(permission === "denied" ? "off" : "ask");
        }
      }
      const next = await reload();
      if (gone) return;
      if (!cast && next.cast[0]) setPickedCast(next.cast[0].id);
      if (!decor && next.currentScene) setPickedDecor(next.currentScene);
      setReady(true);
      const flight = client ? readInFlight(localStorage) : null;
      if (flight && client) {
        setRun({ phase: "running", event: { stage: "queue", jobId: flight.jobId } });
        void finish(flight, client);
      }
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
  const settings = DEFAULT_TAKE;
  const takeQuote = resolveTakeQuote(takeProfile(settings), quotesToRecords(current.quotes));
  const gate = priseGate(balance, takeQuote);

  const setLine = useCallback((next: string) => {
    const value = next.slice(0, 240);
    setLineState(value);
    try { localStorage.setItem(LINE_KEY, value); } catch {}
  }, []);

  const outgoing = useCallback(() => {
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
  }, [cast, current.look.photos, current.look.traits, current.scenes, line, pickedCast, pickedDecor, t]);

  const createCast = useCallback(async (input: { name: string; prompt: string; source: "texte" | "photos"; files: File[]; confirmed: boolean }) => {
    const quote = quoteForCast(input.source);
    if (!spendAllowed(quote.credits, input.confirmed)) return false;
    if (!client) {
      setNotice(t("create.needLink"));
      return false;
    }
    const name = cleanCardName(input.name);
    if (!name) return false;
    if (input.source === "photos" && (input.files.length < 2 || input.files.length > 3)) return false;
    if (input.source === "texte" && !input.prompt.trim()) return false;
    const fresh = await refreshBalance();
    if (!creationAllowed(true, fresh?.credits ?? null, quote.high)) {
      setNotice(t("create.needCeiling"));
      return false;
    }
    const vault = store();
    const slug = await ensureActiveProject(vault);
    const held = studioRef.current ?? await loadStudio(vault);
    const id = uniqueId(slugify(name), held.cast.map(card => card.id));
    setCreating(true);
    try {
      const result = await runStill(client, {
        kind: input.source === "photos" ? "planche" : "texte-cast",
        prompt: input.prompt.trim(),
        pictures: input.files.slice(0, 3).map((file, index) => ({ blob: file, name: `uttu-${index + 1}.jpg` })),
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
        clientId: crypto.randomUUID(),
        balanceBefore: fresh?.credits ?? 0,
      });
      const photos: string[] = [];
      for (const [index, file] of input.files.slice(0, 3).entries()) {
        const path = `Projets/${slug}/Cast/${id}-p${index + 1}.jpg`;
        photos.push(path);
        await writeBlob(vault, path, file);
      }
      const sheet = `Projets/${slug}/Cast/${id}.png`;
      await writeBlob(vault, sheet, result.image);
      const at = new Date().toISOString();
      await writeText(vault, `Projets/${slug}/Cast/${id}.md`, castNote({
        id, name, at, prompt: input.prompt.trim(), source: input.source, photos, sheet,
        template: quote.template, quote: quote.credits, cost: result.costCredits, project: slug,
      }));
      await writeLook(vault, { ...held.look, name, photos: [sheet, ...photos].slice(0, 3) });
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
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
  }, [client, refreshBalance, reload, store, t]);

  const createDecor = useCallback(async (input: { name: string; prompt: string; source: "texte" | "photo"; file: File | null; confirmed: boolean }) => {
    const quote = quoteForDecor(input.source);
    if (!spendAllowed(quote.credits, input.confirmed)) return false;
    if (!client) {
      setNotice(t("create.needLink"));
      return false;
    }
    const name = cleanCardName(input.name);
    if (!name) return false;
    if (input.source === "texte" && !input.prompt.trim()) return false;
    if (input.source === "photo" && !input.file) return false;
    const fresh = await refreshBalance();
    if (!creationAllowed(true, fresh?.credits ?? null, quote.high)) {
      setNotice(t("create.needCeiling"));
      return false;
    }
    const vault = store();
    const slug = await ensureActiveProject(vault);
    const held = studioRef.current ?? await loadStudio(vault);
    const id = uniqueId(slugify(name), held.scenes.map(scene => scene.id));
    setCreating(true);
    try {
      const result = await runStill(client, {
        kind: input.source === "photo" ? "photo-decor" : "texte-decor",
        prompt: input.prompt.trim(),
        pictures: input.file ? [{ blob: input.file, name: "uttu-lieu.jpg" }] : [],
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
      };
      await writeScene(vault, scene);
      await writeState(vault, id);
      if (result.balanceAfter !== null) setBalance({ credits: result.balanceAfter, readAt: Date.now() });
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
  }, [client, refreshBalance, reload, store, t]);

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
    for (const path of [...card.photos, ...(card.sheet ? [card.sheet] : [])]) await vault.remove(path);
    if (pickedCast === id) setPickedCast(null);
    await reload();
  }, [current.cast, current.project, pickedCast, reload, store]);

  const copyCastTo = useCallback(async (id: string, slug: string) => {
    const card = current.cast.find(item => item.id === id);
    if (!card || slug === current.project) return;
    const vault = store();
    const copy = copyCast(card, uniqueId(card.id, [card.id]), new Date().toISOString());
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

  const requestRun = useCallback(async () => {
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
    const place = held?.scenes.find(item => item.id === pickedDecor) ?? null;
    const who = held?.cast.find(item => item.id === pickedCast) ?? null;
    const photos = who ? [...who.photos, ...(who.sheet ? [who.sheet] : [])] : (held?.look.photos ?? []);
    const prompt = outgoing();
    if (!prompt.trim()) {
      setNotice(t("create.noPicture"));
      return;
    }
    const vault = store();
    const pictures: { blob: Blob; name: string }[] = [];
    for (const path of referencePaths(photos, place)) {
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
      const jobId = await submitTake(client, {
        pictures, prompt, settings, seed: crypto.getRandomValues(new Uint32Array(1))[0], clientId: crypto.randomUUID(),
      }, event => setRun({ phase: "running", event }), abort.current.signal);
      const flight: InFlight = {
        jobId, at: new Date().toISOString(), sceneId: place?.id ?? null, sceneName: place?.name ?? "", line, prompt, settings, balanceBefore: fresh.credits,
      };
      saveInFlight(localStorage, flight);
      await finish(flight, client);
    } catch (error) {
      const failure = error instanceof RenderError ? error : new RenderError("failed", error instanceof Error ? error.message : "La prise n’a pas abouti.");
      setRun({ phase: "error", code: failure.code, message: failure.message, detail: failure.detail });
      abort.current = null;
    }
  }, [client, finish, line, outgoing, pickedCast, pickedDecor, refreshBalance, run.phase, settings, store, t]);

  const cancelRun = useCallback(() => {
    abort.current?.abort();
  }, []);

  const resetRun = useCallback(() => setRun({ phase: "idle" }), []);

  const resumeRun = useCallback(() => {
    const flight = readInFlight(localStorage);
    if (flight && client) {
      setRun({ phase: "running", event: { stage: "queue", jobId: flight.jobId } });
      void finish(flight, client);
      return;
    }
    setRun({ phase: "idle" });
  }, [client, finish]);

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
      const path = parts.join("/");
      if (!path || path.split("/").length > 4) continue;
      if (PICTURE.test(file.name) || VIDEO.test(file.name)) await writeBlob(vault, path, file);
      else if (/\.(md|json|txt)$/i.test(file.name)) await writeText(vault, path, await file.text());
      else continue;
      written += 1;
    }
    await reload();
    setNotice(t("create.imported", { count: written }));
  }, [reload, store, t]);

  const attachFolder = useCallback(async (handle: DirectoryHandle) => {
    folderRef.current = handle;
    await saveFolderHandle(handle);
    const base = baseRef.current ?? idbVault();
    baseRef.current = base;
    await readFolder(handle, base);
    await mirrorAll(base, handle);
    setFolderName(handle.name);
    setFolderMode("on");
    await reload();
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

  const selectProject = useCallback(async (slug: string) => {
    await chooseProject(store(), slug);
    await reload();
  }, [reload, store]);

  useEffect(() => {
    if (!demoOn || !ready) return;
    setPickedCast(prev => prev ?? DEMO_CAST[0]?.id ?? null);
    setPickedDecor(prev => prev ?? DEMO_DECOR[0]?.id ?? null);
  }, [demoOn, ready]);

  const value: StudioSession = {
    ready, demo: demoOn, studio: current, media, cast, decor, pickedCast, pickedDecor, line, setLine, notice, setNotice, sheet, setSheet,
    connected, balance, balanceNote, takeQuote, gate, settings, run, creating, folderMode, folderName,
    requestRun, confirmRun, cancelRun, resetRun, resumeRun, refreshBalance, connectKey, sessionLinked, disconnect,
    createCast, createDecor, renameCast, renameDecor, duplicateCast, duplicateDecor, deleteCast, deleteDecor, copyCastTo,
    pickCast, pickDecor, poseTake, exportCoffre, importCoffre, importFiles, linkFolder, allowLinkedFolder, selectProject, outgoing,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
