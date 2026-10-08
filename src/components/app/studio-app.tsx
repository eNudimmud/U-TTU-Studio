"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCredits } from "@/lib/credits";
import { liftDelta } from "@/lib/mobile-band";
import { assetPath } from "@/lib/site";
import { priseReady } from "@/lib/stage";
import { TAB_HASH, tabFromLocation, type Tab } from "@/lib/studio-route";
import { LanguageSwitcher, useI18n } from "@/components/i18n/provider";
import { Coffre } from "./glyphs";
import { MontageStage } from "./montage-stage";
import { FormatProvider } from "./format-switch";
import { CastStage, DecorStage, PriseStage } from "./stage-screens";
import { ConfirmTake, ConnectSheet, CreditSheet } from "./studio-frames";
import { StudioProvider, useStudio } from "./studio-session";
import "./app.css";

const STEPS: { id: "lora" | "scene" | "prise" | "montage"; key: "nav.character" | "nav.scene" | "nav.take" | "nav.edit" }[] = [
  { id: "lora", key: "nav.character" },
  { id: "scene", key: "nav.scene" },
  { id: "prise", key: "nav.take" },
  { id: "montage", key: "nav.edit" },
];

export function StudioApp({ initialTab = null }: { initialTab?: Tab | null }) {
  return <StudioProvider><AppFrame initialTab={initialTab ?? null} /></StudioProvider>;
}

function AppFrame({ initialTab }: { initialTab: Tab | null }) {
  const studio = useStudio();
  const { t, say } = useI18n();
  const { ready, sheet, setSheet, connected, balance, balanceNote, notice, setNotice, run, cast, decor, pickedCast, pickedDecor, line, studio: vault } = studio;
  const [asked, setAsked] = useState<Tab | null>(initialTab);

  useEffect(() => {
    const apply = () => {
      const place = tabFromLocation(window.location.hash, window.location.search);
      if (place === "compte") {
        window.location.replace(assetPath("/compte"));
        return;
      }
      if (place) setAsked(place);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const castOk = cast.length > 0 && Boolean(pickedCast);
  const decorOk = decor.length > 0 && Boolean(pickedDecor);
  const priseOk = priseReady({ cast: castOk, decor: decorOk, line });
  const tab: Tab = asked ?? "lora";
  const section: "lora" | "scene" | "prise" | "montage" = tab === "scene" || tab === "prise" || tab === "montage" ? tab : "lora";

  const go = useCallback((next: Tab) => {
    const shown: Tab = next === "look" || next === "fiches" || next === "sphere" ? "lora" : next;
    setAsked(shown);
    const hash = TAB_HASH[shown];
    const url = `${window.location.pathname}${window.location.search}#${hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => document.getElementById("u-title")?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  useEffect(() => {
    let frame = 0;
    let timer = 0;
    const lift = () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !el.matches("input, textarea, select") || !el.closest(".u-app")) return;
      const chain = document.querySelector(".u-chain")?.getBoundingClientRect();
      const header = document.querySelector(".u-top")?.getBoundingClientRect();
      const viewport = window.visualViewport;
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      const bandTop = (header?.bottom ?? 0) + 8;
      const bandBottom = Math.min(chain?.top ?? visibleBottom, visibleBottom) - 12;
      const rect = el.getBoundingClientRect();
      const delta = liftDelta(rect, bandTop, bandBottom);
      if (delta === 0) return;
      const root = document.documentElement;
      const previous = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollBy(0, delta);
      root.style.scrollBehavior = previous;
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      lift();
      frame = window.requestAnimationFrame(() => {
        lift();
        frame = window.requestAnimationFrame(lift);
      });
      timer = window.setTimeout(lift, 80);
    };
    document.addEventListener("focusin", schedule);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      document.removeEventListener("focusin", schedule);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, []);

  const marks: Record<"lora" | "scene" | "prise" | "montage", boolean> = {
    lora: castOk,
    scene: decorOk,
    prise: priseOk,
    montage: vault.takes.length > 0,
  };
  const renderAria = !connected ? t("sheet.notLinked") : balance ? t("sheet.credits", { amount: formatCredits(balance.credits) }) : (balanceNote ? say(balanceNote) : t("sheet.balanceUnread"));

  return <FormatProvider><div className="u-app" data-studio={section}>
    <header className="u-top">
      <a className="u-mark" href={assetPath("/studio#personnage")} aria-label="U*TTU Studio">U<em>*</em>TTU</a>
      <div className="u-top-project">
        {vault.projectName && <p className="u-project-name">{vault.projectName}</p>}
      </div>
      <div className="u-top-tools">
        <a className="u-coffre" href={assetPath("/mon-studio")} aria-label={t("nav.studio")}><Coffre /><span className="u-tool-label">{t("nav.studio")}</span></a>
        <button type="button" className="u-credit" onClick={() => setSheet("credits")} aria-label={t("sheet.walletAria", { render: renderAria })}>
          <span className="u-tool-full">{t("sheet.walletTitle")}</span>
          <span className="u-tool-short">{t("stage.creditsShort")}</span>
        </button>
        <LanguageSwitcher />
      </div>
    </header>
    <nav className="u-chain" aria-label={t("nav.chain")}>
      {STEPS.map(step => <button key={step.id} type="button" aria-current={section === step.id ? "page" : undefined} data-state={marks[step.id] ? "pret" : "vide"} onClick={() => go(step.id)}>
        <span>{t(step.key)}</span>
        <small>{marks[step.id] ? t("stage.ready") : t("stage.empty")}</small>
        {step.id === "prise" && run.phase === "running" && <span className="u-pulse" aria-label={t("nav.takeRunning")} />}
      </button>)}
    </nav>
    <main id="contenu" className="u-main" tabIndex={-1} aria-busy={!ready}>
      {!ready ? <p className="u-loading" role="status">{t("nav.opening")}</p> : <>
        {section === "scene" ? <DecorStage onPrise={() => go("prise")} />
          : section === "prise" ? <PriseStage goCast={() => go("lora")} goDecor={() => go("scene")} onMontage={() => go("montage")} />
          : section === "montage" ? <MontageStage />
          : <CastStage onDecor={() => go("scene")} />}
      </>}
    </main>
    {notice && <p className="u-toast" role="status">{say(notice)}</p>}
    {sheet === "credits" && <CreditSheet />}
    {sheet === "connect" && <ConnectSheet />}
    {sheet === "confirm" && <ConfirmTake />}
  </div></FormatProvider>;
}
