"use client";

// Refonte FILM · PR 8 — MONTAGE refait (maquettes 08 et 12, principes OpenCut P1–P11).
// One packed « Plans » track, named tools from one registry with shortcuts, a playhead that stays in
// the middle while the film slides under the finger, property chips, « Mes plans » (a tap adds at the
// end), and one primary button: Exporter. « Rendre plus net » is an export option that only enhances.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatCredits } from "@/lib/credits";
import { addAudio, clipSpeed, commit, editDuration, emptyEdit, formatClock, historyOf, mediaTime, playSpan, redo, setVideoFade, setVideoSpeed, undo, videoAt, type Edit, type History, type VideoClip } from "@/lib/montage/edit";
import { exportAllowed, exportEstimate } from "@/lib/montage/export-plan";
import { exportExtension, exportMp4 } from "@/lib/montage/encode";
import { FINAL_MAX_SECONDS, MASTER, finalQuote, masterSize } from "@/lib/montage/finaliser";
import { chooseEdit } from "@/lib/montage/from-takes";
import { suiteQuote } from "@/lib/suite/quote";
import { ACTIONS, actionPourTouche, agir, ajouterALaFin, placements, pourquoiPas, type ActionId } from "@/lib/film/montage";
import { Pause, Play, Redo, Split, Trash, Undo, ZoomIn, ZoomOut } from "../glyphs";
import { useStudio } from "../studio-session";
import { useAgentDraft } from "../use-agent-draft";
import { appendAgentMedia, localMediaDuration, type TimedResource } from "@/lib/agent/montage";
import "./film-montage.css";

const BULLE_KEY = "u-ttu-film2-montage-bulle";
const SPEEDS = [0.5, 1, 2] as const;

const Glyph = ({ d }: { d: string }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const GLYPHS: Record<Exclude<ActionId, "lecture">, ReactNode> = {
  annuler: <Undo />,
  retablir: <Redo />,
  couper: <Split />,
  enleverAvant: <Glyph d="M5 5v14M19 12H9M13 8l-4 4 4 4" />,
  enleverApres: <Glyph d="M19 5v14M5 12h10M11 8l4 4-4 4" />,
  dupliquer: <Glyph d="M8 8h11v11H8zM5 16V5h11" />,
  supprimer: <Trash />,
};

type Sortie = { phase: "idle" } | { phase: "run"; texte: string } | { phase: "done"; texte: string } | { phase: "fail"; texte: string };

export function FilmMontage({ onFilled, onPlans }: { onFilled?(filled: boolean): void; onPlans?(): void }) {
  const { t, say } = useI18n();
  const { ready, studio, media, connected, balance, prefs, loadMontages, saveMontage, writeProjectFile, saveExport, finaliseMontage, pendingClip, holdClip } = useStudio();
  const [history, setHistory] = useState<History<Edit>>(() => historyOf(emptyEdit("suite", "Séquence")));
  const historyRef = useRef(history);
  historyRef.current = history;
  const edit = history.present;
  const [time, setTime] = useState(0);
  const timeRef = useRef(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [px, setPx] = useState(40);
  const [bulle, setBulle] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [net, setNet] = useState(false);
  const [sortie, setSortie] = useState<Sortie>({ phase: "idle" });
  const [error, setError] = useState("");
  /** The project whose saved cut is on screen: held clips and agent handoffs wait for it. */
  const [loaded, setLoaded] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const syncing = useRef(false);
  const busy = useRef(false);
  const duration = editDuration(edit);
  const places = useMemo(() => placements(edit), [edit]);

  const show = useCallback((next: History<Edit>) => { historyRef.current = next; setHistory(next); }, []);
  const persist = useCallback(async (current: Edit) => {
    try {
      const saved = await saveMontage(current, {});
      if (historyRef.current.present === current) show({ ...historyRef.current, present: saved.edit });
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("film2.montage.sauvegarde")); }
  }, [saveMontage, show, t]);
  const apply = useCallback((next: Edit) => {
    const base = historyRef.current;
    const committed = commit(base, next);
    if (committed === base) return;
    show(committed);
    void persist(committed.present);
  }, [persist, show]);
  const seek = useCallback((value: number) => {
    const next = Math.min(Math.max(0, value), editDuration(historyRef.current.present));
    timeRef.current = next;
    setTime(next);
  }, []);

  // The cut from the project (a plan just shot is already in it: sendToMontage writes it).
  const key = `${studio.project ?? ""}|${studio.takes.length}|${studio.sequences.length}`;
  useEffect(() => {
    if (!ready) return;
    let gone = false;
    void loadMontages().then(saved => {
      if (gone) return;
      const choice = chooseEdit({ saved, sequences: studio.sequences, shots: studio.shots, takes: studio.takes });
      const current = historyRef.current;
      if (current.past.length === 0 && current.future.length === 0) show(historyOf(choice.edit));
      else if (choice.edit.video.length > current.present.video.length) show(commit(current, choice.edit));
      setLoaded(studio.project ?? "");
    }).catch(() => { if (!gone) setError(t("safety.sequenceMissing")); });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  // The assistant's « Assembler » step with library media: they go on this cut once it is loaded, with
  // stable clip ids so a replayed handoff never adds them twice; the draft stays until the save holds.
  useAgentDraft(op => op.adapter === "montage", async (draft, resources) => {
    const origin = studio.project ?? "";
    const additions: TimedResource[] = [];
    for (const resource of resources) {
      if (resource.role !== "asset" || !["image", "video", "audio"].includes(resource.kind)) continue;
      const seconds = resource.kind === "image" ? 5 : await localMediaDuration(resource.kind as "video" | "audio", media[resource.path] ?? "");
      additions.push({ ...resource, seconds });
    }
    if (draft.projectId !== origin) throw new Error("project");
    const base = historyRef.current;
    const next = appendAgentMedia(base.present, draft, additions);
    if (next === base.present) return;
    show(commit(base, next));
    try {
      const saved = await saveMontage(next, {});
      if (historyRef.current.present === next) show({ ...historyRef.current, present: saved.edit });
    } catch (reason) {
      if (historyRef.current.present === next) show(base);
      throw reason;
    }
  }, loaded === (studio.project ?? ""));

  // « Ajouter au montage » from Mes créations (or a ?asset= link): the held clip goes at the end of the
  // cut once this project's cut is loaded, with its own duration, then is released.
  useEffect(() => {
    if (!pendingClip || loaded !== (studio.project ?? "")) return;
    const pending = pendingClip;
    const src = media[pending.source];
    // The media map fills after a reload: wait for the blob URL rather than failing empty.
    if (!src && !pending.source.startsWith("/")) return;
    let cancelled = false;
    void (async () => {
      let seconds = pending.seconds ?? 5;
      if (pending.kind !== "image" && !pending.seconds) {
        const element = document.createElement(pending.kind === "video" ? "video" : "audio");
        try {
          seconds = await new Promise<number>((resolve, reject) => {
            const timer = window.setTimeout(() => reject(new Error("timeout")), 15000);
            element.onloadedmetadata = () => { clearTimeout(timer); if (Number.isFinite(element.duration) && element.duration > 0) resolve(element.duration); else reject(new Error("duration")); };
            element.onerror = () => { clearTimeout(timer); reject(new Error("unreadable")); };
            element.src = src || pending.source;
          });
        } finally { element.removeAttribute("src"); element.load(); }
      }
      if (cancelled) return;
      const id = `plan-${crypto.randomUUID()}`;
      const base = historyRef.current.present;
      apply(pending.kind === "audio"
        ? addAudio(base, { id, track: "effets", source: pending.source, label: pending.label, media: seconds, start: 0, end: seconds, at: 0, volume: 0.8, fadeIn: 0, fadeOut: 0 })
        : ajouterALaFin(base, { id, kind: pending.kind, source: pending.source, label: pending.label, media: seconds, start: 0, end: seconds, takeId: null }));
      if (pending.kind !== "audio") setSelected(id);
      holdClip(current => current && current.source === pending.source && current.label === pending.label ? null : current);
    })().catch(() => { if (!cancelled) setError(t("safety.assetMissing")); });
    return () => { cancelled = true; };
  }, [pendingClip, holdClip, loaded, studio.project, media, apply, t]);
  useEffect(() => { onFilled?.(edit.video.length > 0); }, [edit.video.length, onFilled]);
  useEffect(() => {
    try { if (!localStorage.getItem(BULLE_KEY)) setBulle(true); } catch { /* private tab */ }
  }, []);
  const fermerBulle = () => { setBulle(false); try { localStorage.setItem(BULLE_KEY, "1"); } catch { /* private tab */ } };

  // P3: the playhead stays in the middle; scrolling the film is seeking.
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const left = time * px;
    if (Math.abs(node.scrollLeft - left) < 1) return;
    syncing.current = true;
    node.scrollLeft = left;
  }, [time, px, duration]);
  const onScroll = () => {
    const node = scroller.current;
    if (!node) return;
    if (syncing.current) { syncing.current = false; return; }
    if (playing) return;
    seek(node.scrollLeft / px);
    if (bulle) fermerBulle();
  };

  // Preview: the clip under the playhead, at its own media time.
  const here = videoAt(edit, Math.min(time, Math.max(0, duration - 0.001)));
  const url = (source: string | null) => source ? media[source] ?? "" : "";
  const take = (clip: VideoClip) => studio.takes.find(item => item.id === clip.takeId || item.video === clip.source);
  const thumb = (clip: VideoClip) => { const found = take(clip); return (found?.poster && url(found.poster)) || ""; };
  useEffect(() => {
    const node = video.current;
    if (!node || !here || playing) return;
    const at = mediaTime(here.clip, here.offset);
    if (Math.abs(node.currentTime - at) > 0.04) { try { node.currentTime = at; } catch { /* not ready */ } }
  }, [here?.clip.id, here?.offset, playing]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = timeRef.current + (now - last) / 1000;
      last = now;
      const total = editDuration(historyRef.current.present);
      if (next >= total) { setPlaying(false); seek(total); return; }
      seek(next);
      const node = video.current;
      const hit = videoAt(historyRef.current.present, next);
      if (node && hit) {
        node.playbackRate = clipSpeed(hit.clip);
        const at = mediaTime(hit.clip, hit.offset);
        if (Math.abs(node.currentTime - at) > 0.3) { try { node.currentTime = at; } catch { /* seeking */ } }
        if (node.paused) void node.play().catch(() => undefined);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); video.current?.pause(); };
  }, [playing, seek]);
  const lecture = () => {
    if (!duration) return;
    if (!playing && timeRef.current >= duration - 0.05) seek(0);
    setPlaying(value => !value);
  };

  const etat = { edit, time, selected };
  const counts = { past: history.past.length, future: history.future.length };
  const run = useCallback((id: ActionId) => {
    const current = historyRef.current;
    const state = { edit: current.present, time: timeRef.current, selected };
    if (id === "lecture") return lecture();
    if (pourquoiPas(id, state, { past: current.past.length, future: current.future.length })) return;
    setError("");
    if (id === "annuler" || id === "retablir") {
      const next = id === "annuler" ? undo(current) : redo(current);
      if (next !== current) { show(next); void persist(next.present); seek(Math.min(timeRef.current, editDuration(next.present))); }
      return;
    }
    const next = agir(id, state, () => `plan-${crypto.randomUUID()}`);
    if (next.edit !== state.edit) apply(next.edit);
    setSelected(next.selected);
    seek(next.time);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, apply, persist, seek, show, duration, playing]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("input, textarea, select, [contenteditable]") || sheet)) return;
      const id = actionPourTouche({ key: event.key, ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey });
      if (!id) return;
      if (id === "lecture" && target?.closest("button")) return;
      event.preventDefault();
      run(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, sheet]);

  // « Mes plans »: every take of the film, newest last; a tap puts it at the end.
  const bin = studio.takes.filter(item => item.video);
  const ajouter = (item: (typeof bin)[number]) => {
    const seconds = item.settings.seconds || 5;
    apply(ajouterALaFin(historyRef.current.present, { id: `plan-${crypto.randomUUID()}`, kind: "video", source: item.video, label: item.line.slice(0, 60), media: seconds, start: 0, end: seconds, takeId: item.id }));
    if (bulle) fermerBulle();
  };

  const choisi = edit.video.find(clip => clip.id === selected) ?? null;
  const index = choisi ? edit.video.indexOf(choisi) : -1;
  const vertical = (() => { const first = edit.video[0]; const found = first ? take(first) : undefined; return found?.settings.aspect === "vertical"; })();

  // Exporter. Rendre plus net = the Finaliser pass on the export (enhances, never regenerates).
  const open = prefs.openWeightsOnly;
  const quoteNet = (() => {
    if (!(duration > 0) || duration > FINAL_MAX_SECONDS) return null;
    if (!open) { const quote = finalQuote(duration, { resolution: "1080p", nettoyer: "aucun" }); return quote ? { credits: quote.credits, ceiling: quote.ceiling } : null; }
    const quote = suiteQuote("suite-finaliser-video", { seconds: duration, fluidifier: false });
    return quote ? { credits: quote.credits, ceiling: quote.high } : null;
  })();
  const plan = exportEstimate(duration);
  const exportWhy = !duration ? t("film2.montage.pourquoi.vide") : plan && !exportAllowed(plan.seconds) ? t("montage.exportLong") : "";
  const netWhy = !quoteNet ? t("film2.montage.netLong") : !connected ? t("create.needLink") : balance && balance.credits < quoteNet.ceiling ? t("create.needCeiling") : "";
  const exporter = () => {
    const current = historyRef.current.present;
    if (busy.current || exportWhy || !studio.project) return;
    const sources = new Map(current.video.flatMap(clip => clip.source ? [[clip.source, url(clip.source)] as const] : []));
    busy.current = true;
    setSortie({ phase: "run", texte: t("film2.montage.prepare") });
    const project = studio.project;
    if (net && !netWhy) {
      const ratio = vertical ? "9/16" as const : "16/9" as const;
      void exportMp4({ edit: current, urlOf: source => sources.get(source) ?? "", size: { ...masterSize(ratio), fps: MASTER.fps, quality: "high" }, strict: true, onProgress: (done, total) => setSortie({ phase: "run", texte: t("film2.montage.progres", { p: String(Math.round((done / Math.max(1, total)) * 100)) }) }) })
        .then(blob => finaliseMontage({ project, video: blob, name: current.name, seconds: editDuration(current), ratio, choice: { resolution: "1080p", nettoyer: "aucun" }, confirmed: true, onStage: stage => setSortie({ phase: "run", texte: t(`film2.montage.etape.${stage}`) }) }))
        .then(outcome => setSortie(outcome.ok ? { phase: "done", texte: t("film2.montage.netFini") } : { phase: "fail", texte: say(outcome.message) }))
        .catch(reason => setSortie({ phase: "fail", texte: reason instanceof Error ? reason.message : t("montage.exportStopped") }))
        .finally(() => { busy.current = false; });
      return;
    }
    void exportMp4({ edit: current, urlOf: source => sources.get(source) ?? "", vertical, onProgress: (done, total) => setSortie({ phase: "run", texte: t("film2.montage.progres", { p: String(Math.round((done / Math.max(1, total)) * 100)) }) }) })
      .then(async blob => {
        const link = document.createElement("a");
        const href = URL.createObjectURL(blob);
        link.href = href;
        link.download = `${current.name || "montage"}.${exportExtension(blob)}`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(href), 60000);
        await writeProjectFile(".uttu/agent-events.json", JSON.stringify({ export: `${current.id}:${Date.now()}:${blob.size}` }));
        await saveExport(blob, current.name).catch(() => "");
        setSortie({ phase: "done", texte: t("film2.montage.exporte") });
      })
      .catch(reason => setSortie({ phase: "fail", texte: reason instanceof Error ? reason.message : t("montage.exportStopped") }))
      .finally(() => { busy.current = false; });
  };

  const name = (id: ActionId) => t(`film2.montage.action.${id}`);
  const ruler = Array.from({ length: Math.floor(duration / 4) + 1 }, (_, i) => i * 4);
  const bulleId = "u-fm-bulle";

  return <section className="u-fm" data-film-montage="" aria-labelledby="u-title">
    <header className="u-fm-head">
      <h1 id="u-title" tabIndex={-1} className="u-film-title"><span className="u-film-stage">{t("film2.montage.titre")}</span> <span data-fm-duree="">{edit.name && edit.name !== "Séquence" ? edit.name : t("film2.montage.monFilm")} · {formatClock(duration)}</span></h1>
      <button type="button" className="u-film-gold u-fm-export" data-fm-exporter="" onClick={() => { setSheet(true); setSortie({ phase: "idle" }); }} disabled={Boolean(exportWhy)} aria-describedby={exportWhy ? "u-fm-export-why" : undefined}>{t("film2.montage.exporter")}</button>
      {exportWhy && <span id="u-fm-export-why" className="sr-only">{exportWhy}</span>}
    </header>

    <div className="u-fm-body">
      <aside className="u-fm-bin" data-fm-bin="" aria-labelledby="u-fm-bin-title">
        <h2 id="u-fm-bin-title" className="u-film-eyebrow">{t("film2.montage.mesPlans")}</h2>
        <div className="u-fm-bin-list">
          {bin.map((item, i) => <button key={item.id} type="button" className="u-fm-bin-item" data-fm-bin-item={item.id} onClick={() => ajouter(item)} aria-label={t("film2.montage.ajouterFin", { n: String(i + 1), nom: item.line.slice(0, 40) })}>
            {item.poster && url(item.poster) ? <img src={url(item.poster)} alt="" /> : <span className="u-fm-bin-ph" aria-hidden="true" />}
            <span>{i + 1} · {item.sceneName || item.line.slice(0, 18)}</span>
          </button>)}
          {onPlans && <button type="button" className="u-fm-bin-item u-fm-bin-plus" onClick={onPlans} aria-label={t("film2.montage.nouveauPlan")}><span aria-hidden="true">+</span><span>{t("film2.montage.nouveauPlanCourt")}</span></button>}
        </div>
        {!bin.length && <p className="u-film-note">{t("film2.montage.binVide")}</p>}
      </aside>

      <div className="u-fm-centre">
        <div className={`u-fm-preview${vertical ? " is-vertical" : ""}`}>
          {here?.clip.source && url(here.clip.source)
            ? <video ref={video} key={here.clip.source} src={url(here.clip.source)} muted playsInline preload="auto" poster={thumb(here.clip) || undefined} />
            : <p className="u-fm-empty">{edit.video.length ? t("film2.montage.chargement") : t("film2.montage.vide")}</p>}
          {here && <span className="u-fm-badge">{t("film2.montage.planN", { n: String(here.index + 1) })}</span>}
        </div>
        <div className="u-fm-player">
          <button type="button" className="u-fm-play" data-fm-lecture="" onClick={lecture} disabled={!duration} aria-describedby={!duration ? "u-fm-export-why" : undefined} aria-label={`${playing ? t("film2.montage.action.pause") : name("lecture")} (${ACTIONS[0]!.touche})`} aria-keyshortcuts="Space">{playing ? <Pause /> : <Play />}</button>
          <span className="u-fm-clock" data-fm-clock="">{formatClock(time)} / {formatClock(duration)}</span>
          <span className="u-fm-hint">{t("film2.montage.brouillon")}</span>
        </div>
      </div>

      <aside className="u-fm-props" data-fm-props="" aria-live="polite">
        {choisi ? <>
          <h2 className="u-film-eyebrow">{t("film2.montage.planChoisi", { n: String(index + 1) })}</h2>
          <p className="u-fm-props-sub">{choisi.label}</p>
          <div className="u-fm-chips" role="group" aria-label={t("film2.montage.vitesse")}>
            {SPEEDS.map(speed => <button key={speed} type="button" className="u-film-chip" aria-pressed={clipSpeed(choisi) === speed} data-fm-vitesse={speed} onClick={() => apply(setVideoSpeed(historyRef.current.present, choisi.id, speed))}>{t("film2.montage.vitesseN", { n: String(speed).replace(".", ",") })}</button>)}
            <button type="button" className="u-film-chip" aria-pressed={(choisi.fadeOut ?? 0) > 0} data-fm-fondu="" onClick={() => apply(setVideoFade(historyRef.current.present, choisi.id, (choisi.fadeOut ?? 0) > 0 ? 0 : Math.min(0.5, playSpan(choisi) / 2)))}>{t("film2.montage.fondu")}</button>
          </div>
        </> : <p className="u-film-note" data-fm-props-vide="">{t("film2.montage.toucheUnPlan")}</p>}
      </aside>
    </div>

    <div className="u-fm-barre" role="toolbar" aria-label={t("film2.montage.outils")} data-fm-barre="">
      {ACTIONS.filter(action => action.barre).map(action => {
        const why = pourquoiPas(action.id, etat, counts);
        return <button key={action.id} type="button" className="u-fm-tool" data-fm-action={action.id} onClick={() => run(action.id)} disabled={Boolean(why)} aria-label={`${name(action.id)} (${action.touche})`} aria-keyshortcuts={action.aria} aria-describedby={why ? `u-fm-why-${action.id}` : undefined} title={why ? t(why) : undefined}>
          {GLYPHS[action.id as Exclude<ActionId, "lecture">]}<span>{name(action.id)} <kbd aria-hidden="true">({action.touche})</kbd></span>
          {why && <span id={`u-fm-why-${action.id}`} className="sr-only">{t(why)}</span>}
        </button>;
      })}
      <span className="u-fm-sep" aria-hidden="true" />
      <span className="u-fm-state" data-fm-aimant="">{t("film2.montage.aimant")}</span>
      <span className="u-fm-state">{t("film2.montage.recoller")}</span>
      <button type="button" className="u-fm-tool u-fm-zoom" onClick={() => setPx(value => Math.max(16, value / 1.5))} aria-label={t("film2.montage.zoomMoins")}><ZoomOut /></button>
      <button type="button" className="u-fm-tool u-fm-zoom" onClick={() => setPx(value => Math.min(160, value * 1.5))} aria-label={t("film2.montage.zoomPlus")}><ZoomIn /></button>
    </div>

    <div className="u-fm-timeline">
      <div className="u-fm-playhead" aria-hidden="true" />
      {bulle && edit.video.length > 0 && <p id={bulleId} className="u-fm-bulle" role="status" onClick={fermerBulle}>{t("film2.montage.bulle")}</p>}
      <div ref={scroller} className="u-fm-scroll" onScroll={onScroll} data-fm-scroll="" tabIndex={0} aria-label={t("film2.montage.timeline")}>
        <div className="u-fm-inner" style={{ width: Math.max(1, duration * px) }}>
          <div className="u-fm-ruler" aria-hidden="true">{ruler.map(s => <span key={s} style={{ left: s * px }}>{formatClock(s)}</span>)}</div>
          <div className="u-fm-track" data-fm-track="plans">
            <span className="u-fm-track-name">{t("film2.montage.piste")}</span>
            {places.map(({ clip, start, end }, i) => <button key={clip.id} type="button" className="u-fm-clip" data-fm-clip={clip.id} data-start={start.toFixed(2)} data-end={end.toFixed(2)} aria-pressed={selected === clip.id} aria-label={t("film2.montage.clipAria", { n: String(i + 1), nom: clip.label, s: formatClock(end - start) })} style={{ left: start * px, width: Math.max(24, (end - start) * px) - 2, backgroundImage: thumb(clip) ? `url(${thumb(clip)})` : undefined }} onClick={() => { setSelected(selected === clip.id ? null : clip.id); if (selected !== clip.id && (time < start || time >= end)) seek(start); if (bulle) fermerBulle(); }}>
              <span>{i + 1}</span>
            </button>)}
          </div>
          {edit.audio.length > 0 && <div className="u-fm-track is-audio" data-fm-track="son">
            <span className="u-fm-track-name">{t("film2.montage.son")}</span>
            {edit.audio.map(clip => <span key={clip.id} className="u-fm-audio" style={{ left: clip.at * px, width: Math.max(24, (clip.end - clip.start) * px) }}>{clip.label}</span>)}
          </div>}
        </div>
      </div>
    </div>

    {error && <p className="u-film-error" role="alert" data-fm-error="">{error}</p>}

    {sheet && <div className="u-film-sheet-back" onClick={() => { if (sortie.phase !== "run") setSheet(false); }}>
      <div className="u-film-sheet" role="dialog" aria-modal="true" aria-labelledby="u-fm-export-title" data-fm-export="" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape" && sortie.phase !== "run") setSheet(false); }}>
        <h2 id="u-fm-export-title">{t("film2.montage.exporterTitre")}</h2>
        <p className="u-film-lead">{t("film2.montage.exporterLead", { d: formatClock(duration) })}</p>
        <label className="u-fm-net">
          <input type="checkbox" checked={net && !netWhy} disabled={Boolean(netWhy) || sortie.phase === "run"} onChange={event => setNet(event.target.checked)} data-fm-net="" aria-describedby="u-fm-net-sub" />
          <span><strong>{t("film2.montage.net")}{quoteNet ? ` · ${t("film2.credits", { n: formatCredits(quoteNet.credits) })}` : ""}</strong>
            <small id="u-fm-net-sub">{netWhy || t("film2.montage.netSous")}</small></span>
        </label>
        {sortie.phase !== "idle" && <p className={sortie.phase === "fail" ? "u-film-error" : "u-film-state"} id="u-fm-sortie" role={sortie.phase === "fail" ? "alert" : "status"} data-fm-sortie={sortie.phase}>{sortie.texte}</p>}
        <button type="button" className="u-film-gold" data-fm-exporter-go="" onClick={exporter} disabled={sortie.phase === "run"} aria-describedby={sortie.phase === "run" ? "u-fm-sortie" : undefined}>
          <span>{net && !netWhy ? t("film2.montage.exporterNet") : t("film2.montage.exporterLocal")}</span>{net && !netWhy && quoteNet && <span className="u-film-price">· {t("film2.credits", { n: formatCredits(quoteNet.credits) })}</span>}
        </button>
        <div className="u-film-sheet-row"><button type="button" className="u-secondary" onClick={() => setSheet(false)} disabled={sortie.phase === "run"} aria-describedby={sortie.phase === "run" ? "u-fm-sortie" : undefined}>{t("film2.fermer")}</button></div>
      </div>
    </div>}
  </section>;
}
