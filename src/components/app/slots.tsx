"use client";

import { useI18n } from "@/components/i18n/provider";
import { Close, Plus } from "./glyphs";

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


export function Segments<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange(value: T): void }) {
  return <fieldset className="u-segments">
    <legend className="u-label">{label}</legend>
    {options.map(option => <button key={String(option.value)} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
  </fieldset>;
}

