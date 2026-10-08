"use client";

import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { LOOK_PHOTOS_MAX, cleanTraits, lookCheck, parseTraits, type LookCheck } from "@/lib/coffre/model";
import { offeredName, plainEnter, readLookNameCleared, writeLookNameCleared } from "@/lib/ergonomie";
import { useI18n } from "@/components/i18n/provider";
import { Why } from "./guide-bubble";
import { Arrow, Close } from "./glyphs";
import { PictureSlot } from "./slots";
import { useStudio } from "./studio-context";

function lookGap(t: ReturnType<typeof useI18n>["t"], parts: (string | false)[]): string {
  const missing = parts.filter((part): part is string => Boolean(part));
  if (missing.length === 0) return "";
  if (missing.length === 1) return t("look.missingOne", { what: missing[0] });
  return t("look.missingMany", { list: missing.slice(0, -1).join(", "), last: missing[missing.length - 1] });
}

/** Focus the first missing reference, or leave for the scene when photos and a name hold. */
export function completeLook(check: { photos: boolean; name: boolean }, onReady: () => void) {
  if (!check.photos) document.querySelector<HTMLElement>(".u-photos input")?.focus();
  else if (!check.name) document.getElementById("u-look-name")?.focus();
  else onReady();
}

/**
 * Photos, a name already written, two traits that do not block.
 * The form is the first column. The gold button is the second, so Enter in the name runs it.
 */
export function LookForm({ onReady }: { onReady(): void }) {
  const { studio, saveLook, resetLook } = useStudio();
  const { t } = useI18n();
  const offered = t("look.defaultName");
  const [cleared, setCleared] = useState(false);
  useEffect(() => {
    setCleared(readLookNameCleared(window.localStorage, studio.project));
  }, [studio.look.name, studio.project]);
  const name = offeredName(studio.look.name, offered, cleared);
  const check = lookCheck({ ...studio.look, name });
  const showingOffer = !cleared && !studio.look.name.trim();
  const pristine = showingOffer && studio.look.traits.length === 0 && studio.look.photos.length === 0 && !studio.look.note.trim();

  async function commit(): Promise<LookCheck> {
    const next = name.trim();
    if (studio.project && next) writeLookNameCleared(window.localStorage, studio.project, false);
    if (next && studio.look.name !== next) await saveLook({ name: next });
    setCleared(false);
    return lookCheck({ ...studio.look, name: next });
  }

  async function go(event?: FormEvent) {
    event?.preventDefault();
    completeLook(await commit(), onReady);
  }

  function onName(value: string) {
    const next = value.slice(0, 40);
    const empty = !next.trim();
    writeLookNameCleared(window.localStorage, studio.project, empty);
    setCleared(empty);
    void saveLook({ name: next });
  }

  function onReset() {
    writeLookNameCleared(window.localStorage, studio.project, false);
    setCleared(false);
    void resetLook();
  }

  return <>
    <form id="u-look-form" className="u-stack" onSubmit={event => void go(event)}>
      <LookFields name={name} offered={offered} check={check} pristine={pristine} onName={onName} onReset={onReset} />
    </form>
    <div className="u-stack">
      <button type="submit" form="u-look-form" className="u-primary" data-look-gold="" aria-describedby={check.ready ? undefined : "u-look-gap"}>{check.ready ? t("verb.setScene") : t("look.complete")} <Arrow /></button>
      {!check.ready && <p className="u-small" id="u-look-gap">{lookGap(t, [!check.photos && t("look.gapPhotos"), !check.name && t("look.gapName")])}</p>}
    </div>
  </>;
}

function LookFields({ name, offered, check, pristine, onName, onReset }: {
  name: string;
  offered: string;
  check: LookCheck;
  pristine: boolean;
  onName(value: string): void;
  onReset(): void;
}) {
  const { studio, media, saveLook, addLookPhotos, removeLookPhoto } = useStudio();
  const { t } = useI18n();
  const look = studio.look;
  const [trait, setTrait] = useState("");

  function addTrait(raw: string) {
    const added = parseTraits(raw);
    if (added.length) void saveLook({ traits: cleanTraits([...look.traits, ...added]) });
    setTrait("");
  }

  function onTraitKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !trait.trim() && plainEnter(event)) return;
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTrait(trait);
    } else if (event.key === "Backspace" && !trait && look.traits.length) {
      void saveLook({ traits: look.traits.slice(0, -1) });
    }
  }

  return <>
    <div className="u-photos" aria-label={t("look.photos")}>
      {Array.from({ length: LOOK_PHOTOS_MAX }, (_, index) => {
        const path = look.photos[index];
        return <PictureSlot key={path ?? `empty-${index}`} index={index} url={path ? media[path] : undefined} label={t("look.photo")} onAdd={files => void addLookPhotos(files)} onRemove={path ? () => void removeLookPhoto(path) : undefined} />;
      })}
    </div>
    <label className="u-field">
      <span className="u-label">{t("look.name")}</span>
      <input id="u-look-name" value={name} maxLength={40} autoComplete="off" enterKeyHint="go" onChange={event => onName(event.target.value)} />
    </label>
    {name.trim() === offered && <p className="u-small">{t("look.written")}</p>}
    <div className="u-field">
      <label className="u-label" htmlFor="u-trait">{t("look.traits")}</label>
      <div className="u-chips">
        {look.traits.map(item => <button key={item} type="button" className="u-chip" onClick={() => void saveLook({ traits: look.traits.filter(other => other !== item) })} aria-label={t("look.removeTrait", { item })}>{item}<Close /></button>)}
        <input id="u-trait" value={trait} placeholder={look.traits.length ? t("look.another") : t("look.placeholder")} onChange={event => setTrait(event.target.value)} onKeyDown={onTraitKey} onBlur={() => trait.trim() && addTrait(trait)} enterKeyHint="done" />
      </div>
      {look.traits.length < 2 && <p className="u-small">{t("look.traitsOptional")}</p>}
    </div>
    <ol className="u-marks" aria-label={t("look.held")}>
      <li data-held={check.photos}>{t("look.twoPhotos")}</li>
      <li data-held={check.name}>{t("look.aName")}</li>
      <li data-held={check.traits}>{t("look.twoTraits")}</li>
    </ol>
    <button type="button" className="u-link u-muted" disabled={pristine} aria-describedby={pristine ? "u-why-look-reset" : undefined} onClick={onReset}>{t("look.reset")}</button>
    <Why on={pristine} id="u-why-look-reset" text={t("why.unchanged")} />
    <p className="u-small">{t("look.stay")}</p>
  </>;
}
