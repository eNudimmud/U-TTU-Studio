"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_PIXEL_RATIO } from "@/lib/maquette/state";
import { sampleRelief, snapToStreet, standsInStreet, type Quartier } from "@/lib/repere/quartier";
import type { Regard } from "@/lib/repere/lieu";
import { drawQuartier } from "./quartier-draw";

interface Props {
  quartier: Quartier;
  regard: Regard;
  onStand(next: { x: number; z: number }): void;
  onCap?(degrees: number): void;
}

export function QuartierView({ quartier, regard, onStand, onCap }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const quartierRef = useRef(quartier);
  const standRef = useRef(onStand);
  const capRef = useRef(onCap);
  quartierRef.current = quartier;
  standRef.current = onStand;
  capRef.current = onCap;
  const heading = quartier.heading;
  const [cap, setCap] = useState(0);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let dead = false;
    let stop = () => {};
    void import("three").then(THREE => {
      if (dead || !host.current) return;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1));
      renderer.setClearColor(0x14110c, 1);
      const canvas = renderer.domElement;
      canvas.className = "u-quartier-canvas";
      host.current.replaceChildren(canvas);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x14110c);
      scene.fog = new THREE.Fog(0x14110c, 36, 120);
      const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
      scene.add(new THREE.HemisphereLight(0xfff1d0, 0x201810, 1.15));
      const sun = new THREE.DirectionalLight(0xffe0a0, 1.15);
      sun.position.set(30, 50, 20);
      scene.add(sun);
      const drawn = drawQuartier(THREE, quartierRef.current);
      scene.add(drawn.group);
      const orbit = {
        theta: (-heading * Math.PI) / 180,
        phi: regard === "dessus" ? 0.38 : 1.45,
      };
      const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const raycaster = new THREE.Raycaster();
      let last: { x: number; y: number } | null = null;
      let moved = 0;

      function paint() {
        if (dead || !host.current) return;
        const current = quartierRef.current;
        const y = sampleRelief(current.relief, current.stand.x, current.stand.z) + 0.2;
        drawn.stand.position.set(current.stand.x, y, current.stand.z);
        const width = host.current.clientWidth || 1;
        const height = host.current.clientHeight || 1;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
        const eye = sampleRelief(current.relief, current.stand.x, current.stand.z) + 1.65;
        const fx = Math.sin(orbit.theta);
        const fz = -Math.cos(orbit.theta);
        if (regard === "dessus") {
          camera.position.set(current.stand.x + fx * 10, eye + 38, current.stand.z + fz * 10);
          camera.lookAt(current.stand.x, 0, current.stand.z);
        } else {
          const back = 2.4;
          camera.position.set(current.stand.x - fx * back, eye, current.stand.z - fz * back);
          camera.lookAt(current.stand.x + fx * 14, eye - 1.05, current.stand.z + fz * 14);
        }
        renderer.render(scene, camera);
      }

      function ndc(event: PointerEvent) {
        const rect = canvas.getBoundingClientRect();
        return new THREE.Vector2(
          ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
          -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
        );
      }

      function onDown(event: PointerEvent) {
        try { canvas.setPointerCapture(event.pointerId); } catch { /* the drag still follows the pointer */ }
        last = { x: event.clientX, y: event.clientY };
        moved = 0;
      }
      function onMove(event: PointerEvent) {
        if (!last) return;
        const dx = event.clientX - last.x;
        const dy = event.clientY - last.y;
        moved += Math.abs(dx) + Math.abs(dy);
        orbit.theta -= dx * 0.008;
        orbit.phi = Math.max(0.25, Math.min(1.5, orbit.phi + dy * 0.006));
        last = { x: event.clientX, y: event.clientY };
        paint();
      }
      function reportCap() {
        const degrees = Math.round((((-orbit.theta * 180) / Math.PI) % 360 + 360) % 360);
        setCap(degrees);
        capRef.current?.(degrees);
      }

      function onUp(event: PointerEvent) {
        const tap = moved < 8;
        last = null;
        if (!tap) {
          reportCap();
          return;
        }
        raycaster.setFromCamera(ndc(event), camera);
        const point = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(ground, point)) return;
        standRef.current(snapToStreet(quartierRef.current, point.x, point.z));
        paint();
      }

      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      const observer = new ResizeObserver(() => paint());
      observer.observe(host.current);
      paint();
      reportCap();
      stop = () => {
        observer.disconnect();
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        drawn.dispose();
        renderer.dispose();
        canvas.remove();
      };
    }).catch(() => {});

    return () => {
      dead = true;
      stop();
    };
  }, [heading, quartier.buildings.length, quartier.lat, quartier.lon, quartier.streets.length, regard]);

  const stand = `${quartier.stand.x.toFixed(1)},${quartier.stand.z.toFixed(1)}`;
  return <div
    className="u-quartier"
    ref={host}
    data-quartier="1"
    data-sol={regard === "debout" ? "1" : "0"}
    data-cap={cap}
    data-batiments={quartier.buildings.length}
    data-rue={standsInStreet(quartier) ? "1" : "0"}
    data-stand={stand}
  />;
}
