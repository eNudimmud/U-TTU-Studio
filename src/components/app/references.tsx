"use client";

import { useId, useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { casesVisibles, ROLES, type Geste, type RoleRef } from "@/lib/workflows/registre";
import { Close, Plus } from "./glyphs";

export interface LocalRef {
  id: string;
  role: RoleRef;
  name: string;
  url: string;
  file: File | null;
  assetId: string | null;
  /** Which drawn box holds this reference. */
  caseId?: string;
}

export interface DroppedAsset {
  id: string;
  name: string;
  url: string;
  kind?: string;
}

export function readDroppedAsset(transfer: DataTransfer): DroppedAsset | null {
  const raw = transfer.getData("application/x-uttu-asset-json");
  if (!raw) return null;
  try {
    const asset = JSON.parse(raw) as DroppedAsset;
    if (!asset || typeof asset.id !== "string") return null;
    return asset;
  } catch {
    return null;
  }
}

export function ReferenceZone({ refs, onChange, gallery, defaultRole = "visage" }: {
  refs: LocalRef[];
  onChange(next: LocalRef[]): void;
  gallery?: { id: string; name: string; url: string; role: RoleRef }[];
  defaultRole?: RoleRef;
}) {
  const { t } = useI18n();
  const inputId = useId();
  const cameraId = useId();
  const listId = useId();

  function addFiles(list: File[], role: RoleRef = defaultRole) {
    const next = list.filter(file => file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/"));
    if (next.length === 0) return;
    onChange([...refs, ...next.map(file => ({
      id: `ref-${crypto.randomUUID()}`,
      role,
      name: file.name,
      url: URL.createObjectURL(file),
      file,
      assetId: null,
    }))]);
  }

  return <div className="u-refs">
    <p className="u-label" id={listId}>{t("refs.title")}</p>
    <p className="u-small">{t("refs.lead")}</p>
    <div
      className="u-refs-drop"
      onDragOver={event => { event.preventDefault(); }}
      onDrop={event => {
        event.preventDefault();
        const asset = event.dataTransfer.getData("application/x-uttu-asset");
        const found = gallery?.find(item => item.id === asset);
        if (found) {
          onChange([...refs, { id: `ref-${found.id}-${refs.length}`, role: found.role, name: found.name, url: found.url, file: null, assetId: found.id }]);
          return;
        }
        addFiles([...event.dataTransfer.files]);
      }}
    >
      <div className="u-refs-actions">
        <label className="u-secondary" htmlFor={inputId}>{t("refs.drop")}</label>
        <input id={inputId} className="sr-only" type="file" accept="image/*,video/*,audio/*" multiple onChange={event => { addFiles([...(event.target.files ?? [])]); event.target.value = ""; }} />
        <label className="u-secondary" htmlFor={cameraId}>{t("refs.camera")}</label>
        <input id={cameraId} className="sr-only" type="file" accept="image/*" capture="environment" onChange={event => { addFiles([...(event.target.files ?? [])]); event.target.value = ""; }} />
      </div>
    </div>
    {refs.length === 0 ? <p className="u-small">{t("refs.empty")}</p> : <ul className="u-refs-list" aria-labelledby={listId}>
      {refs.map(ref => <li key={ref.id}>
        {ref.url && ref.file?.type.startsWith("video/") ? <video src={ref.url} muted playsInline /> : ref.url ? <img src={ref.url} alt="" /> : <span className="u-card-blank" />}
        <span>{ref.name}</span>
        <label>
          <span className="sr-only">{t("refs.role")}</span>
          <select value={ref.role} onChange={event => onChange(refs.map(item => item.id === ref.id ? { ...item, role: event.target.value as RoleRef } : item))}>
            {ROLES.map(role => <option key={role} value={role}>{t(`refs.${role}`)}</option>)}
          </select>
        </label>
        <button type="button" className="u-link" onClick={() => onChange(refs.filter(item => item.id !== ref.id))}>{t("refs.remove")}</button>
      </li>)}
    </ul>}
  </div>;
}

export function SlotBoard({ geste, refs, onChange, onGallery }: {
  geste: Geste;
  refs: LocalRef[];
  onChange(next: LocalRef[]): void;
  onGallery?(): void;
}) {
  const { t } = useI18n();
  const base = useId();
  const [menu, setMenu] = useState<string | null>(null);
  const cases = casesVisibles(geste);
  if (cases.length === 0) return null;

  function write(caseId: string, role: RoleRef, next: { name: string; url: string; file: File | null; assetId: string | null }) {
    onChange([
      ...refs.filter(item => item.caseId !== caseId),
      { id: `ref-${caseId}`, role, caseId, ...next },
    ]);
    setMenu(null);
  }

  function addFile(caseId: string, role: RoleRef, file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    write(caseId, role, { name: file.name, url: URL.createObjectURL(file), file, assetId: null });
  }

  return <div className="u-slots">
    <div className="u-refslots">
      {cases.map(item => {
        const filled = refs.find(ref => ref.caseId === item.id) ?? null;
        const inputId = `${base}-${item.id}-file`;
        const cameraId = `${base}-${item.id}-cam`;
        return <div
          key={item.id}
          className="u-refslot"
          data-filled={filled ? "true" : undefined}
          data-slot={item.id}
          onDragOver={event => event.preventDefault()}
          onDrop={event => {
            event.preventDefault();
            const asset = readDroppedAsset(event.dataTransfer);
            if (asset) {
              write(item.id, item.role, { name: asset.name, url: asset.url, file: null, assetId: asset.id });
              return;
            }
            addFile(item.id, item.role, event.dataTransfer.files[0]);
          }}
        >
          {filled?.url ? <img src={filled.url} alt="" /> : <button type="button" className="u-refslot-add" aria-expanded={menu === item.id} aria-label={t(`refs.${item.role}`)} onClick={() => setMenu(current => current === item.id ? null : item.id)}>
            <Plus />
            <span>{t(`refs.${item.role}`)}</span>
          </button>}
          {filled && <button type="button" className="u-refslot-x" aria-label={t("refs.remove")} onClick={() => onChange(refs.filter(ref => ref.caseId !== item.id))}><Close /></button>}
          {!filled && menu === item.id && <div className="u-refslot-menu" role="menu">
            <label htmlFor={inputId}>{t("refs.drop")}</label>
            <input id={inputId} className="sr-only" type="file" accept="image/*" onChange={event => { addFile(item.id, item.role, event.target.files?.[0]); event.target.value = ""; }} />
            <label htmlFor={cameraId}>{t("refs.camera")}</label>
            <input id={cameraId} className="sr-only" type="file" accept="image/*" capture="environment" onChange={event => { addFile(item.id, item.role, event.target.files?.[0]); event.target.value = ""; }} />
            <button type="button" onClick={() => { setMenu(null); onGallery?.(); }}>{t("refs.gallery")}</button>
          </div>}
        </div>;
      })}
    </div>
    <p className="u-small u-refslot-help">{t("refs.help")}</p>
  </div>;
}
