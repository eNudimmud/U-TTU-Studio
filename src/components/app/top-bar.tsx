"use client";

// One top bar for every studio page:
// logo · Accueil · Créer ▾ · Film ▾ · Mes créations ▾ | search · account and credits · language menu.
// The project switcher lives only in Film. Below 1024 px the same items live in one drawer.
// The rail (from 768 px) and the bottom bar (phones) come with it: see studio-nav.tsx.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatCredits } from "@/lib/credits";
import { assetPath } from "@/lib/site";
import { studioTarget } from "@/lib/coffre/target";
import { cherche, familleVitrine, outilsPublics } from "@/lib/outils/catalogue";
import { clearTasks, listTasks, subscribeTasks, type Task } from "@/lib/tasks";
import { LanguageSwitcher, useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { Brand } from "@/components/brand";
import { resumeTab, TAB_HASH, type Tab } from "@/lib/studio-route";
import { useStudio } from "./studio-session";
import { toggleAssistant, useAssistantOpen } from "./assistant-panel";
import { StudioTabs, useTopHeight } from "./studio-nav";
import { ProjectChain } from "./project-chain";


const ICON = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const SearchIcon = () => <svg {...ICON}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>;
const BellIcon = () => <svg {...ICON}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>;
const MenuIcon = () => <svg {...ICON}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
const CloseIcon = () => <svg {...ICON}><path d="M6 6l12 12M18 6 6 18" /></svg>;

export type Place = "accueil" | "creer" | "realiser" | "montage" | "finish" | "creations" | "look" | "storyboard";

export const CREATION_TYPES = ["images", "videos", "3d", "sons", "personnages", "lieux", "prises"] as const;
export type CreationType = (typeof CREATION_TYPES)[number];

const FILM_PLACE: Place[] = ["realiser", "montage", "finish"];

/** Closes a popover on Escape and on a press outside `root`. */
function useDismiss(open: boolean, close: () => void, root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { close(); } };
    const press = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) close(); };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", press, true);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", press, true); };
  }, [open, close, root]);
}

function useTasks(): Task[] {
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => { setTasks(listTasks()); return subscribeTasks(setTasks); }, []);
  return tasks;
}

export function TopBar({ place, step = null, onStep, cutReady = false }: { place: Place; step?: string | null; onStep?(tab: Tab): void; cutReady?: boolean }) {
  const { t, say } = useI18n();
  const { ready, connected, balance, balanceNote, setSheet, cast, decor } = useStudio();
  const own = (id: string) => !id.startsWith("demo-");
  const castReady = cast.some(card => own(card.id) && Boolean(card.sheet || card.preview || card.photos.length));
  const decorReady = decor.some(card => own(card.id) && Boolean(card.sheet || card.preview));
  const assistantOpen = useAssistantOpen();
  const lookReady = cast.some(card => Boolean(card.sheet || card.preview || card.photos.length));
  const hasScene = decor.some(card => Boolean(card.sheet || card.preview || card.geste === "repere"));
  const resumeHref = `/studio/legacy#${TAB_HASH[resumeTab({ lookReady, hasScene })]}`;
  const here = step && ["lora", "scene", "prise", "montage", "finaliser"].includes(step) ? `/studio/legacy#${TAB_HASH[step as Tab]}` : null;
  const filmHref = here ?? resumeHref;
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  useTopHeight();
  const creditsLoading = !ready || (connected && !balance && !balanceNote);
  const renderAria = creditsLoading
    ? t("sheet.balanceLoading")
    : !connected
      ? t("sheet.notLinked")
      : balance
        ? t("sheet.credits", { amount: formatCredits(balance.credits) })
        : (balanceNote ? say(balanceNote) : t("sheet.balanceUnread"));

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette(true); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!drawer) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawer(false); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [drawer]);

  return <>
    <header className="u-top u-topbar" data-topbar="">
      <div className="u-top-left">
        <Brand className="u-mark" href={assetPath("/")} />
      </div>
      <nav className="u-top-nav" aria-label={t("top.nav")}>
        <MainNav place={place} filmHref={filmHref} />
      </nav>
      <div className="u-top-tools">
        <button type="button" className="u-top-icon u-top-search" data-top-search="" aria-label={t("top.searchAria")} onClick={() => setPalette(true)}>
          <SearchIcon /><span className="u-tool-label">{t("top.search")}</span><kbd className="u-kbd">Ctrl K</kbd>
        </button>
        <a className="u-top-guide" href={assetPath("/guide")} data-top-guide="">{t("chrome.guide")} <span aria-hidden="true">↗</span></a>
        <LangMenu />
        <button type="button" className="u-credit" onClick={() => setSheet("credits")} aria-label={t("sheet.walletAria", { render: renderAria })} aria-busy={creditsLoading || undefined}>
          <span className="u-tool-full">{connected && balance ? `${formatCredits(balance.credits)} ${t("nav.credits")}` : creditsLoading ? "…" : t("sheet.walletTitle")}</span>
          <span className="u-tool-short">{connected && balance ? formatCredits(balance.credits) : creditsLoading ? "…" : t("stage.creditsShort")}</span>
        </button>
        <button type="button" className="u-uttu u-uttu-face" data-top-uttu="" aria-expanded={assistantOpen} aria-controls="u-assistant" aria-label={t("uttu.openAria")} onClick={() => toggleAssistant(!assistantOpen)}>
          <img src={assetPath("/images/uttu-portrait.webp")} alt="" width={36} height={36} /><span className="u-uttu-name">{t("chrome.uttu")}</span>
        </button>
        <button type="button" className="u-top-icon u-burger" data-top-burger="" aria-expanded={drawer} aria-controls="u-drawer" aria-label={t("chrome.menuAria")} onClick={() => setDrawer(true)}><MenuIcon /></button>
      </div>
    </header>
    <ProjectChain step={step ?? (place === "look" ? "look" : null)} onStep={onStep} project={<ProjectSwitcher />} uttuOpen={assistantOpen} onUttu={() => toggleAssistant(!assistantOpen)} onMenu={() => setDrawer(true)} ready={{ lora: castReady, scene: decorReady, prise: castReady && decorReady, montage: cutReady, finaliser: cutReady }} />
    {drawer && <div className="u-drawer-scrim" onClick={() => setDrawer(false)}>
      <aside id="u-drawer" className="u-drawer" data-drawer="" role="dialog" aria-modal="true" aria-label={t("top.menu")} onClick={event => event.stopPropagation()}>
        <div className="u-drawer-head">
          <ProjectSwitcher inDrawer />
          <button type="button" className="u-top-icon" aria-label={t("top.close")} onClick={() => setDrawer(false)}><CloseIcon /></button>
        </div>
        <nav aria-label={t("top.nav")} className="u-drawer-nav">
          <MainNav place={place} filmHref={filmHref} onPick={() => setDrawer(false)} />
          <a className="u-top-guide" href={assetPath("/guide")} data-top-guide="" onClick={() => setDrawer(false)}>{t("chrome.guide")} ↗</a>
        </nav>
        <div className="u-drawer-foot">
          <TasksBell />
          <button type="button" className="u-secondary" data-drawer-search="" onClick={() => { setDrawer(false); setPalette(true); }}>{t("top.search")}</button>
          <button type="button" className="u-secondary" data-drawer-assistant="" onClick={() => { setDrawer(false); toggleAssistant(true); }}>{t("uttu.title")}</button>
          <LanguageSwitcher />
        </div>
      </aside>
    </div>}
    <StudioTabs place={place} filmHref={filmHref} />
    {palette && <SearchPalette onClose={() => setPalette(false)} />}
  </>;
}

function MainNav({ place, filmHref, onPick }: { place: Place; filmHref: string; onPick?(): void }) {
  const { t } = useI18n();
  const film = FILM_PLACE.includes(place);
  return <ul className="u-top-links" role="list">
    <li><a href={assetPath("/studio/legacy")} onClick={onPick} data-top-studio="" aria-current={place === "creer" ? "page" : undefined}>{t("chrome.studio")}</a></li>
    <li><a href={assetPath(filmHref)} onClick={onPick} data-top-film="" aria-current={film ? "page" : undefined}>{t("top.film")}</a></li>
    <li><a href={assetPath("/mon-studio")} onClick={onPick} data-top-creations="" aria-current={place === "creations" ? "page" : undefined}>{t("chrome.mine")}</a></li>
  </ul>;
}

/** Current project at top-left: one click to switch or create. Projects are folders of the vault (Obsidian). */
export function ProjectSwitcher({ inDrawer = false }: { inDrawer?: boolean }) {
  const { t } = useI18n();
  const { studio, selectProject, createProject, ready } = useStudio();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const close = useMemo(() => () => setOpen(false), []);
  useDismiss(open, close, root);
  // In the steps row the panel is fixed to the viewport: the row scrolls sideways (overflow:auto) and would clip it.
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!open || inDrawer) { setPlace(null); return; }
    const toggle = root.current?.querySelector("button");
    if (!toggle) return;
    const measure = () => {
      const rect = toggle.getBoundingClientRect();
      setPlace({ top: Math.round(rect.bottom + 6), left: Math.round(Math.max(8, Math.min(rect.left, window.innerWidth - 308))) });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [open, inDrawer]);
  const label = studio.projectName || t("projects.none");
  return <div className={inDrawer ? "u-proj u-proj-drawer" : "u-proj"} ref={root} data-project-switcher="">
    <button type="button" className="u-proj-toggle" aria-expanded={open} aria-controls={panelId} aria-busy={!ready || undefined} onClick={() => setOpen(value => !value)} aria-label={t("projects.switchAria", { name: label })}>
      <span className="u-proj-label">{t("projects.label")}</span>
      <span className="u-project-name">{label}</span>
      <span aria-hidden="true" className="u-dd-caret">▾</span>
    </button>
    <div id={panelId} className="u-proj-panel" hidden={!open} data-floating={place ? "" : undefined} style={place ? { position: "fixed", top: place.top, left: place.left } : undefined}>
      {studio.projects.length > 0 && <ul role="list" className="u-dd-list">
        {studio.projects.map(project => <li key={project.slug}><button type="button" aria-current={studio.project === project.slug ? "true" : undefined} data-project={project.slug} onClick={() => { setOpen(false); void selectProject(project.slug); }}>{project.name}</button></li>)}
      </ul>}
      {studio.projects.length === 0 && <p className="u-small">{t("projects.empty")}</p>}
      <form className="u-proj-new" onSubmit={event => { event.preventDefault(); const value = name.trim(); if (!value) return; setName(""); setOpen(false); void createProject(value); }}>
        <label className="u-field"><span className="u-label">{t("projects.new")}</span>
          <input value={name} maxLength={60} onChange={event => setName(event.target.value)} placeholder={t("projects.placeholder")} data-project-new="" />
        </label>
        <button type="submit" className="u-secondary" disabled={!name.trim()} aria-describedby={!name.trim() ? `${panelId}-why` : undefined} data-project-create="">{t("projects.create")}</button>
        {!name.trim() && <span id={`${panelId}-why`} className="u-small">{t("projects.needName")}</span>}
      </form>
      <a className="u-link" href={assetPath("/mon-studio#coffre")}>{t("projects.vault")}</a>
    </div>
  </div>;
}

function TasksBell() {
  const { t, say } = useI18n();
  const { run } = useStudio();
  const tasks = useTasks();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const close = useMemo(() => () => setOpen(false), []);
  useDismiss(open, close, root);
  const live: Task[] = run.phase === "running" ? [{ id: "prise", tool: null, label: "taches.take", state: "running", reason: "", at: Date.now(), ended: null }]
    : run.phase === "error" ? [{ id: "prise", tool: null, label: "taches.take", state: "failed", reason: run.message, at: Date.now(), ended: Date.now() }] : [];
  const all = [...live, ...tasks];
  const running = all.filter(task => task.state === "running").length;
  const failed = all.filter(task => task.state === "failed").length;
  return <div className="u-tasks" ref={root} data-tasks="">
    <button type="button" className="u-top-icon" data-top-tasks="" aria-expanded={open} aria-controls={panelId} aria-label={t("taches.aria", { running: String(running), failed: String(failed) })} onClick={() => setOpen(value => !value)}>
      <BellIcon /><span className="u-tool-label">{t("taches.title")}</span>
      {(running > 0 || failed > 0) && <span className="u-badge" data-failed={failed > 0 ? "" : undefined}>{running + failed}</span>}
    </button>
    <div id={panelId} className="u-tasks-panel" role="region" aria-label={t("taches.title")} hidden={!open}>
      <h2>{t("taches.title")}</h2>
      {all.length === 0 ? <p className="u-small">{t("taches.empty")}</p> : <ul role="list">
        {all.map(task => <li key={task.id} className="u-task" data-task-state={task.state}>
          <strong>{task.plain ? task.label : t(task.label)}</strong>
          <span className="u-task-state">{t(`taches.state.${task.state}`)}</span>
          {task.reason && <span className="u-task-why">{say(task.reason)}</span>}
          {(task.state === "failed" || task.state === "interrupted") && <a className="u-link" data-task-relaunch="" href={assetPath(task.tool ? `/studio/legacy#outils/${task.tool}` : task.id === "prise" ? "/studio/legacy#prise" : task.label === "taches.decor" ? "/studio/legacy#scene" : "/studio/legacy#personnage")} onClick={close}>{t("taches.relaunch")}</a>}
        </li>)}
      </ul>}
      {tasks.some(task => task.state !== "running") && <button type="button" className="u-link" onClick={() => clearTasks()}>{t("taches.clear")}</button>}
      <p className="u-small">{t("taches.rule")}</p>
    </div>
  </div>;
}

function LangMenu() {
  const { t } = useI18n();
  const { locale } = useLocaleSwitch();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useMemo(() => () => setOpen(false), []);
  useDismiss(open, close, root);
  return <div className="u-dd u-top-lang" ref={root} data-lang-menu="">
    <button type="button" className="u-top-icon" aria-expanded={open} aria-controls={menuId} aria-label={t("lang.label")} data-top-lang="" onClick={() => setOpen(value => !value)}>{locale.toUpperCase()}</button>
    <div id={menuId} className="u-dd-panel u-lang-panel" hidden={!open}><LanguageSwitcher /></div>
  </div>;
}

/** Ctrl K: tools and my creations in one list. */
function SearchPalette({ onClose }: { onClose(): void }) {
  const { t } = useI18n();
  const { outilsFiltre, cast, decor, studio, loose, demo } = useStudio();
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  const needle = query.trim();
  const places = [
    { id: "look", href: "/anime", label: t("chrome.look"), line: t("chrome.lookAnime") },
    { id: "finish", href: "/studio/legacy#finaliser", label: t("nav.finish"), line: t("chrome.finishLead") },
    { id: "guide", href: "/guide", label: t("chrome.guide"), line: t("chrome.openGuide") },
  ].filter(item => !needle || cherche(`${item.label} ${item.line}`, needle));
  const tools = outilsPublics(outilsFiltre).filter(item => !needle || cherche(`${t(`outils.t.${item.id}.title`)} ${t(`outils.t.${item.id}.line`)} ${t(`outils.fam.${familleVitrine(item)}`)}`, needle)).slice(0, needle ? 8 : 6);
  const mine = [
    ...cast.map(card => ({ id: `c-${card.id}`, name: card.name, kind: t("creations.type.personnages"), href: studioTarget("personnage", card.id, studio.project, demo) })),
    ...decor.map(card => ({ id: `d-${card.id}`, name: card.name, kind: t("creations.type.lieux"), href: studioTarget("lieu", card.id, studio.project, demo) })),
    ...studio.takes.map(take => ({ id: `p-${take.id}`, name: take.line || take.id, kind: t("creations.type.prises"), href: studioTarget("prise", take.id, studio.project, demo) })),
    ...loose.map(asset => ({ id: `a-${asset.id}`, name: asset.name, kind: t("top.creations"), href: `/mon-studio?item=${encodeURIComponent(asset.id)}` })),
  ].filter(item => item.name && (!needle || cherche(item.name, needle))).slice(0, 8);
  return <div className="u-palette-scrim" onClick={onClose}>
    <div className="u-palette" role="dialog" aria-modal="true" aria-label={t("top.search")} data-palette="" onClick={event => event.stopPropagation()}>
      <input ref={input} type="search" className="u-palette-input" value={query} onChange={event => setQuery(event.target.value)} placeholder={t("top.searchPlaceholder")} aria-label={t("top.searchAria")} data-palette-input="" />
      <div className="u-palette-body">
        <h2>{t("chrome.places")}</h2>
        <ul role="list">
          {places.map(item => <li key={item.id}><a href={assetPath(item.href)} onClick={onClose} data-palette-place={item.id}><strong>{item.label}</strong><span>{item.line}</span></a></li>)}
        </ul>
        <h2>{t("top.paletteTools")}</h2>
        {tools.length === 0 ? <p className="u-small">{t("outils.none")}</p> : <ul role="list">
          {tools.map(item => <li key={item.id}><a href={assetPath(`/studio/legacy#outils/${item.id}`)} onClick={onClose} data-palette-outil={item.id}><strong>{t(`outils.t.${item.id}.title`)}</strong><span>{t(`outils.t.${item.id}.line`)}</span></a></li>)}
        </ul>}
        <h2>{t("top.creations")}</h2>
        {mine.length === 0 ? <p className="u-small">{needle ? t("top.paletteNone") : t("top.paletteEmpty")}</p> : <ul role="list">
          {mine.map(item => <li key={item.id}><a href={assetPath(item.href)} onClick={onClose} data-palette-creation=""><strong>{item.name}</strong><span>{item.kind}</span></a></li>)}
        </ul>}
      </div>
    </div>
  </div>;
}
