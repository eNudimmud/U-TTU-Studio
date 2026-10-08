"use client";

import { assetFromCast, assetFromDecor, type AssetRecord } from "@/lib/creation/assets";
import { assetPath } from "@/lib/site";
import { cleanCardName } from "@/lib/creation/gallery";
import { AssetGallery } from "./asset-gallery";
import { useStudio } from "./studio-session";

function sourceOf(asset: AssetRecord, media: Record<string, string>): string {
  if (asset.preview) return assetPath(asset.preview);
  return asset.media && media[asset.media] ? asset.media : "";
}

export function ProjectGallery({ onUseRef, defaultFilter = "tout" }: {
  onUseRef?(asset: AssetRecord): void;
  defaultFilter?: "tout" | "personnage" | "decor" | "plan" | "son" | "importe";
}) {
  const session = useStudio();
  const { cast, decor, media, studio, loose, pickCast, pickDecor, renameCast, renameDecor, duplicateCast, duplicateDecor, deleteCast, deleteDecor, copyCastTo, copyDecorTo, importAssets, refreshStudio, holdRef, holdClip } = session;
  const assets: AssetRecord[] = [
    ...cast.map(assetFromCast),
    ...decor.map(card => assetFromDecor(card)),
    ...studio.takes.map(take => ({
      id: take.id,
      kind: "plan" as const,
      name: cleanCardName(take.line) || take.id,
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
  ];

  function useRef(asset: AssetRecord) {
    if (onUseRef) {
      onUseRef(asset);
      return;
    }
    const role = asset.kind === "decor" ? "lieu" as const : asset.kind === "personnage" ? "visage" as const : "style" as const;
    const url = asset.preview ? assetPath(asset.preview) : (asset.media && media[asset.media]) || "";
    holdRef({ id: `ref-${asset.id}`, role, name: asset.name, url, assetId: asset.preview ? null : asset.id });
    window.location.hash = role === "lieu" ? "scene" : "personnage";
  }

  return <AssetGallery
    assets={assets}
    media={media}
    defaultFilter={defaultFilter}
    projects={studio.projects.filter(item => item.slug !== studio.project)}
    onRefresh={() => void refreshStudio()}
    onImport={files => void importAssets(files)}
    onUseRef={useRef}
    onPrise={asset => {
      if (asset.kind === "decor") void pickDecor(asset.id);
      else if (asset.kind === "personnage") void pickCast(asset.id);
      window.location.hash = "prise";
    }}
    onMontage={asset => {
      const source = asset.preview ? assetPath(asset.preview) : sourceOf(asset, media);
      if (!source) return;
      holdClip({
        source,
        label: asset.name,
        kind: asset.kind === "son" ? "audio" : asset.kind === "plan" ? "video" : "image",
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
    onDelete={asset => {
      if (asset.kind === "personnage") void deleteCast(asset.id);
      if (asset.kind === "decor") void deleteDecor(asset.id);
    }}
    onCopy={(asset, slug) => {
      if (asset.kind === "personnage") void copyCastTo(asset.id, slug);
      if (asset.kind === "decor") void copyDecorTo(asset.id, slug);
    }}
  />;
}
