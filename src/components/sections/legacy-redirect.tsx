"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { legacyStudioDestination } from "@/lib/sections/navigation";
import {
  SECTIONS,
  sectionPath,
  isSection,
  type Section,
  type Step,
} from "@/lib/sections/registry";
import "./studio.css";
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
    let alive = true;
    const navigate = (tools: Record<string, Step> = {}) => {
      const destination = legacyStudioDestination(section, hash, query, tools);
      if (alive && destination) router.replace(destination);
    };
    if (hash.startsWith("#outils/") && !query) {
      void import("@/lib/sections/tools").then(({ sectionTools }) => {
        const tools: Record<string, Step> = {};
        for (const step of ["cast", "set", "shoot", "edit"] as const)
          for (const { tool } of sectionTools(step)) tools[tool.id] ??= step;
        navigate(tools);
      });
    } else navigate();
    return () => { alive = false; };
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
