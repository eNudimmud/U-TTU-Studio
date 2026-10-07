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
import { useI18n } from "@/components/i18n/provider";
import { Arrow, Close, Plus, Web } from "./glyphs";
import { PublishActions } from "./publish";
import { useStudio, type PrevizState, type RunState } from "./studio-context";

export function PictureSlot({ index, url, onAdd, onRemove, label }: { index: number; url?: string; onAdd(files: File[]): void; onRemove?(): void; label: string }) {
  const { t } = useI18n();
  const number = String(index + 1).padStart(2, "0");
  if (url && onRemove) {
    return <figure className="u-slot is-filled" data-frame={number}>
      <img src={url} alt="" />
      <button type="button" className="u-slot-remove" onClick={onRemove} aria-label={t("look.remove", { label, number })}><Close /></button>
    </figure>;
  }
  return <label className="u-slot" data-frame={number}>
    <input type="file" accept="image/*" multiple onChange={event => { onAdd([...(event.target.files ?? [])]); event.target.value = ""; }} aria-label={t("look.add", { label, number })} />
    <Plus />
  </label>;
}

function lookGap(t: ReturnType<typeof useI18n>["t"], parts: (string | false)[]): string {
  const missing = parts.filter((part): part is string => Boolean(part));
  if (missing.length === 0) return "";
  if (missing.length === 1) return t("look.missingOne", { what: missing[0] });
  return t("look.missingMany", { list: missing.slice(0, -1).join(", "), last: missing[missing.length - 1] });
}

function known(say: (line: string) => string, name: string) {
  if (name === "Sans nom" || name === "Personnage" || name === "Prise" || name === "Références") return say(name);
  return name;
}

export function LookScreen({ onNext, onBack }: { onNext(): void; onBack(): void }) {
  const { studio, media, saveLook, addLookPhotos, removeLookPhoto, resetLook } = useStudio();
  const { t } = useI18n();
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
      <p className="u-label">{t("look.kicker")}</p>
      <h1 id="u-title" tabIndex={-1}>{t("look.title")}</h1>
      <p className="u-small">{t("look.lead", { engine: t("engine.comfy.label") })}</p>
      <button type="button" className="u-link" onClick={onBack}>{t("verb.bothWays")}</button>
    </header>
    <div className="u-desk">
      <div className="u-photos" aria-label={t("look.photos")}>
        {Array.from({ length: LOOK_PHOTOS_MAX }, (_, index) => {
          const path = look.photos[index];
          return <PictureSlot key={path ?? `empty-${index}`} index={index} url={path ? media[path] : undefined} label={t("look.photo")} onAdd={files => void addLookPhotos(files)} onRemove={path ? () => void removeLookPhoto(path) : undefined} />;
        })}
      </div>
      <div className="u-stack">
        <label className="u-field">
          <span className="u-label">{t("look.name")}</span>
          <input value={look.name} maxLength={40} placeholder="Mira" autoComplete="off" onChange={event => void saveLook({ name: event.target.value.slice(0, 40) })} />
        </label>
        <div className="u-field">
          <label className="u-label" htmlFor="u-trait">{t("look.traits")}</label>
          <div className="u-chips">
            {look.traits.map(item => <button key={item} type="button" className="u-chip" onClick={() => void saveLook({ traits: look.traits.filter(other => other !== item) })} aria-label={t("look.removeTrait", { item })}>{item}<Close /></button>)}
            <input id="u-trait" value={trait} placeholder={look.traits.length ? t("look.another") : t("look.placeholder")} onChange={event => setTrait(event.target.value)} onKeyDown={onTraitKey} onBlur={() => trait.trim() && addTrait(trait)} enterKeyHint="done" />
          </div>
        </div>
        <ol className="u-marks" aria-label={t("look.held")}>
          <li data-held={check.photos}>{t("look.twoPhotos")}</li>
          <li data-held={check.name}>{t("look.aName")}</li>
          <li data-held={check.traits}>{t("look.twoTraits")}</li>
        </ol>
        <div className="u-actions">
          <button type="button" className="u-link u-muted" disabled={!dirty} onClick={() => void resetLook()}>{t("look.reset")}</button>
          <p className="u-small">{t("look.stay")}</p>
          {!check.ready && <p className="u-small">{lookGap(t, [!check.photos && t("look.gapPhotos"), !check.name && t("look.gapName"), !check.traits && t("look.gapTraits")])}</p>}
          <button type="button" className="u-primary" onClick={() => {
            if (!check.photos) document.querySelector<HTMLElement>(".u-photos input")?.focus();
            else if (!check.name) document.querySelector<HTMLInputElement>(".u-stack input")?.focus();
            else if (!check.traits) document.getElementById("u-trait")?.focus();
            else onNext();
          }}>{check.ready ? t("verb.setScene") : t("look.complete")} <Arrow /></button>
        </div>
      </div>
    </div>
  </section>;
}

export function SceneScreen({ onNext, onRole, focus = null }: { onNext(): void; onRole(): void; focus?: "vues" | "image" | null }) {
  const { studio, scene, media, addScene, selectScene, previz, blenderLinked, falLinked, requestPreviz, setSheet } = useStudio();
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    if (!focus) return;
    const target = focus === "image" ? document.getElementById("u-image-lieu") ?? document.getElementById("u-former-lieu") : document.getElementById("u-vues");
    target?.scrollIntoView({ block: "center" });
  }, [focus, scene?.id]);

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
      <p className="u-label">{t("scene.kicker")}</p>
      <h1 id="u-title" tabIndex={-1}>{t("scene.title")}</h1>
    </header>
    <div className="u-desk">
      <div className="u-stack">
        {studio.scenes.length > 0 && <div className="u-scenes" role="radiogroup" aria-label={t("shelf.places")}>
          {studio.scenes.map(item => {
            const still = item.render ?? item.stills[0];
            return <button key={item.id} type="button" role="radio" aria-checked={item.id === scene?.id} className="u-scene" onClick={() => void selectScene(item.id)}>
              {still && media[still] ? <img src={media[still]} alt="" /> : <span className="u-scene-empty"><Web /></span>}
              <span>{item.name.trim() ? item.name : t("common.unnamed")}</span>
            </button>;
          })}
          {!adding && <button type="button" className="u-scene u-scene-add" onClick={() => setAdding(true)} aria-label={t("scene.new")}><Plus /></button>}
        </div>}
        {showNew && <form className="u-new" onSubmit={add}>
          <label className="u-field">
            <span className="u-label">{t("scene.new")}</span>
            <input id="u-lieu" value={draft} maxLength={40} placeholder={t("scene.placeholder")} onChange={event => setDraft(event.target.value)} autoFocus={adding} />
          </label>
          <button type="submit" className="u-secondary" disabled={!draft.trim()}>{t("verb.set")}</button>
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
            {action.kind !== "film" && <p className="u-small">{t(`film.${action.kind}.missing`)}</p>}
            <button type="button" className="u-primary" onClick={() => {
              if (action.kind === "place") document.getElementById("u-lieu")?.focus();
              else if (action.kind === "plan") document.getElementById("u-plans")?.scrollIntoView({ block: "center" });
              else if (action.kind === "blender") setSheet("blender");
              else if (action.kind === "role") onRole();
              else if (action.kind === "fal") setSheet("fal");
              else void requestPreviz();
            }}>{t(`film.${action.kind}.label`)} <Arrow /></button>
          </>;
        })()}
        <button type="button" className="u-link" onClick={() => {
          if (!scene) document.getElementById("u-lieu")?.focus();
          else onNext();
        }}>{scene ? t("scene.goTake") : t("scene.placeFirst")}</button>
      </div>
    </div>
  </section>;
}

function VueProjet() {
  const { studio, scene, setSheet } = useStudio();
  const { t, say } = useI18n();
  if (!scene) return null;
  const group = vueProjet({
    scene,
    takes: studio.takes,
    loras: studio.loras,
    lookName: studio.look.name,
  });
  return <section className="u-card u-projet" aria-label={t("scene.project")}>
    <h2>{t("scene.project")}</h2>
    <ul className="u-facts">
      <li><strong>{t("nav.character")}</strong>{group.personnages.length ? group.personnages.map(name => known(say, name)).join(" · ") : t("scene.noCharacter")}</li>
      <li><strong>{t("sheet.place")}</strong>{known(say, group.lieu)}</li>
      <li>
        <strong>{t("shelf.takes")}</strong>
        {group.prises.length === 0
          ? t("scene.noTake")
          : <ul className="u-projet-prises">
            {group.prises.map(prise => <li key={prise.id}>
              <button type="button" className="u-link" onClick={() => setSheet({ take: prise.id })} aria-label={t("scene.openTake", { line: prise.line })}>{known(say, prise.line)}</button>
            </li>)}
          </ul>}
      </li>
    </ul>
  </section>;
}

function filmLabel(t: ReturnType<typeof useI18n>["t"], state: Extract<PrevizState, { phase: "running" }>): string {
  const event = state.event;
  switch (event.stage) {
    case "write": return t("film.write");
    case "inspect": return t("film.inspect");
    case "start": return t("film.start");
    case "queue": return t("film.queue");
    case "render": return t("film.render", { seconds: event.seconds });
    case "fetch": return t("film.fetch");
    case "person": return t("film.person");
    case "shot": return t("film.shot", { seconds: event.seconds });
    case "video": return t("film.video");
  }
}

function FilmStatus() {
  const { previz, cancelPreviz } = useStudio();
  const { t } = useI18n();
  if (previz.phase !== "running") return null;
  return <div className="u-run" role="status">
    <div className="u-thread" aria-hidden="true"><span /></div>
    <p className="u-run-label">{filmLabel(t, previz)}</p>
    <button type="button" className="u-link u-muted" onClick={cancelPreviz}>{t("verb.cancel")}</button>
  </div>;
}

function SceneEditor() {
  const { scene, media, studio, saveScene, addSceneStills, removeSceneStill, deleteScene, setPreviz, moveCamera, setLens, previz, resetScene, blenderLinked, setSheet, falLinked, placeTrainQuote, placeSceneQuote, placeRun, requestPlaceTrain, requestPlaceScene, addSceneViews, removeSceneView } = useStudio();
  const { t, say } = useI18n();
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
      <span className="u-label">{t("scene.placeName")}</span>
      <input value={scene.name} maxLength={40} onChange={event => void saveScene(scene.id, { name: event.target.value.slice(0, 40) })} />
    </label>
    <label className="u-field">
      <span className="u-label">{t("scene.holds")}</span>
      <textarea value={scene.note} maxLength={280} rows={2} placeholder={t("scene.holdsPlaceholder")} onChange={event => void saveScene(scene.id, { note: event.target.value.slice(0, 280) })} />
    </label>
    <details className="u-fold">
      <summary>{t("scene.holdsSummary")}</summary>
      <ul className="u-facts">
        <li><strong>{t("scene.thePlace")}</strong>{t("scene.thePlaceBody")}</li>
        <li><strong>Blender</strong>{t("scene.blenderBody", { frames: PATH_FRAMES })}</li>
        <li><strong>{t("nav.character")}</strong>{t("scene.theCharacterBody")}</li>
        <li><strong>{t("scene.formed")}</strong>{say(learned.line)} {falLinked && placeTrainQuote !== null ? t("scene.formedPrice", { amount: formatUsd(placeTrainQuote) }) : t("scene.formedUnread")} {placeFile ? `${t("scene.formedFile")}${placeSceneQuote !== null ? ` ${t("scene.formedNew", { amount: formatUsd(placeSceneQuote) })}` : ""}` : ""} {t("scene.formedTail")}</li>
        <li><strong>{t("scene.thePrice")}</strong>{t("scene.thePriceBody")}</li>
      </ul>
    </details>
    <p className="u-label">{t("scene.plan")}</p>
    <div id="u-plans" className="u-segments" role="group" aria-label={t("scene.plan")}>
      {PREVIZ_PLANS.map(plan => <button key={plan} type="button" aria-pressed={scene.previz === plan} onClick={() => void setPreviz(scene.id, plan)}>{PREVIZ_LABELS[plan]}</button>)}
    </div>
    {camera && here && <>
      <div className="u-segments" role="group" aria-label={t("scene.path")}>
        <button type="button" aria-pressed={point === "start"} onClick={() => setPoint("start")}>{t("scene.start")}</button>
        <button type="button" aria-pressed={point === "end"} onClick={() => setPoint("end")}>{t("scene.end")}</button>
      </div>
      <p className="u-small">{t("scene.coords", { end: point === "start" ? t("scene.start") : t("scene.end"), x: here.x, y: here.y, z: here.z, ax: here.aimX, ay: here.aimY, az: here.aimZ, lens: camera.lens })}</p>
      <div className="u-nudge" role="group" aria-label={t("scene.moveCamera")}>
        {(["x", "y", "z"] as const).map(axis => <span key={axis}>
          <button type="button" onClick={() => void moveCamera(point, "stand", axis, -1)} aria-label={t("scene.cameraLess", { axis })}>−{axis.toUpperCase()}</button>
          <button type="button" onClick={() => void moveCamera(point, "stand", axis, 1)} aria-label={t("scene.cameraMore", { axis })}>+{axis.toUpperCase()}</button>
        </span>)}
      </div>
      <div className="u-nudge" role="group" aria-label={t("scene.moveAim")}>
        {(["x", "y", "z"] as const).map(axis => <span key={axis}>
          <button type="button" onClick={() => void moveCamera(point, "aim", axis, -1)} aria-label={t("scene.aimLess", { axis })}>−{axis.toUpperCase()}</button>
          <button type="button" onClick={() => void moveCamera(point, "aim", axis, 1)} aria-label={t("scene.aimMore", { axis })}>+{axis.toUpperCase()}</button>
        </span>)}
      </div>
      <div className="u-segments" role="group" aria-label={t("scene.lens")}>
        {LENSES.map(lens => <button key={lens} type="button" aria-pressed={camera.lens === lens} onClick={() => void setLens(lens)}>{lens}</button>)}
      </div>
    </>}
    {scene.previz && !renderUrl && <p className="u-small">{t("scene.volumes", { count: placeVolumes(scene.previz) })}</p>}
    {renderUrl && <figure className="u-previz">
      <img src={renderUrl} alt="" />
      <figcaption>{t("scene.emptyCaption")}</figcaption>
    </figure>}
    {filmed && media[filmed.video] && <video src={media[filmed.video]} poster={filmed.poster ? media[filmed.poster] : undefined} controls muted playsInline preload="metadata" />}
    {previz.phase === "error" && <p className="u-small is-error" role="alert">{say(previz.message)}</p>}
    <p className={`u-cost is-${blenderLinked ? "ok" : "warn"}`}>
      {blenderLinked ? t("scene.blenderKey") : t("scene.noBlenderKey")}
    </p>
    <button type="button" className="u-link u-muted" onClick={() => setSheet("blender")}>{blenderLinked ? t("scene.changeKey") : t("scene.whereKey")}</button>
    <p className="u-label">{t("scene.viewsLabel", { count: shots.length, min: PLACE_SHOTS_MIN })}</p>
    {!learned.ready && <p className="u-small">{say(learned.line)}</p>}
    <div id="u-vues" className="u-photos is-wide" aria-label={t("scene.views")}>
      {scene.views.map((path, index) => <PictureSlot key={path} index={index} url={media[path]} label={t("look.view")} onAdd={files => void addSceneViews(scene.id, files)} onRemove={() => void removeSceneView(scene.id, path)} />)}
      {scene.views.length < 12 && <PictureSlot index={scene.views.length} label={t("look.view")} onAdd={files => void addSceneViews(scene.id, files)} />}
    </div>
    <button type="button" id="u-former-lieu" className="u-link" disabled={placeRun === "running"} onClick={() => {
      if (!learned.ready) {
        document.getElementById("u-vues")?.scrollIntoView({ block: "center" });
        return;
      }
      if (!falLinked) {
        setSheet("fal");
        return;
      }
      void requestPlaceTrain();
    }}>{placeRun === "running" ? t("scene.training") : learned.ready ? (placeTrainQuote !== null ? t("verb.trainPlacePriced", { price: formatUsd(placeTrainQuote) }) : t("verb.trainThisPlace")) : t("scene.addView")}</button>
    {placeFile && <button type="button" id="u-image-lieu" className="u-link" disabled={placeRun === "running"} onClick={() => void requestPlaceScene()}>{placeSceneQuote !== null ? t("verb.buildPriced", { price: formatUsd(placeSceneQuote) }) : t("verb.buildThis")}</button>}
    <div className="u-photos is-wide" aria-label={t("scene.stills")}>
      {Array.from({ length: SCENE_STILLS_MAX }, (_, index) => {
        const path = scene.stills[index];
        return <PictureSlot key={path ?? `still-${index}`} index={index} url={path ? media[path] : undefined} label={t("look.still")} onAdd={files => void addSceneStills(scene.id, files)} onRemove={path ? () => void removeSceneStill(scene.id, path) : undefined} />;
      })}
    </div>
    <button type="button" className="u-link u-muted" disabled={!dirty} onClick={() => void resetScene()}>{t("scene.reset")}</button>
    <p className="u-small">{t("scene.resetStay")}</p>
    <button type="button" className="u-link u-muted" onClick={() => void deleteScene(scene.id)}>{t("scene.remove")}</button>
  </div>;
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function runLabel(t: ReturnType<typeof useI18n>["t"], run: Extract<RunState, { phase: "running" }>): string {
  const event = run.event;
  switch (event.stage) {
    case "start": return t("run.start");
    case "upload": return t("run.upload", { done: event.done, total: event.total });
    case "lora": return t("run.lora");
    case "submit": return t("run.submit");
    case "queue": return "position" in event && event.position ? t("run.queuePos", { position: event.position }) : t("run.queue");
    case "prepare": return t("run.prepare");
    case "render": return t("run.render", { clock: clock(event.seconds) });
    case "fetch": return t("run.fetch");
    case "measure": return t("run.measure");
  }
}

export function Segments<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange(value: T): void }) {
  return <fieldset className="u-segments">
    <legend className="u-label">{label}</legend>
    {options.map(option => <button key={String(option.value)} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </fieldset>;
}

export function PlateauShelf({ go }: { go(next: "lora" | "scene" | "prise" | "sphere"): void }) {
  const studio = useStudio();
  const { t } = useI18n();
  const { media, scene, line, setLine, setSheet, setEngine, chosenLora, setLora, selectScene } = studio;
  const cast = castShelf(studio.studio.loras);
  const decor = decorShelf(studio.studio.scenes);
  const who = chosenLora?.name.trim() ?? "";
  const place = scene?.name.trim() ?? "";

  function chooseCast(id: string) {
    const person = cast.find(item => item.id === id);
    if (!person) return;
    setEngine("lora");
    setLora(person.id);
    setLine(weaveBrief({ who: person.name, place, action: briefAction(line, who, place) }));
  }

  function choosePlace(id: string) {
    const next = studio.studio.scenes.find(item => item.id === id);
    if (!next) return;
    void selectScene(next.id);
    setLine(weaveBrief({ who, place: next.name.trim(), action: briefAction(line, who, place) }));
  }

  return <aside className="u-plateau" aria-label={t("shelf.label")}>
    <div className="u-stack">
      <p className="u-label">{t("shelf.cast")}</p>
      {cast.length === 0
        ? <button type="button" className="u-link" onClick={() => go("lora")}>{t("shelf.noCharacter")}</button>
        : <div className="u-scenes" role="radiogroup" aria-label={t("shelf.cast")}>
          {cast.map(person => <button key={person.id} type="button" role="radio" aria-checked={chosenLora?.id === person.id} className="u-scene" onClick={() => chooseCast(person.id)}>
            <span className="u-scene-empty">{person.name.slice(0, 1)}</span>
            <span>{person.name}</span>
          </button>)}
        </div>}
    </div>
    <div className="u-stack">
      <p className="u-label">{t("shelf.places")}</p>
      {decor.length === 0
        ? <button type="button" className="u-link" onClick={() => go("scene")}>{t("shelf.noPlace")}</button>
        : <div className="u-scenes" role="radiogroup" aria-label={t("shelf.places")}>
          {decor.map(item => {
            const held = studio.studio.scenes.find(sceneItem => sceneItem.id === item.id);
            const still = held?.render ?? held?.stills[0];
            return <button key={item.id} type="button" role="radio" aria-checked={scene?.id === item.id} className="u-scene" onClick={() => choosePlace(item.id)}>
              {still && media[still] ? <img src={media[still]} alt="" /> : <span className="u-scene-empty"><Web /></span>}
              <span>{item.name}</span>
            </button>;
          })}
        </div>}
    </div>
    <div className="u-stack">
      <p className="u-label">{t("shelf.takes")}</p>
      {studio.studio.takes.length === 0
        ? <button type="button" className="u-link" onClick={() => go("sphere")}>{t("shelf.noTake")}</button>
        : <div className="u-scenes">
          {studio.studio.takes.map(take => <button key={take.id} type="button" className="u-scene" onClick={() => setSheet({ take: take.id })}>
            {take.poster && media[take.poster] ? <img src={media[take.poster]} alt="" /> : <span className="u-scene-empty"><Web /></span>}
            <span>{take.line || take.sceneName || t("common.take")}</span>
          </button>)}
        </div>}
    </div>
  </aside>;
}

export function TakeScreen({ goLook, goScene, goSphere, goLora }: { goLook(): void; goScene(): void; goSphere(): void; goLora(): void }) {
  const studio = useStudio();
  const { t, say } = useI18n();
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

  const gapCopy = {
    photos: [t("take.gapPhotos"), t("verb.holdPhotos")],
    scene: [t("take.gapScene"), t("verb.setScene")],
    fichier: [t("take.gapFile"), t("verb.trainCharacter")],
  } as const;
  const hint = action.id === "photos" ? t("take.gapPhotos") : action.id === "scene" ? t("take.gapScene") : action.id === "fichier" ? t("take.hintFile") : action.id === "bloque" ? t("take.hintBlocked") : "";
  const actionLabel = action.id === "relier" ? t("verb.relier")
    : action.id === "photos" ? t("verb.holdPhotos")
    : action.id === "scene" ? t("verb.setScene")
    : action.id === "fichier" ? t("verb.trainCharacter")
    : livePrice ? t("verb.shootPriced", { price: livePrice }) : t("verb.tourner");

  return <section className="u-screen" aria-labelledby="u-title">
    <header className="u-head">
        <p className="u-label">{t("take.kicker")}</p>
      <h1 id="u-title" tabIndex={-1}>{t("take.title")}</h1>
    </header>

    {run.phase === "running" && <div className="u-card u-run" role="status" aria-live="polite">
      <div className="u-thread" aria-hidden="true"><span /></div>
      <p className="u-run-label">{runLabel(t, run)}</p>
      <p className="u-small">{engine === "lora" ? t("take.runningFal") : t("take.runningRender")} {t("take.stay")}</p>
      <button type="button" className="u-link u-muted" onClick={cancelRun}>{t("verb.cancel")}</button>
    </div>}

    {run.phase === "done" && result && media[result.video] && <div ref={resultCard} className="u-card u-result">
      <video ref={video} src={media[result.video]} poster={result.poster ? media[result.poster] : undefined} controls muted loop playsInline preload="auto" className={`is-${result.settings.aspect}`} />
      <p className="u-small">{t("take.inSphere")}</p>
      <p className="u-small">{result.engine === "lora"
        ? (result.costUsd !== null ? t("take.debitedFal", { amount: formatUsd(result.costUsd) }) : t("take.debitHiddenFal"))
        : (result.costCredits !== null ? t("take.debitedRender", { amount: formatCredits(result.costCredits) }) : t("take.debitHiddenRender"))}{result.gpuSeconds !== null ? t("take.calc", { clock: clock(result.gpuSeconds) }) : ""}</p>
      <PublishActions take={result} />
      <div className="u-row">
        <button type="button" className="u-secondary" onClick={resetRun}>{t("take.new")}</button>
        <button type="button" className="u-link" onClick={goSphere}>{t("take.seeSphere")}</button>
      </div>
    </div>}

    {run.phase === "error" && <div className="u-card u-soft-error" role="alert">
      <p className="u-crt">{t("take.soft")}</p>
      <p>{say(run.message)}</p>
      {run.detail.length > 0 && <ul>{run.detail.map(item => <li key={item}>{say(item)}</li>)}</ul>}
      {run.code === "credits" && <p>{engine === "lora" ? t("take.reloadFal") : t("take.reloadRender")}</p>}
      {run.code === "auth" || run.code === "scope"
        ? <button type="button" className="u-secondary" onClick={() => { resetRun(); setSheet("relier"); }}>{t("verb.connectAgain")}</button>
        : <button type="button" className="u-secondary" onClick={resetRun}>{t("verb.resume")}</button>}
    </div>}

    {run.phase === "idle" && <div className="u-comfort" aria-label={t("take.adjust")}>
      <div className="u-comfort-work">
      {gaps.length > 0 && <ul className="u-facts u-comfort-gaps">
        {gaps.map(gap => <li key={gap.id}><span>{gapCopy[gap.id][0]}</span> <button type="button" className="u-link" onClick={() => jump(gap.id)}>{gapCopy[gap.id][1]}</button></li>)}
      </ul>}
      {showingExample && <p className="u-small">{t("take.exampleWalk", { who: SAMPLE_TAKE.who, place: SAMPLE_TAKE.place, line: SAMPLE_TAKE.line })}</p>}
      <div className="u-pickers">
        <div className="u-field">
          <span className="u-label">{t("shelf.cast")}</span>
          {cast.length === 0
            ? <button type="button" className="u-link" onClick={goLora}>{t("shelf.noCharacter")}</button>
            : <select aria-label={t("shelf.cast")} value={chosenLora?.id ?? ""} onChange={event => chooseCast(event.target.value)}>
              <option value="">{t("verb.choose")}</option>
              {cast.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>}
          {engine === "lora" && chosenLora && <p className="u-small">{t("take.reloads", { name: chosenLora.name || t("take.theCharacter") })}</p>}
        </div>
        <div className="u-field">
          <span className="u-label">{t("shelf.places")}</span>
          {studio.studio.scenes.length === 0
            ? <button type="button" className="u-link" aria-label={t("shelf.places")} onClick={goScene}>{t("shelf.noPlace")}</button>
            : <select aria-label={t("shelf.places")} value={scene?.id ?? ""} onChange={event => choosePlace(event.target.value)}>
              <option value="">{t("verb.choose")}</option>
              {decor.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>}
          {scene && decor.find(item => item.id === scene.id)?.camera && <p className="u-small">{t("take.cameraBack")}</p>}
        </div>
      </div>
      <label className="u-field">
        <span className="u-label">{t("take.action")}</span>
        <textarea value={line} rows={2} maxLength={240} placeholder={t("take.actionPlaceholder")} onChange={event => setLine(event.target.value)} />
      </label>
      <fieldset className="u-engines">
        <legend className="u-label">{t("take.engine")}</legend>
        {WIRED_ENGINES.map(item => {
          const on = engine === item.id;
          const live = on && !showingExample && item.id === "lora" && loraQuote !== null ? formatUsd(loraQuote) : null;
          return <button key={item.id} type="button" aria-pressed={on} onClick={() => { if (pickEngine(item.id)) setEngine(item.id); }}>
            <span>{item.model}</span>
            <strong>{t(`engine.${item.id}.label`)}</strong>
            <em>{t(`engine.${item.id}.detail`)}</em>
            <b>{say(engineMark({ id: item.id, seconds: settings.seconds, resolution: loraResolution, live }))}</b>
          </button>;
        })}
      </fieldset>
      <div className="u-comfort-controls">
        <Segments label={t("take.format")} value={settings.aspect} onChange={aspect => setSettings({ aspect })} options={[{ value: "vertical", label: "9:16" }, { value: "horizontal", label: "16:9" }, { value: "carre", label: "1:1" }]} />
        <Segments label={t("take.duration")} value={settings.seconds} onChange={seconds => setSettings({ seconds })} options={[{ value: 5, label: "5 s" }, { value: 8, label: "8 s" }]} />
        {engine === "lora" && chosenLora && <Segments label={t("take.sharpness")} value={loraResolution} onChange={setLoraResolution} options={[{ value: "768P", label: "768p" }, { value: "480P", label: "480p" }]} />}
        {engine === "comfy" && <Segments label={t("take.render")} value={settings.quality} onChange={quality => setSettings({ quality })} options={[{ value: "rapide", label: t("take.fast", { steps: TAKE_STEPS.rapide }) }, { value: "fine", label: t("take.fine", { steps: TAKE_STEPS.fine }) }]} />}
        <p className="u-sound"><span className="u-label">{t("take.sound")}</span>{t(`engine.${engine}.sound`)}</p>
      </div>
      <p className={`u-cost is-${showingExample ? "warn" : gate.tone}`}>
        {showingExample ? say(example)
          : engine === "lora"
            ? (falBalance ? t("take.falBalance", { amount: formatUsd(falBalance.usd), line: say(gate.line) }) : say(gate.line))
            : (balance ? t("take.renderBalance", { amount: formatCredits(balance.credits), line: say(gate.line) }) : say(gate.line))}
      </p>
      {hint && <p className="u-small u-comfort-hint">{hint}</p>}
      {action.id === "bloque" && <button type="button" className="u-link u-comfort-hint" onClick={() => setSheet("credits")}>{t("take.seeAccount")}</button>}
      <button type="button" className="u-primary" disabled={action.id === "bloque"} onClick={() => {
        if (action.id === "tourner") void requestRun();
        else if (action.id !== "bloque") jump(action.id);
      }}>{actionLabel} <Arrow /></button>
      <div className="u-pair" aria-label={t("take.pair")}>
        <figure>{lookPicture && media[lookPicture] ? <img src={media[lookPicture]} alt="" /> : <span />}<figcaption>{studio.studio.look.name || t("take.exampleWho", { who: SAMPLE_TAKE.who })}</figcaption></figure>
        <span className="u-pair-thread" aria-hidden="true" />
        <figure>{scenePicture && scene && media[scenePicture] ? <img src={media[scenePicture]} alt="" /> : <span className="u-scene-empty"><Web /></span>}<figcaption>{scene ? (scene.render ? t("take.filmedStill") : scene.name) : t("take.examplePlace", { place: SAMPLE_TAKE.place })}</figcaption></figure>
      </div>
      <button type="button" className="u-link u-muted" disabled={!line.trim() && settings.seconds === 5 && settings.quality === "rapide" && settings.aspect === "vertical"} onClick={resetTake}>{t("take.resetPlan")}</button>
      <p className="u-small">{t("take.stayTakes")}</p>
      </div>
    </div>}
  </section>;
}

export function SphereScreen() {
  const { studio, media, setSheet } = useStudio();
  const { t, say } = useI18n();
  return <section className="u-screen" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">{t("sphere.kicker")}</p>
      <h1 id="u-title" tabIndex={-1}>{t("sphere.title")}</h1>
      <p className="u-small">{t("sphere.subtitle")}</p>
    </header>
    {studio.takes.length === 0
      ? <p className="u-lead">{t("sphere.empty")}</p>
      : <ul className="u-grid">
        {studio.takes.map(take => <li key={take.id}>
          <button type="button" onClick={() => setSheet({ take: take.id })} aria-label={t("sphere.open", { line: take.line || take.id })}>
            {take.poster && media[take.poster] ? <img src={media[take.poster]} alt="" />
              : media[take.video] ? <video src={`${media[take.video]}#t=0.1`} muted playsInline preload="auto" />
              : <span className="u-scene-empty"><Web /></span>}
            <span className="u-grid-meta">{take.sceneName || t("common.take")} · {costLabel(take) ?? say("débit en attente")}</span>
          </button>
        </li>)}
      </ul>}
  </section>;
}
