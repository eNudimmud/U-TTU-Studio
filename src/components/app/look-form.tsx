"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { LOOK_PHOTOS_MAX, cleanTraits, lookCheck, parseTraits } from "@/lib/coffre/model";
import { offeredName } from "@/lib/ergonomie";
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

/** Focus the first missing reference, or leave for the scene when photos and a name hold. */
export function completeLook(check: { photos: boolean; name: boolean }, onReady: () => void) {
  if (!check.photos) document.querySelector<HTMLElement>(".u-photos input")?.focus();
  else if (!check.name) document.getElementById("u-look-name")?.focus();
  else onReady();
}

/** Photos, a name already written, two traits that do not block. The host screen draws the gold button. */
export function LookDesk({ onNext, submit }: { onNext(): void; submit(ready: boolean): ReactNode }) {
  const { ready, studio, saveLook } = useStudio();
  const { t } = useI18n();
  const offered = t("look.defaultName");
  const [cleared, setCleared] = useState(false);
  const skip = useRef(false);
  const name = offeredName(studio.look.name, offered, cleared);
  const check = lookCheck({ ...studio.look, name });

  useEffect(() => {
    if (!ready || !studio.project || skip.current || studio.look.name.trim()) return;
    void saveLook({ name: offered });
  }, [offered, ready, saveLook, studio.look.name, studio.project]);

  async function go(event?: FormEvent) {
    event?.preventDefault();
    const nextName = name.trim();
    if (nextName && studio.look.name.trim() !== nextName) await saveLook({ name: nextName });
    completeLook(lookCheck({ ...studio.look, name: nextName }), onNext);
  }

  return <form id="u-look-form" className="u-stack" onSubmit={event => void go(event)}>
    <LookFields
      name={name}
      onName={value => {
        skip.current = true;
        setCleared(true);
        void saveLook({ name: value.slice(0, 40) });
      }}
      onReset={() => {
        skip.current = true;
        setCleared(true);
      }}
      beforePhotos={async () => {
        if (skip.current || studio.look.name.trim()) return;
        await saveLook({ name: offered });
      }}
      afterName={<>
        {submit(check.ready)}
        {!check.ready && <p className="u-small">{lookGap(t, [!check.photos && t("look.gapPhotos"), !check.name && t("look.gapName")])}</p>}
      </>}
    />
  </form>;
}

/** Photos, a name, two traits. The gold button stays with the screen that hosts this form. */
export function LookFields({ name, onName, onReset, beforePhotos, afterName = null }: {
  name: string;
  onName(value: string): void;
  onReset(): void;
  beforePhotos(): Promise<void>;
  afterName?: ReactNode;
}) {
  const { studio, media, saveLook, addLookPhotos, removeLookPhoto, resetLook } = useStudio();
  const { t } = useI18n();
  const look = studio.look;
  const check = lookCheck({ ...look, name });
  const [trait, setTrait] = useState("");
  const dirty = Boolean((look.name.trim() && look.name.trim() !== t("look.defaultName")) || look.note || look.traits.length || look.photos.length);

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
        return <PictureSlot key={path ?? `empty-${index}`} index={index} url={path ? media[path] : undefined} label={t("look.photo")} onAdd={files => void beforePhotos().then(() => addLookPhotos(files))} onRemove={path ? () => void removeLookPhoto(path) : undefined} />;
      })}
    </div>
    <label className="u-field">
      <span className="u-label">{t("look.name")}</span>
      <input id="u-look-name" value={name} maxLength={40} autoComplete="off" enterKeyHint="go" onChange={event => onName(event.target.value)} />
    </label>
    {name.trim() === t("look.defaultName") && <p className="u-small">{t("common.nameWritten")}</p>}
    {afterName}
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
    <button type="button" className="u-link u-muted" disabled={!dirty} onClick={() => { onReset(); void resetLook(); }}>{t("look.reset")}</button>
    <Why on={!dirty} text={t("why.unchanged")} />
    <p className="u-small">{t("look.stay")}</p>
  </div>;
}
