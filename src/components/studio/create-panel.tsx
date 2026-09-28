"use client";

import { useState, type DragEvent } from "react";
import { DATASET_SIZE } from "@/lib/comfy-stack";
import { bootstrapCaption, bootstrapPlan } from "@/lib/fal-bootstrap";
import { FAL_ACCESS_MIN, FAL_VARY, estimateFalVary, formatFalCost } from "@/lib/fal-stack";
import { checkTrigger } from "@/lib/gate/captions";
import { invariantFieldError, prepareLaunch } from "@/lib/prepare-preflight";
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
  const invariantError = invariantFieldError(props.invariants);
  const attempt = {
    proxyOn: props.proxyOn,
    refCount: props.refs.length,
    trigger: props.trigger,
    invariants: props.invariants,
    token: props.token,
    busy: props.busy,
  };
  const ready = prepareLaunch(attempt).launch;
  const refsReady = props.refs.length >= FAL_VARY.minRefs && props.refs.length <= FAL_VARY.maxRefs;
  const shortToken = props.proxyOn && !props.busy && !triggerError && !!props.trigger && refsReady && !invariantError && props.invariants.trim().length > 0 && props.token.trim().length < FAL_ACCESS_MIN;
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
    <label id="create-drop" className={`create-drop${dragging ? " is-dragging" : ""}${props.busy ? " is-busy" : ""}`} aria-busy={props.busy} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={props.busy} aria-label="Déposer 2 ou 3 photos de la même personne" onChange={event => { take([...(event.target.files ?? [])]); event.target.value = ""; }} />
      <span className="create-mark" aria-hidden="true">iii</span>
      {props.refs.length === 0 ? <>
        <span className="create-drop-title">Dépose 2 ou 3 photos</span>
        <span className="create-drop-hint">Même personne · JPEG, PNG ou WebP · 8 Mo chacune</span>
      </> : <>
        <span className="ref-strip">{props.refs.map(ref => <img key={ref.url} src={ref.url} alt="" />)}</span>
        <span className="create-drop-title">Photos prêtes</span>
        <span className="create-drop-hint">{props.refs.length} photo{props.refs.length > 1 ? "s" : ""} · reclique pour remplacer</span>
      </>}
      {props.busy && <span className="create-drop-hint">Préparation du lot…</span>}
    </label>

    <div className="create-fields">
      <div className="create-field">
        <label htmlFor="create-trigger">Mot d’appel</label>
        <input id="create-trigger" value={props.trigger} onChange={event => props.onTrigger(event.target.value.trim().toLowerCase())} placeholder="mira_v1" maxLength={24} autoComplete="off" spellCheck={false} aria-invalid={!!triggerError} disabled={props.busy} />
        <p className={triggerError ? "is-error" : ""}>{triggerError ?? "Minuscules, un chiffre ou un _. Ex. mira_v1."}</p>
      </div>
      <div className="create-field">
        <label htmlFor="create-invariants">Traits qui ne changent pas</label>
        <input id="create-invariants" value={props.invariants} onChange={event => props.onInvariants(event.target.value)} placeholder="green eyes, freckles" spellCheck={false} disabled={props.busy} aria-invalid={!!invariantError} aria-describedby="create-invariants-help" />
        <p id="create-invariants-help" className={invariantError ? "is-error" : ""}>{invariantError ?? "Au moins deux, en anglais, séparés par des virgules. Ils ne vont pas dans les légendes. Sans eux, le lot ne part pas."}</p>
      </div>
      {props.proxyOn && <div className="create-field">
        <label htmlFor="create-token">Code d’accès du studio</label>
        <input id="create-token" type="password" autoComplete="off" spellCheck={false} value={props.token} onChange={event => props.onToken(event.target.value)} disabled={props.busy} />
        <p>La clé fal du studio paie. Le code reste dans cette page, rien n’est stocké.</p>
      </div>}
    </div>

    <div className="plan-preview">
      <p className="create-plan"><span>2–3</span> photos → <span>{DATASET_SIZE}</span> cadrages. {FRAMING_LINE}. Face, trois-quarts et profil.</p>
      <ol className="slot-meter" aria-label={`Plan des ${DATASET_SIZE} cadrages`}>
        {PLAN.map((slot, index) => <li key={slot.index} className={props.busy && props.arrived[index] ? "is-in" : ""}>
          <span className="sr-only">{String(slot.index).padStart(2, "0")} · {angleLabel(slot.angle)} · {framingLabel(slot.framing)}{props.busy ? ` · ${props.arrived[index] ? "reçu" : "en attente"}` : ""}</span>
        </li>)}
      </ol>
    </div>

    {!props.proxyOn && <aside id="prepare-offline" className="offline-fal" role="status">
      <p><strong>Lot automatique indisponible.</strong> Proxy fal absent. « Préparer les {DATASET_SIZE} images » ne lance rien, et rien n’est facturé.</p>
      <p>Ici, le chemin est « J’ai déjà {DATASET_SIZE} images ». Le gate reste dans cette page.</p>
    </aside>}
    <div className={`create-actions${props.proxyOn ? "" : " is-offline"}`}>
      {!props.proxyOn && <button type="button" className="button button-primary" disabled={props.busy} onClick={props.onManual}>J’ai déjà {DATASET_SIZE} images <Arrow /></button>}
      <button type="button" className={`button ${props.proxyOn ? "button-primary" : "button-outline"}`} disabled={!ready} aria-busy={props.busy} aria-describedby={props.proxyOn ? undefined : "prepare-offline"} onClick={() => { if (prepareLaunch(attempt).launch) props.onBootstrap(); }}>
        {props.busy ? "Préparation du lot…" : props.proxyOn ? `Préparer les ${DATASET_SIZE} images · ≈ ${formatFalCost(COST)}` : `Préparer les ${DATASET_SIZE} images`} <Arrow />
      </button>
      {props.proxyOn && <button type="button" className="button button-outline" disabled={props.busy} onClick={props.onManual}>J’ai déjà {DATASET_SIZE} images</button>}
    </div>
    {props.proxyOn && <p className="create-path">Deux traits constants, un mot d’appel, deux ou trois photos. Tu peux aussi importer tes {DATASET_SIZE} images, sans lancer le lot.</p>}
    {props.proxyOn && !props.busy && !triggerError && !!props.trigger && refsReady && !props.invariants.trim() && <p className="create-status">Deux traits constants avant l’envoi. Le bouton reste éteint : le gate les exige, et le lot ne part pas sans eux.</p>}
    {props.proxyOn && props.refs.length > 0 && props.refs.length < FAL_VARY.minRefs && <p className="create-status">Encore une photo : il en faut {FAL_VARY.minRefs} ou {FAL_VARY.maxRefs}.</p>}
    {shortToken && !props.busy && <p className="create-status">Le code d’accès du studio débloque le lot. Rien n’est envoyé avant le clic.</p>}
    {props.status && <p className="create-status" role="status">{props.status}</p>}

    <details className="disclosure create-captions">
      <summary>Voir les {DATASET_SIZE} cadrages prévus</summary>
      <ol>{PLAN.map(slot => <li key={slot.index}><span>{String(slot.index).padStart(2, "0")}</span> {props.trigger && !triggerError ? bootstrapCaption(props.trigger, slot) : `${angleLabel(slot.angle)} · ${framingLabel(slot.framing)} · ${slot.variables}`}</li>)}</ol>
    </details>
    <p className="create-fine">{props.proxyOn
      ? "Au clic, les photos partent vers fal via le proxy du studio. Le trigger n’est pas dans le prompt de génération : il entre seulement dans les légendes du lot. Chaque lancement est facturé, même si tu fermes la page."
      : "Sans proxy, préparer le lot ne contacte personne. L’import et le gate restent dans le navigateur."}</p>
  </div>;
}
