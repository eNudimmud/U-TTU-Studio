"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { CINEMA_PATH, CINEMA_STEPS, atelierModes, placeFromLocation, type CinemaStep, type ShellPlace } from "@/lib/cinema";
import { assetPath, contactEmail, testPhaseEnd } from "@/lib/site";
import type { StudioMode } from "@/lib/studio-modes";
import { CreateView } from "./create-view";
import { IdentityPanel } from "./identity-panel";
import { MaisonPanel } from "./maison-panel";
import { LibraryPanel } from "./library-panel";
import { GoProvider, StepProvider } from "./mode-context";
import { PlateauPanel } from "./plateau-panel";
import { ProcessLaunchProvider } from "./process-launch";
import { SpherePanel } from "./sphere-panel";
import { StudioSessionProvider } from "./session";
import { TakePanel } from "./take-panel";

const AccountPanel = dynamic(() => import("./account-panel").then(m => m.AccountPanel), {
  loading: () => <p className="loading-panel" role="status">Ouverture…</p>,
});

export function StudioShell() {
  const [place, setPlace] = useState<ShellPlace>({ kind: "cinema", step: "look" });
  const first = useRef(true);
  const placeKey = place.kind === "cinema" ? place.step : place.mode;

  useEffect(() => {
    const apply = () => setPlace(placeFromLocation(window.location.hash, window.location.search));
    apply();
    window.addEventListener("hashchange", apply);
    window.addEventListener("popstate", apply);
    return () => {
      window.removeEventListener("hashchange", apply);
      window.removeEventListener("popstate", apply);
    };
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById("mode-title")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [placeKey]);

  function navigate(hashId: string) {
    const url = new URL(window.location.href);
    url.searchParams.delete("step");
    url.hash = hashId;
    const next = `${url.pathname}${url.search}#${hashId}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current !== next) window.history.pushState(null, "", next);
    setPlace(placeFromLocation(`#${hashId}`, url.search));
  }

  function select(next: StudioMode) {
    navigate(next === "creer" ? "look" : next);
  }

  function selectStep(next: CinemaStep) {
    navigate(next);
  }

  const step = place.kind === "cinema" ? place.step : null;
  const atelier = place.kind === "atelier" ? place.mode : null;

  return <GoProvider go={select}>
    <StepProvider go={selectStep}>
    <ProcessLaunchProvider>
      <StudioSessionProvider>
      <header className="studio-header">
        <div className="shell header-inner">
          <a href="#look" className="wordmark" aria-label="U*TTU Studio — Ton style">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a>
          <a className="header-home" href={assetPath("/")}>Accueil</a>
          <p className="header-kill"><span>Rien à payer</span><span>{testPhaseEnd}</span></p>
        </div>
        <div className="shell">
          <nav className="cinema-nav" aria-label="Look, Plateau, Take">
            {CINEMA_STEPS.map((item, index) => <button key={item.id} type="button" className="cinema-step" aria-current={step === item.id ? "step" : undefined} onClick={() => selectStep(item.id)}>
              <span className="cinema-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="cinema-plain">{item.plain}</span>
              <span className="cinema-name">{item.name}</span>
            </button>)}
          </nav>
          <p className="cinema-path">{CINEMA_PATH}</p>
          <nav className="studio-nav atelier-nav" aria-label="Autres espaces">
            {atelierModes().map(item => <button key={item.id} type="button" className="studio-nav-item" aria-current={atelier === item.id ? "page" : undefined} onClick={() => select(item.id)}>{item.label}</button>)}
          </nav>
        </div>
      </header>
      <main id="contenu" className="shell studio-main" tabIndex={-1}>
        {step === "look" && <CreateView />}
        {step === "plateau" && <PlateauPanel />}
        {step === "take" && <TakePanel />}
        {atelier === "sphere" && <SpherePanel />}
        {atelier === "identite" && <IdentityPanel />}
        {atelier === "bibliotheque" && <LibraryPanel />}
        {atelier === "studio" && <MaisonPanel />}
        {atelier === "compte" && <AccountPanel />}
      </main>
      <footer className="studio-footer shell">
        <span><span className="iii">iii</span> THE BLOC · SUISSE</span>
        <span>Session locale. Le coffre est à part.</span>
        <a href={`mailto:${contactEmail}`}>Contacter le studio ↗</a>
      </footer>
      </StudioSessionProvider>
    </ProcessLaunchProvider>
    </StepProvider>
  </GoProvider>;
}
