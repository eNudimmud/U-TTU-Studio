"use client";

// Small shared pieces of the paper page: the 16:9 still of a shot and the reference avatars.

import { useMemo } from "react";
import { assetPath } from "@/lib/site";
import type { PlanSB, RefPlan } from "@/lib/storyboard/storyboard";
import { useStudio } from "../app/studio-session";
import type { Storyboards } from "./use-storyboards";

/** The picture of a reference already in the project, or "". */
export function useRefPicture() {
  const { studio: vault, media } = useStudio();
  return useMemo(() => (ref: RefPlan): string => {
    const url = (path: string | null | undefined, preview?: string | null) => preview ? assetPath(preview) : path && media[path] ? media[path]! : "";
    const key = ref.nom.trim().toLowerCase();
    if (ref.role === "qui") {
      const card = vault.cast.find(item => (ref.id && item.id === ref.id) || item.name.trim().toLowerCase() === key);
      return card ? url(card.sheet ?? card.photos[0], card.preview) : "";
    }
    if (ref.role === "ou") {
      const scene = vault.scenes.find(item => (ref.id && item.id === ref.id) || item.name.trim().toLowerCase() === key);
      return scene ? url(scene.render ?? scene.stills[0]) : "";
    }
    return "";
  }, [vault.cast, vault.scenes, media]);
}

export function ShotThumb({ plan, numero, data, kept, label }: { plan: PlanSB; numero?: number; data: Storyboards; kept?: string; label?: string }) {
  const { media } = useStudio();
  const picture = useRefPicture();
  const hit = data.priseDuPlan(plan);
  const poster = hit?.take?.poster ? media[hit.take.poster] ?? "" : "";
  const ref = plan.refs.find(item => item.role === "ou") ?? plan.refs.find(item => item.role === "qui");
  const fallback = ref ? picture(ref) : "";
  const src = poster || fallback;
  return <div className={`sb-thumb${poster ? "" : " is-todo"}`} aria-hidden={label ? undefined : true} aria-label={label}>
    {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span className="sb-thumb-ph">{plan.format === "portrait" ? "9:16" : "16:9"}</span>}
    {numero !== undefined && <span className="sb-n">{numero}</span>}
    {poster && kept && <span className="sb-star">{kept}</span>}
    <span className="sb-d">{plan.duree} s</span>
  </div>;
}

export function RefAvatars({ refs }: { refs: readonly RefPlan[] }) {
  const picture = useRefPicture();
  const shown = refs.filter(ref => ref.role === "qui" || ref.role === "ou").slice(0, 4);
  if (!shown.length) return null;
  return <span className="sb-refs" aria-hidden="true">
    {shown.map((ref, index) => {
      const src = picture(ref);
      return src ? <img key={index} src={src} alt="" /> : <span key={index} className={`sb-ph${ref.id ? "" : " is-new"}`}>{ref.nom.trim().slice(0, 1).toUpperCase() || "?"}</span>;
    })}
  </span>;
}
