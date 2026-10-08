"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { assetPath } from "@/lib/site";
import {
  addAudio, appendVideo, audioEnd, canSplit, clipGain, collectSnapPoints, commit, deleteClip, editDuration,
  emptyEdit, formatClock, historyOf, moveAudio, nextZoom, redo, reorderVideo, resolveSnap, snapThreshold, span,
  splitVideo, trimAudio, trimVideo, undo, videoAt, videoDuration, setAudioLevels,
  type AudioClip, type AudioTrackId, type Edit, type History, type VideoClip,
} from "@/lib/montage/edit";
import { exportAllowed, exportEstimate } from "@/lib/montage/export-plan";
import { exportMp4 } from "@/lib/montage/encode";
import { EXEMPLE_ID, exempleEdit } from "@/lib/montage/exemple";
import { chooseEdit, editFromShots } from "@/lib/montage/from-takes";
import { SFX_DEFAULT_SECONDS, sfxQuote, voiceQuote } from "@/lib/montage/quotes";
import { useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { useStudio } from "./studio-session";

function Why({ on, text, id }: { on: boolean; text: string; id?: string }) {
  if (!on || !text) return null;
  return <p className="u-why" id={id}>{text}</p>;
}

function Waveform({ url, media, start, px }: { url: string; media: number; start: number; px: number }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = host.current;
    if (!node || !url || !(media > 0)) return;
    let dead = false;
    let wave: { destroy(): void } | null = null;
    void import("wavesurfer.js").then(({ default: WaveSurfer }) => {
      if (dead) return;
      const created = WaveSurfer.create({
        container: node,
        url,
        height: 36,
        waveColor: "#c9a46a",
        progressColor: "#e8d3ad",
        cursorWidth: 0,
        interact: false,
        barWidth: 2,
        barGap: 1,
        minPxPerSec: px,
      });
      if (dead) created.destroy();
      else wave = created;
    }).catch(() => {});
    return () => {
      dead = true;
      wave?.destroy();
    };
  }, [url, media, px]);
  return <div className="u-wave" style={{ width: `${Math.max(1, media * px)}px`, marginLeft: `${-start * px}px` }}><div ref={host} /></div>;
}

type ExportPhase = { phase: "idle" } | { phase: "run"; done: number; total: number } | { phase: "done"; bytes: number } | { phase: "fail" };

const AUDIO_EXT = new Set(["wav", "mp3", "m4a", "ogg", "webm", "mp4"]);
const TRACK_LABEL_PX = 72;

export function MontageStage() {
  const { t } = useI18n();
  const { locale } = useLocaleSwitch();
  const { ready, studio, media, connected, loadMontages, saveMontage } = useStudio();
  const [history, setHistory] = useState<History<Edit>>(() => historyOf(exempleEdit()));
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [px, setPx] = useState(48);
  const [selected, setSelected] = useState<string | null>(null);
  const [trimming, setTrimming] = useState<"start" | "end" | null>(null);
  const [stem, setStem] = useState<AudioTrackId | null>(null);
  const [script, setScript] = useState("");
  const [exportPhase, setExportPhase] = useState<ExportPhase>({ phase: "idle" });
  const historyRef = useRef(history);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const pxRef = useRef(px);
  const mediaRef = useRef(media);
  const boot = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const locals = useRef<Record<string, string>>({});
  const files = useRef<Record<string, { blob: Blob; ext: string }>>({});
  const cache = useRef<Map<string, AudioBuffer>>(new Map());
  const audioRef = useRef<{ stop(): void } | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const edit = history.present;
  historyRef.current = history;
  pxRef.current = px;
  mediaRef.current = media;
  const duration = editDuration(edit);
  const comma = locale === "fr";

  function urlOf(source: string): string {
    if (source.startsWith("local:")) return locals.current[source.slice("local:".length)] ?? "";
    if (source.startsWith("/")) return assetPath(source);
    return mediaRef.current[source] ?? "";
  }
  const urlOfRef = useRef(urlOf);
  urlOfRef.current = urlOf;

  function stopAudio() {
    audioRef.current?.stop();
    audioRef.current = null;
  }

  async function startAudio(from: number) {
    stopAudio();
    const ctx = new AudioContext();
    const nodes: AudioBufferSourceNode[] = [];
    for (const clip of historyRef.current.present.audio) {
      const clipEnd = audioEnd(clip);
      if (clipEnd <= from) continue;
      const url = urlOfRef.current(clip.source);
      if (!url) continue;
      let buffer = cache.current.get(clip.source);
      if (!buffer) {
        try {
          const decoded = await ctx.decodeAudioData((await (await fetch(url)).arrayBuffer()).slice(0));
          buffer = decoded;
          cache.current.set(clip.source, decoded);
        } catch {
          continue;
        }
      }
      const skip = Math.max(0, from - clip.at);
      const length = span(clip) - skip;
      if (length <= 0.01) continue;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      const when = ctx.currentTime + Math.max(0, clip.at - from);
      const level = clipGain(clip, skip, span(clip));
      gain.gain.setValueAtTime(level, when);
      if (clip.fadeIn > skip) gain.gain.linearRampToValueAtTime(clip.volume, when + (clip.fadeIn - skip));
      if (clip.fadeOut > 0) {
        const fadeAt = when + Math.max(0, length - clip.fadeOut);
        gain.gain.setValueAtTime(clip.volume, fadeAt);
        gain.gain.linearRampToValueAtTime(0, when + length);
      }
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(when, clip.start + skip, length);
      nodes.push(source);
    }
    audioRef.current = {
      stop() {
        for (const node of nodes) { try { node.stop(); } catch { /* already stopped */ } }
        void ctx.close();
      },
    };
  }

  function show(next: History<Edit>) {
    historyRef.current = next;
    setHistory(next);
  }

  async function persist(current: Edit) {
    const saved = await saveMontage(current, files.current);
    boot.current = saved.slug;
    if (historyRef.current.present === current) show({ ...historyRef.current, present: saved.edit });
  }

  function commitFrom(base: History<Edit>, next: Edit) {
    const committed = commit(base, next);
    show(committed);
    if (committed !== base) void persist(committed.present);
  }

  useEffect(() => {
    if (!ready) return;
    const key = studio.project ?? "";
    if (boot.current === key) return;
    boot.current = key;
    let gone = false;
    void loadMontages().then(saved => {
      if (gone || boot.current !== key) return;
      const choice = chooseEdit({
        saved,
        sequences: studio.sequences,
        shots: studio.shots,
        takes: studio.takes,
      });
      show(historyOf(choice.edit));
      timeRef.current = 0;
      setTime(0);
    });
    return () => { gone = true; };
  }, [ready, studio.project, loadMontages]);

  useEffect(() => {
    const node = videoRef.current;
    const hit = videoAt(edit, time);
    if (!node || !hit || hit.clip.kind !== "video" || !hit.clip.source) return;
    const url = urlOf(hit.clip.source);
    if (!url) return;
    if (node.dataset.src !== url) {
      node.dataset.src = url;
      node.src = url;
    }
    const want = hit.clip.start + hit.offset;
    if (Number.isFinite(node.duration) && Math.abs(node.currentTime - want) > 0.35) node.currentTime = want;
    if (playing) void node.play().catch(() => {});
    else node.pause();
  }, [edit, time, playing]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setPx(current => nextZoom(current, event.deltaY < 0 ? 1.08 : 1 / 1.08));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => () => stopAudio(), []);

  function toggle() {
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      stopAudio();
      return;
    }
    const total = editDuration(historyRef.current.present);
    if (timeRef.current >= total - 0.05) {
      timeRef.current = 0;
      setTime(0);
    }
    playingRef.current = true;
    setPlaying(true);
    void startAudio(timeRef.current);
    let last = performance.now();
    const loop = (now: number) => {
      if (!playingRef.current) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const totalNow = editDuration(historyRef.current.present);
      const next = timeRef.current + dt;
      if (next >= totalNow) {
        timeRef.current = totalNow;
        setTime(totalNow);
        playingRef.current = false;
        setPlaying(false);
        stopAudio();
        return;
      }
      timeRef.current = next;
      setTime(next);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function seek(value: number) {
    const next = Math.min(Math.max(0, value), editDuration(historyRef.current.present));
    timeRef.current = next;
    setTime(next);
    if (playingRef.current) void startAudio(next);
  }

  function snapped(timelineTime: number, ignoreId?: string): number {
    return resolveSnap(timelineTime, collectSnapPoints(historyRef.current.present, timeRef.current, ignoreId), snapThreshold(pxRef.current));
  }

  function pointerTime(clientX: number): number {
    const node = scrollerRef.current;
    if (!node) return 0;
    const rect = node.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left + node.scrollLeft - TRACK_LABEL_PX) / pxRef.current);
  }

  function onTrim(event: ReactPointerEvent, clipId: string, edge: "start" | "end", kind: "video" | "audio") {
    event.stopPropagation();
    const base = historyRef.current;
    setTrimming(edge);
    setSelected(clipId);
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const move = (ev: PointerEvent) => {
      const at = snapped(pointerTime(ev.clientX), clipId);
      const next = kind === "video" ? trimVideo(base.present, clipId, edge, at) : trimAudio(base.present, clipId, edge, at);
      show({ ...base, present: next });
    };
    const up = (ev: PointerEvent) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      setTrimming(null);
      const at = snapped(pointerTime(ev.clientX), clipId);
      const next = kind === "video" ? trimVideo(base.present, clipId, edge, at) : trimAudio(base.present, clipId, edge, at);
      commitFrom(base, next);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  }

  function onReorder(event: ReactPointerEvent, index: number) {
    const base = historyRef.current;
    const originX = event.clientX;
    let moved = false;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - originX) < 8) return;
      moved = true;
      const x = pointerTime(ev.clientX);
      let cursor = 0;
      let to = base.present.video.length - 1;
      for (let i = 0; i < base.present.video.length; i += 1) {
        const width = span(base.present.video[i]);
        if (x < cursor + width / 2) { to = i; break; }
        cursor += width;
      }
      show({ ...base, present: reorderVideo(base.present, index, to) });
    };
    const up = (ev: PointerEvent) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      if (!moved) return;
      const x = pointerTime(ev.clientX);
      let cursor = 0;
      let to = base.present.video.length - 1;
      for (let i = 0; i < base.present.video.length; i += 1) {
        const width = span(base.present.video[i]);
        if (x < cursor + width / 2) { to = i; break; }
        cursor += width;
      }
      commitFrom(base, reorderVideo(base.present, index, to));
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  }

  function onMoveAudio(event: ReactPointerEvent, clip: AudioClip) {
    const base = historyRef.current;
    const originX = event.clientX;
    const origin = clip.at;
    let moved = false;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const place = (clientX: number) => snapped(Math.max(0, origin + (clientX - originX) / pxRef.current), clip.id);
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - originX) < 6) return;
      moved = true;
      show({ ...base, present: moveAudio(base.present, clip.id, place(ev.clientX)) });
    };
    const up = (ev: PointerEvent) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      if (!moved) return;
      commitFrom(base, moveAudio(base.present, clip.id, place(ev.clientX)));
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  }

  async function addFile(file: File, track: AudioTrackId) {
    const id = `son-${crypto.randomUUID()}`;
    const url = URL.createObjectURL(file);
    let mediaSeconds = 0;
    try {
      const ctx = new AudioContext();
      const decoded = await ctx.decodeAudioData((await file.arrayBuffer()).slice(0));
      mediaSeconds = decoded.duration;
      cache.current.set(`local:${id}`, decoded);
      await ctx.close();
    } catch {
      URL.revokeObjectURL(url);
      return;
    }
    if (!(mediaSeconds > 0)) return;
    locals.current[id] = url;
    const ext = (file.name.split(".").pop() ?? "wav").toLowerCase().replace(/[^a-z0-9]/g, "");
    files.current[id] = { blob: file, ext: AUDIO_EXT.has(ext) ? ext : "wav" };
    const label = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || track;
    const clip: AudioClip = {
      id, track, source: `local:${id}`, label, media: mediaSeconds, start: 0, end: mediaSeconds,
      at: snapped(timeRef.current), volume: track === "musique" ? 0.4 : 0.9, fadeIn: 0.05, fadeOut: 0.15,
    };
    setSelected(id);
    commitFrom(historyRef.current, addAudio(historyRef.current.present, clip));
  }

  function addTakeSound(take: { id: string; line: string; video: string; settings: { seconds: number } }, track: AudioTrackId) {
    const seconds = take.settings.seconds > 0 ? take.settings.seconds : 1;
    const id = `son-${take.id}-${track}`;
    const clip: AudioClip = {
      id, track, source: take.video, label: take.line || take.id, media: seconds, start: 0, end: seconds,
      at: snapped(timeRef.current), volume: 0.8, fadeIn: 0, fadeOut: 0,
    };
    setSelected(id);
    commitFrom(historyRef.current, addAudio(historyRef.current.present, clip));
  }

  function onPinchDown(event: ReactPointerEvent) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: pxRef.current };
    }
  }
  function onPinchMove(event: ReactPointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!pinch.current || pointers.current.size < 2) return;
    const [a, b] = [...pointers.current.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    setPx(nextZoom(pinch.current.zoom, distance / pinch.current.distance));
  }
  function onPinchUp(event: ReactPointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  const hit = videoAt(edit, time);
  const picture = hit?.clip.kind === "image" && hit.clip.source ? urlOf(hit.clip.source) : "";
  const estimate = exportEstimate(duration);
  const canExport = estimate !== null && exportAllowed(estimate.seconds) && exportPhase.phase !== "run";
  const exportWhy = duration <= 0 ? t("montage.exportOff") : estimate && !exportAllowed(estimate.seconds) ? t("montage.exportLong") : exportPhase.phase === "run" ? t("montage.exportRun") : "";
  const splitOk = canSplit(edit, time);
  const selectedClip = selected ? (edit.video.some(clip => clip.id === selected) || edit.audio.some(clip => clip.id === selected)) : false;
  const selectedAudio = edit.audio.find(clip => clip.id === selected) ?? null;
  const filled = edit.video.length + edit.audio.length > 0;
  const montageState = filled ? (edit.id === EXEMPLE_ID ? "exemple" : "projet") : "vide";
  const size = estimate ? (estimate.bytes >= 1_000_000
    ? t("montage.sizeMb", { amount: (estimate.bytes / 1_000_000).toFixed(1).replace(".", comma ? "," : ".") })
    : t("montage.sizeKb", { amount: String(Math.max(1, Math.round(estimate.bytes / 1000))) })) : "";
  const voice = voiceQuote(script.trim().length);
  const effect = sfxQuote(SFX_DEFAULT_SECONDS);
  const trackName = (id: AudioTrackId) => t(id === "voix" ? "montage.voix" : id === "effets" ? "montage.effets" : "montage.musique");

  function renderVideoClip(clip: VideoClip, index: number, origin: number) {
    const width = Math.max(span(clip) * px, 44);
    return <div key={clip.id} className="u-clip" data-selected={selected === clip.id || undefined} data-trimming={selected === clip.id ? trimming ?? undefined : undefined} style={{ left: origin * px, width }}>
      <button type="button" className="u-handle is-start" aria-label={t("montage.trimStart")} onPointerDown={event => onTrim(event, clip.id, "start", "video")} />
      <button type="button" className="u-clip-body" onPointerDown={event => { setSelected(clip.id); onReorder(event, index); }}>{clip.label}</button>
      <button type="button" className="u-handle is-end" aria-label={t("montage.trimEnd")} onPointerDown={event => onTrim(event, clip.id, "end", "video")} />
    </div>;
  }

  function renderAudioClip(clip: AudioClip) {
    const width = Math.max(span(clip) * px, 44);
    return <div key={clip.id} className="u-clip is-audio" data-selected={selected === clip.id || undefined} data-trimming={selected === clip.id ? trimming ?? undefined : undefined} style={{ left: clip.at * px, width }}>
      <button type="button" className="u-handle is-start" aria-label={t("montage.trimStart")} onPointerDown={event => onTrim(event, clip.id, "start", "audio")} />
      <button type="button" className="u-clip-body" onPointerDown={event => { setSelected(clip.id); onMoveAudio(event, clip); }}>
        <span>{clip.label}</span>
        <Waveform url={urlOf(clip.source)} media={clip.media} start={clip.start} px={px} />
      </button>
      <button type="button" className="u-handle is-end" aria-label={t("montage.trimEnd")} onPointerDown={event => onTrim(event, clip.id, "end", "audio")} />
    </div>;
  }

  let cursor = 0;
  const videoNodes = edit.video.map((clip, index) => {
    const node = renderVideoClip(clip, index, cursor);
    cursor += span(clip);
    return node;
  });
  const axis = Math.max(duration * px + 48, 240);
  const width = TRACK_LABEL_PX + axis;

  return <section className="u-screen u-stage u-montage" data-section="montage" data-montage={montageState} data-export={exportPhase.phase} aria-labelledby="u-title">
    <header className="u-head">
      <p className="u-label">04</p>
      <h1 id="u-title" tabIndex={-1}>{t("nav.edit")}</h1>
      <p className="u-lead">{t("montage.lead")}</p>
    </header>
    {montageState === "exemple" && <p className="u-small">{t("montage.exampleNote")}</p>}
    {montageState === "vide" && <p className="u-small">{t("montage.empty")}</p>}
    {studio.sequences.length > 1 && <div className="u-suggest">
      {studio.sequences.map(sequence => <button key={sequence.id} type="button" aria-pressed={edit.id === sequence.id} onClick={() => void loadMontages().then(saved => {
        const found = saved.find(item => item.id === sequence.id);
        show(historyOf(found ?? editFromShots(sequence, studio.shots, studio.takes)));
      })}>{sequence.name}</button>)}
    </div>}
    <div className="u-viewer" ref={viewerRef}>
      {picture ? <img src={picture} alt="" /> : null}
      {hit?.clip.kind === "video" ? <video ref={videoRef} playsInline /> : null}
      {hit?.clip.kind === "slate" ? <p className="u-slate">{t("montage.slate")}</p> : null}
      {!hit ? <p className="u-slate">{filled ? t("montage.end") : t("montage.empty")}</p> : null}
      <div className="u-viewer-bar">
        <button type="button" className="u-link" onClick={toggle}>{playing ? t("montage.pause") : t("montage.play")}</button>
        <span className="u-time">{t("montage.time", { now: formatClock(time), total: formatClock(duration) })}</span>
        <button type="button" className="u-link" onClick={() => {
          const node = viewerRef.current;
          if (!node) return;
          if (document.fullscreenElement) void document.exitFullscreen();
          else void node.requestFullscreen();
        }}>{t("montage.fullscreen")}</button>
      </div>
      <input className="u-scrub" type="range" min={0} max={Math.max(duration, 0.1)} step={0.01} value={Math.min(time, Math.max(duration, 0.1))} aria-label={t("montage.playhead")} onChange={event => seek(Number(event.target.value))} />
    </div>
    <div className="u-tl-tools">
      <button type="button" className="u-link" disabled={history.past.length === 0} aria-describedby={history.past.length === 0 ? "u-why-undo" : undefined} onClick={() => { const next = undo(historyRef.current); if (next !== historyRef.current) { show(next); void persist(next.present); } }}>{t("montage.undo")}</button>
      <Why on={history.past.length === 0} id="u-why-undo" text={t("montage.undoOff")} />
      <button type="button" className="u-link" disabled={history.future.length === 0} aria-describedby={history.future.length === 0 ? "u-why-redo" : undefined} onClick={() => { const next = redo(historyRef.current); if (next !== historyRef.current) { show(next); void persist(next.present); } }}>{t("montage.redo")}</button>
      <Why on={history.future.length === 0} id="u-why-redo" text={t("montage.redoOff")} />
      <button type="button" className="u-link" disabled={!splitOk} aria-describedby={!splitOk ? "u-why-split" : undefined} onClick={() => commitFrom(historyRef.current, splitVideo(historyRef.current.present, timeRef.current, `plan-${crypto.randomUUID()}`))}>{t("montage.split")}</button>
      <Why on={!splitOk} id="u-why-split" text={t("montage.splitOff")} />
      <button type="button" className="u-link" disabled={!selectedClip} aria-describedby={!selectedClip ? "u-why-delete" : undefined} onClick={() => { if (!selected) return; commitFrom(historyRef.current, deleteClip(historyRef.current.present, selected)); setSelected(null); }}>{t("montage.delete")}</button>
      <Why on={!selectedClip} id="u-why-delete" text={t("montage.deleteOff")} />
      <button type="button" className="u-link" onClick={() => setPx(current => nextZoom(current, 1 / 1.15))}>{t("montage.zoomOut")}</button>
      <button type="button" className="u-link" onClick={() => setPx(current => nextZoom(current, 1.15))}>{t("montage.zoomIn")}</button>
      {montageState !== "vide" && <button type="button" className="u-link" onClick={() => commitFrom(historyRef.current, emptyEdit(edit.id, edit.name))}>{t("montage.clear")}</button>}
      {montageState === "vide" && <button type="button" className="u-link" onClick={() => commitFrom(historyRef.current, exempleEdit())}>{t("montage.openExample")}</button>}
    </div>
    <div className="u-tl" ref={scrollerRef} onPointerDown={onPinchDown} onPointerMove={onPinchMove} onPointerUp={onPinchUp} onPointerCancel={onPinchUp}>
      <div className="u-tl-inner" style={{ width }}>
        <button type="button" className="u-playhead" style={{ left: TRACK_LABEL_PX + time * px }} aria-label={t("montage.playhead")} onPointerDown={event => {
          const target = event.currentTarget;
          target.setPointerCapture(event.pointerId);
          const move = (ev: PointerEvent) => seek(pointerTime(ev.clientX));
          const up = () => { target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", up); };
          target.addEventListener("pointermove", move);
          target.addEventListener("pointerup", up);
        }} />
        <div className="u-track-row">
          <span className="u-track-name">{t("montage.video")}</span>
          <div className="u-track" style={{ width: axis }}>{videoNodes}</div>
        </div>
        {(["voix", "effets", "musique"] as const).map(track => <div key={track} className="u-track-row" onDragOver={event => event.preventDefault()} onDrop={event => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) void addFile(file, track);
        }}>
          <span className="u-track-name">{trackName(track)}</span>
          <div className="u-track" style={{ width: axis }}>{edit.audio.filter(clip => clip.track === track).map(renderAudioClip)}</div>
        </div>)}
      </div>
    </div>
    {selectedAudio && <div className="u-levels">
      <label className="u-field"><span className="u-label">{t("montage.volume")}</span>
        <input type="range" min={0} max={1} step={0.05} value={selectedAudio.volume} onChange={event => commitFrom(historyRef.current, setAudioLevels(historyRef.current.present, selectedAudio.id, { volume: Number(event.target.value) }))} />
      </label>
      <label className="u-field"><span className="u-label">{t("montage.fadeIn")}</span>
        <input type="range" min={0} max={Math.max(span(selectedAudio), 0.1)} step={0.05} value={selectedAudio.fadeIn} onChange={event => commitFrom(historyRef.current, setAudioLevels(historyRef.current.present, selectedAudio.id, { fadeIn: Number(event.target.value) }))} />
      </label>
      <label className="u-field"><span className="u-label">{t("montage.fadeOut")}</span>
        <input type="range" min={0} max={Math.max(span(selectedAudio), 0.1)} step={0.05} value={selectedAudio.fadeOut} onChange={event => commitFrom(historyRef.current, setAudioLevels(historyRef.current.present, selectedAudio.id, { fadeOut: Number(event.target.value) }))} />
      </label>
    </div>}
    <div className="u-stem-actions">
      {(["voix", "effets", "musique"] as const).map(track => <label key={track} className="u-link">
        {t("montage.drop", { track: trackName(track) })}
        <input className="sr-only" type="file" accept="audio/*,video/mp4" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void addFile(file, track); }} />
      </label>)}
    </div>
    {studio.takes.length > 0 && <div className="u-suggest">
      {studio.takes.slice(0, 6).map(take => <button key={take.id} type="button" onClick={() => addTakeSound(take, "effets")}>{t("montage.fromTake", { name: take.line || take.id })}</button>)}
    </div>}
    <div className="u-stem-create">
      <button type="button" className="u-secondary" disabled={!connected} aria-describedby={!connected ? "u-why-voice" : undefined} onClick={() => { setStem("voix"); setScript(""); }}>{t("montage.addVoice")}</button>
      <Why on={!connected} id="u-why-voice" text={t("montage.needLink")} />
      <button type="button" className="u-secondary" disabled={!connected} aria-describedby={!connected ? "u-why-sfx" : undefined} onClick={() => setStem("effets")}>{t("montage.addSfx")}</button>
      <Why on={!connected} id="u-why-sfx" text={t("montage.needLink")} />
    </div>
    {stem && <div className="u-card">
      <p>{stem === "voix" ? t("montage.voiceLead") : t("montage.sfxLead")}</p>
      {stem === "voix" && <label className="u-field"><span className="u-label">{t("montage.script")}</span>
        <textarea rows={3} maxLength={1000} value={script} onChange={event => setScript(event.target.value)} />
      </label>}
      <p className="u-cost is-ok">{stem === "voix"
        ? (voice ? t("montage.voiceQuote", { amount: voice.credits, high: voice.high, count: script.trim().length }) : t("montage.voiceRate"))
        : (effect ? t("montage.sfxQuote", { amount: effect.credits, high: effect.high, seconds: SFX_DEFAULT_SECONDS }) : t("montage.sfxRate"))}</p>
      <button type="button" className="u-secondary" disabled={true} aria-describedby="u-why-create">{stem === "voix" ? t("montage.createVoice") : t("montage.createSfx")}</button>
      <Why on id="u-why-create" text={t("montage.createOff")} />
      <button type="button" className="u-link" onClick={() => setStem(null)}>{t("verb.cancel")}</button>
    </div>}
    {estimate && <p className="u-cost is-ok">{t("montage.exportAnnounce", { seconds: Math.round(estimate.seconds), size })}</p>}
    <button type="button" className="u-primary" data-export-gold="" disabled={!canExport} aria-describedby={!canExport ? "u-why-export" : undefined} onClick={() => {
      const current = historyRef.current.present;
      const plan = exportEstimate(editDuration(current));
      if (!plan || !exportAllowed(plan.seconds)) return;
      setExportPhase({ phase: "run", done: 0, total: plan.frames });
      void exportMp4({
        edit: current,
        urlOf: source => urlOfRef.current(source),
        onProgress: (done, total) => setExportPhase({ phase: "run", done, total }),
      }).then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${current.name || "montage"}.mp4`;
        link.click();
        setExportPhase({ phase: "done", bytes: blob.size });
      }).catch(() => setExportPhase({ phase: "fail" }));
    }}>{t("montage.export")}</button>
    <Why on={!canExport} id="u-why-export" text={exportWhy} />
    {exportPhase.phase === "run" && <div className="u-meter" role="progressbar" aria-valuemin={0} aria-valuemax={exportPhase.total} aria-valuenow={exportPhase.done}><span style={{ width: `${exportPhase.total ? (100 * exportPhase.done) / exportPhase.total : 0}%` }} /></div>}
    {exportPhase.phase === "fail" && <p className="u-why">{t("montage.exportFail")}</p>}
    {exportPhase.phase === "done" && <p className="u-small">{t("montage.exportDone")}</p>}
    {studio.takes.some(take => !edit.video.some(clip => clip.takeId === take.id)) && <div className="u-suggest">
      {studio.takes.filter(take => !edit.video.some(clip => clip.takeId === take.id)).slice(0, 6).map(take => <button key={`v-${take.id}`} type="button" onClick={() => {
        const seconds = take.settings.seconds > 0 ? take.settings.seconds : 1;
        const clip: VideoClip = { id: `plan-${take.id}`, kind: "video", source: take.video, label: take.line || take.id, media: seconds, start: 0, end: seconds, takeId: take.id };
        commitFrom(historyRef.current, appendVideo(historyRef.current.present, clip));
      }}>{t("montage.addTake", { name: take.line || take.id })}</button>)}
    </div>}
    <p className="u-small">{t("montage.savedHint", { time: formatClock(videoDuration(edit)) })}</p>
  </section>;
}
