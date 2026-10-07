"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { costLabel, LOOK_PHOTOS_MAX, SCENE_STILLS_MAX, cleanTraits, isPlaceLora, lookCheck, parseTraits } from "@/lib/coffre/model";
import { briefAction, castShelf, decorShelf, engineMark, exampleTakeQuote, pickEngine, priseAction, priseGaps, SAMPLE_TAKE, vueProjet, weaveBrief, WIRED_ENGINES } from "@/lib/studio-comfort";
import { PLACE_SHOTS_MIN, placeShotLine, placeShotList } from "@/lib/lora/place";
import { LENSES, PREVIZ_LABELS, PREVIZ_PLANS, PATH_FRAMES, defaultCamera, pathPoint, placeVolumes } from "@/lib/render/previz";
import { filmAction } from "@/lib/render/shot";
import { formatCredits } from "@/lib/credits";
import { formatUsd } from "@/lib/fal/prices";
import { TAKE_STEPS } from "@/lib/render/take-graph";
import { Arrow, Close, Plus, Web } from "./glyphs";
import { PublishActions } from "./publish";
import { useStudio, type PrevizState, type RunState } from "./studio-context";

export function PictureSlot({ index, url, onAdd, onRemove, label }: { index: number; url?: string; onAdd(files: File[]): void; onRemove?(): void; label: string }) {
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

function lookGap(parts: (string | false)[]): string {
  const missing = parts.filter((part): part is string => Boolean(part));
  if (missing.length === 0) return "";
  if (missing.length === 1) return `Il manque ${missing[0]}.`;
  return `Il manque ${missing.slice(0, -1).join(", ")} et ${missing[missing.length - 1]}.`;
}

export function LookScreen({ onNext, onBack }: { onNext(): void; onBack(): void }) {
  const { studio, media, saveLook, addLookPhotos, removeLookPhoto, resetLook } = useStudio();
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

  const dirty = Boolean(look.name || look.note || look.traits.length || look.photos.length);
  return <section className="u-screen" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">Personnage · Références</p>
      <h1 id="u-title" tabIndex={-1}>Jusqu’à trois photos.</h1>
      <p className="u-small">Deux suffisent, trois tiennent. Pas de formation. Ces photos partent avec chaque prise « Références ». Le compte de rendu paie la prise, au prix lu à ce moment. Ici, rien n’est débité.</p>
      <button type="button" className="u-link" onClick={onBack}>Les deux façons</button>
    </header>
    <div className="u-desk">
      <div className="u-photos" aria-label="Photos du look">
        {Array.from({ length: LOOK_PHOTOS_MAX }, (_, index) => {
          const path = look.photos[index];
          return <PictureSlot key={path ?? `empty-${index}`} index={index} url={path ? media[path] : undefined} label="la photo" onAdd={files => void addLookPhotos(files)} onRemove={path ? () => void removeLookPhoto(path) : undefined} />;
        })}
      </div>
      <div className="u-stack">
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
          <li data-held={check.photos}>Deux photos au moins</li>
          <li data-held={check.name}>Un nom</li>
          <li data-held={check.traits}>Deux traits</li>
        </ol>
        <div className="u-actions">
          <button type="button" className="u-link u-muted" disabled={!dirty} onClick={() => void resetLook()}>Remettre ce look à zéro</button>
          <p className="u-small">Les prises, les lieux et les personnages formés restent.</p>
          {!check.ready && <p className="u-small">{lookGap([!check.photos && "deux photos", !check.name && "un nom", !check.traits && "deux traits"])}</p>}
          <button type="button" className="u-primary" onClick={() => {
            if (!check.photos) document.querySelector<HTMLElement>(".u-photos input")?.focus();
            else if (!check.name) document.querySelector<HTMLInputElement>(".u-stack input")?.focus();
            else if (!check.traits) document.getElementById("u-trait")?.focus();
            else onNext();
          }}>{check.ready ? "Poser la scène" : "Compléter les références"} <Arrow /></button>
        </div>
      </div>
    </div>
  </section>;
}

export function SceneScreen({ onNext, onRole }: { onNext(): void; onRole(): void }) {
  const { studio, scene, media, addScene, selectScene, previz, blenderLinked, falLinked, requestPreviz, setSheet } = useStudio();
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
  return <section className="u-screen u-scene-screen" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">02 · Ta scène</p>
      <h1 id="u-title" tabIndex={-1}>Ta scène.</h1>
    </header>
    <div className="u-desk">
      <div className="u-stack">
        {studio.scenes.length > 0 && <div className="u-scenes" role="radiogroup" aria-label="Lieux">
          {studio.scenes.map(item => {
            const still = item.render ?? item.stills[0];
            return <button key={item.id} type="button" role="radio" aria-checked={item.id === scene?.id} className="u-scene" onClick={() => void selectScene(item.id)}>
              {still && media[still] ? <img src={media[still]} alt="" /> : <span className="u-scene-empty"><Web /></span>}
              <span>{item.name || "Sans nom"}</span>
            </button>;
          })}
          {!adding && <button type="button" className="u-scene u-scene-add" onClick={() => setAdding(true)} aria-label="Nouveau lieu"><Plus /></button>}
        </div>}
        {showNew && <form className="u-new" onSubmit={add}>
          <label className="u-field">
            <span className="u-label">Nouveau lieu</span>
            <input id="u-lieu" value={draft} maxLength={40} placeholder="Le quai, la nuit" onChange={event => setDraft(event.target.value)} autoFocus={adding} />
          </label>
          <button type="submit" className="u-secondary" disabled={!draft.trim()}>Poser</button>
        </form>}
      </div>
      <div className="u-stack">
        {scene && <VueProjet />}
        {scene && <SceneEditor />}
        {previz.phase === "running" ? <FilmStatus /> : (() => {
          const action = filmAction({
            scene: Boolean(scene),
            plan: Boolean(scene?.previz),
            blender: blenderLinked,
            character: studio.loras.some(item => !isPlaceLora(item)),
            fal: falLinked,
          });
          return <>
            {action.missing && <p className="u-small">{action.missing}</p>}
            <button type="button" className="u-primary" onClick={() => {
              if (action.kind === "place") document.getElementById("u-lieu")?.focus();
              else if (action.kind === "plan") document.getElementById("u-plans")?.scrollIntoView({ block: "center" });
              else if (action.kind === "blender") setSheet("blender");
              else if (action.kind === "role") onRole();
              else if (action.kind === "fal") setSheet("fal");
              else void requestPreviz();
            }}>{action.label} <Arrow /></button>
          </>;
        })()}
        <button type="button" className="u-link" onClick={() => {
          if (!scene) document.getElementById("u-lieu")?.focus();
          else onNext();
        }}>{scene ? "Aller à la prise" : "Pose d’abord un lieu"}</button>
      </div>
    </div>
  </section>;
}

function VueProjet() {
  const { studio, scene, setSheet } = useStudio();
  if (!scene) return null;
  const group = vueProjet({
    scene,
    takes: studio.takes,
    loras: studio.loras,
    lookName: studio.look.name,
  });
  return <section className="u-card u-projet" aria-label="Vue projet">
    <h2>Vue projet</h2>
    <ul className="u-facts">
      <li><strong>Personnage</strong>{group.personnages.length ? group.personnages.join(" · ") : "Aucun personnage sur ce lieu."}</li>
      <li><strong>Lieu</strong>{group.lieu}</li>
      <li>
        <strong>Prises</strong>
        {group.prises.length === 0
          ? "Aucune prise pour ce lieu."
          : <ul className="u-projet-prises">
            {group.prises.map(prise => <li key={prise.id}>
              <button type="button" className="u-link" onClick={() => setSheet({ take: prise.id })} aria-label={`Ouvrir la prise ${prise.line}`}>{prise.line}</button>
            </li>)}
          </ul>}
      </li>
    </ul>
  </section>;
}

function filmLabel(state: Extract<PrevizState, { phase: "running" }>): string {
  const event = state.event;
  switch (event.stage) {
    case "write": return "Écriture du lieu";
    case "inspect": return "Lecture du devis";
    case "start": return "Envoi du plan";
    case "queue": return "Rendu en file";
    case "render": return `Blender tourne · ${event.seconds} s`;
    case "fetch": return "Les images du trajet reviennent";
    case "person": return "Le personnage entre dans le plan";
    case "shot": return `Le personnage tourne · ${event.seconds} s`;
    case "video": return "Le plan filmé revient";
  }
}

function FilmStatus() {
  const { previz, cancelPreviz } = useStudio();
  if (previz.phase !== "running") return null;
  return <div className="u-run" role="status">
    <div className="u-thread" aria-hidden="true"><span /></div>
    <p className="u-run-label">{filmLabel(previz)}</p>
    <button type="button" className="u-link u-muted" onClick={cancelPreviz}>Annuler</button>
  </div>;
}

function SceneEditor() {
  const { scene, media, studio, saveScene, addSceneStills, removeSceneStill, deleteScene, setPreviz, moveCamera, setLens, previz, resetScene, blenderLinked, setSheet, falLinked, placeTrainQuote, placeSceneQuote, placeRun, requestPlaceTrain, requestPlaceScene, addSceneViews, removeSceneView } = useStudio();
  const [point, setPoint] = useState<"start" | "end">("start");
  if (!scene) return null;
  const dirty = Boolean(scene.name || scene.note || scene.stills.length || scene.views.length || scene.previz || scene.camera || scene.render || scene.frames.length);
  const renderUrl = scene.render ? media[scene.render] : undefined;
  const camera = scene.camera ?? (scene.previz ? defaultCamera(scene.previz) : null);
  const here = camera ? pathPoint(camera, point) : null;
  const shots = placeShotList(scene);
  const learned = placeShotLine(shots.length);
  const placeFile = studio.loras.find(item => isPlaceLora(item) && item.sceneId === scene.id);
  const filmed = scene.shot ? studio.takes.find(item => item.id === scene.shot) : undefined;
  return <div className="u-card u-scene-edit">
    <label className="u-field">
      <span className="u-label">Nom du lieu</span>
      <input value={scene.name} maxLength={40} onChange={event => void saveScene(scene.id, { name: event.target.value.slice(0, 40) })} />
    </label>
    <label className="u-field">
      <span className="u-label">Ce qui tient le lieu</span>
      <textarea value={scene.note} maxLength={280} rows={2} placeholder="Pluie fine, néons froids, l’heure bleue." onChange={event => void saveScene(scene.id, { note: event.target.value.slice(0, 280) })} />
    </label>
    <ul className="u-facts">
      <li><strong>Le lieu</strong>Il reste. Tu le rouvres : même nom, même plan, même trajet. Tu peux en tenir plusieurs.</li>
      <li><strong>Blender</strong>Il rend le lieu vide, {PATH_FRAMES} images le long du trajet. Le personnage n’est pas dans ce fichier.</li>
      <li><strong>Le personnage</strong>C’est le LoRA du coffre. Il n’entre que dans le plan filmé, après ces images.</li>
      <li><strong>Ce lieu, formé</strong>{learned.line} {falLinked && placeTrainQuote !== null ? `Formation : ${formatUsd(placeTrainQuote)}.` : "Le prix de formation se lit sur le compte fal, avant le geste."} {placeFile ? `Fichier au coffre.${placeSceneQuote !== null ? ` Image neuve : ${formatUsd(placeSceneQuote)}.` : ""}` : ""} Ce fichier n’est pas un volume. Le 3D reste le Blender.</li>
      <li><strong>Le prix</strong>Les deux devis sont lus avant le geste. Rien ne part sans confirmation.</li>
    </ul>
    <p className="u-label">Plan</p>
    <div id="u-plans" className="u-segments" role="group" aria-label="Plan">
      {PREVIZ_PLANS.map(plan => <button key={plan} type="button" aria-pressed={scene.previz === plan} onClick={() => void setPreviz(scene.id, plan)}>{PREVIZ_LABELS[plan]}</button>)}
    </div>
    {camera && here && <>
      <div className="u-segments" role="group" aria-label="Trajet">
        <button type="button" aria-pressed={point === "start"} onClick={() => setPoint("start")}>Départ</button>
        <button type="button" aria-pressed={point === "end"} onClick={() => setPoint("end")}>Arrivée</button>
      </div>
      <p className="u-small">{point === "start" ? "Départ" : "Arrivée"} {here.x}, {here.y}, {here.z} · vise {here.aimX}, {here.aimY}, {here.aimZ} · {camera.lens} mm</p>
      <div className="u-nudge" role="group" aria-label="Déplacer la caméra">
        {(["x", "y", "z"] as const).map(axis => <span key={axis}>
          <button type="button" onClick={() => void moveCamera(point, "stand", axis, -1)} aria-label={`Caméra moins ${axis}`}>−{axis.toUpperCase()}</button>
          <button type="button" onClick={() => void moveCamera(point, "stand", axis, 1)} aria-label={`Caméra plus ${axis}`}>+{axis.toUpperCase()}</button>
        </span>)}
      </div>
      <div className="u-nudge" role="group" aria-label="Déplacer le point visé">
        {(["x", "y", "z"] as const).map(axis => <span key={axis}>
          <button type="button" onClick={() => void moveCamera(point, "aim", axis, -1)} aria-label={`Visée moins ${axis}`}>−{axis.toUpperCase()}</button>
          <button type="button" onClick={() => void moveCamera(point, "aim", axis, 1)} aria-label={`Visée plus ${axis}`}>+{axis.toUpperCase()}</button>
        </span>)}
      </div>
      <div className="u-segments" role="group" aria-label="Focale">
        {LENSES.map(lens => <button key={lens} type="button" aria-pressed={camera.lens === lens} onClick={() => void setLens(lens)}>{lens}</button>)}
      </div>
    </>}
    {scene.previz && !renderUrl && <p className="u-small">{placeVolumes(scene.previz)} volumes. Aucune image tant que Blender n’a pas rendu le trajet.</p>}
    {renderUrl && <figure className="u-previz">
      <img src={renderUrl} alt="" />
      <figcaption>Lieu vide, première image du trajet. Le personnage n’y est pas.</figcaption>
    </figure>}
    {filmed && media[filmed.video] && <video src={media[filmed.video]} poster={filmed.poster ? media[filmed.poster] : undefined} controls muted playsInline preload="metadata" />}
    {previz.phase === "error" && <p className="u-small is-error" role="alert">{previz.message}</p>}
    <p className={`u-cost is-${blenderLinked ? "ok" : "warn"}`}>
      {blenderLinked ? "Clé Blender sur cet appareil. Le devis est lu avant tout débit." : "Aucune clé Blender. Le rendu ne part pas, et aucune image n’est inventée."}
    </p>
    <button type="button" className="u-link u-muted" onClick={() => setSheet("blender")}>{blenderLinked ? "Changer la clé Blender" : "Où trouver la clé"}</button>
    <p className="u-label">Vues du lieu · {shots.length}/{PLACE_SHOTS_MIN} pour le former</p>
    {!learned.ready && <p className="u-small">{learned.line}</p>}
    <div id="u-vues" className="u-photos is-wide" aria-label="Vues du lieu">
      {scene.views.map((path, index) => <PictureSlot key={path} index={index} url={media[path]} label="la vue" onAdd={files => void addSceneViews(scene.id, files)} onRemove={() => void removeSceneView(scene.id, path)} />)}
      {scene.views.length < 12 && <PictureSlot index={scene.views.length} label="la vue" onAdd={files => void addSceneViews(scene.id, files)} />}
    </div>
    <button type="button" className="u-link" disabled={placeRun === "running"} onClick={() => {
      if (!learned.ready) {
        document.getElementById("u-vues")?.scrollIntoView({ block: "center" });
        return;
      }
      if (!falLinked) {
        setSheet("fal");
        return;
      }
      void requestPlaceTrain();
    }}>{placeRun === "running" ? "Formation du lieu…" : learned.ready ? `Former ce lieu${placeTrainQuote !== null ? ` · ${formatUsd(placeTrainQuote)}` : ""}` : "Ajouter une vue"}</button>
    {placeFile && <button type="button" className="u-link" disabled={placeRun === "running"} onClick={() => void requestPlaceScene()}>{`Bâtir une image de ce lieu${placeSceneQuote !== null ? ` · ${formatUsd(placeSceneQuote)}` : ""}`}</button>}
    <div className="u-photos is-wide" aria-label="Images du lieu">
      {Array.from({ length: SCENE_STILLS_MAX }, (_, index) => {
        const path = scene.stills[index];
        return <PictureSlot key={path ?? `still-${index}`} index={index} url={path ? media[path] : undefined} label="l’image" onAdd={files => void addSceneStills(scene.id, files)} onRemove={path ? () => void removeSceneStill(scene.id, path) : undefined} />;
      })}
    </div>
    <button type="button" className="u-link u-muted" disabled={!dirty} onClick={() => void resetScene()}>Remettre ce lieu à zéro</button>
    <p className="u-small">Les autres lieux, les prises et les personnages formés restent.</p>
    <button type="button" className="u-link u-muted" onClick={() => void deleteScene(scene.id)}>Retirer ce lieu</button>
  </div>;
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function runLabel(run: Extract<RunState, { phase: "running" }>): string {
  const event = run.event;
  switch (event.stage) {
    case "start": return "Préparation";
    case "upload": return `Envoi des images · ${event.done}/${event.total}`;
    case "lora": return "Envoi du personnage";
    case "submit": return "Mise en file";
    case "queue": return "position" in event && event.position ? `En file · ${event.position}` : "En file sur ton compte";
    case "prepare": return "Le calcul démarre";
    case "render": return `Tournage · ${clock(event.seconds)}`;
    case "fetch": return "La prise revient";
    case "measure": return "Lecture du débit";
  }
}

export function Segments<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange(value: T): void }) {
  return <fieldset className="u-segments">
    <legend className="u-label">{label}</legend>
    {options.map(option => <button key={String(option.value)} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </fieldset>;
}

export function TakeScreen({ goLook, goScene, goSphere, goLora }: { goLook(): void; goScene(): void; goSphere(): void; goLora(): void }) {
  const studio = useStudio();
  const { media, scene, line, setLine, settings, setSettings, gate, connected, balance, run, requestRun, cancelRun, resetRun, resetTake, setSheet, engine, setEngine, chosenLora, setLora, loraResolution, setLoraResolution, loraQuote, falLinked, falBalance } = studio;
  const cast = castShelf(studio.studio.loras);
  const decor = decorShelf(studio.studio.scenes);
  const check = lookCheck(studio.studio.look);
  const lookPicture = studio.studio.look.photos[0];
  const scenePicture = scene?.render ?? scene?.stills[0];
  const result = run.phase === "done" ? studio.studio.takes.find(take => take.id === run.takeId) : undefined;
  const video = useRef<HTMLVideoElement>(null);
  const resultCard = useRef<HTMLDivElement>(null);
  const resultId = result?.id;

  useEffect(() => {
    if (!resultId) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultCard.current?.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
    video.current?.play().catch(() => {});
  }, [resultId]);

  const hasCharacter = Boolean(chosenLora);
  const gaps = priseGaps({ lookReady: check.ready, hasScene: Boolean(scene), engine, hasCharacter });
  const whoName = chosenLora?.name.trim() ?? "";
  const placeName = scene?.name.trim() ?? "";
  const livePrice = engine === "lora" && loraQuote !== null ? formatUsd(loraQuote) : null;
  const example = exampleTakeQuote({ engine, seconds: settings.seconds, resolution: loraResolution });
  const showingExample = engine === "lora" ? !falLinked : !connected;
  const action = priseAction({
    engine,
    falLinked,
    connected,
    lookReady: check.ready,
    hasScene: Boolean(scene),
    hasCharacter,
    canSpend: engine === "lora" ? Boolean(falLinked && chosenLora && gate.allowed) : Boolean(connected && gate.allowed),
    price: livePrice,
  });

  function writeBrief(who: string, place: string) {
    setLine(weaveBrief({ who, place, action: briefAction(line, whoName, placeName) }));
  }

  function chooseCast(id: string) {
    const person = cast.find(item => item.id === id);
    if (!person) {
      setLora("");
      writeBrief("", placeName);
      return;
    }
    setEngine("lora");
    setLora(person.id);
    writeBrief(person.name, placeName);
  }

  function choosePlace(id: string) {
    const place = studio.studio.scenes.find(item => item.id === id);
    if (!place) return;
    void studio.selectScene(place.id);
    writeBrief(whoName, place.name.trim());
  }

  function jump(id: string) {
    if (id === "photos") goLook();
    else if (id === "scene") goScene();
    else if (id === "fichier") goLora();
    else if (id === "relier") setSheet("relier");
  }

  return <section className="u-screen" aria-labelledby="u-title">
    <header className="u-head">
        <p className="u-label">03 · La prise</p>
      <h1 id="u-title" tabIndex={-1}>La prise.</h1>
    </header>

    {run.phase === "running" && <div className="u-card u-run" role="status" aria-live="polite">
      <div className="u-thread" aria-hidden="true"><span /></div>
      <p className="u-run-label">{runLabel(run)}</p>
      <p className="u-small">{engine === "lora" ? "Ton compte fal calcule, avec ce personnage." : "Ton compte de rendu calcule."} Tu peux rester ici ou revenir plus tard : la prise rejoint le coffre.</p>
      <button type="button" className="u-link u-muted" onClick={cancelRun}>Annuler</button>
    </div>}

    {run.phase === "done" && result && media[result.video] && <div ref={resultCard} className="u-card u-result">
      <video ref={video} src={media[result.video]} poster={result.poster ? media[result.poster] : undefined} controls muted loop playsInline preload="auto" className={`is-${result.settings.aspect}`} />
      <p className="u-small">{result.engine === "lora"
        ? (result.costUsd !== null ? `Débité : ${formatUsd(result.costUsd)}, lu sur ton compte fal.` : "Débit pas encore visible sur ton compte fal.")
        : (result.costCredits !== null ? `Débité : ${formatCredits(result.costCredits)} crédits, lu sur ton solde.` : "Débit pas encore visible sur ton solde.")}{result.gpuSeconds !== null ? ` Calcul : ${clock(result.gpuSeconds)}.` : ""}</p>
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
      {run.code === "credits" && <p>{engine === "lora" ? "Recharge ton compte fal, puis relance. Le solde, en haut, montre ce qui reste." : "Recharge ton compte de rendu, puis relance. Le solde, en haut, montre ce qui reste."}</p>}
      {run.code === "auth" || run.code === "scope"
        ? <button type="button" className="u-secondary" onClick={() => { resetRun(); setSheet("relier"); }}>Relier à nouveau</button>
        : <button type="button" className="u-secondary" onClick={resetRun}>Reprendre</button>}
    </div>}

    {run.phase === "idle" && <div className="u-comfort" aria-label="Régler la prise">
      {gaps.length > 0 && <ul className="u-facts u-comfort-gaps">
        {gaps.map(gap => <li key={gap.id}><span>{gap.text}</span> <button type="button" className="u-link" onClick={() => jump(gap.id)}>{gap.action}</button></li>)}
      </ul>}
      {showingExample && <p className="u-small">Parcours d’exemple · {SAMPLE_TAKE.who}, {SAMPLE_TAKE.place}. {SAMPLE_TAKE.line} Rien n’est débité ici.</p>}
      <div className="u-pickers">
        <div className="u-field">
          <span className="u-label">Distribution</span>
          {cast.length === 0
            ? <button type="button" className="u-link" onClick={goLora}>Aucun personnage au coffre</button>
            : <select aria-label="Distribution" value={chosenLora?.id ?? ""} onChange={event => chooseCast(event.target.value)}>
              <option value="">Choisir</option>
              {cast.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>}
          {engine === "lora" && chosenLora && <p className="u-small">Ce fichier recharge {chosenLora.name || "le personnage"}.</p>}
        </div>
        <div className="u-field">
          <span className="u-label">Lieux</span>
          {studio.studio.scenes.length === 0
            ? <button type="button" className="u-link" aria-label="Décors" onClick={goScene}>Aucun lieu au coffre</button>
            : <select aria-label="Décors" value={scene?.id ?? ""} onChange={event => choosePlace(event.target.value)}>
              <option value="">Choisir</option>
              {decor.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>}
          {scene && decor.find(item => item.id === scene.id)?.camera && <p className="u-small">Ce décor se rouvre avec sa caméra.</p>}
        </div>
      </div>
      <label className="u-field">
        <span className="u-label">Ce que fait la prise</span>
        <textarea value={line} rows={2} maxLength={240} placeholder="Elle traverse le quai sous la pluie, sans se retourner." onChange={event => setLine(event.target.value)} />
      </label>
      <fieldset className="u-engines">
        <legend className="u-label">Moteur</legend>
        {WIRED_ENGINES.map(item => {
          const on = engine === item.id;
          const live = on && !showingExample && item.id === "lora" && loraQuote !== null ? formatUsd(loraQuote) : null;
          return <button key={item.id} type="button" aria-pressed={on} onClick={() => { if (pickEngine(item.id)) setEngine(item.id); }}>
            <span>{item.model}</span>
            <strong>{item.label}</strong>
            <em>{item.detail}</em>
            <b>{engineMark({ id: item.id, seconds: settings.seconds, resolution: loraResolution, live })}</b>
          </button>;
        })}
      </fieldset>
      <div className="u-comfort-controls">
        <Segments label="Format" value={settings.aspect} onChange={aspect => setSettings({ aspect })} options={[{ value: "vertical", label: "9:16" }, { value: "horizontal", label: "16:9" }, { value: "carre", label: "1:1" }]} />
        <Segments label="Durée" value={settings.seconds} onChange={seconds => setSettings({ seconds })} options={[{ value: 5, label: "5 s" }, { value: 8, label: "8 s" }]} />
        {engine === "lora" && chosenLora && <Segments label="Netteté" value={loraResolution} onChange={setLoraResolution} options={[{ value: "768P", label: "768p" }, { value: "480P", label: "480p" }]} />}
        {engine === "comfy" && <Segments label="Rendu" value={settings.quality} onChange={quality => setSettings({ quality })} options={[{ value: "rapide", label: `Rapide · ${TAKE_STEPS.rapide} pas` }, { value: "fine", label: `Fin · ${TAKE_STEPS.fine} pas` }]} />}
        <p className="u-sound"><span className="u-label">Son</span>{WIRED_ENGINES.find(item => item.id === engine)?.sound}</p>
      </div>
      <p className={`u-cost is-${showingExample ? "warn" : gate.tone}`}>
        {showingExample ? example
          : engine === "lora"
            ? (falBalance ? `${formatUsd(falBalance.usd)} sur ton compte fal. ${gate.line}` : gate.line)
            : (balance ? `${formatCredits(balance.credits)} crédits sur ton compte. ${gate.line}` : gate.line)}
      </p>
      {action.hint && <p className="u-small u-comfort-hint">{action.hint}</p>}
      {action.id === "bloque" && <button type="button" className="u-link u-comfort-hint" onClick={() => setSheet("credits")}>Voir le compte</button>}
      <button type="button" className="u-primary" disabled={action.id === "bloque"} onClick={() => {
        if (action.id === "tourner") void requestRun();
        else if (action.id !== "bloque") jump(action.id);
      }}>{action.label} <Arrow /></button>
      <div className="u-pair" aria-label="Photos et lieu">
        <figure>{lookPicture && media[lookPicture] ? <img src={media[lookPicture]} alt="" /> : <span />}<figcaption>{studio.studio.look.name || `Exemple · ${SAMPLE_TAKE.who}`}</figcaption></figure>
        <span className="u-pair-thread" aria-hidden="true" />
        <figure>{scenePicture && scene && media[scenePicture] ? <img src={media[scenePicture]} alt="" /> : <span className="u-scene-empty"><Web /></span>}<figcaption>{scene ? (scene.render ? "Image filmée" : scene.name) : `Exemple · ${SAMPLE_TAKE.place}`}</figcaption></figure>
      </div>
      <button type="button" className="u-link u-muted" disabled={!line.trim() && settings.seconds === 5 && settings.quality === "rapide" && settings.aspect === "vertical"} onClick={resetTake}>Remettre ce plan à zéro</button>
      <p className="u-small">Les prises déjà tournées restent.</p>
    </div>}
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
            <span className="u-grid-meta">{take.sceneName || "Prise"} · {costLabel(take) ?? "débit en attente"}</span>
          </button>
        </li>)}
      </ul>}
  </section>;
}
