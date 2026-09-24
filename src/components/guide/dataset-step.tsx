"use client";

import { useState, type DragEvent } from "react";
import { DATASET_SIZE } from "@/lib/comfy-stack";
import { checkTrigger } from "@/lib/gate/captions";
import { slot } from "@/lib/gate/report";
import { CONFIRMATIONS, GATE, canKeep, type ConfirmationId, type DatasetImage, type GateResult } from "@/lib/gate/rules";
import { ANGLES, FRAMINGS, type Angle, type Framing } from "@/lib/gate/vocabulary";

interface Props {
  trigger: string;
  invariants: string;
  images: DatasetImage[];
  previews: Record<string, string>;
  result: GateResult;
  highlight: Set<string>;
  confirmations: Partial<Record<ConfirmationId, boolean>>;
  progress: { done: number; total: number } | null;
  onTrigger: (value: string) => void;
  onInvariants: (value: string) => void;
  onFiles: (files: File[]) => void;
  onUpdate: (id: string, patch: Partial<DatasetImage>) => void;
  onRejectUntriaged: () => void;
  onClear: () => void;
  onConfirm: (id: ConfirmationId, value: boolean) => void;
}

export function DatasetStep(props: Props) {
  const { images, result } = props;
  const [dragging, setDragging] = useState(false);
  const triggerError = props.trigger ? checkTrigger(props.trigger) : null;
  const kept = result.kept.length;
  const rejected = images.filter(image => image.decision === "rejeter").length;
  const untriaged = images.filter(image => image.decision === "a-trier").length;
  const keptIndex = new Map(result.kept.map((image, i) => [image.id, i]));

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    props.onFiles([...event.dataTransfer.files]);
  }

  return <div className="dataset-step">
    <fieldset className="panel-block">
      <legend>Réglages</legend>
      <div className="form-row">
        <div className="field">
          <label htmlFor="trigger">Trigger <span aria-hidden="true">*</span></label>
          <input id="trigger" value={props.trigger} onChange={event => props.onTrigger(event.target.value.trim().toLowerCase())} placeholder="ex. mira_v1" maxLength={24} autoComplete="off" spellCheck={false} aria-describedby="trigger-help" aria-invalid={!!triggerError} />
          <p className={`field-help ${triggerError ? "field-error" : ""}`} id="trigger-help">{triggerError ?? "Un mot inventé, avec un chiffre ou un _. Il portera l’identité à lui seul."}</p>
        </div>
        <div className="field">
          <label htmlFor="invariants">Ce qui ne change jamais <span aria-hidden="true">*</span></label>
          <textarea id="invariants" value={props.invariants} onChange={event => props.onInvariants(event.target.value)} rows={3} placeholder="green eyes, freckles, scar on left cheek" aria-describedby="invariants-help" />
          <p className="field-help" id="invariants-help">En anglais, séparés par des virgules. Ces traits seront interdits dans les légendes.</p>
        </div>
      </div>
    </fieldset>

    <div className="panel-block">
      <label className={`dropzone${dragging ? " is-dragging" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
        <input type="file" accept="image/*" multiple onChange={event => { props.onFiles([...(event.target.files ?? [])]); event.target.value = ""; }} />
        <span className="dropzone-title">Dépose tes images ou choisis-les</span>
        <span className="dropzone-hint">JPEG, PNG ou WebP · tu en garderas {DATASET_SIZE} · analyse dans ton navigateur, rien n’est envoyé</span>
      </label>
      {props.progress && <p className="progress" role="status">Analyse {props.progress.done} / {props.progress.total}…</p>}
      {images.length > 0 && <div className="dataset-bar">
        <p><strong className={kept === DATASET_SIZE ? "pass" : ""}>{kept} / {DATASET_SIZE}</strong> gardées · {rejected} rejetée{rejected > 1 ? "s" : ""} · {untriaged} à trier</p>
        <div className="dataset-actions">
          {untriaged > 0 && <button type="button" className="text-button" onClick={props.onRejectUntriaged}>Rejeter les non triées</button>}
          <button type="button" className="text-button muted-button" onClick={props.onClear}>Vider le lot</button>
        </div>
      </div>}
    </div>

    {images.length > 0 && <ul className="image-grid" aria-label="Images importées">
      {images.map(image => {
        const flags = result.flags[image.id] ?? [];
        const keepable = canKeep(flags);
        const needsReview = flags.some(flag => flag.weight === "review");
        const index = keptIndex.get(image.id);
        return <li key={image.id} id={`image-${image.id}`} className={`image-card decision-${image.decision}${props.highlight.has(image.id) ? " is-highlight" : ""}`}>
          <div className="image-thumb">
            {props.previews[image.id] && <img src={props.previews[image.id]} alt={`Aperçu : ${image.name}`} loading="lazy" decoding="async" />}
            {index !== undefined && <span className="image-slot" title={`Emplacement Comfy « Image ${slot(index)} »`}>{slot(index)}</span>}
          </div>
          <div className="image-body">
            <p className="image-name" title={image.name}>{image.name}</p>
            <p className="image-meta">{image.readable ? `${image.width}×${image.height} · netteté ${Math.round(image.sharpness)}` : "Illisible"}</p>
            {flags.length > 0 && <ul className="image-flags">
              {flags.map(flag => <li key={`${flag.kind}-${flag.relatedId ?? ""}`} className={`flag flag-${flag.weight}`}>
                <span>{flag.label}</span>{flag.weight !== "info" && <small>{flag.detail}</small>}
              </li>)}
            </ul>}
            <div className="decision" role="group" aria-label={`Décision pour ${image.name}`}>
              <button type="button" aria-pressed={image.decision === "garder"} disabled={!keepable} onClick={() => props.onUpdate(image.id, { decision: "garder" })}>Garder</button>
              <button type="button" aria-pressed={image.decision === "rejeter"} onClick={() => props.onUpdate(image.id, { decision: "rejeter" })}>Rejeter</button>
            </div>
            {!keepable && <p className="image-note">Refusée d’office (&lt; {GATE.minShortSide} px ou illisible).</p>}
            {needsReview && image.decision !== "rejeter" && <label className="check-inline">
              <input type="checkbox" checked={image.reviewed} onChange={event => props.onUpdate(image.id, { reviewed: event.target.checked })} />
              <span>Vérifié à 100 % : même identité, visage net</span>
            </label>}
            {image.decision === "garder" && <div className="image-tags">
              <div className="tag-row">
                <label>Angle
                  <select value={image.angle ?? ""} onChange={event => props.onUpdate(image.id, { angle: (event.target.value || null) as Angle | null })}>
                    <option value="">—</option>
                    {ANGLES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
                <label>Cadrage
                  <select value={image.framing ?? ""} onChange={event => props.onUpdate(image.id, { framing: (event.target.value || null) as Framing | null })}>
                    <option value="">—</option>
                    {FRAMINGS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="variables-field">Variables
                <input value={image.variables} onChange={event => props.onUpdate(image.id, { variables: event.target.value })} placeholder="tenue, décor, lumière, expression" maxLength={220} spellCheck={false} />
              </label>
              {index !== undefined && <p className="caption-preview"><span>Légende {slot(index)}</span>{result.captions[index]}</p>}
            </div>}
          </div>
        </li>;
      })}
    </ul>}

    <fieldset className="panel-block confirmations">
      <legend>Avant d’ouvrir l’étape 2</legend>
      {CONFIRMATIONS.map(item => <label key={item.id} className="check-inline">
        <input type="checkbox" checked={!!props.confirmations[item.id]} onChange={event => props.onConfirm(item.id, event.target.checked)} />
        <span>{item.label}</span>
      </label>)}
    </fieldset>
  </div>;
}
