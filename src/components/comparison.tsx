"use client";

import Image from "next/image";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

export function Comparison() {
  const [showGate, setShowGate] = useState(false);
  function toggleGate() {
    const update = () => setShowGate(value => !value);
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(update);
    } else update();
    trackEvent("comparison_opened");
  }
  return <div className="comparison">
    <div className="comparison-grid">
      <article className="compare-panel drift">
        <div className="compare-label"><span>01 / Sans canon</span><span className="verdict fail">× DÉRIVE</span></div>
        <div className="compare-image"><Image src="/images/demo-drift.webp" alt="Deux portraits illustratifs : le visage et les détails du vêtement changent entre les images." fill sizes="(max-width: 700px) 100vw, 50vw" /></div>
        <div className="compare-caption"><h3>Une belle image.<br />Puis quelqu’un d’autre.</h3><p>Traits, matière, silhouette :<br />les écarts s’accumulent.</p></div>
      </article>
      <article className="compare-panel locked">
        <div className="compare-label"><span>02 / Avec Look-Lock</span><span className="verdict pass">✓ COHÉRENCE</span></div>
        <div className="compare-image"><Image src="/images/demo-locked.webp" alt="Deux portraits illustratifs conservent le même visage, la même tenue et la même lumière, avec un léger changement d’angle." fill sizes="(max-width: 700px) 100vw, 50vw" /></div>
        <div className="compare-caption"><h3>L’angle change.<br />L’identité reste.</h3><p>Les invariants sont définis.<br />Les écarts sont refusés.</p></div>
      </article>
    </div>
    <div className="compare-toolbar"><p>Démonstration visuelle générée · prototype, pas un résultat client.</p><button type="button" className="text-button" onClick={toggleGate} aria-expanded={showGate} aria-controls="comparison-gate">{showGate ? "Fermer le contrôle" : "Révéler le contrôle"}<span aria-hidden="true">{showGate ? "−" : "+"}</span></button></div>
    <div id="comparison-gate" className="comparison-gate" hidden={!showGate}>
      <p className="eyebrow">Exemple de grille · contrôle humain</p>
      <div className="table-scroll"><table><caption className="sr-only">Exemple de comparaison des critères d’identité</caption><thead><tr><th scope="col">Invariant à vérifier</th><th scope="col">Sans canon</th><th scope="col">Look-Lock</th></tr></thead><tbody>
        {["Traits et proportions du visage", "Coupe de la tenue et détails", "Palette et direction de lumière"].map((item, i) => <tr key={item}><th scope="row">{item}</th><td className={i === 2 ? "pass" : "fail"}>{i === 2 ? "PASS" : "FAIL"}</td><td className="pass">PASS</td></tr>)}
      </tbody></table></div>
      <p>Un invariant échoue ? L’image est refusée. On corrige avant la série suivante. Cette grille illustre la méthode ; elle ne mesure pas automatiquement les images.</p>
    </div>
  </div>;
}
