"use client";

import { APP_LABELS, COMFY_CLOUD, DATASET_SIZE, FLUX_STACK, TIMING, estimateTrainRun, maxSafeSteps, type ComfyPlan } from "@/lib/comfy-stack";
import { formatEstimate } from "@/lib/gate/report";
import { Arrow } from "../glyph";
import { CopyButton } from "./copy-button";

export type ExportState = { state: "idle" } | { state: "building"; done: number; total: number } | { state: "done"; size: number; stale: boolean } | { state: "error"; message: string };

interface Props {
  captions: string;
  steps: number;
  plan: ComfyPlan;
  count: number;
  exportState: ExportState;
  testDone: boolean;
  realLaunched: boolean;
  onSteps: (value: number) => void;
  onPlan: (value: ComfyPlan) => void;
  onExport: () => void;
  onTestDone: (value: boolean) => void;
  onRealLaunched: (value: boolean) => void;
}

const PLANS: { id: ComfyPlan; label: string }[] = [
  { id: "standard", label: `Standard ou Creator · ${COMFY_CLOUD.runtimeLimitMinutes.standard} min par run` },
  { id: "pro", label: `Pro · ${COMFY_CLOUD.runtimeLimitMinutes.pro} min par run` },
];

export function TrainStep(props: Props) {
  const limitMinutes = COMFY_CLOUD.runtimeLimitMinutes[props.plan];
  const maxSteps = maxSafeSteps(props.plan, props.count);
  const tooLong = props.steps > maxSteps;
  const test = estimateTrainRun(FLUX_STACK.training.testSteps, 1);
  const real = estimateTrainRun(props.steps, props.count);
  const pessimisticShare = Math.min(1, real.seconds.high / (limitMinutes * 60));
  const exported = props.exportState.state === "done";

  return <div className="train-step">
    <ol className="run-list">
      <li>
        <h4>Télécharge le dataset vérifié</h4>
        <p>{DATASET_SIZE} JPEG renommés 01 à {DATASET_SIZE}, sans métadonnées GPS, leurs légendes, le rapport du gate et les consignes.</p>
        <button type="button" className="button button-primary" onClick={props.onExport} disabled={props.exportState.state === "building"}>
          {props.exportState.state === "building" ? `Préparation ${props.exportState.done} / ${props.exportState.total}…` : "Télécharger le ZIP"} <Arrow />
        </button>
        {props.exportState.state === "done" && <p className={`inline-status ${props.exportState.stale ? "warn" : "pass"}`} role="status">
          {props.exportState.stale ? "Le dataset a changé depuis le téléchargement : retélécharge le ZIP." : `ZIP prêt (${(props.exportState.size / 1048576).toFixed(1)} Mo).`}
        </p>}
        {props.exportState.state === "error" && <p className="inline-status fail" role="alert">{props.exportState.message}</p>}
      </li>
      <li>
        <h4>Connecte-toi dans l’app Comfy</h4>
        <p>En bas de cette étape, avec ton compte Comfy Cloud. Comfy propose ensuite d’ouvrir le workflow partagé : accepte.</p>
        <p className="small-print">Connexion refusée dans le cadre : « Ouvrir en plein onglet » ouvre la même app. Si le lien s’ouvre sur le graphe plutôt que sur l’app, les champs portent les mêmes noms.</p>
      </li>
      <li>
        <h4>Dépose les images dans l’ordre</h4>
        <p>01.jpg dans « {APP_LABELS.image(1)} », 02.jpg dans « {APP_LABELS.image(2)} »… jusqu’à {String(DATASET_SIZE).padStart(2, "0")}.jpg. L’ordre des images doit suivre celui des légendes.</p>
      </li>
      <li>
        <h4>Colle les {DATASET_SIZE} légendes</h4>
        <p>Dans « {APP_LABELS.captions} ». Une ligne par image, rien d’autre.</p>
        <label className="sr-only" htmlFor="captions-block">Légendes à coller dans Comfy</label>
        <textarea id="captions-block" className="code-block" readOnly value={props.captions} rows={6} spellCheck={false} />
        <CopyButton text={props.captions} label={`Copier les ${DATASET_SIZE} lignes`} />
      </li>
      <li>
        <h4>Test à blanc</h4>
        <p>« Étapes d’entraînement » = {FLUX_STACK.training.testSteps}, « Nombre d’images » = 1, puis Run. Attendu : 3 sorties (Avec LoRA, Témoin sans LoRA, Courbe de loss). S’il casse, il casse ici, pour {Math.round(test.credits.high)} crédits au plus.</p>
        <label className="check-inline"><input type="checkbox" checked={props.testDone} onChange={event => props.onTestDone(event.target.checked)} disabled={!exported} /><span>Test à blanc passé : 3 sorties reçues</span></label>
      </li>
      <li>
        <h4>Run réel</h4>
        <p>« Étapes d’entraînement » = {props.steps}, puis les réglages de l’étape 3, puis Run.</p>
        <label className="check-inline"><input type="checkbox" checked={props.realLaunched} onChange={event => props.onRealLaunched(event.target.checked)} disabled={!props.testDone || tooLong} /><span>Run réel lancé</span></label>
      </li>
    </ol>

    <aside className="cost-panel" aria-labelledby="cost-title">
      <p className="eyebrow" id="cost-title">Coût avant le run</p>
      <fieldset className="plan-choice">
        <legend>Ton plan Comfy</legend>
        {PLANS.map(plan => <label key={plan.id} className="check-inline"><input type="radio" name="plan" checked={props.plan === plan.id} onChange={() => props.onPlan(plan.id)} /><span>{plan.label}</span></label>)}
      </fieldset>
      <label className="range-field" htmlFor="steps">Étapes d’entraînement <strong>{props.steps}</strong></label>
      <input id="steps" type="range" min={200} max={Math.max(maxSteps, FLUX_STACK.training.steps, 1200)} step={50} value={props.steps} onChange={event => props.onSteps(Number(event.target.value))} aria-describedby="steps-help" />
      <p className="field-help" id="steps-help">Conseillé : {FLUX_STACK.training.steps}. Maximum sûr pour ton plan : {maxSteps}.</p>
      <dl className="cost-table">
        <div><dt>Test à blanc · {FLUX_STACK.training.testSteps} étapes, 1 image</dt><dd>{formatEstimate(test)}</dd></div>
        <div><dt>Run réel · {props.steps} étapes, {props.count} image{props.count > 1 ? "s" : ""} + témoin</dt><dd>{formatEstimate(real)}</dd></div>
      </dl>
      <div className={`runtime-bar${tooLong ? " is-over" : ""}`} aria-hidden="true"><span style={{ width: `${Math.round(pessimisticShare * 100)}%` }} /></div>
      <p className={`inline-status ${tooLong ? "fail" : "pass"}`}>{tooLong
        ? `Réglage refusé : au pire ${Math.round(real.seconds.high / 60)} min pour une limite de ${limitMinutes} min. Comfy couperait le run et les crédits seraient perdus.`
        : `Au pire ${Math.round(real.seconds.high / 60)} min sur ${limitMinutes} autorisées.`}</p>
      <p className="small-print">{TIMING.measured ? "Durées mesurées sur un run de calibration." : `Estimation non mesurée : ${TIMING.secondsPerStep.low}–${TIMING.secondsPerStep.high} s par étape supposées sur les GPU Comfy. Le premier run sert de calibration.`} Tarif : {COMFY_CLOUD.gpuCreditsPerSecond} crédit/s de GPU, {COMFY_CLOUD.creditsPerUsd} crédits ≈ 1 $. L’estimateur de Comfy affiche 0 crédit pour ce workflow : il ignore le temps GPU.</p>
    </aside>
  </div>;
}
