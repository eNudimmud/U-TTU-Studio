"use client";

// One project chain on every studio page: Cast › Set › Shoot › Edit › Finish | Look | StoryWeave.

import { STORYBOARD_CLOSED } from "@/app/storyboard/closed";
import { useI18n } from "@/components/i18n/provider";
import { useProjectLook } from "@/components/look/use-look";
import { assetPath } from "@/lib/site";
import { TAB_HASH, type Tab } from "@/lib/studio-route";
import { BrandMark } from "@/components/brand";
import { SectionPill, type StudioSectionId } from "./section-pill";
import type { ReactNode } from "react";

export const CHAIN: { id: "lora" | "scene" | "prise" | "montage" | "finaliser"; key: "nav.character" | "nav.scene" | "nav.take" | "nav.edit" | "nav.finish" }[] = [
  { id: "lora", key: "nav.character" },
  { id: "scene", key: "nav.scene" },
  { id: "prise", key: "nav.take" },
  { id: "montage", key: "nav.edit" },
  { id: "finaliser", key: "nav.finish" },
];

const MenuIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>;

export type ChainId = (typeof CHAIN)[number]["id"];

export function ProjectChain({
  step,
  onStep,
  onMenu,
  onUttu,
  uttuOpen,
  project,
  ready,
}: {
  step?: string | null;
  onStep?(tab: Tab): void;
  onMenu?(): void;
  onUttu?(): void;
  uttuOpen?: boolean;
  project?: ReactNode;
  /** Filled stages. The word stays in the button (the reliability contract) without a second control. */
  ready?: Partial<Record<ChainId, boolean>>;
}) {
  const { t } = useI18n();
  const { doc } = useProjectLook();
  const anime = doc.look?.kind === "anime25d";
  const section: StudioSectionId = anime ? "anime" : "cinema";
  const go = (id: (typeof CHAIN)[number]["id"]) => {
    if (onStep) { onStep(id); return; }
    window.location.assign(assetPath(`/studio#${TAB_HASH[id]}`));
  };
  return <nav className="u-chain u-steps" aria-label={t("nav.chain")} data-film-nav="">
    <a className="u-step-mini" href={assetPath("/")} aria-label={t("landing.home")}><BrandMark desktop={56} /></a>
    {project && <span className="u-step-proj">{project}</span>}
    {CHAIN.map((item, index) => <span key={item.id} className="u-step-pair">
      {index > 0 && <span className="u-step-arrow" aria-hidden="true">›</span>}
      <button type="button" className="u-step" data-film-nav-to={item.id} data-state={ready?.[item.id] ? "pret" : "vide"} aria-current={step === item.id ? "page" : undefined} onClick={() => go(item.id)}>
        <i>{index + 1}</i><span>{t(item.key)}</span>
        <small className="sr-only">{t(ready?.[item.id] ? "stage.ready" : "stage.empty")}</small>
      </button>
    </span>)}
    <span className="u-step-div" aria-hidden="true" />
    <SectionPill active={section} sections={{
      cinema: { href: "/studio/cgi", label: t("chrome.lookStandard") },
      anime: { href: "/anime", label: t("chrome.look") },
    }} />
    {/* A closed StoryWeave is not a step: the landing announces it, the bar stays for working. */}
    {!STORYBOARD_CLOSED && <a className="u-step-soon" href={assetPath("/storyboard?storyboard=sw")} data-chain-weave="open">{t("chrome.storyweave")}</a>}
    <span className="u-step-tail">
      <button type="button" className="u-top-icon" data-chain-menu="" aria-label={t("chrome.menuAria")} onClick={onMenu}><MenuIcon /></button>
      <button type="button" className="u-uttu u-uttu-face" data-chain-uttu="" aria-expanded={uttuOpen ? true : false} aria-label={t("uttu.openAria")} onClick={onUttu}>
        <img src={assetPath("/images/uttu-portrait.webp")} alt="" width={34} height={34} />
      </button>
    </span>
  </nav>;
}
