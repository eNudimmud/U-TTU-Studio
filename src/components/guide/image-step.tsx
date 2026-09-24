"use client";

import { APP_LABELS, COMFY_APPS, FLUX_STACK, estimatePromptTest, estimateTrainRun } from "@/lib/comfy-stack";
import { cleanVariables, findInvariantHits, parseInvariants } from "@/lib/gate/captions";
import { formatCredits } from "@/lib/gate/report";
import { trackEvent } from "@/lib/analytics";
import { Arrow } from "../glyph";
import { CopyButton } from "./copy-button";

interface Props {
  trigger: string;
  invariants: string;
  scene: string;
  strength: number;
  seed: number;
  count: number;
  steps: number;
  received: boolean;
  onScene: (value: string) => void;
  onStrength: (value: number) => void;
  onSeed: (value: number) => void;
  onCount: (value: number) => void;
  onReceived: (value: boolean) => void;
}

const DIAGNOSTICS = [
  ["Avec LoRA ≈ témoin : l’identité n’apparaît pas.", "Trigger absent du prompt, ou résultat du test à blanc (20 étapes) pris pour le vrai run.", "Vérifie le prompt, relance avec les étapes du run réel."],
  ["L’identité n’apparaît que si tu écris ses traits.", "Légendes qui redisaient l’identité.", "Le gate bloque ce cas (G15, G16) : reprends l’étape 1 si tu l’as contourné."],
  ["Même pose, même décor, le prompt est ignoré.", "Surapprentissage ou lot trop peu varié.", "Force 0,8 au prochain run ; sinon plus de variété (G11 à G13)."],
  ["Visage fondu ou artefacts à force 1,0.", "Flou ou doublon passé à travers, ou force trop haute.", "Force 0,8 ; revois G07 et G08."],
  ["La courbe descend, l’image est fausse.", "Normal : la loss mesure l’apprentissage, pas la qualité du corpus.", "Juge l’image, jamais la courbe."],
];

export function ImageStep(props: Props) {
  const scene = cleanVariables(props.scene);
  const prompt = [props.trigger.trim(), scene].filter(Boolean).join(", ");
  const identityHits = findInvariantHits(scene, parseInvariants(props.invariants));
  const promptTest = estimatePromptTest();
  const rerun = estimateTrainRun(props.steps, props.count);
  const strengthHint = props.strength < 0.8 ? "Identité diluée : utile si l’image fige la pose." : props.strength > 1.15 ? "Risque d’artefacts et de pose figée." : "Zone normale.";

  return <div className="image-step">
    <div className="image-settings">
      <div className="field">
        <label htmlFor="scene">Scène, en anglais</label>
        <input id="scene" value={props.scene} onChange={event => props.onScene(event.target.value)} placeholder="standing on a rooftop at dusk, wind in the coat, golden hour" maxLength={260} spellCheck={false} aria-describedby="scene-help" />
        <p className={`field-help${identityHits.length ? " field-error" : ""}`} id="scene-help">{identityHits.length
          ? `Tu réécris l’identité (« ${identityHits.join(" », « ")} »). Pour juger la LoRA, laisse le trigger la porter.`
          : "Décris la scène, pas la personne : le trigger la porte."}</p>
      </div>
      <div className="field">
        <label htmlFor="strength">Force LoRA <strong>{props.strength.toFixed(2)}</strong></label>
        <input id="strength" type="range" min={0.5} max={1.3} step={0.05} value={props.strength} onChange={event => props.onStrength(Number(event.target.value))} aria-describedby="strength-help" />
        <p className="field-help" id="strength-help">{strengthHint}</p>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="seed">Seed</label>
          <div className="seed-row">
            <input id="seed" type="number" min={0} value={props.seed} onChange={event => props.onSeed(Math.max(0, Math.floor(Number(event.target.value) || 0)))} />
            <button type="button" className="text-button" onClick={() => props.onSeed(Math.floor(Math.random() * 2 ** 31))}>Nouveau seed</button>
          </div>
        </div>
        <fieldset className="field count-choice">
          <legend>Nombre d’images</legend>
          {[1, FLUX_STACK.image.maxCount].map(value => <label key={value} className="check-inline"><input type="radio" name="count" checked={props.count === value} onChange={() => props.onCount(value)} /><span>{value === 1 ? "1 image" : `Grille de ${value}`}</span></label>)}
        </fieldset>
      </div>
      <div className="report-values" aria-label="Valeurs à reporter dans l’app Comfy">
        <p className="eyebrow">À reporter dans l’app</p>
        <dl>
          <div><dt>{APP_LABELS.prompt}</dt><dd><code>{prompt || "—"}</code><CopyButton text={prompt} /></dd></div>
          <div><dt>{APP_LABELS.strength}</dt><dd><code>{props.strength.toFixed(2)}</code></dd></div>
          <div><dt>{APP_LABELS.seed}</dt><dd><code>{props.seed}</code></dd></div>
          <div><dt>{APP_LABELS.count}</dt><dd><code>{props.count}</code></dd></div>
        </dl>
      </div>
      <div className="prompt-test">
        <p><strong>Règle la scène avant de payer l’entraînement.</strong> L’app de test tourne sans LoRA : même prompt, même seed, tu vois la composition, la lumière et le cadrage. Le trigger n’y a aucun effet. Compte {formatCredits(promptTest)} par image.</p>
        <a className="quiet-link" href={COMFY_APPS.prompt.url} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("prompt_app_opened")}>Ouvrir le test de prompt <Arrow diagonal /><span className="sr-only">(nouvel onglet)</span></a>
      </div>
    </div>

    <aside className="read-panel" aria-labelledby="read-title">
      <p className="eyebrow" id="read-title">Lire le résultat</p>
      <ol className="outputs">
        <li><strong>{APP_LABELS.withLora}</strong> : ton image, ou ta grille.</li>
        <li><strong>{APP_LABELS.control}</strong> : ce que Flux fait sans ta LoRA.</li>
        <li><strong>{APP_LABELS.loss}</strong>.</li>
      </ol>
      <div className="table-scroll" role="region" aria-label="Diagnostic du résultat" tabIndex={0}>
        <table className="diagnostic">
          <thead><tr><th scope="col">Tu vois</th><th scope="col">Cause probable</th><th scope="col">Quoi faire</th></tr></thead>
          <tbody>{DIAGNOSTICS.map(([symptom, cause, fix]) => <tr key={symptom}><th scope="row">{symptom}</th><td>{cause}</td><td>{fix}</td></tr>)}</tbody>
        </table>
      </div>
      <label className="check-inline"><input type="checkbox" checked={props.received} onChange={event => props.onReceived(event.target.checked)} /><span>Image reçue</span></label>
      {props.received && <p className="inline-status pass" role="status">Fait. Une autre image = un autre run ({formatCredits(rerun)}). Garde le ZIP : c’est ton dataset propre, réutilisable.</p>}
    </aside>
  </div>;
}
