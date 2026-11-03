"use client";

import { useLocaleSwitch } from "@/components/i18n/provider";
import { lookCopy } from "@/lib/look/copy";
import { assetPath } from "@/lib/site";
import { useProjectLook } from "./use-look";
import "./look.css";

/** The U1.1 plan chip. Renders nothing until this project has the anime look. */
export function AnimeLookPill() {
  const { locale } = useLocaleSwitch();
  const { doc } = useProjectLook();
  if (!doc.look) return null;
  const copy = lookCopy(locale);
  return <a className="anime-pill" href={assetPath("/look")} data-look-pill="">◆ {copy.tabs.look} · {copy.badge}</a>;
}
