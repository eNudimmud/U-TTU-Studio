// The 3D repérage engine. three.js only, loaded on demand.
// OSM buildings (OpenFreeMap vector tiles) and Terrain Tiles relief, drawn in four looks
// with a small post-process: depth and normal edges, hard shadows, screentone.
// No Google data. See docs/reperage-3d.md.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { assetPath } from "@/lib/site";
import { classifyTwo, readTwo, tiltFor, type Finger, type TwoMode, type TwoReading } from "@/lib/repere3d/gesture";
import { gltfToLocal, heightOffset, keepSwiss, osmMassingColor, soberColor, splitB3dm, swissContents, swissRadius, swissTileCap, type SwissBuilding } from "@/lib/repere3d/swiss-buildings";
import { plafondBatiments, rayonFor, streetStand, type Quartier } from "@/lib/repere/quartier";
import { BUILDING_Z, DEM_Z, SWISS_Z, LocalFrame, headingOf, inSwitzerland, tileOrigin, tileSize, tilesAround, type TileId } from "@/lib/repere3d/geo";
import { OPENFREEMAP_TILEJSON, decodeTile, parseTileJson, tileUrl, type Area, type Building, type Road, type TileShapes } from "@/lib/repere3d/osm-tiles";
import { decodeTerrarium, makeSampler, terrariumUrl, type HeightTile } from "@/lib/repere3d/terrain";
import { sunVector, type Sun } from "@/lib/repere3d/sun";
import { CAPTURE_H, CAPTURE_W } from "@/lib/repere3d/capture";
import { FRAMING_POSES, type Framing, type Look } from "@/lib/repere3d/styles";
import type { SourceId } from "@/lib/repere3d/sources";
import { demiChamp, lireContexte, type Contexte } from "@/lib/repere3d/contexte";

export type LoadState = "idle" | "loading" | "ready" | "empty" | "offline" | "rate" | "fail";

export interface ViewInfo {
  lat: number;
  lon: number;
  heading: number;
  pitch: number;
  height: number;
  street: boolean;
}

export type RoofState = "off" | "loading" | "ready" | "fail";

export interface EngineEvents {
  onView?(view: ViewInfo): void;
  /** Real Swiss buildings (swissBUILDINGS3D): state and how many replaced the OSM volumes. */
  onRoofs?(state: RoofState, count: number): void;
}

export interface CaptureResult {
  color: Blob;
  depth: Blob;
  lines: Blob;
  view: ViewInfo;
  fov: number;
  near: number;
  far: number;
  sources: SourceId[];
}

export interface LoadResult {
  state: LoadState;
  buildings: number;
  sources: SourceId[];
}

const SWISSIMAGE = "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg";
const EYE = 1.7;
const FRAME_ASPECT = CAPTURE_W / CAPTURE_H;

let tileTemplate: Promise<string | null> | null = null;
const swissJson = new Map<string, Promise<unknown>>();
const swissBytes = new Map<string, ArrayBuffer>();
let gltfLoader: GLTFLoader | null = null;

function swissLoader(): GLTFLoader {
  if (!gltfLoader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath(assetPath("/draco/"));
    draco.setWorkerLimit(2);
    gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(draco);
  }
  return gltfLoader;
}

function getSwissJson(url: string, signal: AbortSignal): Promise<unknown> {
  let hit = swissJson.get(url);
  if (!hit) {
    hit = fetch(url, { credentials: "omit", signal }).then(response => {
      if (!response.ok) throw new HttpError(response.status);
      return response.json();
    });
    hit.catch(() => swissJson.delete(url));
    swissJson.set(url, hit);
  }
  return hit;
}
const shapeCache = new Map<string, TileShapes>();
const demCache = new Map<string, HeightTile>();

class HttpError extends Error {
  constructor(readonly status: number) { super(`http ${status}`); }
}

async function getBytes(url: string, signal: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(url, { credentials: "omit", signal });
  if (!response.ok) throw new HttpError(response.status);
  return new Uint8Array(await response.arrayBuffer());
}

async function getImage(url: string, signal: AbortSignal): Promise<ImageBitmap> {
  const response = await fetch(url, { credentials: "omit", signal });
  if (!response.ok) throw new HttpError(response.status);
  return createImageBitmap(await response.blob());
}

function template(signal: AbortSignal): Promise<string | null> {
  if (!tileTemplate) {
    tileTemplate = fetch(OPENFREEMAP_TILEJSON, { credentials: "omit", signal })
      .then(response => {
        if (!response.ok) throw new HttpError(response.status);
        return response.json();
      })
      .then(parseTileJson)
      .catch(error => {
        tileTemplate = null;
        throw error;
      });
  }
  return tileTemplate;
}

const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 res;
uniform float near;
uniform float far;
uniform float line;
uniform float tone;
uniform float depthFar;
uniform float depthNear;
uniform float pixel;
uniform int mode;
uniform vec3 sky;
varying vec2 vUv;

float lin(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * near * far / (far + near - z * (far - near));
}

float edgeAt(vec2 uv, float w) {
  vec2 px = w / res;
  float dc = texture2D(tDepth, uv).x;
  float lc = lin(dc);
  vec3 nc = texture2D(tNormal, uv).xyz * 2.0 - 1.0;
  float e = 0.0;
  vec2 offs[4];
  offs[0] = vec2(px.x, 0.0);
  offs[1] = vec2(-px.x, 0.0);
  offs[2] = vec2(0.0, px.y);
  offs[3] = vec2(0.0, -px.y);
  for (int i = 0; i < 4; i++) {
    vec2 q = uv + offs[i];
    float dn = texture2D(tDepth, q).x;
    float ln = lin(dn);
    float rel = abs(ln - lc) / max(min(ln, lc), 0.001);
    if ((dn >= 0.99999) != (dc >= 0.99999)) e = 1.0;
    e = max(e, smoothstep(0.035, 0.08, rel));
    vec3 nn = texture2D(tNormal, q).xyz * 2.0 - 1.0;
    if (dc < 0.99999 && dn < 0.99999) e = max(e, smoothstep(0.82, 0.55, dot(nc, nn)));
  }
  return e;
}

vec3 srgb(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
  float d = texture2D(tDepth, vUv).x;
  vec3 c = texture2D(tColor, vUv).rgb;
  bool skyPx = d >= 0.99999;
  if (mode == 5) {
    float v = skyPx ? 0.0 : 1.0 - clamp((lin(d) - depthNear) / max(depthFar - depthNear, 1.0), 0.0, 1.0);
    gl_FragColor = vec4(vec3(v), 1.0);
    return;
  }
  vec3 ink = vec3(0.07, 0.07, 0.08);
  if (mode == 4) {
    float e4 = edgeAt(vUv, max(line, 1.0) * pixel);
    float inkv4 = skyPx ? 0.0 : 1.0 - clamp(c.g / max(c.r, 0.001), 0.0, 1.0);
    gl_FragColor = vec4(vec3(1.0 - max(e4, step(0.5, inkv4))), 1.0);
    return;
  }
  float e = line > 0.0 ? edgeAt(vUv, line * pixel) : 0.0;
  if (mode == 0) {
    gl_FragColor = vec4(skyPx ? sky : srgb(c), 1.0);
    return;
  }
  if (mode == 1) {
    vec3 base = skyPx ? sky : srgb(c);
    gl_FragColor = vec4(mix(base, ink, e * 0.35), 1.0);
    return;
  }
  vec3 paper = vec3(0.985, 0.98, 0.97);
  vec3 outc = paper;
  if (!skyPx) {
    float inkv = smoothstep(0.12, 0.5, 1.0 - clamp(c.g / max(c.r, 0.001), 0.0, 1.0));
    if (mode == 3) {
      float shade = 1.0 - smoothstep(0.24, 0.34, c.r);
      vec2 cell = gl_FragCoord.xy / (5.0 * pixel);
      vec2 g = fract(mat2(0.7071, -0.7071, 0.7071, 0.7071) * cell) - 0.5;
      float r = 0.72 * tone;
      float dotm = tone <= 0.0 ? 0.0 : 1.0 - smoothstep(r - 0.05, r + 0.05, length(g));
      outc = mix(paper, mix(paper, ink, dotm), shade);
    }
    outc = mix(outc, ink, inkv);
  }
  gl_FragColor = vec4(mix(outc, ink, e), 1.0);
}`;

const MODE: Record<Look, number> = { carte: 0, volumes: 1, trait: 2, ombres: 3 };

export class Reperage3D {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 1, 9000);
  private readonly controls: OrbitControls;
  private readonly sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
  private readonly hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.1);
  private readonly composite: THREE.ShaderMaterial;
  private readonly quadScene = new THREE.Scene();
  private readonly quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly normalMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
  private rtColor: THREE.WebGLRenderTarget;
  private rtNormal: THREE.WebGLRenderTarget;
  private frame: LocalFrame | null = null;
  private sample: (x: number, z: number) => number = () => 0;
  private base = 0;
  private radius = 900;
  private ground: THREE.Mesh | null = null;
  private buildings: THREE.Mesh | null = null;
  private textures: { map: THREE.CanvasTexture | null; plan: THREE.CanvasTexture | null; ink: THREE.CanvasTexture | null; photo: THREE.CanvasTexture | null } = { map: null, plan: null, ink: null, photo: null };
  private shapes: { areas: Area[]; roads: Road[] } = { areas: [], roads: [] };
  private look: Look = "trait";
  private fov = 45;
  private line = 1;
  private tone = .5;
  private sun: Sun = { azimuth: 200, altitude: 40 };
  private street = false;
  private swiss = false;
  private photoState: "none" | "loading" | "ready" | "fail" = "none";
  private sources = new Set<SourceId>();
  private raf = 0;
  private abort: AbortController | null = null;
  private disposed = false;
  private readonly resizeObserver: ResizeObserver;
  private readonly materials = {
    groundCarte: new THREE.MeshLambertMaterial({ color: 0xffffff }),
    groundVolumes: new THREE.MeshLambertMaterial({ color: 0xb8b8b4 }),
    groundTrait: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    groundOmbres: new THREE.MeshLambertMaterial({ color: 0xffffff }),
    buildCarte: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide }),
    // vertexColors: OSM / swissBUILDINGS hues so « Au sol » is not a flat grey canyon.
    buildVolumes: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide }),
    buildTrait: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    buildOmbres: new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
  };

  constructor(private readonly host: HTMLElement, private readonly options: { mobile: boolean; pixelRatio: number; events?: EngineEvents }) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(options.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = this.renderer.domElement;
    canvas.className = "u-rep3d-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    this.rtColor = this.makeTarget(2, 2, true);
    this.rtNormal = this.makeTarget(2, 2, false);
    this.composite = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, tNormal: { value: null },
        res: { value: new THREE.Vector2(2, 2) }, near: { value: 1 }, far: { value: 9000 },
        line: { value: 1 }, tone: { value: .5 }, depthFar: { value: 1500 }, depthNear: { value: 1 }, pixel: { value: 1 },
        mode: { value: 2 }, sky: { value: new THREE.Color(0xdfe6ec) },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.composite);
    quad.frustumCulled = false;
    this.quadScene.add(quad);

    this.scene.add(this.hemi);
    this.sunLight.castShadow = true;
    const map = options.mobile ? 1024 : 2048;
    this.sunLight.shadow.mapSize.set(map, map);
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.6;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 2400;
    this.controls.zoomSpeed = 1.1;
    this.setStreetControls(false);
    this.controls.addEventListener("change", () => this.requestRender());
    this.controls.addEventListener("end", () => this.emitView());

    canvas.addEventListener("pointerdown", this.onFinger);
    canvas.addEventListener("pointermove", this.onFingerMove);
    for (const kind of ["pointerup", "pointercancel"] as const) canvas.addEventListener(kind, this.onFingerUp);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }

  private makeTarget(w: number, h: number, depth: boolean): THREE.WebGLRenderTarget {
    const target = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.UnsignedByteType });
    if (depth) {
      target.depthTexture = new THREE.DepthTexture(w, h);
      target.depthTexture.type = THREE.UnsignedIntType;
    }
    return target;
  }

  private fingers = new Map<number, Finger>();
  private two: { start: { a: Finger; b: Finger }; mode: TwoMode; last: TwoReading | null } | null = null;

  private readonly onFinger = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    this.fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.fingers.size === 2) {
      const [a, b] = [...this.fingers.values()];
      this.two = { start: { a: { ...a }, b: { ...b } }, mode: "none", last: null };
    } else this.two = null;
  };

  private readonly onFingerMove = (event: PointerEvent) => {
    if (event.pointerType !== "touch" || !this.fingers.has(event.pointerId)) return;
    this.fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const two = this.two;
    if (!two || this.fingers.size !== 2) return;
    const [a, b] = [...this.fingers.values()];
    const reading = readTwo(two.start, a, b);
    if (two.mode === "none") {
      two.mode = classifyTwo(reading);
      if (two.mode === "none") return;
      two.last = reading;
      return;
    }
    const last = two.last ?? reading;
    two.last = reading;
    if (two.mode === "rotate") this.orbit(-(reading.twist - last.twist), 0);
    else if (two.mode === "tilt") this.orbit(0, tiltFor(reading.drag - last.drag, this.host.clientHeight));
    else this.dolly(last.pinch / Math.max(0.01, reading.pinch));
  };

  private readonly onFingerUp = (event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    this.fingers.delete(event.pointerId);
    if (this.two && this.two.mode !== "none") this.emitView();
    this.two = null;
  };

  /** Which two-finger gesture is running, for tests and the hint. */
  twoMode(): TwoMode {
    return this.two?.mode ?? "none";
  }

  private setStreetControls(street: boolean) {
    const c = this.controls;
    c.enablePan = !street;
    c.enableZoom = !street;
    c.rotateSpeed = street ? -0.35 : 0.8;
    c.minDistance = street ? 0.01 : 20;
    c.maxDistance = street ? 0.05 : 2400;
    c.minPolarAngle = street ? 0.15 : 0;
    c.maxPolarAngle = street ? Math.PI - 0.15 : Math.PI / 2 - 0.02;
    c.mouseButtons = street
      ? { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.ROTATE }
      // « Fais glisser pour tourner »: a plain drag turns around the place; right button moves it.
      : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    c.touches = street
      ? { ONE: THREE.TOUCH.ROTATE, TWO: -1 as unknown as THREE.TOUCH }
      // Two fingers are read by twoStart/twoMove: one meaning at a time (rotate, tilt or zoom).
      : { ONE: THREE.TOUCH.ROTATE, TWO: -1 as unknown as THREE.TOUCH };
  }

  /** The visible stage is wider or taller than the 16:9 capture frame. */
  private frameHeightRatio(): number {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    const frameH = Math.min(h, w / FRAME_ASPECT);
    return frameH / h;
  }

  private viewFov(): number {
    const ratio = this.frameHeightRatio();
    return 2 * Math.atan(Math.tan(this.fov * Math.PI / 360) / ratio) * 180 / Math.PI;
  }

  resize() {
    const w = Math.max(2, this.host.clientWidth);
    const h = Math.max(2, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    const pr = this.renderer.getPixelRatio();
    this.rtColor.setSize(Math.round(w * pr), Math.round(h * pr));
    this.rtNormal.setSize(Math.round(w * pr), Math.round(h * pr));
    this.camera.aspect = w / h;
    this.camera.fov = Math.min(120, this.viewFov());
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  requestRender() {
    if (this.raf || this.disposed) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.renderNow();
    });
  }

  private applyLook() {
    const m = this.materials;
    // At street level the plan sketch underfoot is too pale; prefer the painted map tiles.
    const groundMat = this.street
      ? m.groundCarte
      : { carte: m.groundCarte, volumes: m.groundVolumes, trait: m.groundTrait, ombres: m.groundOmbres }[this.look];
    const buildMat = { carte: m.buildCarte, volumes: m.buildVolumes, trait: m.buildTrait, ombres: m.buildOmbres }[this.look];
    const usePhoto = this.look === "carte" && this.photoState === "ready" && this.textures.photo;
    m.groundCarte.map = usePhoto ? this.textures.photo : this.textures.map;
    m.groundVolumes.map = this.textures.plan;
    m.groundTrait.map = this.textures.ink;
    m.groundOmbres.map = this.textures.ink;
    for (const material of [m.groundCarte, m.groundVolumes, m.groundTrait, m.groundOmbres]) material.needsUpdate = true;
    if (this.ground) this.ground.material = groundMat;
    if (this.buildings) this.buildings.material = buildMat;
    this.sunLight.castShadow = this.look !== "trait";
    this.hemi.intensity = this.look === "ombres" ? 0.55 : this.look === "volumes" ? 1.35 : 1.1;
    this.sunLight.intensity = this.look === "ombres" ? 2.6 : this.look === "volumes" ? 2.8 : 2.1;
    if (this.look === "carte" && this.swiss && this.photoState === "none") void this.loadSwissPhoto();
  }

  private placeSun() {
    const [x, y, z] = sunVector(this.sun);
    const t = this.controls.target;
    const r = this.radius * 1.2;
    this.sunLight.position.set(t.x + x * r, t.y + y * r, t.z + z * r);
    this.sunLight.target.position.copy(t);
    const cam = this.sunLight.shadow.camera;
    const span = this.street ? 260 : Math.min(this.radius, Math.max(260, this.camera.position.distanceTo(t) * 1.6));
    cam.left = -span; cam.right = span; cam.top = span; cam.bottom = -span;
    cam.near = 1; cam.far = r * 2.5;
    cam.updateProjectionMatrix();
  }

  private renderPasses(colorTarget: THREE.WebGLRenderTarget, normalTarget: THREE.WebGLRenderTarget, out: THREE.WebGLRenderTarget | null, mode: number, camera: THREE.PerspectiveCamera, pixel: number) {
    const r = this.renderer;
    this.placeSun();
    this.scene.background = null;
    r.setClearColor(this.look === "carte" ? 0xdfe6ec : this.look === "volumes" ? 0xeeeeec : 0xffffff, 1);
    r.setRenderTarget(colorTarget);
    r.clear();
    r.render(this.scene, camera);
    const needNormals = mode !== 0 && mode !== 5;
    if (needNormals) {
      this.scene.overrideMaterial = this.normalMat;
      const shadow = r.shadowMap.enabled;
      r.shadowMap.enabled = false;
      r.setRenderTarget(normalTarget);
      r.setClearColor(0x8080ff, 1);
      r.clear();
      r.render(this.scene, camera);
      r.shadowMap.enabled = shadow;
      this.scene.overrideMaterial = null;
    }
    const u = this.composite.uniforms;
    u.tColor.value = colorTarget.texture;
    u.tDepth.value = colorTarget.depthTexture;
    u.tNormal.value = normalTarget.texture;
    u.res.value.set(colorTarget.width, colorTarget.height);
    u.near.value = camera.near;
    u.far.value = camera.far;
    u.line.value = this.line;
    u.tone.value = this.tone;
    u.mode.value = mode;
    u.pixel.value = pixel;
    const range = this.depthRange();
    u.depthNear.value = range.near;
    u.depthFar.value = range.far;
    (u.sky.value as THREE.Color).set(this.look === "carte" ? 0xdfe6ec : this.look === "volumes" ? 0xeeeeec : 0xfbfaf8);
    r.setRenderTarget(out);
    r.render(this.quadScene, this.quadCamera);
    r.setRenderTarget(null);
  }

  /** Depth map range in metres: tight around what the frame shows, so the greys carry shape. */
  private depthRange(): { near: number; far: number } {
    if (this.street) return { near: 0.5, far: 260 };
    const d = this.camera.position.distanceTo(this.controls.target);
    return { near: Math.max(1, d * 0.3), far: Math.max(200, Math.min(4000, d * 2.4)) };
  }

  private renderNow() {
    if (this.disposed) return;
    this.updateClip(this.camera);
    this.renderPasses(this.rtColor, this.rtNormal, null, MODE[this.look], this.camera, this.renderer.getPixelRatio());
  }

  private updateClip(camera: THREE.PerspectiveCamera) {
    const d = camera.position.distanceTo(this.controls.target);
    camera.near = this.street ? 0.3 : Math.max(1, d / 200);
    camera.far = this.street ? 4000 : Math.max(3000, d * 8);
    camera.updateProjectionMatrix();
  }

  private emitView() {
    this.options.events?.onView?.(this.view());
  }

  view(): ViewInfo {
    const p = this.camera.position;
    const t = this.controls.target;
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const dz = t.z - p.z;
    const ll = this.frame ? this.frame.toLonLat(p.x, p.z) : { lat: 0, lon: 0 };
    return {
      lat: ll.lat,
      lon: ll.lon,
      heading: headingOf(dx, dz),
      pitch: Math.round(Math.atan2(dy, Math.hypot(dx, dz)) * 1800 / Math.PI) / 10,
      height: Math.max(0, p.y - (this.sample(p.x, p.z) - this.base)),
      street: this.street,
    };
  }

  setLook(look: Look) {
    this.look = look;
    this.applyLook();
    this.requestRender();
  }

  setFov(fov: number) {
    this.fov = fov;
    this.resize();
  }

  setLine(line: number) {
    this.line = line;
    this.requestRender();
  }

  setTone(tone: number) {
    this.tone = tone;
    this.requestRender();
  }

  setSun(sun: Sun) {
    this.sun = sun;
    this.requestRender();
  }

  private ground_y(x: number, z: number): number {
    return this.sample(x, z) - this.base;
  }

  /** Orbit buttons: degrees of azimuth and of tilt. */
  nudge(rotate: number, tilt: number) {
    this.orbit(rotate, tilt);
    this.emitView();
  }

  private orbit(rotate: number, tilt: number) {
    const t = this.controls.target;
    const offset = this.camera.position.clone().sub(t);
    const s = new THREE.Spherical().setFromVector3(offset);
    if (this.street) {
      // Look around: move the target around the eye.
      const look = t.clone().sub(this.camera.position);
      const ls = new THREE.Spherical().setFromVector3(look);
      ls.theta -= rotate * Math.PI / 180;
      ls.phi = Math.max(0.15, Math.min(Math.PI - 0.15, ls.phi - tilt * Math.PI / 180));
      t.copy(this.camera.position).add(new THREE.Vector3().setFromSpherical(ls));
    } else {
      s.theta += rotate * Math.PI / 180;
      s.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.02, s.phi - tilt * Math.PI / 180));
      this.camera.position.copy(t).add(new THREE.Vector3().setFromSpherical(s));
    }
    this.controls.update();
  }

  zoom(factor: number) {
    this.dolly(factor);
    this.emitView();
  }

  private dolly(factor: number) {
    if (this.street) {
      this.setFov(Math.max(15, Math.min(90, this.fov * factor)));
      return;
    }
    const t = this.controls.target;
    const offset = this.camera.position.clone().sub(t);
    const len = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, offset.length() * factor));
    offset.setLength(len);
    this.camera.position.copy(t).add(offset);
    this.controls.update();
  }

  /** Step forward or back in street view, in metres. */
  walk(metres: number) {
    if (!this.street) return;
    const dir = this.controls.target.clone().sub(this.camera.position);
    dir.y = 0;
    if (dir.lengthSq() < 1e-9) return;
    dir.setLength(metres);
    const p = this.camera.position.clone().add(dir);
    const r = this.radius * 0.95;
    p.x = Math.max(-r, Math.min(r, p.x));
    p.z = Math.max(-r, Math.min(r, p.z));
    p.y = this.ground_y(p.x, p.z) + EYE;
    const look = this.controls.target.clone().sub(this.camera.position);
    this.camera.position.copy(p);
    this.controls.target.copy(p).add(look);
    this.controls.update();
    this.emitView();
  }

  heading(): number {
    return this.view().heading;
  }

  /** The nearest point on a street, so a street-level camera never stands inside a building. */
  private streetSpot(x: number, z: number): { x: number; z: number; dir: number | null } {
    let best = { x, z, dir: null as number | null, d: Infinity };
    for (const road of this.shapes.roads) {
      if (road.kind === "rail") continue;
      const weight = road.kind === "path" ? 1.4 : 1;
      for (let i = 0; i < road.line.length - 1; i += 1) {
        const [ax, az] = road.line[i];
        const [bx, bz] = road.line[i + 1];
        const vx = bx - ax, vz = bz - az;
        const len2 = vx * vx + vz * vz;
        if (len2 < 1e-6) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / len2));
        const px = ax + vx * t, pz = az + vz * t;
        const d = Math.hypot(px - x, pz - z) * weight;
        if (d < best.d) best = { x: px, z: pz, dir: headingOf(vx, vz), d };
      }
    }
    return best.d < 400 ? best : { x, z, dir: null };
  }

  /** Raise the camera until no building stands between it and the target (Manhattan, Shibuya). */
  /**
   * A camera spot that sees the target: try the asked pose, then small turns, a closer distance and a
   * little more height, before ever going steeper than 60°. Never a top-down map by surprise.
   */
  private clearPose(t: THREE.Vector3, forward: THREE.Vector3, elevation: number, distance: number): THREE.Vector3 {
    const ray = new THREE.Raycaster();
    const from = t.clone().add(new THREE.Vector3(0, 2, 0));
    const base = Math.atan2(forward.x, -forward.z);
    const at = (el: number, turn: number, dist: number) => {
      const rad = el * Math.PI / 180;
      const h = base + turn * Math.PI / 180;
      return new THREE.Vector3(t.x - Math.sin(h) * Math.cos(rad) * dist, t.y + Math.sin(rad) * dist, t.z + Math.cos(h) * Math.cos(rad) * dist);
    };
    const first = at(elevation, 0, distance);
    if (!this.buildings) return first;
    const clear = (pos: THREE.Vector3) => {
      const dir = pos.clone().sub(from);
      ray.set(from, dir.clone().normalize());
      ray.far = dir.length();
      return ray.intersectObject(this.buildings!, false).length === 0;
    };
    for (const el of [elevation, elevation + 8, elevation + 16, elevation + 24].filter(value => value <= 60)) {
      for (const turn of [0, 30, -30, 60, -60]) {
        for (const dist of [distance, distance * 0.65]) {
          const pos = at(el, turn, dist);
          if (clear(pos)) return pos;
        }
      }
    }
    return at(Math.min(60, elevation + 24), 0, distance);
  }

  frameShot(framing: Framing) {
    const pose = FRAMING_POSES[framing];
    const heading = this.heading();
    const t = this.street ? new THREE.Vector3(this.camera.position.x, 0, this.camera.position.z) : this.controls.target.clone();
    t.y = this.ground_y(t.x, t.z);
    const h = heading * Math.PI / 180;
    const forward = new THREE.Vector3(Math.sin(h), 0, -Math.cos(h));
    if (pose.street) {
      const spot = this.streetSpot(t.x, t.z);
      // Look along the street, the way closest to the current heading: a canyon of façades.
      let look = heading;
      if (spot.dir !== null) {
        const back = (spot.dir + 180) % 360;
        const gap = (a: number) => Math.abs(((a - heading + 540) % 360) - 180);
        look = gap(spot.dir) <= gap(back) ? spot.dir : back;
      }
      // Step back down the street (staying on it): the place sits ahead, between façades.
      let at = new THREE.Vector3(spot.x, 0, spot.z);
      const back = pose.back ?? 0;
      if (back > 0) {
        const lh = look * Math.PI / 180;
        const r = this.radius * 0.9;
        const bx = Math.max(-r, Math.min(r, spot.x - Math.sin(lh) * back));
        const bz = Math.max(-r, Math.min(r, spot.z + Math.cos(lh) * back));
        const snapped = this.streetSpot(bx, bz);
        if (!this.insideBuilding(snapped.x, snapped.z) && Math.hypot(snapped.x - bx, snapped.z - bz) < back) at = new THREE.Vector3(snapped.x, 0, snapped.z);
      }
      this.setStreet(true, { at, heading: look, lookUp: pose.lookUp, eye: pose.eye });
    } else {
      if (this.street) this.setStreet(false);
      this.controls.target.copy(t);
      this.camera.position.copy(this.clearPose(t, forward, pose.elevation, pose.distance));
      this.controls.update();
    }
    this.fov = pose.fov;
    this.resize();
    this.emitView();
  }

  setStreet(on: boolean, at?: { at: THREE.Vector3; heading: number; lookUp: number; eye?: number }) {
    const heading = at?.heading ?? this.heading();
    const h = heading * Math.PI / 180;
    const forward = new THREE.Vector3(Math.sin(h), 0, -Math.cos(h));
    if (on) {
      let spot = at?.at;
      if (!spot) {
        const t = this.controls.target;
        const found = this.streetSpot(t.x, t.z);
        spot = new THREE.Vector3(found.x, 0, found.z);
      }
      const eye = new THREE.Vector3(spot.x, this.ground_y(spot.x, spot.z) + (at?.eye ?? EYE), spot.z);
      const up = (at?.lookUp ?? 4) * Math.PI / 180;
      const dir = forward.clone().multiplyScalar(Math.cos(up)).add(new THREE.Vector3(0, Math.sin(up), 0)).multiplyScalar(0.03);
      this.street = true;
      this.setStreetControls(true);
      this.camera.position.copy(eye);
      this.controls.target.copy(eye).add(dir);
      this.applyLook();
    } else {
      const spot = new THREE.Vector3(this.camera.position.x, 0, this.camera.position.z);
      spot.y = this.ground_y(spot.x, spot.z);
      this.street = false;
      this.setStreetControls(false);
      this.applyLook();
      const pose = FRAMING_POSES.moyen;
      this.controls.target.copy(spot);
      this.camera.position.copy(this.clearPose(spot, forward, pose.elevation, pose.distance));
      this.fov = pose.fov;
    }
    this.controls.update();
    this.resize();
    this.emitView();
  }

  isStreet(): boolean {
    return this.street;
  }

  usedSources(): SourceId[] {
    const list = [...this.sources];
    if (!(this.look === "carte" && this.photoState === "ready")) return list.filter(id => id !== "swisstopo");
    return list;
  }

  async load(place: { lat: number; lon: number }, radius: number): Promise<LoadResult> {
    this.abort?.abort();
    const abort = new AbortController();
    this.abort = abort;
    const signal = abort.signal;
    this.radius = radius;
    this.frame = new LocalFrame(place.lat, place.lon);
    this.swiss = inSwitzerland(place.lat, place.lon);
    this.photoState = "none";
    this.sources = new Set<SourceId>(["osm"]);
    this.swissList = [];
    this.swissRoofs = "off";
    this.swissJob = null;
    const frame = this.frame;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { state: "offline", buildings: 0, sources: [] };
    let rate = false;
    let failed = 0;
    // Relief first: buildings sit on it.
    const demTiles = tilesAround(place.lon, place.lat, radius, DEM_Z, 4);
    const heights: HeightTile[] = [];
    await Promise.all(demTiles.map(async tile => {
      const key = `${tile.z}/${tile.x}/${tile.y}`;
      const hit = demCache.get(key);
      if (hit) { heights.push(hit); return; }
      try {
        const image = await getImage(terrariumUrl(tile), signal);
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, image.width, image.height).data;
        const decoded = decodeTerrarium(tile, data, image.width);
        demCache.set(key, decoded);
        heights.push(decoded);
      } catch (error) {
        if (error instanceof HttpError && error.status === 429) rate = true;
      }
    }));
    if (signal.aborted) return { state: "idle", buildings: 0, sources: [] };
    if (heights.length) this.sources.add("terrain");
    this.sample = makeSampler(heights, frame, 0);
    this.base = this.sample(0, 0);

    let url: string | null = null;
    try {
      url = await template(signal);
    } catch (error) {
      if (error instanceof HttpError && error.status === 429) rate = true;
    }
    const buildings: Building[] = [];
    const roads: Road[] = [];
    const areas: Area[] = [];
    if (url) {
      this.sources.add("openfreemap");
      const tiles = tilesAround(place.lon, place.lat, radius, BUILDING_Z, 9);
      await Promise.all(tiles.map(async (tile: TileId) => {
        const key = `${url}|${tile.x}/${tile.y}|${place.lat.toFixed(4)},${place.lon.toFixed(4)}|${radius}`;
        let shapes = shapeCache.get(key);
        if (!shapes) {
          try {
            const bytes = await getBytes(tileUrl(url!, tile), signal);
            shapes = decodeTile(bytes, tile, frame, radius);
            if (shapeCache.size > 40) shapeCache.delete(shapeCache.keys().next().value as string);
            shapeCache.set(key, shapes);
          } catch (error) {
            if (error instanceof HttpError && error.status === 429) rate = true;
            else failed += 1;
            return;
          }
        }
        buildings.push(...shapes.buildings);
        roads.push(...shapes.roads);
        areas.push(...shapes.areas);
      }));
    } else failed += 1;
    if (signal.aborted) return { state: "idle", buildings: 0, sources: [] };
    this.shapes = { areas, roads };
    this.osmList = buildings;
    this.build(buildings);
    this.controls.target.set(0, this.ground_y(0, 0), 0);
    if (this.insideBuilding(0, 0)) {
      const spot = this.streetSpot(0, 0);
      this.controls.target.set(spot.x, this.ground_y(spot.x, spot.z), spot.z);
    }
    this.camera.position.set(this.controls.target.x, this.controls.target.y + 100, this.controls.target.z + 100);
    this.controls.update();
    this.frameShot("moyen");
    this.applyLook();
    this.requestRender();
    const sources = [...this.sources];
    // Real Swiss roofs arrive after the OSM city: the view is usable at once, then refines.
    if (this.swiss && this.buildingCount > 0) this.swissJob = this.loadSwiss(place, signal);
    else this.options.events?.onRoofs?.("off", 0);
    if (rate && buildings.length === 0) return { state: "rate", buildings: 0, sources };
    if (!url || (failed > 0 && buildings.length === 0 && heights.length === 0)) {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      return { state: offline ? "offline" : "fail", buildings: 0, sources };
    }
    if (this.buildingCount === 0) return { state: "empty", buildings: 0, sources };
    return { state: "ready", buildings: this.buildingCount, sources };
  }

  private buildingCount = 0;
  private footprints: { ring: [number, number][]; x0: number; x1: number; z0: number; z1: number }[] = [];

  private insideBuilding(x: number, z: number): boolean {
    for (const f of this.footprints) {
      if (x < f.x0 || x > f.x1 || z < f.z0 || z > f.z1) continue;
      let inside = false;
      const ring = f.ring;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const [xi, zi] = ring[i];
        const [xj, zj] = ring[j];
        if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  }

  private build(list: Building[]) {
    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground.geometry.dispose();
    }
    for (const key of ["map", "plan", "ink", "photo"] as const) {
      this.textures[key]?.dispose();
      this.textures[key] = null;
    }
    const r = this.radius;
    const cap = this.options.mobile ? 9000 : 24000;
    const sorted = list
      .map(b => ({ b, d: Math.min(...b.outer.map(([x, z]) => Math.hypot(x, z))) }))
      .filter(item => item.d < r)
      .sort((a, b) => a.d - b.d)
      .slice(0, cap)
      .map(item => item.b);
    this.buildingCount = sorted.length;
    this.footprints = sorted.map(b => {
      const xs = b.outer.map(p => p[0]);
      const zs = b.outer.map(p => p[1]);
      return { ring: b.outer, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    });

    // Ground: a relief grid with a painted map.
    const segs = this.options.mobile ? 96 : 140;
    const size = r * 2.2;
    const plane = new THREE.PlaneGeometry(size, size, segs, segs);
    plane.rotateX(-Math.PI / 2);
    const pos = plane.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 1) pos.setY(i, this.ground_y(pos.getX(i), pos.getZ(i)) - 0.15);
    plane.computeVertexNormals();
    this.textures.map = this.paint(size, "map");
    this.textures.plan = this.paint(size, "plan");
    this.textures.ink = this.paint(size, "ink");
    const ground = new THREE.Mesh(plane, this.materials.groundTrait);
    ground.receiveShadow = true;
    this.ground = ground;
    this.scene.add(ground);

    this.osmSorted = sorted;
    this.buildMesh();
  }

  private osmList: Building[] = [];
  private osmSorted: Building[] = [];
  private swissList: SwissBuilding[] = [];
  private swissRoofs: RoofState = "off";
  private swissJob: Promise<void> | null = null;

  /** One merged mesh: swissBUILDINGS3D inside its radius when loaded, OSM volumes elsewhere. */
  private buildMesh() {
    if (this.buildings) {
      this.scene.remove(this.buildings);
      this.buildings.geometry.dispose();
    }
    const positions: number[] = [];
    const colors: number[] = [];
    const swissR = swissRadius(this.options.mobile);
    const swissOn = this.swissList.length > 0;
    for (const b of this.osmSorted) {
      let cx = 0, cz = 0;
      const n = Math.max(1, b.outer.length - 1);
      for (let i = 0; i < n; i += 1) { cx += b.outer[i][0]; cz += b.outer[i][1]; }
      cx /= n; cz /= n;
      if (swissOn && keepSwiss({ cx, cz }, swissR)) continue;
      const from = positions.length;
      this.extrude(b, positions);
      const [cr, cg, cb] = osmMassingColor(b.height, cx, cz);
      for (let i = from; i < positions.length; i += 3) colors.push(cr, cg, cb);
    }
    for (const b of this.swissList) {
      positions.push(...b.positions);
      colors.push(...b.colors);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const m = this.materials;
    const mesh = new THREE.Mesh(geometry, { carte: m.buildCarte, volumes: m.buildVolumes, trait: m.buildTrait, ombres: m.buildOmbres }[this.look]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.buildings = mesh;
    this.scene.add(mesh);
  }

  private async loadSwiss(place: { lat: number; lon: number }, signal: AbortSignal): Promise<void> {
    const frame = this.frame;
    if (!frame) return;
    this.swissRoofs = "loading";
    this.options.events?.onRoofs?.("loading", 0);
    const mobile = this.options.mobile;
    const radius = swissRadius(mobile);
    try {
      const contents = await swissContents(place.lat, place.lon, radius + 60, url => getSwissJson(url, signal), swissTileCap(mobile));
      const loader = swissLoader();
      const list: SwissBuilding[] = [];
      let next = 0;
      const worker = async () => {
        while (next < contents.length && !signal.aborted) {
          const item = contents[next++];
          try {
            let bytes = swissBytes.get(item.url);
            if (!bytes) {
              const response = await fetch(item.url, { credentials: "omit", signal });
              if (!response.ok) throw new HttpError(response.status);
              bytes = await response.arrayBuffer();
              if (swissBytes.size > 400) swissBytes.delete(swissBytes.keys().next().value as string);
              swissBytes.set(item.url, bytes);
            }
            list.push(...await decodeSwiss(loader, bytes, frame));
          } catch (error) {
            if (signal.aborted) return;
            if (error instanceof HttpError && error.status === 429) throw error;
          }
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      if (signal.aborted || frame !== this.frame) return;
      const offset = heightOffset(list, (x, z) => this.ground_y(x, z));
      const kept = offset === null ? [] : list.filter(b => keepSwiss(b, radius));
      if (kept.length === 0) throw new Error("empty");
      for (const b of kept) {
        for (let i = 1; i < b.positions.length; i += 3) b.positions[i] -= offset!;
        b.minY -= offset!;
      }
      this.swissList = kept;
      this.swissRoofs = "ready";
      this.sources.add("swissbuildings");
      this.buildMesh();
      this.applyLook();
      this.requestRender();
      this.options.events?.onRoofs?.("ready", kept.length);
      this.emitView();
    } catch {
      if (signal.aborted || frame !== this.frame) return;
      this.swissRoofs = "fail";
      this.options.events?.onRoofs?.("fail", 0);
    }
  }

  roofs(): { state: RoofState; count: number } {
    return { state: this.swissRoofs, count: this.swissList.length };
  }

  /**
   * What the frame shows, from the shapes already downloaded: named parks and water in view,
   * building heights, camera and sun. No new request (contexte.ts).
   */
  contexte(place: { name: string; detail?: string }): Contexte | null {
    if (!this.frame) return null;
    const view = this.view();
    const p = this.camera.position;
    return lireContexte({
      place,
      camera: { x: p.x, z: p.z, heading: view.heading, pitch: view.pitch, fov: this.fov, height: view.height },
      areas: this.shapes.areas,
      buildings: this.osmList,
      sun: this.sun,
      aspect: FRAME_ASPECT,
    });
  }

  /** Horizontal field of view of the kept frame, in degrees. */
  champ(): number {
    return Math.round(demiChamp(this.fov, FRAME_ASPECT) * 2);
  }

  /**
   * The block around the view, in the format PRISE's maquette reads (Lieux/<id>.quartier.json).
   * OSM footprints and streets, relief samples relative to the centre.
   */
  quartier(name: string): Quartier | null {
    if (!this.frame) return null;
    const mobile = this.options.mobile;
    const radius = rayonFor(mobile, false);
    const centre = this.street ? this.camera.position : this.controls.target;
    const cx = centre.x, cz = centre.z;
    const ll = this.frame.toLonLat(cx, cz);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const ranked = this.osmSorted
      .map(b => ({ b, d: Math.min(...b.outer.map(([x, z]) => Math.hypot(x - cx, z - cz))) }))
      .sort((a, b) => a.d - b.d);
    // A view over a square or a park still gets its nearest block, up to twice the radius.
    const reach = ranked.some(item => item.d < radius) ? radius : radius * 2;
    const near = ranked
      .filter(item => item.d < reach)
      .slice(0, plafondBatiments(mobile))
      .map(item => ({ ring: item.b.outer.map(([x, z]) => [r2(x - cx), r2(z - cz)] as [number, number]), height: Math.round(item.b.height * 10) / 10 }));
    const width: Record<Road["kind"], number> = { major: 12, minor: 7, path: 2.5, rail: 3 };
    const segmentNear = (line: [number, number][]) => line.some(([ax, az], i) => {
      const next = line[i + 1];
      if (!next) return Math.hypot(ax - cx, az - cz) < reach * 1.2;
      const [bx, bz] = next;
      const vx = bx - ax, vz = bz - az;
      const len2 = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((cx - ax) * vx + (cz - az) * vz) / len2));
      return Math.hypot(ax + vx * t - cx, az + vz * t - cz) < reach * 1.2;
    });
    const streets = this.shapes.roads
      .filter(road => road.kind !== "rail" && segmentNear(road.line))
      .slice(0, 80)
      .map(road => ({ points: road.line.map(([x, z]) => [r2(x - cx), r2(z - cz)] as [number, number]), width: width[road.kind] }));
    const n = 17;
    const span = reach * 2;
    const g0 = this.ground_y(cx, cz);
    const samples: number[] = [];
    for (let j = 0; j < n; j += 1) {
      for (let i = 0; i < n; i += 1) {
        const x = cx + (i / (n - 1) - 0.5) * span;
        const z = cz + (j / (n - 1) - 0.5) * span;
        samples.push(Math.round((this.ground_y(x, z) - g0) * 10) / 10);
      }
    }
    const view = this.view();
    const stand = this.street ? { x: 0, z: 0 } : streetStand(streets);
    return {
      name: name.slice(0, 80),
      lat: Math.round(ll.lat * 1e6) / 1e6,
      lon: Math.round(ll.lon * 1e6) / 1e6,
      heading: Math.round(view.heading),
      tilt: Math.round(view.pitch),
      stand,
      buildings: near,
      streets,
      relief: { n, span, samples },
      source: "osm",
    };
  }

  private extrude(b: Building, out: number[]) {
    const ring = b.outer;
    let cx = 0, cz = 0;
    const n = ring.length - 1;
    if (n < 3) return;
    let lowest = Infinity;
    for (let i = 0; i < n; i += 1) {
      cx += ring[i][0]; cz += ring[i][1];
      lowest = Math.min(lowest, this.ground_y(ring[i][0], ring[i][1]));
    }
    cx /= n; cz /= n;
    const g = Math.min(lowest, this.ground_y(cx, cz));
    const top = g + b.height;
    const bottom = b.min > 0 ? g + b.min : g - 4;
    // Outward winding in x/z: positive signed area means clockwise seen from above (z south).
    let area = 0;
    for (let i = 0; i < n; i += 1) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    const flip = area < 0;
    const wall = (a: [number, number], c: [number, number]) => {
      const [ax, az] = flip ? c : a;
      const [bx, bz] = flip ? a : c;
      out.push(ax, bottom, az, bx, bottom, bz, bx, top, bz, ax, bottom, az, bx, top, bz, ax, top, az);
    };
    for (let i = 0; i < n; i += 1) if (!b.cut[i]) wall(ring[i], ring[i + 1]);
    for (const hole of b.holes) for (let i = 0; i < hole.length - 1; i += 1) wall(hole[i + 1], hole[i]);
    const contour = ring.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, z));
    const holes = b.holes.map(h => h.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, z)));
    const pts = [...contour, ...holes.flat()];
    let faces: number[][];
    try {
      faces = THREE.ShapeUtils.triangulateShape(contour, holes);
    } catch {
      return;
    }
    for (const [a, c, d] of faces) {
      const pa = pts[a], pc = pts[c], pd = pts[d];
      if (!pa || !pc || !pd) continue;
      // Roof faces up: order by winding.
      const cross = (pc.x - pa.x) * (pd.y - pa.y) - (pc.y - pa.y) * (pd.x - pa.x);
      if (cross > 0) out.push(pa.x, top, pa.y, pd.x, top, pd.y, pc.x, top, pc.y);
      else out.push(pa.x, top, pa.y, pc.x, top, pc.y, pd.x, top, pd.y);
    }
  }

  // Three painted grounds. « ink » is colour-coded: red marks ink, so the shader can tell
  // a drawn street from a shadow (shadows darken red and white alike).
  private paint(size: number, kind: "map" | "plan" | "ink"): THREE.CanvasTexture {
    const n = kind === "ink" ? (this.options.mobile ? 2048 : 4096) : (this.options.mobile ? 1536 : 2048);
    const canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext("2d")!;
    const half = size / 2;
    const k = n / size;
    const px = (x: number) => (x + half) * k;
    const pz = (z: number) => (z + half) * k;
    const pick = (map: string, plan: string, ink: string) => kind === "map" ? map : kind === "plan" ? plan : ink;
    ctx.fillStyle = pick("#ece8df", "#e4e4e2", "#ffffff");
    ctx.fillRect(0, 0, n, n);
    const fills: Record<string, [string, string, string]> = {
      built: ["#e3ddd2", "#dededc", "#ffffff"], park: ["#c9dcb6", "#d6d8d3", "#fff6f6"], wood: ["#b6cfa0", "#d0d2cd", "#ffeeee"],
      grass: ["#d5e3c3", "#dadcd7", "#fff8f8"], sand: ["#efe3c2", "#e6e4dd", "#ffffff"], water: ["#a9c7da", "#c9d0d5", "#ffe4e4"],
    };
    const order = ["built", "grass", "park", "wood", "sand", "water"];
    for (const kindName of order) {
      const [a, b, c] = fills[kindName];
      ctx.fillStyle = pick(a, b, c);
      for (const area of this.shapes.areas) {
        if (area.kind !== kindName) continue;
        ctx.beginPath();
        for (const ring of [area.outer, ...area.holes]) {
          ring.forEach(([x, z], i) => i === 0 ? ctx.moveTo(px(x), pz(z)) : ctx.lineTo(px(x), pz(z)));
          ctx.closePath();
        }
        ctx.fill("evenodd");
      }
    }
    const width: Record<Road["kind"], number> = { major: 14, minor: 8, path: 2.6, rail: 3 };
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const stroke = (pass: "case" | "fill") => {
      for (const road of this.shapes.roads) {
        const w = width[road.kind] * k;
        const thin = road.kind === "path" || road.kind === "rail";
        if (kind !== "map" && thin && pass === "case") continue;
        if (kind === "plan" && pass === "case") continue;
        ctx.beginPath();
        road.line.forEach(([x, z], i) => i === 0 ? ctx.moveTo(px(x), pz(z)) : ctx.lineTo(px(x), pz(z)));
        if (kind === "map") {
          ctx.strokeStyle = pass === "case" ? "#cfc7b8" : road.kind === "rail" ? "#bdb6aa" : "#fbfaf7";
          ctx.lineWidth = pass === "case" ? w + 2.2 * k : w;
        } else if (kind === "plan") {
          ctx.strokeStyle = thin ? "#d4d4d2" : "#f2f2f0";
          ctx.lineWidth = thin ? Math.max(1, w * .6) : w;
        } else {
          ctx.strokeStyle = pass === "case" ? "#ff0000" : thin ? "#ffb4b4" : "#ffffff";
          ctx.lineWidth = pass === "case" ? w + Math.max(2, 0.8 * k) * 2 : thin ? Math.max(1.5, w * .5) : w;
        }
        ctx.stroke();
      }
    };
    stroke("case");
    stroke("fill");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = kind === "ink" ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  private async loadSwissPhoto() {
    if (!this.frame || this.photoState !== "none") return;
    this.photoState = "loading";
    const frame = this.frame;
    const signal = this.abort?.signal ?? new AbortController().signal;
    const size = this.radius * 2.2;
    const half = size / 2;
    const n = this.options.mobile ? 2048 : 3072;
    const canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#cfcfc8";
    ctx.fillRect(0, 0, n, n);
    const k = n / size;
    const centre = frame.toLonLat(0, 0);
    const tiles = tilesAround(centre.lon, centre.lat, half, SWISS_Z, 49);
    let ok = 0;
    await Promise.all(tiles.map(async tile => {
      try {
        const image = await getImage(SWISSIMAGE.replace("{z}", String(tile.z)).replace("{x}", String(tile.x)).replace("{y}", String(tile.y)), signal);
        const o = tileOrigin(tile);
        const s = tileSize(tile.z);
        const a = frame.fromMerc(o.x, o.y);
        const b = frame.fromMerc(o.x + s, o.y - s);
        ctx.drawImage(image, (a.x + half) * k, (a.z + half) * k, (b.x - a.x) * k, (b.z - a.z) * k);
        ok += 1;
      } catch { /* a missing tile stays grey */ }
    }));
    if (signal.aborted || frame !== this.frame) return;
    if (ok === 0) {
      this.photoState = "fail";
      return;
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.textures.photo = texture;
    this.photoState = "ready";
    this.sources.add("swisstopo");
    this.applyLook();
    this.requestRender();
    this.options.events?.onView?.(this.view());
  }

  hasSwissPhoto(): boolean {
    return this.photoState === "ready";
  }

  inSwiss(): boolean {
    return this.swiss;
  }

  async capture(): Promise<CaptureResult> {
    // Real roofs on the way: wait a little, never forever.
    if (this.swissJob && this.swissRoofs === "loading") await Promise.race([this.swissJob, new Promise(resolve => setTimeout(resolve, 8000))]);
    const w = CAPTURE_W;
    const h = CAPTURE_H;
    const cam = this.camera.clone();
    cam.aspect = w / h;
    cam.fov = this.fov;
    this.updateClip(cam);
    const color = this.makeTarget(w, h, true);
    const normal = this.makeTarget(w, h, false);
    const out = new THREE.WebGLRenderTarget(w, h);
    // Same line weight on every device: a 540-pixel-tall preview is the reference.
    const pixel = h / 540;
    const read = async (mode: number, type: "image/jpeg" | "image/png") => {
      this.renderPasses(color, normal, out, mode, cam, pixel);
      const pixels = new Uint8Array(w * h * 4);
      this.renderer.readRenderTargetPixels(out, 0, 0, w, h, pixels);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      const image = ctx.createImageData(w, h);
      for (let y = 0; y < h; y += 1) image.data.set(pixels.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      ctx.putImageData(image, 0, 0);
      return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("capture")), type, .92));
    };
    try {
      const colorBlob = await read(MODE[this.look], "image/jpeg");
      const linesBlob = await read(4, "image/png");
      const depthBlob = await read(5, "image/png");
      const range = this.depthRange();
      return { color: colorBlob, depth: depthBlob, lines: linesBlob, view: this.view(), fov: this.fov, near: range.near, far: range.far, sources: this.usedSources() };
    } finally {
      color.depthTexture?.dispose();
      color.dispose();
      normal.dispose();
      out.dispose();
      this.requestRender();
    }
  }

  dispose() {
    this.disposed = true;
    this.abort?.abort();
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onFinger);
    canvas.removeEventListener("pointermove", this.onFingerMove);
    for (const kind of ["pointerup", "pointercancel"] as const) canvas.removeEventListener(kind, this.onFingerUp);
    this.controls.dispose();
    for (const mesh of [this.ground, this.buildings]) mesh?.geometry.dispose();
    for (const texture of Object.values(this.textures)) texture?.dispose();
    for (const material of Object.values(this.materials)) material.dispose();
    this.rtColor.depthTexture?.dispose();
    this.rtColor.dispose();
    this.rtNormal.dispose();
    this.composite.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** One b3dm to buildings in the local frame. Triangles are grouped by batch id (one building each). */
async function decodeSwiss(loader: GLTFLoader, bytes: ArrayBuffer, frame: LocalFrame): Promise<SwissBuilding[]> {
  const parts = splitB3dm(bytes);
  if (!parts) return [];
  const gltf = await loader.parseAsync(parts.glb, "");
  gltf.scene.updateMatrixWorld(true);
  const byBatch = new Map<number, SwissBuilding & { n: number }>();
  const v = new THREE.Vector3();
  gltf.scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const pos = geometry.getAttribute("position");
    if (!pos) return;
    const index = geometry.getIndex();
    const batch = geometry.getAttribute("_batchid");
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    const base = material?.color ?? new THREE.Color(0.8, 0.8, 0.8);
    const [r, g, b] = soberColor(base.r, base.g, base.b);
    const local = new Float64Array(pos.count * 3);
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const p = gltfToLocal(v.x, v.y, v.z, parts.rtc, frame);
      local[i * 3] = p[0]; local[i * 3 + 1] = p[1]; local[i * 3 + 2] = p[2];
    }
    const count = index ? index.count : pos.count;
    for (let t = 0; t + 2 < count; t += 3) {
      const ids = index ? [index.getX(t), index.getX(t + 1), index.getX(t + 2)] : [t, t + 1, t + 2];
      const id = batch ? Math.round(batch.getX(ids[0])) : 0;
      let item = byBatch.get(id);
      if (!item) {
        item = { positions: [], colors: [], minY: Infinity, cx: 0, cz: 0, n: 0 };
        byBatch.set(id, item);
      }
      for (const k of ids) {
        const x = local[k * 3], y = local[k * 3 + 1], z = local[k * 3 + 2];
        item.positions.push(x, y, z);
        item.colors.push(r, g, b);
        if (y < item.minY) item.minY = y;
        item.cx += x; item.cz += z; item.n += 1;
      }
    }
    geometry.dispose();
  });
  return [...byBatch.values()].map(({ n, ...rest }) => ({ ...rest, cx: rest.cx / Math.max(1, n), cz: rest.cz / Math.max(1, n) }));
}

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
