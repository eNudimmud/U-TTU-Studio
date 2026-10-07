// The studio's memory, read from and written to the active project.
// Root: MOC.md lists projects. Each project is one working universe.
//   Projets/<slug>/_MOC.md
//   Projets/<slug>/Cast/canon.md          the look
//   Projets/<slug>/Cast/<id>.md           a character file
//   Projets/<slug>/Refs/                  look photos, role photos
//   Projets/<slug>/Lieux/<id>.md          a place
//   Projets/<slug>/Lieux/<id>-fichier.md  a place file (not the place note)
//   Projets/<slug>/Prises/<id>.md         a take, plus its video and poster
//   Projets/<slug>/Sequences/<id>.md      ordered takes and the raccord between them
//   Projets/<slug>/Shots/<id>.md          one storyboard panel: a sequence, takes, a short note
//   Projets/<slug>/Assets/                weights and clips
//   Projets/<slug>/Journal.md
//   Projets/<slug>/.uttu/                 current place, clips, role draft, measured quotes
//   .uttu/projet.json                     which project is active
// Legacy CANON.md, scenes/, prises/, loras/ are moved on the next read.

import type { LoraResolution } from "../fal/prices.ts";
import { parseQuoteFile, QUOTE_FILE, quotesJson, seedQuotes, type MeasuredQuote } from "../render/measured-quote.ts";
import { DEFAULT_TAKE, TAKE_ASPECTS, TAKE_SECONDS, TAKE_STEPS, takeProfile, type TakeSettings } from "../render/take-graph.ts";
import type { Clip, ClipFormat, TrainingAspect } from "../lora/dataset.ts";
import type { PlaceCamera, PrevizPlan } from "../render/previz.ts";
import { defaultCamera, isLens } from "../render/previz.ts";
import {
  emptyMemory, MEMORY_FILE, memoryMarkdown, promptNoteFile, promptNoteMarkdown, readProjectMemory,
  type MemoryKind, type ProjectMemory,
} from "./memory.ts";
import { list, num, readFrontmatter, text, withFrontmatter } from "./markdown.ts";
import {
  ACTIVE_FILE, DEFAULT_PROJECT_NAME, SECTION_FILE_MOVES, clipVaultPath, isLegacyPath, legacyDestination, projectPath, projectSlug, projectSlugsFrom, projectTitle, projectTree, relocateText, rewriteSectionLinks, rolePhotoPath, rootMoc, scaffoldFiles, vaultMedia,
  type ProjectCard, type TreeFolder,
} from "./project.ts";
import { cleanPath, type VaultEntry, type VaultStore } from "./store.ts";

export const COFFRE_ROOT = "U-TTU-Studio";
export const LOOK_PHOTOS_MAX = 3;
export const ROLE_PHOTOS_MAX = 4;
export const SCENE_STILLS_MAX = 2;
export const TRAITS_MIN = 2;
export const NAME_MAX = 40;
export const NOTE_MAX = 280;
export const RACCORD_MAX = 240;
export const SEQUENCE_LINKS_MAX = 24;
export const SHOT_NOTE_MAX = 240;
export const SHOT_TAKES_MAX = 12;
export const LINE_MAX = 240;

export interface Look {
  name: string;
  traits: string[];
  photos: string[];
  note: string;
}

export interface Scene {
  id: string;
  name: string;
  note: string;
  stills: string[];
  /** Which blocking plan this place holds. It stays in the note, with or without a file. */
  previz: PrevizPlan | null;
  /** The last .blend written for this place, when that file is still in the vault. */
  previzFile: string | null;
  /** The camera path, start and end, in the studio's Y-up space. Null until a plan is chosen. */
  camera: PlaceCamera | null;
  /** Cycles frames of the empty place along that path. Absent until Farpy returns them. */
  frames: string[];
  /** First of those frames, so the place tile has pixels. Not the character. */
  render: string | null;
  /** The filmed shot: the vault LoRA in this place. Null until that job saves a video. */
  shot: string | null;
  /** Extra stills of this place, kept for a place LoRA. Not the character. */
  views: string[];
}

/** The character being formed. Separate from the look, and from files already trained. */
export interface RoleDraft {
  name: string;
  photos: string[];
}

/** "comfy": references only, on Comfy Cloud. "lora": the adherent's LoRA loaded by H3 on fal. */
export type TakeEngine = "comfy" | "lora";
export type CostSource = "billing" | "balance" | null;

export interface Take {
  id: string;
  at: string;
  sceneId: string | null;
  sceneName: string;
  line: string;
  settings: TakeSettings;
  profile: string;
  jobId: string;
  video: string;
  poster: string | null;
  prompt: string;
  gpuSeconds: number | null;
  costCredits: number | null;
  /** Balances are in the engine's own unit: Comfy credits, or US dollars on fal. */
  balanceBefore: number | null;
  balanceAfter: number | null;
  engine: TakeEngine;
  loraId: string | null;
  resolution: LoraResolution | null;
  costUsd: number | null;
  costSource: CostSource;
}

export type LoraKind = "personnage" | "lieu";

export interface Lora {
  id: string;
  at: string;
  name: string;
  /** Missing on older notes means a character. A place never enters the H3 take. */
  kind: LoraKind;
  /** The place this file was trained from, when kind is lieu. */
  sceneId: string | null;
  trigger: string;
  file: string;
  bytes: number;
  sha256: string;
  steps: number;
  rank: number;
  aspect: TrainingAspect;
  clips: number;
  endpoint: string;
  requestId: string;
  seconds: number | null;
  costUsd: number | null;
  costSource: CostSource;
  balanceBefore: number | null;
  balanceAfter: number | null;
}

/** One step in a sequence. The raccord says what must match coming into this take. The first step has none. */
export interface SequenceLink {
  takeId: string;
  raccord: string;
}

export interface Sequence {
  id: string;
  name: string;
  links: SequenceLink[];
}

/** One storyboard panel. The sequence orders the panels. The takes are the panel, in order. */
export interface Shot {
  id: string;
  name: string;
  sequenceId: string | null;
  takeIds: string[];
  note: string;
  ordre: number;
}

export interface Studio {
  look: Look;
  scenes: Scene[];
  currentScene: string | null;
  takes: Take[];
  sequences: Sequence[];
  shots: Shot[];
  loras: Lora[];
  clips: Clip[];
  role: RoleDraft;
  /** Balance deltas that may open Tourner. Cleared quotes stay gone. */
  quotes: MeasuredQuote[];
  /** Slug of the project the chain reads. Null when mon studio has no project yet. */
  project: string | null;
  projectName: string;
  projects: ProjectCard[];
  tree: TreeFolder[];
  /** Bible, style, lexicon and prompts of the open project. Scaffold sentences stay empty here. */
  memory: ProjectMemory;
}

export const emptyLook = (): Look => ({ name: "", traits: [], photos: [], note: "" });
export const emptyRole = (): RoleDraft => ({ name: "", photos: [] });
export const emptySceneDraft = (): Pick<Scene, "name" | "note" | "stills" | "previz" | "previzFile" | "camera" | "frames" | "render" | "shot" | "views"> => ({
  name: "", note: "", stills: [], previz: null, previzFile: null, camera: null, frames: [], render: null, shot: null, views: [],
});

export const isPlaceLora = (lora: Pick<Lora, "kind">) => lora.kind === "lieu";
export const emptyStudio = (): Studio => ({
  look: emptyLook(), scenes: [], currentScene: null, takes: [], sequences: [], shots: [], loras: [], clips: [], role: emptyRole(), quotes: [],
  project: null, projectName: "", projects: [], tree: [], memory: emptyMemory(),
});

const oneLine = (value: string, max: number) => value.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const block = (value: string, max: number) => value.replace(/\r\n/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f]+/g, " ").trim().slice(0, max);

export function cleanTraits(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const trait = oneLine(item, 60);
    const key = trait.toLowerCase();
    if (!trait || seen.has(key)) continue;
    seen.add(key);
    out.push(trait);
    if (out.length >= 8) break;
  }
  return out;
}

export function parseTraits(raw: string): string[] {
  return cleanTraits(raw.split(/[,;\n]+/));
}

export interface LookCheck {
  ready: boolean;
  photos: boolean;
  name: boolean;
  traits: boolean;
}

/** The look holds with two photos, a name, and two things that do not change. */
export function lookCheck(look: Look): LookCheck {
  const photos = look.photos.length >= 2;
  const name = look.name.trim().length > 0;
  const traits = look.traits.length >= TRAITS_MIN;
  return { ready: photos && name && traits, photos, name, traits };
}

export function slugify(name: string): string {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return base || "lieu";
}

export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now().toString(36)}`;
}

export function takeId(date: Date, scene: string): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${stamp}-${slugify(scene || "prise").slice(0, 24)}`;
}

export const extensionFor = (type: string) => (type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "video/webm" ? "webm" : type.startsWith("video/") ? "mp4" : "jpg");

export function canonMarkdown(look: Look, projet = ""): string {
  const traits = look.traits.length ? look.traits.map(trait => `- ${trait}`).join("\n") : "-";
  const photos = look.photos.map(path => `![[${path}]]`).join("\n");
  const body = `# ${look.name || "Références"}\n\n## Ce qui ne change pas\n\n${traits}\n\n## Photos\n\n${photos || "Aucune."}\n${look.note ? `\n## Note\n\n${look.note}\n` : ""}`;
  return withFrontmatter({
    type: "personnage", projet, statut: "brouillon", gesture: "personnage", updated: new Date().toISOString(),
    nom: look.name, traits: look.traits, photos: look.photos,
  }, body);
}

export function parseCanon(source: string): Look {
  const { fields, body } = readFrontmatter(source);
  const note = /## Note\n\n([\s\S]*)$/.exec(body)?.[1]?.trim() ?? "";
  return {
    name: oneLine(text(fields.nom), NAME_MAX),
    traits: cleanTraits(list(fields.traits)),
    photos: list(fields.photos).slice(0, LOOK_PHOTOS_MAX),
    note: block(note, NOTE_MAX),
  };
}

const PLANS = ["piece", "quai", "rue"] as const;

export function sceneMarkdown(scene: Scene, projet = ""): string {
  const stills = (scene.stills ?? []).map(path => `![[${path}]]`).join("\n");
  const body = `# ${scene.name}\n\n${scene.note || ""}\n\n${stills}\n`;
  const camera = scene.camera;
  return withFrontmatter({
    type: "lieu",
    projet,
    statut: "brouillon",
    gesture: "scene",
    updated: new Date().toISOString(),
    nom: scene.name,
    note: scene.note,
    images: scene.stills ?? [],
    previz: scene.previz ?? null,
    fichier: scene.previzFile ?? null,
    rendu: scene.render ?? null,
    trajet: scene.frames ?? [],
    plan_filme: scene.shot ?? null,
    vues: scene.views ?? [],
    cam_x: camera?.x ?? null,
    cam_y: camera?.y ?? null,
    cam_z: camera?.z ?? null,
    vise_x: camera?.aimX ?? null,
    vise_y: camera?.aimY ?? null,
    vise_z: camera?.aimZ ?? null,
    fin_x: camera?.endX ?? null,
    fin_y: camera?.endY ?? null,
    fin_z: camera?.endZ ?? null,
    fin_vise_x: camera?.endAimX ?? null,
    fin_vise_y: camera?.endAimY ?? null,
    fin_vise_z: camera?.endAimZ ?? null,
    focale: camera?.lens ?? null,
  }, body);
}

export function parseScene(id: string, source: string): Scene {
  const { fields } = readFrontmatter(source);
  const plan = text(fields.previz);
  return {
    id,
    name: oneLine(text(fields.nom, id), NAME_MAX) || id,
    note: block(text(fields.note), NOTE_MAX),
    stills: list(fields.images).slice(0, SCENE_STILLS_MAX),
    previz: (PLANS as readonly string[]).includes(plan) ? plan as PrevizPlan : null,
    previzFile: text(fields.fichier) || null,
    camera: cameraFrom(fields, (PLANS as readonly string[]).includes(plan) ? plan as PrevizPlan : null),
    frames: list(fields.trajet).filter(vaultMedia),
    render: text(fields.rendu) || null,
    shot: text(fields.plan_filme) || null,
    views: list(fields.vues).filter(vaultMedia),
  };
}

function cameraFrom(fields: ReturnType<typeof readFrontmatter>["fields"], plan: PrevizPlan | null): PlaceCamera | null {
  const lens = num(fields.focale);
  const values = [num(fields.cam_x), num(fields.cam_y), num(fields.cam_z), num(fields.vise_x), num(fields.vise_y), num(fields.vise_z)];
  if (values.some(value => value === null) || lens === null || !isLens(lens)) return null;
  const end = [num(fields.fin_x), num(fields.fin_y), num(fields.fin_z), num(fields.fin_vise_x), num(fields.fin_vise_y), num(fields.fin_vise_z)];
  const fallback = defaultCamera(plan ?? "piece");
  return {
    x: values[0]!, y: values[1]!, z: values[2]!, aimX: values[3]!, aimY: values[4]!, aimZ: values[5]!, lens,
    endX: end[0] ?? fallback.endX,
    endY: end[1] ?? fallback.endY,
    endZ: end[2] ?? fallback.endZ,
    endAimX: end[3] ?? fallback.endAimX,
    endAimY: end[4] ?? fallback.endAimY,
    endAimZ: end[5] ?? fallback.endAimZ,
  };
}

export function parseRole(source: string | undefined): RoleDraft {
  try {
    const data = JSON.parse(source ?? "null") as { nom?: unknown; photos?: unknown } | null;
    const photos = Array.isArray(data?.photos) ? data.photos.filter((item): item is string => typeof item === "string" && rolePhotoPath(item)) : [];
    return { name: oneLine(typeof data?.nom === "string" ? data.nom : "", NAME_MAX), photos: photos.slice(0, ROLE_PHOTOS_MAX) };
  } catch {
    return emptyRole();
  }
}

export function roleJson(role: RoleDraft): string {
  return JSON.stringify({ nom: role.name, photos: role.photos });
}

const usd = (value: number) => `${value.toFixed(2)} $`;

/** What a take cost, in its payer's own unit. */
export function costLabel(take: Pick<Take, "engine" | "costCredits" | "costUsd">): string | null {
  if (take.engine === "lora") return take.costUsd === null ? null : usd(take.costUsd);
  return take.costCredits === null ? null : `${take.costCredits} cr.`;
}

export function takeMarkdown(take: Take, projet = ""): string {
  const cost = take.engine === "lora"
    ? take.costUsd === null ? "Débit pas encore lu." : `${usd(take.costUsd)} débités sur le compte fal.`
    : take.costCredits === null ? "Débit pas encore lu." : `${take.costCredits} crédits débités.`;
  const engine = take.engine === "lora" ? "Rendu avec le fichier du personnage, chez fal. " : "";
  const body = `# ${take.line || "Prise"}\n\n![[${take.video}]]\n\n${take.sceneName ? `Lieu : ${take.sceneName}. ` : ""}${engine}${cost}\n`;
  return withFrontmatter({
    type: "prise",
    projet,
    statut: "tourné",
    moteur: take.engine === "lora" ? "fal" : "comfy",
    gesture: "prise",
    updated: new Date().toISOString(),
    date: take.at,
    lieu: take.sceneId,
    lieu_nom: take.sceneName,
    plan: take.line,
    lora: take.loraId,
    duree_s: take.settings.seconds,
    qualite: take.settings.quality,
    resolution: take.resolution,
    format: take.settings.aspect,
    profil: take.profile,
    job: take.jobId,
    video: take.video,
    vignette: take.poster,
    calcul_s: take.gpuSeconds,
    cout_credits: take.costCredits,
    cout_usd: take.costUsd,
    cout_source: take.costSource,
    solde_avant: take.balanceBefore,
    solde_apres: take.balanceAfter,
    texte: take.prompt,
  }, body);
}

const ENGINES: readonly TakeEngine[] = ["comfy", "lora"];
const RESOLUTIONS: readonly LoraResolution[] = ["480P", "768P"];
const SOURCES: readonly NonNullable<CostSource>[] = ["billing", "balance"];
const ASPECTS: readonly TrainingAspect[] = ["9:16", "16:9", "1:1"];
const pick = <T extends string>(value: string, options: readonly T[]): T | null => (options as readonly string[]).includes(value) ? value as T : null;

export function parseTake(id: string, source: string): Take | null {
  const { fields } = readFrontmatter(source);
  const video = text(fields.video);
  const jobId = text(fields.job);
  if (!video || !jobId) return null;
  const seconds = num(fields.duree_s);
  const quality = text(fields.qualite);
  const aspect = text(fields.format);
  const settings: TakeSettings = {
    seconds: (TAKE_SECONDS as readonly number[]).includes(seconds ?? -1) ? seconds as TakeSettings["seconds"] : DEFAULT_TAKE.seconds,
    quality: quality in TAKE_STEPS ? quality as TakeSettings["quality"] : DEFAULT_TAKE.quality,
    aspect: aspect in TAKE_ASPECTS ? aspect as TakeSettings["aspect"] : DEFAULT_TAKE.aspect,
  };
  return {
    id,
    at: text(fields.date),
    sceneId: text(fields.lieu) || null,
    sceneName: text(fields.lieu_nom),
    line: text(fields.plan),
    settings,
    profile: text(fields.profil) || takeProfile(settings),
    jobId,
    video,
    poster: text(fields.vignette) || null,
    prompt: text(fields.texte),
    gpuSeconds: num(fields.calcul_s),
    costCredits: num(fields.cout_credits),
    balanceBefore: num(fields.solde_avant),
    balanceAfter: num(fields.solde_apres),
    engine: text(fields.moteur) === "fal" || text(fields.moteur) === "lora" ? "lora" : pick(text(fields.moteur), ENGINES) ?? "comfy",
    loraId: text(fields.lora) || null,
    resolution: pick(text(fields.resolution), RESOLUTIONS),
    costUsd: num(fields.cout_usd),
    costSource: pick(text(fields.cout_source), SOURCES),
  };
}

/** Stems that would read as the section itself, or as the empty-folder note. */
const SEQUENCE_SKIP = new Set(["index", "sequence", "sequences", "modele", "modeles", "lieu"]);

const keptStrings = (value: ReturnType<typeof readFrontmatter>["fields"][string] | undefined): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function sequenceStem(name: string): string {
  const base = slugify(name.trim());
  return SEQUENCE_SKIP.has(base) ? "suite" : base;
}

export function normalizeLinks(links: readonly SequenceLink[]): SequenceLink[] {
  const seen = new Set<string>();
  const out: SequenceLink[] = [];
  for (const link of links) {
    const takeId = oneLine(link.takeId, 80);
    if (!/^[A-Za-z0-9-]+$/.test(takeId) || seen.has(takeId)) continue;
    seen.add(takeId);
    out.push({ takeId, raccord: oneLine(link.raccord, RACCORD_MAX) });
    if (out.length >= SEQUENCE_LINKS_MAX) break;
  }
  if (out[0]) out[0] = { ...out[0], raccord: "" };
  return out;
}

/** Drops a take and clears the raccord that used to follow it, because that join changed. */
export function dropTakeLink(links: readonly SequenceLink[], takeId: string): SequenceLink[] {
  const index = links.findIndex(link => link.takeId === takeId);
  if (index < 0) return normalizeLinks(links);
  const next = links.filter(link => link.takeId !== takeId);
  if (index < next.length) next[index] = { ...next[index], raccord: "" };
  return normalizeLinks(next);
}

export function sequenceMarkdown(sequence: Sequence, projet = "", takes: readonly Pick<Take, "id" | "line">[] = []): string {
  const links = normalizeLinks(sequence.links);
  const rows = links.map((link, index) => {
    const line = takes.find(item => item.id === link.takeId)?.line.trim() || link.takeId;
    const alias = line.replace(/[\[\]|\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || link.takeId;
    const target = projet ? `Projets/${projet}/Prises/${link.takeId}` : `Prises/${link.takeId}`;
    const join = index > 0 && link.raccord ? `\n   Raccord : ${link.raccord}` : "";
    return `${index + 1}. [[${target}|${alias}]]${join}`;
  });
  const listed = rows.length > 0 ? rows.join("\n") : "Aucune prise pour l’instant.";
  const body = `# ${sequence.name}\n\nUne séquence tient l’ordre des prises. Le raccord dit ce qui doit coller : lumière, regard, mouvement, objet.\n\n${listed}\n`;
  return withFrontmatter({
    type: "sequence",
    projet,
    statut: "brouillon",
    gesture: "sequence",
    updated: new Date().toISOString(),
    nom: sequence.name,
    prises: links.map(link => link.takeId),
    raccords: links.map(link => link.raccord),
  }, body);
}

export function parseSequence(id: string, source: string): Sequence | null {
  if (SEQUENCE_SKIP.has(id)) return null;
  const { fields } = readFrontmatter(source);
  const prises = keptStrings(fields.prises).map(item => oneLine(item, 80)).filter(item => /^[A-Za-z0-9-]+$/.test(item));
  const raccords = keptStrings(fields.raccords);
  return {
    id,
    name: oneLine(text(fields.nom), NAME_MAX) || id,
    links: normalizeLinks(prises.map((takeId, index) => ({ takeId, raccord: raccords[index] ?? "" }))),
  };
}

/** Stems that would read as the Shots section, or as the empty-folder note. */
const SHOT_SKIP = new Set(["index", "shot", "shots", "plan", "plans", "modele", "modeles", "sequence", "sequences", "lieu", "prise", "prises"]);

export function shotStem(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "cadre";
  const base = slugify(trimmed);
  return SHOT_SKIP.has(base) ? "cadre" : base;
}

export function normalizeTakeIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const takeId = oneLine(raw, 80);
    if (!/^[A-Za-z0-9-]+$/.test(takeId) || seen.has(takeId)) continue;
    seen.add(takeId);
    out.push(takeId);
    if (out.length >= SHOT_TAKES_MAX) break;
  }
  return out;
}

function cleanSequenceId(value: string | null): string | null {
  const id = oneLine(value ?? "", 80);
  return /^[a-z0-9-]+$/.test(id) ? id : null;
}

/** Panels of one sequence, in storyboard order. */
export function shotsOf(shots: readonly Shot[], sequenceId: string): Shot[] {
  return shots
    .filter(shot => shot.sequenceId === sequenceId)
    .sort((a, b) => a.ordre - b.ordre || a.name.localeCompare(b.name, "fr") || a.id.localeCompare(b.id));
}

/** A newly linked panel goes at the end of that sequence. */
export function assignOrdre(shots: readonly Shot[], shot: Shot): Shot {
  if (!shot.sequenceId) return { ...shot, ordre: 0 };
  const others = shotsOf(shots.filter(item => item.id !== shot.id), shot.sequenceId);
  const ordre = others.reduce((max, item) => Math.max(max, item.ordre), -1) + 1;
  return { ...shot, ordre };
}

/** Moves a panel among the panels of its sequence. Panels without a sequence stay put. */
export function moveShot(shots: readonly Shot[], id: string, direction: -1 | 1): Shot[] {
  const shot = shots.find(item => item.id === id);
  if (!shot?.sequenceId) return shots.map(item => ({ ...item }));
  const group = shotsOf(shots, shot.sequenceId);
  const index = group.findIndex(item => item.id === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= group.length) return shots.map(item => ({ ...item }));
  const reordered = [...group];
  const [item] = reordered.splice(index, 1);
  reordered.splice(next, 0, item);
  const ordre = new Map(reordered.map((panel, at) => [panel.id, at]));
  return shots.map(panel => ordre.has(panel.id) ? { ...panel, ordre: ordre.get(panel.id) ?? panel.ordre } : { ...panel });
}

export function dropTakeFromShots(shots: readonly Shot[], takeId: string): Shot[] {
  return shots.map(shot => shot.takeIds.includes(takeId) ? { ...shot, takeIds: normalizeTakeIds(shot.takeIds.filter(id => id !== takeId)) } : shot);
}

export function clearShotSequence(shots: readonly Shot[], sequenceId: string): Shot[] {
  return shots.map(shot => shot.sequenceId === sequenceId ? { ...shot, sequenceId: null, ordre: 0 } : shot);
}

export function shotMarkdown(shot: Shot, projet = "", takes: readonly Pick<Take, "id" | "line">[] = [], sequenceName = ""): string {
  const sequenceId = cleanSequenceId(shot.sequenceId);
  const takeIds = normalizeTakeIds(shot.takeIds);
  const note = oneLine(shot.note, SHOT_NOTE_MAX);
  const rows = takeIds.map((takeId, index) => {
    const line = takes.find(item => item.id === takeId)?.line.trim() || takeId;
    const alias = line.replace(/[\[\]|\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || takeId;
    const target = projet ? `Projets/${projet}/Prises/${takeId}` : `Prises/${takeId}`;
    return `${index + 1}. [[${target}|${alias}]]`;
  });
  const sequenceLine = sequenceId
    ? `Séquence : [[${projet ? `Projets/${projet}/Sequences/${sequenceId}` : `Sequences/${sequenceId}`}|${(sequenceName || sequenceId).replace(/[\[\]|]/g, " ")}]]`
    : "Sans séquence.";
  const listed = rows.length > 0 ? rows.join("\n") : "Aucune prise pour l’instant.";
  const noted = note ? `Note : ${note}\n\n` : "";
  const body = `# ${shot.name}\n\nUn plan est une case du storyboard. Il suit une séquence, puis des prises, dans l’ordre.\n\n${sequenceLine}\n\n${noted}${listed}\n`;
  return withFrontmatter({
    type: "shot",
    projet,
    statut: "brouillon",
    gesture: "shot",
    updated: new Date().toISOString(),
    nom: shot.name,
    sequence: sequenceId ?? "",
    prises: takeIds,
    note,
    ordre: sequenceId ? Math.max(0, Math.round(shot.ordre)) : 0,
  }, body);
}

export function parseShot(id: string, source: string): Shot | null {
  if (SHOT_SKIP.has(id)) return null;
  const { fields } = readFrontmatter(source);
  const ordre = num(fields.ordre);
  return {
    id,
    name: oneLine(text(fields.nom), NAME_MAX) || id,
    sequenceId: cleanSequenceId(text(fields.sequence)),
    takeIds: normalizeTakeIds(keptStrings(fields.prises)),
    note: oneLine(text(fields.note), SHOT_NOTE_MAX),
    ordre: ordre === null || ordre < 0 ? 0 : Math.round(ordre),
  };
}

export function loraId(date: Date, name: string): string {
  return takeId(date, name || "lora");
}

export function loraMarkdown(lora: Lora, projet = ""): string {
  const cost = lora.costUsd === null ? "Débit pas encore lu." : `${usd(lora.costUsd)} débités sur le compte fal.`;
  const body = lora.kind === "lieu"
    ? `# LoRA — ${lora.name || "lieu"}\n\nDéclencheur : \`${lora.trigger}\`.\n\nFormé chez fal sur ${lora.clips} vues de ce lieu, ${lora.steps} pas. ${cost}\n\nUne image neuve de ce lieu le recharge. Ce n’est pas un volume : le fichier Blender du lieu reste le modèle 3D. Il n’entre pas dans la prise H3.\n\nFichier : \`${lora.file}\`\n`
    : `# LoRA — ${lora.name || "personnage"}\n\nDéclencheur : \`${lora.trigger}\`.\n\nFormé chez fal sur ${lora.clips} clips, ${lora.steps} pas, rang ${lora.rank}. ${cost}\n\nLa prise le recharge en « Personnage (fichier) » : MiniMax H3 référence-vers-vidéo, chez fal.\n\nFichier : \`${lora.file}\`\n`;
  return withFrontmatter({
    type: lora.kind === "lieu" ? "lieu" : "personnage",
    projet,
    statut: "prêt",
    moteur: "fal",
    gesture: lora.kind === "lieu" ? "scene" : "personnage",
    updated: new Date().toISOString(),
    date: lora.at,
    nom: lora.name,
    genre: lora.kind,
    scene: lora.sceneId,
    declencheur: lora.trigger,
    fichier: lora.file,
    octets: lora.bytes,
    sha256: lora.sha256,
    pas: lora.steps,
    rang: lora.rank,
    format: lora.aspect,
    clips: lora.clips,
    entraineur: lora.endpoint,
    requete: lora.requestId,
    calcul_s: lora.seconds,
    cout_usd: lora.costUsd,
    cout_source: lora.costSource,
    solde_avant: lora.balanceBefore,
    solde_apres: lora.balanceAfter,
  }, body);
}

export function parseLora(id: string, source: string): Lora | null {
  const { fields } = readFrontmatter(source);
  const file = text(fields.fichier);
  const trigger = text(fields.declencheur);
  const requestId = text(fields.requete);
  if (!file || !trigger || !requestId) return null;
  return {
    id,
    at: text(fields.date),
    name: oneLine(text(fields.nom), NAME_MAX),
    kind: text(fields.genre) === "lieu" ? "lieu" : "personnage",
    sceneId: text(fields.scene) || null,
    trigger: oneLine(trigger, 60),
    file,
    bytes: num(fields.octets) ?? 0,
    sha256: text(fields.sha256),
    steps: num(fields.pas) ?? 0,
    rank: num(fields.rang) ?? 0,
    aspect: pick(text(fields.format), ASPECTS) ?? "9:16",
    clips: num(fields.clips) ?? 0,
    endpoint: text(fields.entraineur),
    requestId,
    seconds: num(fields.calcul_s),
    costUsd: num(fields.cout_usd),
    costSource: pick(text(fields.cout_source), SOURCES),
    balanceBefore: num(fields.solde_avant),
    balanceAfter: num(fields.solde_apres),
  };
}

function wiki(note: string, label: string): string {
  const alias = label.replace(/[\[\]|\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return alias ? `[[${note}|${alias}]]` : `[[${note}]]`;
}

function mapSection(title: string, lines: readonly string[]): string {
  const body = lines.length > 0 ? lines.map(line => `- ${line}`).join("\n") : "Rien pour l’instant.";
  return `## ${title}\n\n${body}`;
}

/** The active project's map. The root map only lists projects. */
export function mocMarkdown(studio: Studio): string {
  const slug = studio.project;
  if (!slug) return rootMoc(studio.projects);
  const look = studio.look.name.trim();
  const people = studio.loras.filter(lora => !isPlaceLora(lora));
  const places = studio.loras.filter(lora => isPlaceLora(lora));
  const base = `Projets/${slug}`;
  const sections = [
    mapSection("Références", look || studio.look.photos.length > 0 ? [wiki(`${base}/Cast/canon`, look || "Références")] : []),
    mapSection("Fichiers", people.map(lora => wiki(`${base}/Cast/${lora.id}`, lora.name || lora.trigger || "Personnage"))),
    mapSection("Lieux", [
      ...studio.scenes.map(scene => wiki(`${base}/Lieux/${scene.id}`, scene.name || "Lieu")),
      ...places.map(lora => wiki(`${base}/Lieux/${lora.id}-fichier`, lora.name || "Lieu")),
    ]),
    mapSection("Prises", studio.takes.map(take => wiki(`${base}/Prises/${take.id}`, take.line.trim() || take.sceneName || "Prise"))),
    mapSection("Séquences", studio.sequences.map(sequence => wiki(`${base}/Sequences/${sequence.id}`, sequence.name || "Séquence"))),
    mapSection("Plans", studio.shots.map(shot => wiki(`${base}/Shots/${shot.id}`, shot.name || "Plan"))),
    mapSection("Repères", [wiki(`${base}/Bible`, "Bible"), wiki(`${base}/Style`, "Style"), wiki(`${base}/Lexique`, "Lexique"), wiki(`${base}/Journal`, "Journal")]),
    mapSection("Moteurs", [
      wiki(`${base}/Moteurs/moteur-references`, "Prise · Références"),
      wiki(`${base}/Moteurs/moteur-personnage`, "Prise · Personnage"),
      wiki(`${base}/Moteurs/former`, "Former un personnage"),
      wiki(`${base}/Moteurs/moteur-lieu`, "Former un lieu"),
      wiki(`${base}/Moteurs/image`, "Image d’un lieu"),
    ]),
  ];
  return `# ${studio.projectName || slug}\n\nCarte de ce projet. Obsidian ouvre chaque lien. Mon studio reste sur l’appareil qui le tient.\n\n${sections.join("\n\n")}\n`;
}

export function jobsMarkdown(takes: readonly Take[], loras: readonly Lora[] = [], slug = ""): string {
  const prise = (id: string) => slug ? `Projets/${slug}/Prises/${id}` : `prises/${id}`;
  const fiche = (lora: Lora) => slug
    ? (isPlaceLora(lora) ? `Projets/${slug}/Lieux/${lora.id}-fichier` : `Projets/${slug}/Cast/${lora.id}`)
    : `loras/${lora.id}`;
  const rows = [
    ...takes.map(take => ({
      at: take.at,
      row: `| ${take.at.slice(0, 16).replace("T", " ")} | [[${prise(take.id)}]] | ${take.engine === "lora" ? "fal" : "Comfy"} | ${take.profile} | ${take.gpuSeconds ?? "—"} | ${costLabel(take) ?? "en attente"} |`,
    })),
    ...loras.map(lora => ({
      at: lora.at,
      row: `| ${lora.at.slice(0, 16).replace("T", " ")} | [[${fiche(lora)}]] | fal | lora-${lora.steps}pas-rang${lora.rank} | ${lora.seconds ?? "—"} | ${lora.costUsd === null ? "en attente" : usd(lora.costUsd)} |`,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at)).map(item => item.row);
  return `# Journal\n\nUne ligne par prise et par formation. Le coût vient du compte qui a payé : le solde Comfy, ou la facture fal de la demande.\n\n| Date | Quoi | Moteur | Réglage | Calcul (s) | Coût |\n| --- | --- | --- | --- | --- | --- |\n${rows.join("\n")}\n`;
}

export const README = `# U*TTU — Mon studio

Ce dossier est mon studio. L’app l’écrit, Obsidian le lit tel quel.

- \`MOC.md\` — la carte des projets.
- \`Projets/<projet>/\` — un univers complet : bible, style, lexique, personnages, références, lieux, prises, séquences, journal, moteurs.
- \`.uttu/projet.json\` — le projet en cours. Pas une clé.

La chaîne ne lit que le projet en cours. Rien ici n’est envoyé au studio. Du téléphone à l’ordinateur, et retour : exporte ce dossier, emporte le ZIP toi-même, importe-le sur l’autre appareil. Aucun serveur ne le copie. Les prises et les formations tournent sur tes propres comptes.
`;

async function readActive(store: VaultStore): Promise<string | null> {
  try {
    const raw = JSON.parse((await store.get(ACTIVE_FILE))?.text ?? "null") as { actif?: unknown } | null;
    return typeof raw?.actif === "string" && projectSlug(raw.actif) === raw.actif ? raw.actif : null;
  } catch {
    return null;
  }
}

async function writeActive(store: VaultStore, slug: string): Promise<void> {
  await writeText(store, ACTIVE_FILE, JSON.stringify({ actif: slug }));
}

function loraFiche(slug: string, lora: Pick<Lora, "id" | "kind">): string {
  return projectPath(slug, isPlaceLora(lora) ? `Lieux/${lora.id}-fichier.md` : `Cast/${lora.id}.md`);
}

/** Renames scaffold notes that used a section name. A file already at the new path stays, text included. */
export async function migrateSectionFiles(store: VaultStore): Promise<void> {
  const slugs = projectSlugsFrom((await store.list()).map(entry => entry.path));
  for (const slug of slugs) {
    for (const [from, to] of SECTION_FILE_MOVES) {
      const src = projectPath(slug, from);
      const dest = projectPath(slug, to);
      const source = await store.get(src);
      if (!source || await store.get(dest)) continue;
      await store.put({ ...source, path: dest });
      await store.remove(src);
    }
    for (const entry of await store.list()) {
      if (!entry.text || !entry.path.startsWith(`${projectPath(slug)}/`)) continue;
      const next = rewriteSectionLinks(entry.text);
      if (next === entry.text) continue;
      await writeText(store, entry.path, next);
    }
  }
}

/** Moves a vault from the old single-folder layout into one project. A file already there stays. */
export async function migrateLegacy(store: VaultStore): Promise<void> {
  const entries = await store.list();
  const legacy = entries.filter(entry => isLegacyPath(entry.path));
  if (legacy.length === 0) return;
  const canon = entries.find(entry => entry.path === "CANON.md")?.text;
  const slug = projectSlug(canon ? parseCanon(canon).name : "");
  for (const entry of legacy) {
    let dest = legacyDestination(entry.path, slug);
    if (entry.path.startsWith("loras/") && entry.path.endsWith(".md")) {
      const id = entry.path.slice("loras/".length, -".md".length);
      const parsed = entry.text ? parseLora(id, entry.text) : null;
      dest = projectPath(slug, parsed?.kind === "lieu" ? `Lieux/${id}-fichier.md` : `Cast/${id}.md`);
    }
    if (!dest || !cleanPath(dest) || await store.get(dest)) {
      await store.remove(entry.path);
      continue;
    }
    const moved: VaultEntry = {
      path: dest,
      updatedAt: entry.updatedAt || Date.now(),
    };
    if (entry.text !== undefined) moved.text = relocateText(entry.text, slug);
    if (entry.blob) moved.blob = entry.blob;
    await store.put(moved);
    await store.remove(entry.path);
  }
  if (!(await readActive(store))) await writeActive(store, slug);
}

async function fillScaffold(store: VaultStore, slug: string, name: string): Promise<void> {
  for (const file of scaffoldFiles(slug, name)) {
    if (!(await store.get(file.path))) await writeText(store, file.path, file.text);
  }
}

function heldScene(parsed: Scene, byPath: Map<string, VaultEntry>): Scene {
  const fileHeld = Boolean(parsed.previzFile && byPath.has(parsed.previzFile));
  return {
    ...parsed,
    stills: parsed.stills.filter(path => byPath.has(path)),
    previzFile: fileHeld ? parsed.previzFile : null,
    frames: parsed.frames.length > 0 && parsed.frames.every(path => byPath.has(path)) ? parsed.frames : [],
    render: parsed.render && byPath.has(parsed.render) ? parsed.render : null,
    views: parsed.views.filter(path => byPath.has(path)),
  };
}

export async function loadStudio(store: VaultStore): Promise<Studio> {
  await migrateLegacy(store);
  await migrateSectionFiles(store);
  let entries = await store.list();
  const slugs = projectSlugsFrom(entries.map(entry => entry.path));
  let slug = await readActive(store);
  if (!slug || !slugs.includes(slug)) slug = slugs[0] ?? null;
  if (slug && (await readActive(store)) !== slug) await writeActive(store, slug);
  if (slug) {
    const heading = entries.find(entry => entry.path === projectPath(slug, "_MOC.md"))?.text;
    await fillScaffold(store, slug, projectTitle(slug, heading));
    entries = await store.list();
  }
  const projects = projectSlugsFrom(entries.map(entry => entry.path)).map(item => ({
    slug: item,
    name: projectTitle(item, entries.find(entry => entry.path === projectPath(item, "_MOC.md"))?.text),
  }));
  const studio = emptyStudio();
  studio.projects = projects;
  studio.project = slug;
  studio.projectName = projects.find(item => item.slug === slug)?.name ?? "";
  studio.tree = slug ? projectTree(slug, entries.map(entry => entry.path)) : [];
  studio.memory = slug ? readProjectMemory(slug, entries) : emptyMemory();
  if (!slug) return studio;
  const byPath = new Map(entries.map(entry => [entry.path, entry]));
  const prefix = projectPath(slug);
  const canon = byPath.get(`${prefix}/Cast/canon.md`)?.text;
  if (canon) {
    const look = parseCanon(canon);
    studio.look = { ...look, photos: look.photos.filter(path => byPath.has(path)) };
  }
  const sceneRe = new RegExp(`^Projets/${slug}/Lieux/([a-z0-9-]+)\\.md$`);
  const placeRe = new RegExp(`^Projets/${slug}/Lieux/([A-Za-z0-9-]+)-fichier\\.md$`);
  const castRe = new RegExp(`^Projets/${slug}/Cast/([A-Za-z0-9-]+)\\.md$`);
  const takeRe = new RegExp(`^Projets/${slug}/Prises/([A-Za-z0-9-]+)\\.md$`);
  const sequenceRe = new RegExp(`^Projets/${slug}/Sequences/([a-z0-9-]+)\\.md$`);
  const shotRe = new RegExp(`^Projets/${slug}/Shots/([a-z0-9-]+)\\.md$`);
  for (const entry of entries) {
    if (!entry.path.startsWith(`${prefix}/`) || !entry.text) continue;
    const place = placeRe.exec(entry.path);
    if (place) {
      const parsed = parseLora(place[1], entry.text);
      if (parsed && byPath.has(parsed.file)) studio.loras.push(parsed);
      continue;
    }
    const scene = sceneRe.exec(entry.path);
    if (scene && !entry.path.endsWith("-fichier.md")) {
      studio.scenes.push(heldScene(parseScene(scene[1], entry.text), byPath));
      continue;
    }
    const take = takeRe.exec(entry.path);
    if (take) {
      const parsed = parseTake(take[1], entry.text);
      if (parsed && byPath.has(parsed.video)) studio.takes.push({ ...parsed, poster: parsed.poster && byPath.has(parsed.poster) ? parsed.poster : null });
      continue;
    }
    const sequence = sequenceRe.exec(entry.path);
    if (sequence) {
      const parsed = parseSequence(sequence[1], entry.text);
      if (parsed) studio.sequences.push(parsed);
      continue;
    }
    const shot = shotRe.exec(entry.path);
    if (shot) {
      const parsed = parseShot(shot[1], entry.text);
      if (parsed) studio.shots.push(parsed);
      continue;
    }
    const cast = castRe.exec(entry.path);
    if (cast && cast[1] !== "canon") {
      const parsed = parseLora(cast[1], entry.text);
      if (parsed && byPath.has(parsed.file)) studio.loras.push(parsed);
    }
  }
  studio.takes.sort((a, b) => b.at.localeCompare(a.at));
  studio.sequences.sort((a, b) => a.name.localeCompare(b.name, "fr") || a.id.localeCompare(b.id));
  studio.shots.sort((a, b) => a.name.localeCompare(b.name, "fr") || a.id.localeCompare(b.id));
  const shotIndex = byPath.get(`${prefix}/Shots/index.md`)?.text;
  if (shotIndex?.includes("Un plan est une prise rangée dans ce projet.")) {
    await writeText(store, `${prefix}/Shots/index.md`, shotIndex.replace("Un plan est une prise rangée dans ce projet.", "Un plan est une case du storyboard : une séquence, puis des prises, dans l’ordre."));
  }
  studio.loras.sort((a, b) => b.at.localeCompare(a.at));
  const filmed = new Set(studio.takes.map(take => take.id));
  for (const scene of studio.scenes) if (scene.shot && !filmed.has(scene.shot)) scene.shot = null;
  try {
    const state = JSON.parse(byPath.get(`${prefix}/.uttu/etat.json`)?.text ?? "{}") as { lieu?: unknown };
    if (typeof state.lieu === "string" && studio.scenes.some(scene => scene.id === state.lieu)) studio.currentScene = state.lieu;
  } catch {}
  studio.currentScene ??= studio.scenes[0]?.id ?? null;
  const storedQuotes = parseQuoteFile(byPath.get(`${prefix}/${QUOTE_FILE}`)?.text);
  if (storedQuotes) studio.quotes = storedQuotes;
  else {
    studio.quotes = seedQuotes(studio.takes);
    if (studio.quotes.length > 0) await writeText(store, `${prefix}/${QUOTE_FILE}`, quotesJson(studio.quotes));
  }
  studio.clips = readClips(byPath.get(`${prefix}/.uttu/clips.json`)?.text).filter(clip => byPath.has(clip.path));
  const role = parseRole(byPath.get(`${prefix}/.uttu/role.json`)?.text);
  studio.role = { ...role, photos: role.photos.filter(path => byPath.has(path)) };
  return studio;
}

const FORMATS: readonly ClipFormat[] = ["mp4", "mov", "mkv", "avi"];

function readClips(source: string | undefined): Clip[] {
  try {
    const rows = JSON.parse(source ?? "[]") as Record<string, unknown>[];
    if (!Array.isArray(rows)) return [];
    return rows.flatMap(row => {
      const format = typeof row.format === "string" ? pick(row.format, FORMATS) : null;
      const values = [row.bytes, row.seconds, row.width, row.height].map(Number);
      if (typeof row.path !== "string" || !clipVaultPath(row.path) || !format || values.some(value => !Number.isFinite(value))) return [];
      return [{ path: row.path, format, bytes: values[0], seconds: values[1], width: values[2], height: values[3] }];
    });
  } catch {
    return [];
  }
}

const now = () => Date.now();

export async function writeMemory(store: VaultStore, slug: string, kind: MemoryKind, body: string): Promise<void> {
  await writeText(store, projectPath(slug, MEMORY_FILE[kind]), memoryMarkdown(slug, kind, body));
}

export async function writePromptNote(store: VaultStore, slug: string, file: string, body: string): Promise<void> {
  if (!promptNoteFile(file)) return;
  await writeText(store, projectPath(slug, `Prompts/${file}`), promptNoteMarkdown(slug, file, body));
}

export async function writeText(store: VaultStore, path: string, value: string): Promise<void> {
  await store.put({ path, text: value, updatedAt: now() });
}

export async function writeBlob(store: VaultStore, path: string, blob: Blob): Promise<void> {
  await store.put({ path, blob, updatedAt: now() });
}

async function writeRoot(store: VaultStore): Promise<void> {
  const entries = await store.list();
  const projects = projectSlugsFrom(entries.map(entry => entry.path)).map(item => ({
    slug: item,
    name: projectTitle(item, entries.find(entry => entry.path === projectPath(item, "_MOC.md"))?.text),
  }));
  await writeText(store, "MOC.md", rootMoc(projects));
  if (!(await store.get("README.md"))) await writeText(store, "README.md", README);
}

/** Opens a project, or makes the default one. An empty vault stays empty until this, or until a write. */
export async function ensureActiveProject(store: VaultStore, name = DEFAULT_PROJECT_NAME): Promise<string> {
  await migrateLegacy(store);
  const wanted = projectSlug(name);
  const slugs = projectSlugsFrom((await store.list()).map(entry => entry.path));
  const active = await readActive(store);
  if (active && slugs.includes(active)) return active;
  if (slugs.includes(wanted)) {
    await writeActive(store, wanted);
    return wanted;
  }
  if (slugs[0]) {
    await writeActive(store, slugs[0]);
    return slugs[0];
  }
  return createProject(store, name);
}

export async function createProject(store: VaultStore, name: string): Promise<string> {
  const label = name.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, NAME_MAX) || DEFAULT_PROJECT_NAME;
  const slug = uniqueId(projectSlug(label), projectSlugsFrom((await store.list()).map(entry => entry.path)));
  for (const file of scaffoldFiles(slug, label)) await writeText(store, file.path, file.text);
  await writeActive(store, slug);
  await writeRoot(store);
  return slug;
}

export async function selectProject(store: VaultStore, slug: string): Promise<void> {
  const slugs = projectSlugsFrom((await store.list()).map(entry => entry.path));
  if (!slugs.includes(slug)) return;
  await writeActive(store, slug);
}

/** Keeps the root map and the active project's map next to the files Obsidian opens. */
export async function writeMap(store: VaultStore): Promise<void> {
  const studio = await loadStudio(store);
  await writeText(store, "MOC.md", rootMoc(studio.projects));
  if (studio.project) {
    await writeText(store, projectPath(studio.project, "Journal.md"), jobsMarkdown(studio.takes, studio.loras, studio.project));
    await writeText(store, projectPath(studio.project, "_MOC.md"), mocMarkdown(studio));
  }
  if (!(await store.get("README.md"))) await writeText(store, "README.md", README);
}

export async function writeLook(store: VaultStore, look: Look): Promise<void> {
  const slug = await ensureActiveProject(store);
  await writeText(store, projectPath(slug, "Cast/canon.md"), canonMarkdown(look, slug));
  await writeMap(store);
}

export async function writeScene(store: VaultStore, scene: Scene): Promise<void> {
  const slug = await ensureActiveProject(store);
  await writeText(store, projectPath(slug, `Lieux/${scene.id}.md`), sceneMarkdown(scene, slug));
  await writeMap(store);
}

export async function removeScene(store: VaultStore, scene: Scene): Promise<void> {
  const slug = await ensureActiveProject(store);
  for (const path of [...scene.stills, ...scene.frames, ...(scene.views ?? [])]) await store.remove(path);
  if (scene.previzFile) await store.remove(scene.previzFile);
  if (scene.render && !scene.frames.includes(scene.render)) await store.remove(scene.render);
  await store.remove(projectPath(slug, `Lieux/${scene.id}.md`));
  await writeMap(store);
}

export async function writeRole(store: VaultStore, role: RoleDraft): Promise<void> {
  const slug = await ensureActiveProject(store);
  await writeText(store, projectPath(slug, ".uttu/role.json"), roleJson(role));
}

export async function writeState(store: VaultStore, currentScene: string | null): Promise<void> {
  const slug = await ensureActiveProject(store);
  await writeText(store, projectPath(slug, ".uttu/etat.json"), JSON.stringify({ lieu: currentScene }));
}

export async function writeQuotes(store: VaultStore, quotes: readonly MeasuredQuote[]): Promise<void> {
  const slug = await ensureActiveProject(store);
  await writeText(store, projectPath(slug, QUOTE_FILE), quotesJson(quotes));
}

export async function writeTake(store: VaultStore, take: Take, _takes: readonly Take[], _loras: readonly Lora[] = []): Promise<void> {
  const slug = await ensureActiveProject(store);
  await writeText(store, projectPath(slug, `Prises/${take.id}.md`), takeMarkdown(take, slug));
  await writeMap(store);
}

export async function writeShot(store: VaultStore, shot: Shot, takes: readonly Pick<Take, "id" | "line">[] = [], sequenceName = ""): Promise<void> {
  if (!/^[a-z0-9-]+$/.test(shot.id) || SHOT_SKIP.has(shot.id)) return;
  const slug = await ensureActiveProject(store);
  const clean: Shot = {
    ...shot,
    name: oneLine(shot.name, NAME_MAX),
    sequenceId: cleanSequenceId(shot.sequenceId),
    takeIds: normalizeTakeIds(shot.takeIds),
    note: oneLine(shot.note, SHOT_NOTE_MAX),
    ordre: 0,
  };
  if (!clean.name) return;
  clean.ordre = clean.sequenceId ? Math.max(0, Math.round(shot.ordre)) : 0;
  await writeText(store, projectPath(slug, `Shots/${clean.id}.md`), shotMarkdown(clean, slug, takes, sequenceName));
  await writeMap(store);
}

export async function removeShot(store: VaultStore, id: string): Promise<void> {
  if (!/^[a-z0-9-]+$/.test(id) || id === "index") return;
  const slug = await ensureActiveProject(store);
  await store.remove(projectPath(slug, `Shots/${id}.md`));
  await writeMap(store);
}

export async function writeSequence(store: VaultStore, sequence: Sequence, takes: readonly Pick<Take, "id" | "line">[] = []): Promise<void> {
  if (!/^[a-z0-9-]+$/.test(sequence.id) || SEQUENCE_SKIP.has(sequence.id)) return;
  const slug = await ensureActiveProject(store);
  const clean: Sequence = { ...sequence, name: oneLine(sequence.name, NAME_MAX), links: normalizeLinks(sequence.links) };
  if (!clean.name) return;
  await writeText(store, projectPath(slug, `Sequences/${clean.id}.md`), sequenceMarkdown(clean, slug, takes));
  await writeMap(store);
}

export async function removeSequence(store: VaultStore, id: string): Promise<void> {
  if (!/^[a-z0-9-]+$/.test(id) || id === "index") return;
  const slug = await ensureActiveProject(store);
  await store.remove(projectPath(slug, `Sequences/${id}.md`));
  await writeMap(store);
}

export async function removeTake(store: VaultStore, take: Take, _takes: readonly Take[], _loras: readonly Lora[] = []): Promise<void> {
  const slug = await ensureActiveProject(store);
  await store.remove(take.video);
  if (take.poster) await store.remove(take.poster);
  await store.remove(projectPath(slug, `Prises/${take.id}.md`));
  await writeMap(store);
}

export async function writeClips(store: VaultStore, clips: readonly Clip[]): Promise<void> {
  const slug = await ensureActiveProject(store);
  await writeText(store, projectPath(slug, ".uttu/clips.json"), JSON.stringify(clips));
}

export async function writeLora(store: VaultStore, lora: Lora, file: Blob, _takes: readonly Take[], _loras: readonly Lora[]): Promise<void> {
  const slug = await ensureActiveProject(store);
  await writeBlob(store, lora.file, file);
  await writeText(store, loraFiche(slug, lora), loraMarkdown(lora, slug));
  await writeMap(store);
}

export async function removeLora(store: VaultStore, lora: Lora, _takes: readonly Take[], _loras: readonly Lora[]): Promise<void> {
  const slug = await ensureActiveProject(store);
  await store.remove(lora.file);
  await store.remove(loraFiche(slug, lora));
  await writeMap(store);
}

/** The file's own fingerprint, written in its sheet so a take can prove which file it loaded. */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
