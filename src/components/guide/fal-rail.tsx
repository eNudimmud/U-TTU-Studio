"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { DATASET_SIZE } from "@/lib/comfy-stack";
import { FalProxyError, falJobStatus, startFalGeneration, startFalTraining, type FalProxy } from "@/lib/fal-proxy";
import {
  FAL_ENDPOINTS, FAL_GEN, FAL_PRICING, FAL_PRIVACY, FAL_TRAINING, USD_CHF,
  estimateFalGen, estimateFalRun, estimateFalTrain, formatChf, formatStrength, formatUsd,
  type FalGenResult, type FalJob, type FalJobResult, type FalJobStatus,
} from "@/lib/fal-stack";
import { cleanVariables } from "@/lib/gate/captions";
import { falProxyUrl } from "@/lib/site";
import { Arrow } from "../glyph";

export type FalStage = "ready" | "running" | "done";

type Training =
  | { state: "idle" }
  | { state: "zipping"; done: number; total: number }
  | { state: "sending" }
  | { state: "queued"; id: string; position: number | null }
  | { state: "running"; id: string; log: string | null }
  | { state: "done"; id: string; lora: string; config: string | null }
  | { state: "error"; id: string | null; message: string; problems: string[] };

type Cell = { state: "idle" } | { state: "queued" } | { state: "running" } | { state: "done"; image: FalGenResult } | { state: "error"; message: string };

interface Props {
  passed: boolean;
  trigger: string;
  scene: string;
  seed: number;
  signature: string;
  onBuildZip: (onProgress: (done: number, total: number) => void) => Promise<Blob>;
  onStage: (stage: FalStage) => void;
}

const POLL_MS: Record<FalJob, number> = { train: 5000, gen: 2000 };
const MAX_POLL_ERRORS = 3;
const CELL_LABEL = { idle: "—", queued: "En file…", running: "Rendu en cours…" } as const;
const idleCells = (): Cell[] => FAL_GEN.strengths.map((): Cell => ({ state: "idle" }));
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const dateFr = (iso: string) => iso.split("-").reverse().join(".");
const decimalFr = (value: number) => String(value).replace(".", ",");
const jobId = (training: Training) => ("id" in training ? training.id : null);

function trainingStatus(training: Training): { tone: string; text: string } | null {
  switch (training.state) {
    case "idle": return null;
    case "zipping": return { tone: "", text: `Préparation du ZIP fal : ${training.done} / ${training.total} images…` };
    case "sending": return { tone: "", text: "Envoi du ZIP au proxy du studio…" };
    case "queued": return { tone: "", text: `En file chez fal${training.position !== null ? `, position ${training.position}` : ""}.` };
    case "running": return { tone: "", text: "Entraînement en cours chez fal." };
    case "done": return { tone: "pass", text: "LoRA prête." };
    case "error": return { tone: "fail", text: training.message };
  }
}

export function FalRail(props: Props) {
  const [steps, setSteps] = useState<number>(FAL_TRAINING.steps);
  const [token, setToken] = useState("");
  const [training, setTraining] = useState<Training>({ state: "idle" });
  const [cells, setCells] = useState<Cell[]>(idleCells);
  const [trainedSignature, setTrainedSignature] = useState("");
  const alive = useRef(true);
  const { onStage } = props;

  const trainBusy = training.state === "zipping" || training.state === "sending" || training.state === "queued" || training.state === "running";
  const gridBusy = cells.some(cell => cell.state === "queued" || cell.state === "running");
  const stage: FalStage = trainBusy || gridBusy ? "running" : training.state === "done" && cells.every(cell => cell.state === "done") ? "done" : "ready";

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => onStage(stage), [onStage, stage]);

  const proxy: FalProxy | null = falProxyUrl ? { url: falProxyUrl, token: token.trim() } : null;
  const prompt = [props.trigger.trim(), cleanVariables(props.scene)].filter(Boolean).join(", ");
  const trainCost = estimateFalTrain(steps);
  const gridCost = estimateFalGen(FAL_GEN.strengths.length);
  const total = estimateFalRun(steps, FAL_GEN.strengths.length);
  const strengths = FAL_GEN.strengths.map(formatStrength).join(" / ");
  const lora = training.state === "done" ? training : null;
  const status = trainingStatus(training);
  const id = jobId(training);

  async function follow<J extends FalJob>(client: FalProxy, job: J, requestId: string, onStatus: (status: FalJobStatus<FalJobResult[J]>) => void) {
    let errors = 0;
    while (alive.current) {
      try {
        const next = await falJobStatus(client, job, requestId);
        errors = 0;
        if (!alive.current) return;
        onStatus(next);
        if (next.status === "COMPLETED" || next.status === "FAILED") return;
      } catch (error) {
        if (++errors >= MAX_POLL_ERRORS) throw error;
      }
      await sleep(POLL_MS[job]);
    }
  }

  async function train() {
    if (!proxy || trainBusy) return;
    const client = proxy;
    let requestId: string | null = null;
    setTrainedSignature(props.signature);
    setCells(idleCells());
    setTraining({ state: "zipping", done: 0, total: DATASET_SIZE });
    trackEvent("fal_train_started");
    try {
      const zip = await props.onBuildZip((done, count) => setTraining({ state: "zipping", done, total: count }));
      setTraining({ state: "sending" });
      requestId = (await startFalTraining(client, zip, props.trigger.trim(), steps)).id;
      const current = requestId;
      setTraining({ state: "queued", id: current, position: null });
      await follow(client, "train", current, next => {
        if (next.status === "IN_QUEUE") setTraining({ state: "queued", id: current, position: next.position });
        else if (next.status === "IN_PROGRESS") setTraining({ state: "running", id: current, log: next.log });
        else if (next.status === "COMPLETED") setTraining({ state: "done", id: current, ...next.result });
        else setTraining({ state: "error", id: current, message: `fal a arrêté l’entraînement : ${next.error}`, problems: [] });
      });
    } catch (error) {
      setTraining({
        state: "error", id: requestId,
        message: error instanceof Error ? error.message : "Échec de l’entraînement.",
        problems: error instanceof FalProxyError ? error.problems : [],
      });
    }
  }

  async function generate() {
    if (!proxy || !lora || gridBusy) return;
    const client = proxy;
    trackEvent("fal_grid_started");
    setCells(FAL_GEN.strengths.map((): Cell => ({ state: "queued" })));
    await Promise.all(FAL_GEN.strengths.map(async (scale, index) => {
      const set = (cell: Cell) => setCells(previous => previous.map((item, i) => (i === index ? cell : item)));
      try {
        const { id: genId } = await startFalGeneration(client, { lora: lora.lora, prompt, scale, seed: props.seed });
        await follow(client, "gen", genId, next => {
          if (next.status === "IN_QUEUE") set({ state: "queued" });
          else if (next.status === "IN_PROGRESS") set({ state: "running" });
          else if (next.status === "COMPLETED") set({ state: "done", image: next.result });
          else set({ state: "error", message: next.error });
        });
      } catch (error) {
        set({ state: "error", message: error instanceof Error ? error.message : "Échec du rendu." });
      }
    }));
  }

  if (!props.passed) {
    return <div className="guide-locked">
      <span className="lock-mark" aria-hidden="true">×</span>
      <p>Fermé tant que le dataset n’est pas en PASS. Le gate vaut aussi pour fal : {DATASET_SIZE} images, pas le minimum de 4 que fal conseille.</p>
    </div>;
  }

  return <div className="fal-rail">
    <ol className="run-list">
      <li>
        <h4>Ce qui part chez fal</h4>
        <p>Au clic sur « Entraîner chez fal », tes images quittent ton appareil. Un ZIP réduit ({DATASET_SIZE} JPEG et leurs {DATASET_SIZE} légendes, sans rapport ni noms de fichiers d’origine) passe par le proxy du studio, qui le dépose sur le stockage de fal.</p>
        <p className="small-print">Une URL fal.media est publique pour qui la connaît. Le proxy demande à fal d’effacer le ZIP après {FAL_PRIVACY.zipExpiresSeconds / 3600} h, la LoRA et les images après {FAL_PRIVACY.outputsExpiresSeconds / 86400} jours, et de ne pas garder l’historique des requêtes. Réglages tirés de la documentation de fal, pas encore vérifiés sur un vrai run.</p>
      </li>
      <li>
        <h4>Entraîner chez fal</h4>
        <p><code>{FAL_ENDPOINTS.train}</code> en mode sujet : masques de visage, tes {DATASET_SIZE} légendes du gate, {steps} étapes.</p>
        {proxy && <div className="field fal-token">
          <label htmlFor="fal-token">Code d’accès du studio</label>
          <input id="fal-token" type="password" autoComplete="off" spellCheck={false} value={token} onChange={event => setToken(event.target.value)} aria-describedby="fal-token-help" />
          <p className="field-help" id="fal-token-help">Réservé au studio pendant l’essai : c’est la clé fal du studio qui paie. Le code reste dans cette page, rien n’est stocké.</p>
        </div>}
        <button type="button" className="button button-primary" onClick={train} disabled={!proxy || !token.trim() || trainBusy} aria-describedby={proxy ? undefined : "fal-offline"}>
          {trainBusy ? "Entraînement en cours…" : `Entraîner chez fal · ≈ ${formatUsd(trainCost.usd)}`} <Arrow />
        </button>
        {!proxy && <>
          <p className="inline-status warn" id="fal-offline">Proxy non branché : ce rail ne tourne qu’en script pour l’instant.</p>
          <p className="small-print">Côté studio : <code>node scripts/fal-smoke.mjs &lt;ZIP du gate&gt; --live</code>, environ {formatUsd(estimateFalRun(FAL_TRAINING.steps, 1).usd)} pour {FAL_TRAINING.steps} étapes et 1 image. Le proxy <code>workers/fal-proxy/</code> n’est pas encore déployé.</p>
        </>}
        {status && <p className={`inline-status ${status.tone}`} role="status">{status.text}</p>}
        {training.state === "running" && training.log && <p className="small-print fal-log">{training.log}</p>}
        {training.state === "error" && training.problems.length > 0 && <ul className="fal-problems">{training.problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
        {id && <p className="small-print">Requête fal : <code>{id}</code></p>}
      </li>
      <li>
        <h4>Récupérer la LoRA</h4>
        {lora ? <>
          <div className="fal-links">
            <a className="button button-outline" href={lora.lora} target="_blank" rel="noopener noreferrer">Télécharger la LoRA (.safetensors) <Arrow diagonal /><span className="sr-only">(nouvel onglet)</span></a>
            {lora.config && <a className="quiet-link" href={lora.config} target="_blank" rel="noopener noreferrer">Config d’entraînement<span className="sr-only"> (nouvel onglet)</span></a>}
          </div>
          <p className="small-print">fal efface ce fichier après {FAL_PRIVACY.outputsExpiresSeconds / 86400} jours (demandé) : garde-le chez toi.</p>
          {trainedSignature !== props.signature && <p className="inline-status warn">Le dataset a changé depuis cet entraînement : cette LoRA ne le reflète plus.</p>}
        </> : <p>Le fichier <code>diffusers_lora_file</code> : ta LoRA, réutilisable ailleurs. Comfy Cloud ne le rend pas ; fal, si.</p>}
      </li>
      <li>
        <h4>Grille {strengths}</h4>
        <p>Prompt et seed de l’étape 3 : <code>{prompt || "—"}</code>, seed {props.seed}. Une image par force, {FAL_GEN.width} × {FAL_GEN.height}, sans réentraîner : la LoRA reste chez fal.</p>
        <button type="button" className="button button-outline" onClick={generate} disabled={!proxy || !lora || !token.trim() || gridBusy || !prompt}>
          Générer la grille · ≈ {formatUsd(gridCost.usd)} <Arrow />
        </button>
        <ul className="fal-grid" aria-label={`Grille fal, forces ${strengths}`}>
          {FAL_GEN.strengths.map((scale, index) => {
            const cell = cells[index];
            return <li key={scale} className={`fal-cell is-${cell.state}`}>
              <p className="fal-cell-head"><span>Force</span> {formatStrength(scale)}</p>
              {cell.state === "done"
                ? <a href={cell.image.image} target="_blank" rel="noopener noreferrer">
                  <img src={cell.image.image} width={cell.image.width} height={cell.image.height} alt={`Rendu fal avec ta LoRA, force ${formatStrength(scale)}`} loading="lazy" />
                </a>
                : <p className="fal-cell-empty">{cell.state === "error" ? cell.message : CELL_LABEL[cell.state]}</p>}
              {cell.state === "done" && cell.image.nsfw && <p className="small-print">Signalée par le filtre de fal.</p>}
            </li>;
          })}
        </ul>
        <p className="small-print">Lis la grille comme un test : l’identité d’abord, puis le respect du prompt, force par force.</p>
      </li>
    </ol>

    <aside className="cost-panel" aria-labelledby="fal-cost-title">
      <p className="eyebrow" id="fal-cost-title">Coût fal</p>
      <label className="range-field" htmlFor="fal-steps">Étapes d’entraînement <strong>{steps}</strong></label>
      <input id="fal-steps" type="range" min={FAL_TRAINING.slider.min} max={FAL_TRAINING.slider.max} step={FAL_TRAINING.slider.step} value={steps} onChange={event => setSteps(Number(event.target.value))} disabled={trainBusy} aria-describedby="fal-steps-help" />
      <p className="field-help" id="fal-steps-help">Défaut de fal : {FAL_TRAINING.steps}. Le prix suit le nombre d’étapes.</p>
      <dl className="cost-table">
        <div><dt>Entraînement · {steps} étapes</dt><dd>{formatUsd(trainCost.usd)}<small>≈ {formatChf(trainCost.chf)}</small></dd></div>
        <div><dt>Grille · {FAL_GEN.strengths.length} images {FAL_GEN.width} × {FAL_GEN.height}</dt><dd>{formatUsd(gridCost.usd)}<small>≈ {formatChf(gridCost.chf)}</small></dd></div>
        <div><dt>Total</dt><dd>{formatUsd(total.usd)}<small>≈ {formatChf(total.chf)}</small></dd></div>
      </dl>
      <p className="small-print">Tarifs fal relevés le {dateFr(FAL_PRICING.checkedOn)} : {formatUsd(FAL_PRICING.trainUsdPer1000Steps)} par 1 000 étapes, proportionnel ; {formatUsd(FAL_PRICING.genUsdPerMegapixel, 3)} par mégapixel, une image {FAL_GEN.width} × {FAL_GEN.height} comptée pour 1. Payé par la clé fal du studio, pas par ton compte. {USD_CHF.verified ? `Taux 1 $ = ${decimalFr(USD_CHF.rate)} CHF, vérifié le ${dateFr(USD_CHF.checkedOn)}.` : `Taux 1 $ = ${decimalFr(USD_CHF.rate)} CHF : fixe, non vérifié.`}</p>
    </aside>
  </div>;
}
