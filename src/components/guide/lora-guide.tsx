"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DATASET_SIZE, FLUX_STACK, COMFY_APPS, estimateTrainRun, maxSafeSteps, type ComfyPlan } from "@/lib/comfy-stack";
import { bootstrapPlan } from "@/lib/fal-bootstrap";
import { FAL_VARY } from "@/lib/fal-stack";
import { trackEvent } from "@/lib/analytics";
import { captionsBlock, formatEstimate } from "@/lib/gate/report";
import { GATE, canKeep, evaluateGate, type ConfirmationId, type DatasetImage } from "@/lib/gate/rules";
import type { Angle, Framing } from "@/lib/gate/vocabulary";
import { falProxyUrl } from "@/lib/site";
import { CreatePanel } from "../studio/create-panel";
import { LoraTutorial } from "./lora-tutorial";
import type { ExportState } from "./train-step";

const loading = () => <p className="loading-panel" role="status">Ouverture…</p>;
const DatasetStep = dynamic(() => import("./dataset-step").then(m => m.DatasetStep), { loading });
const GatePanel = dynamic(() => import("./gate-panel").then(m => m.GatePanel), { loading });
const TrainStep = dynamic(() => import("./train-step").then(m => m.TrainStep), { loading });
const ImageStep = dynamic(() => import("./image-step").then(m => m.ImageStep), { loading });
const ComfyRunPanel = dynamic(() => import("./comfy-run-panel").then(m => m.ComfyRunPanel), { loading });
const TestGrid = dynamic(() => import("./test-grid").then(m => m.TestGrid), { loading });
const FalRail = dynamic(() => import("./fal-rail").then(m => m.FalRail), { loading });

const PLAN = bootstrapPlan();
const MAX_IMPORT = 60;
const onFalStage = () => {};
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function LoraGuide() {
  const [showReview, setShowReview] = useState(false);
  const [expertMounted, setExpertMounted] = useState(false);
  const [showTests, setShowTests] = useState(false);
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
    const previews = incoming.map(file => ({ name: file.name, url: URL.createObjectURL(file) }));
    refUrls.current = previews.map(item => item.url);
    setRefFiles(incoming);
    setRefPreviews(previews);
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

  const exported = shownExport.state === "done" && !shownExport.stale;
  const safeRuntime = steps <= maxSafeSteps(plan, count);
  const canLaunch = passed && exported && testDone && safeRuntime;
  const bootStatus = boot.phase === "sending" ? "Envoi des photos au proxy…" : boot.phase === "running" ? `${boot.message} ${boot.done} / ${DATASET_SIZE}.` : boot.message || notice;
  const untriaged = images.some(image => image.decision === "a-trier");

  return <section id="parcours" className="create-studio" aria-label="Créer une LoRA">
    <header className="create-hero">
      <p className="eyebrow">Créer · maintenant</p>
      <h1 id="guide-title-0" tabIndex={-1}>Deux photos.<br /><em>Une identité.</em></h1>
      <p className="create-lead">Dépose 2 ou 3 photos de la même personne. Le studio prépare 15 cadrages, tu vérifies, puis l’entraînement et l’image restent sur cette page.</p>
      <p className="create-hold">Vente HOLD · essai jusqu’au 8 octobre 2026 · rien ne part sans un clic</p>
    </header>

    <CreatePanel
      trigger={trigger} invariants={invariants} token={token} proxyOn={!!falProxyUrl}
      busy={boot.phase !== "idle"} arrived={arrived} status={bootStatus} refs={refPreviews}
      onTrigger={setTrigger} onInvariants={setInvariants} onToken={setToken} onRefs={setRefs}
      onBootstrap={bootstrap} onManual={() => { setShowReview(true); document.getElementById("revue")?.scrollIntoView({ block: "start" }); }}
    />

    <details className="disclosure create-drawer">
      <summary>Comment ça marche</summary>
      <LoraTutorial embedded startLabel="Revenir aux photos" onStart={() => document.getElementById("create-drop")?.querySelector("input")?.focus()} />
    </details>

    {(showReview || images.length > 0) && <section id="revue" className="create-review" aria-labelledby="revue-title">
      <header className="stage-heading">
        <div>
          <p className="eyebrow">Revue</p>
          <h2 id="revue-title" tabIndex={-1}>Le lot, à l’œil.</h2>
          <p>Le gate est le même : {DATASET_SIZE} images, angles, légendes. Garde ce qui est la même personne. Une fiche à la fois.</p>
        </div>
        <span className="stage-badge">{result.kept.length} / {DATASET_SIZE}</span>
      </header>
      {untriaged && <div className="review-keep"><button type="button" className="button button-outline" onClick={keepProposed}>Garder les images proposées</button><p>Celles qui sont illisibles ou trop petites restent de côté. Les 5 confirmations, en bas, restent à toi.</p></div>}
      {notice && showReview && <p className="inline-status warn" role="status">{notice}</p>}
      <div className="preparation-layout">
        <DatasetStep reviewOnly trigger={trigger} invariants={invariants} images={images} previews={previews} result={result} highlight={highlight}
          confirmations={confirmations} progress={progress} onTrigger={setTrigger} onInvariants={setInvariants} onFiles={addFiles} onUpdate={updateImage}
          onRejectUntriaged={() => setImages(previous => previous.map(image => image.decision === "a-trier" ? { ...image, decision: "rejeter" } : image))}
          onClear={clearAll} onConfirm={(id, value) => setConfirmations(previous => ({ ...previous, [id]: value }))} />
        <GatePanel result={result} onShowImages={showImages} />
      </div>
    </section>}

    <section id="entrainer" className="create-train" aria-labelledby="entrainer-title">
      <header className="stage-heading">
        <div>
          <p className="eyebrow">Entraîner · ici</p>
          <h2 id="entrainer-title">La LoRA, puis une image.</h2>
          <p>Après un lot en PASS. <code>flux-lora-fast-training</code>, puis <code>flux-lora</code>. Le fichier <code>.safetensors</code> se télécharge sur cette page.</p>
        </div>
      </header>
      {passed ? <>
        <div className="create-scene">
          <label htmlFor="create-scene">La scène de la première image, en anglais</label>
          <input id="create-scene" value={scene} onChange={event => setScene(event.target.value)} placeholder="walking in a snowy park, soft daylight" maxLength={260} spellCheck={false} />
          <p>La scène seulement. Le mot d’appel porte la personne.</p>
        </div>
        <FalRail hideTokenField token={token} onToken={setToken} onStage={onFalStage} passed={passed} trigger={trigger} scene={scene} seed={seed} signature={signature}
          onBuildZip={async onProgress => { const { buildFalZip } = await import("@/lib/gate/browser"); return buildFalZip(result, files.current, onProgress); }} />
      </> : <p className="loading-panel">L’entraînement s’ouvre quand les {DATASET_SIZE} images sont en PASS. Aucun envoi avant ce clic.</p>}
    </section>

    <details className="disclosure create-drawer expert-drawer" onToggle={event => { if (event.currentTarget.open) setExpertMounted(true); }}>
      <summary>Expert / repli — Comfy</summary>
      <p className="expert-note">Comfy ouvre un compte sur un autre site, avec ses propres traceurs au chargement du cadre. Ce n’est pas le chemin pour créer. Le cadre ne se charge qu’après un second clic.</p>
      {expertMounted && passed && <>
        <TrainStep captions={captions} steps={steps} plan={plan} count={count} exportState={shownExport} testDone={testDone}
          onSteps={setSteps} onPlan={setPlan} onExport={exportZip} onTestDone={setTestDone} />
        <ComfyRunPanel app="train" />
        <ImageStep trigger={trigger} invariants={invariants} scene={scene} strength={strength} seed={seed} count={count} steps={steps} received={received}
          onScene={setScene} onStrength={setStrength} onSeed={setSeed} onCount={setCount} onReceived={setReceived} />
        <section className="launch-summary" aria-label="Lancement Comfy"><div><h3>Lancer dans Comfy ?</h3><p>{steps} étapes · {count} image{count > 1 ? "s" : ""} + témoin · <strong>{formatEstimate(estimateTrainRun(steps, count))}</strong></p><p className="small-print">Estimation non mesurée, crédits du compte Comfy. La LoRA reste limitée à ce run.</p></div>
          {!canLaunch && <p className="inline-status warn">{!exported ? "Télécharge un ZIP à jour dans ce repli." : !testDone ? "Confirme d’abord les 3 sorties du test court." : "Réduis les étapes ou le nombre d’images pour respecter la durée du plan."}</p>}
          <a className="button button-outline" href={COMFY_APPS.train.url} target="_blank" rel="noopener noreferrer">Ouvrir Comfy ↗</a>
          <label className="check-inline"><input type="checkbox" checked={realLaunched && canLaunch} disabled={!canLaunch} onChange={event => setRealLaunched(event.target.checked)} /><span>J’ai lancé le run réel dans Comfy</span></label>
        </section>
        <details className="disclosure advanced-tools" onToggle={event => { if (event.currentTarget.open) setShowTests(true); }}><summary>Comparer les forces et tester la scène</summary>{showTests && <><TestGrid trigger={trigger} seed={seed} steps={steps} /><ComfyRunPanel app="prompt" /></>}</details>
      </>}
      {expertMounted && !passed && <p className="loading-panel">Le repli s’ouvre après un lot en PASS.</p>}
    </details>
  </section>;
}
