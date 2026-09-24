"use client";

import { useState } from "react";
import { APP_LABELS, estimatePromptTest, estimateTrainRun } from "@/lib/comfy-stack";
import { formatCredits } from "@/lib/gate/report";
import { TEST_GRID, decimalFr, gridPrompt, inUsageBand } from "@/lib/test-grid";
import { CopyButton } from "./copy-button";

const band = `${decimalFr(TEST_GRID.usageBand.low)}–${decimalFr(TEST_GRID.usageBand.high)}`;
const SCALE = { min: 0.5, max: 1 };
const at = (value: number) => `${((value - SCALE.min) / (SCALE.max - SCALE.min)) * 100}%`;

function StrengthScale() {
  const { low, high } = TEST_GRID.usageBand;
  return <div className="strength-scale" aria-hidden="true">
    <span className="strength-band" style={{ left: at(low), width: `${((high - low) / (SCALE.max - SCALE.min)) * 100}%` }} />
    {[SCALE.min, ...TEST_GRID.strengths, SCALE.max].map(value => <span key={value} className={`strength-tick${TEST_GRID.strengths.some(item => item === value) ? " is-grid" : ""}`} style={{ left: at(value) }}><small>{decimalFr(value)}</small></span>)}
  </div>;
}

export function TestGrid({ trigger, seed, steps }: { trigger: string; seed: number; steps: number }) {
  const [pick, setPick] = useState({ row: 0, strength: 1 });
  const row = TEST_GRID.rows[pick.row];
  const strength = TEST_GRID.strengths[pick.strength].toFixed(2);
  const prompt = gridPrompt(trigger, row.scene);

  return <section className="test-grid" aria-labelledby="test-grid-title">
    <header className="test-grid-head">
      <p className="eyebrow">Grille de test</p>
      <h4 id="test-grid-title">Une grille fixe pour juger la LoRA</h4>
      <p>3 prompts, 3 forces, la seed {seed} partout : chaque case se compare aux autres et à son témoin sans LoRA. Choisis une case, reporte-la dans l’app de l’étape 2.</p>
    </header>
    <div className="test-grid-body">
      <div className="test-grid-matrix">
        <table>
          <caption className="sr-only">Prompts en lignes, force LoRA en colonnes. Chaque case est un run.</caption>
          <thead>
            <tr>
              <th scope="col">Prompt</th>
              {TEST_GRID.strengths.map(value => <th key={value} scope="col" className={inUsageBand(value) ? "in-band" : undefined}>
                {value.toFixed(2)}{inUsageBand(value) && <small>bande d’usage</small>}
              </th>)}
            </tr>
          </thead>
          <tbody>
            {TEST_GRID.rows.map((item, r) => <tr key={item.id}>
              <th scope="row">
                <div className="test-grid-row-head">
                  <span className="test-grid-index" aria-hidden="true">{r + 1}</span>
                  <span className="test-grid-label">{item.label}{item.optional && <small> · facultatif</small>}</span>
                  <code className="test-grid-prompt" lang="en">{gridPrompt(trigger, item.scene)}</code>
                </div>
              </th>
              {TEST_GRID.strengths.map((value, c) => <td key={value} className={inUsageBand(value) ? "in-band" : undefined}>
                <button type="button" aria-pressed={pick.row === r && pick.strength === c} aria-label={`${item.label}, force ${value.toFixed(2)}`} onClick={() => setPick({ row: r, strength: c })}>{value.toFixed(2)}</button>
              </td>)}
            </tr>)}
          </tbody>
        </table>
        <p className="small-print">Ordre conseillé : case 1 à 0,75 d’abord. Identité faible : 0,90. Pose figée : 0,60. Puis les lignes 2 et 3 à la force retenue.</p>
      </div>

      <div className="test-grid-side">
        <div className="report-values" aria-label={`Case ${pick.row + 1}, force ${strength} : valeurs à reporter dans l’app de l’étape 2`}>
          <p className="eyebrow">Case {pick.row + 1} · {decimalFr(Number(strength))} — à reporter à l’étape 2</p>
          <dl>
            <div><dt>{APP_LABELS.prompt}</dt><dd><code lang="en">{prompt}</code><CopyButton text={prompt} /></dd></div>
            <div><dt>{APP_LABELS.strength}</dt><dd><code>{strength}</code><CopyButton text={strength} /></dd></div>
            <div><dt>{APP_LABELS.seed}</dt><dd><code>{seed}</code></dd></div>
            <div><dt>{APP_LABELS.count}</dt><dd><code>{TEST_GRID.images}</code></dd></div>
            <div><dt>Étapes d’entraînement</dt><dd><code>{steps}</code></dd></div>
          </dl>
          <p className="small-print">{row.note}</p>
        </div>
        <div className="test-grid-reading">
          <p className="eyebrow">Lire la grille</p>
          <StrengthScale />
          <dl>
            <div><dt>{band}</dt><dd>Identité nette, prompt suivi : c’est la bande d’usage.</dd></div>
            <div><dt>0,60–0,75</dt><dd>Visage déjà verrouillé, mais la pose ou la lumière du prompt cassent : surentraîné. Au prochain run, moins d’étapes.</dd></div>
            <div><dt>0,90–1,00</dt><dd>Identité toujours absente : ce n’est pas la force. Dataset ou trigger : reprends l’étape 1.</dd></div>
            <div><dt>Témoin</dt><dd>Chaque « {APP_LABELS.withLora} » se lit à côté de son témoin : même prompt, même seed, seule la LoRA change.</dd></div>
          </dl>
        </div>
      </div>
    </div>
    <p className="small-print test-grid-cost">Pas de checkpoint intermédiaire : Comfy Cloud n’enregistre pas la LoRA (pas de SaveLoRA), on ne peut donc pas comparer l’étape 400 à l’étape 800. La grille remplace cette comparaison : avec ou sans LoRA, et trois forces. Une case = un run réel complet, entraînement compris : {formatCredits(estimateTrainRun(steps, TEST_GRID.images))}. Chaque prompt se vérifie d’abord sans LoRA dans l’app de test ci-dessous, pour {formatCredits(estimatePromptTest())}.</p>
  </section>;
}
