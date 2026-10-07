"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCredits } from "@/lib/credits";
import { formatUsd } from "@/lib/fal/prices";
import { lookCheck } from "@/lib/coffre/model";
import type { GuideMoment } from "@/lib/guide";
import { assetPath } from "@/lib/site";
import { resumeTab, TAB_HASH, tabFromLocation, type Tab } from "@/lib/studio-route";
import type { WorkflowFiche } from "@/lib/workflow-fiches";
import { LanguageSwitcher, useI18n } from "@/components/i18n/provider";
import { Coffre, Iii, Web } from "./glyphs";
import { GuideBubble } from "./guide-bubble";
import { FichesScreen } from "./fiches-screen";
import { LoraScreen } from "./lora-screen";
import { LookScreen, PlateauShelf, SceneScreen, SphereScreen, TakeScreen } from "./screens";
import { BlenderSheet, CoffreSheet, ConfirmSheet, ConnectSheet, CreditSheet, FalSheet, PlaceSceneSheet, PlaceTrainSheet, PlayerSheet, PrevizConfirmSheet, RelierSheet, TrainConfirmSheet } from "./sheets";
import { StudioProvider, useStudio } from "./studio-context";
import "./app.css";

const STEPS: { id: Exclude<Tab, "sphere" | "look" | "fiches">; key: "nav.character" | "nav.scene" | "nav.take" }[] = [
  { id: "lora", key: "nav.character" },
  { id: "scene", key: "nav.scene" },
  { id: "prise", key: "nav.take" },
];

export function StudioApp() {
  return <StudioProvider><AppFrame /></StudioProvider>;
}

function AppFrame() {
  const studio = useStudio();
  const { t, say } = useI18n();
  const { ready, sheet, setSheet, connected, balance, balanceNote, notice, setNotice, run, engine, setEngine, falLinked, falBalance, falBalanceNote, training } = studio;
  const [asked, setAsked] = useState<Tab | null>(null);
  const [choice, setChoice] = useState(0);
  const [startFile, setStartFile] = useState(false);
  const [sceneFocus, setSceneFocus] = useState<"vues" | "image" | null>(null);

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

  const check = lookCheck(studio.studio.look);
  const hasScene = Boolean(studio.scene);
  useEffect(() => {
    if (ready && !asked) setAsked(resumeTab({ lookReady: check.ready, hasScene }));
  }, [ready, asked, check.ready, hasScene]);
  const tab: Tab = asked ?? "lora";

  const go = useCallback((next: Tab, opts?: { file?: boolean; scene?: "vues" | "image" | null }) => {
    setStartFile(Boolean(opts?.file));
    setSceneFocus(opts?.scene ?? null);
    if (next === "lora") setChoice(value => value + 1);
    setAsked(next);
    const url = `${window.location.pathname}#${TAB_HASH[next]}`;
    if (`${window.location.pathname}${window.location.hash}` !== url) window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => document.getElementById("u-title")?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  const done: Record<Exclude<Tab, "sphere" | "fiches">, boolean> = {
    look: check.ready,
    lora: studio.studio.loras.some(item => item.kind !== "lieu"),
    scene: hasScene,
    prise: studio.studio.takes.length > 0,
  };
  const renderAria = !connected ? t("sheet.notLinked") : balance ? t("sheet.credits", { amount: formatCredits(balance.credits) }) : (balanceNote ? say(balanceNote) : t("sheet.balanceUnread"));
  const falAria = !falLinked ? t("sheet.notLinked") : falBalance ? formatUsd(falBalance.usd) : (falBalanceNote ? say(falBalanceNote) : t("sheet.balanceUnread"));

  const moments: (GuideMoment | false)[] = tab === "look"
    ? [!check.photos && "look-photos", !check.name && "look-name", !check.traits && "look-traits", check.ready && "look-ready"]
    : tab === "scene"
    ? [studio.studio.scenes.length === 0 && "scene-new", Boolean(studio.scene && !studio.scene.previz && studio.scene.stills.length === 0) && "scene-still", Boolean(studio.scene && !studio.scene.render) && "scene-previz"]
    : tab === "lora"
    ? [training.phase === "running" && "lora-running", training.phase === "done" && "lora-done", !studio.studio.role.name.trim() && "lora-name", studio.studio.role.photos.length < 2 && "lora-photos", studio.studio.clips.length < 10 && "lora-clips", !falLinked && "lora-connect", studio.dataset.ready && falLinked && training.phase === "idle" && "lora-ready"]
    : tab === "prise"
    ? [run.phase === "running" && "take-running", run.phase === "done" && "take-done", engine === "lora" && run.phase === "idle" && "take-double", check.ready && Boolean(studio.scene) && run.phase === "idle" && (engine === "lora" ? !falLinked && "lora-connect" : !connected ? "take-connect" : !studio.line.trim() ? "take-line" : "take-ready")]
    : tab === "fiches"
    ? []
    : [studio.studio.takes.length === 0 && "sphere-empty"];

  return <div className="u-app">
    <header className="u-top">
      <a className="u-mark" href="#personnage" aria-label="U*TTU Studio">
        <Iii />
        <span>U<em>*</em>TTU</span>
      </a>
      <div className="u-top-tools">
        <LanguageSwitcher />
        <button type="button" className="u-credit" onClick={() => setSheet("credits")} aria-label={t("sheet.walletAria", { render: renderAria, fal: falAria })}>
          <span>{t("sheet.walletTitle")}</span>
        </button>
        <button type="button" className="u-coffre" onClick={() => setSheet("coffre")} aria-label={t("nav.studio")}><Coffre /><span>{t("nav.studio")}</span></button>
      </div>
    </header>

    <main id="contenu" className="u-main" tabIndex={-1} aria-busy={!ready}>
      {ready && <GuideBubble moments={moments} />}
      {!ready ? <p className="u-loading" role="status">{t("nav.opening")}</p>
        : tab === "look" ? <LookScreen onNext={() => go("scene")} onBack={() => go("lora")} />
        : tab === "scene" ? <SceneScreen onNext={() => go("prise")} onRole={() => go("lora")} focus={sceneFocus} />
        : tab === "lora" ? <LoraScreen onTake={() => go("prise")} onScene={() => go("scene")} onPhotos={() => go("look")} choice={choice} startFile={startFile} />
        : tab === "prise" ? <TakeScreen goLook={() => go("look")} goScene={() => go("scene")} goSphere={() => go("sphere")} goLora={() => go("lora")} />
        : tab === "fiches" ? <FichesScreen onLaunch={(fiche: WorkflowFiche) => {
          if (fiche.engine) setEngine(fiche.engine);
          go(fiche.dest, { file: fiche.focus === "file", scene: fiche.focus === "vues" || fiche.focus === "image" ? fiche.focus : null });
        }} />
        : <SphereScreen />}
    </main>

    {ready && <PlateauShelf go={go} />}

    {notice && <p className="u-toast" role="status">{say(notice)}</p>}

    <nav className="u-chain" aria-label={t("nav.chain")}>
      <ol>
        {STEPS.map((step, index) => <li key={step.id}>
          <button type="button" aria-current={tab === step.id ? "step" : undefined} data-done={done[step.id] || undefined} onClick={() => go(step.id)}>
            <span className="u-node" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span>{t(step.key)}</span>
            {step.id === "prise" && run.phase === "running" && <span className="u-pulse" aria-label={t("nav.takeRunning")} />}
            {step.id === "lora" && training.phase === "running" && <span className="u-pulse" aria-label={t("nav.trainRunning")} />}
          </button>
        </li>)}
      </ol>
      <div className="u-side">
        <button type="button" className="u-sphere" aria-current={tab === "sphere" ? "page" : undefined} onClick={() => go("sphere")}>
          <Web />
          <span>{t("nav.sphere")}</span>
        </button>
        <button type="button" className="u-fiches-nav" aria-current={tab === "fiches" ? "page" : undefined} onClick={() => go("fiches")}>
          <span>{t("nav.sheets")}</span>
        </button>
        <button type="button" className="u-rail-coffre" onClick={() => setSheet("coffre")} aria-label={t("nav.studio")}><Coffre /><span>{t("nav.studio")}</span></button>
        <LanguageSwitcher rail />
      </div>
    </nav>

    {sheet === "connect" && <ConnectSheet />}
    {sheet === "credits" && <CreditSheet />}
    {sheet === "coffre" && <CoffreSheet />}
    {sheet === "confirm" && <ConfirmSheet />}
    {sheet === "fal" && <FalSheet />}
    {sheet === "relier" && <RelierSheet />}
    {sheet === "blender" && <BlenderSheet />}
    {sheet === "train-confirm" && <TrainConfirmSheet />}
    {sheet === "previz-confirm" && <PrevizConfirmSheet />}
    {sheet === "place-train" && <PlaceTrainSheet />}
    {sheet === "place-scene" && <PlaceSceneSheet />}
    {sheet && typeof sheet === "object" && <PlayerSheet id={sheet.take} />}
  </div>;
}
