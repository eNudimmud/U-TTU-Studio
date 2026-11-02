"use client";

import { useEffect } from "react";
import { assetPath } from "@/lib/site";
import type { LookCopy } from "@/lib/look/copy";

const TABS = ["storyboard", "cast", "places", "shots", "look"] as const;

const HREF: Record<(typeof TABS)[number], string> = {
  storyboard: "/storyboard?storyboard=u11",
  cast: "/studio#personnage",
  places: "/studio#scene",
  shots: "/studio#prise",
  look: "/look",
};

export function ProjectBar({ copy, name, current }: { copy: LookCopy; name: string; current: (typeof TABS)[number] }) {
  useEffect(() => {
    document.querySelector<HTMLElement>('.look-tab[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [current]);
  return <header className="look-top">
    <div className="look-bar">
      <a className="look-logo" href={assetPath("/")}>
        <img src={assetPath("/brand/uttu-mark-h64.webp")} alt="" width={56} height={56} />
        <span>U<b>*</b>TTU</span>
      </a>
      <span className="look-crumb">· {name || copy.crumbFallback}</span>
      <span className="look-sp" />
      <a className="look-ghost" href={assetPath("/storyboard")}>{copy.boards}</a>
    </div>
    <nav className="look-tabs" aria-label={copy.tabs.look}>
      {TABS.map(id => <a key={id} className="look-tab" href={assetPath(HREF[id])} aria-current={current === id ? "page" : undefined}>
        {copy.tabs[id]}
        {id === "look" && <span className="look-badge">{copy.badge}</span>}
      </a>)}
    </nav>
  </header>;
}

export function Em({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return <>{parts.map((part, index) => part.startsWith("*") ? <em key={index}>{part.slice(1, -1)}</em> : <span key={index}>{part}</span>)}</>;
}
