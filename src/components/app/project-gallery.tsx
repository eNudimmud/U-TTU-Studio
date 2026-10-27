"use client";

import { useEffect, useRef, useState } from "react";
import { assetFromCast, assetFromDecor, type AssetRecord } from "@/lib/creation/assets";
import { assetPath } from "@/lib/site";
import { studioTarget } from "@/lib/coffre/target";
import { cleanCardName } from "@/lib/creation/gallery";
import { useI18n } from "@/components/i18n/provider";
import { AssetGallery, type LibraryType } from "./asset-gallery";
import { useStudio } from "./studio-session";
import { UndoToast } from "./tool-shell";

function takeLabel(line: string, id: string, at: string): string {
  const cleaned = cleanCardName(line);
  if (cleaned) return cleaned;
  const when = at ? new Date(at) : null;
  if (when && !Number.isNaN(when.getTime())) {
    const stamp = `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
    return `Prise · ${stamp}`;
  }
  return id;
}

export function ProjectGallery({ onUseRef, defaultFilter = "tout", type, dense, sort, title }: {
  onUseRef?(asset: AssetRecord): void;
  type?: LibraryType;
  dense?: boolean;
  sort?: "recent" | "nom";
  title?: string;
  defaultFilter?: "tout" | "personnage" | "decor" | "plan" | "son" | "importe";
}) {
  const { t } = useI18n();
  const session = useStudio();
  const { cast, decor, media, studio, loose, pickCast, pickDecor, renameCast, renameDecor, duplicateCast, duplicateDecor, deleteCast, deleteDecor, deleteAsset, copyCastTo, copyDecorTo, importAssets, refreshStudio, holdRef, holdClip } = session;
  const [pending, setPending] = useState<AssetRecord | null>(null);
  const timer = useRef<number | null>(null);

  const pendingRef = useRef<AssetRecord | null>(null);
  pendingRef.current = pending;
  useEffect(() => () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      const asset = pendingRef.current;
      if (asset) {
        if (asset.kind === "personnage") void deleteCast(asset.id);
        else if (asset.kind === "decor") void deleteDecor(asset.id);
        else void deleteAsset(asset);
      }
    }
  }, [deleteAsset, deleteCast, deleteDecor]);

  const assets: AssetRecord[] = [
    ...cast.map(assetFromCast),
    ...decor.map(card => assetFromDecor(card)),
    ...studio.takes.map(take => ({
      id: take.id,
      kind: "plan" as const,
      name: takeLabel(take.line, take.id, take.at),
      at: take.at,
      prompt: take.prompt,
      geste: "prise-plan",
      template: "",
      refs: [],
      devis: take.announcedCredits,
      cout: take.costCredits,
      media: take.poster || take.video,
      note: "",
      preview: null,
      loose: false,
    })),
    ...loose,
  ].filter(asset => asset.id !== pending?.id);

  function commitDelete(asset: AssetRecord) {
    if (asset.kind === "personnage") void deleteCast(asset.id);
    else if (asset.kind === "decor") void deleteDecor(asset.id);
    else void deleteAsset(asset);
  }

  function scheduleDelete(asset: AssetRecord) {
    if (pending && timer.current) {
      window.clearTimeout(timer.current);
      commitDelete(pending);
    }
    setPending(asset);
    timer.current = window.setTimeout(() => {
      commitDelete(asset);
      setPending(null);
      timer.current = null;
    }, 8000);
  }

  function holdAsRef(asset: AssetRecord) {
    if (onUseRef) {
      onUseRef(asset);
      return;
    }
    const role = asset.kind === "decor" ? "lieu" as const : asset.kind === "personnage" ? "visage" as const : "style" as const;
    const url = asset.preview ? assetPath(asset.preview) : (asset.media && media[asset.media]) || "";
    holdRef({ id: `ref-${asset.id}`, role, name: asset.name, url, assetId: asset.preview ? null : asset.id });
    window.location.hash = role === "lieu" ? "scene" : "personnage";
  }

  const thumb = pending ? (pending.preview ? assetPath(pending.preview) : (pending.media && media[pending.media]) || "") : "";

  return <>
    <AssetGallery
      assets={assets}
      media={media}
      defaultFilter={defaultFilter}
      type={type}
      dense={dense}
      sort={sort}
      title={title}
      projects={studio.projects.filter(item => item.slug !== studio.project)}
      onRefresh={() => void refreshStudio()}
      onEmptyDecor={() => { window.location.hash = "scene"; }}
      onImport={files => void importAssets(files, defaultFilter === "personnage" || defaultFilter === "decor" ? defaultFilter : undefined)}
      onUseRef={holdAsRef}
      onPrise={asset => {
        if (!window.location.pathname.endsWith('/studio')) {
          window.location.href = assetPath(studioTarget(asset.kind === 'decor' ? 'lieu' : asset.kind === 'personnage' ? 'personnage' : 'prise', asset.id, studio.project));
          return;
        }
        if (asset.kind === "decor") void pickDecor(asset.id);
        else if (asset.kind === "personnage") void pickCast(asset.id);
        window.location.hash = "prise";
      }}
      onMontage={asset => {
        if (!window.location.pathname.endsWith('/studio')) {
          window.location.href = assetPath(studioTarget('asset', asset.id, studio.project));
          return;
        }
        const take = studio.takes.find(item => item.id === asset.id);
        const source = take?.video || asset.media;
        if (!source) return;
        holdClip({
          source,
          label: asset.name,
          kind: asset.kind === "son" ? "audio" : /\.(mp4|webm|mov)$/i.test(source) ? "video" : "image",
          seconds: take?.settings.seconds,
        });
        window.location.hash = "montage";
      }}
      onRename={(asset, name) => {
        if (asset.kind === "personnage") void renameCast(asset.id, name);
        if (asset.kind === "decor") void renameDecor(asset.id, name);
      }}
      onDuplicate={asset => {
        if (asset.kind === "personnage") void duplicateCast(asset.id);
        if (asset.kind === "decor") void duplicateDecor(asset.id);
      }}
      onDelete={scheduleDelete}
      onCopy={(asset, slug) => {
        if (asset.kind === "personnage") void copyCastTo(asset.id, slug);
        if (asset.kind === "decor") void copyDecorTo(asset.id, slug);
      }}
    />
    {pending && <UndoToast
      message={t("create.deleted", { name: pending.name })}
      thumb={thumb || undefined}
      onUndo={() => {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = null;
        setPending(null);
      }}
      onGone={() => {
        /* timeout already commits; toast dismiss after undo uses onGone from UndoToast click */
      }}
    />}
  </>;
}
