"use client";

import { formatUsd } from "@/lib/fal/prices";
import type { TrainingEvent } from "@/lib/lora/train";
import { Arrow, Close } from "./glyphs";
import { Segments } from "./screens";
import { useStudio, type TrainingState } from "./studio-context";

function clock(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function trainLabel(event: TrainingEvent): string {
  switch (event.stage) {
    case "pack": return "Préparation des clips";
    case "upload": return "Envoi des clips";
    case "submit": return "Mise en file";
    case "queue": return event.position ? `En file · ${event.position}` : "En file sur ton compte";
    case "train": return `Formation · ${clock(event.seconds)}`;
    case "fetch": return "Le fichier revient";
    case "measure": return "Lecture du débit";
  }
}

export function LoraScreen({ onTake, onLook }: { onTake(): void; onLook(): void }) {
  const studio = useStudio();
  const {
    studio: vault, dataset, falLinked, falBalance, falBalanceNote, training, trainingSteps, setTrainingSteps,
    trainQuote, trainGate, addClips, removeClip, requestTraining, cancelTraining, resetTraining, deleteLora, setEngine, setLora, setSheet,
  } = studio;
  const done = training.phase === "done" ? vault.loras.find(lora => lora.id === training.loraId) : undefined;

  return <section className="u-screen" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">Ton double</p>
      <h1 id="u-title" tabIndex={-1}>Former ton double.</h1>
    </header>

    {training.phase === "running" && <div className="u-card u-run" role="status" aria-live="polite">
      <div className="u-thread" aria-hidden="true"><span /></div>
      <p className="u-run-label">{trainLabel(training.event)}</p>
      <p className="u-small">C’est long. Tu peux quitter et revenir : le fichier rejoint le coffre.</p>
      <button type="button" className="u-link u-muted" onClick={cancelTraining}>Annuler</button>
    </div>}

    {training.phase === "done" && done && <div className="u-card u-result">
      <p className="u-run-label">Ton double est au coffre.</p>
      <p className="u-small">{done.costUsd !== null ? `Débité : ${formatUsd(done.costUsd)}, lu sur ton compte fal.` : "Débit pas encore visible sur ton compte fal."}{done.seconds !== null ? ` Calcul : ${clock(done.seconds)}.` : ""}</p>
      <button type="button" className="u-primary" onClick={() => { setEngine("lora"); setLora(done.id); onTake(); }}>Tourner avec ton double <Arrow /></button>
      <button type="button" className="u-link" onClick={resetTraining}>Former un autre</button>
    </div>}

    {training.phase === "error" && <TrainError training={training} onReset={resetTraining} onRelink={() => { resetTraining(); setSheet("fal"); }} />}

    <ul className="u-facts">
      <li><strong>Ce que tu envoies</strong>Dix clips vidéo de toi au moins, trente au plus. Chacun dure de 3 à 30 secondes : visage net, un peu de mouvement. mp4, mov, mkv ou avi. Des photos à la place des clips sont refusées.</li>
      <li><strong>Les photos du look</strong>Deux au moins. Elles n’apprennent pas le double : elles accompagnent chaque clip, pour que le visage formé reste le tien.</li>
      <li><strong>Ce qu’il fera</strong>Dans La prise, « Ton double » charge ce fichier. Ton visage tient pendant le plan.</li>
      <li><strong>Ce qu’il ne fera pas</strong>Le lieu, les vêtements et le geste viennent des photos et de ta phrase. Le rendu « Références » ne charge pas ce fichier.</li>
    </ul>

    {training.phase === "idle" && <>
      {vault.look.photos.length < 2 && <button type="button" className="u-link" onClick={onLook}>Tenir le look d’abord</button>}
      {vault.clips.length > 0 && <ul className="u-ledger" aria-label="Clips">
        {vault.clips.map((clip, index) => <li key={clip.path}>
          <span>Clip {String(index + 1).padStart(2, "0")} · {Math.round(clip.seconds)} s</span>
          <button type="button" className="u-link u-muted" onClick={() => void removeClip(clip.path)} aria-label={`Retirer le clip ${index + 1}`}><Close /> Retirer</button>
        </li>)}
      </ul>}
      <label className="u-secondary u-file">
        Ajouter des clips
        <input id="u-clips" type="file" accept="video/mp4,video/quicktime,video/x-matroska,video/avi,.mp4,.mov,.mkv,.avi" multiple onChange={event => { void addClips([...(event.target.files ?? [])]); event.target.value = ""; }} />
      </label>
      {dataset.problems.length > 0 && <ul className="u-problems">
        {dataset.problems.map(problem => <li key={problem}>{problem}</li>)}
      </ul>}
      <Segments label="Apprentissage" value={trainingSteps} onChange={setTrainingSteps} options={[{ value: 1000, label: "1000 pas" }, { value: 2000, label: "2000 pas" }]} />
      <p className="u-small">1000 pas pour un premier double. 2000 pas le tiennent mieux, et coûtent le double.</p>
      <p className={`u-cost is-${falLinked ? trainGate.tone : "warn"}`}>
        {!falLinked ? "Relie ton compte fal pour former. Il paie la formation, pas le studio."
          : falBalance ? `${formatUsd(falBalance.usd)} sur ton compte fal. ${trainGate.line}`
          : falBalanceNote || "Lecture du solde…"}
      </p>
      <button type="button" className="u-primary" disabled={falLinked && (!dataset.ready || !trainGate.allowed)} onClick={() => void requestTraining()}>
        {!falLinked ? "Relier mon compte fal" : `Former mon double${trainQuote !== null ? ` · ${formatUsd(trainQuote)}` : ""}`} <Arrow />
      </button>
    </>}

    {vault.loras.length > 0 && <div className="u-stack">
      <p className="u-label">Au coffre</p>
      <ul className="u-ledger">
        {vault.loras.map(lora => <li key={lora.id}>
          <span>{lora.name || "Double"} · {lora.steps} pas{lora.costUsd !== null ? ` · ${formatUsd(lora.costUsd)}` : ""}</span>
          <span className="u-row">
            <button type="button" className="u-link" onClick={() => { setEngine("lora"); setLora(lora.id); onTake(); }}>Choisir</button>
            <button type="button" className="u-link u-muted" onClick={() => void deleteLora(lora.id)} aria-label={`Retirer ${lora.name || "le double"}`}>Retirer</button>
          </span>
        </li>)}
      </ul>
    </div>}
  </section>;
}

function TrainError({ training, onReset, onRelink }: { training: Extract<TrainingState, { phase: "error" }>; onReset(): void; onRelink(): void }) {
  return <div className="u-card u-soft-error" role="alert">
    <p className="u-crt">SOFT ERROR</p>
    <p>{training.message}</p>
    {training.detail.length > 0 && <ul>{training.detail.map(item => <li key={item}>{item}</li>)}</ul>}
    {training.code === "credits" && <p>Recharge ton compte fal, puis relance. Le solde, en haut, montre ce qui reste.</p>}
    {training.code === "auth" || training.code === "scope"
      ? <button type="button" className="u-secondary" onClick={onRelink}>Relier à nouveau</button>
      : <button type="button" className="u-secondary" onClick={onReset}>Reprendre</button>}
  </div>;
}
