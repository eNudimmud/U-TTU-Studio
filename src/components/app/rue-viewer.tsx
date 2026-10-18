"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from "react";
import { useI18n } from "@/components/i18n/provider";
import "@photo-sphere-viewer/core/index.css";
import type { Viewer } from "@photo-sphere-viewer/core";
import { cadrePano, type PhotoRue } from "@/lib/repere/panoramax";

export interface RueHandle {
  capture(): Promise<Blob | null>;
}

interface Props {
  photo: PhotoRue | null;
  demo: boolean;
  cap: number;
  onCap(degrees: number): void;
  onFail(): void;
}

export const RueViewer = forwardRef<RueHandle, Props>(function RueViewer({ photo, demo, cap, onCap, onFail }, ref) {
  const { t } = useI18n();
  const [flat, setFlat] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; cap: number } | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const capRef = useRef(onCap);
  const failRef = useRef(onFail);
  capRef.current = onCap;
  failRef.current = onFail;

  useImperativeHandle(ref, () => ({
    async capture() {
      if (demo) return blobOf(canvasRef.current);
      const viewer = viewerRef.current;
      if (!viewer) return null;
      viewer.needsUpdate();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = viewer.container.querySelector("canvas");
      const shot = canvas instanceof HTMLCanvasElement ? await blobOf(canvas) : null;
      if (shot && shot.size > 800) return shot;
      return null;
    },
  }), [demo]);

  useEffect(() => {
    if (!demo) return;
    const canvas = canvasRef.current;
    if (!canvas || !photo) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = Math.max(2, Math.round(canvas.clientWidth * 2));
    const height = Math.max(2, Math.round(canvas.clientHeight * 2));
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = "#17171a";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#6e8ea8";
    ctx.fillRect(0, 0, width, height * 0.46);
    const shift = (cap % 360) / 360 * width;
    ctx.fillStyle = "#2a2a30";
    for (let index = 0; index < 8; index += 1) {
      const x = ((index * (width / 6) - shift) % width + width) % width;
      ctx.fillRect(x, height * 0.18, width / 10, height * 0.32);
    }
    ctx.fillStyle = "#3a3a41";
    ctx.fillRect(0, height * 0.55, width, height * 0.45);
    ctx.fillStyle = "#ededf0";
    ctx.font = "32px sans-serif";
    ctx.fillText(photo.author, 24, 56);
  }, [demo, photo, cap]);

  useEffect(() => {
    if (demo || !photo || !host.current) return;
    const node = host.current;
    const picture = photo;
    let dead = false;
    const fallback = () => {
      if (dead) return;
      viewerRef.current?.destroy();
      viewerRef.current = null;
      setFlat(true);
    };
    // Keep the real photograph available when panoramic rendering is unavailable.
    const probe = document.createElement("canvas");
    let webgl: WebGL2RenderingContext | null = null;
    try { webgl = probe.getContext("webgl2"); } catch { /* image fallback below */ }
    if (!webgl) { fallback(); return; }
    webgl.getExtension("WEBGL_lose_context")?.loseContext();
    void import("@photo-sphere-viewer/core").then(({ Viewer }) => {
      if (dead || !node.isConnected) return;
      const frame = (image: { width: number; height: number }) => cadrePano(picture, image.width, image.height);
      const fov = {
        minFov: picture.tour ? 30 : 10,
        maxFov: picture.tour ? 90 : Math.min(100, picture.fov && picture.fov < 220 ? picture.fov : 80),
      };
      const current = viewerRef.current;
      if (current) {
        current.setOptions(fov);
        void current.setPanorama(picture.view, { transition: false, showLoader: true, panoData: frame }).catch(fallback);
        return;
      }
      const viewer = new Viewer({
        container: node,
        panorama: picture.view,
        navbar: false,
        touchmoveTwoFingers: false,
        mousewheel: true,
        mousemove: true,
        keyboard: false,
        defaultZoomLvl: picture.tour ? 40 : 10,
        ...fov,
        panoData: frame,
      });
      viewer.addEventListener("position-updated", event => {
        const yaw = event.position.yaw;
        capRef.current(Math.round(((yaw * 180) / Math.PI + 360) % 360));
      });
      viewer.addEventListener("panorama-error", fallback);
      viewerRef.current = viewer;
    }).catch(fallback);
    return () => {
      dead = true;
    };
  }, [demo, photo]);

  useEffect(() => () => {
    viewerRef.current?.destroy();
    viewerRef.current = null;
  }, []);

  function look(event: PointerEvent<HTMLCanvasElement>) {
    if (!demo) return;
    if (event.type === "pointerdown") {
      drag.current = { x: event.clientX, cap };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (!drag.current) return;
    if (event.type === "pointerup" || event.type === "pointercancel") {
      drag.current = null;
      return;
    }
    const next = (drag.current.cap - (event.clientX - drag.current.x) * 0.45 + 360) % 360;
    onCap(Math.round(next));
  }

  return <div className="u-rue-stage" data-rue-vue="" data-cap={cap} data-photo={photo?.id ?? ""}>
    {demo
      ? <canvas
        ref={canvasRef}
        className="u-rue-canvas"
        aria-hidden="true"
        onPointerDown={look}
        onPointerMove={look}
        onPointerUp={look}
        onPointerCancel={look}
      />
      : flat && photo ? <div className="u-rue-flat" data-rue-flat="">
        <img src={photo.view} alt={`${photo.author} · ${photo.license}`} onError={() => failRef.current()} />
        <p>{t("audit.flatPhoto")}</p>
      </div> : <div ref={host} className="u-rue-live" />}
  </div>;
});

function blobOf(canvas: HTMLCanvasElement | null): Promise<Blob | null> {
  if (!canvas || canvas.width < 2) return Promise.resolve(null);
  const out = document.createElement("canvas");
  out.width = Math.min(1280, canvas.width);
  out.height = Math.max(2, Math.round(out.width * (canvas.height / canvas.width)));
  const ctx = out.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return new Promise(resolve => out.toBlob(file => resolve(file), "image/jpeg", 0.86));
}
