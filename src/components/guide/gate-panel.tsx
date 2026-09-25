"use client";

import { useState } from "react";
import { DATASET_SIZE } from "@/lib/comfy-stack";
import { FRAMING_CHECK_ID, FRAMING_TARGETS_LABEL, SECTIONS, framingAdvice, type CheckStatus, type FramingCoverage, type FramingRow, type GateCheck, type GateResult } from "@/lib/gate/rules";
import type { Framing } from "@/lib/gate/vocabulary";

const STATUS_LABEL: Record<CheckStatus, string> = { pass: "PASS", fail: "FAIL", warn: "À NOTER", todo: "À FAIRE" };

export function gateSummary(result: GateResult): string {
  if (result.verdict === "PASS") return `PASS · ${result.checks.length} contrôles${result.warnCount ? ` · ${result.warnCount} à noter` : ""}`;
  if (result.failCount) return `FAIL · ${result.failCount} bloquant${result.failCount > 1 ? "s" : ""}${result.todoCount ? ` · ${result.todoCount} à faire` : ""}`;
  return `${result.todoCount} contrôle${result.todoCount > 1 ? "s" : ""} à faire`;
}

export const gateTone = (result: GateResult) => result.verdict === "PASS" ? "pass" : result.failCount ? "fail" : "todo";

const FRAMING_PLURAL: Record<Framing, string> = { "gros-plan": "gros plans", buste: "plans buste", pied: "images en plein pied" };
const rowDelta = (row: FramingRow) => row.drift === "over" ? `+${row.count - row.max}` : row.drift === "under" ? `−${row.min - row.count}` : "";
const rowSummary = (row: FramingRow) => `${row.label} : ${row.count} image${row.count > 1 ? "s" : ""}, repère ${row.min} à ${row.max}${row.drift === "over" ? `, ${row.count - row.max} de trop` : row.drift === "under" ? `, il en manque ${row.min - row.count}` : ""}.`;

function FramingMeter({ check, coverage, onShowImages }: { check: GateCheck; coverage: FramingCoverage; onShowImages: (ids: string[]) => void }) {
  // A shortfall can still be filled while some kept images have no framing yet; an excess cannot.
  const rows = coverage.rows.map(row => row.drift === "under" && coverage.untagged > 0 ? { ...row, drift: null } : row);
  const drifts = rows.filter(row => row.drift);
  return <li className={`gate-check framing-check status-${check.status}`}>
    <span className="gate-status">{STATUS_LABEL[check.status]}</span>
    <p className="gate-label"><span className="gate-id">{check.id}</span> {check.label}</p>
    <ul className="framing-rows" aria-label="Cadrages des images gardées">
      {rows.map(row => <li key={row.framing} className={`framing-row${row.drift ? ` is-${row.drift}` : ""}`}>
        <span className="framing-name" aria-hidden="true">{row.label}</span>
        <span className="framing-track" aria-hidden="true">
          {Array.from({ length: DATASET_SIZE }, (_, i) => <i key={i} className={[i < row.count && "is-filled", i >= row.min - 1 && i < row.max && "is-target", i < row.count && i >= row.max && "is-excess"].filter(Boolean).join(" ")} />)}
        </span>
        <span className="framing-count" aria-hidden="true">{row.count}{row.drift && <small>{rowDelta(row)}</small>}</span>
        <span className="framing-target" aria-hidden="true">{row.min}–{row.max}</span>
        <span className="sr-only">{rowSummary(row)}</span>
      </li>)}
    </ul>
    {check.status === "todo" && <p className="gate-detail framing-detail">{coverage.untagged ? `${coverage.untagged} image${coverage.untagged > 1 ? "s gardées" : " gardée"} sans cadrage.` : check.detail}</p>}
    {check.status === "warn" && drifts.map(row => <div key={row.framing} className="framing-detail">
      <p className="gate-detail">{framingAdvice(row)}</p>
      {row.drift === "over" && <button type="button" className="gate-show" onClick={() => onShowImages(row.imageIds)}>Voir les {row.count} {FRAMING_PLURAL[row.framing]}</button>}
    </div>)}
    <p className="framing-note">Repère : {FRAMING_TARGETS_LABEL} des {DATASET_SIZE} images. Ne bloque rien ; le minimum bloquant reste G13.</p>
  </li>;
}

export function GatePanel({ result, onShowImages }: { result: GateResult; onShowImages: (ids: string[]) => void }) {
  const [showPassed, setShowPassed] = useState(false);
  const passed = result.checks.filter(item => item.status === "pass" && item.id !== FRAMING_CHECK_ID).length;
  return <aside id="gate-panel" className={`gate-panel gate-${gateTone(result)}`} aria-labelledby="gate-title">
    <div className="gate-head">
      <p className="eyebrow" id="gate-title">Gate dataset</p>
      <p className="gate-verdict" role="status" aria-live="polite">{gateSummary(result)}</p>
      <p className="gate-note">{result.verdict === "PASS" ? "L’étape 2 est ouverte." : "L’étape 2 reste fermée tant qu’un contrôle n’est pas en PASS."}</p>
      {passed > 0 && <button type="button" className="gate-toggle" aria-expanded={showPassed} onClick={() => setShowPassed(value => !value)}>{showPassed ? "Masquer" : "Afficher"} les {passed} PASS</button>}
    </div>
    {SECTIONS.map(section => {
      const meter = section.id === "couverture" ? result.checks.find(item => item.id === FRAMING_CHECK_ID) : undefined;
      const checks = result.checks.filter(item => item.section === section.id && item.id !== FRAMING_CHECK_ID && (showPassed || item.status !== "pass"));
      if (!checks.length && !meter) return null;
      return <section key={section.id} className="gate-section" aria-label={section.label}>
        <h4>{section.label}</h4>
        <ul>
          {meter && <FramingMeter check={meter} coverage={result.framing} onShowImages={onShowImages} />}
          {checks.map(item => <li key={item.id} className={`gate-check status-${item.status}`}>
            <span className="gate-status">{STATUS_LABEL[item.status]}</span>
            <div>
              <p className="gate-label"><span className="gate-id">{item.id}</span> {item.label}</p>
              {item.status !== "pass" && <p className="gate-detail">{item.detail}</p>}
              {item.status !== "pass" && item.imageIds && <button type="button" className="gate-show" onClick={() => onShowImages(item.imageIds!)}>Voir {item.imageIds.length > 1 ? `les ${item.imageIds.length} images` : "l’image"}</button>}
            </div>
          </li>)}
        </ul>
      </section>;
    })}
  </aside>;
}
