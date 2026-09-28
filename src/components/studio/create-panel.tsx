"use client";

import { useState, type DragEvent } from "react";
import { DATASET_SIZE } from "@/lib/comfy-stack";
import { bootstrapCaption, bootstrapPlan } from "@/lib/fal-bootstrap";
import { FAL_ACCESS_MIN, FAL_VARY, estimateFalVary, formatFalCost } from "@/lib/fal-stack";
import { checkTrigger } from "@/lib/gate/captions";
import { ANGLES, FRAMINGS } from "@/lib/gate/vocabulary";
import { Arrow } from "../glyph";

const PLAN = bootstrapPlan();
const COST = estimateFalVary(DATASET_SIZE);
const FRAMING_LINE = `${PLAN.filter(slot => slot.framing === "gros-plan").length} gros plans · ${PLAN.filter(slot => slot.framing === "buste").length} bustes · ${PLAN.filter(slot => slot.framing === "pied").length} plein pied`;

export interface CreatePanelProps {
  trigger: string;
  invariants: string;
  token: string;
  proxyOn: boolean;
  busy: boolean;
  arrived: boolean[];
  status: string;
  refs: { name: string; url: string }[];
  onTrigger: (value: string) => void;
  onInvariants: (value: string) => void;
  onToken: (value: string) => void;
  onRefs: (files: File[]) => void;
  onBootstrap: () => void;
  onManual: () => void;
}

export function CreatePanel(props: CreatePanelProps) {
  const [dragging, setDragging] = useState(false);
  const triggerError = props.trigger ? checkTrigger(props.trigger) : null;
  const ready = props.proxyOn
    && props.refs.length >= FAL_VARY.minRefs
    && props.refs.length <= FAL_VARY.maxRefs
    && !triggerError
    && !!props.trigger
    && props.token.trim().length >= FAL_ACCESS_MIN
    && !props.busy;
  const angleLabel = (id: string) => ANGLES.find(item => item.id === id)?.label ?? id;
  const framingLabel = (id: string) => FRAMINGS.find(item => item.id === id)?.label ?? id;

  function take(list: File[]) {
    props.onRefs(list);
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    take([...event.dataTransfer.files]);
  }

  return <div className="create-panel">
    <label id="create-drop" className={`create-drop${dragging ? " is-dragging" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={props.busy} aria-label="Déposer 2 ou 3 photos de la même personne" onChange={event => { take([...(event.target.files ?? [])]); event.target.value = ""; }} />
      <span className="create-mark" aria-hidden="true">iii</span>
      {props.refs.length === 0 ? <>
        <span className="create-drop-title">Dépose 2 ou 3 photos</span>
        <span className="create-drop-hint">Même personne · JPEG, PNG ou WebP · 8 Mo chacune</span>
      </> : <span className="ref-strip">
        {props.refs.map(ref => <img key={ref.url} src={ref.url} alt="" />)}
        <span className="create-drop-hint">{props.refs.length} photo{props.refs.length > 1 ? "s" : ""} · reclique pour remplacer</span>
      </span>}
    </label>

    <div className="create-fields">
      <div className="create-field">
        <label htmlFor="create-trigger">Mot d’appel</label>
        <input id="create-trigger" value={props.trigger} onChange={event => props.onTrigger(event.target.value.trim().toLowerCase())} placeholder="mira_v1" maxLength={24} autoComplete="off" spellCheck={false} aria-invalid={!!triggerError} disabled={props.busy} />
        <p className={triggerError ? "is-error" : ""}>{triggerError ?? "Minuscules, un chiffre ou un _. Ex. mira_v1."}</p>
      </div>
      <div className="create-field">
        <label htmlFor="create-invariants">Traits qui ne changent pas</label>
        <input id="create-invariants" value={props.invariants} onChange={event => props.onInvariants(event.target.value)} placeholder="green eyes, freckles" spellCheck={false} disabled={props.busy} />
        <p>Au moins deux, en anglais, séparés par des virgules. Ils ne vont pas dans les légendes.</p>
      </div>
      {props.proxyOn && <div className="create-field">
        <label htmlFor="create-token">Code d’accès du studio</label>
        <input id="create-token" type="password" autoComplete="off" spellCheck={false} value={props.token} onChange={event => props.onToken(event.target.value)} disabled={props.busy} />
        <p>La clé fal du studio paie. Le code reste dans cette page, rien n’est stocké.</p>
      </div>}
    </div>

    <p className="create-plan">{FRAMING_LINE}. Face, trois-quarts et profil. {DATASET_SIZE} légendes au format du gate.</p>

    <div className="create-actions">
      <button type="button" className="button button-primary" disabled={!ready} aria-busy={props.busy} onClick={props.onBootstrap}>
        {props.busy ? "Préparation du lot…" : `Préparer les ${DATASET_SIZE} images · ≈ ${formatFalCost(COST)}`} <Arrow />
      </button>
      <button type="button" className="text-button" disabled={props.busy} onClick={props.onManual}>J’ai déjà {DATASET_SIZE} images</button>
    </div>
    {!props.proxyOn && <p className="create-status is-warn" role="status">Rail fal non branché. Le lot automatique attend l’adresse du proxy. Tu peux déjà importer tes images et ouvrir le repli Comfy.</p>}
    {props.proxyOn && props.refs.length > 0 && props.refs.length < FAL_VARY.minRefs && <p className="create-status">Encore une photo : il en faut {FAL_VARY.minRefs} ou {FAL_VARY.maxRefs}.</p>}
    {props.status && <p className="create-status" role="status">{props.status}</p>}
    {props.busy && <ol className="slot-meter" aria-label={`Avancement des ${DATASET_SIZE} cadrages`}>
      {PLAN.map((slot, index) => <li key={slot.index} className={props.arrived[index] ? "is-in" : ""}><span className="sr-only">{props.arrived[index] ? "reçu" : "en attente"} · {angleLabel(slot.angle)} · {framingLabel(slot.framing)}</span></li>)}
    </ol>}

    <details className="disclosure create-captions">
      <summary>Voir les {DATASET_SIZE} cadrages prévus</summary>
      <ol>{PLAN.map(slot => <li key={slot.index}><span>{String(slot.index).padStart(2, "0")}</span> {props.trigger && !triggerError ? bootstrapCaption(props.trigger, slot) : `${angleLabel(slot.angle)} · ${framingLabel(slot.framing)} · ${slot.variables}`}</li>)}</ol>
    </details>
    <p className="create-fine">Au clic, les photos partent vers fal via le proxy du studio. Le trigger n’est pas dans le prompt de génération : il entre seulement dans les légendes du lot. Chaque lancement est facturé, même si tu fermes la page.</p>
  </div>;
}
