"use client";

import { useEffect, useState, type FormEvent } from "react";
import { lookHeld } from "@/lib/doctrine";
import {
  TAKE_CLOSED, TAKE_GO_LOOK, TAKE_GO_WORLD, TAKE_HELP, TAKE_NOTE, TAKE_STATUS_NEED_LOOK, TAKE_STATUS_NEED_WORLD, TAKE_STATUS_READY, takeReady,
} from "@/lib/cinema";
import {
  emptyPlateau, emptyTakeNote, readPlateau, readTakeNote, readyWorlds, saveTakeNote, worldReady,
  type TakeNote,
} from "@/lib/plateau";
import { useGoToStep } from "./mode-context";
import { useStudioSession } from "./session";
import { TakeFrame } from "./take-frame";

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
      <h1 id="mode-title" tabIndex={-1}>La <em>prise.</em></h1>
    </header>

    {!worldsOn && <p role="status">Ouverture…</p>}

    {worldsOn && !ready && <>
      <p className="take-status" role="status">{held ? TAKE_STATUS_NEED_WORLD : TAKE_STATUS_NEED_LOOK}</p>
      <button type="button" className="button button-primary" onClick={() => goStep(held ? "plateau" : "look")}>{held ? TAKE_GO_WORLD : TAKE_GO_LOOK}</button>
      {note.line && <p>{TAKE_CLOSED}</p>}
    </>}

    {ready && <>
      <p className="take-status" role="status">{TAKE_STATUS_READY}{chosen ? ` Lieu : ${chosen.name}.` : ""}</p>
      <TakeFrame
        trigger={session.trigger}
        invariants={session.invariants}
        placeName={chosen?.name ?? ""}
        placeNote={chosen?.note ?? ""}
        takeLine={note.line}
        scene={chosen ?? null}
      />
      <div className="take-actions">
        <button type="button" className="text-button" onClick={openPlan}>Noter la prise</button>
        {planOpen && <p role="status">{TAKE_NOTE}</p>}
      </div>
      {planOpen && <form className="take-plan" onSubmit={keep}>
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
    </>}

    <details className="disclosure create-drawer">
      <summary>Comment la prise est tournée ?</summary>
      <p className="expert-note">{TAKE_HELP}</p>
    </details>
  </section>;
}
