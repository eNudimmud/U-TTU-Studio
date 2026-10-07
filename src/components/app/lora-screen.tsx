"use client";

import { useEffect, useState } from "react";
import { ROLE_PHOTOS_MAX, isPlaceLora } from "@/lib/coffre/model";
import { formatUsd } from "@/lib/fal/prices";
import { problemsAfterTouch } from "@/lib/lora/dataset";
import type { TrainingEvent } from "@/lib/lora/train";
import { characterPaths } from "@/lib/studio-comfort";
import { useI18n } from "@/components/i18n/provider";
import { Why } from "./guide-bubble";
import { Arrow, Close } from "./glyphs";
import { OutgoingPersonnage } from "./outgoing-text";
import { ProjectMemory } from "./project-memory";
import { PictureSlot, Segments } from "./slots";
import { useStudio, type TrainingState } from "./studio-context";

function clock(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function trainLabel(t: ReturnType<typeof useI18n>["t"], event: TrainingEvent): string {
  switch (event.stage) {
    case "pack": return t("train.pack");
    case "upload": return t("train.upload");
    case "submit": return t("run.submit");
    case "queue": return event.position ? t("run.queuePos", { position: event.position }) : t("run.queue");
    case "train": return t("train.train", { clock: clock(event.seconds) });
    case "fetch": return t("train.fetch");
    case "measure": return t("run.measure");
  }
}

export function LoraScreen({ onTake, onScene, onPhotos, choice, startFile = false }: { onTake(): void; onScene(): void; onPhotos(): void; choice: number; startFile?: boolean }) {
  const studio = useStudio();
  const { t, say } = useI18n();
  const {
    studio: vault, media, dataset, falLinked, falBalance, training, trainingSteps, setTrainingSteps,
    trainQuote, trainGate, addClips, removeClip, requestTraining, cancelTraining, resetTraining, resumeTraining, deleteLora, setEngine, setLora, setSheet,
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
      <p className="u-label">{t("lora.kicker")}</p>
      <h1 id="u-title" tabIndex={-1}>{showFile ? t("lora.trainTitle") : t("lora.twoWays")}</h1>
      <p className="u-micro">{t("guide.stepCharacter")}</p>
      <button type="button" className="u-link" onClick={() => setSheet("coffre")}>{t("sheet.openProject", { name: vault.projectName || t("common.unnamed") })}</button>
      <button type="button" className="u-link" onClick={() => setSheet({ outputs: "lora" })}>{t("job.outputs")}</button>
      {showFile && <button type="button" className="u-link" onClick={() => setFile(false)}>{t("verb.bothWays")}</button>}
    </header>

    {training.phase === "running" && <div className="u-card u-run" role="status" aria-live="polite">
      <div className="u-thread" aria-hidden="true"><span /></div>
      <p className="u-label">{t("job.running")}</p>
      <p className="u-run-label">{trainLabel(t, training.event)}</p>
      <p className="u-small">{t("lora.long")}</p>
      <button type="button" className="u-link" onClick={() => setSheet({ outputs: "lora" })}>{t("job.outputs")}</button>
      <button type="button" className="u-link u-muted" onClick={cancelTraining}>{t("verb.cancel")}</button>
    </div>}

    {training.phase === "done" && done && <div className="u-card u-result">
      <p className="u-label">{t("job.done")}</p>
      <p className="u-run-label">{t("lora.filed")}</p>
      <p className="u-small">{done.costUsd !== null ? t("take.debitedFal", { amount: formatUsd(done.costUsd) }) : t("take.debitHiddenFal")}{done.seconds !== null ? t("take.calc", { clock: clock(done.seconds) }) : ""}</p>
      <button type="button" className="u-primary" onClick={() => { setEngine("lora"); setLora(done.id); onTake(); }}>{t("lora.shootWith")} <Arrow /></button>
      <button type="button" className="u-link" onClick={() => setSheet({ outputs: "lora" })}>{t("job.outputs")}</button>
      <button type="button" className="u-link" onClick={resetTraining}>{t("verb.another")}</button>
    </div>}

    {training.phase === "error" && <TrainError training={training} onReset={resumeTraining} onRelink={() => { resetTraining(); setSheet("fal"); }} onOutputs={() => setSheet({ outputs: "lora" })} />}

    {!showFile && <div className="u-desk u-paths" aria-label={t("path.aria")}>
      {paths.map(path => <article key={path.id} className="u-card">
        <h2>{t(`path.${path.id}.title`)}</h2>
        <p>{path.id === "references"
          ? t("path.references.body", { engine: t("engine.comfy.label") })
          : t("path.fichier.body", { price: !falLinked ? t("runtime.linkFalFirst") : trainQuote === null ? t("runtime.falPriceBeforeShort") : t("runtime.trainQuote", { amount: formatUsd(trainQuote), steps: trainingSteps }), engine: t("engine.lora.label") })}</p>
        <button type="button" className="u-secondary" onClick={path.id === "references" ? onPhotos : () => setFile(true)}>{path.id === "references" ? t("path.references.action") : t("verb.trainFile")}</button>
      </article>)}
    </div>}
    {!showFile && <ProjectMemory />}

    {showFile && <div className="u-desk">
      <ul className="u-facts">
        <li><strong>{t("lora.sendTitle")}</strong>{t("lora.send")}</li>
        <li><strong>{t("lora.photosTitle")}</strong>{t("lora.photos")}</li>
        <li><strong>{t("lora.willTitle")}</strong>{t("lora.will", { engine: t("engine.lora.label") })}</li>
        <li><strong>{t("lora.wontTitle")}</strong>{t("lora.wont", { engine: t("engine.comfy.label") })}</li>
      </ul>

      {training.phase === "idle" && <div className="u-stack">
        <label className="u-field">
          <span className="u-label">{t("lora.name")}</span>
          <input value={role.name} maxLength={40} placeholder="Mira" autoComplete="off" onBlur={() => setTouch(current => ({ ...current, name: true }))} onChange={event => void saveRole({ name: event.target.value.slice(0, 40) })} />
        </label>
        <div className="u-photos" aria-label={t("lora.photosLabel")}>
          {Array.from({ length: ROLE_PHOTOS_MAX }, (_, index) => {
            const path = role.photos[index];
            return <PictureSlot key={path ?? `role-${index}`} index={index} url={path ? media[path] : undefined} label={t("look.photo")} onAdd={files => { setTouch(current => ({ ...current, photos: true })); void addRolePhotos(files); }} onRemove={path ? () => { setTouch(current => ({ ...current, photos: true })); void removeRolePhoto(path); } : undefined} />;
          })}
        </div>
        {vault.look.photos.length > 0 && role.photos.length < ROLE_PHOTOS_MAX && <button type="button" className="u-link u-muted" onClick={() => void copyLookPhotos()}>{t("lora.copy")}</button>}
        {vault.clips.length > 0 && <ul className="u-ledger" aria-label={t("lora.clips")}>
          {vault.clips.map((clip, index) => <li key={clip.path}>
            <span>{t("lora.clip", { index: String(index + 1).padStart(2, "0"), seconds: Math.round(clip.seconds) })}</span>
            <button type="button" className="u-link u-muted" onClick={() => { setTouch(current => ({ ...current, clips: true })); void removeClip(clip.path); }} aria-label={t("lora.removeClip", { index: index + 1 })}><Close /> {t("verb.remove")}</button>
          </li>)}
        </ul>}
        <label className="u-secondary u-file">
          {t("lora.addClips")}
          <input id="u-clips" type="file" accept="video/mp4,video/quicktime,video/x-matroska,video/avi,.mp4,.mov,.mkv,.avi" multiple onChange={event => { setTouch(current => ({ ...current, clips: true })); void addClips([...(event.target.files ?? [])]); event.target.value = ""; }} />
        </label>
        {problems.length > 0 && <ul className="u-problems">
          {problems.map(problem => <li key={problem}>{say(problem)}</li>)}
        </ul>}
        <Segments label={t("lora.learning")} value={trainingSteps} onChange={setTrainingSteps} options={[{ value: 1000, label: t("lora.steps", { count: 1000 }) }, { value: 2000, label: t("lora.steps", { count: 2000 }) }]} />
        <p className="u-small">{t("lora.stepsHint")}</p>
        <p className={`u-cost is-${falLinked ? trainGate.tone : "warn"}`}>
          {!falLinked ? t("lora.linkFal")
            : falBalance ? t("take.falBalance", { amount: formatUsd(falBalance.usd), line: say(trainGate.line) })
            : say(trainGate.line)}
        </p>
        <ProjectMemory />
        <OutgoingPersonnage />
        <div className="u-actions">
          <button type="button" className="u-link u-muted" disabled={!dirty} onClick={() => void resetRole()}>{t("lora.reset")}</button>
          <Why on={!dirty} text={t("why.unchanged")} />
          <p className="u-small">{t("lora.resetStay")}</p>
          <button type="button" className="u-primary" disabled={falLinked && dataset.ready && !trainGate.allowed} onClick={() => {
            if (!falLinked) {
              setSheet("relier");
              return;
            }
            setTouch(current => ({ ...current, name: true, photos: true, clips: true, submit: true }));
            if (!dataset.ready) return;
            void requestTraining();
          }}>
            {!falLinked ? t("verb.relier") : trainQuote !== null ? t("verb.trainPriced", { price: formatUsd(trainQuote) }) : t("verb.trainThis")} <Arrow />
          </button>
          <Why on={falLinked && dataset.ready && !trainGate.allowed} text={t("why.hold")} />
          <button type="button" className="u-link" onClick={onScene}>{t("verb.setScene")}</button>
        </div>
      </div>}
      {training.phase !== "idle" && <ProjectMemory />}
    </div>}

    {vault.loras.some(lora => !isPlaceLora(lora)) && <div className="u-stack">
      <p className="u-label">{t("shelf.cast")}</p>
      <ul className="u-ledger" aria-label={t("shelf.cast")}>
        {vault.loras.filter(lora => !isPlaceLora(lora)).map(lora => <li key={lora.id}>
          <span>{lora.name || t("common.character")} · {t("lora.pass", { steps: lora.steps })}{lora.costUsd !== null ? ` · ${formatUsd(lora.costUsd)}` : ""}</span>
          <span className="u-row">
            <button type="button" className="u-link" onClick={() => { setEngine("lora"); setLora(lora.id); onTake(); }}>{t("verb.choose")}</button>
            <button type="button" className="u-link u-muted" onClick={() => void deleteLora(lora.id)} aria-label={`${t("verb.remove")} ${lora.name || t("lora.fileFallback")}`}>{t("verb.remove")}</button>
          </span>
        </li>)}
      </ul>
    </div>}
    {vault.loras.some(isPlaceLora) && <div className="u-stack">
      <p className="u-label">{t("lora.formedPlaces")}</p>
      <ul className="u-ledger" aria-label={t("lora.formedPlaces")}>
        {vault.loras.filter(isPlaceLora).map(lora => <li key={lora.id}>
          <span>{lora.name || t("lora.placeFallback")} · {t("lora.pass", { steps: lora.steps })}{lora.costUsd !== null ? ` · ${formatUsd(lora.costUsd)}` : ""}</span>
          <button type="button" className="u-link u-muted" onClick={() => void deleteLora(lora.id)} aria-label={`${t("verb.remove")} ${lora.name || t("lora.fileFallback")}`}>{t("verb.remove")}</button>
        </li>)}
      </ul>
    </div>}
  </section>;
}

function TrainError({ training, onReset, onRelink, onOutputs }: { training: Extract<TrainingState, { phase: "error" }>; onReset(): void; onRelink(): void; onOutputs(): void }) {
  const { t, say } = useI18n();
  return <div className="u-card u-soft-error" role="alert">
    <p className="u-crt">{t("take.soft")}</p>
    <p>{say(training.message)}</p>
    {training.detail.length > 0 && <ul>{training.detail.map(item => <li key={item}>{say(item)}</li>)}</ul>}
    {training.code === "credits" && <p>{t("train.credits")}</p>}
    {training.code === "auth" || training.code === "scope"
      ? <button type="button" className="u-secondary" onClick={onRelink}>{t("verb.connectAgain")}</button>
      : <button type="button" className="u-secondary" onClick={onReset}>{t("verb.resume")}</button>}
    <button type="button" className="u-link" onClick={onOutputs}>{t("job.outputs")}</button>
  </div>;
}
