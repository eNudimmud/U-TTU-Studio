"use client";

// One top bar for every studio page:
// logo · Accueil · Créer ▾ · Film ▾ · Mes créations ▾ | search · account and credits · language menu.
// The project switcher lives only in Film. Below 1024 px the same items live in one drawer.
// The rail (from 768 px) and the bottom bar (phones) come with it: see studio-nav.tsx.

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { formatCredits } from "@/lib/credits";
import { assetPath } from "@/lib/site";
import { studioTarget } from "@/lib/coffre/target";
import { FAMILLES, cherche, colonnes, familleVitrine, outilsPublics, type Outil } from "@/lib/outils/catalogue";
import { clearTasks, listTasks, subscribeTasks, type Task } from "@/lib/tasks";
import { LanguageSwitcher, useI18n } from "@/components/i18n/provider";
import { Brand } from "@/components/brand";
import { useStudio } from "./studio-session";
import { toggleAssistant, useAssistantOpen } from "./assistant-panel";
import { StudioRail, StudioTabs, useTopHeight } from "./studio-nav";


const ICON = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const SearchIcon = () => <svg {...ICON}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>;
const BellIcon = () => <svg {...ICON}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>;
const MenuIcon = () => <svg {...ICON}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
const CloseIcon = () => <svg {...ICON}><path d="M6 6l12 12M18 6 6 18" /></svg>;

export type Place = "accueil" | "creer" | "realiser" | "montage" | "creations";

export const CREATION_TYPES = ["images", "videos", "3d", "sons", "personnages", "lieux", "prises"] as const;
export type CreationType = (typeof CREATION_TYPES)[number];

const FILM: { id: string; href: string; label: "nav.character" | "nav.scene" | "nav.take" | "nav.edit" }[] = [
  { id: "cast", href: "/studio#personnage", label: "nav.character" },
  { id: "decor", href: "/studio#scene", label: "nav.scene" },
  { id: "prise", href: "/studio#prise", label: "nav.take" },
  { id: "montage", href: "/studio#montage", label: "nav.edit" },
];

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

export function TopBar({ place }: { place: Place }) {
  const { t, say } = useI18n();
  const { connected, balance, balanceNote, setSheet } = useStudio();
  const assistantOpen = useAssistantOpen();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  useTopHeight();
  const renderAria = !connected ? t("sheet.notLinked") : balance ? t("sheet.credits", { amount: formatCredits(balance.credits) }) : (balanceNote ? say(balanceNote) : t("sheet.balanceUnread"));

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
        <Brand className="u-mark" href={assetPath("/studio")} />
        {(place === "realiser" || place === "montage") && <ProjectSwitcher />}
      </div>
      <nav className="u-top-nav" aria-label={t("top.nav")}>
        <MainNav place={place} />
      </nav>
      <div className="u-top-tools">
        <button type="button" className="u-top-icon u-top-search" data-top-search="" aria-label={t("top.searchAria")} onClick={() => setPalette(true)}>
          <SearchIcon /><span className="u-tool-label">{t("top.search")}</span><kbd className="u-kbd">Ctrl K</kbd>
        </button>
        <button type="button" className="u-uttu" data-top-uttu="" aria-expanded={assistantOpen} aria-controls="u-assistant" aria-label={t("uttu.openAria")} onClick={() => toggleAssistant(!assistantOpen)}>{t("uttu.button")}</button>
        <button type="button" className="u-credit" onClick={() => setSheet("credits")} aria-label={t("sheet.walletAria", { render: renderAria })}>
          <span className="u-tool-full">{connected && balance ? `${t("sheet.walletTitle")} · ${formatCredits(balance.credits)}` : t("sheet.walletTitle")}</span>
          <span className="u-tool-short">{connected && balance ? formatCredits(balance.credits) : t("stage.creditsShort")}</span>
        </button>
        <LangMenu />
        <button type="button" className="u-top-icon u-burger" data-top-burger="" aria-expanded={drawer} aria-controls="u-drawer" aria-label={t("top.menu")} onClick={() => setDrawer(true)}><MenuIcon /></button>
      </div>
    </header>
    {drawer && <div className="u-drawer-scrim" onClick={() => setDrawer(false)}>
      <aside id="u-drawer" className="u-drawer" data-drawer="" role="dialog" aria-modal="true" aria-label={t("top.menu")} onClick={event => event.stopPropagation()}>
        <div className="u-drawer-head">
          {(place === "realiser" || place === "montage") && <ProjectSwitcher inDrawer />}
          <button type="button" className="u-top-icon" aria-label={t("top.close")} onClick={() => setDrawer(false)}><CloseIcon /></button>
        </div>
        <nav aria-label={t("top.nav")} className="u-drawer-nav"><MainNav place={place} drawer onPick={() => setDrawer(false)} /></nav>
        <div className="u-drawer-foot">
          <TasksBell />
          <button type="button" className="u-secondary" data-drawer-assistant="" onClick={() => { setDrawer(false); toggleAssistant(true); }}>{t("uttu.title")}</button>
          <LanguageSwitcher />
        </div>
      </aside>
    </div>}
    <StudioRail place={place} onSearch={() => setPalette(true)} />
    <StudioTabs place={place} />
    {palette && <SearchPalette onClose={() => setPalette(false)} />}
  </>;
}

function MainNav({ place, drawer = false, onPick }: { place: Place; drawer?: boolean; onPick?(): void }) {
  const { t } = useI18n();
  const current = (here: Place) => place === here ? "page" as const : undefined;
  return <ul className="u-top-links" role="list">
    <li><a href={assetPath("/")} onClick={onPick} aria-current={current("accueil")}>{t("top.home")}</a></li>
    <li><Dropdown id="creer" label={t("top.create")} current={place === "creer"} drawer={drawer}>{close => <CreerMenu drawer={drawer} onPick={() => { close(); onPick?.(); }} />}</Dropdown></li>
    <li><Dropdown id="film" label={t("top.film")} current={place === "realiser" || place === "montage"} drawer={drawer}>{close => <FilmMenu onPick={() => { close(); onPick?.(); }} />}</Dropdown></li>
    <li><Dropdown id="creations" label={t("top.creations")} current={place === "creations"} drawer={drawer}>{close => <CreationsMenu onPick={() => { close(); onPick?.(); }} />}</Dropdown></li>
  </ul>;
}

function Dropdown({ id, label, current, drawer, children }: { id: string; label: string; current: boolean; drawer: boolean; children(close: () => void): ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useMemo(() => () => setOpen(false), []);
  useDismiss(open && !drawer, close, root);
  return <div className="u-dd" ref={root} data-dd={id} data-open={open ? "" : undefined}>
    <button type="button" className="u-dd-toggle" data-top-menu={id} aria-expanded={open} aria-controls={menuId} aria-current={current ? "page" : undefined} onClick={() => setOpen(value => !value)}>
      {label}<span aria-hidden="true" className="u-dd-caret">▾</span>
    </button>
    <div id={menuId} className={drawer ? "u-dd-panel u-dd-inline" : "u-dd-panel"} hidden={!open}>{open && children(close)}</div>
  </div>;
}

function FilmMenu({ onPick }: { onPick(): void }) {
  const { t } = useI18n();
  return <ul className="u-dd-list" role="list" data-film-menu="">
    {FILM.map(item => <li key={item.id}><a href={assetPath(item.href)} onClick={onPick} data-film={item.id}>{t(item.label)}</a></li>)}
  </ul>;
}

function CreerMenu({ onPick, drawer = false }: { onPick(): void; drawer?: boolean }) {
  const { t } = useI18n();
  const { prefs } = useStudio();
  const cards = outilsPublics(prefs);
  return <div className="u-mega" data-creer-menu="">
    <div className="u-mega-cols">
      {FAMILLES.flatMap(fam => {
        const items = cards.filter(item => familleVitrine(item) === fam);
        // In the drawer a family is one list: split columns would leave an empty heading gap.
        return colonnes(items, drawer ? Math.max(items.length, 1) : 8).map((col, index) => <section key={`${fam}-${index}`} className="u-mega-col" aria-label={index === 0 ? t(`outils.fam.${fam}`) : undefined}>
          <h2>{index === 0 ? t(`outils.fam.${fam}`) : "\u00a0"}</h2>
          <ul role="list">
            {col.map(item => <li key={item.id}><MegaItem outil={item} onPick={onPick} /></li>)}
          </ul>
        </section>);
      })}
    </div>
    <a className="u-secondary u-mega-all" href={assetPath("/studio#outils")} onClick={onPick} data-top-outils="">{t("outils.seeAll")}</a>
  </div>;
}

function MegaItem({ outil, onPick }: { outil: Outil; onPick(): void }) {
  const { t } = useI18n();
  return <a className="u-mega-item" href={assetPath(`/studio#outils/${outil.id}`)} onClick={onPick} data-mega-outil={outil.id}>
    <strong>{t(`outils.t.${outil.id}.title`)}</strong>
    <span>{t(`outils.t.${outil.id}.line`)}</span>
  </a>;
}

function CreationsMenu({ onPick }: { onPick(): void }) {
  const { t } = useI18n();
  return <ul className="u-dd-list" role="list" data-creations-menu="">
    <li><a href={assetPath("/mon-studio")} onClick={onPick} data-top-creations="">{t("creations.all")}</a></li>
    {CREATION_TYPES.map(type => <li key={type}><a href={assetPath(`/mon-studio?type=${type}`)} onClick={onPick} data-creations-type={type}>{t(`creations.type.${type}`)}</a></li>)}
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
  const label = studio.projectName || t("projects.none");
  return <div className={inDrawer ? "u-proj u-proj-drawer" : "u-proj"} ref={root} data-project-switcher="">
    <button type="button" className="u-proj-toggle" aria-expanded={open} aria-controls={panelId} aria-busy={!ready || undefined} onClick={() => setOpen(value => !value)} aria-label={t("projects.switchAria", { name: label })}>
      <span className="u-proj-label">{t("projects.label")}</span>
      <span className="u-project-name">{label}</span>
      <span aria-hidden="true" className="u-dd-caret">▾</span>
    </button>
    <div id={panelId} className="u-proj-panel" hidden={!open}>
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
          {(task.state === "failed" || task.state === "interrupted") && <a className="u-link" data-task-relaunch="" href={assetPath(task.tool ? `/studio#outils/${task.tool}` : task.id === "prise" ? "/studio#prise" : task.label === "taches.decor" ? "/studio#scene" : "/studio#personnage")} onClick={close}>{t("taches.relaunch")}</a>}
        </li>)}
      </ul>}
      {tasks.some(task => task.state !== "running") && <button type="button" className="u-link" onClick={() => clearTasks()}>{t("taches.clear")}</button>}
      <p className="u-small">{t("taches.rule")}</p>
    </div>
  </div>;
}

function LangMenu() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = useMemo(() => () => setOpen(false), []);
  useDismiss(open, close, root);
  return <div className="u-dd u-top-lang" ref={root} data-lang-menu="">
    <button type="button" className="u-top-icon" aria-expanded={open} aria-controls={menuId} aria-label={t("lang.label")} data-top-lang="" onClick={() => setOpen(value => !value)}>Aa</button>
    <div id={menuId} className="u-dd-panel u-lang-panel" hidden={!open}><LanguageSwitcher /></div>
  </div>;
}

/** Ctrl K: tools and my creations in one list. */
function SearchPalette({ onClose }: { onClose(): void }) {
  const { t } = useI18n();
  const { prefs, cast, decor, studio, loose, demo } = useStudio();
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  const needle = query.trim();
  const tools = outilsPublics(prefs).filter(item => !needle || cherche(`${t(`outils.t.${item.id}.title`)} ${t(`outils.t.${item.id}.line`)} ${t(`outils.fam.${familleVitrine(item)}`)}`, needle)).slice(0, needle ? 8 : 6);
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
        <h2>{t("top.paletteTools")}</h2>
        {tools.length === 0 ? <p className="u-small">{t("outils.none")}</p> : <ul role="list">
          {tools.map(item => <li key={item.id}><a href={assetPath(`/studio#outils/${item.id}`)} onClick={onClose} data-palette-outil={item.id}><strong>{t(`outils.t.${item.id}.title`)}</strong><span>{t(`outils.t.${item.id}.line`)}</span></a></li>)}
        </ul>}
        <h2>{t("top.creations")}</h2>
        {mine.length === 0 ? <p className="u-small">{needle ? t("top.paletteNone") : t("top.paletteEmpty")}</p> : <ul role="list">
          {mine.map(item => <li key={item.id}><a href={assetPath(item.href)} onClick={onClose} data-palette-creation=""><strong>{item.name}</strong><span>{item.kind}</span></a></li>)}
        </ul>}
      </div>
    </div>
  </div>;
}
