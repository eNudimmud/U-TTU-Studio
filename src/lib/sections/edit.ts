import type { Edit, VideoClip } from "../montage/edit.ts";
import type { ProductionAsset } from "./model.ts";
import type { Section } from "./registry.ts";
export function keptClip(asset: ProductionAsset): VideoClip {
  if (
    asset.kind !== "take" ||
    !asset.kept ||
    (asset.media !== "video" && asset.media !== "image")
  )
    throw new Error("Choisis d’abord une prise gardée dans Shoot.");
  return {
    id: asset.id,
    kind: asset.media,
    source: asset.finalPath || asset.path,
    label: asset.name,
    media: asset.seconds || 4,
    start: 0,
    end: asset.seconds || 4,
    takeId: asset.id,
  };
}
/** Recheck at export: a changed kept take must never silently export an old discarded take. */
export function validateCut(
  edit: Edit,
  assets: ProductionAsset[],
  section: Section,
): void {
  if (!edit.video.length)
    throw new Error("Ajoute une prise gardée au montage.");
  for (const clip of edit.video) {
    const asset = assets.find(
      (a) =>
        a.id === clip.takeId &&
        a.section === section &&
        a.kept &&
        a.kind === "take",
    );
    if (!asset || ![asset.path, asset.finalPath].includes(clip.source || ""))
      throw new Error(
        "Une prise du montage n’est plus gardée. Remplace-la par la nouvelle sélection.",
      );
    if (
      !(
        Number.isFinite(clip.start) &&
        Number.isFinite(clip.end) &&
        clip.start >= 0 &&
        clip.end > clip.start &&
        clip.end <= (asset.seconds || 4)
      )
    )
      throw new Error("La coupe dépasse la durée de sa prise.");
  }
}
