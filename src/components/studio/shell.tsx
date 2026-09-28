"use client";

import { useEffect, useRef, useState } from "react";
import { STUDIO_MODES, modeFromHash, type StudioMode } from "@/lib/studio-modes";
import { contactEmail, testPhaseEnd } from "@/lib/site";
import { CreateView } from "./create-view";
import { IdentityPanel } from "./identity-panel";
import { MaisonPanel } from "./maison-panel";
import { LibraryPanel } from "./library-panel";
import { GoProvider } from "./mode-context";
import { SpherePanel } from "./sphere-panel";
import { StudioSessionProvider } from "./session";

export function StudioShell() {
  const [mode, setMode] = useState<StudioMode>("creer");
  const first = useRef(true);

  useEffect(() => {
    const apply = () => setMode(modeFromHash(window.location.hash));
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById("mode-title")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [mode]);

  function select(next: StudioMode) {
    const hash = window.location.hash;
    if (modeFromHash(hash) !== next || (next === "creer" && hash === "")) window.location.hash = next;
    else setMode(next);
  }

  return <GoProvider go={select}>
    <StudioSessionProvider>
      <header className="studio-header">
        <div className="shell header-inner">
          <a href="#creer" className="wordmark" aria-label="U*TTU Studio — Créer">U<span className="wordmark-star">*</span>TTU<span className="wordmark-studio">STUDIO</span></a>
          <p className="header-kill"><span>Vente HOLD</span><span>{testPhaseEnd}</span></p>
        </div>
        <div className="shell">
          <nav className="studio-nav" aria-label="Modes du studio">
            {STUDIO_MODES.map(item => <button key={item.id} type="button" className="studio-nav-item" aria-current={mode === item.id ? "page" : undefined} onClick={() => select(item.id)}>{item.label}</button>)}
          </nav>
        </div>
      </header>
      <main id="contenu" className="shell studio-main" tabIndex={-1}>
        {mode === "creer" && <CreateView />}
        {mode === "sphere" && <SpherePanel />}
        {mode === "identite" && <IdentityPanel />}
        {mode === "bibliotheque" && <LibraryPanel />}
        {mode === "studio" && <MaisonPanel />}
      </main>
      <footer className="studio-footer shell">
        <span><span className="iii">iii</span> THE BLOC · SUISSE</span>
        <span>Session locale. Le coffre est à part.</span>
        <a href={`mailto:${contactEmail}`}>Contacter le studio ↗</a>
      </footer>
    </StudioSessionProvider>
  </GoProvider>;
}
