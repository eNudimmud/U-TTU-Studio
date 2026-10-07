"use client";

import { formatUsd } from "@/lib/fal/prices";
import { workflowFiches, type WorkflowFiche } from "@/lib/workflow-fiches";
import { useStudio } from "./studio-context";

export function FichesScreen({ onLaunch }: { onLaunch(fiche: WorkflowFiche): void }) {
  const { connected, gate, falLinked, loraQuote, trainQuote, placeTrainQuote, placeSceneQuote, settings, loraResolution, trainingSteps, setSheet } = useStudio();
  const fiches = workflowFiches({
    rendu: connected ? gate.line : null,
    personnage: falLinked && loraQuote !== null ? formatUsd(loraQuote) : null,
    former: falLinked && trainQuote !== null ? formatUsd(trainQuote) : null,
    lieu: falLinked && placeTrainQuote !== null ? formatUsd(placeTrainQuote) : null,
    image: falLinked && placeSceneQuote !== null ? formatUsd(placeSceneQuote) : null,
  }, { seconds: settings.seconds, resolution: loraResolution, steps: trainingSteps });

  return <section className="u-screen" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">Fiches</p>
      <h1 id="u-title" tabIndex={-1}>Ce que le studio lance.</h1>
      <p className="u-lead">Cinq gestes déjà branchés. Chacun se lit ici. Le débit attend encore le geste, sur l’écran qui le tient.</p>
    </header>
    <div className="u-fiches">
      {fiches.map(fiche => {
        const linked = fiche.payer === "rendu" ? connected : falLinked;
        return <article key={fiche.id} className="u-card u-fiche">
          <h2>{fiche.name}</h2>
          <p>{fiche.sentence}</p>
          <p className="u-label">Ce qu’il faut</p>
          <ul className="u-fiche-inputs">
            {fiche.inputs.map(input => <li key={input}>{input}</li>)}
          </ul>
          <p className={`u-cost is-${linked ? "ok" : "warn"}`}>{fiche.cost}</p>
          <button type="button" className="u-secondary" onClick={() => {
            if (!linked) setSheet("relier");
            else onLaunch(fiche);
          }}>{linked ? "Lancer" : "Relier"}</button>
        </article>;
      })}
    </div>
  </section>;
}
