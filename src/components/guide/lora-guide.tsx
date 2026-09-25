"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DATASET_SIZE, FLUX_STACK, type ComfyPlan } from "@/lib/comfy-stack";
import { trackEvent } from "@/lib/analytics";
import { analyzeImage, buildDatasetZip } from "@/lib/gate/browser";
import { captionsBlock } from "@/lib/gate/report";
import { GATE, evaluateGate, type ConfirmationId, type DatasetImage } from "@/lib/gate/rules";
import { DatasetStep } from "./dataset-step";
import { ComfyRunPanel } from "./comfy-run-panel";
import { GatePanel, gateSummary, gateTone } from "./gate-panel";
import { ImageStep } from "./image-step";
import { TestGrid } from "./test-grid";
import { TrainStep, type ExportState } from "./train-step";

const MAX_IMPORT = 60;
type StepState = "todo" | "fail" | "pass" | "locked" | "ready" | "running" | "done";
const STATE_LABEL: Record<StepState, string> = { todo: "À faire", fail: "FAIL", pass: "PASS", locked: "Bloqué", ready: "Prêt", running: "En cours", done: "Fait" };

function Step({ n, title, lead, state, locked, lockedText, children }: { n: string; title: string; lead: string; state: StepState; locked?: boolean; lockedText?: string; children: ReactNode }) {
  return <section className={`guide-step state-${state}`} aria-labelledby={`step-${n}-title`}>
    <header className="guide-step-head">
      <span className="guide-step-number" aria-hidden="true">{n}</span>
      <div>
        <h3 id={`step-${n}-title`}>{title}</h3>
        <p>{lead}</p>
      </div>
      <span className="guide-step-state">{STATE_LABEL[state]}</span>
    </header>
    {locked ? <div className="guide-locked"><span className="lock-mark" aria-hidden="true">×</span><p>{lockedText}</p></div> : children}
  </section>;
}

export function LoraGuide() {
  const [trigger, setTrigger] = useState("");
  const [invariants, setInvariants] = useState("");
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
  const [testDone, setTestDone] = useState(false);
  const [realLaunched, setRealLaunched] = useState(false);
  const [received, setReceived] = useState(false);
  const files = useRef(new Map<string, File>());
  const urls = useRef(new Set<string>());
  const nextId = useRef(0);
  const passedOnce = useRef(false);

  const input = useMemo(() => ({ trigger, invariants, images, confirmations }), [trigger, invariants, images, confirmations]);
  const result = useMemo(() => evaluateGate(input), [input]);
  const passed = result.verdict === "PASS";
  const captions = captionsBlock(result.captions);
  const signature = passed ? `${result.kept.map(image => image.id).join(",")}|${captions}` : "";
  const shownExport: ExportState = exportState.state === "done" ? { ...exportState, stale: signature !== exportedSignature } : exportState;

  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    if (passed && !passedOnce.current) trackEvent("gate_pass");
    passedOnce.current = passed;
  }, [passed]);

  async function addFiles(list: File[]) {
    const room = Math.max(0, MAX_IMPORT - images.length);
    const imageFiles = list.filter(file => file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name));
    const incoming = imageFiles.slice(0, room);
    setNotice([
      imageFiles.length > room ? `Import limité à ${MAX_IMPORT} images au total.` : "",
      list.length > imageFiles.length ? "Fichiers non image ignorés." : "",
    ].filter(Boolean).join(" "));
    if (!incoming.length) return;
    setProgress({ done: 0, total: incoming.length });
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
    setProgress(null);
  }

  const updateImage = (id: string, patch: Partial<DatasetImage>) => setImages(previous => previous.map(image => image.id === id ? { ...image, ...patch } : image));

  function clearAll() {
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
    document.getElementById(`image-${ids[0]}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    window.setTimeout(() => setHighlight(new Set()), 4000);
  }

  async function exportZip() {
    const kept = result.kept.length;
    setExportState({ state: "building", done: 0, total: kept });
    try {
      const blob = await buildDatasetZip(input, result, files.current, steps, count, (done, total) => setExportState({ state: "building", done, total }));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `c-micro-${trigger}-dataset.zip`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setExportedSignature(signature);
      setExportState({ state: "done", size: blob.size, stale: false });
      trackEvent("dataset_zip_downloaded");
    } catch (error) {
      setExportState({ state: "error", message: error instanceof Error ? error.message : "Export impossible." });
    }
  }

  const step1: StepState = passed ? "pass" : result.failCount ? "fail" : "todo";
  const exported = shownExport.state === "done" && !shownExport.stale;
  const step2: StepState = !passed ? "locked" : realLaunched ? "done" : exported ? "running" : "ready";
  const step3: StepState = !passed ? "locked" : received ? "done" : "ready";
  const lockedText = `Fermé : ${result.failCount + result.todoCount} contrôle${result.failCount + result.todoCount > 1 ? "s" : ""} du gate ne ${result.failCount + result.todoCount > 1 ? "sont" : "est"} pas en PASS. Pas de ZIP, pas d’app Comfy : un dataset sale brûle des crédits, on ne t’aide pas à le faire.`;

  return <div className="guide">
    <Step n="01" title="Dataset propre" lead={`${DATASET_SIZE} images, 3 angles minimum, légendes = trigger + variables. Chaque FAIL bloque la suite.`} state={step1}>
      <div className="step-grid">
        <div>
          {notice && <p className="inline-status warn" role="status">{notice}</p>}
          <DatasetStep
            trigger={trigger} invariants={invariants} images={images} previews={previews} result={result} highlight={highlight}
            confirmations={confirmations} progress={progress}
            onTrigger={setTrigger} onInvariants={setInvariants} onFiles={addFiles} onUpdate={updateImage}
            onRejectUntriaged={() => setImages(previous => previous.map(image => image.decision === "a-trier" ? { ...image, decision: "rejeter" } : image))}
            onClear={clearAll} onConfirm={(id, value) => setConfirmations(previous => ({ ...previous, [id]: value }))}
          />
          <a className={`gate-mini gate-${gateTone(result)}`} href="#gate-panel">{gateSummary(result)} <span aria-hidden="true">↓</span></a>
        </div>
        <GatePanel result={result} onShowImages={showImages} />
      </div>
    </Step>
    <Step n="02" title="Entraîner la LoRA" lead="Un seul run Comfy Cloud, Flux.1 dev. Coût affiché avant, test à blanc d’abord." state={step2} locked={!passed} lockedText={lockedText}>
      <TrainStep
        captions={captions} steps={steps} plan={plan} count={count} exportState={shownExport} testDone={testDone} realLaunched={realLaunched}
        onSteps={setSteps} onPlan={setPlan} onExport={exportZip} onTestDone={setTestDone} onRealLaunched={setRealLaunched}
      />
      <ComfyRunPanel app="train" />
    </Step>
    <Step n="03" title="Utiliser une fois : 1 image" lead="Se règle dans le même formulaire Comfy que l’étape 2 et part dans le même run. Comfy Cloud n’exporte pas la LoRA : elle vit le temps du run." state={step3} locked={!passed} lockedText="Fermé tant que le dataset n’est pas en PASS.">
      <ImageStep
        trigger={trigger} invariants={invariants} scene={scene} strength={strength} seed={seed} count={count} steps={steps} received={received}
        onScene={setScene} onStrength={setStrength} onSeed={setSeed} onCount={setCount} onReceived={setReceived}
      />
      <TestGrid trigger={trigger} seed={seed} steps={steps} />
      <ComfyRunPanel app="prompt" />
    </Step>
  </div>;
}
