"use client";

import { useEffect } from "react";
import { STUDIO_MODES } from "@/lib/studio-modes";
import { assetPath } from "@/lib/site";

const MODE_IDS = new Set<string>(STUDIO_MODES.map(mode => mode.id));
const MODE_ALIASES = new Set(["sphère", "identité", "bibliothèque"]);

/** Old Clerk and bookmark hashes lived on `/`. Send them to the studio shell. */
export function LegacyStudioHash() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash === "#") return;
    const raw = decodeURIComponent(hash.replace(/^#/, "").split(/[?&]/)[0]).trim().toLowerCase();
    if (!MODE_IDS.has(raw) && !MODE_ALIASES.has(raw)) return;
    window.location.replace(`${assetPath("/studio")}${hash}`);
  }, []);
  return null;
}
