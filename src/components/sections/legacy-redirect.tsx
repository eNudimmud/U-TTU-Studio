"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
const STEPS: Record<string,string> = { cast:"cast",personnage:"cast",personnages:"cast",decor:"set",scene:"set",prise:"shoot",montage:"edit",finaliser:"finish",set:"set",shoot:"shoot",edit:"edit",finish:"finish" };
export function LegacyStudioRedirect() {
  const router = useRouter();
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const raw = window.location.hash.slice(1) || query.get("step") || "cast";
    if (["credits","bibliotheque","outils","reglages"].includes(raw)) router.replace(`/studio/legacy${window.location.search}${window.location.hash}`);
    else router.replace(`/studio/cinema/${STEPS[raw] || "cast"}`);
  },[router]);
  return <main id="contenu"><p>Ouverture du studio…</p><a href="/studio/cinema/cast">Ouvrir CINEMA</a></main>;
}
