"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { liftDelta, openBand } from "@/lib/mobile-band";
import { assetPath } from "@/lib/site";
import { chooseEdit, editHasClips } from "@/lib/montage/from-takes";
import { formatClock, videoDuration } from "@/lib/montage/edit";
import { priseReady } from "@/lib/stage";
import { TAB_HASH, tabFromLocation, type Tab } from "@/lib/studio-route";
import { useI18n } from "@/components/i18n/provider";
import { MontageStage } from "./montage-stage";
import { FilmMontage } from "./film/film-montage";
import { FormatProvider } from "./format-switch";
import { CastStage, DecorStage, PriseStage } from "./stage-screens";
import { outilFromHash, OutilsHub } from "./outils-hub";
import { ConfirmTake, ConnectSheet, CreditSheet } from "./studio-frames";
import { StudioProvider, useStudio } from "./studio-session";
import { RenduSuivi } from "./rendu-suivi";
import "./app.css";
import { StudioSplash } from "./splash";
import { BOOT_MARKS } from "@/lib/studio-boot";
import { TopBar } from "./top-bar";
import { AssistantPanel, toggleAssistant } from "./assistant-panel";
import { film2DansCePoste } from "@/lib/film/drapeau";
import { FilmPlans } from "./film/film-plans";

function stageOf(tab: Tab): "lora" | "scene" | "prise" | "montage" | "outils" {
  return tab === "scene" || tab === "prise" || tab === "montage" || tab === "outils" ? tab : "lora";
}

const STEPS: { id: "lora" | "scene" | "prise" | "montage"; key: "nav.character" | "nav.scene" | "nav.take" | "nav.edit" }[] = [
  { id: "lora", key: "nav.character" },
  { id: "scene", key: "nav.scene" },
  { id: "prise", key: "nav.take" },
  { id: "montage", key: "nav.edit" },
];

export function StudioApp({ initialTab = null }: { initialTab?: Tab | null }) {
  return <StudioProvider><AppFrame initialTab={initialTab ?? null} /></StudioProvider>;
}

const TYPING = "textarea, select, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]):not([type=reset]):not([type=color]):not([type=hidden])";

function AppFrame({ initialTab }: { initialTab: Tab | null }) {
  const studio = useStudio();
  const { t, say } = useI18n();
  const { ready, sheet, notice, setNotice, run, cast, decor, line, loadMontages, studio: vault } = studio;
  const [asked, setAsked] = useState<Tab | null>(initialTab);
  const [cutReady, setCutReady] = useState<boolean | null>(null);
  const [cutLength, setCutLength] = useState(0);
  const [outil, setOutil] = useState<string | null>(null);
  // Refonte FILM (?film2=1): PRISE becomes the plan card. Read after mount, the server HTML stays the same.
  const [film2, setFilm2] = useState(false);
  useEffect(() => { setFilm2(film2DansCePoste()); }, []);

  useEffect(() => {
    const apply = () => {
      const place = tabFromLocation(window.location.hash, window.location.search);
      if (place) setAsked(place);
      setOutil(place === "outils" ? outilFromHash(window.location.hash) : null);
      if (place === "outils") {
        window.scrollTo({ top: 0, behavior: "instant" });
        requestAnimationFrame(() => (document.getElementById("u-title") ?? document.querySelector<HTMLElement>("[data-tool-panel] h1"))?.focus({ preventScroll: true }));
      }
    };
    apply();
    // Old links (landing « Découvrir avec Uttu », ?uttu=1) open the one Uttu agent once, then drop the flag.
    const url = new URL(window.location.href);
    if (url.searchParams.get("uttu") === "1") {
      url.searchParams.delete("uttu");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      toggleAssistant(true);
    }
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const castOk = cast.some(card => Boolean(card.sheet || card.preview || card.photos.length));
  const decorOk = decor.some(card => Boolean(card.sheet || card.preview || card.geste === "repere"));
  const priseOk = vault.takes.length > 0 || vault.shots.some(shot => Boolean(shot.composeur)) || priseReady({ cast: castOk, decor: decorOk, line });
  const tab: Tab = asked ?? "outils";
  const section: "lora" | "scene" | "prise" | "montage" | "outils" = tab === "scene" || tab === "prise" || tab === "montage" || tab === "outils" ? tab : "lora";

  // Switching tab mounts a whole stage (PRISE is the heaviest). Render it as a transition so the tap
  // paints at once (the tab lights up, the old stage stays until the new one is ready) instead of
  // freezing the main thread for the full mount. Scroll and focus follow once the new stage is in.
  const [switching, startSwitch] = useTransition();
  const [target, setTarget] = useState<Tab | null>(null);
  const arrive = useRef(false);
  const shownStage = useRef(section); shownStage.current = section;
  const go = useCallback((next: Tab) => {
    const shown: Tab = next === "look" || next === "fiches" || next === "sphere" ? "lora" : next;
    setTarget(shown);
    if (stageOf(shown) === shownStage.current) {
      window.scrollTo({ top: 0, behavior: "instant" });
      requestAnimationFrame(() => document.getElementById("u-title")?.focus({ preventScroll: true }));
    } else arrive.current = true;
    startSwitch(() => { setAsked(shown); setOutil(null); });
    const hash = TAB_HASH[shown];
    const url = `${window.location.pathname}${window.location.search}#${hash}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) window.history.pushState(null, "", url);
  }, []);
  useEffect(() => {
    if (switching || !arrive.current) return;
    arrive.current = false;
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => document.getElementById("u-title")?.focus({ preventScroll: true }));
  }, [switching, section]);
  const lit = switching && target ? stageOf(target) : section;

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
      // Only fields that open the keyboard: a checkbox or a file button never moves the page.
      if (!(el instanceof HTMLElement) || !el.matches(TYPING) || !el.closest(".u-app")) return;
      const viewport = window.visualViewport;
      const visibleTop = viewport ? viewport.offsetTop : 0;
      const visibleBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
      // Bars that stay on screen: the header, the chain (bottom on a phone held upright,
      // top in MONTAGE, landscape and large screens) and the MONTAGE bar.
      const bars = [...document.querySelectorAll<HTMLElement>(".u-top, .u-tabs, .u-chain, .u-montage-bar")]
        .filter(bar => !bar.contains(el) && ["fixed", "sticky"].includes(getComputedStyle(bar).position))
        .map(bar => bar.getBoundingClientRect())
        .map(box => ({ top: box.top, bottom: box.bottom }));
      const rect = el.getBoundingClientRect();
      const band = openBand(bars, visibleTop, visibleBottom, rect.height);
      const delta = liftDelta(rect, band.top, band.bottom);
      if (delta === 0) return;
      // MONTAGE on a large screen scrolls inside its panel, not the page.
      let box: HTMLElement | null = el.parentElement;
      while (box && box !== document.body) {
        const overflow = getComputedStyle(box).overflowY;
        if ((overflow === "auto" || overflow === "scroll") && box.scrollHeight > box.clientHeight + 1) break;
        box = box.parentElement;
      }
      const scroller = box && box !== document.body ? box : document.documentElement;
      const previous = scroller.style.scrollBehavior;
      scroller.style.scrollBehavior = "auto";
      if (scroller === document.documentElement) window.scrollBy(0, delta);
      else scroller.scrollBy(0, delta);
      scroller.style.scrollBehavior = previous;
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

  // Once the studio is ready the early home is over: drop the marks STUDIO_BOOT left on <html>.
  useEffect(() => {
    if (ready) for (const mark of BOOT_MARKS) document.documentElement.removeAttribute(mark);
  }, [ready]);

  const montageKey = `${vault.project ?? ""}|${vault.sequences.length}|${vault.shots.length}|${vault.takes.length}`;
  useEffect(() => {
    if (!ready) return;
    let gone = false;
    void loadMontages().then(saved => {
      if (gone) return;
      const choice = chooseEdit({ saved, sequences: vault.sequences, shots: vault.shots, takes: vault.takes });
      setCutReady(editHasClips(choice.edit));
      setCutLength(videoDuration(choice.edit));
    });
    return () => { gone = true; };
  }, [ready, montageKey, loadMontages, vault.sequences, vault.shots, vault.takes]);

  const marks: Record<"lora" | "scene" | "prise" | "montage", boolean> = {
    lora: castOk,
    scene: decorOk,
    prise: priseOk,
    montage: cutReady === true,
  };

  return <FormatProvider><div className="u-app" data-studio={section} data-film2={film2 && section !== "outils" ? "" : undefined}>
    <TopBar place={section === "montage" ? "montage" : section === "outils" ? "creer" : "realiser"} />
    {section !== "outils" && film2 && <FilmNav lit={lit} running={run.phase === "running"} montage={cutReady === true ? formatClock(cutLength) : null} go={go} />}
    {section !== "outils" && !film2 && <nav className="u-chain" aria-label={t("nav.chain")}>
      {STEPS.map(step => <button key={step.id} type="button" aria-current={lit === step.id ? "page" : undefined} data-state={marks[step.id] ? "pret" : "vide"} onClick={() => go(step.id)}>
        <span>{t(step.key)}</span>
        <small>{marks[step.id] ? t("stage.ready") : t("stage.empty")}</small>
        {step.id === "prise" && run.phase === "running" && <span className="u-pulse" aria-label={t("nav.takeRunning")} />}
      </button>)}
    </nav>}
    <main id="contenu" className="u-main" tabIndex={-1} aria-busy={!ready || switching} data-switching={switching ? "" : undefined}>
      {ready && <RenduSuivi />}
      {/* F14 · The home (title, bar, the film door with the LCP picture) is in the server HTML and does
          not wait for the local studio. A stage or a tool still opens behind the splash. Same slot before
          and after ready, so the home is never mounted twice. */}
      {section === "outils" && (ready || !outil) ? <OutilsHub tool={outil} early={!ready} />
        : !ready ? <StudioSplash />
        : section === "scene" ? <DecorStage onPrise={() => go("prise")} />
        : section === "prise" ? (film2
          ? <FilmPlans goCast={() => go("lora")} goDecor={() => go("scene")} onMontage={() => go("montage")} />
          : <PriseStage goCast={() => go("lora")} goDecor={() => go("scene")} onMontage={() => go("montage")} />)
        : section === "montage" ? (film2 ? <FilmMontage onFilled={setCutReady} onPlans={() => go("prise")} /> : <MontageStage onFilled={setCutReady} />)
        : <CastStage onDecor={() => go("scene")} />}
      {/* Shown instead of the home only when the address already asks for a stage (see STUDIO_BOOT). */}
      {!ready && section === "outils" && !outil && <StudioSplash early />}
    </main>
    {/* PRISE and MONTAGE show the notice inline (near the action / under the header); the floating toast stays for other tabs and over sheets. */}
    {notice && !((section === "prise" || section === "montage") && !studio.sheet) && <p className="u-toast" role="status" onClick={() => setNotice("")}>{say(notice)}</p>}
    <AssistantPanel />
    {sheet === "credits" && <CreditSheet />}
    {sheet === "connect" && <ConnectSheet />}
    {sheet === "confirm" && <ConfirmTake />}
  </div></FormatProvider>;
}

/** Refonte FILM (PR 9, F9): two views only, PRISE (the plans) | MONTAGE. CAST and DÉCOR keep their titles
    as libraries, opened from Qui and Où or from the menu. */
function FilmNav({ lit, running, montage, go }: { lit: string; running: boolean; montage: string | null; go(tab: "prise" | "montage"): void }) {
  const { t } = useI18n();
  return <nav className="u-chain u-film-nav" aria-label={t("film2.nav.aria")} data-film-nav="">
    <button type="button" aria-current={lit === "prise" ? "page" : undefined} data-film-nav-to="prise" onClick={() => go("prise")}>
      <span>{t("nav.take")}</span><small>{t("film2.nav.plans")}</small>
      {running && <span className="u-pulse" aria-label={t("nav.takeRunning")} />}
    </button>
    <button type="button" aria-current={lit === "montage" ? "page" : undefined} data-film-nav-to="montage" onClick={() => go("montage")}>
      <span>{t("nav.edit")}</span><small>{montage ?? t("film2.nav.vide")}</small>
    </button>
  </nav>;
}
