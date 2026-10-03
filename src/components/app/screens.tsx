"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { formatCredits } from "@/lib/credits";
import { LOOK_PHOTOS_MAX, SCENE_STILLS_MAX, cleanTraits, lookCheck, parseTraits } from "@/lib/coffre/model";
import { TAKE_STEPS } from "@/lib/render/take-graph";
import { Arrow, Close, Plus, Web } from "./glyphs";
import { PublishActions } from "./publish";
import { useStudio, type RunState } from "./studio-context";

function PictureSlot({ index, url, onAdd, onRemove, label }: { index: number; url?: string; onAdd(files: File[]): void; onRemove?(): void; label: string }) {
  const number = String(index + 1).padStart(2, "0");
  if (url && onRemove) {
    return <figure className="u-slot is-filled" data-frame={number}>
      <img src={url} alt="" />
      <button type="button" className="u-slot-remove" onClick={onRemove} aria-label={`Retirer ${label} ${number}`}><Close /></button>
    </figure>;
  }
  return <label className="u-slot" data-frame={number}>
    <input type="file" accept="image/*" multiple onChange={event => { onAdd([...(event.target.files ?? [])]); event.target.value = ""; }} aria-label={`Ajouter ${label} ${number}`} />
    <Plus />
  </label>;
}

export function LookScreen({ onNext }: { onNext(): void }) {
  const { studio, media, saveLook, addLookPhotos, removeLookPhoto } = useStudio();
  const look = studio.look;
  const check = lookCheck(look);
  const [trait, setTrait] = useState("");

  function addTrait(raw: string) {
    const added = parseTraits(raw);
    if (added.length) void saveLook({ traits: cleanTraits([...look.traits, ...added]) });
    setTrait("");
  }

  function onTraitKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTrait(trait);
    } else if (event.key === "Backspace" && !trait && look.traits.length) {
      void saveLook({ traits: look.traits.slice(0, -1) });
    }
  }

  return <section className="u-screen" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">01 · Ton style</p>
      <h1 id="u-title" tabIndex={-1}>Ton look.</h1>
    </header>
    <div className="u-photos" aria-label="Photos du look">
      {Array.from({ length: LOOK_PHOTOS_MAX }, (_, index) => {
        const path = look.photos[index];
        return <PictureSlot key={path ?? `empty-${index}`} index={index} url={path ? media[path] : undefined} label="la photo" onAdd={files => void addLookPhotos(files)} onRemove={path ? () => void removeLookPhoto(path) : undefined} />;
      })}
    </div>
    <label className="u-field">
      <span className="u-label">Nom</span>
      <input value={look.name} maxLength={40} placeholder="Mira" autoComplete="off" onChange={event => void saveLook({ name: event.target.value.slice(0, 40) })} />
    </label>
    <div className="u-field">
      <label className="u-label" htmlFor="u-trait">Ce qui ne change pas</label>
      <div className="u-chips">
        {look.traits.map(item => <button key={item} type="button" className="u-chip" onClick={() => void saveLook({ traits: look.traits.filter(other => other !== item) })} aria-label={`Retirer ${item}`}>{item}<Close /></button>)}
        <input id="u-trait" value={trait} placeholder={look.traits.length ? "un autre" : "yeux verts, taches de rousseur"} onChange={event => setTrait(event.target.value)} onKeyDown={onTraitKey} onBlur={() => trait.trim() && addTrait(trait)} enterKeyHint="done" />
      </div>
    </div>
    <ol className="u-marks" aria-label="Ce qui tient le look">
      <li data-held={check.photos}>Deux photos</li>
      <li data-held={check.name}>Un nom</li>
      <li data-held={check.traits}>Deux traits</li>
    </ol>
    <button type="button" className="u-primary" disabled={!check.ready} onClick={onNext}>Poser la scène <Arrow /></button>
  </section>;
}

export function SceneScreen({ onNext }: { onNext(): void }) {
  const { studio, scene, media, addScene, saveScene, addSceneStills, removeSceneStill, deleteScene, selectScene } = useStudio();
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  function add(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    void addScene(draft);
    setDraft("");
    setAdding(false);
  }

  const showNew = adding || studio.scenes.length === 0;
  return <section className="u-screen" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">02 · Ta scène</p>
      <h1 id="u-title" tabIndex={-1}>Ta scène.</h1>
    </header>
    {studio.scenes.length > 0 && <div className="u-scenes" role="radiogroup" aria-label="Lieux">
      {studio.scenes.map(item => {
        const still = item.stills[0];
        return <button key={item.id} type="button" role="radio" aria-checked={item.id === scene?.id} className="u-scene" onClick={() => void selectScene(item.id)}>
          {still && media[still] ? <img src={media[still]} alt="" /> : <span className="u-scene-empty"><Web /></span>}
          <span>{item.name}</span>
        </button>;
      })}
      {!adding && <button type="button" className="u-scene u-scene-add" onClick={() => setAdding(true)} aria-label="Nouveau lieu"><Plus /></button>}
    </div>}
    {showNew && <form className="u-new" onSubmit={add}>
      <label className="u-field">
        <span className="u-label">Nouveau lieu</span>
        <input value={draft} maxLength={40} placeholder="Le quai, la nuit" onChange={event => setDraft(event.target.value)} autoFocus={adding} />
      </label>
      <button type="submit" className="u-secondary" disabled={!draft.trim()}>Poser</button>
    </form>}
    {scene && <div className="u-card u-scene-edit">
      <label className="u-field">
        <span className="u-label">Nom du lieu</span>
        <input value={scene.name} maxLength={40} onChange={event => void saveScene(scene.id, { name: event.target.value.slice(0, 40) })} />
      </label>
      <label className="u-field">
        <span className="u-label">Ce qui tient le lieu</span>
        <textarea value={scene.note} maxLength={280} rows={2} placeholder="Pluie fine, néons froids, l’heure bleue." onChange={event => void saveScene(scene.id, { note: event.target.value.slice(0, 280) })} />
      </label>
      <div className="u-photos is-wide" aria-label="Images du lieu">
        {Array.from({ length: SCENE_STILLS_MAX }, (_, index) => {
          const path = scene.stills[index];
          return <PictureSlot key={path ?? `still-${index}`} index={index} url={path ? media[path] : undefined} label="l’image" onAdd={files => void addSceneStills(scene.id, files)} onRemove={path ? () => void removeSceneStill(scene.id, path) : undefined} />;
        })}
      </div>
      <button type="button" className="u-link u-muted" onClick={() => void deleteScene(scene.id)}>Retirer ce lieu</button>
    </div>}
    <button type="button" className="u-primary" disabled={!scene} onClick={onNext}>Préparer la prise <Arrow /></button>
  </section>;
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function runLabel(run: Extract<RunState, { phase: "running" }>): string {
  const event = run.event;
  switch (event.stage) {
    case "start": return "Préparation";
    case "upload": return `Envoi des images · ${event.done}/${event.total}`;
    case "submit": return "Mise en file";
    case "queue": return "En file sur ton compte";
    case "prepare": return "Le calcul démarre";
    case "render": return `Tournage · ${clock(event.seconds)}`;
    case "fetch": return "La prise revient";
    case "measure": return "Lecture du débit";
  }
}

function Segments<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange(value: T): void }) {
  return <fieldset className="u-segments">
    <legend className="u-label">{label}</legend>
    {options.map(option => <button key={String(option.value)} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </fieldset>;
}

export function TakeScreen({ goLook, goScene, goSphere }: { goLook(): void; goScene(): void; goSphere(): void }) {
  const studio = useStudio();
  const { media, scene, line, setLine, settings, setSettings, gate, connected, balance, balanceNote, run, requestRun, cancelRun, resetRun, setSheet } = studio;
  const check = lookCheck(studio.studio.look);
  const lookPicture = studio.studio.look.photos[0];
  const scenePicture = scene?.stills[0];
  const result = run.phase === "done" ? studio.studio.takes.find(take => take.id === run.takeId) : undefined;
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (result) video.current?.play().catch(() => {});
  }, [result]);

  if (!check.ready || !scene) {
    return <section className="u-screen" aria-labelledby="u-title">
      <header className="u-head">
        <p className="u-label">03 · La prise</p>
        <h1 id="u-title" tabIndex={-1}>La prise.</h1>
      </header>
      <p className="u-lead">{!check.ready ? "Le look ne tient pas encore." : "Aucun lieu n’est posé."}</p>
      <button type="button" className="u-primary" onClick={!check.ready ? goLook : goScene}>{!check.ready ? "Tenir le look" : "Poser la scène"} <Arrow /></button>
    </section>;
  }

  return <section className="u-screen" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">03 · La prise</p>
      <h1 id="u-title" tabIndex={-1}>La prise.</h1>
    </header>

    {run.phase === "running" && <div className="u-card u-run" role="status" aria-live="polite">
      <div className="u-thread" aria-hidden="true"><span /></div>
      <p className="u-run-label">{runLabel(run)}</p>
      <p className="u-small">Ton compte de rendu calcule. Tu peux rester ici ou revenir plus tard : la prise rejoint le coffre.</p>
      <button type="button" className="u-link u-muted" onClick={cancelRun}>Annuler</button>
    </div>}

    {run.phase === "done" && result && media[result.video] && <div className="u-card u-result">
      <video ref={video} src={media[result.video]} poster={result.poster ? media[result.poster] : undefined} controls muted loop playsInline preload="auto" className={`is-${result.settings.aspect}`} />
      <p className="u-small">{result.costCredits !== null ? `Débité : ${formatCredits(result.costCredits)} crédits, lu sur ton solde.` : "Débit pas encore visible sur ton solde."}{result.gpuSeconds !== null ? ` Calcul : ${clock(result.gpuSeconds)}.` : ""}</p>
      <PublishActions take={result} />
      <div className="u-row">
        <button type="button" className="u-secondary" onClick={resetRun}>Nouvelle prise</button>
        <button type="button" className="u-link" onClick={goSphere}>Voir la sphère</button>
      </div>
    </div>}

    {run.phase === "error" && <div className="u-card u-soft-error" role="alert">
      <p className="u-crt">SOFT ERROR</p>
      <p>{run.message}</p>
      {run.detail.length > 0 && <ul>{run.detail.map(item => <li key={item}>{item}</li>)}</ul>}
      {run.code === "credits" && <p>Recharge ton compte de rendu, puis relance. Le solde, en haut, montre ce qui reste.</p>}
      {run.code === "auth"
        ? <button type="button" className="u-secondary" onClick={() => { resetRun(); setSheet("connect"); }}>Relier à nouveau</button>
        : <button type="button" className="u-secondary" onClick={resetRun}>Reprendre</button>}
    </div>}

    {run.phase === "idle" && <>
      <div className="u-pair" aria-label="Look et lieu">
        <figure>{lookPicture && media[lookPicture] ? <img src={media[lookPicture]} alt="" /> : <span />}<figcaption>{studio.studio.look.name}</figcaption></figure>
        <span className="u-pair-thread" aria-hidden="true" />
        <figure>{scenePicture && media[scenePicture] ? <img src={media[scenePicture]} alt="" /> : <span className="u-scene-empty"><Web /></span>}<figcaption>{scene.name}</figcaption></figure>
      </div>
      <label className="u-field">
        <span className="u-label">Ce que fait la prise</span>
        <textarea value={line} rows={2} maxLength={240} placeholder="Elle traverse le quai sous la pluie, sans se retourner." onChange={event => setLine(event.target.value)} />
      </label>
      <div className="u-settings">
        <Segments label="Format" value={settings.aspect} onChange={aspect => setSettings({ aspect })} options={[{ value: "vertical", label: "9:16" }, { value: "horizontal", label: "16:9" }, { value: "carre", label: "1:1" }]} />
        <Segments label="Durée" value={settings.seconds} onChange={seconds => setSettings({ seconds })} options={[{ value: 5, label: "5 s" }, { value: 8, label: "8 s" }]} />
        <Segments label="Rendu" value={settings.quality} onChange={quality => setSettings({ quality })} options={[{ value: "rapide", label: `Rapide · ${TAKE_STEPS.rapide} pas` }, { value: "fine", label: `Fin · ${TAKE_STEPS.fine} pas` }]} />
      </div>
      <p className={`u-cost is-${connected ? gate.tone : "warn"}`}>
        {!connected ? "Relie ton compte de rendu pour tourner. Il paie le calcul, pas le studio."
          : balance ? `${formatCredits(balance.credits)} crédits sur ton compte. ${gate.line}`
          : balanceNote || "Lecture du solde…"}
      </p>
      <button type="button" className="u-primary" disabled={connected && !gate.allowed} onClick={() => void requestRun()}>
        {connected ? "Tourner" : "Relier mon compte de rendu"} <Arrow />
      </button>
    </>}
  </section>;
}

export function SphereScreen() {
  const { studio, media, setSheet } = useStudio();
  return <section className="u-screen" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">Sphère</p>
      <h1 id="u-title" tabIndex={-1}>Ta sphère.</h1>
    </header>
    {studio.takes.length === 0
      ? <p className="u-lead">Aucune prise encore.</p>
      : <ul className="u-grid">
        {studio.takes.map(take => <li key={take.id}>
          <button type="button" onClick={() => setSheet({ take: take.id })} aria-label={`Ouvrir la prise ${take.line || take.id}`}>
            {take.poster && media[take.poster] ? <img src={media[take.poster]} alt="" />
              : media[take.video] ? <video src={`${media[take.video]}#t=0.1`} muted playsInline preload="auto" />
              : <span className="u-scene-empty"><Web /></span>}
            <span className="u-grid-meta">{take.sceneName || "Prise"} · {take.costCredits !== null ? `${formatCredits(take.costCredits)} cr.` : "débit en attente"}</span>
          </button>
        </li>)}
      </ul>}
  </section>;
}
