"use client";

import { canonChecklist, type DoctrineCheckId } from "@/lib/doctrine";
import { parseInvariants } from "@/lib/gate/captions";
import { Arrow } from "../glyph";
import { LookStatus } from "./look-status";
import { useGoToStep } from "./mode-context";

const MARKS: Record<DoctrineCheckId, string> = {
  angles: "Photos",
  trigger: "Mot d’appel",
  invariants: "Traits",
  canon: "Canon",
};

export function LookCard({ refs, trigger, invariants, canonNoted, onCanonNoted }: {
  refs: { name: string; url: string }[];
  trigger: string;
  invariants: string;
  canonNoted: boolean;
  onCanonNoted: (value: boolean) => void;
}) {
  const goStep = useGoToStep();
  const marks = canonChecklist({ refCount: refs.length, trigger, invariants, canonNoted });
  const held = marks.every(mark => mark.held);
  const traits = parseInvariants(invariants).slice(0, 6);
  const cover = refs[0];

  return <aside className="look-card" data-held={held ? "true" : "false"} aria-labelledby="look-card-title">
    <figure className="look-poster">
      {cover ? <img src={cover.url} alt="" /> : <span className="look-poster-empty" aria-hidden="true">iii</span>}
      <figcaption>
        <span className="look-poster-kicker">{held ? "Look tenu" : "Ton look"}</span>
        <strong id="look-card-title" className="look-poster-call">{trigger || "mot_d’appel"}</strong>
        {traits.length > 0 && <span className="look-poster-traits">{traits.map(trait => <span key={trait}>{trait}</span>)}</span>}
      </figcaption>
    </figure>
    <ol className="look-marks" aria-label="Ce qui tient le look">
      {marks.map(mark => <li key={mark.id} data-held={mark.held ? "true" : "false"}>
        <span className="look-mark-dot" aria-hidden="true" />
        {MARKS[mark.id]}
        <span className="sr-only">{mark.held ? " : tenu" : " : à tenir"}</span>
      </li>)}
    </ol>
    <label className="check-inline look-canon">
      <input type="checkbox" checked={canonNoted} onChange={event => onCanonNoted(event.target.checked)} />
      <span>Noté dans CANON.md</span>
    </label>
    <LookStatus held={held} />
    <button type="button" className="button button-primary look-next" disabled={!held} onClick={() => goStep("plateau")}>Poser le monde <Arrow /></button>
  </aside>;
}
