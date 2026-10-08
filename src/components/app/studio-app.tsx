"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { formatCredits } from "@/lib/credits";
import { formatUsd } from "@/lib/fal/prices";
import { offeredName, readLookNameCleared } from "@/lib/ergonomie";
import { liftDelta } from "@/lib/mobile-band";
import { castReady, priseReady } from "@/lib/stage";
import { assetPath } from "@/lib/site";
import { TAB_HASH, tabFromLocation, type Tab } from "@/lib/studio-route";
import { LanguageSwitcher, useI18n } from "@/components/i18n/provider";
import { Coffre, Iii } from "./glyphs";
import { CastStage, DecorStage, PriseStage } from "./stage-screens";
import { StudioDrawer } from "./studio-drawer";
import { StudioProvider, useStudio } from "./studio-context";
import "./app.css";

const BlenderSheet = dynamic(() => import("./sheets").then(mod => mod.BlenderSheet));
const CoffreSheet = dynamic(() => import("./sheets").then(mod => mod.CoffreSheet));
const ConfirmSheet = dynamic(() => import("./sheets").then(mod => mod.ConfirmSheet));
const ConnectSheet = dynamic(() => import("./sheets").then(mod => mod.ConnectSheet));
const CreditSheet = dynamic(() => import("./sheets").then(mod => mod.CreditSheet));
const FalSheet = dynamic(() => import("./sheets").then(mod => mod.FalSheet));
const MemorySheet = dynamic(() => import("./sheets").then(mod => mod.MemorySheet));
const OutputsSheet = dynamic(() => import("./sheets").then(mod => mod.OutputsSheet));
const PlaceSceneSheet = dynamic(() => import("./sheets").then(mod => mod.PlaceSceneSheet));
const PlaceTrainSheet = dynamic(() => import("./sheets").then(mod => mod.PlaceTrainSheet));
const PlayerSheet = dynamic(() => import("./sheets").then(mod => mod.PlayerSheet));
const PrevizConfirmSheet = dynamic(() => import("./sheets").then(mod => mod.PrevizConfirmSheet));
const RelierSheet = dynamic(() => import("./sheets").then(mod => mod.RelierSheet));
const SequenceSheet = dynamic(() => import("./sheets").then(mod => mod.SequenceSheet));
const ShotSheet = dynamic(() => import("./sheets").then(mod => mod.ShotSheet));
const TrainConfirmSheet = dynamic(() => import("./sheets").then(mod => mod.TrainConfirmSheet));

const STEPS: { id: "lora" | "scene" | "prise"; key: "nav.character" | "nav.scene" | "nav.take" }[] = [
  { id: "lora", key: "nav.character" },
  { id: "scene", key: "nav.scene" },
  { id: "prise", key: "nav.take" },
];

export function StudioApp({ initialTab = null }: { initialTab?: Tab | null }) {
  return <StudioProvider><AppFrame initialTab={initialTab ?? null} /></StudioProvider>;
}

function AppFrame({ initialTab }: { initialTab: Tab | null }) {
  const studio = useStudio();
  const { t, say } = useI18n();
  const { ready, sheet, setSheet, connected, balance, balanceNote, notice, setNotice, run, setEngine, falLinked, falBalance, falBalanceNote, previz, placeRun, line } = studio;
  const [asked, setAsked] = useState<Tab | null>(initialTab);
  const [drawer, setDrawer] = useState(false);
  const [drawerFocus, setDrawerFocus] = useState<"fiches" | "fichier" | "trajet" | null>(null);
  const [nameCleared, setNameCleared] = useState(false);

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

  useEffect(() => {
    setNameCleared(readLookNameCleared(typeof window === "undefined" ? null : window.localStorage, studio.studio.project));
  }, [studio.studio.look.name, studio.studio.project]);

  const heldName = offeredName(studio.studio.look.name, t("look.defaultName"), nameCleared);
  const castOk = castReady({ name: heldName, photos: studio.studio.look.photos });
  const decorOk = Boolean(studio.scene);
  const priseOk = priseReady({ cast: castOk, decor: decorOk, line });
  const tab: Tab = asked ?? "lora";
  const section: "lora" | "scene" | "prise" = tab === "scene" ? "scene" : tab === "prise" ? "prise" : "lora";

  const go = useCallback((next: Tab, opts?: { file?: boolean; scene?: "vues" | "image" | null }) => {
    if (opts?.file) {
      setDrawer(true);
      setDrawerFocus("fichier");
    } else if (opts?.scene) {
      setDrawer(true);
      setDrawerFocus("trajet");
    } else if (next === "fiches") {
      setDrawer(true);
      setDrawerFocus("fiches");
    } else if (next === "sphere") {
      setDrawer(true);
      setDrawerFocus(null);
    }
    const shown: Tab = next === "look" || next === "fiches" || next === "sphere" ? "lora" : next;
    setAsked(shown);
    const hash = TAB_HASH[next];
    const url = `${window.location.pathname}#${hash}`;
    if (`${window.location.pathname}${window.location.hash}` !== url) window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => document.getElementById("u-title")?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
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

  const marks: Record<"lora" | "scene" | "prise", boolean> = { lora: castOk, scene: decorOk, prise: priseOk };
  const renderAria = !connected ? t("sheet.notLinked") : balance ? t("sheet.credits", { amount: formatCredits(balance.credits) }) : (balanceNote ? say(balanceNote) : t("sheet.balanceUnread"));
  const falAria = !falLinked ? t("sheet.notLinked") : falBalance ? formatUsd(falBalance.usd) : (falBalanceNote ? say(falBalanceNote) : t("sheet.balanceUnread"));

  return <div className="u-app">
    <header className="u-top">
      <a className="u-mark" href="#personnage" aria-label="U*TTU Studio">
        <Iii />
        <span>U<em>*</em>TTU</span>
      </a>
      <div className="u-top-tools">
        <button type="button" className="u-coffre" onClick={() => { setDrawerFocus(null); setDrawer(true); }} aria-label={t("nav.studio")}><Coffre /><span>{t("nav.studio")}</span></button>
        <button type="button" className="u-credit" onClick={() => setSheet("credits")} aria-label={t("sheet.walletAria", { render: renderAria, fal: falAria })}>
          <span>{t("sheet.walletTitle")}</span>
        </button>
        <LanguageSwitcher />
      </div>
    </header>

    <nav className="u-chain" aria-label={t("nav.chain")}>
      {STEPS.map(step => <button key={step.id} type="button" aria-current={section === step.id ? "page" : undefined} data-state={marks[step.id] ? "pret" : "vide"} onClick={() => go(step.id)}>
        <span>{t(step.key)}</span>
        <small>{marks[step.id] ? t("stage.ready") : t("stage.empty")}</small>
        {step.id === "prise" && run.phase === "running" && <span className="u-pulse" aria-label={t("nav.takeRunning")} />}
        {step.id === "scene" && (previz.phase === "running" || placeRun === "running") && <span className="u-pulse" aria-label={t("nav.sceneRunning")} />}
      </button>)}
    </nav>

    <main id="contenu" className="u-main" tabIndex={-1} aria-busy={!ready}>
      {!ready && !asked ? <p className="u-loading" role="status">{t("nav.opening")}</p> : <>
        {!ready && <p className="sr-only" role="status">{t("nav.opening")}</p>}
        {section === "scene" ? <DecorStage onPrise={() => go("prise")} />
          : section === "prise" ? <PriseStage goCast={() => go("lora")} goDecor={() => go("scene")} />
          : <CastStage onDecor={() => go("scene")} />}
      </>}
    </main>

    {drawer && <StudioDrawer focus={drawerFocus} onClose={() => setDrawer(false)} onGo={(next, opts) => {
      if (opts?.file || opts?.scene || next === "fiches") go(next, opts);
      else { setDrawer(false); go(next); }
    }} />}

    {notice && <p className="u-toast" role="status">{say(notice)}</p>}

    {sheet === "coffre" && <CoffreSheet />}
    {sheet === "connect" && <ConnectSheet />}
    {sheet === "credits" && <CreditSheet />}
    {sheet === "confirm" && <ConfirmSheet />}
    {sheet === "fal" && <FalSheet />}
    {sheet === "relier" && <RelierSheet />}
    {sheet === "blender" && <BlenderSheet />}
    {sheet === "train-confirm" && <TrainConfirmSheet />}
    {sheet === "previz-confirm" && <PrevizConfirmSheet />}
    {sheet === "place-train" && <PlaceTrainSheet />}
    {sheet === "place-scene" && <PlaceSceneSheet />}
    {sheet === "sequences" && <SequenceSheet />}
    {sheet === "shots" && <ShotSheet />}
    {sheet && typeof sheet === "object" && "take" in sheet && <PlayerSheet id={sheet.take} />}
    {sheet && typeof sheet === "object" && "memory" in sheet && <MemorySheet focus={sheet.memory} />}
    {sheet && typeof sheet === "object" && "sequence" in sheet && <SequenceSheet id={sheet.sequence} />}
    {sheet && typeof sheet === "object" && "shot" in sheet && <ShotSheet id={sheet.shot} />}
    {sheet && typeof sheet === "object" && "outputs" in sheet && <OutputsSheet kind={sheet.outputs} />}
  </div>;
}
