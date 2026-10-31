"use client";

// The studio's persistent way around, on every studio page:
// - from 768 px, a left rail: search, the five tool families with their counts, « Repérer un lieu »,
//   « Réaliser un film », « Mes créations », and the « Propulsé par ComfyUI » badge. Icons only up
//   to 1279 px, icons and names from 1280 px.
// - below 768 px, a bottom bar: Accueil · Créer · Film · Mes créations. The account menu and the
//   drawer stay in the top bar.

import { useEffect, useMemo } from "react";
import { assetPath } from "@/lib/site";
import { FAMILLES, familleVitrine, outilsPublics, type Famille } from "@/lib/outils/catalogue";
import { REPERAGE_ID } from "@/lib/outils/vignettes";
import { OUTILS_HORS_CATALOGUE } from "@/lib/outils/nombre";
import { useI18n } from "@/components/i18n/provider";
import { PoweredBy, ComfyLogomark } from "@/components/powered-by";
import { useStudio } from "./studio-session";
import type { Place } from "./top-bar";

const ICON = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const FamilyIcon = ({ fam }: { fam: Famille | "reperage" | "film" | "creations" | "home" | "search" }) => {
  switch (fam) {
    case "creer": return <svg {...ICON}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="m3.5 16 5-5 4 4 3-3 5 5" /><circle cx="15.5" cy="9" r="1.5" /></svg>;
    case "retoucher": return <svg {...ICON}><path d="M4 20 15 9" /><path d="m14 5 1-2 1 2 2 1-2 1-1 2-1-2-2-1z" /><path d="m19 12 .6-1.2L21 10l-1.4-.8L19 8l-.6 1.2L17 10l1.4.8z" /></svg>;
    case "video": return <svg {...ICON}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></svg>;
    case "3d": return <svg {...ICON}><path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></svg>;
    case "son": return <svg {...ICON}><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" /></svg>;
    case "reperage": return <svg {...ICON}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></svg>;
    case "film": return <svg {...ICON}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4" /></svg>;
    case "creations": return <svg {...ICON}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>;
    case "home": return <svg {...ICON}><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" /></svg>;
    case "search": return <svg {...ICON}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>;
  }
};

const FAMILY_KEY = "u-ttu-famille";

/** Scrolls the entry to one family; used when the rail opens the entry from another page. */
export function scrollToFamily(fam: string | null = null) {
  let wanted = fam;
  if (!wanted) {
    try { wanted = sessionStorage.getItem(FAMILY_KEY); sessionStorage.removeItem(FAMILY_KEY); } catch { wanted = null; }
  }
  if (!wanted) return false;
  const target = document.querySelector<HTMLElement>(`[data-outils-section="${wanted}"]`);
  if (!target) return false;
  target.scrollIntoView({ block: "start", behavior: "instant" });
  target.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  return true;
}

/** Opens « Tous les outils » on one family (the bar's « + › Son » uses it). */
export function openFamily(fam: string) {
  try { sessionStorage.setItem(FAMILY_KEY, fam); } catch { /* the list still opens */ }
  const hash = "#outils/tous";
  if (window.location.hash !== hash) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

function pickFamily(event: React.MouseEvent, fam: string) {
  if (scrollToFamily(fam)) { event.preventDefault(); return; }
  try { sessionStorage.setItem(FAMILY_KEY, fam); } catch { /* the entry still opens */ }
}

/** Keeps --u-top-h equal to the top bar's real height, so the rail always starts under it. */
export function useTopHeight() {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(".u-top");
    if (!bar) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--u-top-h", `${Math.round(bar.getBoundingClientRect().height)}px`);
    set();
    const watch = new ResizeObserver(set);
    watch.observe(bar);
    return () => watch.disconnect();
  }, []);
}

function useCounts() {
  const { prefs } = useStudio();
  return useMemo(() => {
    const counts = Object.fromEntries(FAMILLES.map(fam => [fam, 0])) as Record<Famille, number>;
    for (const item of outilsPublics(prefs)) counts[familleVitrine(item)] += 1;
    counts["3d"] += OUTILS_HORS_CATALOGUE; // « Maquette 3D et cadrage » and « Repérer un lieu » sit in the 3D row.
    return counts;
  }, [prefs]);
}

export function StudioRail({ place, onSearch }: { place: Place; onSearch(): void }) {
  const { t } = useI18n();
  const counts = useCounts();
  const total = FAMILLES.reduce((sum, fam) => sum + counts[fam], 0);
  return <aside className="u-rail" aria-label={t("nav.rail")} data-rail="">
    <button type="button" className="u-rail-item u-rail-search" onClick={onSearch} data-rail-search="" aria-label={t("outils.search")}>
      <FamilyIcon fam="search" /><span className="u-rail-name">{t("outils.search")}</span>
    </button>
    <p className="u-rail-head eyebrow" aria-hidden="true">{t("outils.count", { n: String(total) })}</p>
    <ul role="list" className="u-rail-list">
      {FAMILLES.map(fam => <li key={fam}>
        <a className="u-rail-item" href={assetPath("/studio#outils/tous")} data-rail-fam={fam} onClick={event => pickFamily(event, fam)} aria-label={`${t(`outils.fam.${fam}`)} · ${t("outils.count", { n: String(counts[fam]) })}`}>
          <FamilyIcon fam={fam} /><span className="u-rail-name">{t(`outils.fam.${fam}`)}</span><span className="u-rail-n" aria-hidden="true">{counts[fam]}</span>
        </a>
      </li>)}
      <li><a className="u-rail-item" href={assetPath(`/studio#outils/${REPERAGE_ID}`)} data-rail-reperage="" aria-label={t(`outils.t.${REPERAGE_ID}.title`)}>
        <FamilyIcon fam="reperage" /><span className="u-rail-name">{t(`outils.t.${REPERAGE_ID}.title`)}</span>
      </a></li>
    </ul>
    <span className="u-rail-sep" aria-hidden="true" />
    <ul role="list" className="u-rail-list">
      <li><a className="u-rail-item" href={assetPath("/studio#personnage")} data-rail-film="" aria-current={place === "realiser" || place === "montage" ? "page" : undefined} aria-label={t("entry.film")}>
        <FamilyIcon fam="film" /><span className="u-rail-name">{t("entry.film")}</span>
      </a></li>
      <li><a className="u-rail-item" href={assetPath("/mon-studio")} data-rail-creations="" aria-current={place === "creations" ? "page" : undefined} aria-label={t("top.creations")}>
        <FamilyIcon fam="creations" /><span className="u-rail-name">{t("top.creations")}</span>
      </a></li>
    </ul>
    <div className="u-rail-foot">
      <PoweredBy className="u-rail-badge" />
      <a className="u-rail-badge-mini" href="https://comfy.org/" target="_blank" rel="noopener noreferrer" aria-label={t("landing.poweredByLabel")}><ComfyLogomark size={22} /></a>
    </div>
  </aside>;
}

export function StudioTabs({ place }: { place: Place }) {
  const { t } = useI18n();
  const tabs: { id: string; href: string; label: string; full?: string; icon: Parameters<typeof FamilyIcon>[0]["fam"]; on: boolean }[] = [
    { id: "accueil", href: "/", label: t("top.home"), icon: "home", on: place === "accueil" },
    { id: "creer", href: "/studio#outils", label: t("top.create"), icon: "creer", on: place === "creer" },
    { id: "film", href: "/studio#personnage", label: t("top.film"), icon: "film", on: place === "realiser" || place === "montage" },
    { id: "creations", href: "/mon-studio", label: t("top.creationsShort"), full: t("top.creations"), icon: "creations", on: place === "creations" },
  ];
  return <nav className="u-tabs" aria-label={t("top.nav")} data-tabs="">
    {tabs.map(tab => <a key={tab.id} href={assetPath(tab.href)} data-tab={tab.id} aria-label={tab.full} aria-current={tab.on ? "page" : undefined}>
      <FamilyIcon fam={tab.icon} /><span>{tab.label}</span>
    </a>)}
  </nav>;
}
