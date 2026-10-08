"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { SCENE_STILLS_MAX, isPlaceLora } from "@/lib/coffre/model";
import { nextNumberedName } from "@/lib/ergonomie";
import { vueProjet } from "@/lib/studio-comfort";
import { PLACE_SHOTS_MIN, placeShotLine, placeShotList } from "@/lib/lora/place";
import { LENSES, PREVIZ_LABELS, PREVIZ_PLANS, PATH_FRAMES, defaultCamera, pathPoint, placeVolumes } from "@/lib/render/place";
import { filmAction } from "@/lib/render/shot";
import { formatUsd } from "@/lib/fal/prices";
import { useI18n } from "@/components/i18n/provider";
import { OutgoingFilm, OutgoingLieu } from "./outgoing-text";
import { ProjectMemory } from "./project-memory";
import { Why } from "./guide-bubble";
import { Arrow, Plus, Web } from "./glyphs";
import { PictureSlot } from "./slots";
import { useStudio, type PrevizState } from "./studio-context";

function known(say: (line: string) => string, name: string) {
  if (name === "Sans nom" || name === "Personnage" || name === "Prise" || name === "Références") return say(name);
  return name;
}

export function SceneScreen({ onNext, onRole, focus = null }: { onNext(): void; onRole(): void; focus?: "vues" | "image" | null }) {
  const { ready, studio, scene, media, addScene, selectScene, previz, blenderLinked, falLinked, requestPreviz, setSheet } = useStudio();
  const { t } = useI18n();
  const suggested = nextNumberedName(t("scene.defaultName"), studio.scenes.map(item => item.name));
  const [draft, setDraft] = useState(suggested);
  const followed = useRef(suggested);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    const previous = followed.current;
    setDraft(current => (current === previous ? suggested : current));
    followed.current = suggested;
  }, [suggested]);
  useEffect(() => {
    if (!focus) return;
    const target = document.getElementById(focus === "image" ? "u-former-lieu" : "u-vues");
    target?.scrollIntoView({ block: "center" });
  }, [focus, scene?.id]);

  function add(event: FormEvent) {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    const first = studio.scenes.length === 0;
    void addScene(name).then(() => {
      const next = nextNumberedName(t("scene.defaultName"), [...studio.scenes.map(item => item.name), name]);
      followed.current = next;
      setDraft(next);
      setAdding(false);
      if (first) onNext();
    });
  }

  const showNew = adding || studio.scenes.length === 0;
  return <section className="u-screen u-scene-screen" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">{t("scene.kicker")}</p>
      <h1 id="u-title" tabIndex={-1}>{t("scene.title")}</h1>
      <p className="u-micro">{t("guide.stepScene")}</p>
      <button type="button" className="u-link" onClick={() => setSheet({ outputs: "scene" })}>{t("job.outputs")}</button>
    </header>
    {ready && <>
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
          {!adding && <button type="button" className="u-scene u-scene-add" onClick={() => { followed.current = suggested; setDraft(suggested); setAdding(true); }} aria-label={t("scene.new")}><Plus /></button>}
        </div>}
        {showNew && <form id="u-lieu-form" className="u-new" onSubmit={add}>
          <label className="u-field">
            <span className="u-label">{t("scene.new")}</span>
            <input id="u-lieu" value={draft} maxLength={40} placeholder={t("scene.placeholder")} onChange={event => setDraft(event.target.value)} autoFocus={adding} />
          </label>
        </form>}
      </div>
      <div className="u-stack">
        {previz.phase === "running" ? <ProjectMemory /> : (() => {
          const posing = !scene || adding;
          const action = filmAction({
            scene: Boolean(scene),
            plan: Boolean(scene?.previz),
            blender: blenderLinked,
            character: studio.loras.some(item => !isPlaceLora(item)),
            fal: falLinked,
          });
          return <>
            <button
              type={posing ? "submit" : "button"}
              form={posing ? "u-lieu-form" : undefined}
              className="u-primary"
              disabled={posing && !draft.trim()}
              onClick={() => { if (!posing) onNext(); }}
            >{posing ? t("scene.setPlace") : t("scene.goTake")} <Arrow /></button>
            <Why on={posing && !draft.trim()} text={t("why.needName")} />
            {posing && draft.trim() === suggested && <p className="u-small">{t("scene.written")}</p>}
            {scene && !adding && <p className="u-small">{t("scene.passTake")}</p>}
            {scene && adding && <button type="button" className="u-link" onClick={onNext}>{t("scene.goTake")}</button>}
            <ProjectMemory />
            {action.kind !== "place" && <>
              <OutgoingFilm />
              {action.kind !== "film" && <p className="u-small">{t(`film.${action.kind}.missing`)}</p>}
              <button type="button" className="u-secondary" onClick={() => {
                if (action.kind === "plan") {
                  const fold = document.getElementById("u-espace");
                  if (fold instanceof HTMLDetailsElement) fold.open = true;
                  document.getElementById("u-plans")?.scrollIntoView({ block: "center" });
                } else if (action.kind === "blender") setSheet("blender");
                else if (action.kind === "role") onRole();
                else if (action.kind === "fal") setSheet("fal");
                else void requestPreviz();
              }}>{t(`film.${action.kind}.label`)} <Arrow /></button>
            </>}
          </>;
        })()}
        {scene && <VueProjet />}
        <SceneJobs />
      </div>
    </div>
    {scene && <SceneEditor />}
    </>}
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
              {studio.sequences.filter(sequence => sequence.links.some(link => link.takeId === prise.id)).map(sequence => <button key={sequence.id} type="button" className="u-link" onClick={() => setSheet({ sequence: sequence.id })}>{t("sequence.inSequence", { name: sequence.name || t("common.unnamed") })}</button>)}
              {studio.shots.filter(shot => shot.takeIds.includes(prise.id)).map(shot => <button key={shot.id} type="button" className="u-link" onClick={() => setSheet({ shot: shot.id })}>{t("shot.inShot", { name: shot.name || t("common.unnamed") })}</button>)}
            </li>)}
          </ul>}
      </li>
      <li>
        <strong>{t("shot.title")}</strong>
        {studio.shots.length === 0
          ? t("shot.empty")
          : <ul className="u-projet-prises">
            {studio.shots.map(shot => <li key={shot.id}>
              <button type="button" className="u-link" onClick={() => setSheet({ shot: shot.id })} aria-label={t("shot.open", { name: shot.name })}>{shot.name || t("common.unnamed")}</button>
            </li>)}
          </ul>}
        <button type="button" className="u-link" onClick={() => setSheet("shots")}>{studio.shots.length === 0 ? t("shot.create") : t("shot.back")}</button>
      </li>
      <li>
        <strong>{t("sequence.title")}</strong>
        {studio.sequences.length === 0
          ? t("sequence.empty")
          : <ul className="u-projet-prises">
            {studio.sequences.map(sequence => <li key={sequence.id}>
              <button type="button" className="u-link" onClick={() => setSheet({ sequence: sequence.id })} aria-label={t("sequence.open", { name: sequence.name })}>{sequence.name || t("common.unnamed")}</button>
            </li>)}
          </ul>}
        <button type="button" className="u-link" onClick={() => setSheet("sequences")}>{studio.sequences.length === 0 ? t("sequence.create") : t("sequence.back")}</button>
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
  const { previz, cancelPreviz, setSheet } = useStudio();
  const { t } = useI18n();
  if (previz.phase !== "running") return null;
  return <div className="u-card u-run" role="status">
    <div className="u-thread" aria-hidden="true"><span /></div>
    <p className="u-label">{t("job.running")}</p>
    <p className="u-run-label">{filmLabel(t, previz)}</p>
    <button type="button" className="u-link" onClick={() => setSheet({ outputs: "scene" })}>{t("job.outputs")}</button>
    <button type="button" className="u-link u-muted" onClick={cancelPreviz}>{t("verb.cancel")}</button>
  </div>;
}

function SceneJobs() {
  const { t, say } = useI18n();
  const { previz, scene, media, studio, setSheet, resumePreviz, placeResult, resetPlaceResult } = useStudio();
  const filmed = previz.phase === "done" && previz.takeId ? studio.takes.find(item => item.id === previz.takeId) : undefined;
  const still = scene?.render ? media[scene.render] : undefined;
  const file = placeResult.phase === "done" ? studio.loras.find(item => item.id === placeResult.loraId) : undefined;
  return <>
    {previz.phase === "running" && <FilmStatus />}
    {previz.phase === "done" && <div className="u-card u-result">
      <p className="u-label">{t("job.done")}</p>
      <p className="u-small">{t("job.latest")}</p>
      {filmed && media[filmed.video]
        ? <video src={media[filmed.video]} poster={filmed.poster ? media[filmed.poster] : undefined} controls muted playsInline className={`u-player is-${filmed.settings.aspect}`} />
        : still ? <img src={still} alt="" /> : <p className="u-small">{t("job.empty")}</p>}
      <button type="button" className="u-link" onClick={() => setSheet({ outputs: "scene" })}>{t("job.outputs")}</button>
    </div>}
    {previz.phase === "error" && <div className="u-card u-soft-error" role="alert">
      <p className="u-crt">{t("take.soft")}</p>
      <p>{say(previz.message)}</p>
      {previz.detail.length > 0 && <ul>{previz.detail.map(item => <li key={item}>{say(item)}</li>)}</ul>}
      <button type="button" className="u-secondary" onClick={resumePreviz}>{t("verb.resume")}</button>
      <button type="button" className="u-link" onClick={() => setSheet({ outputs: "scene" })}>{t("job.outputs")}</button>
    </div>}
    {placeResult.phase === "running" && <div className="u-card u-run" role="status" aria-live="polite">
      <p className="u-label">{t("job.running")}</p>
      <p className="u-run-label">{t("scene.training")}</p>
      <button type="button" className="u-link" onClick={() => setSheet({ outputs: "scene" })}>{t("job.outputs")}</button>
    </div>}
    {placeResult.phase === "done" && file && <div className="u-card u-result">
      <p className="u-label">{t("job.done")}</p>
      <p>{file.name || t("common.unnamed")}</p>
      <button type="button" className="u-link" onClick={() => setSheet({ outputs: "scene" })}>{t("job.outputs")}</button>
    </div>}
    {placeResult.phase === "error" && <div className="u-card u-soft-error" role="alert">
      <p className="u-crt">{t("take.soft")}</p>
      <p>{say(placeResult.message)}</p>
      {placeResult.detail.length > 0 && <ul>{placeResult.detail.map(item => <li key={item}>{say(item)}</li>)}</ul>}
      <button type="button" className="u-secondary" onClick={resetPlaceResult}>{t("verb.resume")}</button>
      <button type="button" className="u-link" onClick={() => setSheet({ outputs: "scene" })}>{t("job.outputs")}</button>
    </div>}
  </>;
}

function SceneEditor() {
  const { scene, media, studio, saveScene, addSceneStills, removeSceneStill, deleteScene, setPreviz, moveCamera, setLens, resetScene, blenderLinked, setSheet, falLinked, placeTrainQuote, placeRun, requestPlaceTrain, addSceneViews, removeSceneView } = useStudio();
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
        <li><strong>{t("scene.formed")}</strong>{say(learned.line)} {falLinked && placeTrainQuote !== null ? t("scene.formedPrice", { amount: formatUsd(placeTrainQuote) }) : t("scene.formedUnread")} {placeFile ? `${t("scene.formedFile")} ` : ""}{t("scene.formedTail")}</li>
        <li><strong>{t("scene.thePrice")}</strong>{t("scene.thePriceBody")}</li>
      </ul>
    </details>
    <details className="u-fold" id="u-espace">
      <summary>{t("scene.spaceSummary")}</summary>
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
      <p className="u-label">{t("scene.moveCamera")}</p>
      <div className="u-nudge" role="group" aria-label={t("scene.moveCamera")}>
        {(["x", "y", "z"] as const).map(axis => <span key={axis}>
          <button type="button" onClick={() => void moveCamera(point, "stand", axis, -1)} aria-label={t("scene.cameraLess", { axis })}>−{axis.toUpperCase()}</button>
          <button type="button" onClick={() => void moveCamera(point, "stand", axis, 1)} aria-label={t("scene.cameraMore", { axis })}>+{axis.toUpperCase()}</button>
        </span>)}
      </div>
      <p className="u-label">{t("scene.moveAim")}</p>
      <div className="u-nudge" role="group" aria-label={t("scene.moveAim")}>
        {(["x", "y", "z"] as const).map(axis => <span key={axis}>
          <button type="button" onClick={() => void moveCamera(point, "aim", axis, -1)} aria-label={t("scene.aimLess", { axis })}>−{axis.toUpperCase()}</button>
          <button type="button" onClick={() => void moveCamera(point, "aim", axis, 1)} aria-label={t("scene.aimMore", { axis })}>+{axis.toUpperCase()}</button>
        </span>)}
      </div>
      <p className="u-label">{t("scene.lens")}</p>
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
    <OutgoingLieu />
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
    <Why on={placeRun === "running"} text={t("why.running")} />
    <div className="u-photos is-wide" aria-label={t("scene.stills")}>
      {Array.from({ length: SCENE_STILLS_MAX }, (_, index) => {
        const path = scene.stills[index];
        return <PictureSlot key={path ?? `still-${index}`} index={index} url={path ? media[path] : undefined} label={t("look.still")} onAdd={files => void addSceneStills(scene.id, files)} onRemove={path ? () => void removeSceneStill(scene.id, path) : undefined} />;
      })}
    </div>
    </details>
    <button type="button" className="u-link u-muted" disabled={!dirty} onClick={() => void resetScene()}>{t("scene.reset")}</button>
    <Why on={!dirty} text={t("why.unchanged")} />
    <p className="u-small">{t("scene.resetStay")}</p>
    <button type="button" className="u-link u-muted" onClick={() => void deleteScene(scene.id)}>{t("scene.remove")}</button>
  </div>;
}

