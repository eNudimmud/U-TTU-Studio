"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCredits } from "@/lib/credits";
import { formatUsd } from "@/lib/fal/prices";
import { lookCheck } from "@/lib/coffre/model";
import type { GuideMoment } from "@/lib/guide";
import { assetPath } from "@/lib/site";
import { resumeTab, tabFromLocation, type Tab } from "@/lib/studio-route";
import { Coffre, Iii, Web } from "./glyphs";
import { GuideBubble } from "./guide-bubble";
import { LoraScreen } from "./lora-screen";
import { LookScreen, SceneScreen, SphereScreen, TakeScreen } from "./screens";
import { CoffreSheet, ConfirmSheet, ConnectSheet, CreditSheet, FalSheet, PlayerSheet, TrainConfirmSheet } from "./sheets";
import { StudioProvider, useStudio } from "./studio-context";
import "./app.css";

const STEPS: { id: Exclude<Tab, "sphere" | "lora">; label: string }[] = [
  { id: "look", label: "Look" },
  { id: "scene", label: "Scène" },
  { id: "prise", label: "Prise" },
];

export function StudioApp() {
  return <StudioProvider><AppFrame /></StudioProvider>;
}

function AppFrame() {
  const studio = useStudio();
  const { ready, sheet, setSheet, connected, balance, balanceNote, notice, setNotice, run, engine, falLinked, falBalance, falBalanceNote, training } = studio;
  const [asked, setAsked] = useState<Tab | null>(null);

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
  const tab: Tab = asked ?? "look";

  const go = useCallback((next: Tab) => {
    setAsked(next);
    const url = `${window.location.pathname}#${next}`;
    if (`${window.location.pathname}${window.location.hash}` !== url) window.history.pushState(null, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => document.getElementById("u-title")?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  const done: Record<Exclude<Tab, "sphere" | "lora">, boolean> = {
    look: check.ready,
    scene: hasScene,
    prise: studio.studio.takes.length > 0,
  };
  const falHere = tab === "lora" || (tab === "prise" && engine === "lora");

  const moments: (GuideMoment | false)[] = tab === "look"
    ? [!check.photos && "look-photos", !check.name && "look-name", !check.traits && "look-traits", check.ready && "look-ready"]
    : tab === "scene"
    ? [studio.studio.scenes.length === 0 && "scene-new", Boolean(studio.scene && studio.scene.stills.length === 0) && "scene-still"]
    : tab === "lora"
    ? [training.phase === "running" && "lora-running", training.phase === "done" && "lora-done", studio.studio.clips.length < 10 && "lora-clips", !falLinked && "lora-connect", studio.dataset.ready && falLinked && training.phase === "idle" && "lora-ready"]
    : tab === "prise"
    ? [run.phase === "running" && "take-running", run.phase === "done" && "take-done", engine === "lora" && run.phase === "idle" && "take-double", check.ready && Boolean(studio.scene) && run.phase === "idle" && (engine === "lora" ? !falLinked && "lora-connect" : !connected ? "take-connect" : !studio.line.trim() ? "take-line" : "take-ready")]
    : [studio.studio.takes.length === 0 && "sphere-empty"];

  return <div className="u-app">
    <header className="u-top">
      <a className="u-mark" href="#look" aria-label="U*TTU Studio">
        <Iii />
        <span>U<em>*</em>TTU</span>
      </a>
      <div className="u-top-tools">
        <button type="button" className="u-credit" onClick={() => setSheet(falHere ? (falLinked ? "credits" : "fal") : (connected ? "credits" : "connect"))} aria-label={falHere ? (falLinked ? "Solde du compte fal" : "Relier le compte fal") : (connected ? "Crédits du compte de rendu" : "Relier le compte de rendu")}>
          {falHere
            ? (falLinked ? <><strong>{falBalance ? formatUsd(falBalance.usd) : falBalanceNote ? "—" : "…"}</strong><span>fal</span></> : <span>Relier fal</span>)
            : (connected ? <><strong>{balance ? formatCredits(balance.credits) : balanceNote ? "—" : "…"}</strong><span>crédits</span></> : <span>Relier</span>)}
        </button>
        <button type="button" className="u-icon" onClick={() => setSheet("coffre")} aria-label="Coffre"><Coffre /></button>
      </div>
    </header>

    <main id="contenu" className="u-main" tabIndex={-1} aria-busy={!ready}>
      {ready && <GuideBubble moments={moments} />}
      {!ready ? <p className="u-loading" role="status">Ouverture du coffre…</p>
        : tab === "look" ? <LookScreen onNext={() => go("scene")} onTrain={() => go("lora")} />
        : tab === "scene" ? <SceneScreen onNext={() => go("prise")} />
        : tab === "lora" ? <LoraScreen onTake={() => go("prise")} onLook={() => go("look")} />
        : tab === "prise" ? <TakeScreen goLook={() => go("look")} goScene={() => go("scene")} goSphere={() => go("sphere")} goLora={() => go("lora")} />
        : <SphereScreen />}
    </main>

    {notice && <p className="u-toast" role="status">{notice}</p>}

    <nav className="u-chain" aria-label="Look, scène, prise">
      <ol>
        {STEPS.map((step, index) => <li key={step.id}>
          <button type="button" aria-current={tab === step.id ? "step" : undefined} data-done={done[step.id] || undefined} onClick={() => go(step.id)}>
            <span className="u-node" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <span>{step.label}</span>
            {step.id === "prise" && run.phase === "running" && <span className="u-pulse" aria-label="prise en cours" />}
          </button>
        </li>)}
      </ol>
      <button type="button" className="u-sphere" aria-current={tab === "sphere" ? "page" : undefined} onClick={() => go("sphere")}>
        <Web />
        <span>Sphère</span>
      </button>
    </nav>

    {sheet === "connect" && <ConnectSheet />}
    {sheet === "credits" && <CreditSheet />}
    {sheet === "coffre" && <CoffreSheet />}
    {sheet === "confirm" && <ConfirmSheet />}
    {sheet === "fal" && <FalSheet />}
    {sheet === "train-confirm" && <TrainConfirmSheet />}
    {sheet && typeof sheet === "object" && <PlayerSheet id={sheet.take} />}
  </div>;
}
