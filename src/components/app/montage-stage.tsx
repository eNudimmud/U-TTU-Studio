"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { assetPath } from "@/lib/site";
import {
  addAudio, appendVideo, audioEnd, canSplit, clipGain, clipSpeed, collectSnapPoints, commit, deleteClip, duplicateAudio, duplicateVideo, editDuration,
  emptyEdit, fadeMix, formatClock, historyOf, mediaTime, moveAudio, nextZoom, playSpan, redo, reorderVideo, resolveSnap, setVideoFade, setVideoSpeed, setVideoTitle, snapThreshold, span,
  splitVideo, trimAudio, trimVideo, undo, videoAt, videoDuration, setAudioLevels,
  type AudioClip, type AudioTrackId, type Edit, type History, type VideoClip,
} from "@/lib/montage/edit";
import { exportAllowed, exportEstimate } from "@/lib/montage/export-plan";
import { exportMp4 } from "@/lib/montage/encode";
import { EXEMPLE_ID, exempleEdit } from "@/lib/montage/exemple";
import { chooseEdit, editFromShots } from "@/lib/montage/from-takes";
import { SFX_DEFAULT_SECONDS, sfxQuote, voiceQuote } from "@/lib/montage/quotes";
import { useI18n, useLocaleSwitch } from "@/components/i18n/provider";
import { Close, Expand, Film, Mic, More, Music, Pause, Play, Plus, Redo, Spark, Split, Trash, Undo, ZoomIn, ZoomOut } from "./glyphs";
import { useStudio } from "./studio-session";
import { gesteParId } from "@/lib/workflows/registre";

function Why({ on, text, id }: { on: boolean; text: string; id?: string }) {
  if (!on || !text) return null;
  return <p className="u-why" id={id}>{text}</p>;
}

function Tool({ id, off, reason, label, glyph, onClick }: { id: string; off: boolean; reason: string; label: string; glyph: ReactNode; onClick: () => void }) {
  return <span className="u-tool-slot">
    <button type="button" className="u-tool" disabled={off} aria-describedby={off ? id : undefined} aria-label={label} onClick={onClick}>{glyph}<span>{label}</span></button>
    {off && <span className="u-tip" id={id} role="tooltip">{reason}</span>}
  </span>;
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
        height: 48,
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
  return <div ref={host} className="u-wave" style={{ width: `${Math.max(1, media * px)}px`, marginLeft: `${-start * px}px` }} />;
}

type ExportPhase = { phase: "idle" } | { phase: "run"; done: number; total: number } | { phase: "done"; bytes: number } | { phase: "fail" };

const AUDIO_EXT = new Set(["wav", "mp3", "m4a", "ogg", "webm", "mp4"]);
const TRACK_LABEL_PX = 56;
type Panel = null | "more" | "confirm" | "export" | "video" | AudioTrackId;

function rulerStep(px: number): number {
  if (px >= 96) return 1;
  if (px >= 48) return 2;
  return 5;
}

function projectRatio(edit: Edit, takes: { id: string; settings: { aspect: string } }[]): "16/9" | "9/16" {
  let vertical = false;
  let horizontal = false;
  for (const clip of edit.video) {
    if (!clip.takeId) continue;
    const aspect = takes.find(take => take.id === clip.takeId)?.settings.aspect;
    if (aspect === "vertical") vertical = true;
    if (aspect === "horizontal") horizontal = true;
  }
  if (vertical && !horizontal) return "9/16";
  return "16/9";
}

export function MontageStage() {
  const { t } = useI18n();
  const { locale } = useLocaleSwitch();
  const { ready, studio, media, connected, loadMontages, saveMontage, pendingClip, holdClip } = useStudio();
  const [history, setHistory] = useState<History<Edit>>(() => historyOf(exempleEdit()));
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [px, setPx] = useState(48);
  const [selected, setSelected] = useState<string | null>(null);
  const [trimming, setTrimming] = useState<"start" | "end" | null>(null);
  const [stem, setStem] = useState<AudioTrackId | null>(null);
  const [script, setScript] = useState("");
  const [exportPhase, setExportPhase] = useState<ExportPhase>({ phase: "idle" });
  const [panel, setPanel] = useState<Panel>(null);
  const [menuAt, setMenuAt] = useState<{ top: number; left: number } | null>(null);
  const [magnet, setMagnet] = useState(false);
  const [gesteId, setGesteId] = useState("mont-voix");
  const [binTab, setBinTab] = useState<"medias" | AudioTrackId>("medias");
  const [binOpen, setBinOpen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const selectedRef = useRef<string | null>(null);
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
  selectedRef.current = selected;
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
    const want = mediaTime(hit.clip, hit.offset);
    node.playbackRate = clipSpeed(hit.clip);
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

  useEffect(() => {
    if (!pendingClip) return;
    const id = `plan-${crypto.randomUUID()}`;
    if (pendingClip.kind === "audio") {
      const clip: AudioClip = {
        id, track: "effets", source: pendingClip.source, label: pendingClip.label, media: 5, start: 0, end: 5,
        at: snapped(timeRef.current), volume: 0.8, fadeIn: 0, fadeOut: 0,
      };
      commitFrom(historyRef.current, addAudio(historyRef.current.present, clip));
    } else {
      const clip: VideoClip = {
        id, kind: pendingClip.kind === "image" ? "image" : "video", source: pendingClip.source, label: pendingClip.label,
        media: 5, start: 0, end: 5, takeId: null,
      };
      commitFrom(historyRef.current, appendVideo(historyRef.current.present, clip));
    }
    setSelected(id);
    holdClip(null);
  }, [pendingClip, holdClip]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      const key = event.key;
      if (key === " " || event.code === "Space") {
        event.preventDefault();
        toggle();
      } else if (key === "s" || key === "S") {
        if (!canSplit(historyRef.current.present, timeRef.current)) return;
        event.preventDefault();
        commitFrom(historyRef.current, splitVideo(historyRef.current.present, timeRef.current, `plan-${crypto.randomUUID()}`));
      } else if (key === "Delete" || key === "Backspace") {
        const id = selectedRef.current;
        if (!id) return;
        event.preventDefault();
        commitFrom(historyRef.current, deleteClip(historyRef.current.present, id));
        setSelected(null);
      } else if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        const next = undo(historyRef.current);
        if (next !== historyRef.current) { show(next); void persist(next.present); }
      } else if ((event.ctrlKey || event.metaKey) && (key.toLowerCase() === "y" || (event.shiftKey && key.toLowerCase() === "z"))) {
        event.preventDefault();
        const next = redo(historyRef.current);
        if (next !== historyRef.current) { show(next); void persist(next.present); }
      } else if (key === "ArrowLeft" || key === "ArrowRight") {
        event.preventDefault();
        seek(timeRef.current + (key === "ArrowLeft" ? -1 : 1) / 12);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("barre") !== "1") return;
    const clip = history.present.video[0];
    if (clip) setSelected(clip.id);
  }, [history]);

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
    const next = resolveSnap(timelineTime, collectSnapPoints(historyRef.current.present, timeRef.current, ignoreId), snapThreshold(pxRef.current));
    setMagnet(Math.abs(next - timelineTime) > 0.001);
    return next;
  }

  function edgeScroll(clientX: number) {
    const node = scrollerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (clientX < rect.left + 48) node.scrollLeft -= 18;
    else if (clientX > rect.right - 48) node.scrollLeft += 18;
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
      edgeScroll(ev.clientX);
      const x = pointerTime(ev.clientX);
      let cursor = 0;
      let to = base.present.video.length - 1;
      for (let i = 0; i < base.present.video.length; i += 1) {
        const width = playSpan(base.present.video[i]);
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
        const width = playSpan(base.present.video[i]);
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
      edgeScroll(ev.clientX);
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
  const selectedVideo = edit.video.find(clip => clip.id === selected) ?? null;
  const mix = fadeMix(edit, time);
  const nextShot = mix ? edit.video[mix.index + 1] : null;
  const nextUrl = nextShot?.kind === "image" && nextShot.source ? urlOf(nextShot.source) : "";
  const filled = edit.video.length + edit.audio.length > 0;
  const montageState = filled ? (edit.id === EXEMPLE_ID ? "exemple" : "projet") : "vide";
  const size = estimate ? (estimate.bytes >= 1_000_000
    ? t("montage.sizeMb", { amount: (estimate.bytes / 1_000_000).toFixed(1).replace(".", comma ? "," : ".") })
    : t("montage.sizeKb", { amount: String(Math.max(1, Math.round(estimate.bytes / 1000))) })) : "";
  const voice = voiceQuote(script.trim().length);
  const effect = sfxQuote(SFX_DEFAULT_SECONDS);
  const trackName = (id: AudioTrackId) => t(id === "voix" ? "montage.voix" : id === "effets" ? "montage.effets" : "montage.musique");

  function placeMenu(event: ReactMouseEvent | ReactPointerEvent) {
    const rect = event.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 288));
    const top = Math.min(rect.bottom + 6, window.innerHeight - 240);
    setMenuAt({ top, left });
  }

  function runExport() {
    const current = historyRef.current.present;
    const plan = exportEstimate(editDuration(current));
    if (!plan || !exportAllowed(plan.seconds) || exportPhase.phase === "run") return;
    setPanel("export");
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
  }

  function thumbOf(clip: VideoClip): string {
    if (clip.kind === "image" && clip.source) return urlOf(clip.source);
    if (!clip.takeId) return "";
    const poster = studio.takes.find(take => take.id === clip.takeId)?.poster;
    return poster ? urlOf(poster) : "";
  }

  function renderVideoClip(clip: VideoClip, index: number, origin: number) {
    const width = Math.max(playSpan(clip) * px, 48);
    const thumb = thumbOf(clip);
    return <div key={clip.id} className="u-clip is-video" data-selected={selected === clip.id || undefined} data-trimming={selected === clip.id ? trimming ?? undefined : undefined} style={{ left: origin * px, width }}>
      <button type="button" className="u-handle is-start" aria-label={t("montage.trimStart")} onPointerDown={event => onTrim(event, clip.id, "start", "video")} />
      <button type="button" className="u-clip-body" style={thumb ? { backgroundImage: `url(${thumb})` } : undefined} onPointerDown={event => { setSelected(clip.id); onReorder(event, index); }}><span>{clip.label}</span></button>
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
    cursor += playSpan(clip);
    return node;
  });
  const axis = Math.max(duration * px + 80, 280);
  const width = TRACK_LABEL_PX + axis;
  const ratio = projectRatio(edit, studio.takes);
  const exportBlocked = exportPhase.phase === "idle" && !canExport;
  const unusedTakes = studio.takes.filter(take => !edit.video.some(clip => clip.takeId === take.id));
  const ticks: number[] = [];
  const step = rulerStep(px);
  for (let mark = 0; mark <= Math.max(duration, step) + 1e-6; mark += step) ticks.push(Number(mark.toFixed(3)));

  function openPanel(next: Panel, event: ReactMouseEvent | ReactPointerEvent) {
    placeMenu(event);
    setPanel(current => current === next ? null : next);
  }

  return <section className="u-screen u-stage u-montage" data-section="montage" data-montage={montageState} data-export={exportPhase.phase} aria-labelledby="u-title">
    <header className="u-head u-montage-bar">
      <div>
        <p className="u-label">04</p>
        <h1 id="u-title" tabIndex={-1}>{t("nav.edit")}</h1>
      </div>
      <span className="u-tool-slot">
        <button type="button" className="u-export" data-export-open="" disabled={exportBlocked} aria-describedby={exportBlocked ? "u-why-export" : undefined} onClick={() => setPanel("export")}>{t("montage.exportShort")}</button>
        {exportBlocked && <span className="u-tip" id="u-why-export" role="tooltip">{exportWhy}</span>}
      </span>
    </header>
    <div className="u-capcut">
    <aside className="u-chutier" data-open={binOpen || undefined} aria-label={t("montage.bin")}>
      <div className="u-bin-tabs" role="tablist">
        {(["medias", "voix", "effets", "musique"] as const).map(tab => <button key={tab} type="button" role="tab" aria-selected={binTab === tab} onClick={() => setBinTab(tab)}>{t(tab === "medias" ? "montage.medias" : `montage.${tab}`)}</button>)}
      </div>
      {binTab === "medias" && edit.audio.length > 0 && <div className="u-chutier-row">
        {edit.audio.map(clip => <button key={clip.id} type="button" className="u-bin-sound" aria-pressed={selected === clip.id} onClick={() => { setSelected(clip.id); setBinTab(clip.track); }}>
          <Waveform url={urlOf(clip.source)} media={clip.media} start={0} px={36} />
          <span>{clip.label}</span>
        </button>)}
      </div>}
      {binTab === "medias" && <div className="u-chutier-row">
        {edit.video.map(clip => {
          const thumb = thumbOf(clip);
          return <button key={clip.id} type="button" aria-pressed={selected === clip.id} onClick={() => setSelected(clip.id)}>{thumb ? <img src={thumb} alt="" /> : null}<span>{clip.label}</span></button>;
        })}
        {studio.takes.map(take => {
          const poster = take.poster ? urlOf(take.poster) : "";
          return <button key={take.id} type="button" draggable onDragStart={event => event.dataTransfer.setData("application/x-uttu-take", take.id)} onClick={() => {
            const seconds = take.settings.seconds > 0 ? take.settings.seconds : 1;
            const clip: VideoClip = { id: `plan-${take.id}`, kind: "video", source: take.video, label: take.line || take.id, media: seconds, start: 0, end: seconds, takeId: take.id };
            if (edit.video.some(item => item.id === clip.id)) { setSelected(clip.id); return; }
            commitFrom(historyRef.current, appendVideo(historyRef.current.present, clip));
            setSelected(clip.id);
          }}>{poster ? <img src={poster} alt="" /> : null}<span>{take.line || take.id}</span></button>;
        })}
      </div>}
      {binTab !== "medias" && <div className="u-chutier-row">
        {edit.audio.filter(clip => clip.track === binTab).map(clip => <button key={clip.id} type="button" className="u-bin-sound" aria-pressed={selected === clip.id} onClick={() => setSelected(clip.id)}>
          <Waveform url={urlOf(clip.source)} media={clip.media} start={0} px={36} />
          <span>{clip.label}</span>
        </button>)}
      </div>}
      <div className="u-soon">
        <p className="u-label">{t("gestes.soon")}</p>
        {(binTab === "medias" ? ["mont-agrandir", "mont-fluide"] : binTab === "voix" ? ["mont-voix", "mont-levres"] : binTab === "effets" ? ["mont-effet"] : ["mont-musique"]).map(id => {
          const row = gesteParId(id);
          if (!row) return null;
          return <button key={id} type="button" className="u-tile is-soon" aria-pressed={gesteId === id} onClick={() => {
            setGesteId(id);
            if (id === "mont-voix") setStem("voix");
            if (id === "mont-effet") setStem("effets");
          }}>
            <span className="u-wave-mark" aria-hidden="true" />
            <strong>{t(`gestes.${row.clef}.title`)}</strong>
            <span>{t(`gestes.${row.clef}.phrase`)}</span>
          </button>;
        })}
      </div>
      <button type="button" className="u-link u-bin-close" onClick={() => setBinOpen(false)}>{t("verb.cancel")}</button>
    </aside>
    <div className="u-capcut-player">
    <p className="u-lead">{t("montage.lead")}</p>
    {montageState === "exemple" && <p className="u-small">{t("montage.exampleNote")}</p>}
    {montageState === "vide" && <p className="u-small">{t("montage.empty")}</p>}
    {studio.sequences.length > 1 && <div className="u-suggest">
      {studio.sequences.map(sequence => <button key={sequence.id} type="button" aria-pressed={edit.id === sequence.id} onClick={() => void loadMontages().then(saved => {
        const found = saved.find(item => item.id === sequence.id);
        show(historyOf(found ?? editFromShots(sequence, studio.shots, studio.takes)));
      })}>{sequence.name}</button>)}
    </div>}
    <div className="u-monitor">
      <div className="u-stage-frame">
        <div className="u-viewer" data-ratio={ratio} ref={viewerRef} onClick={toggle}>
          {picture ? <img src={picture} alt="" /> : null}
          {hit?.clip.kind === "video" ? <video ref={videoRef} playsInline /> : null}
          {hit?.clip.kind === "slate" ? <p className="u-slate">{t("montage.slate")}</p> : null}
          {!hit ? <p className="u-slate">{filled ? t("montage.end") : t("montage.empty")}</p> : null}
          {hit?.clip.title ? <p className="u-on-title">{hit.clip.title}</p> : null}
          {mix && nextUrl ? <img className="u-fade" src={nextUrl} alt="" style={{ opacity: mix.mix }} /> : mix ? <div className="u-fade" style={{ opacity: mix.mix }} /> : null}
        </div>
      </div>
      <div className="u-controls">
        <button type="button" className="u-play" aria-label={playing ? t("montage.pause") : t("montage.play")} onClick={toggle}>{playing ? <Pause /> : <Play />}</button>
        <span className="u-time">{t("montage.time", { now: formatClock(time), total: formatClock(duration) })}</span>
        <button type="button" className="u-icon" aria-label={t("montage.fullscreen")} onClick={() => {
          const node = viewerRef.current;
          if (!node) return;
          if (document.fullscreenElement) void document.exitFullscreen();
          else void node.requestFullscreen();
        }}><Expand /></button>
      </div>
    </div>
    </div>
    <div className="u-capcut-time">
    {(selectedVideo || selectedAudio) && <div className="u-floatbar" role="toolbar" aria-label={t("montage.context")}>
      {selectedVideo && <>
        <button type="button" disabled={!splitOk} aria-describedby={!splitOk ? "u-why-split" : undefined} onClick={() => commitFrom(historyRef.current, splitVideo(historyRef.current.present, timeRef.current, `plan-${crypto.randomUUID()}`))}><Split /><span>{t("montage.split")}</span></button>
        <button type="button" onClick={() => { const id = `plan-${crypto.randomUUID()}`; commitFrom(historyRef.current, duplicateVideo(historyRef.current.present, selectedVideo.id, id)); setSelected(id); }}><Plus /><span>{t("montage.duplicate")}</span></button>
        <span className="u-speed">
          <button type="button" aria-expanded={speedOpen} aria-label={t("montage.speed")} onClick={() => setSpeedOpen(current => !current)}>×{clipSpeed(selectedVideo)}</button>
          {speedOpen && <span className="u-speed-menu" role="menu">
            {([0.5, 1, 1.5, 2] as const).map(speed => <button key={speed} type="button" role="menuitem" aria-pressed={clipSpeed(selectedVideo) === speed} onClick={() => { commitFrom(historyRef.current, setVideoSpeed(historyRef.current.present, selectedVideo.id, speed)); setSpeedOpen(false); }}>×{speed}</button>)}
          </span>}
        </span>
        <button type="button" aria-pressed={(selectedVideo.fadeOut ?? 0) > 0} onClick={() => commitFrom(historyRef.current, setVideoFade(historyRef.current.present, selectedVideo.id, (selectedVideo.fadeOut ?? 0) > 0 ? 0 : Math.min(0.5, playSpan(selectedVideo))))}>{t("montage.fadeShort")}</button>
        <button type="button" aria-expanded={titleOpen} aria-label={t("montage.title")} onClick={() => setTitleOpen(current => !current)}>T</button>
        {titleOpen && <label className="u-field">
          <span className="sr-only">{t("montage.title")}</span>
          <input value={selectedVideo.title ?? ""} maxLength={80} placeholder={t("montage.titlePh")} onChange={event => commitFrom(historyRef.current, setVideoTitle(historyRef.current.present, selectedVideo.id, event.target.value))} />
        </label>}
      </>}
      {selectedAudio && <button type="button" onClick={() => { const id = `son-${crypto.randomUUID()}`; commitFrom(historyRef.current, duplicateAudio(historyRef.current.present, selectedAudio.id, id)); setSelected(id); }}><Plus /><span>{t("montage.duplicate")}</span></button>}
      <button type="button" onClick={() => { if (!selected) return; commitFrom(historyRef.current, deleteClip(historyRef.current.present, selected)); setSelected(null); }}><Trash /><span>{t("montage.delete")}</span></button>
    </div>}
    <div className="u-toolrow">
      <div className="u-toolrow-main">
        <Tool id="u-why-undo" off={history.past.length === 0} reason={t("montage.undoOff")} label={t("montage.undo")} glyph={<Undo />} onClick={() => { const next = undo(historyRef.current); if (next !== historyRef.current) { show(next); void persist(next.present); } }} />
        <Tool id="u-why-redo" off={history.future.length === 0} reason={t("montage.redoOff")} label={t("montage.redo")} glyph={<Redo />} onClick={() => { const next = redo(historyRef.current); if (next !== historyRef.current) { show(next); void persist(next.present); } }} />
        <Tool id="u-why-split" off={!splitOk} reason={t("montage.splitOff")} label={t("montage.split")} glyph={<Split />} onClick={() => commitFrom(historyRef.current, splitVideo(historyRef.current.present, timeRef.current, `plan-${crypto.randomUUID()}`))} />
        <Tool id="u-why-delete" off={!selectedClip} reason={t("montage.deleteOff")} label={t("montage.delete")} glyph={<Trash />} onClick={() => { if (!selected) return; commitFrom(historyRef.current, deleteClip(historyRef.current.present, selected)); setSelected(null); }} />
        <button type="button" className="u-tool" aria-label={t("montage.more")} aria-expanded={panel === "more" || panel === "confirm"} onClick={event => openPanel("more", event)}><More /><span>{t("montage.more")}</span></button>
        <button type="button" className="u-tool u-bin-toggle" aria-pressed={binOpen} onClick={() => setBinOpen(current => !current)}><Film /><span>{t("montage.bin")}</span></button>
      </div>
      <div className="u-toolrow-zoom">
        <button type="button" className="u-tool" aria-label={t("montage.zoomOut")} onClick={() => setPx(current => nextZoom(current, 1 / 1.15))}><ZoomOut /><span>−</span></button>
        <button type="button" className="u-tool" aria-label={t("montage.zoomIn")} onClick={() => setPx(current => nextZoom(current, 1.15))}><ZoomIn /><span>+</span></button>
      </div>
    </div>
    {magnet && <p className="u-snap">{t("montage.snap")}</p>}
    <div className="u-tl" data-snap={magnet || undefined} ref={scrollerRef} onPointerDown={onPinchDown} onPointerMove={onPinchMove} onPointerUp={onPinchUp} onPointerCancel={onPinchUp}>
      <div className="u-ruler-zoom" onPointerDown={event => event.stopPropagation()}>
        <button type="button" className="u-tool" aria-label={t("montage.zoomOut")} onClick={() => setPx(current => nextZoom(current, 1 / 1.15))}><ZoomOut /><span>−</span></button>
        <button type="button" className="u-tool" aria-label={t("montage.zoomIn")} onClick={() => setPx(current => nextZoom(current, 1.15))}><ZoomIn /><span>+</span></button>
      </div>
      <div className="u-tl-inner" style={{ width: `max(100%, ${width}px)` }}>
        <div className="u-playline" style={{ left: TRACK_LABEL_PX + time * px }} />
        <button type="button" className="u-playhead" style={{ left: TRACK_LABEL_PX + time * px }} aria-label={t("montage.playhead")} onPointerDown={event => {
          event.stopPropagation();
          const target = event.currentTarget;
          target.setPointerCapture(event.pointerId);
          const move = (ev: PointerEvent) => seek(pointerTime(ev.clientX));
          const up = () => { target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", up); };
          target.addEventListener("pointermove", move);
          target.addEventListener("pointerup", up);
        }} />
        <div className="u-track-row is-ruler">
          <span className="u-track-head" />
          <div className="u-ruler" onPointerDown={event => seek(pointerTime(event.clientX))}>
            {ticks.map(mark => <span key={mark} style={{ left: mark * px }}>{formatClock(mark)}</span>)}
          </div>
        </div>
        <div className="u-track-row" onDragOver={event => event.preventDefault()} onDrop={event => {
          event.preventDefault();
          const id = event.dataTransfer.getData("application/x-uttu-take");
          const take = studio.takes.find(item => item.id === id);
          if (!take) return;
          const seconds = take.settings.seconds > 0 ? take.settings.seconds : 1;
          const clip: VideoClip = { id: `plan-${take.id}-${crypto.randomUUID().slice(0, 8)}`, kind: "video", source: take.video, label: take.line || take.id, media: seconds, start: 0, end: seconds, takeId: take.id };
          commitFrom(historyRef.current, appendVideo(historyRef.current.present, clip));
          setSelected(clip.id);
        }}>
          <div className="u-track-head">
            <span className="u-track-mark" title={t("montage.video")} aria-label={t("montage.video")}><Film /></span>
            {unusedTakes.length > 0 && <button type="button" className="u-track-add" aria-label={t("montage.addOnTrack", { track: t("montage.video") })} onClick={event => openPanel("video", event)}><Plus /></button>}
          </div>
          <div className="u-track">{videoNodes}</div>
        </div>
        {(["voix", "effets", "musique"] as const).map(track => <div key={track} className="u-track-row is-audio" onDragOver={event => event.preventDefault()} onDrop={event => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) void addFile(file, track);
        }}>
          <div className="u-track-head">
            <span className="u-track-mark" title={trackName(track)} aria-label={trackName(track)}>{track === "voix" ? <Mic /> : track === "effets" ? <Spark /> : <Music />}</span>
            <button type="button" className="u-track-add" aria-label={t("montage.addOnTrack", { track: trackName(track) })} onClick={event => openPanel(track, event)}><Plus /></button>
          </div>
          <div className="u-track">{edit.audio.filter(clip => clip.track === track).map(renderAudioClip)}</div>
        </div>)}
      </div>
    </div>
    {selectedAudio && <div className="u-levels">
      <button type="button" className="u-link" onClick={() => { const id = `son-${crypto.randomUUID()}`; commitFrom(historyRef.current, duplicateAudio(historyRef.current.present, selectedAudio.id, id)); setSelected(id); }}>{t("montage.duplicate")}</button>
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
    </div>
    </div>
    {(panel === "more" || panel === "confirm" || panel === "video" || panel === "voix" || panel === "effets" || panel === "musique") && menuAt && <>
      <button type="button" className="u-menu-back" aria-label={t("verb.cancel")} onClick={() => setPanel(null)} />
      <div className="u-popover" role="menu" style={{ top: menuAt.top, left: menuAt.left }}>
        {panel === "more" && <>
          <p className="u-small">{t("montage.shortcutHelp")}</p>
          {filled
            ? <button type="button" onClick={() => setPanel("confirm")}>{t("montage.clear")}</button>
            : <button type="button" onClick={() => { commitFrom(historyRef.current, exempleEdit()); setPanel(null); }}>{t("montage.openExample")}</button>}
        </>}
        {panel === "confirm" && <>
          <p>{t("montage.clearAsk")}</p>
          <button type="button" onClick={() => { commitFrom(historyRef.current, emptyEdit(edit.id, edit.name)); setSelected(null); setPanel(null); }}>{t("montage.clearYes")}</button>
          <button type="button" onClick={() => setPanel(null)}>{t("verb.cancel")}</button>
        </>}
        {panel === "video" && unusedTakes.slice(0, 6).map(take => <button key={take.id} type="button" onClick={() => {
          const seconds = take.settings.seconds > 0 ? take.settings.seconds : 1;
          const clip: VideoClip = { id: `plan-${take.id}`, kind: "video", source: take.video, label: take.line || take.id, media: seconds, start: 0, end: seconds, takeId: take.id };
          commitFrom(historyRef.current, appendVideo(historyRef.current.present, clip));
          setPanel(null);
        }}>{t("montage.addTake", { name: take.line || take.id })}</button>)}
        {(panel === "voix" || panel === "effets" || panel === "musique") && <label>
          {t("montage.dropFile")}
          <input className="sr-only" type="file" accept="audio/*,video/mp4" onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = "";
            setPanel(null);
            if (file) void addFile(file, panel);
          }} />
        </label>}
        {panel === "voix" && <>
          <button type="button" disabled={!connected} aria-describedby={!connected ? "u-why-voice" : undefined} onClick={() => { setStem("voix"); setScript(""); setPanel(null); }}>{t("montage.addVoice")}</button>
          {!connected && <Why on id="u-why-voice" text={t("montage.needLink")} />}
          <p className="u-small">{voice ? t("montage.voiceQuote", { amount: voice.credits, high: voice.high, count: Math.max(script.trim().length, 1) }) : t("montage.voiceRate")}</p>
        </>}
        {panel === "effets" && <>
          <button type="button" disabled={!connected} aria-describedby={!connected ? "u-why-sfx" : undefined} onClick={() => { setStem("effets"); setPanel(null); }}>{t("montage.addSfx")}</button>
          {!connected && <Why on id="u-why-sfx" text={t("montage.needLink")} />}
          <p className="u-small">{effect ? t("montage.sfxQuote", { amount: effect.credits, high: effect.high, seconds: SFX_DEFAULT_SECONDS }) : t("montage.sfxRate")}</p>
          {studio.takes.slice(0, 6).map(take => <button key={take.id} type="button" onClick={() => { addTakeSound(take, "effets"); setPanel(null); }}>{t("montage.fromTake", { name: take.line || take.id })}</button>)}
        </>}
      </div>
    </>}
    {stem && <div className="u-overlay" role="presentation" onClick={event => { if (event.target === event.currentTarget) setStem(null); }}>
      <div className="u-sheet" role="dialog" aria-modal="true">
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
      </div>
    </div>}
    {panel === "export" && <div className="u-overlay" role="presentation" onClick={event => { if (event.target === event.currentTarget && exportPhase.phase !== "run") setPanel(null); }}>
      <div className="u-sheet" role="dialog" aria-modal="true" aria-labelledby="u-export-title">
        <div className="u-sheet-head">
          <h2 id="u-export-title">{t("montage.exportShort")}</h2>
          <button type="button" className="u-icon" aria-label={t("verb.cancel")} disabled={exportPhase.phase === "run"} aria-describedby={exportPhase.phase === "run" ? "u-why-export-close" : undefined} onClick={() => setPanel(null)}><Close /></button>
        </div>
        {exportPhase.phase === "run" && <span className="sr-only" id="u-why-export-close">{t("montage.exportRun")}</span>}
        {estimate ? <p className="u-cost is-ok">{t("montage.exportAnnounce", { seconds: Math.round(estimate.seconds), size })}</p> : <p className="u-why">{t("montage.exportOff")}</p>}
        <button type="button" className="u-primary" data-export-gold="" disabled={!canExport} aria-describedby={!canExport ? "u-why-export-go" : undefined} onClick={runExport}>{t("montage.export")}</button>
        {!canExport && <Why on id="u-why-export-go" text={exportWhy} />}
        {exportPhase.phase === "run" && <div className="u-meter" role="progressbar" aria-valuemin={0} aria-valuemax={exportPhase.total} aria-valuenow={exportPhase.done}><span style={{ width: `${exportPhase.total ? (100 * exportPhase.done) / exportPhase.total : 0}%` }} /></div>}
        {exportPhase.phase === "fail" && <p className="u-why">{t("montage.exportFail")}</p>}
        {exportPhase.phase === "done" && <p className="u-small">{t("montage.exportDone")}</p>}
      </div>
    </div>}
    <p className="u-small">{t("montage.savedHint", { time: formatClock(videoDuration(edit)) })}</p>
  </section>;
}
