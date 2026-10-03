"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { CINEMA_STEPS, atelierModes, placeFromLocation, takeReady, type CinemaStep, type ShellPlace } from "@/lib/cinema";
import { lookHeld } from "@/lib/doctrine";
import { PLATEAU_EVENT, readPlateau, worldReady } from "@/lib/plateau";
import { assetPath, contactEmail, testPhaseEnd } from "@/lib/site";
import type { StudioMode } from "@/lib/studio-modes";
import { CreateView } from "./create-view";
import { CreditChip } from "./credit-meter";
import { IdentityPanel } from "./identity-panel";
import { MaisonPanel } from "./maison-panel";
import { LibraryPanel } from "./library-panel";
import { GoProvider, StepProvider } from "./mode-context";
import { PlateauPanel } from "./plateau-panel";
import { ProcessLaunchProvider } from "./process-launch";
import { SpherePanel } from "./sphere-panel";
import { StudioSessionProvider, useStudioSession } from "./session";
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
      <AppBar step={step} atelier={atelier} placeKey={placeKey} onStep={selectStep} onMode={select} />
      <main id="contenu" className="shell studio-main app-main" tabIndex={-1}>
        {step === "look" && <CreateView />}
        {step === "plateau" && <PlateauPanel />}
        {step === "take" && <TakePanel />}
        {atelier === "sphere" && <SpherePanel />}
        {atelier === "identite" && <IdentityPanel />}
        {atelier === "bibliotheque" && <LibraryPanel />}
        {atelier === "studio" && <MaisonPanel />}
        {atelier === "compte" && <AccountPanel />}
      </main>
      </StudioSessionProvider>
    </ProcessLaunchProvider>
    </StepProvider>
  </GoProvider>;
}

function AppBar({ step, atelier, placeKey, onStep, onMode }: {
  step: CinemaStep | null;
  atelier: StudioMode | null;
  placeKey: string;
  onStep: (step: CinemaStep) => void;
  onMode: (mode: StudioMode) => void;
}) {
  const session = useStudioSession();
  const held = lookHeld({ refCount: session.refPreviews.length, trigger: session.trigger, invariants: session.invariants, canonNoted: session.canonNoted });
  const [world, setWorld] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const read = () => setWorld(worldReady(readPlateau(window.localStorage)));
    read();
    window.addEventListener(PLATEAU_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(PLATEAU_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, [placeKey]);

  useEffect(() => {
    const away = (event: PointerEvent) => {
      const details = menu.current;
      if (details?.open && !details.contains(event.target as Node)) details.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      const details = menu.current;
      if (event.key !== "Escape" || !details?.open) return;
      details.open = false;
      details.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const marks: Record<CinemaStep, string> = {
    look: held ? "Tenu" : "",
    plateau: world ? "Posé" : "",
    take: takeReady({ lookHeld: held, worldReady: world }) ? "Prête" : "",
  };

  function pick(mode: StudioMode) {
    if (menu.current) menu.current.open = false;
    onMode(mode);
  }

  return <header className="studio-header app-bar">
    <div className="shell app-bar-inner">
      <a href="#look" className="wordmark" aria-label="U*TTU Studio — Ton style">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a>
      <nav className="cinema-nav" aria-label="Ton style, Ta scène, La prise">
        {CINEMA_STEPS.map((item, index) => <button key={item.id} type="button" className="cinema-step" data-done={marks[item.id] ? "true" : undefined} aria-current={step === item.id ? "step" : undefined} onClick={() => onStep(item.id)}>
          <span className="cinema-index">{String(index + 1).padStart(2, "0")}</span>
          <span className="cinema-plain">{item.plain}</span>
          <span className="cinema-mark">{marks[item.id] || "\u00a0"}</span>
        </button>)}
      </nav>
      <div className="app-tools">
        <CreditChip />
        <button type="button" className="app-tool" aria-current={atelier === "sphere" ? "page" : undefined} onClick={() => pick("sphere")}>Sphère</button>
        <details ref={menu} className="app-menu">
          <summary className="app-tool">Plus</summary>
          <div className="app-menu-panel">
            <nav aria-label="Autres espaces">
              {atelierModes().filter(item => item.id !== "sphere").map(item => <button key={item.id} type="button" className="app-menu-item" aria-current={atelier === item.id ? "page" : undefined} onClick={() => pick(item.id)}>{item.label}</button>)}
            </nav>
            <a className="app-menu-item" href={assetPath("/")}>Accueil</a>
            <a className="app-menu-item" href={`mailto:${contactEmail}`}>Contacter le studio ↗</a>
            <p className="app-menu-note">Rien à payer ici · essai jusqu’au {testPhaseEnd}</p>
          </div>
        </details>
      </div>
    </div>
  </header>;
}
