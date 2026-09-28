"use client";

import { useGoToMode } from "./mode-context";
import { useStudioSession } from "./session";

const DECISION = { garder: "Gardée", rejeter: "Rejetée", "a-trier": "À trier" } as const;

export function LibraryPanel() {
  const session = useStudioSession();
  const go = useGoToMode();
  const hasRefs = session.refPreviews.length > 0;
  const hasLot = session.images.length > 0;

  return <section className="mode-panel" aria-labelledby="mode-title">
    <header className="mode-hero">
      <p className="eyebrow">Bibliothèque</p>
      <h1 id="mode-title" tabIndex={-1}>Ce que cette page garde.</h1>
      <p className="mode-lead">Les images de la session, seulement. Fermer ou recharger les efface. Aucun envoi.</p>
    </header>
    {!hasRefs && !hasLot ? <div className="library-empty">
      <span className="create-mark" aria-hidden="true">iii</span>
      <strong>Vide, pour l’instant.</strong>
      <p>Dépose des photos dans Créer. Elles apparaîtront ici, le temps de la page.</p>
      <button type="button" className="button button-outline" onClick={() => go("creer")}>Aller à Créer</button>
    </div> : <div className="library-groups">
      {hasRefs && <section aria-labelledby="library-refs">
        <h2 id="library-refs">Photos déposées</h2>
        <ul className="library-grid">
          {session.refPreviews.map(ref => <li key={ref.url}><figure><img src={ref.url} alt="" /><figcaption>{ref.name}</figcaption></figure></li>)}
        </ul>
      </section>}
      {hasLot && <section aria-labelledby="library-lot">
        <h2 id="library-lot">Lot en revue</h2>
        <ul className="library-grid">
          {session.images.map(image => <li key={image.id}><figure>
            {session.previews[image.id] && <img src={session.previews[image.id]} alt="" />}
            <figcaption>{image.name}<span>{DECISION[image.decision]}</span></figcaption>
          </figure></li>)}
        </ul>
      </section>}
    </div>}
  </section>;
}
