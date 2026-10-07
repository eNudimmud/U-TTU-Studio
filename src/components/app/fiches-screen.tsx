"use client";

import { useI18n } from "@/components/i18n/provider";
import { runGate } from "@/lib/credits";
import { formatUsd } from "@/lib/fal/prices";
import { CLIPS_MIN } from "@/lib/lora/dataset";
import { PLACE_SHOTS_MIN } from "@/lib/lora/place";
import { workflowFiches, type WorkflowFiche } from "@/lib/workflow-fiches";
import { useStudio } from "./studio-context";

export function FichesScreen({ onLaunch }: { onLaunch(fiche: WorkflowFiche): void }) {
  const { connected, balance, claim, falLinked, trainQuote, placeTrainQuote, placeSceneQuote, settings, loraResolution, trainingSteps, setSheet } = useStudio();
  const { t, say } = useI18n();
  const fiches = workflowFiches({
    rendu: connected ? runGate(balance, claim).line : null,
    former: falLinked && trainQuote !== null ? formatUsd(trainQuote) : null,
    lieu: falLinked && placeTrainQuote !== null ? formatUsd(placeTrainQuote) : null,
    image: falLinked && placeSceneQuote !== null ? formatUsd(placeSceneQuote) : null,
  }, { seconds: settings.seconds, resolution: loraResolution, steps: trainingSteps });

  return <section className="u-screen" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">{t("fiche.kicker")}</p>
      <h1 id="u-title" tabIndex={-1}>{t("fiche.title")}</h1>
      <p className="u-lead">{t("fiche.lead")}</p>
    </header>
    <div className="u-fiches">
      {fiches.map(fiche => {
        const linked = fiche.payer === "rendu" ? connected : falLinked;
        const inputs = (t.raw(`fiche.${fiche.id}.inputs`) as string[]).map(line => line.replaceAll("{clips}", String(CLIPS_MIN)).replaceAll("{views}", String(PLACE_SHOTS_MIN)));
        return <article key={fiche.id} className="u-card u-fiche">
          <h2>{t(`fiche.${fiche.id}.name`)}</h2>
          <p>{t(`fiche.${fiche.id}.sentence`)}</p>
          <p className="u-label">{t("fiche.needs")}</p>
          <ul className="u-fiche-inputs">
            {inputs.map(input => <li key={input}>{input}</li>)}
          </ul>
          <p className={`u-cost is-${linked ? "ok" : "warn"}`}>{say(fiche.cost)}</p>
          <button type="button" className="u-secondary" onClick={() => {
            if (!linked) setSheet("relier");
            else onLaunch(fiche);
          }}>{linked ? t("verb.lancer") : t("verb.relier")}</button>
        </article>;
      })}
    </div>
  </section>;
}
