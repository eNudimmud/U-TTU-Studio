"use client";

import { useState } from "react";
import { SECTIONS, type CheckStatus, type GateResult } from "@/lib/gate/rules";

const STATUS_LABEL: Record<CheckStatus, string> = { pass: "PASS", fail: "FAIL", warn: "À NOTER", todo: "À FAIRE" };

export function gateSummary(result: GateResult): string {
  if (result.verdict === "PASS") return `PASS · ${result.checks.length} contrôles${result.warnCount ? ` · ${result.warnCount} à noter` : ""}`;
  if (result.failCount) return `FAIL · ${result.failCount} bloquant${result.failCount > 1 ? "s" : ""}${result.todoCount ? ` · ${result.todoCount} à faire` : ""}`;
  return `${result.todoCount} contrôle${result.todoCount > 1 ? "s" : ""} à faire`;
}

export const gateTone = (result: GateResult) => result.verdict === "PASS" ? "pass" : result.failCount ? "fail" : "todo";

export function GatePanel({ result, onShowImages }: { result: GateResult; onShowImages: (ids: string[]) => void }) {
  const [showPassed, setShowPassed] = useState(false);
  const passed = result.checks.filter(item => item.status === "pass").length;
  return <aside id="gate-panel" className={`gate-panel gate-${gateTone(result)}`} aria-labelledby="gate-title">
    <div className="gate-head">
      <p className="eyebrow" id="gate-title">Gate dataset</p>
      <p className="gate-verdict" role="status" aria-live="polite">{gateSummary(result)}</p>
      <p className="gate-note">{result.verdict === "PASS" ? "L’étape 2 est ouverte." : "L’étape 2 reste fermée tant qu’un contrôle n’est pas en PASS."}</p>
      {passed > 0 && <button type="button" className="gate-toggle" aria-expanded={showPassed} onClick={() => setShowPassed(value => !value)}>{showPassed ? "Masquer" : "Afficher"} les {passed} PASS</button>}
    </div>
    {SECTIONS.map(section => {
      const checks = result.checks.filter(item => item.section === section.id && (showPassed || item.status !== "pass"));
      if (!checks.length) return null;
      return <section key={section.id} className="gate-section" aria-label={section.label}>
        <h4>{section.label}</h4>
        <ul>
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
