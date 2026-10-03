"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { costClaim, runGate, type Balance, type CostClaim, type RunGate } from "@/lib/credits";
import { coffreZip } from "@/lib/coffre/export";
import { linkedStore, mirrorAll, pickFolder, type DirectoryHandle } from "@/lib/coffre/link";
import {
  LOOK_PHOTOS_MAX, SCENE_STILLS_MAX, emptyStudio, extensionFor, loadStudio, removeScene, removeTake, slugify, takeId, uniqueId,
  writeBlob, writeLook, writeScene, writeState, writeTake, type Look, type Scene, type Studio, type Take,
} from "@/lib/coffre/model";
import { idbVault, type VaultStore } from "@/lib/coffre/store";
import { readGuide, saveGuide, type GuideMoment, type GuideState } from "@/lib/guide";
import { createRenderClient, RenderError, type RenderClient } from "@/lib/render/client";
import { followTake, submitTake, type TakeRunEvent } from "@/lib/render/run";
import { sessionTokens } from "@/lib/render/session";
import {
  readInFlight, readRenderLink, saveInFlight, saveRenderLink, cleanApiKey, type InFlight, type RenderLink,
} from "@/lib/render/settings";
import { DEFAULT_TAKE, takeProfile, type TakeSettings } from "@/lib/render/take-graph";
import { takePrompt } from "@/lib/render/take-prompt";

export type Sheet = null | "connect" | "credits" | "coffre" | "confirm" | { take: string };

export type RunState =
  | { phase: "idle" }
  | { phase: "running"; event: TakeRunEvent | { stage: "start" } }
  | { phase: "done"; takeId: string }
  | { phase: "error"; code: string; message: string; detail: string[] };

const PICTURE_EDGE = 1536;
const SETTINGS_KEY = "u-ttu-reglage";
const LINE_KEY = "u-ttu-plan";

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
  setLine(line: string): void;
  setSettings(patch: Partial<TakeSettings>): void;
  requestRun(): Promise<void>;
  confirmRun(): Promise<void>;
  cancelRun(): void;
  resetRun(): void;
  deleteTake(id: string): Promise<void>;
  refreshBalance(): Promise<Balance | null>;
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
  const wake = useRef<{ release(): Promise<void> } | null>(null);
  const studioRef = useRef<Studio>(emptyStudio());

  const [ready, setReady] = useState(false);
  const [studio, setStudioState] = useState<Studio>(emptyStudio());
  const [media, setMedia] = useState<Record<string, string>>({});
  const [line, setLineState] = useState("");
  const [settings, setSettingsState] = useState<TakeSettings>(DEFAULT_TAKE);
  const [link, setLink] = useState<RenderLink>({ mode: "none" });
  const [connected, setConnected] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceNote, setBalanceNote] = useState("");
  const [run, setRun] = useState<RunState>({ phase: "idle" });
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

  const refreshBalance = useCallback(async (): Promise<Balance | null> => {
    if (!client) {
      setBalance(null);
      return null;
    }
    try {
      const credits = await client.balance();
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
      setBalance(null);
      if (error instanceof RenderError && error.code === "auth") setConnected(false);
      setBalanceNote(error instanceof Error ? error.message : "Solde illisible.");
      return null;
    }
  }, [client]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setGuide(readGuide(localStorage));
      setSettingsState(readSettings());
      setLineState(localStorage.getItem(LINE_KEY) ?? "");
      setLink(readRenderLink(localStorage));
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
  const gate = useMemo(() => runGate(balance, claim), [balance, claim]);

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

  const selectScene = useCallback(async (id: string) => {
    setStudio({ ...studioRef.current, currentScene: id });
    await writeState(store(), id);
  }, [setStudio, store]);

  const addScene = useCallback(async (name: string) => {
    const clean = name.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!clean) return;
    const id = uniqueId(slugify(clean), studioRef.current.scenes.map(item => item.id));
    const created: Scene = { id, name: clean, note: "", stills: [] };
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
    const scenes = studioRef.current.scenes.filter(item => item.id !== id);
    const currentScene = studioRef.current.currentScene === id ? scenes[0]?.id ?? null : studioRef.current.currentScene;
    setStudio({ ...studioRef.current, scenes, currentScene });
    await writeState(store(), currentScene);
  }, [dropMedia, setStudio, store]);

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
      };
      const takes = [take, ...studioRef.current.takes.filter(item => item.id !== id)];
      await writeTake(store(), take, takes);
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

  useEffect(() => {
    if (!ready || !client || run.phase !== "idle") return;
    const flight = readInFlight(localStorage);
    if (!flight) return;
    setRun({ phase: "running", event: { stage: "queue", jobId: flight.jobId } });
    void finish(flight, client);
  }, [client, finish, ready, run.phase]);

  const requestRun = useCallback(async () => {
    if (!client || !connected) {
      setSheet("connect");
      return;
    }
    await refreshBalance();
    setSheet("confirm");
  }, [client, connected, refreshBalance]);

  const confirmRun = useCallback(async () => {
    if (!client || run.phase === "running") return;
    const fresh = await refreshBalance();
    const freshGate = runGate(fresh, claim);
    if (!fresh || !freshGate.allowed) return;
    setSheet(null);
    setRun({ phase: "running", event: { stage: "start" } });
    const current = studioRef.current;
    const place = current.scenes.find(item => item.id === current.currentScene) ?? null;
    const vault = store();
    const pictures: { blob: Blob; name: string }[] = [];
    for (const [index, path] of [...current.look.photos, ...(place?.stills ?? [])].entries()) {
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
  }, [claim, client, finish, line, refreshBalance, run.phase, settings, store]);

  const cancelRun = useCallback(() => abort.current?.abort(), []);
  const resetRun = useCallback(() => setRun({ phase: "idle" }), []);

  const deleteTake = useCallback(async (id: string) => {
    const take = studioRef.current.takes.find(item => item.id === id);
    if (!take) return;
    const takes = studioRef.current.takes.filter(item => item.id !== id);
    await removeTake(store(), take, takes);
    dropMedia(take.video);
    if (take.poster) dropMedia(take.poster);
    setStudio({ ...studioRef.current, takes });
  }, [dropMedia, setStudio, store]);

  const connectKey = useCallback(async (raw: string): Promise<string | null> => {
    const key = cleanApiKey(raw);
    if (!key) return "Cette clé n’a pas la forme d’une clé de rendu.";
    const candidate = createRenderClient({ auth: { kind: "key", key } });
    try {
      await candidate.user();
    } catch (error) {
      return error instanceof Error ? error.message : "Clé refusée.";
    }
    const next: RenderLink = { mode: "key", key };
    saveRenderLink(localStorage, next);
    setLink(next);
    setConnected(true);
    return null;
  }, []);

  const sessionLinked = useCallback(async (): Promise<boolean> => {
    if (!(await tokens.connected())) return false;
    const next: RenderLink = { mode: "session" };
    saveRenderLink(localStorage, next);
    setLink(next);
    setConnected(true);
    return true;
  }, [tokens]);

  const disconnect = useCallback(async () => {
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

  const value: StudioValue = {
    ready, studio, media, scene, line, settings, claim, gate, link, connected, balance, balanceNote, run, sheet, folder, guide, notice,
    setSheet, setNotice, saveLook, addLookPhotos, removeLookPhoto, addScene, saveScene, addSceneStills, removeSceneStill, deleteScene, selectScene,
    setLine, setSettings, requestRun, confirmRun, cancelRun, resetRun, deleteTake, refreshBalance, connectKey, sessionLinked, disconnect,
    exportCoffre, linkFolder, dismissGuide, guideOff,
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}
