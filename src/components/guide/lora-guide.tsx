"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DATASET_SIZE, FLUX_STACK, COMFY_APPS, estimateTrainRun, maxSafeSteps, type ComfyPlan } from "@/lib/comfy-stack";
import { trackEvent } from "@/lib/analytics";
import { captionsBlock, formatEstimate } from "@/lib/gate/report";
import { GATE, evaluateGate, type ConfirmationId, type DatasetImage } from "@/lib/gate/rules";
import { falProxyUrl } from "@/lib/site";
import { Arrow } from "../glyph";
import { LoraTutorial } from "./lora-tutorial";
import type { ExportState } from "./train-step";

const loading = () => <p className="loading-panel" role="status">Ouverture de l’étape…</p>;
const DatasetStep = dynamic(() => import("./dataset-step").then(m => m.DatasetStep), { loading });
const GatePanel = dynamic(() => import("./gate-panel").then(m => m.GatePanel), { loading });
const TrainStep = dynamic(() => import("./train-step").then(m => m.TrainStep), { loading });
const ImageStep = dynamic(() => import("./image-step").then(m => m.ImageStep), { loading });
const ComfyRunPanel = dynamic(() => import("./comfy-run-panel").then(m => m.ComfyRunPanel), { loading });
const TestGrid = dynamic(() => import("./test-grid").then(m => m.TestGrid), { loading });
const FalRail = dynamic(() => import("./fal-rail").then(m => m.FalRail), { loading });
const MAX_IMPORT = 60;
const onFalStage = () => {};
const STAGES = [
  { title: "Comprendre", hint: "Une LoRA, c’est quoi ?" },
  { title: "Préparer", hint: "Ton lot de 15 images" },
  { title: "Entraîner", hint: "Préparer et tester Comfy" },
  { title: "Créer", hint: "Ta première image" },
];

export function LoraGuide() {
  const [active, setActive] = useState(0);
  const [visited, setVisited] = useState([0]);
  const [showTests, setShowTests] = useState(false);
  const [showFal, setShowFal] = useState(false);
  const moved = useRef(false);
  const importing = useRef(false);
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
  const [testedSignature, setTestedSignature] = useState("");
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
  const testDone = passed && testedSignature === signature;
  const setTestDone = (done: boolean) => setTestedSignature(done ? signature : "");
  const exportSignature = `${signature}|${steps}|${count}`;
  const shownExport: ExportState = exportState.state === "done" ? { ...exportState, stale: exportSignature !== exportedSignature } : exportState;

  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    if (passed && !passedOnce.current) trackEvent("gate_pass");
    passedOnce.current = passed;
  }, [passed]);

  useEffect(() => {
    setRealLaunched(false);
    setReceived(false);
  }, [signature, steps, scene, strength, seed, count]);

  function navigate(index: number) {
    if (index > 1 && !passed) return;
    moved.current = true;
    setVisited(previous => previous.includes(index) ? previous : [...previous, index]);
    setActive(index);
  }

  useEffect(() => {
    if (!moved.current) return;
    document.getElementById(`guide-title-${active}`)?.focus({ preventScroll: true });
    document.getElementById("parcours")?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [active]);

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

  return <section id="parcours" className="guide-workspace" aria-label="Guide LoRA en quatre étapes">
    <nav aria-label="Étapes du guide" className="stage-navigation">
      <ol>{STAGES.map((stage, index) => <li key={stage.title}>
        <button type="button" aria-current={active === index ? "step" : undefined} disabled={index > 1 && !passed}
          onClick={() => navigate(index)} aria-describedby={index > 1 && !passed ? "locked-stages" : undefined}>
          <span className="stage-number" aria-hidden="true">{index === 1 && passed ? "✓" : `0${index + 1}`}</span>
          <span><strong>{stage.title}</strong><small>{index > 1 && !passed ? "Après validation du lot" : stage.hint}</small></span>
          {index > 1 && !passed && <svg className="stage-lock" aria-hidden="true" viewBox="0 0 20 20"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9V6a3 3 0 0 1 6 0v3"/></svg>}
        </button>
      </li>)}</ol>
    </nav>
    <p id="locked-stages" className="sr-only">Valide les contrôles des 15 images à l’étape Préparer pour ouvrir Entraîner et Créer.</p>
    <div className="stage-surface" hidden={active !== 0}><LoraTutorial onStart={() => navigate(1)} /></div>
    {/* Keep visited stages mounted: file choices, disclosures and remote jobs survive navigation. */}
    {visited.includes(1) && <div className="stage-surface" hidden={active !== 1}>
      <header className="stage-heading"><div><p className="eyebrow">02 / Préparer</p><h2 id="guide-title-1" tabIndex={-1}>Un bon lot fait la différence.</h2><p>Nomme ton personnage, puis garde 15 images variées. On vérifie le reste avec toi.</p></div><span className="stage-badge">{result.kept.length} / {DATASET_SIZE} images</span></header>
      <div className="preparation-layout"><div>
        {notice && <p className="inline-status warn" role="status">{notice}</p>}
        <DatasetStep trigger={trigger} invariants={invariants} images={images} previews={previews} result={result} highlight={highlight}
          confirmations={confirmations} progress={progress} onTrigger={setTrigger} onInvariants={setInvariants} onFiles={addFiles} onUpdate={updateImage}
          onRejectUntriaged={() => setImages(previous => previous.map(image => image.decision === "a-trier" ? { ...image, decision: "rejeter" } : image))}
          onClear={clearAll} onConfirm={(id, value) => setConfirmations(previous => ({ ...previous, [id]: value }))} />
      </div><GatePanel result={result} onShowImages={showImages} /></div>
      <div className="stage-footer"><button className="text-button" type="button" onClick={() => navigate(0)}>← Revoir le tuto</button><div><p>{passed ? "Ton lot est prêt. Tu peux continuer." : "La suite s’ouvre quand les contrôles du lot sont validés."}</p><button className="button button-primary" disabled={!passed || !!progress} type="button" onClick={() => navigate(2)}>Passer à l’entraînement <Arrow /></button></div></div>
    </div>}
    {visited.includes(2) && <div className="stage-surface" hidden={active !== 2}>
      <header className="stage-heading"><div><p className="eyebrow">03 / Entraîner</p><h2 id="guide-title-2" tabIndex={-1}>Prépare le lancement.</h2><p>Exporte ton lot, ouvre Comfy, puis fais un test court. Le lancement final se règle à l’étape suivante.</p></div><span className="stage-badge">Compte Comfy requis</span></header>
      {passed ? <>
        <TrainStep captions={captions} steps={steps} plan={plan} count={count} exportState={shownExport} testDone={testDone}
          onSteps={setSteps} onPlan={setPlan} onExport={exportZip} onTestDone={setTestDone} />
        <ComfyRunPanel app="train" />
        <div className="stage-footer"><button className="text-button" type="button" onClick={() => navigate(1)}>← Revoir mes images</button><button className="button button-primary" type="button" onClick={() => navigate(3)}>Régler ma première image <Arrow /></button></div>
      </> : <p className="loading-panel">Le lot a changé. Reviens à « Préparer » pour le valider.</p>}
    </div>}
    {visited.includes(3) && <div className="stage-surface" hidden={active !== 3}>
      <header className="stage-heading"><div><p className="eyebrow">04 / Créer</p><h2 id="guide-title-3" tabIndex={-1}>Ton personnage, ta scène.</h2><p>Reporte ces réglages dans Comfy avant de lancer. L’entraînement et l’image se font dans le même run.</p></div></header>
      {passed ? <>
        <ImageStep trigger={trigger} invariants={invariants} scene={scene} strength={strength} seed={seed} count={count} steps={steps} received={received}
          onScene={setScene} onStrength={setStrength} onSeed={setSeed} onCount={setCount} onReceived={setReceived} />
        <section className="launch-summary" aria-label="Lancement final"><div><h3>Prêt à lancer dans Comfy ?</h3><p>{steps} étapes · {count} image{count > 1 ? "s" : ""} + témoin · <strong>{formatEstimate(estimateTrainRun(steps, count))}</strong></p><p className="small-print">Estimation non mesurée, crédits de ton compte Comfy. La LoRA reste limitée à ce run.</p></div>
          {!canLaunch && <p className="inline-status warn">{!exported ? "Télécharge un ZIP à jour à l’étape Entraîner." : !testDone ? "Confirme d’abord les 3 sorties du test court à l’étape Entraîner." : "Réduis les étapes ou le nombre d’images pour respecter la durée de ton plan."}</p>}
          <a className="button button-outline" href={COMFY_APPS.train.url} target="_blank" rel="noopener noreferrer">Ouvrir Comfy ↗</a>
          <label className="check-inline"><input type="checkbox" checked={realLaunched && canLaunch} disabled={!canLaunch} onChange={event => setRealLaunched(event.target.checked)} /><span>J’ai lancé le run réel dans Comfy</span></label>
        </section>
        <details className="disclosure advanced-tools" onToggle={event => { if (event.currentTarget.open) setShowTests(true); }}><summary>Aller plus loin : comparer les forces et tester la scène</summary>{showTests && <><TestGrid trigger={trigger} seed={seed} steps={steps} /><ComfyRunPanel app="prompt" /></>}</details>
        <details className="disclosure advanced-tools" onToggle={event => { if (event.currentTarget.open) setShowFal(true); }}><summary>Option studio : fal · expérimental · vente en attente</summary>{showFal && <><p className="experimental-note">Réservé au studio · HOLD. {falProxyUrl ? "Proxy configuré." : "Interface désactivée : aucun proxy configuré."} Comfy reste disponible.</p><FalRail onStage={onFalStage} passed={passed} trigger={trigger} scene={scene} seed={seed} signature={signature}
          onBuildZip={async onProgress => { const { buildFalZip } = await import("@/lib/gate/browser"); return buildFalZip(result, files.current, onProgress); }} /></>}</details>
        <div className="stage-footer"><button className="text-button" type="button" onClick={() => navigate(2)}>← Revoir l’entraînement</button><span className="small-print">Garde ton ZIP pour retrouver tes images et tes légendes.</span></div>
      </> : <p className="loading-panel">Le lot a changé. Reviens à « Préparer » pour le valider.</p>}
    </div>}
  </section>;
}
