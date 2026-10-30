"use client";

import { useEffect, useRef } from "react";
import { watchShown } from "@/lib/dom/shown";
import { contourCanvas, png, type CaptureFraming } from "@/lib/maquette/framing";
import type { MaquetteState } from "@/lib/maquette/state";

type Flat = NonNullable<MaquetteState["flat"]>;
interface Props {
  state: MaquetteState;
  backdrop: string;
  onMove(id: string, x: number, z: number): void;
  onFlat(flat: Flat): void;
  onCaptureReady?(capture: CaptureFraming | null): void;
}

/** Canvas fallback. Gestures and exported controls share exactly the same drawing. */
export function FramingFlat(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef(props); live.current = props;
  const image = useRef<HTMLImageElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ id: string | null; x: number; y: number } | null>(null);
  const pinch = useRef(0);
  const flat = () => live.current.state.flat ?? { x: 0, y: 0, zoom: 1 };

  function draw(width: number, height: number, depth = false) {
    const out = document.createElement("canvas"); out.width = width; out.height = height;
    const ctx = out.getContext("2d")!;
    const f = flat();
    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, depth ? "#000000" : "#181511"); base.addColorStop(1, depth ? "#808080" : "#30291d");
    ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);
    if (!depth && image.current) {
      const img = image.current;
      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight) * f.zoom;
      ctx.drawImage(img, (width - img.naturalWidth * scale) / 2 + f.x * width, (height - img.naturalHeight * scale) / 2 + f.y * height, img.naturalWidth * scale, img.naturalHeight * scale);
    }
    for (const figure of [...live.current.state.figures].sort((a, b) => a.z - b.z)) {
      const x = width * (.5 + figure.x * .08 * f.zoom + f.x);
      const y = height * (.82 + figure.z * .05 * f.zoom + f.y);
      const h = height * .48 * f.zoom;
      const shade = Math.round(220 + figure.z * 5);
      ctx.fillStyle = depth ? `rgb(${shade},${shade},${shade})` : figure.color;
      ctx.beginPath(); ctx.ellipse(x, y - h * .88, h * .09, h * .11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - h * .12, y - h * .74, h * .24, h * .44);
      ctx.fillRect(x - h * .115, y - h * .31, h * .09, h * .31);
      ctx.fillRect(x + h * .025, y - h * .31, h * .09, h * .31);
      ctx.fillRect(x - h * .20, y - h * .70, h * .07, h * .40);
      ctx.fillRect(x + h * .13, y - h * .70, h * .07, h * .40);
    }
    return out;
  }

  useEffect(() => {
    let dead = false;
    image.current = null;
    let loaded = Promise.resolve(!props.backdrop);
    const capture: CaptureFraming = async (width, height) => {
      if (!await loaded || dead) throw new Error("L’image du décor n’est pas encore disponible.");
      const color = draw(width, height);
      const [colorPng, depth, edges] = await Promise.all([png(color), png(draw(width, height, true)), png(contourCanvas(color))]);
      return { source: "2d", width, height, color: colorPng, depth, edges };
    };
    if (props.backdrop) {
      const img = new Image(); img.crossOrigin = "anonymous";
      loaded = new Promise<boolean>(resolve => {
        img.onload = () => { if (!dead) { image.current = img; paint(); } resolve(!dead); };
        img.onerror = () => resolve(false);
      });
      img.src = props.backdrop;
    }
    const paint = () => {
      const node = canvas.current; if (!node) return;
      node.width = Math.max(1, node.clientWidth); node.height = Math.max(1, node.clientHeight);
      node.getContext("2d")!.drawImage(draw(node.width, node.height), 0, 0);
    };
    const observer = new ResizeObserver(paint); if (canvas.current) observer.observe(canvas.current);
    paint();
    // Repaint only while on screen: behind a closed group or a hidden tab this timer must sleep.
    const view = canvas.current ? watchShown(canvas.current, paint) : null;
    const timer = window.setInterval(() => { if (view?.shown() !== false) paint(); }, 100);
    // Keep a stable button during a media-URL refresh. The export itself waits
    // for the image, rather than losing a tap while the button becomes disabled.
    props.onCaptureReady?.(capture);
    return () => { dead = true; observer.disconnect(); view?.stop(); window.clearInterval(timer); props.onCaptureReady?.(null); };
  }, [props.backdrop]);

  function down(event: React.PointerEvent<HTMLCanvasElement>) {
    const node = event.currentTarget; node.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]; pinch.current = Math.hypot(a.x - b.x, a.y - b.y); drag.current = null; return;
    }
    const box = node.getBoundingClientRect(); const f = flat();
    const x = (event.clientX - box.left) / box.width; const y = (event.clientY - box.top) / box.height;
    const hit = [...live.current.state.figures].reverse().find(figure => Math.abs(x - (.5 + figure.x * .08 * f.zoom + f.x)) < .11 * f.zoom && y < .82 + figure.z * .05 * f.zoom + f.y && y > .82 + figure.z * .05 * f.zoom + f.y - .48 * f.zoom);
    drag.current = { id: hit?.id ?? null, x: event.clientX, y: event.clientY };
  }
  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const f = flat();
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]; const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current > 0 && !props.state.lockCam) props.onFlat({ ...f, zoom: Math.max(.5, Math.min(3, f.zoom * distance / pinch.current)) });
      pinch.current = distance; return;
    }
    const held = drag.current; if (!held) return;
    const box = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - held.x) / box.width; const dy = (event.clientY - held.y) / box.height;
    const figure = live.current.state.figures.find(item => item.id === held.id);
    if (figure && !props.state.lockPose) props.onMove(figure.id, figure.x + dx / (.08 * f.zoom), figure.z + dy / (.05 * f.zoom));
    else if (!held.id && !props.state.lockCam) props.onFlat({ ...f, x: Math.max(-1, Math.min(1, f.x + dx)), y: Math.max(-1, Math.min(1, f.y + dy)) });
    held.x = event.clientX; held.y = event.clientY;
  }
  function up(event: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId); drag.current = null; pinch.current = 0;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return <canvas ref={canvas} className="u-maquette-canvas u-framing-flat" data-framing-flat="" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />;
}
