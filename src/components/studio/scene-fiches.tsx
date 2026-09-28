"use client";

import { useState } from "react";
import { CONTINUITY_TIP, SCENE_FICHES } from "@/lib/doctrine";
import { processAction, processById, processGap } from "@/lib/processes";

interface SheetNote {
  lieu: string;
  left: string;
  right: string;
}

const EMPTY: SheetNote = { lieu: "", left: "", right: "" };

export function SceneFiches({ onOpenEntre }: { onOpenEntre?: () => void }) {
  const [notes, setNotes] = useState<Record<string, SheetNote>>({});
  const entre = processById("entre");
  const entreGap = entre ? processGap(entre) : null;

  function patch(id: string, field: keyof SheetNote, value: string) {
    setNotes(previous => ({ ...previous, [id]: { ...EMPTY, ...previous[id], [field]: value } }));
  }

  return <div className="scene-fiches">
    <aside className="doctrine-note" role="note">
      <p><strong>Continuité.</strong> {CONTINUITY_TIP}</p>
    </aside>
    <div className="fiche-grid">
      {SCENE_FICHES.map(fiche => {
        const note = notes[fiche.id] ?? EMPTY;
        const lieuId = `fiche-${fiche.id}-lieu`;
        const leftId = `fiche-${fiche.id}-gauche`;
        const rightId = `fiche-${fiche.id}-droite`;
        return <article key={fiche.id} className="fiche-card" data-fiche={fiche.id} aria-labelledby={`fiche-${fiche.id}`}>
          <p className="eyebrow"><a href="#studio"><code>{fiche.vault}</code></a></p>
          <h2 id={`fiche-${fiche.id}`}>{fiche.title}</h2>
          {fiche.id === "entre" && entre?.state === "live" && onOpenEntre
            ? <button type="button" className="button button-primary" onClick={onOpenEntre}>{processAction(entre).label}</button>
            : <p className="soon-mark">{fiche.id === "entre" && entre ? processAction(entre).label : "Bientôt"}</p>}
          {fiche.id === "entre" && entreGap && <p>{entreGap}</p>}
          <p>{fiche.video}</p>
          <label htmlFor={lieuId}>Lieu
            <input id={lieuId} value={note.lieu} onChange={event => patch(fiche.id, "lieu", event.target.value)} placeholder="Nom du lieu" maxLength={80} autoComplete="off" spellCheck={false} />
          </label>
          <div>
            <p className="fiche-kicker">Quatre angles</p>
            <ul className="fiche-angles" aria-label={`Angles de ${fiche.title}`}>
              {fiche.angles.map(angle => <li key={angle}>{angle}</li>)}
            </ul>
          </div>
          <p>{fiche.spatial}</p>
          <div className="fiche-spatial">
            <label htmlFor={leftId}>À gauche
              <input id={leftId} value={note.left} onChange={event => patch(fiche.id, "left", event.target.value)} placeholder="Qui" maxLength={80} autoComplete="off" />
            </label>
            <label htmlFor={rightId}>À droite
              <input id={rightId} value={note.right} onChange={event => patch(fiche.id, "right", event.target.value)} placeholder="Qui" maxLength={80} autoComplete="off" />
            </label>
          </div>
          <p className="fiche-vault">La fiche reste ici. <a href="#studio"><code>{fiche.vault}</code></a> la range, chez toi.</p>
        </article>;
      })}
    </div>
  </div>;
}
