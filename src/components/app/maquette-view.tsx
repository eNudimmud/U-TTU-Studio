"use client";

import { useI18n } from "@/components/i18n/provider";
import { useEffect, useRef, useState } from "react";
import { MAX_PIXEL_RATIO, RADIUS_MIN, uprightRotation, type MaquetteState } from "@/lib/maquette/state";
import { PATH_SECONDS, decimation, orbitAt, type Prop } from "@/lib/maquette/scene";
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
  onMoveProp?(id: string, x: number, z: number): void;
  /** performance.now() when the camera path started playing, or null. */
  playFrom?: number | null;
  /** Called on every played frame with the elapsed seconds; at the end with PATH_SECONDS. */
  onPlayTick?(seconds: number): void;
  /** « Lire le trajet »: plays the camera path once. */
  onPlay?(): void;
  /** What the last sentence did, shown over the stage instead of the hint. */
  caption?: string;
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

export function MaquetteView({ state, backdrop, placeName, badge, hint, quartier = null, onMove, onOrbit, onPinch, onMoveProp, playFrom = null, onPlayTick, onPlay, caption = "" }: Props) {
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
  const [mode, setMode] = useState<Mode>("webgl");
  const paintRef = useRef<() => void>(() => {});
  const photoRef = useRef<HTMLImageElement>(null);
  const backdropRef = useRef(backdrop);
  backdropRef.current = backdrop;
  // Repaint as soon as the scene changes (a composed sentence must show at once).
  useEffect(() => { paintRef.current(); }, [state, backdrop, quartier]);

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
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const canvas = renderer.domElement;
      canvas.className = "u-maquette-canvas";
      host.current.replaceChildren(canvas);
      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x1a1610, 12, 28);
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      scene.add(new THREE.HemisphereLight(0xfff1d0, 0x201810, 1.1));
      const sun = new THREE.DirectionalLight(0xffe0a0, 1.2);
      sun.position.set(4, 8, 5);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -8;
      sun.shadow.camera.right = 8;
      sun.shadow.camera.top = 8;
      sun.shadow.camera.bottom = -8;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 30;
      sun.shadow.radius = 4;
      scene.add(sun);
      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(12, 48),
        new THREE.MeshStandardMaterial({ color: 0x2a2418, roughness: 0.9 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.name = "floor";
      floor.receiveShadow = true;
      scene.add(floor);
      // Over a décor photo the floor is invisible: it only catches the shadows, so the figures stand on the photo's ground.
      const catcherMaterial = new THREE.ShadowMaterial({ opacity: 0.5 });
      const catcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), catcherMaterial);
      catcher.rotation.x = -Math.PI / 2;
      catcher.position.y = 0.002;
      catcher.receiveShadow = true;
      scene.add(catcher);
      const grid = new THREE.GridHelper(16, 16, 0x5a4a2a, 0x3a3122);
      const gridMaterial = grid.material as THREE.LineBasicMaterial;
      gridMaterial.transparent = true;
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
        const photo = !place && Boolean(backdropRef.current);
        floor.visible = !place && !photo;
        catcher.visible = !place;
        grid.visible = !place;
        gridMaterial.opacity = photo ? 0.18 : 1;
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
          mesh.castShadow = true;
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
        left.castShadow = true;
        right.castShadow = true;
        group.add(left, right);
        // Facing cue: a dark visor where the eyes are, and an arrow on the ground in front.
        const visorMaterial = new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 0.3, metalness: 0.2 });
        materials.push(visorMaterial);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.06), visorMaterial);
        geometries.push(visor.geometry);
        visor.position.set(0, 2.0, 0.19);
        group.add(visor);
        const arrowShape = new THREE.Shape();
        arrowShape.moveTo(0, 0.95);
        arrowShape.lineTo(0.22, 0.55);
        arrowShape.lineTo(-0.22, 0.55);
        arrowShape.closePath();
        const arrowMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
        materials.push(arrowMaterial);
        const arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), arrowMaterial);
        geometries.push(arrow.geometry);
        arrow.rotation.x = Math.PI / 2; // shape +y becomes +z: in front of the figure
        arrow.position.y = 0.015;
        arrow.userData.tint = true;
        group.add(arrow);
        const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
        materials.push(ringMaterial);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.44, 32), ringMaterial);
        geometries.push(ring.geometry);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.012;
        ring.userData.tint = true;
        group.add(ring);
        add(new THREE.CapsuleGeometry(0.09, 0.78, 3, 6), 0.48, -0.1);
        add(new THREE.CapsuleGeometry(0.09, 0.78, 3, 6), 0.48, 0.1);
        const shadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.34, 24),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }),
        );
        geometries.push(shadow.geometry);
        materials.push(shadow.material);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.02;
        group.add(shadow);
        // About 1.75 m from the ground to the top of the head, like a person on the quay.
        group.scale.setScalar(0.81);
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
          for (const child of group.children) {
            if (child.userData.tint && child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) child.material.color.set(figure.color);
          }
          const spot = worldOf(figure.x, figure.z);
          group.position.set(spot.x, spot.y, spot.z);
          // « Regard caméra »: everyone turns to the lens, on every frame of the path.
          const facing = stateRef.current.tuile === "regard"
            ? Math.atan2(camera.position.x - spot.x, camera.position.z - spot.z)
            : figure.yaw;
          const stand = uprightRotation(facing);
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
        sprite.position.set(0, 2.5, 0);
        sprite.scale.set(1.3, 0.33, 1);
        sprite.userData.kind = "name";
        sprite.userData.label = name;
        sprite.userData.tint = color;
        return sprite;
      }

      let turned = 0;
      function frameCamera() {
        const started = playRef.current;
        const orbit = started === null ? stateRef.current.orbit : orbitAt(stateRef.current.path ?? [], (performance.now() - started) / 1000, stateRef.current.orbit);
        turned = Math.abs(orbit.theta - ((stateRef.current.path ?? [])[0]?.orbit.theta ?? stateRef.current.orbit.theta));
        const place = quartierRef.current;
        const origin = worldOf(0, 0);
        const span = stateRef.current.figures.reduce((max, figure) => Math.max(max, Math.abs(figure.x), Math.abs(figure.z)), 0);
        const aspect = Math.max(0.75, camera.aspect || 1);
        const needed = (span + 1.2) / (Math.tan((20 * Math.PI) / 180) * aspect);
        // Close tiles stay above the distance that keeps head, name and feet inside the stage.
        const guided = playRef.current !== null || (stateRef.current.path?.length ?? 0) > 0;
        const radius = guided ? Math.max(orbit.radius, RADIUS_MIN) : Math.max(orbit.radius, 6.6, needed);
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
        frameCamera();
        syncFigures();
        syncProps();
        alignPhoto(width, height);
        renderer.render(scene, camera);
      }
      paintRef.current = () => paint();

      // The décor photo slides so its horizon (assumed at half height, an eye-level shot)
      // sits on the 3D horizon. A steep plongée leaves the photo and fades it.
      function alignPhoto(width: number, height: number) {
        const stage = host.current?.closest(".u-maquette-stage");
        const photo = photoRef.current;
        const pitchDown = Math.atan2(camera.position.y - (worldOf(0, 0).y + 1.25), Math.hypot(camera.position.x - worldOf(0, 0).x, camera.position.z - worldOf(0, 0).z));
        const ndc = Math.tan(pitchDown) / Math.tan((camera.fov * Math.PI) / 360);
        const horizon = 0.5 - ndc / 2;
        stage?.setAttribute("data-horizon", String(Math.round(horizon * 100)));
        if (!photo || !photo.naturalWidth || quartierRef.current) return;
        const scale = Math.max(width / photo.naturalWidth, height / photo.naturalHeight) * 1.3;
        const w = photo.naturalWidth * scale;
        const h = photo.naturalHeight * scale;
        const top = Math.min(0, Math.max(height - h, horizon * height - h / 2));
        photo.style.width = `${w}px`;
        photo.style.height = `${h}px`;
        photo.style.left = `${(width - w) / 2}px`;
        photo.style.top = `${top}px`;
        const off = Math.abs(horizon * height - (top + h / 2)) / height;
        // A photo is one point of view: once the camera turns away from it, it fades and the floor grid takes over.
        const away = turned > 0.35;
        photo.style.opacity = away || horizon < -0.1 || horizon > 1.1 ? "0.25" : off > 0.08 ? "0.6" : "1";
        gridMaterial.opacity = away ? 0.6 : 0.18;
        stage?.setAttribute("data-photo-match", off <= 0.08 && !away ? "1" : "0");
      }

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
      const watch = window.setInterval(() => { if (playRef.current === null) paint(); }, 200);
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
        dropBlock();
        window.clearInterval(watch);
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
    }).catch(() => { if (!dead) setMode("plat"); });

    return () => {
      dead = true;
      stop();
    };
  }, [mode]);

  const props = (state.props ?? []).map(prop => `${prop.id}@${prop.x.toFixed(2)},${prop.z.toFixed(2)}`).join(" ");
  const layout = state.figures.map(figure => `${figure.id}@${figure.x.toFixed(2)},${figure.z.toFixed(2)}`).join(" ");
  const rue = quartier && standsInStreet(quartier) ? "1" : "0";
  return <div className="u-maquette" data-maquette={mode} data-tuile={state.tuile} data-figures={state.figures.length} data-layout={layout} data-props={props} data-keys={state.path?.length ?? 0} data-playing={playFrom !== null ? "1" : undefined} data-quartier={quartier ? "1" : "0"} data-batiments={quartier?.buildings.length ?? 0} data-rue={rue}>
    {modelError && <p role="alert" className="u-small">{t("previs.modelFailed", { name: modelError })}</p>}
    <div className="u-maquette-stage" data-photo={backdrop ? "1" : "0"}>
      <div className="u-maquette-view">
      {backdrop && <img ref={photoRef} className="u-maquette-photo" src={backdrop} alt="" onLoad={() => paintRef.current()} />}
      <div className="u-maquette-gl" ref={host} />
      {mode === "plat" && <Plat state={state} onMove={onMove} onOrbit={onOrbit} onPinch={onPinch} />}
      <p className="u-maquette-badge">{badge}</p>
      <p className="u-maquette-names">{state.figures.map((figure, index) => <span key={figure.id} style={{ color: figure.color }}>{index > 0 ? " · " : ""}{figure.name}</span>)}</p>
      {placeName && <p className="u-maquette-place">{placeName}</p>}
      <MiniPlan state={state} playFrom={playFrom} />
      </div>
      {/* The bar sits under the picture: nothing covers the feet or the frame. */}
      <div className="u-maquette-bar">
        {caption ? <p className="u-maquette-hint u-maquette-caption" role="status" data-maquette-caption="">{caption}</p> : <p className="u-maquette-hint" id="u-why-trajet">{hint}</p>}
        {onPlay && <button type="button" className="u-maquette-play" data-lire-trajet="" disabled={(state.path?.length ?? 0) < 2 || playFrom !== null} aria-describedby={(state.path?.length ?? 0) < 2 && !caption ? "u-why-trajet" : undefined} onClick={onPlay}>{playFrom !== null ? t("previs.playing") : t("previs.play")}</button>}
      </div>
    </div>
  </div>;
}

/**
 * Top view, as a previs artist draws it: figures as coloured dots with their
 * facing, the camera path as a gold line with its keyframes, the camera now.
 */
function MiniPlan({ state, playFrom }: { state: MaquetteState; playFrom: number | null }) {
  const { t } = useI18n();
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (playFrom === null) { setNow(0); return; }
    let frame = 0;
    const loop = () => { setNow(Math.min(PATH_SECONDS, (performance.now() - playFrom) / 1000)); frame = requestAnimationFrame(loop); };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playFrom]);
  const path = state.path ?? [];
  const where = (orbit: { theta: number; phi: number; radius: number }) => ({ x: orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta), z: orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta) });
  const samples = path.length > 1 ? Array.from({ length: 33 }, (_, index) => where(orbitAt(path, (PATH_SECONDS * index) / 32, state.orbit))) : [];
  const cam = where(playFrom !== null && path.length > 1 ? orbitAt(path, now, state.orbit) : path.length > 0 ? path[0].orbit : state.orbit);
  const extent = Math.max(4, ...samples.map(p => Math.max(Math.abs(p.x), Math.abs(p.z))), Math.abs(cam.x), Math.abs(cam.z), ...state.figures.map(f => Math.max(Math.abs(f.x), Math.abs(f.z)))) + 1;
  const angle = Math.atan2(-cam.x, -cam.z);
  const fov = 0.35;
  const reach = Math.hypot(cam.x, cam.z) * 0.9;
  const ray = (a: number) => `${cam.x + Math.sin(a) * reach},${cam.z + Math.cos(a) * reach}`;
  return <svg className="u-miniplan" viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`} role="img" aria-label={t("previs.plan")} data-miniplan={path.length} data-cam={`${cam.x.toFixed(1)},${cam.z.toFixed(1)}`}>
    <rect x={-extent} y={-extent} width={extent * 2} height={extent * 2} fill="rgba(11,10,9,.82)" />
    <polygon points={`${cam.x},${cam.z} ${ray(angle - fov)} ${ray(angle + fov)}`} fill="rgba(201,164,106,.18)" />
    {samples.length > 1 && <polyline points={samples.map(p => `${p.x},${p.z}`).join(" ")} fill="none" stroke="#c9a46a" strokeWidth={extent / 16} strokeDasharray={`${extent / 9} ${extent / 18}`} />}
    {path.map(key => { const p = where(key.orbit); return <circle key={key.t} cx={p.x} cy={p.z} r={extent / 11} fill="#c9a46a" stroke="#000" strokeWidth={extent / 40} />; })}
    {state.figures.map(figure => {
      const facing = state.tuile === "regard" ? Math.atan2(cam.x - figure.x, cam.z - figure.z) : figure.yaw;
      return <g key={figure.id}>
        <line x1={figure.x} y1={figure.z} x2={figure.x + Math.sin(facing) * extent / 4} y2={figure.z + Math.cos(facing) * extent / 4} stroke={figure.color} strokeWidth={extent / 18} />
        <circle cx={figure.x} cy={figure.z} r={extent / 8} fill={figure.color} stroke="#000" strokeWidth={extent / 40} />
      </g>;
    })}
    <circle cx={cam.x} cy={cam.z} r={extent / 9} fill="#f3e3a1" stroke="#000" strokeWidth={extent / 40} />
  </svg>;
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

