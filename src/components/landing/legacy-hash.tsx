"use client";

import { useEffect } from "react";
import { ACCOUNT_PATH } from "@/lib/account";
import { assetPath } from "@/lib/site";

const STUDIO_HASHES = new Set(["creer", "look", "sphere", "sphère", "identite", "identité", "bibliotheque", "bibliothèque", "studio", "plateau", "scene", "scène", "take", "prise"]);

/** Old Clerk and bookmark hashes lived on `/`. Send them to the studio, or to the account page. */
export function LegacyStudioHash() {
  useEffect(() => {
    const go = () => {
      const hash = window.location.hash;
      if (!hash || hash === "#") return;
      const raw = decodeURIComponent(hash.replace(/^#/, "").split(/[?&]/)[0]).trim().toLowerCase();
      if (raw === "compte") window.location.replace(assetPath(ACCOUNT_PATH));
      else if (STUDIO_HASHES.has(raw)) window.location.replace(`${assetPath("/studio")}${hash}`);
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);
  return null;
}
