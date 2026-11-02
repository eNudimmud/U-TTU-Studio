"use client";

import { useState, type ReactNode } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { formatClock } from "@/lib/montage/edit";
import { suiteQuote } from "@/lib/suite/quote";
import { devisPlan } from "@/lib/storyboard/devis";
import { U11_AGENT_CEILING } from "@/lib/storyboard/u11-agent";
import { tousLesPlans, type PlanSB, type RefPlan, type Storyboard } from "@/lib/storyboard/storyboard";
import { costLine } from "@/lib/storyweave/cost";
import { cuesOf, scenesOf, wordCount } from "@/lib/storyweave/script";
import { shotRows, type SwEdit } from "@/lib/storyweave/timeline";
import type { SwVersion } from "@/lib/storyweave/versions";
import { zipStore } from "@/lib/storyweave/zip";
import { useStudio } from "../app/studio-session";
import { Icon, ICON } from "./icons";
import type { Storyboards } from "../storyboard/use-storyboards";

export type SwView = "overview" | "script" | "audio" | "shot" | "element";
export type SwElement = { kind: "cast" | "place" | "prop"; name: string; files: { name: string; url: string }[] };

function words(text: string): string {
  return text.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
}

function costText(t: (key: string, values?: Record<string, string>) => string, credits: number | null) {
  const line = costLine(credits);
  return line.kind === "estimated" ? t("storyboard.md.credits", { n: formatCredits(line.credits) }) : t("storyweave.beforeLaunch");
}

async function saveZip(name: string, files: { name: string; url: string }[]) {
  const packed: { name: string; data: Uint8Array }[] = [];
  for (const file of files) {
    if (!file.url) continue;
    try {
      const response = await fetch(file.url);
      if (!response.ok) continue;
      packed.push({ name: file.name, data: new Uint8Array(await response.arrayBuffer()) });
    } catch { /* a missing file is skipped, the rest still download */ }
  }
  if (!packed.length) return false;
  const bytes = zipStore(packed);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name.endsWith(".zip") ? name : `${name}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
  return true;
}

export function Panel({
  sb, data, edit, view, shotId, element, versions, savedLabel, pictureOf, filesFor, missingPicture, locked, filming,
  onView, onShot, onElement, onClose, onLayout, onPublish, onRestore, onExport, onLock, onEngine, onFilm, onFinish, onKeep, onRewrite, onLine,
}: {
  sb: Storyboard | null;
  data: Storyboards;
  edit: SwEdit;
  view: SwView;
  shotId: string | null;
  element: SwElement | null;
  versions: SwVersion[];
  savedLabel: string;
  pictureOf: (ref: RefPlan) => string;
  filesFor: (kind: SwElement["kind"], name: string) => { name: string; url: string }[];
  missingPicture: (plan: PlanSB) => boolean;
  locked: (shotId: string) => boolean;
  filming: boolean;
  onView: (view: SwView) => void;
  onShot: (shotId: string) => void;
  onElement: (element: SwElement) => void;
  onClose: () => void;
  onLayout: () => void;
  onPublish: () => void;
  onRestore: (version: SwVersion) => void;
  onExport: () => void;
  onLock: (shotId: string, on: boolean) => void;
  onEngine: (shotId: string, rendu: "fidele" | "rapide") => void;
  onFilm: (shotId: string) => void;
  onFinish: (shotId: string) => void;
  onKeep: (shotId: string) => void;
  onRewrite: (shotId: string) => void;
  onLine: (shotId: string, text: string) => void;
}) {
  const { t } = useI18n();
  const { media } = useStudio();
  const href = (path: string | null | undefined) => !path ? "" : path.startsWith("blob:") || path.startsWith("http") ? path : (media[path] ?? "");
  const [menu, setMenu] = useState<null | "version" | "export" | "engine">(null);
  const [recordNote, setRecordNote] = useState("");
  const [emptyZip, setEmptyZip] = useState("");
  const plans = sb ? tousLesPlans(sb) : [];
  const rows = sb ? shotRows(sb, edit) : [];
  const scenes = sb ? scenesOf(sb, edit) : [];
  const cues = sb ? cuesOf(sb, edit) : [];
  const filmed = plans.filter(plan => data.priseDuPlan(plan)).length;
  const total = rows.reduce((sum, row) => sum + row.duration, 0);
  const latest = versions.at(-1);
  const people = unique(plans.flatMap(plan => plan.refs.filter(ref => ref.role === "qui")));
  const places = unique(plans.flatMap(plan => plan.refs.filter(ref => ref.role === "ou")));
  const props = unique(plans.flatMap(plan => plan.refs.filter(ref => ref.role === "objet")));
  const shot = plans.find(plan => plan.id === shotId) ?? null;
  const scene = scenes.find(item => item.shotId === shotId) ?? null;

  const download = async (name: string, files: { name: string; url: string }[]) => {
    const ok = await saveZip(name, files);
    setEmptyZip(ok ? "" : t("storyweave.nothingToDownload"));
  };

  return <aside className="sw-panel" aria-label={t("storyweave.panel")} data-sw-panel="">
    <div className="sw-p-head">
      <span style={{ position: "relative" }}>
        <button type="button" className="sw-ver" aria-haspopup="menu" aria-expanded={menu === "version"} data-sw-versions="" onClick={() => setMenu(current => current === "version" ? null : "version")}>
          <em /><span>{latest ? t("storyweave.version", { n: latest.name }) : t("storyweave.version", { n: "1" })}</span>
          <span className="sw-faint sw-when">· {savedLabel}</span>
          <Icon d={ICON.down} size={14} />
        </button>
        {menu === "version" && <span className="sw-menu" role="menu">
          <button type="button" data-sw-publish="" onClick={() => { setMenu(null); onPublish(); }}>{t("storyweave.publish")}</button>
          {versions.map(version => <button key={version.id} type="button" onClick={() => { setMenu(null); onRestore(version); }}>{t("storyweave.version", { n: version.name })}</button>)}
          <span className="sw-faint" style={{ padding: "8px 12px", fontSize: 12 }}>{t("storyweave.noPublic")}</span>
        </span>}
      </span>
      <span className="sw-sp" />
      <span style={{ position: "relative" }}>
        <button type="button" className="sw-txt" aria-label={t("storyweave.export")} data-sw-export="" onClick={() => setMenu(current => current === "export" ? null : "export")}><Icon d={ICON.export} />{t("storyweave.export")}<Icon d={ICON.down} size={14} /></button>
        {menu === "export" && <span className="sw-menu" role="menu">
          <button type="button" data-sw-export-go="" onClick={() => { setMenu(null); onExport(); }}>{t("storyweave.exportVideo")}</button>
        </span>}
      </span>
      <button type="button" className="sw-ib sw-show-narrow" aria-label={t("storyweave.backChat")} onClick={onClose}><Icon d={ICON.chat} /></button>
      <button type="button" className="sw-ib" aria-label={t("storyweave.layout")} onClick={onLayout}><Icon d={ICON.panel} /></button>
    </div>
    <div className="sw-p-body">
      {view === "overview" && <>
        <h1>{sb?.titre || t("storyweave.untitled")}</h1>
        <div className="sw-stats">{t("storyweave.stats", { shots: String(plans.length), time: formatClock(total), filmed: String(filmed) })}</div>
        <section className="sw-blk">
          <div className="sw-lbl">{t("storyweave.story")}</div>
          <div className="sw-story2">
            <button type="button" data-sw-script="" onClick={() => onView("script")}><Icon d={ICON.script} /><span><b>{t("storyweave.script")}</b><small>{t("storyweave.scriptMeta", { scenes: String(scenes.length), words: String(sb ? wordCount(sb, edit) : 0), seconds: String(Math.round(total)) })}</small></span></button>
            <button type="button" data-sw-audio="" onClick={() => onView("audio")}><Icon d={ICON.audio} /><span><b>{t("storyweave.audio")}</b><small>{t("storyweave.audioMeta", { sounds: String(cues.length), recorded: String(cues.filter(cue => cue.recorded).length) })}</small></span></button>
          </div>
        </section>
        <section className="sw-blk" style={{ marginTop: 14 }}>
          <Group title={t("storyweave.cast")} count={people.length} open onDownload={() => void download("cast", people.flatMap(ref => filesFor("cast", ref.nom)))}>
            <div className="sw-people">{people.map(ref => <button key={ref.nom} type="button" className="sw-person" onClick={() => onElement({ kind: "cast", name: ref.nom, files: filesFor("cast", ref.nom) })}>{thumb(pictureOf(ref), ref.nom)}<b>{ref.nom}</b><small>{words(ref.description ?? "")}</small></button>)}</div>
          </Group>
          <Group title={t("storyweave.places")} count={places.length} onDownload={() => void download("places", places.flatMap(ref => filesFor("place", ref.nom)))}>
            <div className="sw-people">{places.map(ref => <button key={ref.nom} type="button" className="sw-person" onClick={() => onElement({ kind: "place", name: ref.nom, files: filesFor("place", ref.nom) })}>{thumb(pictureOf(ref), ref.nom)}<b>{ref.nom}</b><small>{words(ref.description ?? "")}</small></button>)}</div>
          </Group>
          <Group title={t("storyweave.props")} count={props.length} onDownload={() => void download("props", props.flatMap(ref => filesFor("prop", ref.nom)))}>
            <div className="sw-people">{props.map(ref => <button key={ref.nom} type="button" className="sw-person" onClick={() => onElement({ kind: "prop", name: ref.nom, files: filesFor("prop", ref.nom) })}>{thumb(pictureOf(ref), ref.nom)}<b>{ref.nom}</b><small>{words(ref.description ?? "")}</small></button>)}</div>
          </Group>
          <Group title={t("storyweave.shots")} count={plans.length} open onDownload={() => void download("shots", plans.flatMap(plan => shotFiles(plan, data, href)))}>
            <div className="sw-legend"><span><i />{t("storyweave.filmed")}</span><span><i className="is-fr" />{t("storyweave.still")}</span></div>
            <div className="sw-shots">{rows.map(row => {
              const src = pictureOf(row.plan.refs.find(ref => ref.role === "ou") ?? row.plan.refs[0] ?? { role: "ou", nom: "", id: null });
              const done = Boolean(data.priseDuPlan(row.plan));
              return <button key={row.plan.id} type="button" className="sw-shot" data-sw-shot={row.index + 1} onClick={() => onShot(row.plan.id)}>
                <span className="sw-im">{src ? <img src={src} alt="" /> : <span className="sw-ph" />}<span className={`sw-st${done ? "" : " is-frame"}`} />{locked(row.plan.id) && <span className="sw-lk"><Icon d={ICON.lock} size={15} /></span>}</span>
                <b>{row.index + 1} · {row.plan.titre || t("storyweave.untitled")}</b>
                <small>{formatClock(row.start)}</small>
              </button>;
            })}</div>
          </Group>
        </section>
      </>}
      {view === "script" && sb && <>
        <div className="sw-back"><button type="button" className="sw-txt" data-sw-back="" onClick={() => onView("overview")}><Icon d={ICON.back} />{t("storyweave.story")}</button></div>
        <h2>{t("storyweave.script")}</h2>
        <div className="sw-stats">{t("storyweave.scriptMeta", { scenes: String(scenes.length), words: String(wordCount(sb, edit)), seconds: String(Math.round(total)) })}</div>
        <div>{scenes.map(item => <article key={item.shotId} className="sw-scene" data-sw-scene={item.index}>
          <div className="sw-sl"><span>{String(item.index).padStart(2, "0")}</span><span>{formatClock(item.start)}–{formatClock(item.end)}</span><span>{[item.cadrage ? t(`storyboard.sheet.cadrage.${item.cadrage}`) : "", item.camera ? t(`storyboard.sheet.cam.${item.camera}`) : ""].filter(Boolean).join(" · ")}</span></div>
          <h3>{item.title || t("storyweave.untitled")}</h3>
          <p>{item.action}</p>
          {item.line && <div className={`sw-line${item.proposal ? " is-prop" : ""}`}>
            <div className="sw-who">{item.voice ? t("storyweave.narrator") : (item.who || t("storyweave.dialogue"))}</div>
            <textarea aria-label={item.title} defaultValue={item.line} onBlur={event => { if (event.target.value !== item.line) onLine(item.shotId, event.target.value); }} />
            {item.proposal && <div className="sw-pa"><span className="sw-tag">{t("storyweave.proposal")}</span>
              <button type="button" className="sw-txt" data-sw-keep="" onClick={() => onKeep(item.shotId)}>{t("storyweave.keep")}</button>
              <button type="button" className="sw-txt" data-sw-rewrite="" onClick={() => onRewrite(item.shotId)}>{t("storyweave.rewrite")} · {costText(t, U11_AGENT_CEILING)}</button>
            </div>}
          </div>}
        </article>)}</div>
      </>}
      {view === "audio" && <>
        <div className="sw-back"><button type="button" className="sw-txt" data-sw-back="" onClick={() => onView("overview")}><Icon d={ICON.back} />{t("storyweave.story")}</button></div>
        <h2>{t("storyweave.audio")}</h2>
        <div className="sw-stats">{t("storyweave.audioMeta", { sounds: String(cues.length), recorded: String(cues.filter(cue => cue.recorded).length) })}</div>
        <div>{(["narration", "dialogue", "music", "sound"] as const).map(group => {
          const rowsOf = cues.filter(cue => cue.group === group);
          if (!rowsOf.length) return null;
          return <div key={group} className="sw-grp"><div className="sw-lbl">{t(`storyweave.group.${group}`)}</div>
            {rowsOf.map(cue => <div key={cue.id} className={`sw-cue${cue.recorded ? "" : " is-todo"}`}>
              <button type="button" className="sw-pl" aria-label={t("storyweave.playCue", { name: cue.label })} disabled={!cue.source} onClick={() => cue.source && void playUrl(cue.source)}><Icon d={ICON.play} size={16} /></button>
              <span><b>{cue.label}</b><small>{cue.shotIndex ? t("storyweave.cueMeta", { shot: String(cue.shotIndex), seconds: String(Math.round(cue.seconds)) }) : formatClock(cue.seconds)}{cue.recorded ? "" : ` · ${t("storyweave.notRecorded")}`}</small></span>
              <button type="button" className="sw-ib" aria-label={t("storyweave.download", { name: cue.label })} disabled={!cue.source} onClick={() => cue.source && void download(cue.label, [{ name: `${cue.label}.audio`, url: cue.source }])}><Icon d={ICON.dl} /></button>
            </div>)}
            <button type="button" className="sw-txt" onClick={() => void download(group, rowsOf.flatMap(cue => cue.source ? [{ name: cue.label, url: cue.source }] : []))}>{t("storyweave.downloadGroup")}</button>
          </div>;
        })}</div>
        <div className="sw-quiet">{t("storyweave.waiting", { n: String(cues.filter(cue => !cue.recorded && (cue.group === "narration" || cue.group === "dialogue")).length) })}
          <button type="button" className="sw-txt" data-sw-record="" onClick={() => setRecordNote(t("storyweave.recordLater"))}>{t("storyweave.record")} · {t("storyweave.beforeLaunch")}</button>
        </div>
        {recordNote && <p className="sw-fine">{recordNote}</p>}
      </>}
      {view === "shot" && shot && scene && <ShotSheet plan={shot} scene={scene} data={data} locked={locked(shot.id)} missing={missingPicture(shot)} filming={filming} picture={pictureOf(shot.refs.find(ref => ref.role === "ou") ?? shot.refs[0] ?? { role: "ou", nom: "", id: null })}
        engineOpen={menu === "engine"} onEngineOpen={() => setMenu(current => current === "engine" ? null : "engine")} onEngine={rendu => { setMenu(null); onEngine(shot.id, rendu); }}
        onBack={() => onView("overview")} onLock={on => onLock(shot.id, on)} onFilm={() => onFilm(shot.id)} onFinish={() => onFinish(shot.id)} onDownload={() => void download(shot.titre || "shot", shotFiles(shot, data, href))} />}
      {view === "element" && element && <>
        <div className="sw-back"><button type="button" className="sw-txt" onClick={() => onView("overview")}><Icon d={ICON.back} />{t(`storyweave.${element.kind === "cast" ? "cast" : element.kind === "place" ? "places" : "props"}`)}</button></div>
        <h2>{element.name}</h2>
        <button type="button" className="sw-txt" data-sw-download="" onClick={() => void download(element.name, element.files)}>{t("storyweave.download", { name: element.name })}</button>
      </>}
      {emptyZip && <p className="sw-fine" role="status">{emptyZip}</p>}
    </div>
  </aside>;
}

function Group({ title, count, open = false, onDownload, children }: { title: string; count: number; open?: boolean; onDownload: () => void; children: ReactNode }) {
  const [isOpen, setOpen] = useState(open);
  return <details className="sw-fold" open={isOpen} onToggle={event => setOpen((event.target as HTMLDetailsElement).open)}>
    <summary><h3>{title}</h3><span className="sw-n">{count}</span><button type="button" className="sw-ib" aria-label={title} onClick={event => { event.preventDefault(); event.stopPropagation(); onDownload(); }}><Icon d={ICON.dl} /></button><Icon d={ICON.chev} /></summary>
    {children}
  </details>;
}

function thumb(src: string, name: string) {
  return src ? <img src={src} alt="" /> : <span className="sw-ph">{name.slice(0, 1).toUpperCase()}</span>;
}

function unique(refs: RefPlan[]): RefPlan[] {
  const seen = new Set<string>();
  const out: RefPlan[] = [];
  for (const ref of refs) {
    const key = ref.nom.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

function shotFiles(plan: PlanSB, data: Storyboards, href: (path: string | null | undefined) => string): { name: string; url: string }[] {
  const hit = data.priseDuPlan(plan);
  const files: { name: string; url: string }[] = [];
  const push = (name: string, path: string | null | undefined) => { const url = href(path); if (url) files.push({ name, url }); };
  push(`${plan.titre || plan.id}-frame`, hit?.take?.poster);
  push(`${plan.titre || plan.id}-take`, hit?.take?.video);
  push(`${plan.titre || plan.id}-file`, hit?.prise.fichier);
  for (const prise of hit?.film.prises ?? []) push(`${plan.titre || plan.id}-${prise.id}`, prise.fichier);
  return files;
}

function playUrl(url: string) {
  const audio = new Audio(url);
  void audio.play().catch(() => undefined);
}

function ShotSheet({ plan, scene, data, locked, missing, filming, picture, engineOpen, onEngineOpen, onEngine, onBack, onLock, onFilm, onFinish, onDownload }: {
  plan: PlanSB;
  scene: ReturnType<typeof scenesOf>[number];
  data: Storyboards;
  locked: boolean;
  missing: boolean;
  filming: boolean;
  picture: string;
  engineOpen: boolean;
  onEngineOpen: () => void;
  onEngine: (rendu: "fidele" | "rapide") => void;
  onBack: () => void;
  onLock: (on: boolean) => void;
  onFilm: () => void;
  onFinish: () => void;
  onDownload: () => void;
}) {
  const { t } = useI18n();
  const [askFinish, setAskFinish] = useState(false);
  const take = data.priseDuPlan(plan);
  const devis = devisPlan(plan, data.ctxDevis);
  const finish = take ? suiteQuote("suite-finaliser-video", { seconds: plan.duree }) : null;
  const engine = plan.rendu === "rapide" ? t("storyweave.engineLtx") : t("storyweave.engineH3");
  const filmed = Boolean(take);
  return <>
    <div className="sw-back"><button type="button" className="sw-txt" onClick={onBack}><Icon d={ICON.back} />{t("storyweave.shots")}</button></div>
    <div className="sw-hero">{picture ? <img src={picture} alt="" /> : <span className="sw-ph" />}{!filmed && <span className="sw-badge">{t("storyweave.stillBadge")}</span>}</div>
    <h2 style={{ marginTop: 18 }}>{plan.titre || t("storyweave.untitled")}</h2>
    <div className="sw-stats">{t("storyweave.shotMeta", { n: String(scene.index), range: `${formatClock(scene.start)}–${formatClock(scene.end)}`, seconds: String(scene.end - scene.start), framing: [scene.cadrage ? t(`storyboard.sheet.cadrage.${scene.cadrage}`) : "", scene.camera ? t(`storyboard.sheet.cam.${scene.camera}`) : ""].filter(Boolean).join(", ") })}</div>
    {!filmed && <div className="sw-confirm" role="group" aria-label={t("storyweave.filmTitle", { n: String(scene.index) })}>
      <h3>{t("storyweave.filmTitle", { n: String(scene.index) })}</h3>
      <p className="sw-q">{t("storyweave.filmMeta", { engine, seconds: String(plan.duree), ratio: plan.format === "portrait" ? "9:16" : "16:9" })}</p>
      {missing && <p className="sw-miss" data-sw-ref-missing="">{t("storyboard.cinema.errors.REFERENCE_MISSING")}</p>}
      <div className="sw-go">
        <button type="button" className="sw-primary" data-sw-film="" disabled={missing || devis.total === null || filming} onClick={onFilm}>{t("storyweave.filmGo", { n: String(scene.index) })} <small>{costText(t, devis.total)}</small></button>
        <button type="button" className="sw-txt" onClick={onBack}>{t("storyweave.notNow")}</button>
      </div>
      <p className="sw-fine">{t("storyweave.filmFine")}</p>
    </div>}
    <ul className="sw-facts">
      <li><span className="sw-k">{t("storyweave.engine")}</span><span className="sw-v">{engine}</span><button type="button" className="sw-txt" aria-expanded={engineOpen} onClick={onEngineOpen}>{t("storyweave.change")}</button></li>
      {engineOpen && <li><button type="button" className="sw-txt" onClick={() => onEngine("rapide")}>{t("storyweave.engineLtx")}</button><button type="button" className="sw-txt" onClick={() => onEngine("fidele")}>{t("storyweave.engineH3")}</button></li>}
      <li><span className="sw-k">{t("storyweave.inShot")}</span><span className="sw-v">{plan.refs.map(ref => ref.nom).join(" · ") || "—"}</span></li>
      <li><span className="sw-k">{t("storyweave.lock")}</span><span className="sw-v sw-mut">{locked ? t("storyweave.lockOn") : t("storyweave.lockOff")}</span>
        <button type="button" className="sw-sw" role="switch" aria-checked={locked} aria-label={t("storyweave.lockLabel")} onClick={() => onLock(!locked)}><i /></button></li>
    </ul>
    <p className="sw-fine">{t("storyweave.finish", { cost: costText(t, finish?.credits ?? null) })}</p>
    {filmed && !askFinish && <button type="button" className="sw-txt" data-sw-finish="" onClick={() => setAskFinish(true)}>{t("storyweave.finishGo")}</button>}
    {filmed && askFinish && <div className="sw-confirm">
      <h3>{t("storyweave.finishAsk")}</h3>
      <div className="sw-go">
        <button type="button" className="sw-primary" data-sw-finish-go="" disabled={!finish} onClick={onFinish}>{t("storyweave.finishGo")} {finish && <small>{costText(t, finish.credits)}</small>}</button>
        <button type="button" className="sw-txt" onClick={() => setAskFinish(false)}>{t("storyweave.notNow")}</button>
      </div>
    </div>}
    <button type="button" className="sw-txt" onClick={onDownload}>{t("storyweave.download", { name: plan.titre || t("storyweave.shots") })}</button>
  </>;
}
