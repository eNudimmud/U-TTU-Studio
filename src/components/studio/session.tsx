"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DATASET_SIZE, FLUX_STACK, maxSafeSteps, type ComfyPlan } from "@/lib/comfy-stack";
import { bootstrapPlan } from "@/lib/fal-bootstrap";
import { FAL_VARY } from "@/lib/fal-stack";
import { trackEvent } from "@/lib/analytics";
import { captionsBlock } from "@/lib/gate/report";
import { GATE, canKeep, evaluateGate, type ConfirmationId, type DatasetImage, type GateResult } from "@/lib/gate/rules";
import type { Angle, Framing } from "@/lib/gate/vocabulary";
import { falProxyUrl } from "@/lib/site";
import type { ExportState } from "../guide/train-step";

const PLAN = bootstrapPlan();
const MAX_IMPORT = 60;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface StudioSession {
  trigger: string;
  setTrigger: (value: string) => void;
  invariants: string;
  setInvariants: (value: string) => void;
  token: string;
  setToken: (value: string) => void;
  images: DatasetImage[];
  previews: Record<string, string>;
  confirmations: Partial<Record<ConfirmationId, boolean>>;
  progress: { done: number; total: number } | null;
  notice: string;
  highlight: Set<string>;
  result: GateResult;
  passed: boolean;
  captions: string;
  signature: string;
  refPreviews: { name: string; url: string }[];
  arrived: boolean[];
  boot: { phase: "idle" | "sending" | "running"; done: number; message: string };
  bootStatus: string;
  showReview: boolean;
  setShowReview: (value: boolean) => void;
  falProxyOn: boolean;
  plan: ComfyPlan;
  setPlan: (value: ComfyPlan) => void;
  steps: number;
  setSteps: (value: number) => void;
  scene: string;
  setScene: (value: string) => void;
  strength: number;
  setStrength: (value: number) => void;
  seed: number;
  setSeed: (value: number) => void;
  count: number;
  setCount: (value: number) => void;
  shownExport: ExportState;
  testDone: boolean;
  setTestDone: (done: boolean) => void;
  realLaunched: boolean;
  setRealLaunched: (value: boolean) => void;
  received: boolean;
  setReceived: (value: boolean) => void;
  canLaunch: boolean;
  addFiles: (list: File[]) => Promise<void>;
  updateImage: (id: string, patch: Partial<DatasetImage>) => void;
  clearAll: () => void;
  showImages: (ids: string[]) => void;
  setRefs: (list: File[]) => void;
  keepProposed: () => void;
  rejectUntriaged: () => void;
  setConfirm: (id: ConfirmationId, value: boolean) => void;
  bootstrap: () => Promise<void>;
  exportZip: () => Promise<void>;
  buildFalZip: (onProgress: (done: number, total: number) => void) => Promise<Blob>;
}

const SessionContext = createContext<StudioSession | null>(null);

export function useStudioSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session studio absente.");
  return value;
}

export function StudioSessionProvider({ children }: { children: ReactNode }) {
  const [showReview, setShowReview] = useState(false);
  const importing = useRef(false);
  const alive = useRef(true);
  const bootGeneration = useRef(0);
  const bootLock = useRef(false);
  const [trigger, setTrigger] = useState("");
  const [invariants, setInvariants] = useState("");
  const [token, setToken] = useState("");
  const [images, setImages] = useState<DatasetImage[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [confirmations, setConfirmations] = useState<Partial<Record<ConfirmationId, boolean>>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<ComfyPlan>("standard");
  const [steps, setSteps] = useState<number>(FLUX_STACK.training.steps);
  const [scene, setScene] = useState("");
  const [strength, setStrength] = useState<number>(FLUX_STACK.image.strength);
  const [seed, setSeed] = useState<number>(FLUX_STACK.image.seed);
  const [count, setCount] = useState<number>(FLUX_STACK.image.count);
  const [exportState, setExportState] = useState<ExportState>({ state: "idle" });
  const [exportedSignature, setExportedSignature] = useState("");
  const [testedSignature, setTestedSignature] = useState("");
  const [realLaunched, setRealLaunched] = useState(false);
  const [received, setReceived] = useState(false);
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refPreviews, setRefPreviews] = useState<{ name: string; url: string }[]>([]);
  const [arrived, setArrived] = useState<boolean[]>(() => PLAN.map(() => false));
  const [boot, setBoot] = useState<{ phase: "idle" | "sending" | "running"; done: number; message: string }>({ phase: "idle", done: 0, message: "" });
  const files = useRef(new Map<string, File>());
  const urls = useRef(new Set<string>());
  const refUrls = useRef<string[]>([]);
  const nextId = useRef(0);
  const passedOnce = useRef(false);

  const input = useMemo(() => ({ trigger, invariants, images, confirmations }), [trigger, invariants, images, confirmations]);
  const result = useMemo(() => evaluateGate(input), [input]);
  const passed = result.verdict === "PASS";
  const captions = captionsBlock(result.captions);
  const signature = passed ? `${result.kept.map(image => image.id).join(",")}|${captions}` : "";
  const testDone = passed && testedSignature === signature;
  const setTestDone = (done: boolean) => setTestedSignature(done ? signature : "");
  const exportSignature = `${signature}|${steps}|${count}`;
  const shownExport: ExportState = exportState.state === "done" ? { ...exportState, stale: exportSignature !== exportedSignature } : exportState;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      urls.current.forEach(url => URL.revokeObjectURL(url));
      refUrls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    if (passed && !passedOnce.current) trackEvent("gate_pass");
    passedOnce.current = passed;
  }, [passed]);
  useEffect(() => {
    setRealLaunched(false);
    setReceived(false);
  }, [signature, steps, scene, strength, seed, count]);

  async function addFiles(list: File[]) {
    if (importing.current) return;
    const room = Math.max(0, MAX_IMPORT - images.length);
    const imageFiles = list.filter(file => file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name));
    const incoming = imageFiles.slice(0, room);
    setNotice([
      imageFiles.length > room ? `Import limité à ${MAX_IMPORT} images au total.` : "",
      list.length > imageFiles.length ? "Fichiers non image ignorés." : "",
    ].filter(Boolean).join(" "));
    if (!incoming.length) return;
    importing.current = true;
    setProgress({ done: 0, total: incoming.length });
    setShowReview(true);
    try {
      const { analyzeImage } = await import("@/lib/gate/browser");
      for (let i = 0; i < incoming.length; i++) {
        const file = incoming[i];
        const metrics = await analyzeImage(file);
        const id = `img-${++nextId.current}`;
        const tooSmall = metrics.readable && Math.min(metrics.width, metrics.height) < GATE.minShortSide;
        files.current.set(id, file);
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        setPreviews(previous => ({ ...previous, [id]: url }));
        setImages(previous => [...previous, { id, name: file.name, ...metrics, angle: null, framing: null, variables: "", decision: !metrics.readable || tooSmall ? "rejeter" : "a-trier", reviewed: false }]);
        setProgress({ done: i + 1, total: incoming.length });
      }
    } catch {
      setNotice("L’import a été interrompu. Les images déjà analysées sont conservées ; tu peux réessayer.");
    } finally {
      importing.current = false;
      setProgress(null);
    }
  }

  const updateImage = (id: string, patch: Partial<DatasetImage>) => setImages(previous => previous.map(image => image.id === id ? { ...image, ...patch } : image));

  function clearAll() {
    if (importing.current) return;
    urls.current.forEach(url => URL.revokeObjectURL(url));
    urls.current.clear();
    files.current.clear();
    setImages([]);
    setPreviews({});
    setHighlight(new Set());
    setExportState({ state: "idle" });
    setTestDone(false);
    setRealLaunched(false);
    setReceived(false);
  }

  function showImages(ids: string[]) {
    setHighlight(new Set(ids));
    window.setTimeout(() => setHighlight(new Set()), 4000);
  }

  function setRefs(list: File[]) {
    refUrls.current.forEach(url => URL.revokeObjectURL(url));
    const imageFiles = list.filter(file => file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name));
    const incoming = imageFiles.slice(0, FAL_VARY.maxRefs);
    const next = incoming.map(file => ({ name: file.name, url: URL.createObjectURL(file) }));
    refUrls.current = next.map(item => item.url);
    setRefFiles(incoming);
    setRefPreviews(next);
    const extra = list.length - incoming.length;
    setNotice(extra > 0 ? `Seules ${FAL_VARY.maxRefs} photos partent. Les autres sont ignorées.` : "");
  }

  function keepProposed() {
    setImages(previous => previous.map(image => {
      if (image.decision !== "a-trier") return image;
      if (!canKeep(result.flags[image.id] ?? [])) return image;
      return { ...image, decision: "garder" as const };
    }));
  }

  async function adoptGenerated(batch: { file: File; angle: Angle; framing: Framing; variables: string }[]) {
    const { analyzeImage } = await import("@/lib/gate/browser");
    const next: DatasetImage[] = [];
    const nextPreviews: Record<string, string> = {};
    for (const item of batch) {
      const metrics = await analyzeImage(item.file);
      const id = `img-${++nextId.current}`;
      files.current.set(id, item.file);
      const url = URL.createObjectURL(item.file);
      urls.current.add(url);
      nextPreviews[id] = url;
      const tooSmall = metrics.readable && Math.min(metrics.width, metrics.height) < GATE.minShortSide;
      next.push({
        id, name: item.file.name, ...metrics,
        angle: item.angle, framing: item.framing, variables: item.variables,
        decision: !metrics.readable || tooSmall ? "rejeter" : "a-trier", reviewed: false,
      });
    }
    setPreviews(nextPreviews);
    setImages(next);
  }

  async function bootstrap() {
    if (!falProxyUrl || bootLock.current) return;
    bootLock.current = true;
    const generation = ++bootGeneration.current;
    const client = { url: falProxyUrl, token: token.trim() };
    setBoot({ phase: "sending", done: 0, message: "" });
    setArrived(PLAN.map(() => false));
    setShowReview(false);
    clearAll();
    trackEvent("fal_bootstrap_started");
    try {
      const { startFalBootstrap, fetchFalFile, falJobStatus } = await import("@/lib/fal-proxy");
      const started = await startFalBootstrap(client, refFiles, trigger.trim());
      if (!alive.current || generation !== bootGeneration.current) return;
      setBoot({ phase: "running", done: 0, message: "Les cadrages arrivent. Tu peux laisser cette page ouverte." });
      const batch: ({ file: File; angle: Angle; framing: Framing; variables: string } | null)[] = started.slots.map(() => null);
      await Promise.all(started.slots.map(async (slot, index) => {
        try {
          let errors = 0;
          for (;;) {
            if (!alive.current || generation !== bootGeneration.current) return;
            try {
              const next = await falJobStatus(client, "vary", slot.id);
              errors = 0;
              if (next.status === "FAILED") throw new Error(next.error);
              if (next.status === "COMPLETED") {
                const blob = await fetchFalFile(client, next.result.image);
                batch[index] = {
                  file: new File([blob], `${String(slot.index).padStart(2, "0")}.jpg`, { type: blob.type || "image/jpeg" }),
                  angle: slot.angle, framing: slot.framing, variables: slot.variables,
                };
                setArrived(previous => previous.map((value, i) => (i === index ? true : value)));
                setBoot(previous => ({ ...previous, done: previous.done + 1 }));
                return;
              }
            } catch (error) {
              if (++errors >= 3) throw error;
            }
            await sleep(2000);
          }
        } catch {
          batch[index] = null;
        }
      }));
      if (!alive.current || generation !== bootGeneration.current) return;
      const ready = batch.filter((item): item is NonNullable<typeof item> => item !== null);
      if (ready.length) await adoptGenerated(ready);
      const missing = started.slots.length - ready.length;
      setBoot({
        phase: "idle", done: ready.length,
        message: missing
          ? `${ready.length} images sur ${started.slots.length} reçues. Relancer prépare tout le lot à nouveau, et le refacture. Tu peux aussi remplacer les manquantes à la main.`
          : "Lot reçu. Garde les images qui sont bien la même personne, puis confirme.",
      });
      setShowReview(true);
      document.getElementById("revue")?.scrollIntoView({ block: "start" });
    } catch (error) {
      if (!alive.current || generation !== bootGeneration.current) return;
      setBoot({ phase: "idle", done: 0, message: error instanceof Error ? error.message : "Le lot n’a pas pu être préparé." });
    } finally {
      if (generation === bootGeneration.current) bootLock.current = false;
    }
  }

  async function buildFalZip(onProgress: (done: number, total: number) => void) {
    const { buildFalZip: build } = await import("@/lib/gate/browser");
    return build(result, files.current, onProgress);
  }

  async function exportZip() {
    const kept = result.kept.length;
    setExportState({ state: "building", done: 0, total: kept });
    try {
      const { buildDatasetZip } = await import("@/lib/gate/browser");
      const blob = await buildDatasetZip(input, result, files.current, steps, count, (done, total) => setExportState({ state: "building", done, total }));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `c-micro-${trigger}-dataset.zip`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setExportedSignature(exportSignature);
      setExportState({ state: "done", size: blob.size, stale: false });
      trackEvent("dataset_zip_downloaded");
    } catch (error) {
      setExportState({ state: "error", message: error instanceof Error ? error.message : "Export impossible." });
    }
  }

  const safeRuntime = steps <= maxSafeSteps(plan, count);
  const canLaunch = passed && shownExport.state === "done" && !shownExport.stale && testDone && safeRuntime;
  const bootStatus = boot.phase === "sending" ? "Envoi des photos au proxy…" : boot.phase === "running" ? `${boot.message} ${boot.done} / ${DATASET_SIZE}.` : boot.message || notice;

  const value: StudioSession = {
    trigger, setTrigger, invariants, setInvariants, token, setToken,
    images, previews, confirmations, progress, notice, highlight, result, passed, captions, signature,
    refPreviews, arrived, boot, bootStatus, showReview, setShowReview, falProxyOn: !!falProxyUrl,
    plan, setPlan, steps, setSteps, scene, setScene, strength, setStrength, seed, setSeed, count, setCount,
    shownExport, testDone, setTestDone, realLaunched, setRealLaunched, received, setReceived, canLaunch,
    addFiles, updateImage, clearAll, showImages, setRefs, keepProposed,
    rejectUntriaged: () => setImages(previous => previous.map(image => image.decision === "a-trier" ? { ...image, decision: "rejeter" } : image)),
    setConfirm: (id, confirmed) => setConfirmations(previous => ({ ...previous, [id]: confirmed })),
    bootstrap, exportZip, buildFalZip,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
