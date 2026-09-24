"use client";

import { Fragment } from "react";
import { buildCaption, checkTrigger } from "@/lib/gate/captions";
import { CAPTION_EXAMPLES, EXAMPLE_TRIGGER } from "@/lib/gate/coaching";

const CARDS = [
  {
    kind: "fail",
    verdict: "× FAIL",
    title: "Décrit ce que le trigger doit tenir",
    note: "La LoRA attache ces traits aux mots de la légende, pas au trigger : il faudra les réécrire dans chaque prompt. Le gate bloque tes invariants (G15) et les traits recopiés (G16).",
  },
  {
    kind: "pass",
    verdict: "✓ PASS",
    title: "Décrit ce qui change",
    note: "Expression, pose, tenue, décor, lumière : ce qui varie d’une image à l’autre. Le visage reste porté par le trigger.",
  },
] as const;

export function CaptionCoach({ trigger }: { trigger: string }) {
  const name = trigger && !checkTrigger(trigger) ? trigger : EXAMPLE_TRIGGER;
  return <section className="panel-block caption-coach" aria-labelledby="caption-coach-title">
    <p className="eyebrow" id="caption-coach-title">Légendes : ce qui change, pas ce qui tient</p>
    <p className="coach-principle">Écris ce qui doit pouvoir <strong>changer</strong>. N’écris pas ce que le trigger doit <strong>tenir</strong> : forme du visage, yeux, coiffure signature, oreilles ou queue si elles font l’identité.</p>
    <div className="coach-grid">
      {CARDS.map(card => {
        const example = CAPTION_EXAMPLES[card.kind];
        const [head, angle, framing, ...variables] = buildCaption(name, example.angle, example.framing, example.variables.join(", ")).split(", ");
        return <article key={card.kind} className={`coach-card coach-card-${card.kind}`}>
          <p className="coach-card-head"><span className={`verdict ${card.kind}`}>{card.verdict}</span>{card.title}</p>
          <p className="coach-caption" lang="en">
            <span className="coach-trigger">{head}</span>
            {[angle, framing].map(part => <Fragment key={part}>, <span className="coach-auto">{part}</span></Fragment>)}
            {variables.map(part => <Fragment key={part}>, <span className={`coach-${card.kind}`}>{part}</span></Fragment>)}
          </p>
          <p className="coach-note">{card.note}</p>
        </article>;
      })}
    </div>
    <p className="small-print">Le trigger, l’angle et le cadrage s’ajoutent seuls, depuis tes étiquettes : tu n’écris que la suite. En anglais simple : Flux lit des phrases, pas des tags du type « 1girl, masterpiece ».</p>
  </section>;
}
