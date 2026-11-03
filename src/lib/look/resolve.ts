// Deterministic look → stage settings. No names, no network, no credits spent.
// Wide framing or an explicit camera move uses LTX-2.5. Everything else is Wan + AniSora.

import { cameraFromWords } from "../prise/camera-words.ts";
import type { CoutEstime } from "./quote.ts";
import {
  ANISORA_SLOTS, FINISH_TEMPLATE, KLEIN_EDIT_TEMPLATE, KREA_STYLE_TEMPLATE, LORA_RETRO, LORA_STYLE,
  LTX_I2V_TEMPLATE, QWEN_EDIT_TEMPLATE, QWEN_REFS_MAX, REALESRGAN_ANIME, WAN_I2V_TEMPLATE,
  grapheFinition, type ApiGraph,
} from "./graphs.ts";
import type { AnimePreset, ProjectLook } from "./model.ts";
import { COUT_CADRE, COUT_CAMERA, COUT_DECOR, COUT_FINITION, COUT_JEU, COUT_PLANCHE, COUT_PREMIERE, devisPlan } from "./quote.ts";

export type EtapeLook = "style" | "sheet" | "decor" | "first" | "acting" | "camera" | "finish";
export type RoutePlan = "acting" | "camera";

export interface ShotCue {
  cadrage: "large" | "moyen" | "serre" | "detail" | null;
  camera: "fixe" | "suit" | "approche" | "autour" | null;
  /** Read for camera words only. A person's name never selects the engine. */
  action?: string;
}

export interface ReglageEtape {
  etape: EtapeLook;
  gesteId: string;
  template: string;
  /** Set when Qwen's two-reference edit is not enough. Klein is the open-weights editor already in production. */
  repli: { gesteId: string; template: string; raison: string } | null;
  loras: readonly string[];
  /** Dotted template slots. Empty when the stage sends a core graph instead. */
  slots: Readonly<Record<string, string>>;
  promptSuffix: string;
  graph: ApiGraph | null;
  cout: CoutEstime;
  post: { colorTransfer: boolean; onTwos: boolean; interpolation: false };
  regenerates: false;
}

export interface LookProfile {
  kind: "anime25d";
  preset: AnimePreset;
  styleFrameRef: string | null;
  onTwos: boolean;
  interpolation: false;
  stages: {
    style: ReglageEtape;
    sheet: ReglageEtape;
    decor: ReglageEtape;
    first: ReglageEtape;
    acting: ReglageEtape;
    camera: ReglageEtape;
    finish: ReglageEtape;
  };
}

const EXTRA_MOVE = /\b(crane|grue|gr[uú]a|kamerakran|parallaxe?|parralaxe)\b/i;

/** Wide, or a camera that travels. Never a character or a place name. */
export function routePlan(shot: ShotCue): RoutePlan {
  if (shot.cadrage === "large") return "camera";
  if (shot.camera === "suit" || shot.camera === "approche" || shot.camera === "autour") return "camera";
  const action = shot.action ?? "";
  const said = cameraFromWords(action);
  if (said && said.move !== "fixe" && said.move !== "epaule") return "camera";
  if (EXTRA_MOVE.test(action)) return "camera";
  return "acting";
}

function suffix(look: ProjectLook): string {
  const preset: Record<AnimePreset, string> = {
    theatrical: "theatrical anime, gouache skies, sunbeams, cel shading",
    neon: "neon-night anime, rain, reflections, electric rim light, cel shading",
    daylight: "summer-daylight anime, soft clouds, quiet light, cel shading",
    darkfantasy: "dark-fantasy anime, moonlight, embers, epic scale, cel shading",
    retro: "1990s cel anime, flat shadows, film grain",
    own: "match the style reference exactly",
  };
  const locks = [
    look.locks.line ? "fine ink line, darker on the outline" : "",
    look.locks.shading ? "two-tone cel shading and warm rim light" : "",
    look.locks.palette ? "keep the style-frame palette" : "",
    look.locks.depth ? "painted depth layers for a real 3D camera" : "",
  ].filter(Boolean);
  return [preset[look.preset], ...locks, "No text."].join(". ");
}

function etape(partial: Omit<ReglageEtape, "regenerates" | "post"> & { post?: ReglageEtape["post"] }, look: ProjectLook): ReglageEtape {
  return {
    ...partial,
    post: partial.post ?? { colorTransfer: look.locks.palette, onTwos: false, interpolation: false },
    regenerates: false,
  };
}

/** Null when the project has no look: every stage keeps the template it already uses. */
export function resolveLook(look: ProjectLook | null): LookProfile | null {
  if (!look || look.kind !== "anime25d") return null;
  const promptSuffix = suffix(look);
  const loras = look.preset === "retro" ? [LORA_STYLE, LORA_RETRO] : [LORA_STYLE];
  const style = etape({
    etape: "style", gesteId: "anime-style-frame", template: KREA_STYLE_TEMPLATE, repli: null, loras,
    slots: {}, promptSuffix, graph: null, cout: COUT_CADRE,
  }, look);
  const sheet = etape({
    etape: "sheet", gesteId: "anime-sheet", template: QWEN_EDIT_TEMPLATE,
    repli: { gesteId: "anime-sheet-klein", template: KLEIN_EDIT_TEMPLATE, raison: "qwen-2-refs" },
    loras: [], slots: {}, promptSuffix, graph: null, cout: COUT_PLANCHE,
  }, look);
  const decor = etape({
    etape: "decor", gesteId: "anime-decor", template: KREA_STYLE_TEMPLATE,
    repli: { gesteId: "anime-decor-photo", template: QWEN_EDIT_TEMPLATE, raison: "place-photo" },
    loras, slots: {}, promptSuffix, graph: null, cout: COUT_DECOR,
  }, look);
  const first = etape({
    etape: "first", gesteId: "anime-first-frame", template: QWEN_EDIT_TEMPLATE,
    repli: { gesteId: "anime-sheet-klein", template: KLEIN_EDIT_TEMPLATE, raison: "qwen-2-refs" },
    loras: [], slots: {}, promptSuffix, graph: null, cout: COUT_PREMIERE,
  }, look);
  const acting = etape({
    etape: "acting", gesteId: "anime-prise-jeu", template: WAN_I2V_TEMPLATE, repli: null, loras: [],
    slots: ANISORA_SLOTS, promptSuffix, graph: null, cout: COUT_JEU,
    post: { colorTransfer: look.locks.palette, onTwos: look.onTwos, interpolation: false },
  }, look);
  const camera = etape({
    etape: "camera", gesteId: "anime-prise-camera", template: LTX_I2V_TEMPLATE, repli: null, loras: [],
    slots: {}, promptSuffix, graph: null, cout: COUT_CAMERA,
    post: { colorTransfer: look.locks.palette, onTwos: false, interpolation: false },
  }, look);
  const finish = etape({
    etape: "finish", gesteId: "anime-finish", template: FINISH_TEMPLATE, repli: null, loras: [],
    slots: { model_name: REALESRGAN_ANIME }, promptSuffix: "", graph: grapheFinition({ video: "uttu-prise.mp4", styleFrame: look.locks.palette ? (look.styleFrameRef ?? "uttu-style.png") : null }),
    cout: COUT_FINITION,
    post: { colorTransfer: look.locks.palette, onTwos: false, interpolation: false },
  }, look);
  return { kind: "anime25d", preset: look.preset, styleFrameRef: look.styleFrameRef, onTwos: look.onTwos, interpolation: false, stages: { style, sheet, decor, first, acting, camera, finish } };
}

export interface Consultation {
  changed: boolean;
  gesteId: string;
  template: string;
  slots: Readonly<Record<string, string>>;
  graph: ApiGraph | null;
  repli: ReglageEtape["repli"];
  cout: CoutEstime | null;
  route: RoutePlan | null;
  regenerates: false;
}

const VERS_ETAPE: Record<string, EtapeLook | "shot"> = {
  "cast-photos": "sheet",
  "cast-planche": "sheet",
  "cast-texte": "sheet",
  "decor-texte": "decor",
  "decor-photo": "decor",
  "decor-heure": "decor",
  "prise-plan": "shot",
  "prise-plan-cadre": "shot",
  "prise-plan-h3": "shot",
  "suite-finaliser-video": "finish",
  "suite-finaliser-image": "finish",
};

export interface ConsulterOptions {
  shot?: ShotCue;
  /** Pictures that would enter an edit. Above two, Qwen steps fall back to Klein. */
  refs?: number;
  /** A place photo already exists: paint from it instead of a fresh Krea frame. */
  placePhoto?: boolean;
}

/**
 * What an existing stage should send. With no look, `changed` is false and the caller keeps
 * its template. Finish never comes back as a sampler.
 */
export function consulterLook(gesteId: string, look: ProjectLook | null, options: ConsulterOptions = {}): Consultation {
  const same = (template: string): Consultation => ({ changed: false, gesteId, template, slots: {}, graph: null, repli: null, cout: null, route: null, regenerates: false });
  const profile = resolveLook(look);
  if (!profile) return same("");
  const mapped = VERS_ETAPE[gesteId];
  if (!mapped) return same("");
  if (mapped === "shot") {
    const route = routePlan(options.shot ?? { cadrage: null, camera: null });
    const stage = route === "camera" ? profile.stages.camera : profile.stages.acting;
    const first = profile.stages.first;
    const useKlein = (options.refs ?? 0) > QWEN_REFS_MAX;
    return {
      changed: true,
      gesteId: stage.gesteId,
      template: stage.template,
      slots: stage.slots,
      graph: null,
      repli: useKlein ? first.repli : null,
      cout: devisPlan(route),
      route,
      regenerates: false,
    };
  }
  const stage = profile.stages[mapped];
  const useKlein = mapped !== "finish" && mapped !== "style" && (options.refs ?? 0) > QWEN_REFS_MAX && stage.repli?.raison === "qwen-2-refs";
  const paintPhoto = mapped === "decor" && options.placePhoto && stage.repli?.raison === "place-photo";
  const chosen = useKlein || paintPhoto ? stage.repli! : null;
  return {
    changed: true,
    gesteId: chosen?.gesteId ?? stage.gesteId,
    template: chosen?.template ?? stage.template,
    slots: stage.slots,
    graph: stage.graph,
    repli: chosen ? null : stage.repli,
    cout: stage.cout,
    route: null,
    regenerates: false,
  };
}

/** A fixed seed per shot id, so a remake of the same shot starts from the same number. */
export function seedDuPlan(id: string): number {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 1_000_000_000;
}
