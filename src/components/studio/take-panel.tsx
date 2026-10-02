"use client";

import { useEffect, useState, type FormEvent } from "react";
import { lookHeld } from "@/lib/doctrine";
import {
  TAKE_CHAIN, TAKE_CLOSED, TAKE_HELP, TAKE_LEAD, TAKE_NOTE, TAKE_SOON_LINE, TAKE_SOON_TITLE, TAKE_WAIT, takeReady,
} from "@/lib/cinema";
import {
  emptyPlateau, emptyTakeNote, readPlateau, readTakeNote, readyWorlds, saveTakeNote, worldReady,
  type TakeNote,
} from "@/lib/plateau";
import { useGoToStep } from "./mode-context";
import { useStudioSession } from "./session";

export function TakePanel() {
  const session = useStudioSession();
  const goStep = useGoToStep();
  const canon = { refCount: session.refPreviews.length, trigger: session.trigger, invariants: session.invariants, canonNoted: session.canonNoted };
  const held = lookHeld(canon);
  const [worldsOn, setWorldsOn] = useState(false);
  const [worlds, setWorlds] = useState(readyWorlds(emptyPlateau()));
  const [hasWorld, setHasWorld] = useState(false);
  const [note, setNote] = useState<TakeNote>(emptyTakeNote());
  const [planOpen, setPlanOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const book = readPlateau(window.localStorage);
    const ready = readyWorlds(book);
    const stored = readTakeNote(window.localStorage);
    setWorlds(ready);
    setHasWorld(worldReady(book));
    setWorldsOn(true);
    setNote(stored.sceneId || stored.line ? stored : { sceneId: ready[0]?.id ?? "", line: "" });
    setPlanOpen(Boolean(stored.line));
  }, []);

  const ready = worldsOn && takeReady({ lookHeld: held, worldReady: hasWorld });
  const chosen = worlds.find(scene => scene.id === note.sceneId) ?? worlds[0];

  function mark(id: (typeof TAKE_CHAIN)[number]["id"]): string {
    if (id === "prise") return "Pas encore";
    if (id === "monde") return hasWorld ? "Posé" : "À poser";
    return held ? "Tenu" : "Pas encore";
  }

  function state(id: (typeof TAKE_CHAIN)[number]["id"]): "held" | "open" | "wait" {
    if (id === "prise") return "wait";
    if (id === "monde") return hasWorld ? "held" : "open";
    return held ? "held" : "open";
  }

  function openPlan() {
    if (!ready) return;
    setPlanOpen(true);
    setNote(current => ({ ...current, sceneId: current.sceneId || worlds[0]?.id || "" }));
    requestAnimationFrame(() => document.getElementById("prise-plan")?.focus());
  }

  function keep(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    const next = { sceneId: chosen?.id ?? "", line: note.line };
    setNote(next);
    setSaved(saveTakeNote(window.localStorage, next));
  }

  return <section className="mode-panel" aria-labelledby="mode-title">
    <header className="mode-hero">
      <p className="eyebrow">Take</p>
      <h1 id="mode-title" tabIndex={-1}>La <em>prise.</em></h1>
      <p className="mode-lead">{TAKE_LEAD}</p>
    </header>

    <ol className="take-chain" aria-label="Avant la prise">
      {TAKE_CHAIN.map((step, index) => <li key={step.id} data-state={state(step.id)}>
        <span className="cinema-index">{String(index + 1).padStart(2, "0")}</span>
        <h2>{step.title}</h2>
        <p>{step.id === "monde" && chosen ? `${step.line} Lieu : ${chosen.name}.` : step.line}</p>
        <span className="take-mark">{mark(step.id)}</span>
        {step.id === "monde" && <button type="button" className="text-button" onClick={() => goStep("plateau")}>{hasWorld ? "Revoir le monde" : "Poser le monde"}</button>}
        {step.id === "look" && <button type="button" className="text-button" onClick={() => goStep("look")}>{held ? "Revoir ton style" : "Tenir le look"}</button>}
      </li>)}
    </ol>

    <div className="take-actions">
      <button type="button" className="button button-primary" disabled={!ready} onClick={openPlan}>Noter la prise</button>
      <p role="status">{ready ? TAKE_NOTE : TAKE_WAIT}</p>
      {note.line && !ready && <p>{TAKE_CLOSED}</p>}
    </div>

    {planOpen && ready && <form className="take-plan" onSubmit={keep}>
      {worlds.length > 1 && <label htmlFor="prise-lieu">Dans quel lieu
        <select id="prise-lieu" value={chosen?.id ?? ""} onChange={event => setNote(current => ({ ...current, sceneId: event.target.value }))}>
          {worlds.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
        </select>
      </label>}
      {worlds.length === 1 && chosen && <p>Dans le lieu « {chosen.name} ».</p>}
      <label htmlFor="prise-plan">Ce que montre la prise
        <input id="prise-plan" value={note.line} maxLength={180} placeholder="Elle traverse le quai. La lumière ne change pas." onChange={event => { setSaved(false); setNote(current => ({ ...current, line: event.target.value })); }} />
      </label>
      <button type="submit" className="button button-outline" disabled={note.line.trim().length === 0}>Garder sur cet appareil</button>
      {saved && <p role="status">Noté ici. Le tournage n’a pas commencé.</p>}
    </form>}

    <article className="soon-card take-card">
      <p className="eyebrow">Bientôt</p>
      <h2>{TAKE_SOON_TITLE}</h2>
      <p>{TAKE_SOON_LINE}</p>
      <p className="soon-mark">Pas encore</p>
    </article>

    <details className="disclosure create-drawer">
      <summary>Comment la prise sera tournée ?</summary>
      <p className="expert-note">{TAKE_HELP}</p>
    </details>
  </section>;
}
