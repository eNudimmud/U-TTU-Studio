"use client";

import { BURN_WARN, CHEAP_BEFORE, LOOK_HELD_LINE, LOOK_OPEN_LINE, MUSIC_NOTE, canonChecklist, lookHeld, type CanonInput } from "@/lib/doctrine";
import { useGoToMode } from "./mode-context";

export function DoctrineBurn({ input, onCanonNoted, canonToggle = true }: { input: CanonInput; onCanonNoted: (value: boolean) => void; canonToggle?: boolean }) {
  const go = useGoToMode();
  const marks = canonChecklist(input);
  const held = lookHeld(input);

  return <section className="doctrine-burn" aria-labelledby="doctrine-burn-title">
    <p className="eyebrow">Doctrine</p>
    <h2 id="doctrine-burn-title">Le canon, avant le cher.</h2>
    <p className="doctrine-gate">{BURN_WARN}</p>
    <p className="doctrine-status" role="status">{held ? LOOK_HELD_LINE : LOOK_OPEN_LINE}</p>
    <ul className="canon-list">
      {marks.map(mark => <li key={mark.id} data-held={mark.held ? "true" : "false"}>
        <span className="canon-mark">{mark.held ? "Tenu" : "À tenir"}</span>
        <div>
          <strong>{mark.label}</strong>
          <p>{mark.detail}</p>
          {mark.id === "canon" && <div className="canon-note">
            {canonToggle && <label className="check-inline">
              <input type="checkbox" checked={input.canonNoted} onChange={event => onCanonNoted(event.target.checked)} />
              <span>Noté dans CANON.md</span>
            </label>}
            <button type="button" className="text-button" onClick={() => go("studio")}>Ouvrir le coffre</button>
          </div>}
        </div>
      </li>)}
    </ul>
    <p className="doctrine-cheap">{CHEAP_BEFORE}</p>
    <p className="doctrine-music">{MUSIC_NOTE}</p>
  </section>;
}
