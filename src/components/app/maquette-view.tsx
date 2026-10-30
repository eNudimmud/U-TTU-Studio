"use client";

import { useI18n } from "@/components/i18n/provider";
import { useEffect, useRef, useState } from "react";
import { MAX_PIXEL_RATIO, RADIUS_MIN, uprightRotation, type MaquetteState } from "@/lib/maquette/state";
import { PATH_SECONDS, decimation, orbitAt, type Prop } from "@/lib/maquette/scene";
import { sampleRelief, standsInStreet, type Quartier } from "@/lib/repere/quartier";
import { captureScene } from "@/lib/maquette/capture";
import type { CaptureFraming } from "@/lib/maquette/framing";
import { FramingFlat } from "./framing-flat";
import { watchShown } from "@/lib/dom/shown";
import { drawQuartier } from "./quartier-draw";

interface Props {
  state: MaquetteState;
  backdrop: string;
  placeName: string;
  badge: string;
  hint: string;
  quartier?: Quartier | null;
  force2D?: boolean;
  aspect?: "16:9" | "9:16";
  onWebGLFailed?(): void;
  onMode?(mode: "webgl" | "plat"): void;
  onCaptureReady?(capture: CaptureFraming | null): void;
  onFlat?(flat: NonNullable<MaquetteState["flat"]>): void;
  onMove(id: string, x: number, z: number): void;
  onOrbit(dx: number, dy: number): void;
  onPinch(previous: number, distance: number): void;
  onMoveProp?(id: string, x: number, z: number): void;
  /** performance.now() when the camera path started playing, or null. */
  playFrom?: number | null;
  /** Called on every played frame with the elapsed seconds; at the end with PATH_SECONDS. */
  onPlayTick?(seconds: number): void;
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

export function MaquetteView({ state, backdrop, placeName, badge, hint, quartier = null, onMove, onOrbit, onPinch, onMoveProp, playFrom = null, onPlayTick, force2D = false, aspect, onWebGLFailed, onMode, onCaptureReady, onFlat }: Props) {
  const { t } = useI18n();
  const [modelError, setModelError] = useState("");
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
  const movePropRef = useRef(onMoveProp);
  movePropRef.current = onMoveProp;
  const playRef = useRef<number | null>(playFrom);
  playRef.current = playFrom;
  const tickRef = useRef(onPlayTick);
  tickRef.current = onPlayTick;
  const [fallback, setFallback] = useState(false);
  const mode: Mode = force2D || fallback ? "plat" : "webgl";
  const modeRef = useRef(mode); modeRef.current = mode;
  const captureRef = useRef(onCaptureReady); captureRef.current = onCaptureReady;
  useEffect(() => { onMode?.(mode); }, [mode, onMode]);
  useEffect(() => { if (fallback) onWebGLFailed?.(); }, [fallback, onWebGLFailed]);

  useEffect(() => {
    const node = host.current;
    if (mode === "plat") return;
    if (!node || !canWebGL()) {
      setFallback(true);
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
      let capturing = false;
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
        shadow.userData.exportDecoration = true;
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

      const propGroups = new Map<string, THREE.Object3D>();
      const propKey = new Map<string, string>();
      const mobile = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      const propMaterial = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.8 });
      const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xd4af37, emissive: 0x6a5410, roughness: 0.5 });
      materials.push(propMaterial, lampMaterial);

      function primitive(kind: Prop["kind"]): THREE.Group {
        const group = new THREE.Group();
        const add = (geometry: THREE.BufferGeometry, x: number, y: number, z: number, material: THREE.Material = propMaterial) => {
          geometries.push(geometry);
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(x, y, z);
          group.add(mesh);
        };
        if (kind === "caisse") add(new THREE.BoxGeometry(0.8, 0.8, 0.8), 0, 0.4, 0);
        else if (kind === "mur") add(new THREE.BoxGeometry(6, 2.6, 0.25), 0, 1.3, 0);
        else if (kind === "voiture") { add(new THREE.BoxGeometry(4, 0.8, 1.8), 0, 0.6, 0); add(new THREE.BoxGeometry(2.2, 0.7, 1.6), -0.2, 1.35, 0); }
        else if (kind === "arbre") { add(new THREE.CylinderGeometry(0.14, 0.2, 1.8, 8), 0, 0.9, 0); add(new THREE.SphereGeometry(0.9, 12, 10), 0, 2.3, 0); }
        else if (kind === "lampadaire") { add(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 8), 0, 1.7, 0); add(new THREE.SphereGeometry(0.2, 10, 8), 0, 3.5, 0, lampMaterial); }
        else if (kind === "table") { add(new THREE.BoxGeometry(1.6, 0.08, 0.9), 0, 0.76, 0); add(new THREE.CylinderGeometry(0.08, 0.1, 0.72, 8), 0, 0.36, 0); }
        return group;
      }

      function loadGlb(prop: Prop, holder: THREE.Group) {
        if (!prop.url) return;
        void import("three/examples/jsm/loaders/GLTFLoader.js").then(async ({ GLTFLoader }) => {
          const gltf = await new GLTFLoader().loadAsync(prop.url!);
          if (dead) return;
          const { SimplifyModifier } = await import("three/examples/jsm/modifiers/SimplifyModifier.js");
          const simplify = new SimplifyModifier();
          let triangles = 0;
          gltf.scene.traverse(child => {
            if (!(child instanceof THREE.Mesh)) return;
            const geometry = child.geometry as THREE.BufferGeometry;
            const count = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
            const cut = decimation(count, geometry.attributes.position.count, mobile);
            if (cut > 0) {
              try { child.geometry = simplify.modify(geometry, cut); geometry.dispose(); } catch { /* keep the original */ }
            }
            geometries.push(child.geometry);
            const drawn = child.geometry as THREE.BufferGeometry;
            triangles += drawn.index ? drawn.index.count / 3 : drawn.attributes.position.count / 3;
          });
          // Stand it on the floor, about a person high, whatever its units.
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          const scale = 2.2 / Math.max(0.001, size.y, size.x * 0.6, size.z * 0.6);
          gltf.scene.scale.setScalar(scale);
          gltf.scene.position.set(-((box.min.x + box.max.x) / 2) * scale, -box.min.y * scale, -((box.min.z + box.max.z) / 2) * scale);
          holder.add(gltf.scene);
          holder.userData.triangles = Math.round(triangles);
          host.current?.parentElement?.parentElement?.setAttribute("data-triangles", String(Math.round(triangles)));
          paint();
        }).catch(() => { if (!dead) setModelError(prop.name); });
      }

      function syncProps() {
        const current = stateRef.current.props ?? [];
        const alive = new Set(current.map(item => item.id));
        for (const [id, group] of propGroups) {
          if (alive.has(id)) continue;
          scene.remove(group);
          propGroups.delete(id);
          propKey.delete(id);
        }
        for (const prop of current) {
          const key = `${prop.kind}|${prop.url ?? ""}`;
          let group = propGroups.get(prop.id);
          if (!group || propKey.get(prop.id) !== key) {
            if (group) scene.remove(group);
            const holder = prop.kind === "glb" ? new THREE.Group() : primitive(prop.kind);
            if (prop.kind === "glb") loadGlb(prop, holder);
            holder.name = prop.id;
            holder.userData.prop = true;
            group = holder;
            propGroups.set(prop.id, group);
            propKey.set(prop.id, key);
            scene.add(group);
          }
          group.traverse(child => { child.userData.root = group; });
          const spot = worldOf(prop.x, prop.z);
          group.position.set(spot.x, spot.y, spot.z);
          group.rotation.set(0, prop.yaw, 0);
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
        const started = playRef.current;
        const orbit = started === null ? stateRef.current.orbit : orbitAt(stateRef.current.path ?? [], (performance.now() - started) / 1000, stateRef.current.orbit);
        const place = quartierRef.current;
        const origin = worldOf(0, 0);
        // Respect the selected distance: automatic fitting used to cancel close shots.
        const radius = Math.max(orbit.radius, RADIUS_MIN);
        const targetY = origin.y + (radius < 4.5 ? 2 : 1.25);
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
        if (dead || capturing) return;
        const width = host.current?.clientWidth ?? 1;
        const height = host.current?.clientHeight ?? 1;
        renderer.setPixelRatio(Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio || 1));
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(1, height);
        camera.updateProjectionMatrix();
        syncBlock();
        syncFigures();
        syncProps();
        frameCamera();
        renderer.render(scene, camera);
      }

      captureRef.current?.(async (width, height) => {
        if (dead || capturing) throw new Error("Le cadrage est occupé.");
        paint();
        capturing = true;
        try { return await captureScene(THREE, renderer, scene, camera, width, height); }
        finally { capturing = false; paint(); }
      });

      const raycaster = new THREE.Raycaster();
      const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const pointers = new Map<number, { x: number; y: number }>();
      let dragId: string | null = null;
      let dragProp = false;
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
        const hit = raycaster.intersectObjects([...groups.values(), ...propGroups.values()], true)[0];
        const root = hit?.object.userData.root as THREE.Object3D | undefined;
        ground.constant = -(root?.position.y ?? 0);
        dragId = root && !stateRef.current.lockPose && playRef.current === null ? root.name : null;
        dragProp = Boolean(root?.userData.prop);
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
            if (dragProp) movePropRef.current?.(dragId, (point.x - ox) / scale, (point.z - oz) / scale);
            else moveRef.current(dragId, (point.x - ox) / scale, (point.z - oz) / scale);
          }
          paint();
          return;
        }
        if (last && !stateRef.current.lockCam && playRef.current === null) {
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
      function onLost() { captureRef.current?.(null); setFallback(true); }

      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("webglcontextlost", onLost);
      const observer = new ResizeObserver(() => paint());
      observer.observe(host.current);
      paint();
      // The 200 ms catch-up repaint sleeps while the maquette is off screen (closed group, hidden tab).
      const view = watchShown(host.current, paint);
      const watch = window.setInterval(() => { if (playRef.current === null && view.shown()) paint(); }, 200);
      let frame = 0;
      const loop = () => {
        frame = requestAnimationFrame(loop);
        const started = playRef.current;
        if (started === null) return;
        const seconds = (performance.now() - started) / 1000;
        paint();
        tickRef.current?.(Math.min(PATH_SECONDS, seconds));
      };
      frame = requestAnimationFrame(loop);

      stop = () => {
        // The 2D child may already have registered its exporter when the old
        // WebGL effect releases resources. It owns the callback in that mode.
        if (modeRef.current === "webgl") captureRef.current?.(null);
        dropBlock();
        window.clearInterval(watch);
        view.stop();
        cancelAnimationFrame(frame);
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
    }).catch(() => { if (!dead) setFallback(true); });

    return () => {
      dead = true;
      stop();
    };
  }, [mode]);

  const props = (state.props ?? []).map(prop => `${prop.id}@${prop.x.toFixed(2)},${prop.z.toFixed(2)}`).join(" ");
  const layout = state.figures.map(figure => `${figure.id}@${figure.x.toFixed(2)},${figure.z.toFixed(2)}`).join(" ");
  const rue = quartier && standsInStreet(quartier) ? "1" : "0";
  return <div className="u-maquette" data-maquette={mode} data-flat-zoom={state.flat?.zoom ?? 1} data-tuile={state.tuile} data-figures={state.figures.length} data-layout={layout} data-props={props} data-keys={state.path?.length ?? 0} data-playing={playFrom !== null ? "1" : undefined} data-quartier={quartier ? "1" : "0"} data-batiments={quartier?.buildings.length ?? 0} data-rue={rue}>
    {modelError && <p role="alert" className="u-small">{t("previs.modelFailed", { name: modelError })}</p>}
    <div
      className="u-maquette-stage"
      style={{ ...(backdrop ? { backgroundImage: `linear-gradient(180deg, rgba(11,10,9,.25), rgba(11,10,9,.72)), url(${backdrop})` } : {}), ...(aspect ? { aspectRatio: aspect.replace(":", "/"), height: "auto" } : {}) }}
    >
      <div className="u-maquette-gl" ref={host} />
      {mode === "plat" && <FramingFlat state={state} backdrop={backdrop} onMove={onMove} onFlat={flat => onFlat?.(flat)} onCaptureReady={onCaptureReady} />}
      <p className="u-maquette-badge">{badge}</p>
      <p className="u-maquette-names">{state.figures.map((figure, index) => <span key={figure.id} style={{ color: figure.color }}>{index > 0 ? " · " : ""}{figure.name}</span>)}</p>
      {placeName && <p className="u-maquette-place">{placeName}</p>}
      <p className="u-maquette-hint">{hint}</p>
    </div>
  </div>;
}

