"use client";

import { APP_LABELS, COMFY_CLOUD, DATASET_SIZE, FLUX_STACK, TIMING, estimateTrainRun, maxSafeSteps, type ComfyPlan } from "@/lib/comfy-stack";
import { formatEstimate } from "@/lib/gate/report";
import { Arrow } from "../glyph";
import { CopyButton } from "./copy-button";

export type ExportState = { state: "idle" } | { state: "building"; done: number; total: number } | { state: "done"; size: number; stale: boolean } | { state: "error"; message: string };
interface Props {
  captions: string; steps: number; plan: ComfyPlan; count: number; exportState: ExportState; testDone: boolean;
  onSteps: (value: number) => void; onPlan: (value: ComfyPlan) => void; onExport: () => void; onTestDone: (value: boolean) => void;
}

export function TrainStep(props: Props) {
  const limitMinutes = COMFY_CLOUD.runtimeLimitMinutes[props.plan];
  const maxSteps = maxSafeSteps(props.plan, props.count);
  const tooLong = props.steps > maxSteps;
  const test = estimateTrainRun(FLUX_STACK.training.testSteps, 1);
  const real = estimateTrainRun(props.steps, props.count);
  const exported = props.exportState.state === "done" && !props.exportState.stale;

  return <div className="train-step">
    <ol className="run-list">
      <li><h3>Télécharge ton lot prêt à l’emploi</h3><p>{DATASET_SIZE} images numérotées, leurs légendes et le rapport de contrôle. Les métadonnées GPS sont retirées.</p>
        <button type="button" className="button button-primary" onClick={props.onExport} disabled={props.exportState.state === "building"}>{props.exportState.state === "building" ? `Préparation ${props.exportState.done} / ${props.exportState.total}…` : "Télécharger mon ZIP"} <Arrow /></button>
        {props.exportState.state === "done" && <p className={`inline-status ${props.exportState.stale ? "warn" : "pass"}`} role="status">{props.exportState.stale ? "Ton lot a changé. Télécharge un nouveau ZIP." : `ZIP prêt · ${(props.exportState.size / 1048576).toFixed(1)} Mo`}</p>}
        {props.exportState.state === "error" && <p className="inline-status fail" role="alert">{props.exportState.message}</p>}
      </li>
      <li><h3>Remplis le formulaire Comfy</h3><p>Ouvre l’app ci-dessous et connecte ton compte. Décompresse le ZIP : 01.jpg va dans « {APP_LABELS.image(1)} », et ainsi de suite.</p>
        <CopyButton text={props.captions} label={`Copier les ${DATASET_SIZE} légendes`} /><p className="small-print">Colle-les dans « {APP_LABELS.captions} », dans le même ordre que les images.</p>
        <details className="disclosure"><summary>Vérifier les légendes à copier</summary><label className="sr-only" htmlFor="captions-block">Légendes à coller dans Comfy</label><textarea id="captions-block" className="code-block" readOnly value={props.captions} rows={5} spellCheck={false} /></details>
      </li>
      <li><h3>Fais un test court</h3><p>Dans Comfy : <strong>{FLUX_STACK.training.testSteps} étapes</strong>, <strong>1 image</strong>, puis Run. Ce test payant vérifie le fonctionnement, pas la qualité de l’identité.</p>
        <div className="test-outputs"><span>Image avec LoRA</span><span>Témoin sans LoRA</span><span>Courbe de loss</span></div>
        <label className="check-inline"><input type="checkbox" checked={props.testDone && exported} onChange={event => props.onTestDone(event.target.checked)} disabled={!exported} /><span>J’ai reçu les 3 sorties du test</span></label>
      </li>
    </ol>
    <aside className="cost-panel" aria-labelledby="cost-title">
      <p className="eyebrow" id="cost-title">Avant de dépenser</p><h3>Ton budget Comfy</h3>
      <dl className="cost-table"><div><dt>Test court · {FLUX_STACK.training.testSteps} étapes</dt><dd>{formatEstimate(test)}</dd></div><div><dt>Lancement final · {props.steps} étapes, {props.count} image{props.count > 1 ? "s" : ""} + témoin</dt><dd>{formatEstimate(real)}</dd></div></dl>
      <p className="small-print">Estimations non mesurées. Les crédits sont à ta charge et le coût réel dépend du temps de calcul.</p>
      {tooLong && <p className="inline-status fail" role="alert">Durée estimée trop longue pour ton plan. Réduis les étapes dans les réglages.</p>}
      <details className="disclosure" open={tooLong || undefined}><summary>Plan Comfy et réglages</summary>
        <fieldset className="plan-choice"><legend>Ton plan</legend>{(["standard", "pro"] as const).map(plan => <label key={plan} className="check-inline"><input type="radio" name="plan" checked={props.plan === plan} onChange={() => props.onPlan(plan)} /><span>{plan === "standard" ? "Standard / Creator" : "Pro"} · {COMFY_CLOUD.runtimeLimitMinutes[plan]} min</span></label>)}</fieldset>
        <label className="range-field" htmlFor="steps">Étapes d’entraînement <strong>{props.steps}</strong></label><input id="steps" type="range" min={200} max={Math.max(maxSteps, FLUX_STACK.training.steps, 1200)} step={50} value={props.steps} onChange={event => props.onSteps(Number(event.target.value))} aria-describedby="steps-help" /><p className="field-help" id="steps-help">Réglage de départ : {FLUX_STACK.training.steps}. Maximum estimé pour ton plan : {maxSteps}.</p>
        <p className="small-print">Limite : {limitMinutes} min. Hypothèse : {TIMING.secondsPerStep.low}–{TIMING.secondsPerStep.high} s par étape. Tarif relevé le {COMFY_CLOUD.checkedOn.split("-").reverse().join(".")} : {COMFY_CLOUD.gpuCreditsPerSecond} crédit/s, {COMFY_CLOUD.creditsPerUsd} crédits ≈ 1 $. L’estimateur Comfy peut afficher 0 : il ignore ce temps GPU.</p>
      </details>
    </aside>
  </div>;
}
