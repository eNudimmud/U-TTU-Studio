"use client";

import { useEffect, useState } from "react";
import { ROLE_PHOTOS_MAX, isPlaceLora } from "@/lib/coffre/model";
import { formatUsd } from "@/lib/fal/prices";
import { problemsAfterTouch } from "@/lib/lora/dataset";
import type { TrainingEvent } from "@/lib/lora/train";
import { characterPaths } from "@/lib/studio-comfort";
import { Arrow, Close } from "./glyphs";
import { PictureSlot, Segments } from "./screens";
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

export function LoraScreen({ onTake, onScene, onPhotos, choice, startFile = false }: { onTake(): void; onScene(): void; onPhotos(): void; choice: number; startFile?: boolean }) {
  const studio = useStudio();
  const {
    studio: vault, media, dataset, falLinked, falBalance, training, trainingSteps, setTrainingSteps,
    trainQuote, trainGate, addClips, removeClip, requestTraining, cancelTraining, resetTraining, deleteLora, setEngine, setLora, setSheet,
    saveRole, addRolePhotos, removeRolePhoto, copyLookPhotos, resetRole,
  } = studio;
  const role = vault.role;
  const done = training.phase === "done" ? vault.loras.find(lora => lora.id === training.loraId) : undefined;
  const dirty = Boolean(role.name || role.photos.length || vault.clips.length);
  const [file, setFile] = useState(false);
  const [touch, setTouch] = useState({ name: false, photos: false, clips: false, submit: false });
  useEffect(() => { setFile(startFile); }, [choice, startFile]);
  const problems = problemsAfterTouch(dataset.problems, touch);
  const showFile = file || training.phase !== "idle";
  const paths = characterPaths({ falLinked, quote: trainQuote, steps: trainingSteps });

  return <section className="u-screen" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">01 · Personnage</p>
      <h1 id="u-title" tabIndex={-1}>{showFile ? "Former un personnage." : "Deux façons."}</h1>
      {showFile && <button type="button" className="u-link" onClick={() => setFile(false)}>Les deux façons</button>}
    </header>

    {training.phase === "running" && <div className="u-card u-run" role="status" aria-live="polite">
      <div className="u-thread" aria-hidden="true"><span /></div>
      <p className="u-run-label">{trainLabel(training.event)}</p>
      <p className="u-small">C’est long. Tu peux quitter et revenir : le fichier rejoint mon studio.</p>
      <button type="button" className="u-link u-muted" onClick={cancelTraining}>Annuler</button>
    </div>}

    {training.phase === "done" && done && <div className="u-card u-result">
      <p className="u-run-label">Le personnage est dans mon studio.</p>
      <p className="u-small">{done.costUsd !== null ? `Débité : ${formatUsd(done.costUsd)}, lu sur ton compte fal.` : "Débit pas encore visible sur ton compte fal."}{done.seconds !== null ? ` Calcul : ${clock(done.seconds)}.` : ""}</p>
      <button type="button" className="u-primary" onClick={() => { setEngine("lora"); setLora(done.id); onTake(); }}>Tourner avec ce personnage <Arrow /></button>
      <button type="button" className="u-link" onClick={resetTraining}>Former un autre</button>
    </div>}

    {training.phase === "error" && <TrainError training={training} onReset={resetTraining} onRelink={() => { resetTraining(); setSheet("fal"); }} />}

    {!showFile && <div className="u-desk u-paths" aria-label="Deux façons de créer un personnage">
      {paths.map(path => <article key={path.id} className="u-card">
        <h2>{path.title}</h2>
        <p>{path.body}</p>
        <button type="button" className="u-secondary" onClick={path.id === "references" ? onPhotos : () => setFile(true)}>{path.action}</button>
      </article>)}
    </div>}

    {showFile && <div className="u-desk">
      <ul className="u-facts">
        <li><strong>Ce que tu envoies</strong>Dix clips vidéo de ce personnage au moins, trente au plus. Chacun dure de 3 à 30 secondes : visage net, un peu de mouvement. mp4, mov, mkv ou avi. Des photos à la place des clips sont refusées.</li>
        <li><strong>Les photos</strong>Deux au moins, quatre au plus, de ce personnage. Elles accompagnent chaque clip. Elles n’apprennent pas à la place des clips.</li>
        <li><strong>Ce qu’il fera</strong>Dans La prise, « Personnage (fichier) » recharge ce fichier. Les prises suivantes tiennent le même personnage.</li>
        <li><strong>Ce qu’il ne fera pas</strong>Le lieu, les vêtements et le geste viennent des images et de ta phrase. « Références » ne charge pas ce fichier.</li>
      </ul>

      {training.phase === "idle" && <div className="u-stack">
        <label className="u-field">
          <span className="u-label">Nom du personnage</span>
          <input value={role.name} maxLength={40} placeholder="Mira" autoComplete="off" onBlur={() => setTouch(current => ({ ...current, name: true }))} onChange={event => void saveRole({ name: event.target.value.slice(0, 40) })} />
        </label>
        <div className="u-photos" aria-label="Photos du personnage">
          {Array.from({ length: ROLE_PHOTOS_MAX }, (_, index) => {
            const path = role.photos[index];
            return <PictureSlot key={path ?? `role-${index}`} index={index} url={path ? media[path] : undefined} label="la photo" onAdd={files => { setTouch(current => ({ ...current, photos: true })); void addRolePhotos(files); }} onRemove={path ? () => { setTouch(current => ({ ...current, photos: true })); void removeRolePhoto(path); } : undefined} />;
          })}
        </div>
        {vault.look.photos.length > 0 && role.photos.length < ROLE_PHOTOS_MAX && <button type="button" className="u-link u-muted" onClick={() => void copyLookPhotos()}>Reprendre les photos et les traits</button>}
        {vault.clips.length > 0 && <ul className="u-ledger" aria-label="Clips">
          {vault.clips.map((clip, index) => <li key={clip.path}>
            <span>Clip {String(index + 1).padStart(2, "0")} · {Math.round(clip.seconds)} s</span>
            <button type="button" className="u-link u-muted" onClick={() => { setTouch(current => ({ ...current, clips: true })); void removeClip(clip.path); }} aria-label={`Retirer le clip ${index + 1}`}><Close /> Retirer</button>
          </li>)}
        </ul>}
        <label className="u-secondary u-file">
          Ajouter des clips
          <input id="u-clips" type="file" accept="video/mp4,video/quicktime,video/x-matroska,video/avi,.mp4,.mov,.mkv,.avi" multiple onChange={event => { setTouch(current => ({ ...current, clips: true })); void addClips([...(event.target.files ?? [])]); event.target.value = ""; }} />
        </label>
        {problems.length > 0 && <ul className="u-problems">
          {problems.map(problem => <li key={problem}>{problem}</li>)}
        </ul>}
        <Segments label="Apprentissage" value={trainingSteps} onChange={setTrainingSteps} options={[{ value: 1000, label: "1000 pas" }, { value: 2000, label: "2000 pas" }]} />
        <p className="u-small">1000 pas pour un premier fichier. 2000 pas le tiennent mieux, et coûtent le double.</p>
        <p className={`u-cost is-${falLinked ? trainGate.tone : "warn"}`}>
          {!falLinked ? "Relie ton compte fal pour former. Il paie la formation, pas le studio."
            : falBalance ? `${formatUsd(falBalance.usd)} sur ton compte fal. ${trainGate.line}`
            : trainGate.line}
        </p>
        <div className="u-actions">
          <button type="button" className="u-link u-muted" disabled={!dirty} onClick={() => void resetRole()}>Remettre ce personnage à zéro</button>
          <p className="u-small">Les fichiers déjà formés restent.</p>
          <button type="button" className="u-primary" disabled={falLinked && dataset.ready && !trainGate.allowed} onClick={() => {
            if (!falLinked) {
              setSheet("relier");
              return;
            }
            setTouch(current => ({ ...current, name: true, photos: true, clips: true, submit: true }));
            if (!dataset.ready) return;
            void requestTraining();
          }}>
            {!falLinked ? "Relier" : `Former ce personnage${trainQuote !== null ? ` · ${formatUsd(trainQuote)}` : ""}`} <Arrow />
          </button>
          <button type="button" className="u-link" onClick={onScene}>Poser la scène</button>
        </div>
      </div>}
    </div>}

    {vault.loras.some(lora => !isPlaceLora(lora)) && <div className="u-stack">
      <p className="u-label">Distribution</p>
      <ul className="u-ledger" aria-label="Distribution">
        {vault.loras.filter(lora => !isPlaceLora(lora)).map(lora => <li key={lora.id}>
          <span>{lora.name || "Personnage"} · {lora.steps} pas{lora.costUsd !== null ? ` · ${formatUsd(lora.costUsd)}` : ""}</span>
          <span className="u-row">
            <button type="button" className="u-link" onClick={() => { setEngine("lora"); setLora(lora.id); onTake(); }}>Choisir</button>
            <button type="button" className="u-link u-muted" onClick={() => void deleteLora(lora.id)} aria-label={`Retirer ${lora.name || "le fichier"}`}>Retirer</button>
          </span>
        </li>)}
      </ul>
    </div>}
    {vault.loras.some(isPlaceLora) && <div className="u-stack">
      <p className="u-label">Lieux formés</p>
      <ul className="u-ledger" aria-label="Lieux formés">
        {vault.loras.filter(isPlaceLora).map(lora => <li key={lora.id}>
          <span>{lora.name || "Lieu"} · {lora.steps} pas{lora.costUsd !== null ? ` · ${formatUsd(lora.costUsd)}` : ""}</span>
          <button type="button" className="u-link u-muted" onClick={() => void deleteLora(lora.id)} aria-label={`Retirer ${lora.name || "le fichier"}`}>Retirer</button>
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
