"use client";

import Image from "next/image";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

const criteria = [
  ["Visage", "Traits interchangeables", "Traits humains fins, regard calme"],
  ["Peau", "Peau lisse, dorure uniforme", "Peau minérale, fines fissures d’or"],
  ["Tenue", "Armure d’apparat", "Capuche noire, textile tactique usé"],
  ["Membres", "Halo massif ou pattes organiques", "Architecture arachnide fine et articulée"],
];

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
        <div className="compare-label"><span>01 / L’intention seule</span><span className="verdict fail">× INCOMPLET</span></div>
        <div className="undefined-canon"><span className="eyebrow">Instruction ouverte</span><blockquote>« Une déesse.<br />Du noir. De l’or. »</blockquote><dl><div><dt>Le visage</dt><dd>Non défini</dd></div><div><dt>La matière</dt><dd>Non définie</dd></div><div><dt>La silhouette</dt><dd>Non définie</dd></div></dl></div>
        <div className="compare-caption"><h3>Tout reste<br />à réinventer.</h3><p>Chaque zone floue<br />laisse entrer la dérive.</p></div>
      </article>
      <article className="compare-panel locked">
        <div className="compare-label"><span>02 / Le canon U*TTU</span><span className="verdict pass">✓ RÉFÉRENCE</span></div>
        <div className="canon-study"><div className="canon-study-portrait"><Image src="/images/uttu-canon-portrait.webp" alt="Référence U*TTU : capuche noire usée, visage minéral, fines tresses et articulations de bronze." fill sizes="(max-width: 600px) 60vw, 30vw" /><span>01 / Présence</span></div><div className="canon-study-detail"><Image src="/images/uttu-canon-detail.webp" alt="Détail de la peau minérale d’U*TTU : fissures d’or fines autour des lèvres et tresses aux anneaux de bronze." fill sizes="(max-width: 600px) 40vw, 20vw" /><span>02 / Matière</span></div></div>
        <div className="compare-caption"><h3>Chaque trait<br />a sa règle.</h3><p>Peau. Fissures. Tresses.<br />Les repères deviennent un frein.</p></div>
      </article>
    </div>
    <div className="compare-toolbar"><p>Références U*TTU · exemple de critères appliqués au personnage du studio.</p><button type="button" className="text-button" onClick={toggleGate} aria-expanded={showGate} aria-controls="comparison-gate">{showGate ? "Fermer le contrôle" : "Révéler le contrôle"}<span aria-hidden="true">{showGate ? "−" : "+"}</span></button></div>
    <div id="comparison-gate" className="comparison-gate" hidden={!showGate}>
      <p className="eyebrow">Exemple de grille · contrôle humain</p>
      <div className="table-scroll" role="region" aria-label="Critères de contrôle U*TTU" tabIndex={0}><table><caption className="sr-only">Critères de refus et références visuelles du canon U*TTU</caption><thead><tr><th scope="col">Invariant</th><th scope="col">FAIL / À refuser</th><th scope="col">PASS / À préserver</th></tr></thead><tbody>
        {criteria.map(([name, fail, pass]) => <tr key={name}><th scope="row">{name}</th><td className="fail">{fail}</td><td className="pass">{pass}</td></tr>)}
      </tbody></table></div>
      <p>Un invariant échoue ? L’image est refusée. On corrige avant la série suivante. La comparaison aux références reste humaine.</p>
    </div>
  </div>;
}
