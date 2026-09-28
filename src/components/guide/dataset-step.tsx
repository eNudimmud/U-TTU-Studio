"use client";

import "./workspace.css";

import { useEffect, useState, type DragEvent } from "react";
import { DATASET_SIZE } from "@/lib/comfy-stack";
import { checkTrigger, cleanVariables, findInvariantHits, parseInvariants } from "@/lib/gate/captions";
import { slot } from "@/lib/gate/report";
import { CONFIRMATIONS, GATE, canKeep, type ConfirmationId, type DatasetImage, type GateResult } from "@/lib/gate/rules";
import { ANGLES, FRAMINGS, type Angle, type Framing } from "@/lib/gate/vocabulary";
import { CaptionCoach } from "./caption-coach";

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
  reviewOnly?: boolean;
}

export function DatasetStep(props: Props) {
  const { images, result } = props;
  const [dragging, setDragging] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("all");
  const visibleImages = images.filter(image => filter === "all" || image.decision === filter);
  const selected = visibleImages.find(image => image.id === selectedId) ?? visibleImages[0];
  const selectedIndex = visibleImages.findIndex(image => image.id === selected?.id);
  useEffect(() => {
    const id = [...props.highlight][0];
    if (!id) return;
    setFilter("all");
    setSelectedId(id);
  }, [props.highlight]);
  useEffect(() => {
    if (!selected || !props.highlight.has(selected.id)) return;
    document.getElementById(`image-${selected.id}`)?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [selected, props.highlight]);
  const triggerError = props.trigger ? checkTrigger(props.trigger) : null;
  const kept = result.kept.length;
  const rejected = images.filter(image => image.decision === "rejeter").length;
  const untriaged = images.filter(image => image.decision === "a-trier").length;
  const keptIndex = new Map(result.kept.map((image, i) => [image.id, i]));
  const invariantList = parseInvariants(props.invariants);

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    props.onFiles([...event.dataTransfer.files]);
  }

  return <div className="dataset-step">
    {!props.reviewOnly && <fieldset className="panel-block">
      <legend>1. Nomme ton personnage</legend>
      <div className="form-row">
        <div className="field">
          <label htmlFor="trigger">Mot d’appel (trigger) <span aria-hidden="true">*</span></label>
          <input id="trigger" value={props.trigger} onChange={event => props.onTrigger(event.target.value.trim().toLowerCase())} placeholder="ex. mira_v1" maxLength={24} autoComplete="off" spellCheck={false} aria-describedby="trigger-help" aria-invalid={!!triggerError} />
          <p className={`field-help ${triggerError ? "field-error" : ""}`} id="trigger-help">{triggerError ?? "Un nom unique, avec un chiffre ou « _ ». Tu le réutiliseras dans tes prompts."}</p>
        </div>
        <div className="field">
          <label htmlFor="invariants">Ses traits constants <span aria-hidden="true">*</span></label>
          <textarea id="invariants" value={props.invariants} onChange={event => props.onInvariants(event.target.value)} rows={2} placeholder="green eyes, freckles, scar on left cheek" aria-describedby="invariants-help" />
          <p className="field-help" id="invariants-help">Au moins 2 traits en anglais, séparés par des virgules. Ex. : yeux verts, taches de rousseur → green eyes, freckles.</p>
        </div>
      </div>
    </fieldset>}

    <div className="panel-block">
      <h3 className="task-title">{props.reviewOnly ? (images.length ? "Complète ou remplace une image" : "Importer tes images") : "2. Choisis tes images"}</h3>
      <label className={`dropzone${dragging ? " is-dragging" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
        <input type="file" aria-label="Importer les images du personnage" accept="image/*" multiple disabled={!!props.progress} onChange={event => { props.onFiles([...(event.target.files ?? [])]); event.target.value = ""; }} />
        <span className="dropzone-title">Ajouter des images</span>
        <span className="dropzone-hint">JPEG, PNG, WebP · 768 px minimum · rien n’est envoyé</span>
      </label>
      {props.progress && <p className="progress" role="status">Analyse {props.progress.done} / {props.progress.total}…</p>}
      {images.length > 0 && <div className="dataset-bar">
        <p><strong className={kept === DATASET_SIZE ? "pass" : ""}>{kept} / {DATASET_SIZE}</strong> gardées · {rejected} rejetée{rejected > 1 ? "s" : ""} · {untriaged} à trier</p>
        <div className="dataset-actions">
          {untriaged > 0 && <button type="button" className="text-button" disabled={!!props.progress} onClick={props.onRejectUntriaged}>Rejeter les non triées</button>}
          <button type="button" className="text-button muted-button" disabled={!!props.progress} onClick={props.onClear}>Vider le lot</button>
        </div>
      </div>}
    </div>

    {images.length > 0 && <>
      <div className="review-toolbar"><h3 className="task-title">3. Trie et décris, une image à la fois</h3><label>Afficher<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Toutes ({images.length})</option><option value="a-trier">À trier ({untriaged})</option><option value="garder">Gardées ({kept})</option><option value="rejeter">Rejetées ({rejected})</option></select></label></div>
      <details className="disclosure caption-help"><summary>Comment décrire une image ? Voir un exemple</summary><CaptionCoach trigger={props.trigger} /></details>
      <div className="contact-sheet" role="group" aria-label="Choisir une image à vérifier">{visibleImages.map((image, index) => <button key={image.id} type="button" className={`thumb-choice decision-${image.decision}`} aria-pressed={selected?.id === image.id} aria-label={`Image ${index + 1} : ${image.name}, ${image.decision === "garder" ? "gardée" : image.decision === "rejeter" ? "rejetée" : "à trier"}`} onClick={() => setSelectedId(image.id)}><img src={props.previews[image.id]} alt="" loading="lazy" decoding="async" /><span>{index + 1}{image.decision === "garder" ? " ✓" : image.decision === "rejeter" ? " ×" : ""}</span></button>)}</div>
      {selected && <div className="review-navigation"><button type="button" className="text-button" disabled={selectedIndex === 0} onClick={() => setSelectedId(visibleImages[selectedIndex - 1].id)}>← Précédente</button><span aria-live="polite">Image {selectedIndex + 1} / {visibleImages.length}</span><button type="button" className="text-button" disabled={selectedIndex === visibleImages.length - 1} onClick={() => setSelectedId(visibleImages[selectedIndex + 1].id)}>Suivante →</button></div>}
      {!selected && <p className="inline-status">Aucune image dans cette catégorie.</p>}
    </>}

    {images.length > 0 && <ul className="image-grid focused-review" aria-label="Images importées">
      {(selected ? [selected] : []).map(image => {
        const flags = result.flags[image.id] ?? [];
        const keepable = canKeep(flags);
        const needsReview = flags.some(flag => flag.weight === "review");
        const index = keptIndex.get(image.id);
        const hits = image.decision === "garder" ? findInvariantHits(image.variables, invariantList) : [];
        const bare = !cleanVariables(image.variables);
        const help = hits.length ? `« ${hits.join(" », « ")} » : ${hits.length > 1 ? "invariants, le trigger les porte. Retire-les." : "invariant, le trigger le porte. Retire-le."}`
          : bare ? "Pose, tenue, décor, lumière, expression. Pas le visage." : "";
        return <li key={image.id} id={`image-${image.id}`} className={`image-card decision-${image.decision}${props.highlight.has(image.id) ? " is-highlight" : ""}`}>
          <div className="image-thumb">
            {props.previews[image.id] && <img src={props.previews[image.id]} alt={`Aperçu : ${image.name}`} loading="lazy" decoding="async" />}
            {index !== undefined && <span className="image-slot" title={`Emplacement Comfy « Image ${slot(index)} »`}>{slot(index)}</span>}
          </div>
          <div className="image-body">
            <p className="image-name" title={image.name}>{image.name}</p>
            <a className="text-button image-zoom" href={props.previews[image.id]} target="_blank" rel="noopener noreferrer">Agrandir l’image ↗<span className="sr-only"> (nouvel onglet)</span></a>
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
              <span>Vérifié à 100 % : même identité, visage net, pose distincte</span>
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
              <label className="variables-field">Ce qui change, en anglais
                <input value={image.variables} onChange={event => props.onUpdate(image.id, { variables: event.target.value })} placeholder="laughing, red coat, snowy park" maxLength={220} spellCheck={false} aria-invalid={hits.length > 0} aria-describedby={help ? `variables-help-${image.id}` : undefined} />
              </label>
              {help && <p className={`variables-help${hits.length ? " field-error" : ""}`} id={`variables-help-${image.id}`}>{help}</p>}
              {index !== undefined && <p className="caption-preview"><span>Légende {slot(index)}</span>{result.captions[index]}{bare && <em className="caption-slot">, [ce qui change]</em>}</p>}
            </div>}
          </div>
        </li>;
      })}
    </ul>}

    {kept === DATASET_SIZE && <fieldset className="panel-block confirmations">
      <legend>{props.reviewOnly ? "Dernière vérification" : "4. Dernière vérification"}</legend>
      {CONFIRMATIONS.map(item => <label key={item.id} className="check-inline">
        <input type="checkbox" checked={!!props.confirmations[item.id]} onChange={event => props.onConfirm(item.id, event.target.checked)} />
        <span>{item.label}</span>
      </label>)}
    </fieldset>}
  </div>;
}
