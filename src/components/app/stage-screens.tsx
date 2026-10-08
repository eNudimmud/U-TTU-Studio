"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LOOK_PHOTOS_MAX, ROLE_PHOTOS_MAX, isPlaceLora } from "@/lib/coffre/model";
import { offeredName, readLookNameCleared, writeLookNameCleared, nextNumberedName } from "@/lib/ergonomie";
import { formatCredits } from "@/lib/credits";
import { formatUsd } from "@/lib/fal/prices";
import { CAST_PHOTO_MAX, castReady, quotedCredits, priseNext } from "@/lib/stage";
import { assetPath } from "@/lib/site";
import { useI18n } from "@/components/i18n/provider";
import { Why } from "./guide-bubble";
import { Arrow, Plus, Web } from "./glyphs";
import { PublishActions } from "./publish";
import { SequencePlayer } from "./sheets";
import { PictureSlot } from "./slots";
import { useStudio } from "./studio-context";
import { TakeCostLines } from "./take-cost";

function useOfferedLookName() {
  const { studio } = useStudio();
  const { t } = useI18n();
  const [cleared, setCleared] = useState(false);
  useEffect(() => {
    setCleared(readLookNameCleared(window.localStorage, studio.project));
  }, [studio.look.name, studio.project]);
  const offered = t("look.defaultName");
  const name = offeredName(studio.look.name, offered, cleared);
  return { name, cleared, setCleared, offered };
}

export function CastStage({ onDecor }: { onDecor(): void }) {
  const studio = useStudio();
  const { t } = useI18n();
  const { studio: vault, media, saveLook, addLookPhotos, removeLookPhoto, saveRole, addRolePhotos, removeRolePhoto } = studio;
  const { name, setCleared } = useOfferedLookName();
  const [extra, setExtra] = useState(false);
  const people = vault.loras.filter(lora => !isPlaceLora(lora));
  const ready = castReady({ name, photos: vault.look.photos });
  const showExtra = extra || vault.role.name.trim().length > 0 || vault.role.photos.length > 0;
  const roleSlots = Math.max(LOOK_PHOTOS_MAX, Math.min(vault.role.photos.length, ROLE_PHOTOS_MAX));

  function onName(value: string) {
    const next = value.slice(0, 40);
    const empty = !next.trim();
    writeLookNameCleared(window.localStorage, vault.project, empty);
    setCleared(empty);
    void saveLook({ name: next });
  }

  async function pass() {
    const next = name.trim();
    if (vault.project && next) writeLookNameCleared(window.localStorage, vault.project, false);
    if (next && vault.look.name !== next) await saveLook({ name: next });
    setCleared(false);
    onDecor();
  }

  return <section className="u-screen u-stage" data-section="cast" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">01</p>
      <h1 id="u-title" tabIndex={-1}>{t("nav.character")}</h1>
      <p className="u-lead">{t("stage.castLead")}</p>
    </header>
    <div className="u-board">
      {vault.look.photos.length === 0 && <figure className="u-example">
        <img src={assetPath("/images/uttu-canon-portrait.webp")} alt={t("stage.exampleCastAlt")} />
        <figcaption>{t("stage.exampleCast")}</figcaption>
      </figure>}
      <article className="u-person">
        <div className="u-photos" aria-label={t("stage.photoRule")}>
          {Array.from({ length: LOOK_PHOTOS_MAX }, (_, index) => {
            const path = vault.look.photos[index];
            return <PictureSlot key={path ?? `cast-${index}`} index={index} url={path ? media[path] : undefined} label={t("look.photo")} onAdd={files => void addLookPhotos(files)} onRemove={path ? () => void removeLookPhoto(path) : undefined} />;
          })}
        </div>
        <label className="u-field">
          <span className="u-label">{t("stage.name")}</span>
          <input id="u-cast-name" value={name} maxLength={40} autoComplete="off" onChange={event => onName(event.target.value)} />
        </label>
      </article>
      {people.map(person => <article key={person.id} className="u-person u-person-file">
        <span className="u-scene-empty"><Web /></span>
        <strong>{person.name || t("common.character")}</strong>
        <p className="u-small">{t("stage.fileCharacter")}</p>
      </article>)}
      {showExtra && <article className="u-person">
        <div className="u-photos" aria-label={t("stage.addCharacter")}>
          {Array.from({ length: roleSlots }, (_, index) => {
            const path = vault.role.photos[index];
            return <PictureSlot key={path ?? `role-${index}`} index={index} url={path ? media[path] : undefined} label={t("look.photo")} onAdd={files => void addRolePhotos(files)} onRemove={path ? () => void removeRolePhoto(path) : undefined} />;
          })}
        </div>
        <label className="u-field">
          <span className="u-label">{t("stage.name")}</span>
          <input value={vault.role.name} maxLength={40} autoComplete="off" onChange={event => void saveRole({ name: event.target.value.slice(0, 40) })} />
        </label>
      </article>}
    </div>
    <button type="button" className="u-primary" data-cast-gold="" disabled={!ready} aria-describedby={!ready ? "u-why-cast" : undefined} onClick={() => void pass()}>
      {t("stage.passDecor")} <Arrow />
    </button>
    <Why on={!ready} id="u-why-cast" text={vault.look.photos.length < 2 ? t("stage.addPhotos") : vault.look.photos.length > CAST_PHOTO_MAX ? t("stage.photoRule") : t("why.needName")} />
    {!showExtra && <button type="button" className="u-link" onClick={() => setExtra(true)}>{t("stage.addCharacter")}</button>}
  </section>;
}

export function DecorStage({ onPrise }: { onPrise(): void }) {
  const { studio, scene, media, addScene, selectScene, addSceneStills } = useStudio();
  const { t } = useI18n();
  const suggested = nextNumberedName(t("scene.defaultName"), studio.scenes.map(item => item.name));
  const [draft, setDraft] = useState(suggested);
  const [adding, setAdding] = useState(false);
  useEffect(() => { setDraft(suggested); }, [suggested]);
  const posing = studio.scenes.length === 0 || adding;
  const blocked = posing && !draft.trim();

  function add(event: FormEvent) {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    void addScene(name).then(() => setAdding(false));
  }

  return <section className="u-screen u-stage" data-section="decor" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">02</p>
      <h1 id="u-title" tabIndex={-1}>{t("nav.scene")}</h1>
      <p className="u-lead">{t("stage.decorLead")}</p>
    </header>
    <div className="u-board">
      {studio.scenes.length === 0 && <figure className="u-example u-night">
        <figcaption>{t("stage.exampleDecor")}</figcaption>
      </figure>}
      {studio.scenes.map(item => {
        const still = item.render ?? item.stills[0];
        const selected = item.id === scene?.id;
        return <article key={item.id} className="u-place" data-selected={selected || undefined}>
          <button type="button" aria-pressed={selected} onClick={() => void selectScene(item.id)}>
            {still && media[still] ? <img src={media[still]} alt="" /> : <span className="u-scene-empty"><Web /></span>}
            <span>{item.name.trim() || t("common.unnamed")}</span>
          </button>
          {selected && item.stills.length < 2 && <label className="u-link">
            {t("stage.addPlacePhoto")}
            <input className="sr-only" type="file" accept="image/*" onChange={event => { void addSceneStills(item.id, [...(event.target.files ?? [])]); event.target.value = ""; }} />
          </label>}
        </article>;
      })}
    </div>
    {posing && <form id="u-decor-form" className="u-stack" onSubmit={add}>
      <label className="u-field">
        <span className="u-label">{t("stage.chooseDecor")}</span>
        <input id="u-decor-name" value={draft} maxLength={40} onChange={event => setDraft(event.target.value)} />
      </label>
    </form>}
    {studio.scenes.length > 0 && !adding && <button type="button" className="u-link" onClick={() => setAdding(true)}>{t("stage.addDecor")}</button>}
    <button
      type={posing ? "submit" : "button"}
      form={posing ? "u-decor-form" : undefined}
      className="u-primary"
      data-decor-gold=""
      disabled={blocked}
      aria-describedby={blocked ? "u-why-decor" : undefined}
      onClick={() => { if (!posing) onPrise(); }}
    >{posing ? t("stage.addDecor") : t("stage.passPrise")} <Arrow /></button>
    <Why on={blocked} id="u-why-decor" text={t("why.needName")} />
  </section>;
}

export function PriseStage({ goCast, goDecor }: { goCast(): void; goDecor(): void }) {
  const studioApi = useStudio();
  const { t, say } = useI18n();
  const {
    studio, media, scene, line, setLine, setSheet, engine, setEngine, chosenLora, setLora, selectScene,
    takeQuote, gate, connected, falLinked, loraQuote, requestRun, run, resetRun, resumeRun, cancelRun, poseTake, exportCoffre,
  } = studioApi;
  const { name } = useOfferedLookName();
  const readyCast = castReady({ name, photos: studio.look.photos });
  const people = studio.loras.filter(lora => !isPlaceLora(lora));
  const credits = engine === "comfy" ? quotedCredits(takeQuote) : null;
  const price = engine === "lora" && loraQuote !== null ? formatUsd(loraQuote) : credits !== null ? t("stage.aboutCredits", { amount: formatCredits(credits) }) : null;
  const account = engine === "lora" ? falLinked : connected;
  const canSpend = engine === "lora"
    ? Boolean(falLinked && chosenLora && gate.allowed && loraQuote !== null)
    : Boolean(connected && gate.allowed && credits !== null);
  const step = priseNext({ cast: readyCast, decor: Boolean(scene), line, connected: account, canSpend });
  const result = run.phase === "done" ? studio.takes.find(take => take.id === run.takeId) : undefined;
  const filed = result ? studio.sequences.find(item => item.links.some(link => link.takeId === result.id)) : undefined;
  const [reading, setReading] = useState(false);
  const lookPhoto = studio.look.photos[0];
  const missing = step === "cast" ? t("stage.missingPhotos") : step === "decor" ? t("stage.missingDecor") : step === "action" ? t("stage.missingAction") : step === "connect" ? (engine === "lora" ? t("stage.missingFal") : t("stage.missingConnect")) : step === "hold" ? (price ? t("stage.hold") : t("stage.noQuote")) : "";
  const gold = step === "cast" ? t("stage.goCast")
    : step === "decor" ? t("stage.goDecor")
    : step === "connect" ? (engine === "lora" ? t("stage.connectFal") : t("stage.connectComfy"))
    : price ? t("stage.generatePriced", { price }) : t("stage.generate");
  const blocked = step === "action" || step === "hold";

  function press() {
    if (step === "cast") goCast();
    else if (step === "decor") goDecor();
    else if (step === "connect") setSheet(engine === "lora" ? "fal" : "connect");
    else if (step === "generate") {
      const next = name.trim();
      const saved = next && studio.look.name !== next ? studioApi.saveLook({ name: next }) : Promise.resolve();
      void saved.then(() => requestRun());
    }
  }

  return <section className="u-screen u-stage" data-section="prise" aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">03</p>
      <h1 id="u-title" tabIndex={-1}>{t("nav.take")}</h1>
      <p className="u-lead">{t("stage.priseLead")}</p>
    </header>

    {run.phase === "running" && <div className="u-card u-run" role="status">
      <div className="u-thread" aria-hidden="true"><span /></div>
      <p className="u-run-label">{t("job.running")}</p>
      <button type="button" className="u-link" onClick={cancelRun}>{t("verb.cancel")}</button>
    </div>}

    {run.phase === "done" && result && media[result.video] && <div className="u-card u-result" data-retour-suite="">
      {filed ? <>
        <button type="button" className="u-primary" data-lire-sequence="" onClick={() => setReading(true)}>{t("sequence.play")} <Arrow /></button>
        <button type="button" className="u-link" onClick={() => void exportCoffre()}>{t("sheet.export")}</button>
        <button type="button" className="u-link" disabled aria-describedby="u-why-filed">{t("take.pose")}</button>
        <Why on id="u-why-filed" text={t("why.alreadyFiled", { name: filed.name || t("common.unnamed") })} />
        {reading && <SequencePlayer sequenceId={filed.id} />}
      </> : <button type="button" className="u-primary" onClick={() => void poseTake(result.id, { sequence: t("sequence.defaultName"), shot: t("shot.defaultName") })}>{t("take.pose")} <Arrow /></button>}
      <video src={media[result.video]} poster={result.poster ? media[result.poster] : undefined} controls muted playsInline className={`is-${result.settings.aspect}`} />
      <TakeCostLines take={result} gateLine={gate.line} />
      <PublishActions take={result} />
      <button type="button" className="u-link" onClick={resetRun}>{t("take.new")}</button>
    </div>}

    {run.phase === "error" && <div className="u-card u-soft-error" role="alert">
      <p>{say(run.message)}</p>
      <button type="button" className="u-primary" onClick={() => { if (run.code === "auth" || run.code === "scope") { resetRun(); setSheet("connect"); } else resumeRun(); }}>{run.code === "auth" || run.code === "scope" ? t("stage.connectComfy") : t("verb.resume")}</button>
    </div>}

    {run.phase === "idle" && <>
      {(step === "cast" || step === "decor") && <>
        <p className="u-small">{missing}</p>
        <button type="button" className="u-primary" data-prise-gold="" onClick={press}>{gold} <Arrow /></button>
      </>}
      <div className="u-prise-grid">
      {(!readyCast || !scene) && <figure className="u-example">
        <img src={assetPath("/images/uttu-canon-portrait.webp")} alt={t("stage.exampleCastAlt")} />
        <figcaption>{t("stage.examplePrise")}</figcaption>
      </figure>}
      <div className="u-stack">
      <div>
        <p className="u-label">{t("stage.who")}</p>
        <div className="u-pick-row">
          <button type="button" aria-pressed={engine !== "lora"} onClick={() => { setEngine("comfy"); setLora(""); }}>
            {lookPhoto && media[lookPhoto] ? <img src={media[lookPhoto]} alt="" /> : <span className="u-scene-empty"><Plus /></span>}
            <span>{name || t("common.character")}</span>
            <small>{t("stage.photosCharacter")}</small>
          </button>
          {people.map(person => <button key={person.id} type="button" aria-pressed={engine === "lora" && chosenLora?.id === person.id} onClick={() => { setEngine("lora"); setLora(person.id); }}>
            <span className="u-scene-empty"><Web /></span>
            <span>{person.name || t("common.character")}</span>
            <small>{t("stage.fileCharacter")}</small>
          </button>)}
        </div>
      </div>
      <div>
        <p className="u-label">{t("stage.where")}</p>
        <div className="u-pick-row">
          {studio.scenes.length === 0 && <p className="u-small">{t("stage.missingDecor")}</p>}
          {studio.scenes.map(item => {
            const still = item.render ?? item.stills[0];
            return <button key={item.id} type="button" aria-pressed={item.id === scene?.id} onClick={() => void selectScene(item.id)}>
              {still && media[still] ? <img src={media[still]} alt="" /> : <span className="u-scene-empty"><Web /></span>}
              <span>{item.name.trim() || t("common.unnamed")}</span>
            </button>;
          })}
        </div>
      </div>
      <label className="u-field">
        <span className="u-label">{t("stage.action")}</span>
        <textarea id="u-prise-phrase" value={line} rows={3} maxLength={240} onChange={event => setLine(event.target.value)} />
      </label>
      <p className={`u-cost is-${price ? "ok" : "block"}`}>{price ?? t("stage.noQuote")}</p>
      {step !== "cast" && step !== "decor" && <>
        <button type="button" className="u-primary" data-prise-gold="" disabled={blocked} aria-describedby={blocked ? "u-why-prise" : undefined} onClick={press}>{gold} <Arrow /></button>
        <Why on={blocked} id="u-why-prise" text={missing} />
      </>}
      </div>
      </div>
    </>}
  </section>;
}
