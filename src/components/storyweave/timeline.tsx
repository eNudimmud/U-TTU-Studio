"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useI18n } from "@/components/i18n/provider";
import { formatClock } from "@/lib/montage/edit";
import type { Storyboard } from "@/lib/storyboard/storyboard";
import { buildTimeline, shotRows, timelineDuration, TRACKS, type SwClip, type SwEdit } from "@/lib/storyweave/timeline";
import { Icon, ICON } from "./icons";

export function Timeline({
  sb, edit, filmed, locked, onOpenShot, onTrim, onReorder, onSplit, onDelete, onAddText,
}: {
  sb: Storyboard | null;
  edit: SwEdit;
  filmed: ReadonlySet<string>;
  locked: ReadonlySet<string>;
  onOpenShot: (shotId: string) => void;
  onTrim: (shotId: string, duration: number) => void;
  onReorder: (from: number, to: number) => void;
  onSplit: (shotId: string) => void;
  onDelete: (clip: SwClip) => void;
  onAddText: (at: number) => void;
}) {
  const { t } = useI18n();
  const clips = sb ? buildTimeline(sb, edit, filmed) : [];
  const rows = sb ? shotRows(sb, edit) : [];
  const total = Math.max(timelineDuration(clips), 1);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    const root = wrap.current?.closest(".sw-app");
    if (root instanceof HTMLElement) root.dataset.full = full ? "true" : "false";
  }, [full]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      setPlayhead(current => {
        const next = current + delta;
        if (next >= total) { setPlaying(false); return 0; }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, total]);

  const pps = 36;
  const width = Math.max(total * pps, 280);
  const left = (seconds: number) => seconds * pps;
  const selectedClip = clips.find(clip => clip.id === selected) ?? null;
  const video = clips.filter(clip => clip.track === "video");
  const shotAt = rows.findIndex(row => playhead >= row.start && playhead < row.start + row.duration);

  const jump = (dir: -1 | 1) => {
    const index = Math.min(rows.length - 1, Math.max(0, shotAt < 0 ? 0 : shotAt + dir));
    setPlayhead(rows[index]?.start ?? 0);
  };

  return <div className="sw-tl" ref={wrap} aria-label={t("storyweave.timeline")} data-sw-tracks="4">
    <div className="sw-bar">
      <div>
        <button type="button" className="sw-ib" aria-label={t("storyweave.split")} disabled={!selectedClip || selectedClip.track !== "video" || !selectedClip.shotId} onClick={() => selectedClip?.shotId && onSplit(selectedClip.shotId)}><Icon d={ICON.cut} /></button>
        <button type="button" className="sw-ib" aria-label={t("storyweave.addText")} onClick={() => onAddText(playhead)}><Icon d={ICON.text} /></button>
        <button type="button" className="sw-ib" aria-label={t("storyweave.delete")} disabled={!selectedClip} data-sw-delete="" onClick={() => selectedClip && onDelete(selectedClip)}><Icon d={ICON.del} /></button>
      </div>
      <div className="sw-mid">
        <button type="button" className="sw-ib" aria-label={t("storyweave.prev")} onClick={() => jump(-1)}><Icon d={ICON.prev} /></button>
        <button type="button" className="sw-play" aria-label={playing ? t("storyweave.pause") : t("storyweave.play")} data-sw-play="" onClick={() => setPlaying(value => !value)}><Icon d={ICON.play} /></button>
        <button type="button" className="sw-ib" aria-label={t("storyweave.next")} onClick={() => jump(1)}><Icon d={ICON.next} /></button>
        <span className="sw-tc" data-sw-tc="">{formatClock(playhead)} / {formatClock(total === 1 && clips.length === 0 ? 0 : total)}</span>
      </div>
      <button type="button" className="sw-ib" aria-label={t("storyweave.full")} onClick={() => setFull(value => !value)}><Icon d={ICON.full} /></button>
    </div>
    <div className="sw-lanes">
      <div className="sw-heads" aria-hidden="true">
        <span />
        <span title={t("storyweave.track.video")}><Icon d={ICON.cam} size={16} /></span>
        <span title={t("storyweave.track.voice")}><Icon d={ICON.mic} size={16} /></span>
        <span title={t("storyweave.track.music")}><Icon d={ICON.note} size={16} /></span>
        <span title={t("storyweave.track.text")}><Icon d={ICON.text} size={16} /></span>
      </div>
      <div className="sw-scroll"><div className="sw-track-w" style={{ width }}>
        <div className="sw-ruler">{Array.from({ length: Math.floor(total / 10) + 1 }, (_, index) => <span key={index} style={{ left: left(index * 10) }}>{formatClock(index * 10)}</span>)}</div>
        {TRACKS.map(track => <div key={track} className={`sw-tr${track === "video" ? " is-v" : ""}`} data-sw-track={track}>
          {clips.filter(clip => clip.track === track).map(clip => {
            const index = video.findIndex(item => item.id === clip.id);
            return <button key={clip.id} type="button" className={`sw-clip${track === "video" ? "" : track === "text" ? " is-t" : " is-a"}${clip.track === "video" && !clip.filmed ? " is-frame" : ""}${selected === clip.id ? " is-sel" : ""}`}
              style={{ left: left(clip.start), width: Math.max(left(clip.duration), 44) }}
              aria-label={clip.label || t(`storyweave.track.${track}`)}
              data-sw-clip={clip.id}
              onClick={() => { setSelected(clip.id); if (clip.shotId) onOpenShot(clip.shotId); }}
              onPointerDown={event => {
                if (clip.track !== "video" || index < 0) return;
                const startX = event.clientX;
                let hold = false;
                let target = index;
                const timer = window.setTimeout(() => { hold = true; }, 380);
                const move = (ev: PointerEvent) => {
                  if (!hold && Math.abs(ev.clientX - startX) > 8) window.clearTimeout(timer);
                  if (!hold) return;
                  const box = (event.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
                  if (!box) return;
                  const x = ev.clientX - box.left;
                  target = video.findIndex(item => x >= left(item.start) && x < left(item.start) + Math.max(left(item.duration), 44));
                  if (target < 0) target = x > left(total) / 2 ? video.length - 1 : 0;
                  drag.current = { from: index, to: target };
                };
                const up = () => {
                  window.clearTimeout(timer);
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                  if (hold && drag.current && drag.current.from !== drag.current.to) onReorder(drag.current.from, drag.current.to);
                  drag.current = null;
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
            >
              {track === "video" && <span className="sw-frame">{clip.filmed ? "" : t("storyweave.frame")}</span>}
              {track === "text" && <span>{clip.label}</span>}
              {selected === clip.id && clip.track === "video" && <>
                <span className="sw-hd is-l" onPointerDown={event => startTrim(event, clip, "start", pps, onTrim)} />
                <span className="sw-hd is-r" onPointerDown={event => startTrim(event, clip, "end", pps, onTrim)} />
              </>}
              {locked.has(clip.shotId ?? "") && track === "video" && <Icon d={ICON.lock} size={14} />}
            </button>;
          })}
        </div>)}
        <div className="sw-ph" style={{ left: left(Math.min(playhead, total)) }} />
        {selectedClip?.track === "video" && <div className="sw-tip" style={{ left: left(selectedClip.start) }}>{t("storyweave.trimHint", { seconds: String(selectedClip.duration) })}</div>}
      </div></div>
    </div>
  </div>;
}

function startTrim(event: ReactPointerEvent, clip: SwClip, edge: "start" | "end", pps: number, onTrim: (shotId: string, duration: number) => void) {
  event.stopPropagation();
  event.preventDefault();
  if (!clip.shotId) return;
  const origin = event.clientX;
  const initial = clip.duration;
  const up = (ev: PointerEvent) => {
    window.removeEventListener("pointerup", up);
    const delta = (ev.clientX - origin) / pps;
    const duration = edge === "end" ? initial + delta : initial - delta;
    onTrim(clip.shotId!, Math.max(0.5, duration));
  };
  window.addEventListener("pointerup", up);
}
