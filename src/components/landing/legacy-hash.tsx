"use client";

import { useEffect } from "react";
import { assetPath } from "@/lib/site";

const STUDIO_HASHES = new Set(["creer", "look", "photos", "sphere", "sphère", "identite", "identité", "bibliotheque", "bibliothèque", "studio", "plateau", "scene", "scène", "take", "prise", "personnage", "lora", "role", "rôle", "former"]);

/** Old bookmark hashes lived on `/`. Send them to the studio. */
export function LegacyStudioHash() {
  useEffect(() => {
    const go = () => {
      const hash = window.location.hash;
      if (!hash || hash === "#") return;
      const raw = decodeURIComponent(hash.replace(/^#/, "").split(/[?&]/)[0]).trim().toLowerCase();
      if (raw === "compte") window.location.replace(assetPath("/studio"));
      else if (STUDIO_HASHES.has(raw)) window.location.replace(`${assetPath("/studio")}${hash}`);
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);
  return null;
}
