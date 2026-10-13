"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_PIXEL_RATIO, uprightRotation, type MaquetteState } from "@/lib/maquette/state";
import { sampleRelief, standsInStreet, type Quartier } from "@/lib/repere/quartier";
import { drawQuartier } from "./quartier-draw";

interface Props {
  state: MaquetteState;
  backdrop: string;
  placeName: string;
  badge: string;
  hint: string;
  quartier?: Quartier | null;
  onMove(id: string, x: number, z: number): void;
  onOrbit(dx: number, dy: number): void;
  onPinch(previous: number, distance: number): void;
}

type Mode = "webgl" | "plat";

function canWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export function MaquetteView({ state, backdrop, placeName, badge, hint, quartier = null, onMove, onOrbit, onPinch }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const moveRef = useRef(onMove);
  const orbitRef = useRef(onOrbit);
  const pinchRef = useRef(onPinch);
  const quartierRef = useRef<Quartier | null>(quartier);
  stateRef.current = state;
  moveRef.current = onMove;
  orbitRef.current = onOrbit;
  pinchRef.current = onPinch;
  quartierRef.current = quartier;
  const [mode, setMode] = useState<Mode>("webgl");

  useEffect(() => {
    const node = host.current;
    if (mode === "plat") return;
    if (!node || !canWebGL()) {
      setMode("plat");
      return;
    }
    let dead = false;
    let stop = () => {};
    void import("three").then(THREE => {
      if (dead || !host.current) return;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1));
      renderer.setClearColor(0x000000, 0);
      const canvas = renderer.domElement;
      canvas.className = "u-maquette-canvas";
      host.current.replaceChildren(canvas);
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x1a1610, 12, 28);
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      scene.add(new THREE.HemisphereLight(0xfff1d0, 0x201810, 1.1));
      const sun = new THREE.DirectionalLight(0xffe0a0, 1.2);
      sun.position.set(4, 8, 5);
      scene.add(sun);
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(12, 48),
        new THREE.MeshStandardMaterial({ color: 0x2a2418, roughness: 0.9 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.name = "floor";
      scene.add(floor);
      const grid = new THREE.GridHelper(16, 16, 0x5a4a2a, 0x3a3122);
      scene.add(grid);
      let blockKey = "";
      let dropBlock = () => {};
      let standMesh: { position: { set(x: number, y: number, z: number): void } } | null = null;

      function worldOf(x: number, z: number) {
        const place = quartierRef.current;
        if (!place) return { x, y: 0, z };
        const wx = place.stand.x + x * 1.6;
        const wz = place.stand.z + z * 1.6;
        return { x: wx, y: sampleRelief(place.relief, wx, wz), z: wz };
      }

      function syncBlock() {
        const place = quartierRef.current;
        const key = place ? `${place.lat.toFixed(5)}|${place.lon.toFixed(5)}|${place.buildings.length}|${place.streets.length}|${place.relief?.n ?? 0}` : "";
        floor.visible = !place;
        grid.visible = !place;
        if (key !== blockKey) {
          blockKey = key;
          dropBlock();
          dropBlock = () => {};
          standMesh = null;
          scene.fog = new THREE.Fog(place ? 0x14110c : 0x1a1610, place ? 22 : 12, place ? 80 : 28);
          scene.background = place ? new THREE.Color(0x14110c) : null;
          if (place) {
            const drawn = drawQuartier(THREE, place);
            scene.add(drawn.group);
            standMesh = drawn.stand;
            dropBlock = () => drawn.dispose();
          }
        }
        if (standMesh && place) {
          standMesh.position.set(place.stand.x, sampleRelief(place.relief, place.stand.x, place.stand.z) + 0.2, place.stand.z);
        }
      }
      const groups = new Map<string, THREE.Group>();
      const geometries: THREE.BufferGeometry[] = [];
      const materials: THREE.Material[] = [];

      function dummy(color: string): THREE.Group {
        const group = new THREE.Group();
        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
        materials.push(material);
        const add = (geometry: THREE.BufferGeometry, y: number, x = 0) => {
          geometries.push(geometry);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(x, y, 0);
          mesh.userData.root = group;
          group.add(mesh);
        };
        add(new THREE.CapsuleGeometry(0.22, 0.78, 4, 10), 1.28);
        add(new THREE.SphereGeometry(0.2, 16, 12), 1.96);
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.14), material);
        geometries.push(nose.geometry);
        nose.position.set(0, 1.96, 0.22);
        group.add(nose);
        const left = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.62, 3, 6), material);
        const right = left.clone();
        geometries.push(left.geometry);
        left.position.set(0.24, 1.24, 0);
        right.position.set(-0.24, 1.24, 0);
        left.userData.arm = true;
        right.userData.arm = true;
        group.add(left, right);
        add(new THREE.CapsuleGeometry(0.09, 0.78, 3, 6), 0.48, -0.1);
        add(new THREE.CapsuleGeometry(0.09, 0.78, 3, 6), 0.48, 0.1);
        const shadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.42, 20),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
        );
        geometries.push(shadow.geometry);
        materials.push(shadow.material);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.02;
        group.add(shadow);
        group.scale.setScalar(1.2);
        group.traverse(child => { child.userData.root = group; });
        return group;
      }

      function syncFigures() {
        const current = stateRef.current.figures;
        const alive = new Set(current.map(item => item.id));
        for (const [id, group] of groups) {
          if (alive.has(id)) continue;
          scene.remove(group);
          groups.delete(id);
        }
        for (const figure of current) {
          let group = groups.get(figure.id);
          if (!group) {
            group = dummy(figure.color);
            group.name = figure.id;
            groups.set(figure.id, group);
            scene.add(group);
          }
          const mesh = group.children[0];
          if (mesh instanceof THREE.Mesh) {
            const material = mesh.material;
            if (!Array.isArray(material) && material instanceof THREE.MeshStandardMaterial) material.color.set(figure.color);
          }
          const spot = worldOf(figure.x, figure.z);
          group.position.set(spot.x, spot.y, spot.z);
          const stand = uprightRotation(figure.yaw);
          group.rotation.set(stand.x, stand.y, stand.z);
          group.traverse(child => {
            if (child.userData.arm) child.rotation.z = figure.pose * (child.position.x < 0 ? 1 : -1);
          });
          const label = group.children.find(child => child.userData.kind === "name");
          if (!label || label.userData.label !== figure.name || label.userData.tint !== figure.color) {
            if (label) group.remove(label);
            const sprite = nameSprite(figure.name, figure.color);
            if (sprite) {
              sprite.userData.root = group;
              group.add(sprite);
            }
          }
        }
      }

      function nameSprite(name: string, color: string) {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.clearRect(0, 0, 512, 128);
        ctx.font = "600 54px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 10;
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.strokeText(name, 256, 64);
        ctx.fillStyle = color;
        ctx.fillText(name, 256, 64);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        materials.push(material);
        const sprite = new THREE.Sprite(material);
        sprite.position.set(0, 2.42, 0);
        sprite.scale.set(1.15, 0.29, 1);
        sprite.userData.kind = "name";
        sprite.userData.label = name;
        sprite.userData.tint = color;
        return sprite;
      }

      function frameCamera() {
        const orbit = stateRef.current.orbit;
        const place = quartierRef.current;
        const origin = worldOf(0, 0);
        const span = stateRef.current.figures.reduce((max, figure) => Math.max(max, Math.abs(figure.x), Math.abs(figure.z)), 0);
        const aspect = Math.max(0.75, camera.aspect || 1);
        const needed = (span + 1.2) / (Math.tan((20 * Math.PI) / 180) * aspect);
        // Close tiles stay above the distance that keeps head, name and feet inside the stage.
        const radius = Math.max(orbit.radius, 6.6, needed);
        const targetY = origin.y + 1.25;
        camera.far = place ? 250 : 100;
        camera.updateProjectionMatrix();
        camera.position.set(
          origin.x + radius * Math.sin(orbit.phi) * Math.sin(orbit.theta),
          targetY + radius * Math.cos(orbit.phi),
          origin.z + radius * Math.sin(orbit.phi) * Math.cos(orbit.theta),
        );
        camera.lookAt(origin.x, targetY, origin.z);
      }

      function paint() {
        if (dead) return;
        const width = host.current?.clientWidth ?? 1;
        const height = host.current?.clientHeight ?? 1;
        renderer.setPixelRatio(Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1));
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
        syncBlock();
        syncFigures();
        frameCamera();
        renderer.render(scene, camera);
      }

      const raycaster = new THREE.Raycaster();
      const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const pointers = new Map<number, { x: number; y: number }>();
      let dragId: string | null = null;
      let last: { x: number; y: number } | null = null;
      let pinchDistance = 0;

      function ndc(event: PointerEvent) {
        const rect = canvas.getBoundingClientRect();
        return new THREE.Vector2(
          ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
          -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
        );
      }

      function onDown(event: PointerEvent) {
        canvas.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinchDistance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
          dragId = null;
          return;
        }
        raycaster.setFromCamera(ndc(event), camera);
        const hit = raycaster.intersectObjects([...groups.values()], true)[0];
        const root = hit?.object.userData.root as THREE.Group | undefined;
        dragId = root && !stateRef.current.lockPose ? root.name : null;
        last = { x: event.clientX, y: event.clientY };
      }
      function onMove(event: PointerEvent) {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size >= 2) {
          const [a, b] = [...pointers.values()];
          const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
          pinchRef.current(pinchDistance, distance);
          pinchDistance = distance;
          paint();
          return;
        }
        if (dragId) {
          raycaster.setFromCamera(ndc(event), camera);
          const point = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(ground, point)) {
            const place = quartierRef.current;
            const ox = place?.stand.x ?? 0;
            const oz = place?.stand.z ?? 0;
            const scale = place ? 1.6 : 1;
            moveRef.current(dragId, (point.x - ox) / scale, (point.z - oz) / scale);
          }
          paint();
          return;
        }
        if (last && !stateRef.current.lockCam) {
          orbitRef.current(event.clientX - last.x, event.clientY - last.y);
          paint();
        }
        last = { x: event.clientX, y: event.clientY };
      }
      function onUp(event: PointerEvent) {
        pointers.delete(event.pointerId);
        if (pointers.size < 2) pinchDistance = 0;
        dragId = null;
        last = null;
      }
      function onWheel(event: WheelEvent) {
        event.preventDefault();
        const distance = event.deltaY < 0 ? 120 : 80;
        pinchRef.current(100, distance);
        paint();
      }
      function onLost() { setMode("plat"); }

      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("webglcontextlost", onLost);
      const observer = new ResizeObserver(() => paint());
      observer.observe(host.current);
      paint();
      const watch = window.setInterval(paint, 200);

      stop = () => {
        dropBlock();
        window.clearInterval(watch);
        observer.disconnect();
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("webglcontextlost", onLost);
        for (const geometry of geometries) geometry.dispose();
        for (const material of materials) material.dispose();
        renderer.dispose();
        canvas.remove();
      };
    }).catch(() => { if (!dead) setMode("plat"); });

    return () => {
      dead = true;
      stop();
    };
  }, [mode]);

  const layout = state.figures.map(figure => `${figure.id}@${figure.x.toFixed(2)},${figure.z.toFixed(2)}`).join(" ");
  const rue = quartier && standsInStreet(quartier) ? "1" : "0";
  return <div className="u-maquette" data-maquette={mode} data-tuile={state.tuile} data-figures={state.figures.length} data-layout={layout} data-quartier={quartier ? "1" : "0"} data-batiments={quartier?.buildings.length ?? 0} data-rue={rue}>
    <div
      className="u-maquette-stage"
      style={backdrop ? { backgroundImage: `linear-gradient(180deg, rgba(11,10,9,.25), rgba(11,10,9,.72)), url(${backdrop})` } : undefined}
    >
      <div className="u-maquette-gl" ref={host} />
      {mode === "plat" && <Plat state={state} onMove={onMove} onOrbit={onOrbit} onPinch={onPinch} />}
      <p className="u-maquette-badge">{badge}</p>
      <p className="u-maquette-names">{state.figures.map((figure, index) => <span key={figure.id} style={{ color: figure.color }}>{index > 0 ? " · " : ""}{figure.name}</span>)}</p>
      {placeName && <p className="u-maquette-place">{placeName}</p>}
      <p className="u-maquette-hint">{hint}</p>
    </div>
  </div>;
}

function Plat({ state, onMove, onOrbit, onPinch }: { state: MaquetteState; onMove: Props["onMove"]; onOrbit: Props["onOrbit"]; onPinch: Props["onPinch"] }) {
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const drag = useRef<string | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const pinchDistance = useRef(0);
  const origin = useRef<{ x: number; z: number } | null>(null);

  function down(event: React.PointerEvent, id: string | null) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDistance.current = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      drag.current = null;
      return;
    }
    drag.current = id;
    last.current = { x: event.clientX, y: event.clientY };
    const figure = id ? state.figures.find(item => item.id === id) : null;
    origin.current = figure ? { x: figure.x, z: figure.z } : null;
  }
  function move(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      onPinch(pinchDistance.current, distance);
      pinchDistance.current = distance;
      return;
    }
    if (!last.current) return;
    const dx = event.clientX - last.current.x;
    const dy = event.clientY - last.current.y;
    if (drag.current && origin.current && !state.lockPose) onMove(drag.current, origin.current.x + dx / 36, origin.current.z + dy / 36);
    else if (!state.lockCam) onOrbit(dx, dy);
    last.current = { x: event.clientX, y: event.clientY };
  }
  function up(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    drag.current = null;
    last.current = null;
    origin.current = null;
  }

  return <div className="u-plat" onPointerDown={event => down(event, null)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
    {state.figures.map(figure => <button
      key={figure.id}
      type="button"
      className="u-figure"
      style={{ left: `${50 + figure.x * 8}%`, top: `${46 + figure.z * 6}%`, background: figure.color, transform: `translate(-50%, -100%) rotate(${figure.yaw}rad)` }}
      onPointerDown={event => { event.stopPropagation(); down(event, figure.id); }}
    >{figure.name}</button>)}
  </div>;
}

