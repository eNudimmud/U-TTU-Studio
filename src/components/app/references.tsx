"use client";

import { useId } from "react";
import { useI18n } from "@/components/i18n/provider";
import { ROLES, type RoleRef } from "@/lib/workflows/registre";

export interface LocalRef {
  id: string;
  role: RoleRef;
  name: string;
  url: string;
  file: File | null;
  assetId: string | null;
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
    {gallery && gallery.length > 0 && <details className="u-refs-gallery">
      <summary>{t("refs.gallery")}</summary>
      <div className="u-refs-pick">
        {gallery.map(item => <button key={item.id} type="button" onClick={() => onChange([...refs, { id: `ref-${item.id}-${refs.length}`, role: item.role, name: item.name, url: item.url, file: null, assetId: item.id }])}>
          {item.url ? <img src={item.url} alt="" /> : <span className="u-card-blank" />}
          <span>{item.name}</span>
        </button>)}
      </div>
    </details>}
  </div>;
}
