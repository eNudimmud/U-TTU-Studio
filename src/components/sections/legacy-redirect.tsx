"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tabFromLocation } from "@/lib/studio-route";
import {
  SECTIONS,
  sectionPath,
  isSection,
  type Section,
  type Step,
} from "@/lib/sections/registry";
import "./studio.css";
const stageForTab: Record<string, Step> = {
  lora: "cast",
  look: "cast",
  scene: "set",
  prise: "shoot",
  montage: "edit",
  finaliser: "finish",
};
export function LegacyStudioRedirect() {
  const router = useRouter();
  const [last, setLast] = useState<Section | null>(null);
  useEffect(() => {
    let section: Section = "cinema";
    try {
      const saved = localStorage.getItem("u-ttu-last-section");
      if (saved && isSection(saved)) {
        section = saved;
        setLast(saved);
      }
    } catch {}
    const hash = window.location.hash,
      query = window.location.search;
    if (!hash && !query) return;
    const tab = tabFromLocation(hash, query);
    if (hash.startsWith("#outils/")) {
      const id = decodeURIComponent(hash.slice(8));
      void import("@/lib/sections/tools").then(({ sectionTools }) => {
        for (const step of ["cast", "set", "shoot", "edit"] as const)
          if (sectionTools(step).some((item) => item.tool.id === id)) {
            router.replace(`${sectionPath(section, step)}/${id}`);
            return;
          }
        const primary: Record<string, Step> = {
          "img-klein": "cast",
          "img-qwen": "cast",
          "img-refs": "cast",
          "vid-ltx-image": "shoot",
          "vid-wan": "shoot",
          "ret-finaliser": "finish",
          "vid-finaliser": "finish",
        };
        router.replace(
          primary[id]
            ? sectionPath(section, primary[id])
            : `/studio/legacy${query}${hash}`,
        );
      });
    } else if (tab && stageForTab[tab])
      router.replace(sectionPath(section, stageForTab[tab]));
    else router.replace(`/studio/legacy${query}${hash}`);
  }, [router]);
  return (
    <div className="production-studio ps-cinema" lang="fr">
      <main id="contenu" className="ps-entry">
        <p className="ps-eyebrow">U*TTU STUDIO</p>
        <h1>Choisis ton univers.</h1>
        <div className="ps-entry-links">
          {SECTIONS.map((section) => (
            <Link href={sectionPath(section, "cast")} key={section}>
              <b>{section.toUpperCase()}</b>
              <small>
                {section === "cinema"
                  ? "Photographie, lumière et matières du réel."
                  : "Dessin, encre et décors peints."}
              </small>
            </Link>
          ))}
        </div>
        {last && (
          <Link href={sectionPath(last, "cast")}>
            Reprendre {last.toUpperCase()} →
          </Link>
        )}
      </main>
    </div>
  );
}
