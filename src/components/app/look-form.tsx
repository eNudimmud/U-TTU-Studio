"use client";

import { useState, type KeyboardEvent } from "react";
import { LOOK_PHOTOS_MAX, cleanTraits, lookCheck, parseTraits } from "@/lib/coffre/model";
import { useI18n } from "@/components/i18n/provider";
import { Why } from "./guide-bubble";
import { Close } from "./glyphs";
import { PictureSlot } from "./slots";
import { useStudio } from "./studio-context";

function lookGap(t: ReturnType<typeof useI18n>["t"], parts: (string | false)[]): string {
  const missing = parts.filter((part): part is string => Boolean(part));
  if (missing.length === 0) return "";
  if (missing.length === 1) return t("look.missingOne", { what: missing[0] });
  return t("look.missingMany", { list: missing.slice(0, -1).join(", "), last: missing[missing.length - 1] });
}

/** Focus the first missing reference, or leave for the scene when the three hold. */
export function completeLook(check: { photos: boolean; name: boolean; traits: boolean }, onReady: () => void) {
  if (!check.photos) document.querySelector<HTMLElement>(".u-photos input")?.focus();
  else if (!check.name) document.getElementById("u-look-name")?.focus();
  else if (!check.traits) document.getElementById("u-trait")?.focus();
  else onReady();
}

/** Photos, a name, two traits. The gold button stays with the screen that hosts this form. */
export function LookFields() {
  const { studio, media, saveLook, addLookPhotos, removeLookPhoto, resetLook } = useStudio();
  const { t } = useI18n();
  const look = studio.look;
  const check = lookCheck(look);
  const [trait, setTrait] = useState("");
  const dirty = Boolean(look.name || look.note || look.traits.length || look.photos.length);

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

  return <div className="u-stack">
    <div className="u-photos" aria-label={t("look.photos")}>
      {Array.from({ length: LOOK_PHOTOS_MAX }, (_, index) => {
        const path = look.photos[index];
        return <PictureSlot key={path ?? `empty-${index}`} index={index} url={path ? media[path] : undefined} label={t("look.photo")} onAdd={files => void addLookPhotos(files)} onRemove={path ? () => void removeLookPhoto(path) : undefined} />;
      })}
    </div>
    <label className="u-field">
      <span className="u-label">{t("look.name")}</span>
      <input id="u-look-name" value={look.name} maxLength={40} placeholder="Mira" autoComplete="off" onChange={event => void saveLook({ name: event.target.value.slice(0, 40) })} />
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
    <button type="button" className="u-link u-muted" disabled={!dirty} onClick={() => void resetLook()}>{t("look.reset")}</button>
    <Why on={!dirty} text={t("why.unchanged")} />
    <p className="u-small">{t("look.stay")}</p>
    {!check.ready && <p className="u-small">{lookGap(t, [!check.photos && t("look.gapPhotos"), !check.name && t("look.gapName"), !check.traits && t("look.gapTraits")])}</p>}
  </div>;
}
